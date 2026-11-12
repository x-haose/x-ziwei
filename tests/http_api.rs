//! 经真实 TCP 验证对外契约：MCP 工具面、`/v1` 接口、跨域、OpenAPI 与入参校验。
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;
use x_ziwei::http::{HttpConfig, router};
use x_ziwei::openapi::PublicUrl;
use x_ziwei::{App, PackPolicy, PackStore};

/// 在随机端口起一个服务，返回其根地址。
async fn spawn(public_url: Option<PublicUrl>) -> String {
    let app = App {
        packs: Arc::new(PackStore::new(PackPolicy::default()).unwrap()),
    };
    let config = HttpConfig {
        listen: "127.0.0.1:0".parse().unwrap(),
        trust_proxy: false,
        rate_limit: None,
        allowed_hosts: vec![],
        public_url,
        openai_apps_challenge: Some("challenge-token".into()),
    };
    let listener = tokio::net::TcpListener::bind(config.listen).await.unwrap();
    let address = listener.local_addr().unwrap();
    let service = router(app, &config, CancellationToken::new())
        .into_make_service_with_connect_info::<SocketAddr>();
    tokio::spawn(async move {
        axum::serve(listener, service).await.unwrap();
    });
    format!("http://{address}")
}

fn client() -> Client {
    Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap()
}

fn birth() -> Value {
    json!({"date": "2000-8-16", "clock": "23:15", "gender": "female"})
}

/// 所有本地 JSON 引用必须能在完整 OpenAPI 文档中解析。
fn check_refs(value: &Value, root: &Value) {
    match value {
        Value::Object(map) => {
            if let Some(reference) = map.get("$ref").and_then(Value::as_str) {
                assert!(
                    root.pointer(reference.strip_prefix('#').unwrap()).is_some(),
                    "{reference}"
                );
            }
            for value in map.values() {
                check_refs(value, root);
            }
        }
        Value::Array(values) => {
            for value in values {
                check_refs(value, root);
            }
        }
        _ => {}
    }
}

#[tokio::test]
async fn mcp_lists_five_tools_and_returns_one_text_block() {
    let base = spawn(None).await;
    let client = client();
    let rpc = |method: &str, params: Value| {
        client
            .post(format!("{base}/mcp"))
            .header("accept", "application/json, text/event-stream")
            .json(&json!({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}))
            .send()
    };
    let listed: Value = rpc("tools/list", json!({}))
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let tools = listed["result"]["tools"].as_array().unwrap();
    let mut names: Vec<&str> = tools.iter().map(|t| t["name"].as_str().unwrap()).collect();
    names.sort_unstable();
    assert_eq!(
        names,
        [
            "ziwei_catalog",
            "ziwei_chart",
            "ziwei_horoscope",
            "ziwei_lookup",
            "ziwei_topic"
        ]
    );
    for tool in tools {
        assert_eq!(tool["annotations"]["readOnlyHint"], true, "{tool}");
        assert_eq!(tool["annotations"]["destructiveHint"], false, "{tool}");
        assert_eq!(tool["annotations"]["openWorldHint"], false, "{tool}");
        assert!(tool["title"].is_string(), "{tool}");
        assert!(tool.get("outputSchema").is_none(), "{tool}");
    }

    let called: Value = rpc(
        "tools/call",
        json!({"name": "ziwei_topic", "arguments": {"birth": birth(), "topic": "romance"}}),
    )
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
    let result = &called["result"];
    assert_ne!(result["isError"], true, "{called}");
    assert!(result.get("structuredContent").is_none());
    let content = result["content"].as_array().unwrap();
    assert_eq!(content.len(), 1);
    let text = content[0]["text"].as_str().unwrap();
    assert!(text.starts_with("# 婚恋"));
    assert!(text.contains("知识包 iztro-docs"));

    let failed: Value = rpc(
        "tools/call",
        json!({"name": "ziwei_topic", "arguments": {"birth": birth(), "topic": "spouse"}}),
    )
    .await
    .unwrap()
    .json()
    .await
    .unwrap();
    assert_eq!(failed["result"]["isError"], true);
    let body: Value =
        serde_json::from_str(failed["result"]["content"][0]["text"].as_str().unwrap()).unwrap();
    assert_eq!(body["code"], "unknown_topic");
}

#[tokio::test]
async fn v1_api_over_http() {
    let base = spawn(Some(PublicUrl::new("https://ziwei.example.com").unwrap())).await;
    let client = client();

    let schema: Value = client
        .get(format!("{base}/v1/openapi.json"))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json()
        .await
        .unwrap();
    check_refs(&schema, &schema);
    assert_eq!(schema["paths"].as_object().unwrap().len(), 5);
    assert_eq!(schema["security"], json!([]));
    assert_eq!(schema["servers"][0]["url"], "https://ziwei.example.com");
    assert_eq!(
        schema["paths"]["/v1/chart"]["post"]["x-openai-isConsequential"],
        false
    );

    let preflight = client
        .request(reqwest::Method::OPTIONS, format!("{base}/v1/chart"))
        .header("origin", "https://third-party-app.example")
        .header("access-control-request-method", "POST")
        .header("access-control-request-headers", "content-type")
        .send()
        .await
        .unwrap();
    assert!(preflight.status().is_success());
    assert_eq!(preflight.headers()["access-control-allow-origin"], "*");

    let post = |path: &str, body: Value| {
        client
            .post(format!("{base}/v1/{path}"))
            .header("origin", "https://third-party-app.example")
            .json(&body)
            .send()
    };

    let response = post("chart", json!({"birth": birth()})).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()["access-control-allow-origin"], "*");
    let natal = response.json::<Value>().await.unwrap();
    assert!(natal["data"]["text"].as_str().unwrap().contains("晚子"));
    assert!(natal["data"].get("pack").is_none());

    let lunar = post(
        "chart",
        json!({"birth": {"calendar": "lunar", "date": "2000-7-17", "time_index": 12, "gender": "female"}}),
    )
    .await
    .unwrap()
    .error_for_status()
    .unwrap()
    .json::<Value>()
    .await
    .unwrap();
    assert_eq!(lunar, natal);

    let with_notes = post("chart", json!({"birth": birth(), "knowledge": "summary"}))
        .await
        .unwrap()
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(with_notes["data"]["pack"]["id"], "iztro-docs");

    let horoscope = post(
        "horoscope",
        json!({"birth": birth(), "target": {"date": "2026-11-11", "time_index": 12}}),
    )
    .await
    .unwrap();
    assert_eq!(horoscope.status(), StatusCode::OK);
    let horoscope = horoscope.json::<Value>().await.unwrap();
    assert!(horoscope["data"]["text"].as_str().unwrap().contains("流时"));

    let topic = post("topic", json!({"birth": birth(), "topic": "career"}))
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json::<Value>()
        .await
        .unwrap();
    assert!(topic["data"]["text"].as_str().unwrap().contains("官禄"));

    let catalog = post("catalog", json!({"kind": "topic"}))
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(catalog["data"]["sections"][0]["kind"], "topic");

    let entries = post(
        "lookup",
        json!({"kind": "star", "keys": ["ziweiMaj", "tianfuMaj"]}),
    )
    .await
    .unwrap()
    .error_for_status()
    .unwrap()
    .json::<Value>()
    .await
    .unwrap();
    let entries = entries["data"]["entries"].as_array().unwrap();
    assert_eq!(entries.len(), 2);
    assert!(
        entries[0]["entry"]["intro"]
            .as_str()
            .unwrap()
            .contains("紫微")
    );

    for (path, input) in [
        (
            "chart",
            json!({"birth": {"date": "2000-8-16", "gender": "female"}}),
        ),
        (
            "chart",
            json!({"birth": {"date": "2000-2-30", "time_index": 2, "gender": "female"}}),
        ),
        (
            "chart",
            json!({"birth": {"date": "2000-8-16", "time_index": 13, "gender": "female"}}),
        ),
        (
            "chart",
            json!({"birth": {"date": "2000-8-16", "time_index": 0, "clock": "23:15", "gender": "female"}}),
        ),
        (
            "chart",
            json!({"birth": {"date": "2000-8-16", "clock": "23:15", "gender": "female", "is_leap_month": true}}),
        ),
        ("chart", json!({"birth": birth(), "topic": "spouse"})),
        ("chart", json!({"birth": birth(), "pack": "builtin"})),
        ("horoscope", json!({"birth": birth()})),
        (
            "horoscope",
            json!({"birth": birth(), "target": {"date": "2026-11-11"}}),
        ),
        (
            "horoscope",
            json!({"birth": birth(), "target": {"date": "2026-11-11 23:15", "time_index": 0}}),
        ),
        ("topic", json!({"birth": birth(), "topic": "spouse"})),
        ("lookup", json!({"kind": "star", "keys": []})),
        ("lookup", json!({"kind": "star", "keys": ["nope"]})),
        (
            "lookup",
            json!({"kind": "star", "keys": ["ziweiMaj"], "pack": "file:/tmp/pack.json"}),
        ),
    ] {
        let response = post(path, input.clone()).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{path} {input}");
        let body = response.json::<Value>().await.unwrap();
        assert_eq!(body["ok"], false, "{path} {input}");
        assert_eq!(body["data"], Value::Null);
    }

    let challenge = client
        .get(format!("{base}/.well-known/openai-apps-challenge"))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap();
    assert!(
        challenge.headers()["content-type"]
            .to_str()
            .unwrap()
            .starts_with("text/plain")
    );
    assert_eq!(challenge.text().await.unwrap(), "challenge-token");

    let without_url = spawn(None).await;
    assert_eq!(
        client
            .get(format!("{without_url}/v1/openapi.json"))
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::NOT_FOUND
    );
}

#[test]
fn invalid_public_url_fails() {
    for url in [
        "http://example.com",
        "https://example.com/path",
        "https://example.com:8443",
        "https://user@example.com",
    ] {
        assert!(PublicUrl::new(url).is_err());
    }
}
