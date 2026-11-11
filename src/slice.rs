//! 按问题取材：盘面切片事实 + 包里对得上的原文 + 缺口。不含论断句子。

use serde::{Deserialize, Serialize};
use x_iztro::{
    Astrolabe, HoroscopeData, KnowledgePack, Language, Mutagen, Palace, PatternConfig, PatternHit,
    PatternKey, Scope, StarKey, palace_to_text, patterns_at, patterns_to_text,
};

use crate::error::Error;
use crate::topic::{SelectedPalaces, Topic, select_palaces};

/// 一条断语的出处：包标识与版本，便于核对。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct QuoteSource {
    /// 知识包 `id`。
    pub pack_id: String,
    /// 知识包 `version`。
    pub pack_version: String,
}

/// 条目种类。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum EntryKind {
    /// 星耀。
    Star,
    /// 术语。
    Concept,
    /// 双星组合（同宫主星）。
    Combination,
    /// 格局。
    Pattern,
    /// 宫位。
    Palace,
    /// 四化。
    Mutagen,
}

/// 包里对得上的原文。模型写断语只能抄这里。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Quote {
    /// 条目种类。
    pub kind: EntryKind,
    /// 语言无关标识。组合为 `starKey+otherStarKey`。
    pub key: String,
    /// 原文（Markdown）。
    pub text: String,
    /// 出自哪一份包。
    pub source: QuoteSource,
}

/// 盘上有、包里没有释义的标识。模型必须看见缺口，不许脑补。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Missing {
    /// 条目种类。
    pub kind: EntryKind,
    /// 语言无关标识。
    pub key: String,
}

/// 一个被选中宫位的事实文本。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct PalaceFact {
    /// 宫名标识，如 `wealthPalace`。
    pub key: String,
    /// 物理宫索引（0–11，寅宫为 0）。
    pub index: usize,
    /// 在本次取材中的角色。
    pub role: PalaceRole,
    /// 单宫 `to_text`。
    pub text: String,
    /// 该宫主星、辅星、杂耀与四组十二神的标识。
    pub star_keys: Vec<String>,
}

/// 宫位在切片里的角色。身宫与命宫重合时只输出一条 `soul`。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum PalaceRole {
    /// 命宫。
    Soul,
    /// 身宫（与命宫不同宫时）。
    Body,
    /// 主题宫。
    Theme,
    /// 主题宫的对宫。
    Opposite,
    /// 主题宫的财帛位。
    WealthPosition,
    /// 主题宫的官禄位。
    CareerPosition,
    /// 调用方显式追加的宫。
    Extra,
}

/// 一次按问题取材的完整结果。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Slice {
    /// 本次使用的包。
    pub pack: QuoteSource,
    /// 封闭主题。
    pub topic: Topic,
    /// 选中宫位的事实，按角色再按索引稳定排序。
    pub palaces: Vec<PalaceFact>,
    /// 命中且落在选中宫内的格局文本。
    pub patterns_text: String,
    /// 上述格局的标识。
    pub pattern_keys: Vec<String>,
    /// 包里对得上的原文。
    pub quotes: Vec<Quote>,
    /// 盘上有、包里没释义的标识。
    pub missing: Vec<Missing>,
}

/// 盘 + 包 + topic（及可选额外宫、运限）→ 切片。
pub fn read(
    chart: &Astrolabe,
    horoscope: Option<&HoroscopeData>,
    pack: &KnowledgePack,
    topic: Topic,
    extra: &[Palace],
    language: Language,
) -> Result<Slice, Error> {
    let selected = select_palaces(chart, horoscope, topic, extra)?;
    let palaces = palace_facts(chart, &selected, extra, language)?;
    let hits = pattern_hits(chart, horoscope, topic, &selected);
    let palace_names: Vec<Palace> = chart.palaces.iter().map(|p| p.name).collect();
    let patterns_text = patterns_to_text(&hits, &palace_names, language);
    let pattern_keys: Vec<String> = hits.iter().map(|h| h.key.as_key().to_string()).collect();

    let source = QuoteSource {
        pack_id: pack.id.clone(),
        pack_version: pack.version.clone(),
    };
    let (quotes, missing) = collect_quotes(pack, &source, &palaces, &hits);

    Ok(Slice {
        pack: source,
        topic,
        palaces,
        patterns_text,
        pattern_keys,
        quotes,
        missing,
    })
}

fn pattern_hits(
    chart: &Astrolabe,
    horoscope: Option<&HoroscopeData>,
    topic: Topic,
    selected: &SelectedPalaces,
) -> Vec<PatternHit> {
    let config = PatternConfig::default();
    let hits = match (topic, horoscope) {
        (Topic::Year, Some(h)) => patterns_at(chart, h, Scope::Yearly, &config),
        (Topic::Overall, _) => chart.patterns_with(&config),
        (_, Some(h)) => {
            let mut natal = chart.patterns_with(&config);
            natal.extend(patterns_at(chart, h, Scope::Yearly, &config));
            natal
        }
        (_, None) => chart.patterns_with(&config),
    };
    match topic {
        Topic::Overall => hits,
        _ => hits
            .into_iter()
            .filter(|hit| selected.contains(hit.palace))
            .collect(),
    }
}

fn palace_facts(
    chart: &Astrolabe,
    selected: &SelectedPalaces,
    extra: &[Palace],
    language: Language,
) -> Result<Vec<PalaceFact>, Error> {
    let extra_indices: Vec<usize> = extra
        .iter()
        .filter_map(|p| chart.palace(*p).map(|r| r.index))
        .collect();
    let mut facts = Vec::new();
    for index in &selected.indices {
        let palace_ref = chart
            .palace(*index)
            .ok_or_else(|| Error::internal(format!("palace index {index} missing")))?;
        let role = role_of(*index, selected, &extra_indices);
        facts.push(PalaceFact {
            key: palace_ref.name.as_key().to_string(),
            index: *index,
            role,
            text: palace_to_text(&palace_ref, language),
            star_keys: palace_star_keys(palace_ref.data()),
        });
    }
    facts.sort_by_key(|f| (role_rank(f.role), f.index));
    Ok(facts)
}

fn role_of(index: usize, selected: &SelectedPalaces, extra: &[usize]) -> PalaceRole {
    if index == selected.soul {
        return PalaceRole::Soul;
    }
    if index == selected.body {
        return PalaceRole::Body;
    }
    if selected.theme == Some(index) {
        return PalaceRole::Theme;
    }
    if extra.contains(&index) {
        return PalaceRole::Extra;
    }
    if let Some(theme) = selected.theme {
        let opp = (theme + 6) % 12;
        let career = (theme + 4) % 12;
        let wealth = (theme + 8) % 12;
        if index == opp {
            return PalaceRole::Opposite;
        }
        if index == wealth {
            return PalaceRole::WealthPosition;
        }
        if index == career {
            return PalaceRole::CareerPosition;
        }
    }
    PalaceRole::Extra
}

fn role_rank(role: PalaceRole) -> u8 {
    match role {
        PalaceRole::Soul => 0,
        PalaceRole::Body => 1,
        PalaceRole::Theme => 2,
        PalaceRole::Opposite => 3,
        PalaceRole::WealthPosition => 4,
        PalaceRole::CareerPosition => 5,
        PalaceRole::Extra => 6,
    }
}

fn palace_star_keys(palace: &x_iztro::PalaceData) -> Vec<String> {
    let mut keys = Vec::new();
    for s in palace
        .major_stars
        .iter()
        .chain(&palace.minor_stars)
        .chain(&palace.adjective_stars)
    {
        keys.push(s.key.as_key().to_string());
    }
    keys.push(palace.changsheng12.as_key().to_string());
    keys.push(palace.boshi12.as_key().to_string());
    keys.push(palace.suiqian12.as_key().to_string());
    keys.push(palace.jiangqian12.as_key().to_string());
    keys
}

fn collect_quotes(
    pack: &KnowledgePack,
    source: &QuoteSource,
    palaces: &[PalaceFact],
    hits: &[PatternHit],
) -> (Vec<Quote>, Vec<Missing>) {
    let mut quotes = Vec::new();
    let mut missing = Vec::new();
    let mut seen_stars = BTreeSet::new();
    let mut seen_patterns = BTreeSet::new();
    let mut seen_palaces = BTreeSet::new();

    for fact in palaces {
        if seen_palaces.insert(fact.key.clone()) {
            push_palace_quote(pack, source, &fact.key, &mut quotes, &mut missing);
        }
        let majors: Vec<String> = palaces
            .iter()
            .filter(|p| p.index == fact.index)
            .flat_map(|p| p.star_keys.iter())
            .cloned()
            .collect();
        for key in &fact.star_keys {
            if !seen_stars.insert(key.clone()) {
                continue;
            }
            push_star_quote(pack, source, key, &majors, &mut quotes, &mut missing);
        }
    }

    for hit in hits {
        let key = hit.key.as_key().to_string();
        if seen_patterns.insert(key.clone()) {
            push_pattern_quote(pack, source, hit.key, &mut quotes, &mut missing);
        }
    }

    for mutagen in [Mutagen::Lu, Mutagen::Quan, Mutagen::Ke, Mutagen::Ji] {
        push_mutagen_quote(pack, source, mutagen, &mut quotes, &mut missing);
    }

    (quotes, missing)
}

fn push_star_quote(
    pack: &KnowledgePack,
    source: &QuoteSource,
    key: &str,
    same_palace_keys: &[String],
    quotes: &mut Vec<Quote>,
    missing: &mut Vec<Missing>,
) {
    let Some(star) = StarKey::from_key(key) else {
        missing.push(Missing {
            kind: EntryKind::Star,
            key: key.to_string(),
        });
        return;
    };
    match pack.star(star) {
        Some(entry) => {
            match entry.intro.as_deref().map(str::trim) {
                Some(text) if !text.is_empty() => quotes.push(Quote {
                    kind: EntryKind::Star,
                    key: key.to_string(),
                    text: text.to_string(),
                    source: source.clone(),
                }),
                _ => missing.push(Missing {
                    kind: EntryKind::Star,
                    key: key.to_string(),
                }),
            }
            for (other, text) in &entry.combinations {
                if same_palace_keys.iter().any(|k| k == other) && !text.trim().is_empty() {
                    quotes.push(Quote {
                        kind: EntryKind::Combination,
                        key: format!("{key}+{other}"),
                        text: text.clone(),
                        source: source.clone(),
                    });
                }
            }
        }
        None => missing.push(Missing {
            kind: EntryKind::Star,
            key: key.to_string(),
        }),
    }
}

fn push_pattern_quote(
    pack: &KnowledgePack,
    source: &QuoteSource,
    key: PatternKey,
    quotes: &mut Vec<Quote>,
    missing: &mut Vec<Missing>,
) {
    let id = key.as_key().to_string();
    match pack.pattern_intro(key).map(str::trim) {
        Some(text) if !text.is_empty() => quotes.push(Quote {
            kind: EntryKind::Pattern,
            key: id,
            text: text.to_string(),
            source: source.clone(),
        }),
        _ => missing.push(Missing {
            kind: EntryKind::Pattern,
            key: id,
        }),
    }
}

fn push_palace_quote(
    pack: &KnowledgePack,
    source: &QuoteSource,
    key: &str,
    quotes: &mut Vec<Quote>,
    missing: &mut Vec<Missing>,
) {
    let Some(palace) = Palace::from_key(key) else {
        return;
    };
    match pack
        .palace(palace)
        .and_then(|e| e.intro.as_deref())
        .map(str::trim)
    {
        Some(text) if !text.is_empty() => quotes.push(Quote {
            kind: EntryKind::Palace,
            key: key.to_string(),
            text: text.to_string(),
            source: source.clone(),
        }),
        _ => missing.push(Missing {
            kind: EntryKind::Palace,
            key: key.to_string(),
        }),
    }
}

fn push_mutagen_quote(
    pack: &KnowledgePack,
    source: &QuoteSource,
    mutagen: Mutagen,
    quotes: &mut Vec<Quote>,
    missing: &mut Vec<Missing>,
) {
    let key = mutagen.as_key().to_string();
    match pack
        .mutagen(mutagen)
        .and_then(|e| e.intro.as_deref())
        .map(str::trim)
    {
        Some(text) if !text.is_empty() => quotes.push(Quote {
            kind: EntryKind::Mutagen,
            key,
            text: text.to_string(),
            source: source.clone(),
        }),
        _ => missing.push(Missing {
            kind: EntryKind::Mutagen,
            key,
        }),
    }
}

use std::collections::BTreeSet;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::birth::{BirthRequest, Calendar};
    use crate::chart::cast_raw;
    use x_iztro::KnowledgePack;

    fn example() -> (Astrolabe, &'static KnowledgePack) {
        let birth = BirthRequest {
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
        .unwrap();
        let (chart, _) = cast_raw(&birth, None).unwrap();
        let pack = KnowledgePack::builtin(Language::ZhCN).expect("zh-CN builtin pack");
        (chart, pack)
    }

    #[test]
    fn wealth_slice_covers_every_star_with_quote_or_missing() {
        let (chart, pack) = example();
        let slice = read(&chart, None, pack, Topic::Wealth, &[], Language::ZhCN).unwrap();
        assert_eq!(slice.topic, Topic::Wealth);
        assert!(slice.palaces.iter().any(|p| p.role == PalaceRole::Soul));
        assert!(slice.palaces.iter().any(|p| p.key == "wealthPalace"));
        let mut stars = BTreeSet::new();
        for p in &slice.palaces {
            stars.extend(p.star_keys.iter().cloned());
        }
        for key in stars {
            let quoted = slice
                .quotes
                .iter()
                .any(|q| q.kind == EntryKind::Star && q.key == key);
            let missed = slice
                .missing
                .iter()
                .any(|m| m.kind == EntryKind::Star && m.key == key);
            assert!(quoted || missed, "star {key} has neither quote nor missing");
        }
        for q in &slice.quotes {
            if q.kind == EntryKind::Star {
                let star = StarKey::from_key(&q.key).unwrap();
                assert_eq!(Some(q.text.as_str()), pack.star_intro(star));
            }
        }
    }

    #[test]
    fn quotes_do_not_invent_stars_off_the_slice() {
        let (chart, pack) = example();
        let slice = read(&chart, None, pack, Topic::Self_, &[], Language::ZhCN).unwrap();
        let mut on_slice = BTreeSet::new();
        for p in &slice.palaces {
            on_slice.extend(p.star_keys.iter().cloned());
        }
        for q in &slice.quotes {
            if q.kind == EntryKind::Star {
                assert!(
                    on_slice.contains(&q.key),
                    "quote for star {} not on slice",
                    q.key
                );
            }
        }
    }
}
