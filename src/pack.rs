//! 知识包来源：内嵌默认包、白名单本地文件、白名单 URL。任意 URL 直接拒绝。
//!
//! 自定义包声明 `extends` 为默认包的 `id` 时按覆盖包处理：合并到默认包之上，只写了几条的包也能查到其余条目。
//! 没有 `extends` 的包整包独立使用。`extends` 指向其他包时拒绝：本进程拿不到那个底包。

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use x_iztro::{KnowledgePack, Language};

use crate::error::{Error, ErrorCode};

/// 远程知识包正文上限。超过则拒绝，不缓存截断内容。
const MAX_PACK_BYTES: usize = 1024 * 1024;

/// 调用方给出的包引用。缺省或 `builtin` 走内嵌包。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PackRef {
    /// x-iztro 内嵌默认包（目前只有 zh-CN）。
    Builtin,
    /// 本地文件；必须落在启动时声明的目录内。
    File(PathBuf),
    /// HTTP(S) URL；必须精确匹配启动时的白名单。
    Url(String),
}

impl PackRef {
    /// 解析工具参数。`None` / 空 / `builtin` 为内嵌包；`file:` 前缀为本地路径；`http(s):` 为 URL。
    pub fn parse(raw: Option<&str>) -> Result<Self, Error> {
        match raw.map(str::trim).filter(|s| !s.is_empty()) {
            None | Some("builtin") => Ok(Self::Builtin),
            Some(s) if s.starts_with("file:") => {
                let path = s.trim_start_matches("file:").trim();
                if path.is_empty() {
                    return Err(Error::invalid_argument("file pack path is empty"));
                }
                Ok(Self::File(PathBuf::from(path)))
            }
            Some(s) if s.starts_with("https://") || s.starts_with("http://") => {
                Ok(Self::Url(s.to_string()))
            }
            Some(s) => Err(Error::new(
                ErrorCode::PackNotAllowed,
                format!(
                    "pack `{s}` is not builtin / file:… / https URL; arbitrary identifiers are rejected"
                ),
            )),
        }
    }
}

/// 进程内允许加载的包范围。公网默认只有内嵌包。
#[derive(Debug, Clone, Default)]
pub struct PackPolicy {
    /// 本地文件必须落在这些目录的规范化路径之下。
    pub allow_dirs: Vec<PathBuf>,
    /// 远程包必须与其中一条字符串完全相等。
    pub allow_urls: Vec<String>,
}

/// 进程级包缓存。盘不算、不缓存；包不是生辰，解析一次即可。
pub struct PackStore {
    policy: PackPolicy,
    cache: Mutex<HashMap<String, Arc<KnowledgePack>>>,
    http: reqwest::Client,
}

impl PackStore {
    /// 按策略构造。HTTP 客户端只用于白名单 URL。
    pub fn new(policy: PackPolicy) -> Result<Self, Error> {
        let http = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| Error::internal(format!("http client: {e}")))?;
        Ok(Self {
            policy,
            cache: Mutex::new(HashMap::new()),
            http,
        })
    }

    /// 解析并加载。内嵌包走内核 `OnceLock`；其余按策略校验后再读。
    pub async fn load(&self, pack_ref: PackRef) -> Result<Arc<KnowledgePack>, Error> {
        match pack_ref {
            PackRef::Builtin => {
                if let Some(hit) = self.cached("builtin") {
                    return Ok(hit);
                }
                let pack = KnowledgePack::builtin(Language::ZhCN)
                    .ok_or_else(|| Error::internal("builtin knowledge pack missing for zh-CN"))?;
                let arc = Arc::new(pack.clone());
                self.cache
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .insert("builtin".to_string(), Arc::clone(&arc));
                Ok(arc)
            }
            PackRef::File(path) => self.load_file(&path).await,
            PackRef::Url(url) => self.load_url(&url).await,
        }
    }

    async fn load_file(&self, path: &Path) -> Result<Arc<KnowledgePack>, Error> {
        let not_allowed = || {
            Error::new(
                ErrorCode::PackNotAllowed,
                format!("pack file {} is outside allow-pack-dir", path.display()),
            )
        };
        let canonical = match tokio::fs::canonicalize(path).await {
            Ok(canonical) => canonical,
            // 白名单外的路径一律答「不允许」，不透露文件是否存在。
            Err(_) if !self.file_allowed(path) => return Err(not_allowed()),
            Err(e) => {
                return Err(Error::new(
                    ErrorCode::PackUnavailable,
                    format!("cannot read pack file {}: {e}", path.display()),
                ));
            }
        };
        if !self.file_allowed(&canonical) {
            return Err(not_allowed());
        }
        let key = format!("file:{}", canonical.display());
        if let Some(hit) = self.cached(&key) {
            return Ok(hit);
        }
        let json = tokio::fs::read_to_string(&canonical).await.map_err(|e| {
            Error::new(
                ErrorCode::PackUnavailable,
                format!("cannot read pack file {}: {e}", canonical.display()),
            )
        })?;
        self.parse_and_cache(key, &json)
    }

    async fn load_url(&self, url: &str) -> Result<Arc<KnowledgePack>, Error> {
        if !self.policy.allow_urls.iter().any(|u| u == url) {
            return Err(Error::new(
                ErrorCode::PackNotAllowed,
                format!("pack URL `{url}` is not in the allowlist"),
            ));
        }
        let key = format!("url:{url}");
        if let Some(hit) = self.cached(&key) {
            return Ok(hit);
        }
        let mut response =
            self.http.get(url).send().await.map_err(|e| {
                Error::pack_unavailable(format!("failed to fetch pack `{url}`: {e}"))
            })?;
        if !response.status().is_success() {
            return Err(Error::pack_unavailable(format!(
                "pack `{url}` returned HTTP {}",
                response.status()
            )));
        }
        if response
            .content_length()
            .is_some_and(|n| n > MAX_PACK_BYTES as u64)
        {
            return Err(Error::invalid_argument(format!(
                "pack `{url}` is larger than {MAX_PACK_BYTES} bytes"
            )));
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|e| Error::pack_unavailable(format!("failed to read pack `{url}`: {e}")))?
        {
            if chunk.len() > MAX_PACK_BYTES - bytes.len() {
                return Err(Error::invalid_argument(format!(
                    "pack `{url}` is larger than {MAX_PACK_BYTES} bytes"
                )));
            }
            bytes.extend_from_slice(&chunk);
        }
        let json = std::str::from_utf8(&bytes)
            .map_err(|_| Error::invalid_argument(format!("pack `{url}` is not UTF-8 JSON")))?;
        self.parse_and_cache(key, json)
    }

    /// 路径是否落在某个白名单目录之下。带 `..` 的路径不算：按字面比较时它可以指到目录外。
    fn file_allowed(&self, path: &Path) -> bool {
        if path
            .components()
            .any(|c| c == std::path::Component::ParentDir)
        {
            return false;
        }
        self.policy.allow_dirs.iter().any(|dir| {
            let Ok(base) = dir.canonicalize() else {
                return false;
            };
            path.starts_with(base)
        })
    }

    fn cached(&self, key: &str) -> Option<Arc<KnowledgePack>> {
        self.cache
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(key)
            .cloned()
    }

    fn parse_and_cache(&self, key: String, json: &str) -> Result<Arc<KnowledgePack>, Error> {
        let pack = KnowledgePack::from_json(json)
            .map_err(|e| Error::invalid_argument(format!("knowledge pack JSON rejected: {e}")))?;
        let arc = Arc::new(resolve_extends(pack)?);
        self.cache
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(key, Arc::clone(&arc));
        Ok(arc)
    }
}

/// 按包的 `extends` 声明决定独立使用还是叠在默认包上。
fn resolve_extends(pack: KnowledgePack) -> Result<KnowledgePack, Error> {
    let Some(base_id) = pack.extends.as_deref() else {
        return Ok(pack);
    };
    let builtin = KnowledgePack::builtin(Language::ZhCN)
        .ok_or_else(|| Error::internal("builtin knowledge pack missing for zh-CN"))?;
    if base_id != builtin.id {
        return Err(Error::invalid_argument(format!(
            "knowledge pack `{}` extends `{base_id}`, but the only base available is `{}`",
            pack.id, builtin.id
        )));
    }
    Ok(builtin.merged(&[&pack]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn overlay_pack_is_merged_onto_builtin_and_standalone_pack_is_not() {
        let overlay = KnowledgePack::from_json(
            r#"{"schema":1,"id":"my-school","version":"1","language":"zh-CN","extends":"iztro-docs",
                "topics":{"romance":{"surround":[],"palaces":["soulPalace"]}}}"#,
        )
        .unwrap();
        let merged = resolve_extends(overlay).unwrap();
        assert_eq!(merged.id, "my-school");
        assert_eq!(
            merged.topic("romance").unwrap().palaces.as_deref(),
            Some(&["soulPalace".to_string()][..])
        );
        assert!(merged.stars.contains_key("ziweiMaj"));

        let standalone = KnowledgePack::from_json(
            r#"{"schema":1,"id":"alone","version":"1","language":"zh-CN"}"#,
        )
        .unwrap();
        assert!(resolve_extends(standalone).unwrap().stars.is_empty());

        let orphan = KnowledgePack::from_json(
            r#"{"schema":1,"id":"x","version":"1","language":"zh-CN","extends":"other-base"}"#,
        )
        .unwrap();
        assert_eq!(
            resolve_extends(orphan).unwrap_err().code,
            ErrorCode::InvalidArgument
        );
    }

    #[test]
    fn parses_builtin_and_rejects_random_id() {
        assert_eq!(PackRef::parse(None).unwrap(), PackRef::Builtin);
        assert_eq!(PackRef::parse(Some("builtin")).unwrap(), PackRef::Builtin);
        assert_eq!(
            PackRef::parse(Some("file:/tmp/a.json")).unwrap(),
            PackRef::File(PathBuf::from("/tmp/a.json"))
        );
        let err = PackRef::parse(Some("my-school")).unwrap_err();
        assert_eq!(err.code, ErrorCode::PackNotAllowed);
    }

    #[tokio::test]
    async fn url_not_on_allowlist_is_rejected() {
        let store = PackStore::new(PackPolicy::default()).unwrap();
        let err = store
            .load(PackRef::Url("https://evil.example/pack.json".into()))
            .await
            .unwrap_err();
        assert_eq!(err.code, ErrorCode::PackNotAllowed);
    }

    #[tokio::test]
    async fn builtin_loads() {
        let store = PackStore::new(PackPolicy::default()).unwrap();
        let pack = store.load(PackRef::Builtin).await.unwrap();
        assert!(!pack.id.is_empty());
        assert!(
            pack.star(x_iztro::StarKey::from_key("ziweiMaj").unwrap())
                .is_some()
        );
    }
}
