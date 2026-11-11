//! 按标识查知识包一条。用于核对原文，不排盘。

use serde::{Deserialize, Serialize};
use x_iztro::{KnowledgePack, Mutagen, Palace, PatternKey, StarKey};

use crate::error::Error;
use crate::slice::{EntryKind, Quote, QuoteSource};

/// 查一条的请求种类。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum LookupKind {
    /// 星耀条目。
    Star,
    /// 格局条目。
    Pattern,
    /// 宫位条目。
    Palace,
    /// 四化条目。
    Mutagen,
    /// 术语条目。
    Concept,
}

/// 查到的一条。`text` 为空表示包里有这条但没有正文。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct LookupEntry {
    /// 条目种类。
    pub kind: LookupKind,
    /// 查询用的标识。
    pub key: String,
    /// 显示名或标题；包未写则为 `None`。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// 正文；缺省或空串为 `None`。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    /// 格局的古籍引文。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quotes: Option<Vec<String>>,
    /// 出自哪一份包。
    pub source: QuoteSource,
}

impl LookupEntry {
    /// 转成取材用的单条 [`Quote`]；没有正文时返回 `None`。
    pub fn as_quote(&self) -> Option<Quote> {
        let text = self.text.as_deref()?.trim();
        if text.is_empty() {
            return None;
        }
        Some(Quote {
            kind: match self.kind {
                LookupKind::Star => EntryKind::Star,
                LookupKind::Pattern => EntryKind::Pattern,
                LookupKind::Palace => EntryKind::Palace,
                LookupKind::Mutagen => EntryKind::Mutagen,
                LookupKind::Concept => EntryKind::Concept,
            },
            key: self.key.clone(),
            text: text.to_string(),
            source: self.source.clone(),
        })
    }
}

/// 在包里查一条。键不存在是调用方错误，不是空结果。
pub fn lookup(pack: &KnowledgePack, kind: LookupKind, key: &str) -> Result<LookupEntry, Error> {
    let source = QuoteSource {
        pack_id: pack.id.clone(),
        pack_version: pack.version.clone(),
    };
    match kind {
        LookupKind::Star => {
            let star = StarKey::from_key(key).ok_or_else(|| Error::unknown_key("star", key))?;
            let entry = pack
                .star(star)
                .ok_or_else(|| Error::unknown_key("star", key))?;
            Ok(LookupEntry {
                kind,
                key: key.to_string(),
                name: entry.name.clone(),
                text: nonempty(entry.intro.as_deref()),
                quotes: None,
                source,
            })
        }
        LookupKind::Pattern => {
            let pattern =
                PatternKey::from_key(key).ok_or_else(|| Error::unknown_key("pattern", key))?;
            let entry = pack
                .pattern(pattern)
                .ok_or_else(|| Error::unknown_key("pattern", key))?;
            Ok(LookupEntry {
                kind,
                key: key.to_string(),
                name: entry.name.clone(),
                text: nonempty(entry.intro.as_deref()),
                quotes: entry.quotes.clone(),
                source,
            })
        }
        LookupKind::Palace => {
            let palace = Palace::from_key(key).ok_or_else(|| Error::unknown_key("palace", key))?;
            let entry = pack
                .palace(palace)
                .ok_or_else(|| Error::unknown_key("palace", key))?;
            Ok(LookupEntry {
                kind,
                key: key.to_string(),
                name: entry.name.clone(),
                text: nonempty(entry.intro.as_deref()),
                quotes: None,
                source,
            })
        }
        LookupKind::Mutagen => {
            let mutagen =
                Mutagen::from_key(key).ok_or_else(|| Error::unknown_key("mutagen", key))?;
            let entry = pack
                .mutagen(mutagen)
                .ok_or_else(|| Error::unknown_key("mutagen", key))?;
            Ok(LookupEntry {
                kind,
                key: key.to_string(),
                name: entry.name.clone(),
                text: nonempty(entry.intro.as_deref()),
                quotes: None,
                source,
            })
        }
        LookupKind::Concept => {
            let entry = pack
                .concepts
                .get(key)
                .ok_or_else(|| Error::unknown_key("concept", key))?;
            Ok(LookupEntry {
                kind,
                key: key.to_string(),
                name: entry.title.clone(),
                text: nonempty(entry.intro.as_deref()),
                quotes: None,
                source,
            })
        }
    }
}

fn nonempty(text: Option<&str>) -> Option<String> {
    text.map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;
    use x_iztro::Language;

    fn pack() -> &'static KnowledgePack {
        KnowledgePack::builtin(Language::ZhCN).expect("zh-CN builtin")
    }

    #[test]
    fn finds_ziwei_intro() {
        let entry = lookup(pack(), LookupKind::Star, "ziweiMaj").unwrap();
        assert_eq!(entry.key, "ziweiMaj");
        assert!(entry.text.as_ref().is_some_and(|t| !t.is_empty()));
        assert_eq!(entry.source.pack_id, pack().id);
    }

    #[test]
    fn unknown_star_key_fails() {
        let err = lookup(pack(), LookupKind::Star, "notAStar").unwrap_err();
        assert_eq!(err.code, crate::error::ErrorCode::UnknownKey);
    }

    #[test]
    fn unknown_palace_key_fails() {
        let err = lookup(pack(), LookupKind::Palace, "moneyPalace").unwrap_err();
        assert_eq!(err.code, crate::error::ErrorCode::UnknownKey);
    }
}
