//! 三件工具的共用编排：适配器只做协议翻译，排盘与取材都走这里。

use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::birth::{BirthRequest, resolve_time_index};
use crate::chart::{ChartView, HoroscopeQuery, cast, cast_raw};
use crate::error::{Error, ErrorCode};
use crate::lookup::{LookupEntry, LookupKind, lookup};
use crate::pack::{PackRef, PackStore};
use crate::slice::{Slice, read};
use crate::topic::{Topic, parse_palace_key};

/// 进程内共享状态。无用户、无命盘库。
#[derive(Clone)]
pub struct App {
    /// 知识包加载器（内嵌 / 白名单文件 / 白名单 URL）。
    pub packs: Arc<PackStore>,
}

/// `ziwei_chart` / `POST /v1/chart` 入参。
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct ChartRequest {
    /// 生辰。
    #[serde(flatten)]
    pub birth: BirthRequest,
    /// 运限目标公历日期 `YYYY-M-D`。给出则同时返回运限文本。
    #[serde(default)]
    pub target_date: Option<String>,
    /// 运限时辰序号 0–12。缺省用出生时辰。与 `target_clock` 规则同出生时辰。
    #[serde(default)]
    pub target_time_index: Option<u8>,
    /// 运限钟点 `HH:MM`。
    #[serde(default)]
    pub target_clock: Option<String>,
}

/// `ziwei_read` / `POST /v1/read` 入参。
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct ReadRequest {
    /// 生辰。
    #[serde(flatten)]
    pub birth: BirthRequest,
    /// 封闭主题。问事业用 `career`，问财用 `wealth`，问流年用 `year`（必须带 `target_date`）。
    pub topic: Topic,
    /// 额外宫位标识（如 `propertyPalace`），与 topic 切片取并集。
    #[serde(default)]
    pub palaces: Vec<String>,
    /// 知识包。缺省或 `builtin` 为内嵌包；`file:…` 与 `https://…` 须在进程白名单内。
    #[serde(default)]
    pub pack: Option<String>,
    /// 运限目标公历日期。`topic=year` 时必填；其他主题给出则把该年流曜/行运格并进切片。
    #[serde(default)]
    pub target_date: Option<String>,
    /// 运限时辰序号。缺省用出生时辰。
    #[serde(default)]
    pub target_time_index: Option<u8>,
    /// 运限钟点 `HH:MM`。
    #[serde(default)]
    pub target_clock: Option<String>,
}

/// `ziwei_lookup` / `POST /v1/lookup` 入参。
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct LookupRequest {
    /// 条目种类：`star` / `pattern` / `palace` / `mutagen` / `concept`。
    pub kind: LookupKind,
    /// 语言无关标识，如 `ziweiMaj`、`soulPalace`、`sihuaLu`。
    pub key: String,
    /// 知识包。缺省为内嵌包。
    #[serde(default)]
    pub pack: Option<String>,
}

impl App {
    /// 排盘（可选运限）。
    pub async fn chart(&self, req: ChartRequest) -> Result<ChartView, Error> {
        let birth = req.birth.parse()?;
        let horo = horoscope_query(
            req.target_date.as_deref(),
            req.target_time_index,
            req.target_clock.as_deref(),
            birth.time_index,
            false,
        )?;
        tracing::info!(tool = "ziwei_chart", language = %birth.language.as_key(), has_horoscope = horo.is_some(), "chart");
        cast(&birth, horo.as_ref())
    }

    /// 按问题取材。
    pub async fn read(&self, req: ReadRequest) -> Result<Slice, Error> {
        let birth = req.birth.parse()?;
        let extra = req
            .palaces
            .iter()
            .map(|k| parse_palace_key(k))
            .collect::<Result<Vec<_>, _>>()?;
        let required = req.topic.requires_horoscope();
        let horo = horoscope_query(
            req.target_date.as_deref(),
            req.target_time_index,
            req.target_clock.as_deref(),
            birth.time_index,
            required,
        )?;
        let pack_ref = PackRef::parse(req.pack.as_deref())?;
        let pack = self.packs.load(pack_ref).await?;
        let (chart, horo_data) = cast_raw(&birth, horo.as_ref())?;
        tracing::info!(
            tool = "ziwei_read",
            topic = ?req.topic,
            pack_id = %pack.id,
            language = %birth.language.as_key(),
            "read"
        );
        read(
            &chart,
            horo_data.as_ref(),
            pack.as_ref(),
            req.topic,
            &extra,
            birth.language,
        )
    }

    /// 查知识包一条。
    pub async fn lookup(&self, req: LookupRequest) -> Result<LookupEntry, Error> {
        if req.key.trim().is_empty() {
            return Err(Error::invalid_argument("key must not be empty"));
        }
        let pack_ref = PackRef::parse(req.pack.as_deref())?;
        let pack = self.packs.load(pack_ref).await?;
        tracing::info!(tool = "ziwei_lookup", kind = ?req.kind, pack_id = %pack.id, "lookup");
        lookup(pack.as_ref(), req.kind, req.key.trim())
    }
}

fn horoscope_query(
    target_date: Option<&str>,
    time_index: Option<u8>,
    clock: Option<&str>,
    birth_time_index: u8,
    required: bool,
) -> Result<Option<HoroscopeQuery>, Error> {
    match target_date.map(str::trim).filter(|s| !s.is_empty()) {
        None if required => Err(Error::new(
            ErrorCode::MissingHoroscopeDate,
            "topic `year` (or explicit horoscope) requires target_date",
        )),
        None => {
            if time_index.is_some() || clock.is_some() {
                return Err(Error::new(
                    ErrorCode::MissingHoroscopeDate,
                    "target_time_index/target_clock given without target_date",
                ));
            }
            Ok(None)
        }
        Some(date) => {
            let time_index = match (time_index, clock) {
                (None, None) => birth_time_index,
                _ => resolve_time_index(time_index, clock)?,
            };
            Ok(Some(HoroscopeQuery {
                target_date: date.to_string(),
                time_index,
            }))
        }
    }
}
