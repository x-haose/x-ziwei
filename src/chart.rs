//! 排盘与文本投影：只调用 x-iztro，不改写安星，也不决定看哪些宫。

use serde::{Deserialize, Serialize};
use x_iztro::{
    Astrolabe, HoroscopeData, KnowledgePack, Scope, TextDetail, TextOptions,
    astrolabe_to_text_with, by_lunar, by_solar, get_horoscope, horoscope_to_text_with,
    topic_to_text,
};

use crate::birth::{Birth, Calendar, Target};
use crate::error::Error;

/// 事实写到多细。
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, schemars::JsonSchema,
)]
#[serde(rename_all = "snake_case")]
pub enum Detail {
    /// 全部事实：本命含十二宫详解（三方四正、宫干飞化、十二神、小限），运限的大限与流年展开十二宫表。
    #[default]
    Full,
    /// 总览：本命只有基本信息、十二宫总览表与格局；运限各层只写宫名对照、四化、流耀与格局。
    Overview,
}

impl From<Detail> for TextDetail {
    fn from(detail: Detail) -> Self {
        match detail {
            Detail::Full => TextDetail::Full,
            Detail::Overview => TextDetail::Overview,
        }
    }
}

/// 知识包释义附多长。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Depth {
    /// 条目摘要；正文不超过 120 个汉字的条目取正文本身。格局不附成立条件。
    Summary,
    /// 条目正文全文，格局附成立条件。
    Full,
}

/// 文本投影的选项。带释义时 `pack` 必须给出。
#[derive(Clone, Copy)]
pub struct Projection<'a> {
    /// 事实详略。
    pub detail: Detail,
    /// 释义深度；`None` 只输出事实。
    pub depth: Option<Depth>,
    /// 释义与主题定义的来源。
    pub pack: Option<&'a KnowledgePack>,
}

impl<'a> Projection<'a> {
    /// 翻译成内核的文本选项。摘要层要求整包每条长正文都有摘要，缺项时内核报错并列出路径。
    fn options(self) -> Result<TextOptions<'a>, Error> {
        let opts = TextOptions::new().detail(self.detail.into());
        match (self.depth, self.pack) {
            (None, _) => Ok(opts),
            (Some(Depth::Full), Some(pack)) => Ok(opts.knowledge(pack)),
            (Some(Depth::Summary), Some(pack)) => Ok(opts.knowledge_summary(pack)?),
            (Some(_), None) => Err(Error::internal("knowledge depth set without a pack")),
        }
    }
}

/// 排本命盘。
pub fn cast(birth: &Birth) -> Result<Astrolabe, Error> {
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
    Ok(chart)
}

/// 一次运限计算的结果，连同目标精度允许写到的最细一层。
pub struct Horoscope {
    /// 内核算出的各层运限。比 `through` 更细的层取自内核定的代表时刻（农历年取六月初一，
    /// 公历日取早子时），不是调用方给的，文本不写它们。
    data: HoroscopeData,
    /// 文本写到这一层为止。
    through: Scope,
}

/// 按目标精度算运限：农历年到流年，公历日到流日，带时辰到流时。
pub fn cast_horoscope(chart: &Astrolabe, target: &Target) -> Result<Horoscope, Error> {
    Ok(match target {
        Target::Year(year) => Horoscope {
            data: chart.horoscope_of_year(*year)?.into_data(),
            through: Scope::Yearly,
        },
        Target::Day(date) => Horoscope {
            data: get_horoscope(chart, date, None, chart.language)?,
            through: Scope::Daily,
        },
        Target::Hour(date, time_index) => Horoscope {
            data: get_horoscope(chart, date, *time_index, chart.language)?,
            through: Scope::Hourly,
        },
    })
}

/// 本命盘 Markdown。
pub fn natal_text(chart: &Astrolabe, projection: Projection) -> Result<String, Error> {
    Ok(astrolabe_to_text_with(
        chart,
        &projection.options()?,
        chart.language,
    ))
}

/// 运限 Markdown：大限、小限、流年、流月、流日、流时各一节，写到目标精度对应的那一层为止；
/// 宫名按各层自己的命宫起排。
pub fn horoscope_text(
    chart: &Astrolabe,
    horoscope: &Horoscope,
    projection: Projection,
) -> Result<String, Error> {
    let options = projection.options()?.horoscope_through(horoscope.through)?;
    Ok(horoscope_to_text_with(
        chart,
        &horoscope.data,
        &options,
        chart.language,
    ))
}

/// 主题 Markdown：选哪些宫由知识包里该主题的定义决定，本进程不参与。只取本命宫位。
pub fn topic_text(chart: &Astrolabe, topic: &str, projection: Projection) -> Result<String, Error> {
    Ok(topic_to_text(
        chart,
        topic,
        &projection.options()?,
        chart.language,
    )?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::birth::{BirthRequest, LeapKind};
    use crate::error::ErrorCode;
    use x_iztro::Language;

    fn example_birth() -> Birth {
        BirthRequest {
            calendar: Calendar::Solar,
            date: "2000-8-16".into(),
            time_index: Some(2),
            clock: None,
            gender: "female".into(),
            leap: LeapKind::NotLeap,
            fix_leap: true,
            language: "zh-CN".into(),
        }
        .parse()
        .unwrap()
    }

    fn facts(detail: Detail) -> Projection<'static> {
        Projection {
            detail,
            depth: None,
            pack: None,
        }
    }

    #[test]
    fn invalid_date_is_invalid_date() {
        let mut birth = example_birth();
        birth.date = "2000-2-30".into();
        assert_eq!(cast(&birth).unwrap_err().code, ErrorCode::InvalidDate);
    }

    #[test]
    fn overview_is_shorter_and_knowledge_is_longer() {
        let chart = cast(&example_birth()).unwrap();
        let full = natal_text(&chart, facts(Detail::Full)).unwrap();
        let overview = natal_text(&chart, facts(Detail::Overview)).unwrap();
        assert!(overview.len() < full.len());
        let pack = KnowledgePack::builtin(Language::ZhCN).unwrap();
        let with_notes = natal_text(
            &chart,
            Projection {
                detail: Detail::Full,
                depth: Some(Depth::Summary),
                pack: Some(pack),
            },
        )
        .unwrap();
        assert!(with_notes.len() > full.len());
    }

    #[test]
    fn topic_palaces_follow_the_pack_definition() {
        let chart = cast(&example_birth()).unwrap();
        let builtin = KnowledgePack::builtin(Language::ZhCN).unwrap();
        let projection = |pack| Projection {
            detail: Detail::Overview,
            depth: Some(Depth::Summary),
            pack: Some(pack),
        };
        let default_text = topic_text(&chart, "romance", projection(builtin)).unwrap();
        assert!(default_text.contains("## 夫妻 三方四正"));

        let mut custom = builtin.clone();
        let topic = custom.topics.get_mut("romance").unwrap();
        topic.surround = None;
        topic.palaces = Some(vec!["soulPalace".into()]);
        let custom_text = topic_text(&chart, "romance", projection(&custom)).unwrap();
        let headings: Vec<&str> = custom_text
            .lines()
            .filter(|l| l.starts_with("### "))
            .collect();
        assert_eq!(headings.len(), 1, "{headings:?}");
        assert!(headings[0].starts_with("### 命宫 ("), "{headings:?}");
    }

    #[test]
    fn horoscope_text_stops_at_the_target_precision() {
        let chart = cast(&example_birth()).unwrap();
        let sections = [
            "## 大限",
            "## 小限",
            "## 流年",
            "## 流月",
            "## 流日",
            "## 流时",
        ];
        for (target, kept) in [
            (Target::Year(2027), 3),
            (Target::Day("2026-11-11".into()), 5),
            (Target::Hour("2026-11-11".into(), 12), 6),
        ] {
            let horoscope = cast_horoscope(&chart, &target).unwrap();
            let text = horoscope_text(&chart, &horoscope, facts(Detail::Overview)).unwrap();
            for (i, heading) in sections.iter().enumerate() {
                assert_eq!(text.contains(heading), i < kept, "{target:?} {heading}");
            }
        }
    }

    #[test]
    fn year_target_is_the_lunar_year() {
        let chart = cast(&example_birth()).unwrap();
        let text = |target| {
            let horoscope = cast_horoscope(&chart, &target).unwrap();
            horoscope_text(&chart, &horoscope, facts(Detail::Overview)).unwrap()
        };
        assert!(text(Target::Year(2027)).contains("(丁未)"));
        assert!(text(Target::Day("2027-1-1".into())).contains("(丙午)"));
        assert_eq!(
            cast_horoscope(&chart, &Target::Year(10000))
                .err()
                .map(|e| e.code),
            Some(ErrorCode::InvalidArgument)
        );
    }
}
