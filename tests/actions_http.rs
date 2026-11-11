//! 真实 TCP 入口验证 公开访问、跨域、OpenAPI 与排盘参数契约。
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use std::sync::Arc;
use tokio_util::sync::CancellationToken;
use x_ziwei::actions::ActionsConfig;
use x_ziwei::http::{HttpConfig, router};
use x_ziwei::{App, PackPolicy, PackStore};

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
async fn actions_over_http() {
    let app = App {
        packs: Arc::new(PackStore::new(PackPolicy::default()).unwrap()),
    };
    let mut config = HttpConfig {
        listen: "127.0.0.1:0".parse().unwrap(),
        trust_proxy: false,
        rate_limit: None,
        allowed_hosts: vec![],
        actions: Some(ActionsConfig::new("https://ziwei.example.com").unwrap()),
    };
    let listener = tokio::net::TcpListener::bind(config.listen).await.unwrap();
    let address = listener.local_addr().unwrap();
    let cancel = CancellationToken::new();
    let service = router(app.clone(), &config, cancel.clone())
        .into_make_service_with_connect_info::<std::net::SocketAddr>();
    let server = tokio::spawn(async move {
        axum::serve(listener, service).await.unwrap();
    });
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap();
    let base = format!("http://{address}/actions");
    let schema: Value = client
        .get(format!("{base}/openapi.json"))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json()
        .await
        .unwrap();
    check_refs(&schema, &schema);
    assert_eq!(schema["paths"].as_object().unwrap().len(), 2);
    assert_eq!(schema["security"], json!([]));
    assert!(schema["components"].get("securitySchemes").is_none());
    assert_eq!(
        schema["paths"]["/actions/chart"]["post"]["x-openai-isConsequential"],
        false
    );
    let birth = json!({"date":"2000-8-16","clock":"23:15","gender":"female"});
    let preflight = client
        .request(reqwest::Method::OPTIONS, format!("{base}/chart"))
        .header("origin", "https://third-party-app.example")
        .header("access-control-request-method", "POST")
        .header("access-control-request-headers", "content-type")
        .send()
        .await
        .unwrap();
    assert!(preflight.status().is_success());
    assert_eq!(preflight.headers()["access-control-allow-origin"], "*");
    assert_eq!(preflight.headers()["access-control-allow-methods"], "*");
    assert_eq!(preflight.headers()["access-control-allow-headers"], "*");
    let post = |path: &str, body: Value| {
        client
            .post(format!("{base}/{path}"))
            .header("origin", "https://third-party-app.example")
            .json(&body)
            .send()
    };
    let response = post("chart", json!({"birth":birth})).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()["access-control-allow-origin"], "*");
    let natal = response.json::<Value>().await.unwrap();
    assert!(natal["data"]["text"].as_str().unwrap().contains("晚子"));
    let h = post(
        "chart",
        json!({"birth":birth,"target":{"date":"2026-11-11","time_index":12}}),
    )
    .await
    .unwrap();
    assert_eq!(h.status(), StatusCode::OK);
    let data = h.json::<Value>().await.unwrap();
    assert!(
        data["data"]["horoscope_text"]
            .as_str()
            .unwrap()
            .contains("流时")
    );
    for input in [
        json!({"birth":{"date":"2000-8-16","gender":"female"}}),
        json!({"birth":{"date":"2000-2-30","time_index":2,"gender":"female"}}),
        json!({"birth":{"date":"2000-8-16","time_index":13,"gender":"female"}}),
        json!({"birth":{"date":"2000-8-16","time_index":0,"clock":"23:15","gender":"female"}}),
        json!({"birth":birth,"target":{"date":"2026-11-11"}}),
        json!({"birth":birth,"target":{"date":"","time_index":0}}),
        json!({"birth":birth,"target":{"date":"2026-11-11 23:15","time_index":0}}),
        json!({"birth":birth,"target":{"date":"2026-11-11","time_index":13}}),
        json!({"birth":birth,"topic":"spouse"}),
        json!({"birth":{"date":"2000-8-16","clock":"23:15","gender":"female","is_leap_month":true}}),
    ] {
        let response = post("chart", input.clone()).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{input}");
        assert_eq!(response.json::<Value>().await.unwrap()["data"], Value::Null);
    }
    let lunar=post("chart",json!({"birth":{"calendar":"lunar","date":"2000-7-17","time_index":12,"gender":"female","leap":"not_leap"}})).await.unwrap().error_for_status().unwrap().json::<Value>().await.unwrap();
    assert_eq!(lunar, natal);
    let entry = post("lookup", json!({"kind":"star","key":"ziweiMaj"}))
        .await
        .unwrap()
        .error_for_status()
        .unwrap()
        .json::<Value>()
        .await
        .unwrap();
    assert!(entry["data"]["text"].as_str().unwrap().contains("紫微"));
    for body in [
        json!({"kind":"star","key":"nope"}),
        json!({"kind":"star","key":"ziweiMaj","pack":"file:/tmp/pack.json"}),
    ] {
        assert_eq!(
            post("lookup", body).await.unwrap().status(),
            StatusCode::BAD_REQUEST
        );
    }
    assert_eq!(
        post("read", json!({})).await.unwrap().status(),
        StatusCode::NOT_FOUND
    );
    server.abort();
    config.actions = None;
    let listener = tokio::net::TcpListener::bind(config.listen).await.unwrap();
    let address = listener.local_addr().unwrap();
    let service = router(app, &config, cancel.clone())
        .into_make_service_with_connect_info::<std::net::SocketAddr>();
    let disabled = tokio::spawn(async move {
        axum::serve(listener, service).await.unwrap();
    });
    assert_eq!(
        client
            .get(format!("http://{address}/actions/openapi.json"))
            .send()
            .await
            .unwrap()
            .status(),
        StatusCode::NOT_FOUND
    );
    disabled.abort();
    cancel.cancel();
}

#[test]
fn invalid_actions_configuration_fails() {
    for url in [
        "http://example.com",
        "https://example.com/path",
        "https://example.com:8443",
        "https://user@example.com",
    ] {
        assert!(ActionsConfig::new(url).is_err());
    }
}
