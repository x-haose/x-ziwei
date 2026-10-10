use std::time::Duration;

use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use serde_json::{json, Value};
use tower::ServiceExt;
use x_ziwei::{router, AppState};

fn app(limit: u32) -> axum::Router {
    router(AppState::new(limit, Duration::from_secs(60)))
}

async fn call(
    app: axum::Router,
    method: &str,
    path: &str,
    body: Option<&str>,
    accept: bool,
) -> (StatusCode, String, axum::http::HeaderMap) {
    let mut builder = Request::builder().method(method).uri(path);
    if body.is_some() {
        builder = builder.header(header::CONTENT_TYPE, "application/json");
    }
    if accept {
        builder = builder.header(header::ACCEPT, "application/json, text/event-stream");
    }
    let request = builder
        .body(match body {
            Some(body) => Body::from(body.to_string()),
            None => Body::empty(),
        })
        .unwrap();
    let response = app.oneshot(request).await.unwrap();
    let status = response.status();
    let headers = response.headers().clone();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (status, String::from_utf8(bytes.to_vec()).unwrap(), headers)
}

fn rpc(id: i64, method: &str, params: Value) -> String {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": method,
        "params": params
    })
    .to_string()
}

fn tool_call(name: &str, arguments: Value) -> String {
    rpc(
        1,
        "tools/call",
        json!({"name": name, "arguments": arguments}),
    )
}

async fn tool(arguments_name: &str, arguments: Value) -> Value {
    let (status, body, _) = call(
        app(100),
        "POST",
        "/mcp",
        Some(&tool_call(arguments_name, arguments)),
        true,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    serde_json::from_str(&body).unwrap()
}

fn solar() -> Value {
    json!({
        "calendar": "solar",
        "date": "2000-8-16",
        "timeIndex": 2,
        "gender": "female"
    })
}

#[tokio::test]
async fn healthz_and_landing_page() {
    let shared = app(1);
    for _ in 0..3 {
        let (status, body, _) = call(shared.clone(), "GET", "/healthz", None, false).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body, "ok\n");
    }

    let (status, html, _) = call(shared.clone(), "GET", "/", None, false).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(html.matches("<li>").count(), 3);
    assert!(html.contains("https://ziwei.x-haose.com/mcp"));
    assert!(
        html.contains(r#"{"calendar":"solar","date":"2000-8-16","timeIndex":2,"gender":"female"}"#)
    );
    assert!(html.contains("href=\"/healthz\""));

    // Landing and health checks do not spend the MCP rate-limit token.
    let (status, _, _) = call(
        shared,
        "POST",
        "/mcp",
        Some(&rpc(1, "ping", json!({}))),
        true,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn tools_match_frozen_schema() {
    let contract: Value =
        serde_json::from_str(include_str!("../contracts/mcp-tools.schema.json")).unwrap();
    let expected = contract["tools"].as_array().unwrap();
    let (status, body, _) = call(
        app(10),
        "POST",
        "/mcp",
        Some(&rpc(7, "tools/list", json!({}))),
        true,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let response: Value = serde_json::from_str(&body).unwrap();
    let tools = response["result"]["tools"].as_array().unwrap();
    let names: Vec<&str> = tools
        .iter()
        .map(|tool| tool["name"].as_str().unwrap())
        .collect();
    assert_eq!(names, vec!["chart", "to_text"]);
    assert!(!body.contains("ziwei_chart"));
    assert!(!body.contains("ziwei_read"));
    assert!(!body.contains("ziwei_lookup"));
    assert!(!names.contains(&"lookup"));
    for (got, want) in tools.iter().zip(expected) {
        assert_eq!(got["name"], want["name"]);
        assert_eq!(got["description"], want["description"]);
        assert_eq!(got["inputSchema"], want["inputSchema"]);
        assert_eq!(got["outputSchema"], want["outputSchema"]);
    }
}

#[tokio::test]
async fn chart_and_to_text_solar() {
    let response = tool("chart", solar()).await;
    let result = &response["result"];
    assert!(result.get("isError").is_none(), "{response}");
    let chart = &result["structuredContent"];
    assert!(chart.get("horoscope").is_none(), "{chart}");
    let astrolabe = &chart["astrolabe"];
    assert_eq!(astrolabe["solarDate"], "2000-8-16");
    assert_eq!(astrolabe["genderKey"], "female");
    assert_eq!(astrolabe["palaces"].as_array().unwrap().len(), 12);
    assert!(astrolabe["soulKey"].as_str().unwrap().len() > 0);
    let text_json: Value =
        serde_json::from_str(result["content"][0]["text"].as_str().unwrap()).unwrap();
    assert_eq!(&text_json["astrolabe"]["soulKey"], &astrolabe["soulKey"]);

    let response = tool("to_text", solar()).await;
    let result = &response["result"];
    assert!(result.get("isError").is_none(), "{response}");
    let text = result["structuredContent"]["text"].as_str().unwrap();
    assert_eq!(result["content"][0]["text"], text);
    assert!(text.contains("2000-8-16"), "{text}");
    assert!(result["structuredContent"].get("astrolabe").is_none());

    let mut with_knowledge = solar();
    with_knowledge["knowledge"] = json!(false);
    let plain = tool("to_text", with_knowledge).await;
    let plain_text = plain["result"]["structuredContent"]["text"]
        .as_str()
        .unwrap();
    assert!(text.len() > plain_text.len());
}

#[tokio::test]
async fn chart_horoscope_and_lunar_roundtrip() {
    let mut args = solar();
    args["targetDate"] = json!("2024-1-1");
    args["targetTimeIndex"] = json!(0);
    let response = tool("chart", args).await;
    let chart = &response["result"]["structuredContent"];
    assert!(chart["horoscope"]["solarDate"] == "2024-1-1", "{chart}");
    assert!(chart["horoscope"].get("yearly").is_some());

    let lunar = &chart["astrolabe"]["rawDates"]["lunarDate"];
    let leap = if lunar["isLeap"].as_bool().unwrap() {
        "leap"
    } else {
        "notLeap"
    };
    let lunar_args = json!({
        "calendar": "lunar",
        "date": format!(
            "{}-{}-{}",
            lunar["lunarYear"], lunar["lunarMonth"], lunar["lunarDay"]
        ),
        "timeIndex": 2,
        "gender": "female",
        "leap": leap
    });
    let lunar_chart = tool("chart", lunar_args).await;
    assert_eq!(
        lunar_chart["result"]["structuredContent"]["astrolabe"]["soulKey"],
        chart["astrolabe"]["soulKey"]
    );

    let mut text_args = solar();
    text_args["includeHoroscope"] = json!(true);
    text_args["targetDate"] = json!("2024-1-1");
    text_args["targetTimeIndex"] = json!(0);
    text_args["knowledge"] = json!(false);
    let text = tool("to_text", text_args).await;
    let body = text["result"]["structuredContent"]["text"]
        .as_str()
        .unwrap();
    assert!(body.contains("2000-8-16"), "{body}");
    assert!(body.contains("2024-1-1"), "{body}");
}

#[tokio::test]
async fn config_six_switches_only() {
    let mut args = solar();
    args["config"] = json!({
        "yearDivide": "exact",
        "horoscopeDivide": "exact",
        "ageDivide": "birthday",
        "dayDivide": "current",
        "algorithm": "zhongzhou",
        "astroType": "heaven"
    });
    let response = tool("chart", args).await;
    let config = &response["result"]["structuredContent"]["astrolabe"]["config"];
    assert_eq!(config["yearDivide"], "exact");
    assert_eq!(config["horoscopeDivide"], "exact");
    assert_eq!(config["ageDivide"], "birthday");
    assert_eq!(config["dayDivide"], "current");
    assert_eq!(config["algorithm"], "zhongzhou");
    assert_eq!(config["astroType"], "heaven");

    let mut rejected = solar();
    rejected["config"] = json!({"mutagens": {"jia": ["ziweiMaj"]}});
    let response = tool("chart", rejected).await;
    assert_eq!(response["result"]["isError"], true);
    let err: Value =
        serde_json::from_str(response["result"]["content"][0]["text"].as_str().unwrap()).unwrap();
    assert_eq!(err["code"], "invalid_argument");
    assert!(err.get("message").is_some());
    assert_eq!(err.as_object().unwrap().len(), 2);
}

#[tokio::test]
async fn engine_and_argument_errors() {
    let mut bad_date = solar();
    bad_date["date"] = json!("2000-13-40");
    let response = tool("chart", bad_date).await;
    let err: Value =
        serde_json::from_str(response["result"]["content"][0]["text"].as_str().unwrap()).unwrap();
    assert_eq!(err["code"], "invalid_date");

    let mut bad_time = solar();
    bad_time["timeIndex"] = json!(13);
    let response = tool("chart", bad_time).await;
    let err: Value =
        serde_json::from_str(response["result"]["content"][0]["text"].as_str().unwrap()).unwrap();
    assert_eq!(err["code"], "invalid_time_index");

    let mut lunar = solar();
    lunar["calendar"] = json!("lunar");
    let response = tool("chart", lunar).await;
    let err: Value =
        serde_json::from_str(response["result"]["content"][0]["text"].as_str().unwrap()).unwrap();
    assert_eq!(err["code"], "invalid_argument");

    let mut partial = solar();
    partial["targetDate"] = json!("2024-1-1");
    let response = tool("chart", partial).await;
    let err: Value =
        serde_json::from_str(response["result"]["content"][0]["text"].as_str().unwrap()).unwrap();
    assert_eq!(err["code"], "invalid_argument");

    let mut text = solar();
    text["includeHoroscope"] = json!(true);
    let response = tool("to_text", text).await;
    let err: Value =
        serde_json::from_str(response["result"]["content"][0]["text"].as_str().unwrap()).unwrap();
    assert_eq!(err["code"], "invalid_argument");

    let response = tool("lookup", solar()).await;
    assert_eq!(response["error"]["data"]["code"], "invalid_argument");
}

#[tokio::test]
async fn bad_request_and_rate_limit() {
    let (status, body, _) = call(app(10), "POST", "/mcp", Some("not-json"), true).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let err: Value = serde_json::from_str(&body).unwrap();
    assert_eq!(err["code"], "bad_request");
    assert_eq!(err.as_object().unwrap().len(), 2);

    let (status, _, _) = call(app(10), "GET", "/mcp", None, false).await;
    assert_eq!(status, StatusCode::METHOD_NOT_ALLOWED);

    let shared = app(1);
    let (status, _, _) = call(
        shared.clone(),
        "POST",
        "/mcp",
        Some(&rpc(1, "ping", json!({}))),
        true,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, body, headers) = call(
        shared,
        "POST",
        "/mcp",
        Some(&rpc(2, "ping", json!({}))),
        true,
    )
    .await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS, "{body}");
    let err: Value = serde_json::from_str(&body).unwrap();
    assert_eq!(err["code"], "rate_limited");
    assert_eq!(err["message"], "rate limit exceeded");
    assert_eq!(err.as_object().unwrap().len(), 2);
    assert!(headers.get(header::RETRY_AFTER).is_some());
}

#[tokio::test]
async fn sse_when_client_only_accepts_event_stream() {
    let app = app(10);
    let request = Request::builder()
        .method("POST")
        .uri("/mcp")
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCEPT, "text/event-stream")
        .body(Body::from(rpc(1, "ping", json!({}))))
        .unwrap();
    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .unwrap()
        .to_str()
        .unwrap();
    assert!(
        content_type.starts_with("text/event-stream"),
        "{content_type}"
    );
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let body = String::from_utf8(bytes.to_vec()).unwrap();
    assert!(body.starts_with("event: message\ndata: "), "{body}");
    assert!(body.contains("\"result\""));
}
