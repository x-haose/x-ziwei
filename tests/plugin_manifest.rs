//! 插件版本号写在三处：Codex 清单、Claude 清单、Claude 插件市场目录。客户端按版本号缓存已安装的插件，
//! 发版作业按 Codex 清单的版本号打标签；三处不一致时，各客户端装到的内容与发布的版本对不上。
use serde_json::Value;
use std::path::Path;

fn manifest(relative: &str) -> Value {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(relative);
    let text = std::fs::read_to_string(&path).unwrap();
    serde_json::from_str(&text).unwrap()
}

#[test]
fn plugin_version_is_identical_in_every_manifest() {
    let codex = manifest("plugin/.codex-plugin/plugin.json");
    let claude = manifest("plugin/.claude-plugin/plugin.json");
    let marketplace = manifest(".claude-plugin/marketplace.json");
    let listed = marketplace["plugins"]
        .as_array()
        .unwrap()
        .iter()
        .find(|plugin| plugin["name"] == "ziwei")
        .unwrap();

    let version = codex["version"].as_str().unwrap();
    assert_eq!(claude["version"].as_str(), Some(version));
    assert_eq!(listed["version"].as_str(), Some(version));
}
