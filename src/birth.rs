//! 生辰与运限目标入参：历法、日期、时辰、性别；运限目标另可只给农历年。时辰同时收序号与钟点，晚子必须是 12。

use serde::{Deserialize, Serialize};
use x_iztro::{Config, Gender, Language, LeapMonth};

use crate::error::{Error, ErrorCode};

/// 历法。默认公历。
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, schemars::JsonSchema,
)]
#[serde(rename_all = "snake_case")]
pub enum Calendar {
    /// 公历（格里历）。
    #[default]
    Solar,
    /// 农历；闰月由 [`LeapKind`] 单独表达，不用两个相邻布尔。
    Lunar,
}

/// 农历闰月处理。非闰月输入必须是 [`LeapKind::NotLeap`]。
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, schemars::JsonSchema,
)]
#[serde(rename_all = "snake_case")]
pub enum LeapKind {
    /// 该月不是闰月。
    #[default]
    NotLeap,
    /// 该月是闰月，按闰月本身排盘。
    Leap,
    /// 该月是闰月，且十五之后视作次月（iztro `fixLeap`）。
    LeapFixed,
}

impl From<LeapKind> for LeapMonth {
    fn from(kind: LeapKind) -> Self {
        match kind {
            LeapKind::NotLeap => LeapMonth::NotLeap,
            LeapKind::Leap => LeapMonth::Leap,
            LeapKind::LeapFixed => LeapMonth::LeapFixed,
        }
    }
}

/// 已校验的排盘入参。构造之后字段全部合法，排盘入口不再做二次猜测。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Birth {
    /// 历法。
    pub calendar: Calendar,
    /// 日期串，格式 `YYYY-M-D` 或 `YYYY-MM-DD`；内核按历法解释。
    pub date: String,
    /// 时辰序号，闭区间 0–12；0 早子，12 晚子。
    pub time_index: u8,
    /// 性别。
    pub gender: Gender,
    /// 农历闰月处理；公历排盘忽略此字段。
    pub leap: LeapKind,
    /// 公历排盘的 `fix_leap`；默认 `true`，与 iztro 默认一致。
    pub fix_leap: bool,
    /// 文本投影语言。默认 `zh-CN`。知识包目前只有 zh-CN，与语言独立。
    pub language: Language,
    /// 排盘配置；默认与 iztro 一致。
    pub config: Config,
}

/// 工具 / HTTP 共用的生辰字段。未知字段拒绝，拼错的闰月或时辰键不会被忽略；其余校验在 [`BirthRequest::parse`]。
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct BirthRequest {
    /// 历法。`solar` 公历，`lunar` 农历。默认 `solar`。
    #[serde(default)]
    pub calendar: Calendar,
    /// 出生日期，格式 `YYYY-M-D` 或 `YYYY-MM-DD`，不含钟点。公历范围 1–9999。
    pub date: String,
    /// 时辰序号 0–12。0 早子（00:00–00:59），1 丑（01:00–02:59），2 寅（03:00–04:59），3 卯（05:00–06:59），4 辰（07:00–08:59），5 巳（09:00–10:59），6 午（11:00–12:59），7 未（13:00–14:59），8 申（15:00–16:59），9 酉（17:00–18:59），10 戌（19:00–20:59），11 亥（21:00–22:59），12 晚子（23:00–23:59）。与 `clock` 至少填一个；两个都填时必须指向同一时辰。
    #[serde(default)]
    #[schemars(range(min = 0, max = 12))]
    pub time_index: Option<u8>,
    /// 出生钟点 `HH:MM`（24 小时制，也接受 `H:MM`）。23:00–23:59 为晚子（12），00:00–00:59 为早子（0）。不要把 23 点写成 0。
    #[serde(default)]
    pub clock: Option<String>,
    /// 性别。`male` / `female`，也接受 `男` / `女`。
    pub gender: String,
    /// 农历闰月：`not_leap` / `leap` / `leap_fixed`，默认 `not_leap`。`calendar=solar` 时只能省略或 `not_leap`。
    #[serde(default)]
    pub leap: LeapKind,
    /// 公历排盘是否按 iztro `fixLeap` 处理农历换算。默认 `true`。
    #[serde(default = "default_true")]
    pub fix_leap: bool,
    /// 文本语言码：`zh-CN` `zh-TW` `en-US` `ja-JP` `ko-KR` `vi-VN`。默认 `zh-CN`。给模型读盘请用中文盘。
    #[serde(default = "default_language")]
    pub language: String,
}

fn default_true() -> bool {
    true
}

fn default_language() -> String {
    "zh-CN".to_string()
}

/// 运限目标，按人怎么问分四种：某一年、某个月、某一天、某个时辰。问到哪一层就算到哪一层，
/// 不继承出生时辰，也不读取当前时间。
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct TargetRequest {
    /// 目标农历年，用公历年份数字表示：2027 指 2027 年正月初一起的那个农历年（丁未年）。问某一年的运势只填它，
    /// 返回大限、小限、流年和全年各流月一览；不要改填该年 1 月 1 日，春节前的日子仍属上一个农历年。
    /// 与 `date` 二选一。
    #[serde(default)]
    #[schemars(range(min = 1, max = 9999))]
    pub year: Option<i64>,
    /// 目标农历月 1–12（正月为 1），只能跟着 `year`。问某个月的运势时填，返回到流月一层。
    /// 用户说的是公历月份时，先用只给 `year` 的结果里各流月的阳历起止日对应到农历月。闰月不单独成月：
    /// 前半月的流月同本月，后半月同下月。
    #[serde(default)]
    #[schemars(range(min = 1, max = 12))]
    pub month: Option<u32>,
    /// 目标公历日期 `YYYY-M-D`，不含钟点。只在问到具体某一天时填，返回到流日一层。与 `year` 二选一。
    #[serde(default)]
    pub date: Option<String>,
    /// 目标时辰序号 0–12，取值同出生时辰。只在问到具体时辰时与 `date` 一起给，返回到流时一层；
    /// 与 `clock` 都填时必须指向同一时辰。
    #[serde(default)]
    #[schemars(range(min = 0, max = 12))]
    pub time_index: Option<u8>,
    /// 目标钟点 `HH:MM`。只在问到具体时辰时与 `date` 一起给。23:00–23:59 为晚子（12）。
    #[serde(default)]
    pub clock: Option<String>,
}

/// 已校验的运限目标。精度决定算到哪一层。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Target {
    /// 农历年：大限、小限、流年，另附全年流月一览。
    Year(i64),
    /// 农历年与月（1–12）：到流月。
    Month(i64, u32),
    /// 公历日 `YYYY-M-D`（存在性由内核校验）：到流日。
    Day(String),
    /// 公历日与时辰（闭区间 0–12）：到流时。
    Hour(String, u8),
}

impl TargetRequest {
    /// 校验并收成 [`Target`]。`year` 与 `date` 必须恰好给一个；`month` 只能跟着 `year`，时辰只能跟着 `date`。
    pub fn parse(&self) -> Result<Target, Error> {
        let has_time = self.time_index.is_some() || self.clock.is_some();
        match (self.year, self.date.as_deref()) {
            (Some(_), Some(_)) => Err(Error::invalid_argument(
                "target takes either year or date, not both",
            )),
            (None, None) => Err(Error::invalid_argument(
                "target needs year (a lunar year, e.g. 2027) or date (YYYY-M-D)",
            )),
            (Some(_), None) if has_time => Err(Error::invalid_argument(
                "target.year cannot carry time_index or clock; give target.date for the hourly layer",
            )),
            (Some(year), None) => Ok(match self.month {
                Some(month) => Target::Month(year, month),
                None => Target::Year(year),
            }),
            (None, Some(_)) if self.month.is_some() => Err(Error::invalid_argument(
                "target.month is a lunar month and goes with target.year, not target.date",
            )),
            (None, Some(date)) => {
                let date = plain_date(date, "target.date")?;
                if has_time {
                    let time_index = resolve_time_index(self.time_index, self.clock.as_deref())?;
                    Ok(Target::Hour(date, time_index))
                } else {
                    Ok(Target::Day(date))
                }
            }
        }
    }
}

/// 日期串只含年月日。内核的日期文法允许尾随 ` HH:mm`：出生日期里它不参与计算，运限里它会改变时辰，
/// 两处都与单独传入的时辰重复，故在入口拒绝。
fn plain_date(raw: &str, field: &str) -> Result<String, Error> {
    if raw.is_empty() || raw.chars().any(char::is_whitespace) {
        return Err(Error::new(
            ErrorCode::InvalidDate,
            format!("{field} must be YYYY-M-D without a clock or whitespace"),
        ));
    }
    Ok(raw.to_string())
}

impl BirthRequest {
    /// 校验并翻译成本进程的 [`Birth`]。失败不落盘、不排盘。
    pub fn parse(&self) -> Result<Birth, Error> {
        let time_index = resolve_time_index(self.time_index, self.clock.as_deref())?;
        let gender = parse_gender(&self.gender)?;
        let language = Language::from_code(&self.language).ok_or_else(|| {
            Error::invalid_argument(format!(
                "unknown language `{}`; expected zh-CN, zh-TW, en-US, ja-JP, ko-KR, vi-VN",
                self.language
            ))
        })?;
        if self.calendar == Calendar::Solar && self.leap != LeapKind::NotLeap {
            return Err(Error::invalid_argument(
                "leap applies only to lunar birth dates",
            ));
        }
        Ok(Birth {
            calendar: self.calendar,
            date: plain_date(&self.date, "birth.date")?,
            time_index,
            gender,
            leap: self.leap,
            fix_leap: self.fix_leap,
            language,
            config: Config::default(),
        })
    }
}

/// 把可选的序号与钟点收成唯一的 0–12。两个都缺、两个都给但不一致，都是写入侧错误。
pub fn resolve_time_index(index: Option<u8>, clock: Option<&str>) -> Result<u8, Error> {
    match (index, clock) {
        (None, None) => Err(Error::invalid_argument(
            "provide time_index (0-12) or clock (HH:MM); 23:00-23:59 is late Zi (12), not 0",
        )),
        (Some(i), None) => validate_time_index(i),
        (None, Some(clock)) => clock_to_time_index(clock),
        (Some(i), Some(clock)) => {
            let from_clock = clock_to_time_index(clock)?;
            let from_index = validate_time_index(i)?;
            if from_clock != from_index {
                return Err(Error::new(
                    ErrorCode::TimeMismatch,
                    format!(
                        "time_index {from_index} and clock `{clock}` (index {from_clock}) disagree"
                    ),
                ));
            }
            Ok(from_index)
        }
    }
}

/// 序号必须落在闭区间 0–12。
pub fn validate_time_index(index: u8) -> Result<u8, Error> {
    if index > 12 {
        return Err(Error::new(
            ErrorCode::InvalidTimeIndex,
            format!("time_index must be 0-12, got {index}"),
        ));
    }
    Ok(index)
}

/// `HH:MM` / `H:MM` → 时辰序号。23 点是晚子 12，不是早子 0。
pub fn clock_to_time_index(clock: &str) -> Result<u8, Error> {
    let hour = parse_clock(clock)?;
    let index = match hour {
        0 => 0,
        1 | 2 => 1,
        3 | 4 => 2,
        5 | 6 => 3,
        7 | 8 => 4,
        9 | 10 => 5,
        11 | 12 => 6,
        13 | 14 => 7,
        15 | 16 => 8,
        17 | 18 => 9,
        19 | 20 => 10,
        21 | 22 => 11,
        23 => 12,
        _ => {
            return Err(Error::new(
                ErrorCode::InvalidClock,
                format!("clock hour must be 0-23, got {hour}"),
            ));
        }
    };
    Ok(index)
}

/// 解析 `HH:MM` 并返回小时；分钟只校验范围，时辰由小时决定。
fn parse_clock(clock: &str) -> Result<u8, Error> {
    let clock = clock.trim();
    let Some((h, m)) = clock.split_once(':') else {
        return Err(Error::new(
            ErrorCode::InvalidClock,
            format!("clock must be HH:MM, got `{clock}`"),
        ));
    };
    if h.is_empty() || m.is_empty() || m.len() != 2 {
        return Err(Error::new(
            ErrorCode::InvalidClock,
            format!("clock must be HH:MM, got `{clock}`"),
        ));
    }
    let hour: u8 = h.parse().map_err(|_| {
        Error::new(
            ErrorCode::InvalidClock,
            format!("clock must be HH:MM, got `{clock}`"),
        )
    })?;
    let minute: u8 = m.parse().map_err(|_| {
        Error::new(
            ErrorCode::InvalidClock,
            format!("clock must be HH:MM, got `{clock}`"),
        )
    })?;
    if hour > 23 || minute > 59 {
        return Err(Error::new(
            ErrorCode::InvalidClock,
            format!("clock `{clock}` is out of 00:00-23:59"),
        ));
    }
    Ok(hour)
}

fn parse_gender(raw: &str) -> Result<Gender, Error> {
    match raw.trim() {
        "male" | "Male" | "男" => Ok(Gender::Male),
        "female" | "Female" | "女" => Ok(Gender::Female),
        other => Err(Error::invalid_argument(format!(
            "gender must be male/female (or 男/女), got `{other}`"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn late_zi_clock_is_twelve() {
        assert_eq!(clock_to_time_index("23:00").unwrap(), 12);
        assert_eq!(clock_to_time_index("23:59").unwrap(), 12);
        assert_eq!(clock_to_time_index("00:00").unwrap(), 0);
        assert_eq!(clock_to_time_index("00:59").unwrap(), 0);
        assert_eq!(clock_to_time_index("01:00").unwrap(), 1);
        assert_eq!(clock_to_time_index("3:30").unwrap(), 2);
    }

    #[test]
    fn rejects_invalid_clock() {
        assert_eq!(
            clock_to_time_index("24:00").unwrap_err().code,
            ErrorCode::InvalidClock
        );
        assert_eq!(
            clock_to_time_index("12:60").unwrap_err().code,
            ErrorCode::InvalidClock
        );
        assert_eq!(
            clock_to_time_index("noon").unwrap_err().code,
            ErrorCode::InvalidClock
        );
    }

    #[test]
    fn index_and_clock_must_agree() {
        let err = resolve_time_index(Some(0), Some("23:30")).unwrap_err();
        assert_eq!(err.code, ErrorCode::TimeMismatch);
        assert_eq!(resolve_time_index(Some(12), Some("23:30")).unwrap(), 12);
    }

    #[test]
    fn missing_time_is_input_error() {
        let err = resolve_time_index(None, None).unwrap_err();
        assert_eq!(err.code, ErrorCode::InvalidArgument);
    }

    #[test]
    fn rejects_time_index_above_twelve() {
        assert_eq!(
            validate_time_index(13).unwrap_err().code,
            ErrorCode::InvalidTimeIndex
        );
    }

    #[test]
    fn parses_gender_aliases() {
        let req = BirthRequest {
            calendar: Calendar::Solar,
            date: "2000-8-16".into(),
            time_index: Some(2),
            clock: None,
            gender: "女".into(),
            leap: LeapKind::NotLeap,
            fix_leap: true,
            language: "zh-CN".into(),
        };
        let birth = req.parse().unwrap();
        assert_eq!(birth.gender, Gender::Female);
        assert_eq!(birth.time_index, 2);
    }

    #[test]
    fn rejects_clock_in_date_and_leap_on_solar() {
        let base = BirthRequest {
            calendar: Calendar::Solar,
            date: "2000-8-16".into(),
            time_index: Some(2),
            clock: None,
            gender: "female".into(),
            leap: LeapKind::NotLeap,
            fix_leap: true,
            language: "zh-CN".into(),
        };
        let with_clock = BirthRequest {
            date: "2000-8-16 23:15".into(),
            ..base.clone()
        };
        assert_eq!(with_clock.parse().unwrap_err().code, ErrorCode::InvalidDate);
        let solar_leap = BirthRequest {
            leap: LeapKind::Leap,
            ..base
        };
        assert_eq!(
            solar_leap.parse().unwrap_err().code,
            ErrorCode::InvalidArgument
        );
    }

    #[test]
    fn target_precision_follows_the_fields_given() {
        let target = |year, month, date: Option<&str>, clock: Option<&str>| TargetRequest {
            year,
            month,
            date: date.map(Into::into),
            time_index: None,
            clock: clock.map(Into::into),
        };
        assert_eq!(
            target(Some(2027), None, None, None).parse().unwrap(),
            Target::Year(2027)
        );
        assert_eq!(
            target(Some(2027), Some(3), None, None).parse().unwrap(),
            Target::Month(2027, 3)
        );
        assert_eq!(
            target(None, None, Some("2026-11-11"), None)
                .parse()
                .unwrap(),
            Target::Day("2026-11-11".into())
        );
        assert_eq!(
            target(None, None, Some("2026-11-11"), Some("23:10"))
                .parse()
                .unwrap(),
            Target::Hour("2026-11-11".into(), 12)
        );
        for bad in [
            target(None, None, None, None),
            target(None, Some(3), None, None),
            target(None, None, None, Some("12:00")),
            target(Some(2027), None, Some("2027-3-1"), None),
            target(Some(2027), None, None, Some("12:00")),
            target(None, Some(3), Some("2027-3-1"), None),
        ] {
            assert_eq!(bad.parse().unwrap_err().code, ErrorCode::InvalidArgument);
        }
    }
}
