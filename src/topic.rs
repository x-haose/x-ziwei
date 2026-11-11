//! 封闭 topic → 宫位集合。论法几何（命身 + 主题宫三方四正）写在这里，句子不在这里。

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};
use x_iztro::{Astrolabe, HoroscopeData, Palace, PalaceTarget};

use crate::error::{Error, ErrorCode};

/// 按问题取材的封闭主题。模型读 Skill 来选；本进程不解析自然语言。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Topic {
    /// 只取命宫与身宫。
    #[serde(rename = "self")]
    Self_,
    /// 命身 + 本命全部格局。
    Overall,
    /// 流年命宫三方四正 + 命身。必须另给运限目标日期。
    Year,
    /// 财帛宫及其三方四正 + 命身。
    Wealth,
    /// 官禄宫及其三方四正 + 命身。
    Career,
    /// 夫妻宫及其三方四正 + 命身。
    Spouse,
    /// 疾厄宫及其三方四正 + 命身。
    Health,
    /// 子女宫及其三方四正 + 命身。
    Children,
    /// 父母宫及其三方四正 + 命身。
    Parents,
    /// 兄弟宫及其三方四正 + 命身。
    Siblings,
    /// 交友宫及其三方四正 + 命身。
    Friends,
    /// 田宅宫及其三方四正 + 命身。
    Property,
    /// 迁移宫及其三方四正 + 命身。
    Surface,
    /// 福德宫及其三方四正 + 命身。
    Spirit,
}

impl Topic {
    /// 主题宫。`self` / `overall` / `year` 没有固定主题宫（year 用流年命宫索引）。
    pub fn theme_palace(self) -> Option<Palace> {
        match self {
            Self::Self_ | Self::Overall | Self::Year => None,
            Self::Wealth => Some(Palace::Wealth),
            Self::Career => Some(Palace::Career),
            Self::Spouse => Some(Palace::Spouse),
            Self::Health => Some(Palace::Health),
            Self::Children => Some(Palace::Children),
            Self::Parents => Some(Palace::Parents),
            Self::Siblings => Some(Palace::Siblings),
            Self::Friends => Some(Palace::Friends),
            Self::Property => Some(Palace::Property),
            Self::Surface => Some(Palace::Surface),
            Self::Spirit => Some(Palace::Spirit),
        }
    }

    /// 是否必须带运限目标日期。
    pub fn requires_horoscope(self) -> bool {
        matches!(self, Self::Year)
    }
}

/// 一次取材选中的物理宫（寅宫起 0–11）及其角色。身宫与命宫重合时只保留一条。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SelectedPalaces {
    /// 物理宫索引，升序，去重。
    pub indices: BTreeSet<usize>,
    /// 命宫物理索引。
    pub soul: usize,
    /// 身宫物理索引；与命宫相同时仍记下，输出时不重复。
    pub body: usize,
    /// 主题宫物理索引（`self`/`overall` 为 `None`）。
    pub theme: Option<usize>,
}

impl SelectedPalaces {
    /// 是否包含该物理宫。
    pub fn contains(&self, index: usize) -> bool {
        self.indices.contains(&index)
    }
}

/// 由 topic 与额外宫位算出物理宫集合。`year` 必须有运限，否则写入侧失败。
pub fn select_palaces(
    chart: &Astrolabe,
    horoscope: Option<&HoroscopeData>,
    topic: Topic,
    extra: &[Palace],
) -> Result<SelectedPalaces, Error> {
    let soul = palace_index(chart, Palace::Soul)?;
    let body = body_index(chart)?;
    let mut indices = BTreeSet::new();
    indices.insert(soul);
    indices.insert(body);

    let theme = match topic {
        Topic::Self_ | Topic::Overall => None,
        Topic::Year => {
            let h = horoscope.ok_or_else(|| {
                Error::new(
                    ErrorCode::MissingHoroscopeDate,
                    "topic `year` requires target_date",
                )
            })?;
            let idx = h.yearly.index;
            insert_surround(chart, idx, &mut indices);
            Some(idx)
        }
        other => {
            let palace = other
                .theme_palace()
                .expect("non-self/overall/year topics have a theme palace");
            let idx = palace_index(chart, palace)?;
            insert_surround(chart, idx, &mut indices);
            Some(idx)
        }
    };

    for palace in extra {
        indices.insert(palace_index(chart, *palace)?);
    }

    Ok(SelectedPalaces {
        indices,
        soul,
        body,
        theme,
    })
}

fn insert_surround(chart: &Astrolabe, index: usize, into: &mut BTreeSet<usize>) {
    let Some(sp) = chart.surrounded_palaces(index) else {
        into.insert(index);
        return;
    };
    into.insert(sp.target.index);
    into.insert(sp.opposite.index);
    into.insert(sp.wealth.index);
    into.insert(sp.career.index);
}

fn palace_index(chart: &Astrolabe, palace: Palace) -> Result<usize, Error> {
    chart
        .palace(palace)
        .map(|p| p.index)
        .ok_or_else(|| Error::internal(format!("palace {} missing from chart", palace.as_key())))
}

fn body_index(chart: &Astrolabe) -> Result<usize, Error> {
    chart
        .palace(PalaceTarget::Body)
        .map(|p| p.index)
        .ok_or_else(|| Error::internal("body palace missing from chart"))
}

/// 解析宫位标识；未知键拒绝，不降级。
pub fn parse_palace_key(key: &str) -> Result<Palace, Error> {
    Palace::from_key(key).ok_or_else(|| Error::unknown_key("palace", key))
}

#[cfg(test)]
mod tests {
    use super::*;
    use x_iztro::{Config, Gender, Language, by_solar};

    fn chart() -> Astrolabe {
        by_solar(
            "2000-8-16",
            2,
            Gender::Female,
            true,
            Language::ZhCN,
            Config::default(),
        )
        .expect("example chart")
    }

    #[test]
    fn self_topic_is_soul_and_body_only() {
        let chart = chart();
        let selected = select_palaces(&chart, None, Topic::Self_, &[]).unwrap();
        let mut expected = BTreeSet::new();
        expected.insert(selected.soul);
        expected.insert(selected.body);
        assert_eq!(selected.indices, expected);
        assert!(selected.theme.is_none());
    }

    #[test]
    fn wealth_includes_soul_body_theme_and_surround() {
        let chart = chart();
        let selected = select_palaces(&chart, None, Topic::Wealth, &[]).unwrap();
        let wealth = chart.palace(Palace::Wealth).unwrap();
        let sp = wealth.surrounded_palaces();
        assert!(selected.contains(selected.soul));
        assert!(selected.contains(selected.body));
        assert_eq!(selected.theme, Some(wealth.index));
        assert!(selected.contains(sp.target.index));
        assert!(selected.contains(sp.opposite.index));
        assert!(selected.contains(sp.wealth.index));
        assert!(selected.contains(sp.career.index));
    }

    #[test]
    fn extra_palaces_are_unioned() {
        let chart = chart();
        let selected = select_palaces(&chart, None, Topic::Self_, &[Palace::Children]).unwrap();
        let children = chart.palace(Palace::Children).unwrap().index;
        assert!(selected.contains(children));
    }

    #[test]
    fn year_without_horoscope_fails() {
        let chart = chart();
        let err = select_palaces(&chart, None, Topic::Year, &[]).unwrap_err();
        assert_eq!(err.code, ErrorCode::MissingHoroscopeDate);
    }

    #[test]
    fn unknown_palace_key_is_rejected() {
        let err = parse_palace_key("moneyPalace").unwrap_err();
        assert_eq!(err.code, ErrorCode::UnknownKey);
    }
}
