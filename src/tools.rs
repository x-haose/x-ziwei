//! `chart` and `to_text` against the frozen input shapes.
//!
//! Custom mutagen / brightness tables and `patternConfig` are rejected here.
//! They are not part of the phase-1 six-switch config.

use serde_json::{Map, Value};
use x_iztro::{
    astrolabe_to_text, astrolabe_to_text_with, by_lunar, by_solar, horoscope_to_text,
    horoscope_to_text_with, AgeDivide, Algorithm, AstroType, Config, DayDivide, Gender,
    HoroscopeDivide, KnowledgePack, Language, LeapMonth, TextOptions, YearDivide,
};

use crate::error::ApiError;

const CHART_FIELDS: &[&str] = &[
    "calendar",
    "date",
    "timeIndex",
    "gender",
    "language",
    "fixLeap",
    "leap",
    "config",
    "targetDate",
    "targetTimeIndex",
];

const TEXT_FIELDS: &[&str] = &[
    "calendar",
    "date",
    "timeIndex",
    "gender",
    "language",
    "fixLeap",
    "leap",
    "config",
    "includeHoroscope",
    "targetDate",
    "targetTimeIndex",
    "knowledge",
];

#[derive(Clone, Copy)]
enum Calendar {
    Solar,
    Lunar,
}

struct Birth {
    calendar: Calendar,
    date: String,
    time_index: u8,
    gender: Gender,
    language: Language,
    fix_leap: bool,
    leap: Option<LeapMonth>,
    config: Config,
}

struct ChartQuery {
    birth: Birth,
    target_date: Option<String>,
    target_time_index: Option<u8>,
}

struct TextQuery {
    birth: Birth,
    include_horoscope: bool,
    target_date: Option<String>,
    target_time_index: Option<u8>,
    knowledge: bool,
}

/// Natal DTO, plus horoscope DTO when both target fields are set.
pub fn chart(args: &Value) -> Result<Value, ApiError> {
    let query = parse_chart(args)?;
    let astrolabe = cast(&query.birth)?;
    let mut out = Map::new();
    out.insert(
        "astrolabe".to_string(),
        serde_json::to_value(astrolabe.to_dto())
            .map_err(|_| ApiError::internal("internal error"))?,
    );
    if let (Some(date), Some(index)) = (&query.target_date, query.target_time_index) {
        let horoscope = astrolabe
            .horoscope(date, index)
            .map_err(ApiError::from_iztro)?;
        out.insert(
            "horoscope".to_string(),
            serde_json::to_value(horoscope.to_dto(astrolabe.language))
                .map_err(|_| ApiError::internal("internal error"))?,
        );
    }
    Ok(Value::Object(out))
}

/// Markdown from `astrolabe_to_text` / `horoscope_to_text`.
///
/// `knowledge: true` attaches the builtin pack through `TextOptions::knowledge`.
/// The only builtin pack is zh-CN; it is still attached for other chart languages.
pub fn to_text(args: &Value) -> Result<String, ApiError> {
    let query = parse_text(args)?;
    let astrolabe = cast(&query.birth)?;
    let natal = project_natal(&astrolabe, query.knowledge)?;
    if !query.include_horoscope {
        return Ok(natal);
    }
    let (Some(date), Some(index)) = (query.target_date.as_deref(), query.target_time_index) else {
        return Err(ApiError::invalid_argument(
            "targetDate and targetTimeIndex are required when includeHoroscope is true",
        ));
    };
    let horoscope = astrolabe
        .horoscope(date, index)
        .map_err(ApiError::from_iztro)?;
    let flowing = project_horoscope(&astrolabe, horoscope.data(), query.knowledge)?;
    Ok(join_markdown(&natal, &flowing))
}

fn project_natal(astrolabe: &x_iztro::Astrolabe, knowledge: bool) -> Result<String, ApiError> {
    if !knowledge {
        return Ok(astrolabe_to_text(astrolabe, astrolabe.language));
    }
    let pack = builtin_pack()?;
    let opts = TextOptions::new().knowledge(pack);
    Ok(astrolabe_to_text_with(astrolabe, &opts, astrolabe.language))
}

fn project_horoscope(
    astrolabe: &x_iztro::Astrolabe,
    horoscope: &x_iztro::HoroscopeData,
    knowledge: bool,
) -> Result<String, ApiError> {
    if !knowledge {
        return Ok(horoscope_to_text(astrolabe, horoscope, astrolabe.language));
    }
    let pack = builtin_pack()?;
    let opts = TextOptions::new().knowledge(pack);
    Ok(horoscope_to_text_with(
        astrolabe,
        horoscope,
        &opts,
        astrolabe.language,
    ))
}

fn builtin_pack() -> Result<&'static KnowledgePack, ApiError> {
    KnowledgePack::builtin(Language::ZhCN).ok_or_else(|| ApiError::internal("internal error"))
}

fn join_markdown(natal: &str, horoscope: &str) -> String {
    let mut out = String::with_capacity(natal.len() + horoscope.len() + 2);
    out.push_str(natal.trim_end_matches(['\n', '\r']));
    out.push_str("\n\n");
    out.push_str(horoscope.trim_start_matches(['\n', '\r']));
    out
}

fn cast(birth: &Birth) -> Result<x_iztro::Astrolabe, ApiError> {
    match birth.calendar {
        Calendar::Solar => {
            if birth.leap.is_some() {
                return Err(ApiError::invalid_argument(
                    "leap is only valid when calendar is lunar",
                ));
            }
            by_solar(
                &birth.date,
                birth.time_index,
                birth.gender,
                birth.fix_leap,
                birth.language,
                birth.config.clone(),
            )
            .map_err(ApiError::from_iztro)
        }
        Calendar::Lunar => {
            let leap = birth.leap.ok_or_else(|| {
                ApiError::invalid_argument("leap is required when calendar is lunar")
            })?;
            by_lunar(
                &birth.date,
                birth.time_index,
                birth.gender,
                leap,
                birth.language,
                birth.config.clone(),
            )
            .map_err(ApiError::from_iztro)
        }
    }
}

fn parse_chart(args: &Value) -> Result<ChartQuery, ApiError> {
    let obj = object(args, "arguments")?;
    reject_unknown(obj, CHART_FIELDS)?;
    let birth = parse_birth(obj)?;
    let target_date = opt_string(obj, "targetDate")?;
    let target_time_index = match obj.get("targetTimeIndex") {
        None | Some(Value::Null) => None,
        Some(value) => Some(time_index(value, "targetTimeIndex")?),
    };
    match (&target_date, target_time_index) {
        (None, None) | (Some(_), Some(_)) => {}
        (Some(_), None) => {
            return Err(ApiError::invalid_argument(
                "targetTimeIndex is required with targetDate",
            ));
        }
        (None, Some(_)) => {
            return Err(ApiError::invalid_argument(
                "targetDate is required with targetTimeIndex",
            ));
        }
    }
    Ok(ChartQuery {
        birth,
        target_date,
        target_time_index,
    })
}

fn parse_text(args: &Value) -> Result<TextQuery, ApiError> {
    let obj = object(args, "arguments")?;
    reject_unknown(obj, TEXT_FIELDS)?;
    let birth = parse_birth(obj)?;
    let include_horoscope = bool_field(obj, "includeHoroscope", false)?;
    let knowledge = bool_field(obj, "knowledge", true)?;
    let target_date = opt_string(obj, "targetDate")?;
    let target_time_index = match obj.get("targetTimeIndex") {
        None | Some(Value::Null) => None,
        Some(value) => Some(time_index(value, "targetTimeIndex")?),
    };
    if include_horoscope && (target_date.is_none() || target_time_index.is_none()) {
        return Err(ApiError::invalid_argument(
            "targetDate and targetTimeIndex are required when includeHoroscope is true",
        ));
    }
    Ok(TextQuery {
        birth,
        include_horoscope,
        target_date,
        target_time_index,
        knowledge,
    })
}

fn parse_birth(obj: &Map<String, Value>) -> Result<Birth, ApiError> {
    let calendar = match req_string(obj, "calendar")?.as_str() {
        "solar" => Calendar::Solar,
        "lunar" => Calendar::Lunar,
        other => {
            return Err(ApiError::invalid_argument(format!(
                "invalid calendar '{other}'"
            )));
        }
    };
    let date = req_string(obj, "date")?;
    let time_index = match obj.get("timeIndex") {
        None | Some(Value::Null) => {
            return Err(ApiError::invalid_argument("timeIndex is required"));
        }
        Some(value) => time_index(value, "timeIndex")?,
    };
    let gender = match req_string(obj, "gender")?.as_str() {
        "male" => Gender::Male,
        "female" => Gender::Female,
        other => {
            return Err(ApiError::invalid_argument(format!(
                "invalid gender '{other}'"
            )));
        }
    };
    let language = parse_language(obj)?;
    let fix_leap = bool_field(obj, "fixLeap", true)?;
    let leap = match obj.get("leap") {
        None | Some(Value::Null) => None,
        Some(Value::String(value)) => Some(
            LeapMonth::from_key(value)
                .ok_or_else(|| ApiError::invalid_argument(format!("invalid leap '{value}'")))?,
        ),
        Some(_) => return Err(ApiError::invalid_argument("leap must be a string")),
    };
    let config = parse_config(obj.get("config"))?;
    Ok(Birth {
        calendar,
        date,
        time_index,
        gender,
        language,
        fix_leap,
        leap,
        config,
    })
}

fn parse_language(obj: &Map<String, Value>) -> Result<Language, ApiError> {
    match obj.get("language") {
        None | Some(Value::Null) => Ok(Language::ZhCN),
        Some(Value::String(value)) => match value.as_str() {
            "zh-CN" => Ok(Language::ZhCN),
            "zh-TW" => Ok(Language::ZhTW),
            "en-US" => Ok(Language::EnUS),
            "ja-JP" => Ok(Language::JaJP),
            "ko-KR" => Ok(Language::KoKR),
            "vi-VN" => Ok(Language::ViVN),
            other => Err(ApiError::invalid_argument(format!(
                "invalid language '{other}'"
            ))),
        },
        Some(_) => Err(ApiError::invalid_argument("language must be a string")),
    }
}

fn parse_config(value: Option<&Value>) -> Result<Config, ApiError> {
    let Some(value) = value else {
        return Ok(Config::default());
    };
    if value.is_null() {
        return Ok(Config::default());
    }
    let obj = object(value, "config")?;
    reject_unknown(
        obj,
        &[
            "yearDivide",
            "horoscopeDivide",
            "ageDivide",
            "dayDivide",
            "algorithm",
            "astroType",
        ],
    )?;
    let mut config = Config::default();
    apply_switch(
        obj,
        "yearDivide",
        "'normal' or 'exact'",
        YearDivide::from_key,
        &mut config.year_divide,
    )?;
    apply_switch(
        obj,
        "horoscopeDivide",
        "'normal' or 'exact'",
        HoroscopeDivide::from_key,
        &mut config.horoscope_divide,
    )?;
    apply_switch(
        obj,
        "ageDivide",
        "'normal' or 'birthday'",
        AgeDivide::from_key,
        &mut config.age_divide,
    )?;
    apply_switch(
        obj,
        "dayDivide",
        "'forward' or 'current'",
        DayDivide::from_key,
        &mut config.day_divide,
    )?;
    apply_switch(
        obj,
        "algorithm",
        "'default' or 'zhongzhou'",
        Algorithm::from_key,
        &mut config.algorithm,
    )?;
    apply_switch(
        obj,
        "astroType",
        "'heaven', 'earth' or 'human'",
        AstroType::from_key,
        &mut config.astro_type,
    )?;
    Ok(config)
}

fn apply_switch<T>(
    obj: &Map<String, Value>,
    field: &str,
    expected: &str,
    parse: impl Fn(&str) -> Option<T>,
    slot: &mut T,
) -> Result<(), ApiError> {
    let Some(value) = obj.get(field) else {
        return Ok(());
    };
    if value.is_null() {
        return Ok(());
    }
    let text = value
        .as_str()
        .ok_or_else(|| ApiError::invalid_argument(format!("{field} must be a string")))?;
    *slot = parse(text).ok_or_else(|| {
        ApiError::invalid_argument(format!("invalid {field} '{text}': expected {expected}"))
    })?;
    Ok(())
}

fn object<'a>(value: &'a Value, what: &str) -> Result<&'a Map<String, Value>, ApiError> {
    value
        .as_object()
        .ok_or_else(|| ApiError::invalid_argument(format!("{what} must be an object")))
}

fn reject_unknown(obj: &Map<String, Value>, allowed: &[&str]) -> Result<(), ApiError> {
    for key in obj.keys() {
        if !allowed.contains(&key.as_str()) {
            return Err(ApiError::invalid_argument(format!("unknown field '{key}'")));
        }
    }
    Ok(())
}

fn req_string(obj: &Map<String, Value>, key: &str) -> Result<String, ApiError> {
    match obj.get(key) {
        None | Some(Value::Null) => Err(ApiError::invalid_argument(format!("{key} is required"))),
        Some(Value::String(value)) => Ok(value.clone()),
        Some(_) => Err(ApiError::invalid_argument(format!(
            "{key} must be a string"
        ))),
    }
}

fn opt_string(obj: &Map<String, Value>, key: &str) -> Result<Option<String>, ApiError> {
    match obj.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(value)) => Ok(Some(value.clone())),
        Some(_) => Err(ApiError::invalid_argument(format!(
            "{key} must be a string"
        ))),
    }
}

fn bool_field(obj: &Map<String, Value>, key: &str, default: bool) -> Result<bool, ApiError> {
    match obj.get(key) {
        None | Some(Value::Null) => Ok(default),
        Some(Value::Bool(value)) => Ok(*value),
        Some(_) => Err(ApiError::invalid_argument(format!(
            "{key} must be a boolean"
        ))),
    }
}

fn time_index(value: &Value, field: &str) -> Result<u8, ApiError> {
    let Some(number) = value.as_i64() else {
        return Err(ApiError::invalid_argument(format!(
            "{field} must be an integer"
        )));
    };
    if !(0..=12).contains(&number) {
        return Err(ApiError::invalid_time_index(format!(
            "time_index must be 0-12, got {number}"
        )));
    }
    Ok(number as u8)
}
