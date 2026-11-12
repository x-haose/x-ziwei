//! 知识包的目录与按标识查询。条目原样返回，字段含义以知识包格式规范为准，本进程不挑字段。

use serde::{Deserialize, Serialize};
use serde_json::Value;
use x_iztro::{KnowledgePack, Mutagen, Palace, PatternKey, StarKey};

use crate::error::Error;

/// 知识包的条目段。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    /// 星耀，标识如 `ziweiMaj`。
    Star,
    /// 格局，标识如 `zi_fu_tong_gong`。
    Pattern,
    /// 宫位，标识如 `soulPalace`。
    Palace,
    /// 四化，标识如 `sihuaLu`。
    Mutagen,
    /// 术语，标识是知识包自定义的 slug。
    Concept,
    /// 解读主题（读这类问题看哪些宫），标识是知识包自定义的 slug。
    Topic,
}

impl Kind {
    /// 全部条目段，目录按此顺序输出。
    pub const ALL: [Kind; 6] = [
        Kind::Star,
        Kind::Pattern,
        Kind::Palace,
        Kind::Mutagen,
        Kind::Concept,
        Kind::Topic,
    ];

    /// 报错文案里的段名。
    fn label(self) -> &'static str {
        match self {
            Kind::Star => "star",
            Kind::Pattern => "pattern",
            Kind::Palace => "palace",
            Kind::Mutagen => "mutagen",
            Kind::Concept => "concept",
            Kind::Topic => "topic",
        }
    }

    /// 标识是否属于该段的值域。星、格局、宫、四化的值域来自内核；术语与主题的 slug 由包自定义，不设值域。
    fn accepts(self, key: &str) -> bool {
        match self {
            Kind::Star => StarKey::from_key(key).is_some(),
            Kind::Pattern => PatternKey::from_key(key).is_some(),
            Kind::Palace => Palace::from_key(key).is_some(),
            Kind::Mutagen => Mutagen::from_key(key).is_some(),
            Kind::Concept | Kind::Topic => true,
        }
    }
}

/// 结果所依据的知识包。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct PackInfo {
    /// 知识包 `id`。
    pub id: String,
    /// 知识包 `version`。
    pub version: String,
    /// 知识包文本语言码。
    pub language: String,
}

impl PackInfo {
    /// 取包的标识信息。
    pub fn of(pack: &KnowledgePack) -> Self {
        Self {
            id: pack.id.clone(),
            version: pack.version.clone(),
            language: pack.language.clone(),
        }
    }
}

/// 目录里的一行。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct CatalogItem {
    /// 语言无关标识，可直接用于查询。
    pub key: String,
    /// 显示名（术语与主题为标题）；包未写则为 `None`。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

/// 目录里的一段。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct CatalogSection {
    /// 条目段。
    pub kind: Kind,
    /// 该段的条目，按标识排序。
    pub items: Vec<CatalogItem>,
}

/// 知识包目录：有哪些条目可查，以及显示名与标识的对应。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Catalog {
    /// 目录所属的包。
    pub pack: PackInfo,
    /// 各段，顺序为星耀、格局、宫位、四化、术语、主题；只请求一段时只有那一段。
    pub sections: Vec<CatalogSection>,
}

/// 查到的一条。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Entry {
    /// 所属条目段。
    pub kind: Kind,
    /// 查询用的标识。
    pub key: String,
    /// 包里该条目的原样内容：名称、正文、摘要，星耀另有门派属性与双星组合，格局另有古籍引文与成立条件，
    /// 主题另有选宫定义（`surround` 连三方四正、`palaces` 只取本宫）。包没写的字段不出现。
    pub entry: Value,
}

/// 一次查询的结果。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Entries {
    /// 条目所属的包。
    pub pack: PackInfo,
    /// 与请求的标识一一对应、顺序相同。
    pub entries: Vec<Entry>,
}

/// 列出包里可查的条目。`kind` 为 `None` 时列全部段。星、格局、宫、四化里标识不在内核值域的条目不列出：
/// 它们按标识查不到。
pub fn catalog(pack: &KnowledgePack, kind: Option<Kind>) -> Catalog {
    let mut sections = Vec::new();
    for section in Kind::ALL {
        if kind.is_some_and(|k| k != section) {
            continue;
        }
        let rows: Vec<(&String, Option<&String>)> = match section {
            Kind::Star => pack
                .stars
                .iter()
                .map(|(k, e)| (k, e.name.as_ref()))
                .collect(),
            Kind::Pattern => pack
                .patterns
                .iter()
                .map(|(k, e)| (k, e.name.as_ref()))
                .collect(),
            Kind::Palace => pack
                .palaces
                .iter()
                .map(|(k, e)| (k, e.name.as_ref()))
                .collect(),
            Kind::Mutagen => pack
                .mutagens
                .iter()
                .map(|(k, e)| (k, e.name.as_ref()))
                .collect(),
            Kind::Concept => pack
                .concepts
                .iter()
                .map(|(k, e)| (k, e.title.as_ref()))
                .collect(),
            Kind::Topic => pack
                .topics
                .iter()
                .map(|(k, e)| (k, e.title.as_ref()))
                .collect(),
        };
        sections.push(CatalogSection {
            kind: section,
            items: rows
                .into_iter()
                .filter(|(key, _)| section.accepts(key))
                .map(|(key, name)| CatalogItem {
                    key: key.clone(),
                    name: name.cloned(),
                })
                .collect(),
        });
    }
    Catalog {
        pack: PackInfo::of(pack),
        sections,
    }
}

/// 按标识查条目。任何一个标识不在值域或包里没有，整次查询失败，不返回相近条目。
pub fn lookup(pack: &KnowledgePack, kind: Kind, keys: &[String]) -> Result<Entries, Error> {
    let entries = keys
        .iter()
        .map(|key| {
            let found = if kind.accepts(key) {
                entry_value(pack, kind, key)
            } else {
                None
            };
            found
                .map(|entry| Entry {
                    kind,
                    key: key.clone(),
                    entry,
                })
                .ok_or_else(|| Error::unknown_key(kind.label(), key))
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Entries {
        pack: PackInfo::of(pack),
        entries,
    })
}

fn entry_value(pack: &KnowledgePack, kind: Kind, key: &str) -> Option<Value> {
    fn json<T: Serialize>(entry: &T) -> Value {
        serde_json::to_value(entry).expect("knowledge pack entries are plain JSON objects")
    }
    match kind {
        Kind::Star => pack.stars.get(key).map(json),
        Kind::Pattern => pack.patterns.get(key).map(json),
        Kind::Palace => pack.palaces.get(key).map(json),
        Kind::Mutagen => pack.mutagens.get(key).map(json),
        Kind::Concept => pack.concepts.get(key).map(json),
        Kind::Topic => pack.topics.get(key).map(json),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorCode;
    use x_iztro::Language;

    fn pack() -> &'static KnowledgePack {
        KnowledgePack::builtin(Language::ZhCN).expect("zh-CN builtin")
    }

    #[test]
    fn every_catalog_item_can_be_looked_up() {
        let catalog = catalog(pack(), None);
        assert_eq!(catalog.sections.len(), Kind::ALL.len());
        for section in &catalog.sections {
            assert!(!section.items.is_empty(), "{:?} is empty", section.kind);
            for item in &section.items {
                let found = lookup(pack(), section.kind, std::slice::from_ref(&item.key)).unwrap();
                assert_eq!(found.entries[0].key, item.key);
            }
        }
    }

    #[test]
    fn topic_entry_exposes_its_palace_selection() {
        let found = lookup(pack(), Kind::Topic, &["romance".to_string()]).unwrap();
        assert_eq!(found.entries[0].entry["surround"][0], "spousePalace");
        assert_eq!(found.pack.id, pack().id);
    }

    #[test]
    fn one_unknown_key_fails_the_whole_lookup() {
        let keys = ["ziweiMaj".to_string(), "notAStar".to_string()];
        let err = lookup(pack(), Kind::Star, &keys).unwrap_err();
        assert_eq!(err.code, ErrorCode::UnknownKey);
        assert!(err.message.contains("notAStar"));
    }

    #[test]
    fn unknown_keys_kept_in_a_pack_are_not_listed() {
        let mut custom = pack().clone();
        custom
            .stars
            .insert("notAStar".into(), custom.stars["ziweiMaj"].clone());
        let catalog = catalog(&custom, Some(Kind::Star));
        assert_eq!(catalog.sections.len(), 1);
        assert_eq!(catalog.sections[0].kind, Kind::Star);
        assert!(
            catalog.sections[0]
                .items
                .iter()
                .all(|i| i.key != "notAStar")
        );
    }
}
