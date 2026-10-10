//! Stateless Streamable HTTP JSON-RPC for the two frozen tools.
//!
//! Tool failures stay inside the tool result (`isError`) so the client can
//! read `{code, message}`. Envelope failures use a JSON-RPC error whose
//! `data` is the same object, or a bare HTTP body when there is no envelope.

use std::sync::OnceLock;

use axum::http::{header, HeaderMap, StatusCode};
use serde_json::{json, Value};

use crate::error::ApiError;
use crate::tools;

const PROTOCOL_VERSIONS: &[&str] = &[
    "2024-11-05",
    "2025-03-26",
    "2025-06-18",
    "2025-11-25",
    "2026-07-28",
];

const DEFAULT_PROTOCOL: &str = "2025-03-26";

pub enum Outcome {
    /// Notification or client response. HTTP 202, empty body.
    Accepted,
    /// JSON-RPC payload. HTTP 200, JSON or a single SSE message.
    Rpc { body: Value, sse: bool },
    /// No JSON-RPC envelope. Body is `{code, message}`.
    Bare { status: StatusCode, error: ApiError },
}

pub fn handle(headers: &HeaderMap, bytes: &[u8]) -> Outcome {
    if let Err(error) = check_content_type(headers) {
        return Outcome::Bare {
            status: StatusCode::UNSUPPORTED_MEDIA_TYPE,
            error,
        };
    }
    let sse = match accept_sse(headers) {
        Ok(sse) => sse,
        Err(error) => {
            return Outcome::Bare {
                status: StatusCode::NOT_ACCEPTABLE,
                error,
            };
        }
    };
    if let Err(error) = check_protocol_header(headers) {
        return Outcome::Bare {
            status: StatusCode::BAD_REQUEST,
            error,
        };
    }

    let value: Value = match serde_json::from_slice(bytes) {
        Ok(value) => value,
        Err(_) => {
            return Outcome::Bare {
                status: StatusCode::BAD_REQUEST,
                error: ApiError::bad_request("request body is not valid JSON"),
            };
        }
    };
    if value.is_array() {
        return Outcome::Bare {
            status: StatusCode::BAD_REQUEST,
            error: ApiError::bad_request("JSON-RPC batches are not supported"),
        };
    }
    let Some(message) = value.as_object() else {
        return Outcome::Bare {
            status: StatusCode::BAD_REQUEST,
            error: ApiError::bad_request("request must be a JSON object"),
        };
    };

    let id = message
        .get("id")
        .cloned()
        .filter(|id| id.is_string() || id.is_number() || id.is_null())
        .unwrap_or(Value::Null);

    if message.get("jsonrpc").and_then(Value::as_str) != Some("2.0") {
        return rpc(
            sse,
            rpc_error(
                id,
                -32600,
                &ApiError::bad_request("jsonrpc must be \"2.0\""),
            ),
        );
    }

    let method = match message.get("method") {
        None if message.contains_key("result") || message.contains_key("error") => {
            return Outcome::Accepted;
        }
        None => {
            return rpc(
                sse,
                rpc_error(id, -32600, &ApiError::bad_request("method is required")),
            );
        }
        Some(Value::String(method)) => method.as_str(),
        Some(_) => {
            return rpc(
                sse,
                rpc_error(
                    id,
                    -32600,
                    &ApiError::bad_request("method must be a string"),
                ),
            );
        }
    };

    // Notifications omit id. Do not execute tool calls without a response slot.
    if !message.contains_key("id") {
        return Outcome::Accepted;
    }

    let params = message.get("params").cloned().unwrap_or(Value::Null);
    let result = match method {
        "initialize" => Ok(initialize(&params)),
        "ping" => Ok(json!({})),
        "tools/list" => Ok(json!({ "tools": advertised_tools() })),
        "tools/call" => call_tool(&params),
        _ => Err(ApiError::bad_request(format!("method not found: {method}"))),
    };

    match result {
        Ok(result) => rpc(sse, json!({"jsonrpc": "2.0", "id": id, "result": result})),
        Err(error) => {
            let code = if error.code == "internal" {
                -32603
            } else if error.message.starts_with("method not found") {
                -32601
            } else {
                -32602
            };
            rpc(sse, rpc_error(id, code, &error))
        }
    }
}

fn rpc(sse: bool, body: Value) -> Outcome {
    Outcome::Rpc { body, sse }
}

fn rpc_error(id: Value, code: i32, error: &ApiError) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": {
            "code": code,
            "message": error.message,
            "data": error.body(),
        }
    })
}

fn initialize(params: &Value) -> Value {
    let requested = params
        .get("protocolVersion")
        .and_then(Value::as_str)
        .unwrap_or(DEFAULT_PROTOCOL);
    let protocol_version = if PROTOCOL_VERSIONS.contains(&requested) {
        requested
    } else {
        DEFAULT_PROTOCOL
    };
    json!({
        "protocolVersion": protocol_version,
        "capabilities": { "tools": { "listChanged": false } },
        "serverInfo": {
            "name": "x-ziwei",
            "version": env!("CARGO_PKG_VERSION"),
        },
        "instructions": "紫微斗数。工具只有 chart（星盘 JSON）和 to_text（Markdown）。阳历最短入参：calendar=solar，date=YYYY-M-D，timeIndex=0-12，gender=male|female。"
    })
}

fn call_tool(params: &Value) -> Result<Value, ApiError> {
    let Some(obj) = params.as_object() else {
        return Err(ApiError::bad_request("tools/call params must be an object"));
    };
    let name = obj
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::bad_request("tool name is required"))?;
    let arguments = match obj.get("arguments") {
        None | Some(Value::Null) => Value::Object(Default::default()),
        Some(value) if value.is_object() => value.clone(),
        Some(_) => {
            return Err(ApiError::bad_request("arguments must be an object"));
        }
    };
    if name != "chart" && name != "to_text" {
        return Err(ApiError::bad_request(format!("unknown tool '{name}'")));
    }

    let executed = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| match name {
        "chart" => tools::chart(&arguments).map(|value| {
            let text = serde_json::to_string(&value).unwrap_or_else(|_| "{}".to_string());
            tool_ok(text, value)
        }),
        "to_text" => {
            tools::to_text(&arguments).map(|text| tool_ok(text.clone(), json!({"text": text})))
        }
        _ => unreachable!("tool name checked above"),
    }));

    match executed {
        Ok(Ok(result)) => Ok(result),
        Ok(Err(error)) => Ok(tool_err(&error)),
        Err(_) => Ok(tool_err(&ApiError::internal("internal error"))),
    }
}

fn tool_ok(text: String, structured: Value) -> Value {
    json!({
        "content": [{ "type": "text", "text": text }],
        "structuredContent": structured
    })
}

fn tool_err(error: &ApiError) -> Value {
    let body = error.body();
    let text = serde_json::to_string(&body)
        .unwrap_or_else(|_| "{\"code\":\"internal\",\"message\":\"internal error\"}".to_string());
    json!({
        "content": [{ "type": "text", "text": text }],
        "isError": true
    })
}

fn advertised_tools() -> &'static Vec<Value> {
    static TOOLS: OnceLock<Vec<Value>> = OnceLock::new();
    TOOLS.get_or_init(|| {
        let schema: Value =
            serde_json::from_str(include_str!("../contracts/mcp-tools.schema.json"))
                .expect("contracts/mcp-tools.schema.json is valid JSON");
        schema["tools"]
            .as_array()
            .expect("tools array")
            .iter()
            .map(|tool| {
                json!({
                    "name": tool["name"],
                    "description": tool["description"],
                    "inputSchema": tool["inputSchema"],
                    "outputSchema": tool["outputSchema"],
                })
            })
            .collect()
    })
}

fn check_content_type(headers: &HeaderMap) -> Result<(), ApiError> {
    let value = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    let mime = value.split(';').next().unwrap_or("").trim();
    if mime.eq_ignore_ascii_case("application/json") {
        Ok(())
    } else {
        Err(ApiError::bad_request(
            "content-type must be application/json",
        ))
    }
}

fn accept_sse(headers: &HeaderMap) -> Result<bool, ApiError> {
    let accept = headers
        .get(header::ACCEPT)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    let ranges: Vec<&str> = accept
        .split(',')
        .map(|part| part.split(';').next().unwrap_or("").trim())
        .filter(|part| !part.is_empty())
        .collect();
    let allows = |mime: &str| ranges.iter().any(|range| *range == mime || *range == "*/*");
    let json = allows("application/json");
    let sse = allows("text/event-stream");
    if json {
        Ok(false)
    } else if sse {
        Ok(true)
    } else {
        Err(ApiError::bad_request(
            "accept must include application/json or text/event-stream",
        ))
    }
}

fn check_protocol_header(headers: &HeaderMap) -> Result<(), ApiError> {
    let Some(value) = headers
        .get("mcp-protocol-version")
        .and_then(|value| value.to_str().ok())
    else {
        return Ok(());
    };
    if PROTOCOL_VERSIONS.contains(&value) {
        Ok(())
    } else {
        Err(ApiError::bad_request(format!(
            "unsupported mcp-protocol-version: {value}"
        )))
    }
}
