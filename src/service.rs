//! 各工具的共用编排：适配器只做协议翻译，排盘、文本与知识查询都走这里。

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use x_iztro::KnowledgePack;

use crate::birth::{BaziRequest, BirthRequest, TargetRequest};
use crate::chart::{
    Depth, Detail, Projection, births_by_bazi, cast, cast_horoscope, decadal_overview_text,
    horoscope_text, natal_text, topic_text, yearly_overview_text,
};
use crate::error::{Error, ErrorCode};
use crate::knowledge::{Catalog, Entries, Kind, PackInfo, catalog, lookup};
use crate::pack::{PackRef, PackStore};

/// 单次查询最多的标识个数。
pub const MAX_LOOKUP_KEYS: usize = 20;
/// 流年一览一次最多的年数。
pub const MAX_OVERVIEW_YEARS: i64 = 20;

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
    /// 运限目标：农历年、农历年加月、公历日期，或公历日期加时辰。问到哪一层就返回到哪一层。
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

/// `ziwei_get_decadal_overview` / `POST /v1/decades` 入参。
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct DecadalOverviewRequest {
    /// 生辰。
    pub birth: BirthRequest,
    /// 是否在表后附各大限四化星的知识包释义：`summary` 或 `full`。省略则只返回事实。
    #[serde(default)]
    pub knowledge: Option<Depth>,
    /// 知识包，规则同 `ziwei_get_natal_chart`。
    #[serde(default)]
    pub pack: Option<String>,
}

/// `ziwei_get_yearly_overview` / `POST /v1/years` 入参。
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct YearlyOverviewRequest {
    /// 生辰。
    pub birth: BirthRequest,
    /// 起始农历年（含），用公历年份数字表示：2027 指 2027 年正月初一起的那个农历年。
    #[schemars(range(min = 1, max = 9999))]
    pub from_year: i64,
    /// 截止农历年（含），与起始年合计最多 20 年。
    #[schemars(range(min = 1, max = 9999))]
    pub to_year: i64,
    /// 是否在表后附流年四化星的知识包释义：`summary` 或 `full`。省略则只返回事实。
    #[serde(default)]
    pub knowledge: Option<Depth>,
    /// 知识包，规则同 `ziwei_get_natal_chart`。
    #[serde(default)]
    pub pack: Option<String>,
}

/// `ziwei_find_birth_by_bazi` / `POST /v1/bazi` 的结果。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct BaziCandidates {
    /// 能排出这组八字的公历生辰，按日期先后；范围内没有时为空。
    pub candidates: Vec<BaziCandidate>,
}

/// 一个候选生辰，可直接作为 `birth.date` 与 `birth.time_index`。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct BaziCandidate {
    /// 公历日期 `YYYY-M-D`。
    pub date: String,
    /// 时辰序号 0–12；子时可能同时给出早子 0 与晚子 12 两个候选。
    pub time_index: u8,
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

    /// 一生的大限一览，可选附四化星释义。
    pub async fn decadal_overview(&self, req: DecadalOverviewRequest) -> Result<TextView, Error> {
        let birth = req.birth.parse()?;
        let pack = self.pack_for(req.knowledge, req.pack.as_deref()).await?;
        let chart = cast(&birth)?;
        tracing::info!(tool = "ziwei_get_decadal_overview", language = %birth.language.as_key(), "decades");
        let text = decadal_overview_text(
            &chart,
            Projection {
                detail: Detail::default(),
                depth: req.knowledge,
                pack: pack.as_deref(),
            },
        )?;
        Ok(view(text, &birth.language, pack.as_deref()))
    }

    /// 连续若干农历年的流年一览，可选附四化星释义。
    pub async fn yearly_overview(&self, req: YearlyOverviewRequest) -> Result<TextView, Error> {
        if req.to_year - req.from_year >= MAX_OVERVIEW_YEARS {
            return Err(Error::invalid_argument(format!(
                "from_year to to_year covers at most {MAX_OVERVIEW_YEARS} years"
            )));
        }
        let birth = req.birth.parse()?;
        let pack = self.pack_for(req.knowledge, req.pack.as_deref()).await?;
        let chart = cast(&birth)?;
        tracing::info!(tool = "ziwei_get_yearly_overview", language = %birth.language.as_key(), "years");
        let text = yearly_overview_text(
            &chart,
            req.from_year,
            req.to_year,
            Projection {
                detail: Detail::default(),
                depth: req.knowledge,
                pack: pack.as_deref(),
            },
        )?;
        Ok(view(text, &birth.language, pack.as_deref()))
    }

    /// 由八字反推候选公历生辰。
    pub async fn bazi(&self, req: BaziRequest) -> Result<BaziCandidates, Error> {
        let bazi = req.parse()?;
        tracing::info!(tool = "ziwei_find_birth_by_bazi", "bazi");
        Ok(BaziCandidates {
            candidates: births_by_bazi(&bazi)?
                .into_iter()
                .map(|c| BaziCandidate {
                    date: c.solar_date,
                    time_index: c.time_index,
                })
                .collect(),
        })
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
