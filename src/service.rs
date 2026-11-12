//! 五件工具的共用编排：适配器只做协议翻译，排盘、文本与知识查询都走这里。

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use x_iztro::KnowledgePack;

use crate::birth::{BirthRequest, TargetRequest};
use crate::chart::{
    Depth, Detail, Projection, cast, cast_horoscope, horoscope_text, natal_text, topic_text,
};
use crate::error::{Error, ErrorCode};
use crate::knowledge::{Catalog, Entries, Kind, PackInfo, catalog, lookup};
use crate::pack::{PackRef, PackStore};

/// 单次查询最多的标识个数。
pub const MAX_LOOKUP_KEYS: usize = 20;

/// 进程内共享状态。无用户、无命盘库。
#[derive(Clone)]
pub struct App {
    /// 知识包加载器（内嵌 / 白名单文件 / 白名单 URL）。
    pub packs: Arc<PackStore>,
}

/// `ziwei_get_natal_chart` / `POST /v1/chart` 入参。
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ChartRequest {
    /// 生辰。
    pub birth: BirthRequest,
    /// 事实详略：`full`（默认）或 `overview`。
    #[serde(default)]
    pub detail: Detail,
    /// 是否在事实后附知识包释义：`summary` 或 `full`。省略则只返回事实。
    #[serde(default)]
    pub knowledge: Option<Depth>,
    /// 知识包。省略或 `builtin` 为默认包；`file:…` 与 `https://…` 须在服务的白名单内，公网服务只有默认包。
    #[serde(default)]
    pub pack: Option<String>,
}

/// `ziwei_get_horoscope` / `POST /v1/horoscope` 入参。
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct HoroscopeRequest {
    /// 生辰。
    pub birth: BirthRequest,
    /// 运限目标：农历年、公历日期，或公历日期加时辰。给到哪个精度就返回到哪一层。
    pub target: TargetRequest,
    /// 事实详略：`full`（默认）或 `overview`。
    #[serde(default)]
    pub detail: Detail,
    /// 是否附流耀与行运格局的知识包释义：`summary` 或 `full`。省略则只返回事实。
    #[serde(default)]
    pub knowledge: Option<Depth>,
    /// 知识包，规则同 `ziwei_get_natal_chart`。
    #[serde(default)]
    pub pack: Option<String>,
}

/// `ziwei_get_topic_palaces` / `POST /v1/topic` 入参。
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct TopicRequest {
    /// 生辰。
    pub birth: BirthRequest,
    /// 主题 slug，取自知识包目录里 `kind=topic` 的条目，如默认包的 `romance`、`career`、`wealth`。
    pub topic: String,
    /// 事实详略：`full`（默认）或 `overview`。
    #[serde(default)]
    pub detail: Detail,
    /// 释义深度：`summary`（默认）或 `full`。
    #[serde(default = "default_topic_depth")]
    pub knowledge: Depth,
    /// 知识包，规则同 `ziwei_get_natal_chart`。主题的选宫定义与释义都取自它。
    #[serde(default)]
    pub pack: Option<String>,
}

fn default_topic_depth() -> Depth {
    Depth::Summary
}

/// `ziwei_lookup_knowledge` / `POST /v1/lookup` 入参。
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct LookupRequest {
    /// 条目段：`star` / `pattern` / `palace` / `mutagen` / `concept` / `topic`。
    pub kind: Kind,
    /// 语言无关标识，1 到 20 个，取自 `ziwei_list_knowledge`；不接受译名。
    #[schemars(length(min = 1, max = 20))]
    pub keys: Vec<String>,
    /// 知识包，规则同 `ziwei_get_natal_chart`。
    #[serde(default)]
    pub pack: Option<String>,
}

/// `ziwei_list_knowledge` / `POST /v1/catalog` 入参。
#[derive(Debug, Clone, Default, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct CatalogRequest {
    /// 只列某一段；省略则列全部。
    #[serde(default)]
    pub kind: Option<Kind>,
    /// 知识包，规则同 `ziwei_get_natal_chart`。
    #[serde(default)]
    pub pack: Option<String>,
}

/// 文本类工具的结果。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct TextView {
    /// Markdown 正文。
    pub text: String,
    /// 正文语言码。
    pub language: String,
    /// 正文里的释义与主题定义所依据的知识包；只有事实时为 `None`。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pack: Option<PackInfo>,
}

impl App {
    /// 本命盘事实，可选附释义。
    pub async fn chart(&self, req: ChartRequest) -> Result<TextView, Error> {
        let birth = req.birth.parse()?;
        let pack = self.pack_for(req.knowledge, req.pack.as_deref()).await?;
        let chart = cast(&birth)?;
        tracing::info!(tool = "ziwei_get_natal_chart", language = %birth.language.as_key(), "chart");
        let text = natal_text(
            &chart,
            Projection {
                detail: req.detail,
                depth: req.knowledge,
                pack: pack.as_deref(),
            },
        )?;
        Ok(view(text, &birth.language, pack.as_deref()))
    }

    /// 运限事实，层数随目标精度，可选附释义。
    pub async fn horoscope(&self, req: HoroscopeRequest) -> Result<TextView, Error> {
        let birth = req.birth.parse()?;
        let target = req.target.parse()?;
        let pack = self.pack_for(req.knowledge, req.pack.as_deref()).await?;
        let chart = cast(&birth)?;
        let horoscope = cast_horoscope(&chart, &target)?;
        tracing::info!(tool = "ziwei_get_horoscope", language = %birth.language.as_key(), "horoscope");
        let text = horoscope_text(
            &chart,
            &horoscope,
            Projection {
                detail: req.detail,
                depth: req.knowledge,
                pack: pack.as_deref(),
            },
        )?;
        Ok(view(text, &birth.language, pack.as_deref()))
    }

    /// 按知识包的主题定义取本命宫位事实与释义。
    pub async fn topic(&self, req: TopicRequest) -> Result<TextView, Error> {
        let birth = req.birth.parse()?;
        let pack = self
            .packs
            .load(PackRef::parse(req.pack.as_deref())?)
            .await?;
        if pack.topic(&req.topic).is_none() {
            let known: Vec<&str> = pack.topics.keys().map(String::as_str).collect();
            return Err(Error::new(
                ErrorCode::UnknownTopic,
                format!(
                    "pack `{}` has no topic `{}`; it defines: {}",
                    pack.id,
                    req.topic,
                    known.join(", ")
                ),
            ));
        }
        let chart = cast(&birth)?;
        tracing::info!(tool = "ziwei_get_topic_palaces", topic = %req.topic, pack_id = %pack.id, "topic");
        let text = topic_text(
            &chart,
            &req.topic,
            Projection {
                detail: req.detail,
                depth: Some(req.knowledge),
                pack: Some(pack.as_ref()),
            },
        )?;
        Ok(view(text, &birth.language, Some(pack.as_ref())))
    }

    /// 按标识查知识包条目。
    pub async fn lookup(&self, req: LookupRequest) -> Result<Entries, Error> {
        if req.keys.is_empty() || req.keys.len() > MAX_LOOKUP_KEYS {
            return Err(Error::invalid_argument(format!(
                "keys must hold 1 to {MAX_LOOKUP_KEYS} items, got {}",
                req.keys.len()
            )));
        }
        let pack = self
            .packs
            .load(PackRef::parse(req.pack.as_deref())?)
            .await?;
        tracing::info!(tool = "ziwei_lookup_knowledge", kind = ?req.kind, pack_id = %pack.id, "lookup");
        lookup(pack.as_ref(), req.kind, &req.keys)
    }

    /// 列出知识包里可查的条目。
    pub async fn catalog(&self, req: CatalogRequest) -> Result<Catalog, Error> {
        let pack = self
            .packs
            .load(PackRef::parse(req.pack.as_deref())?)
            .await?;
        tracing::info!(tool = "ziwei_list_knowledge", kind = ?req.kind, pack_id = %pack.id, "catalog");
        Ok(catalog(pack.as_ref(), req.kind))
    }

    /// 只在要附释义时加载包；只要事实却指定了包属于入参矛盾。
    async fn pack_for(
        &self,
        depth: Option<Depth>,
        pack: Option<&str>,
    ) -> Result<Option<Arc<KnowledgePack>>, Error> {
        match depth {
            Some(_) => Ok(Some(self.packs.load(PackRef::parse(pack)?).await?)),
            None if pack.is_some() => Err(Error::invalid_argument(
                "pack is only used together with knowledge",
            )),
            None => Ok(None),
        }
    }
}

fn view(text: String, language: &x_iztro::Language, pack: Option<&KnowledgePack>) -> TextView {
    TextView {
        text,
        language: language.as_key().to_string(),
        pack: pack.map(PackInfo::of),
    }
}
