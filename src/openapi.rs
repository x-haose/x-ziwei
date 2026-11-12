//! `/v1` 接口的 OpenAPI 3.1 文档，请求与响应结构取自实际的 Rust 类型。

use schemars::JsonSchema;
use serde_json::{Map, Value, json};

use crate::http::Envelope;
use crate::knowledge::{Catalog, Entries};
use crate::service::{
    CatalogRequest, ChartRequest, HoroscopeRequest, LookupRequest, TextView, TopicRequest,
};

/// 服务对外的 HTTPS 根地址，写进 OpenAPI 的 `servers`。
#[derive(Clone)]
pub struct PublicUrl(String);

impl PublicUrl {
    /// 只接受 443 端口的 HTTPS 根地址：不带路径、查询串、片段或凭据。
    pub fn new(raw: &str) -> anyhow::Result<Self> {
        let url = reqwest::Url::parse(raw)?;
        anyhow::ensure!(
            url.scheme() == "https"
                && url.host_str().is_some()
                && url.username().is_empty()
                && url.password().is_none()
                && url.query().is_none()
                && url.fragment().is_none()
                && url.path() == "/"
                && url.port_or_known_default() == Some(443),
            "public URL must be an HTTPS origin on port 443"
        );
        Ok(Self(url.as_str().trim_end_matches('/').to_string()))
    }
}

/// 一个操作：路径、`operationId`（与 MCP 工具同名）、摘要、请求与响应的组件名。
struct Operation {
    path: &'static str,
    id: &'static str,
    summary: &'static str,
    request: &'static str,
    response: &'static str,
}

const OPERATIONS: [Operation; 5] = [
    Operation {
        path: "/v1/chart",
        id: "ziwei_get_natal_chart",
        summary: "本命盘事实（Markdown），可选附知识包释义；不含解读结论。",
        request: "ChartRequest",
        response: "TextResponse",
    },
    Operation {
        path: "/v1/horoscope",
        id: "ziwei_get_horoscope",
        summary: "明确目标日期与时辰的运限事实：大限、小限、流年、流月、流日、流时。",
        request: "HoroscopeRequest",
        response: "TextResponse",
    },
    Operation {
        path: "/v1/topic",
        id: "ziwei_get_topic_palaces",
        summary: "按知识包里的主题定义取本命宫位事实与释义；选宫由知识包决定。",
        request: "TopicRequest",
        response: "TextResponse",
    },
    Operation {
        path: "/v1/lookup",
        id: "ziwei_lookup_knowledge",
        summary: "按语言无关标识查知识包条目原文与来源。",
        request: "LookupRequest",
        response: "LookupResponse",
    },
    Operation {
        path: "/v1/catalog",
        id: "ziwei_list_knowledge",
        summary: "列出知识包目录：条目标识与显示名。",
        request: "CatalogRequest",
        response: "CatalogResponse",
    },
];

/// 把类型的 JSON Schema 放进 `components.schemas`，嵌套定义一并提升到同一层。
fn add_schema<T: JsonSchema>(schemas: &mut Map<String, Value>, name: &str) {
    let mut schema =
        serde_json::to_value(schemars::schema_for!(T)).expect("JSON Schema must serialize");
    let object = schema.as_object_mut().expect("schema is object");
    if let Some(Value::Object(defs)) = object.remove("$defs") {
        schemas.extend(defs);
    }
    object.remove("$schema");
    schemas.insert(name.into(), schema);
}

/// 将 schemars 的本地定义引用转换为 OpenAPI components 引用。
fn component_refs(value: &mut Value) {
    match value {
        Value::Object(map) => {
            if let Some(Value::String(reference)) = map.get_mut("$ref") {
                *reference = reference.replace("#/$defs/", "#/components/schemas/");
            }
            for value in map.values_mut() {
                component_refs(value);
            }
        }
        Value::Array(values) => {
            for value in values {
                component_refs(value);
            }
        }
        _ => {}
    }
}

/// 生成完整文档。全部操作只读、无鉴权。
pub fn document(public_url: &PublicUrl) -> Value {
    let mut schemas = Map::new();
    add_schema::<ChartRequest>(&mut schemas, "ChartRequest");
    add_schema::<HoroscopeRequest>(&mut schemas, "HoroscopeRequest");
    add_schema::<TopicRequest>(&mut schemas, "TopicRequest");
    add_schema::<LookupRequest>(&mut schemas, "LookupRequest");
    add_schema::<CatalogRequest>(&mut schemas, "CatalogRequest");
    add_schema::<Envelope<TextView>>(&mut schemas, "TextResponse");
    add_schema::<Envelope<Entries>>(&mut schemas, "LookupResponse");
    add_schema::<Envelope<Catalog>>(&mut schemas, "CatalogResponse");
    add_schema::<Envelope<()>>(&mut schemas, "ErrorResponse");

    let content = |name: &str| json!({"application/json": {"schema": {"$ref": format!("#/components/schemas/{name}")}}});
    let mut paths = Map::new();
    for op in &OPERATIONS {
        let mut responses = Map::new();
        responses.insert(
            "200".into(),
            json!({"description": "成功，data 为计算或查询结果。", "content": content(op.response)}),
        );
        for (status, description) in [
            ("400", "参数非法，或知识条目、主题不存在"),
            ("429", "限流，请稍后重试"),
            ("500", "内部错误"),
            ("503", "知识包不可用"),
        ] {
            responses.insert(
                status.into(),
                json!({"description": description, "content": content("ErrorResponse")}),
            );
        }
        paths.insert(
            op.path.into(),
            json!({"post": {
                "operationId": op.id,
                "summary": op.summary,
                "x-openai-isConsequential": false,
                "requestBody": {"required": true, "content": content(op.request)},
                "responses": responses,
            }}),
        );
    }
    let mut document = json!({
        "openapi": "3.1.0",
        "info": {
            "title": "x-ziwei",
            "version": env!("CARGO_PKG_VERSION"),
            "description": "紫微斗数排盘、运限与知识资料查询。盘面由 x-iztro 计算；知识文本注明来源，是一种资料观点，不代表唯一解盘方法。",
        },
        "servers": [{"url": public_url.0}],
        "security": [],
        "paths": paths,
        "components": {"schemas": schemas},
    });
    component_refs(&mut document);
    document
}
