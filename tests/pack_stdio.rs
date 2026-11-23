//! 本机 stdio MCP 的真实入口：知识包被 x-iztro 0.9 的规则拒绝时，工具错误里带内核给的全部问题。
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};

use serde_json::{Value, json};
use x_iztro::KnowledgePack;

/// 0.9 不再接受的覆盖包：缺 version、未知星曜标识、主题宫位写错、正文含 HTML，另有一个规范外的字段（提醒）。
const BAD_PACK: &str = r#"{"schema":1,"id":"bad","language":"zh-CN","extends":"iztro-docs",
 "stars":{"ziweiMjj":{"intro":"本门。"},"tianjiMaj":{"intro":"<b>机</b>","intor":"x"}},
 "topics":{"romance":{"surround":["spousepalace"]}}}"#;

fn rpc(stdin: &mut impl Write, message: &Value) {
    writeln!(stdin, "{message}").unwrap();
    stdin.flush().unwrap();
}

fn reply(lines: &mut impl Iterator<Item = std::io::Result<String>>, id: u64) -> Value {
    for line in lines {
        let value: Value = serde_json::from_str(&line.unwrap()).unwrap();
        if value["id"] == id {
            return value;
        }
    }
    panic!("stdio 服务在回复 {id} 之前退出");
}

#[test]
fn rejected_pack_lists_every_issue_from_the_kernel() {
    let dir = std::env::temp_dir().join(format!("x-ziwei-pack-stdio-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let file = dir.join("bad.json");
    std::fs::write(&file, BAD_PACK).unwrap();

    let mut child = Command::new(env!("CARGO_BIN_EXE_x-ziwei"))
        .args(["stdio", "--allow-pack-dir"])
        .arg(&dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let mut stdin = child.stdin.take().unwrap();
    let mut lines = BufReader::new(child.stdout.take().unwrap()).lines();

    rpc(
        &mut stdin,
        &json!({"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}),
    );
    reply(&mut lines, 0);
    rpc(
        &mut stdin,
        &json!({"jsonrpc":"2.0","method":"notifications/initialized"}),
    );
    rpc(
        &mut stdin,
        &json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ziwei_get_natal_chart","arguments":{
            "birth":{"calendar":"solar","date":"2000-8-16","time_index":2,"gender":"female"},
            "knowledge":"summary","pack":format!("file:{}", file.display())}}}),
    );
    let result = reply(&mut lines, 1)["result"].clone();
    drop(stdin);
    child.wait().unwrap();
    std::fs::remove_dir_all(&dir).unwrap();

    assert_eq!(result["isError"], true);
    let body: Value = serde_json::from_str(result["content"][0]["text"].as_str().unwrap()).unwrap();
    assert_eq!(body["code"], "invalid_argument");
    assert_eq!(body["retryable"], false);

    // 与内核直接校验同一份包（连同默认包作底）给出的问题逐条一致，error 与 warning 都在。
    let raw: Value = serde_json::from_str(BAD_PACK).unwrap();
    let expected: Vec<Value> = KnowledgePack::check(&raw, KnowledgePack::builtin(x_iztro::Language::ZhCN))
        .iter()
        .map(|i| json!({"level": i.level.as_key(), "path": i.path_string(), "code": i.code.as_key(), "message": i.message()}))
        .collect();
    assert_eq!(body["issues"], Value::Array(expected.clone()));
    let errors = expected.iter().filter(|i| i["level"] == "error").count();
    assert!(
        errors >= 4,
        "测试包应有至少 4 个 error 级问题，实际 {errors}"
    );
    assert!(expected.iter().any(|i| i["level"] == "warning"));
    for path in [
        "version",
        "stars.ziweiMjj",
        "stars.tianjiMaj.intro",
        "topics.romance.surround[0]",
    ] {
        assert!(
            expected
                .iter()
                .any(|i| i["path"] == path && i["level"] == "error"),
            "缺少 {path} 的问题：{expected:?}"
        );
    }
}
