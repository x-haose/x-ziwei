//! 排盘与运限：只调用 x-iztro，不改写安星。

use serde::{Deserialize, Serialize};
use x_iztro::{
    Astrolabe, HoroscopeData, Language, astrolabe_to_text, by_lunar, by_solar, get_horoscope,
    horoscope_to_text,
};

use crate::birth::{Birth, Calendar};
use crate::error::Error;

/// 本命盘（可选运限）的对外事实。文本是 `to_text` 投影，另附语言无关 key。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct ChartView {
    /// 本命盘语义化文本（Markdown）。默认中文盘。
    pub text: String,
    /// 运限语义化文本；未请求运限时为 `None`。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub horoscope_text: Option<String>,
    /// 命宫标识，如 `soulPalace`。
    pub soul_palace_key: String,
    /// 身宫的宫名标识（身宫落在哪一宫）。
    pub body_palace_key: String,
    /// 本命格局的语言无关标识，按判定顺序。
    pub pattern_keys: Vec<String>,
    /// 文本所用语言码。
    pub language: String,
}

/// 排盘。运限可选；要运限时 `target_date` 必填。
pub fn cast(birth: &Birth, horoscope: Option<&HoroscopeQuery>) -> Result<ChartView, Error> {
    let (chart, horo) = cast_raw(birth, horoscope)?;
    view_of(&chart, horo.as_ref(), birth.language)
}

/// 运限查询：目标公历日期 + 目标时辰。时辰缺省用出生时辰。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HoroscopeQuery {
    /// 目标公历日期 `YYYY-M-D`。
    pub target_date: String,
    /// 目标时辰 0–12。
    pub time_index: u8,
}

/// 排出本命与可选运限，给取材层继续用对象而不是文本。
pub fn cast_raw(
    birth: &Birth,
    horoscope: Option<&HoroscopeQuery>,
) -> Result<(Astrolabe, Option<HoroscopeData>), Error> {
    let chart = match birth.calendar {
        Calendar::Solar => by_solar(
            &birth.date,
            birth.time_index,
            birth.gender,
            birth.fix_leap,
            birth.language,
            birth.config.clone(),
        )?,
        Calendar::Lunar => by_lunar(
            &birth.date,
            birth.time_index,
            birth.gender,
            birth.leap.into(),
            birth.language,
            birth.config.clone(),
        )?,
    };
    let horo = match horoscope {
        Some(q) => Some(get_horoscope(
            &chart,
            &q.target_date,
            q.time_index,
            birth.language,
        )?),
        None => None,
    };
    Ok((chart, horo))
}

fn view_of(
    chart: &Astrolabe,
    horo: Option<&HoroscopeData>,
    language: Language,
) -> Result<ChartView, Error> {
    let soul_palace_key = chart
        .palace(x_iztro::Palace::Soul)
        .map(|p| p.name.as_key().to_string())
        .ok_or_else(|| Error::internal("soul palace missing from chart"))?;
    let body_palace_key = chart
        .palace(x_iztro::PalaceTarget::Body)
        .map(|p| p.name.as_key().to_string())
        .ok_or_else(|| Error::internal("body palace missing from chart"))?;
    let pattern_keys = chart
        .patterns()
        .into_iter()
        .map(|hit| hit.key.as_key().to_string())
        .collect();
    Ok(ChartView {
        text: astrolabe_to_text(chart, language),
        horoscope_text: horo.map(|h| horoscope_to_text(chart, h, language)),
        soul_palace_key,
        body_palace_key,
        pattern_keys,
        language: language.as_key().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::birth::{BirthRequest, Calendar};

    fn example_birth() -> Birth {
        BirthRequest {
            calendar: Calendar::Solar,
            date: "2000-8-16".into(),
            time_index: Some(2),
            clock: None,
            gender: "female".into(),
            leap: crate::birth::LeapKind::NotLeap,
            fix_leap: true,
            language: "zh-CN".into(),
        }
        .parse()
        .unwrap()
    }

    #[test]
    fn natal_chart_has_text_and_keys() {
        let view = cast(&example_birth(), None).unwrap();
        assert!(view.text.contains("命宫") || view.text.contains("soul"));
        assert_eq!(view.soul_palace_key, "soulPalace");
        assert!(view.horoscope_text.is_none());
        assert_eq!(view.language, "zh-CN");
    }

    #[test]
    fn missing_palace_fails_instead_of_returning_a_default_key() {
        let birth = example_birth();
        let (mut chart, _) = cast_raw(&birth, None).unwrap();
        for palace in &mut chart.palaces {
            palace.is_body_palace = false;
        }
        assert_eq!(
            view_of(&chart, None, birth.language).unwrap_err().code,
            crate::error::ErrorCode::Internal
        );
        for palace in &mut chart.palaces {
            if palace.name == x_iztro::Palace::Soul {
                palace.name = x_iztro::Palace::Parents;
            }
        }
        assert_eq!(
            view_of(&chart, None, birth.language).unwrap_err().code,
            crate::error::ErrorCode::Internal
        );
    }

    #[test]
    fn invalid_date_is_invalid_date() {
        let mut birth = example_birth();
        birth.date = "not-a-date".into();
        let err = cast(&birth, None).unwrap_err();
        assert_eq!(err.code, crate::error::ErrorCode::InvalidDate);
    }

    #[test]
    fn horoscope_attaches_when_requested() {
        let q = HoroscopeQuery {
            target_date: "2025-1-1".into(),
            time_index: 2,
        };
        let view = cast(&example_birth(), Some(&q)).unwrap();
        assert!(view.horoscope_text.is_some());
    }
}
