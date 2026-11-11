//! GPT Actions：公开的排盘与默认知识包查询，复用服务层。

use std::sync::Arc;

use axum::extract::{State, rejection::JsonRejection};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use schemars::JsonSchema;
use serde::Deserialize;
use serde_json::{Map, Value, json};

use crate::birth::{BirthRequest, Calendar, LeapKind};
use crate::chart::ChartView;
use crate::error::Error;
use crate::http::{Envelope, error_response};
use crate::lookup::{LookupEntry, LookupKind};
use crate::service::{App, ChartRequest, LookupRequest};

/// Actions 的公网地址，用于生成可导入的 OpenAPI。
#[derive(Clone)]
pub struct ActionsConfig {
    public_url: String,
}

impl ActionsConfig {
    /// 校验公网 HTTPS 根地址。
    pub fn new(public_url: &str) -> anyhow::Result<Self> {
        let url = reqwest::Url::parse(public_url)?;
        anyhow::ensure!(
            url.scheme() == "https"
                && url.host_str().is_some()
                && url.username().is_empty()
                && url.password().is_none()
                && url.query().is_none()
                && url.fragment().is_none()
                && url.path() == "/"
                && url.port_or_known_default() == Some(443),
            "Actions public URL must be an HTTPS origin on port 443"
        );
        Ok(Self {
            public_url: url.as_str().trim_end_matches('/').to_string(),
        })
    }
}

/// 排盘请求；出生信息与运限目标分别建模，目标时辰不能从出生时辰推断。
#[derive(Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
struct ChartAction {
    /// 出生日期、历法、时辰、性别；clock 与 time_index 至少提供一个。
    birth: ActionBirth,
    /// 省略只返回本命盘；提供时必须同时给出公历日期与目标时辰。
    target: Option<HoroscopeTarget>,
}

/// Actions 的出生参数；拒绝未知字段，避免闰月或时辰拼写错误被忽略。
#[derive(Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
struct ActionBirth {
    /// solar 公历或 lunar 农历；省略为公历。
    #[serde(default)]
    calendar: Calendar,
    /// 出生日期 YYYY-M-D，不含钟点。
    date: String,
    /// 时辰 0–12；与 clock 至少填一个，同时填必须一致。
    #[serde(default)]
    #[schemars(range(min = 0, max = 12))]
    time_index: Option<u8>,
    /// HH:MM，23 点为晚子 12，0 点为早子 0。
    #[serde(default)]
    clock: Option<String>,
    /// male/female，也接受男/女。
    gender: String,
    /// 农历闰月处理；公历必须省略或 not_leap。
    #[serde(default)]
    leap: LeapKind,
    /// 公历排盘的农历换算 fixLeap，默认 true。
    #[serde(default = "crate::birth::default_true")]
    fix_leap: bool,
    /// 输出语言，默认 zh-CN；释义文本仍使用默认包语言。
    #[serde(default = "crate::birth::default_language")]
    language: String,
}

impl From<ActionBirth> for BirthRequest {
    fn from(b: ActionBirth) -> Self {
        Self {
            calendar: b.calendar,
            date: b.date,
            time_index: b.time_index,
            clock: b.clock,
            gender: b.gender,
            leap: b.leap,
            fix_leap: b.fix_leap,
            language: b.language,
        }
    }
}

/// 明确的运限目标；不读取系统时间。
#[derive(Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
struct HoroscopeTarget {
    /// 公历日期 YYYY-M-D，不含钟点；日期与时辰分别传入。
    date: String,
    /// 目标时辰 0–12，0 早子、12 晚子；不是出生时辰。
    #[schemars(range(min = 0, max = 12))]
    time_index: u8,
}

/// 仅查询内嵌默认包，Actions 不接受文件路径或远程包地址。
#[derive(Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
struct LookupAction {
    /// star / pattern / palace / mutagen / concept。
    kind: LookupKind,
    /// 语言无关标识，必须来自排盘结果或已知知识目录，不按译名猜测。
    key: String,
}

#[derive(Clone)]
struct ActionState {
    app: App,
    config: ActionsConfig,
}

/// 注册两项只读操作和公开的 OpenAPI 文档；调用仍受外层限流与请求大小限制。
pub(crate) fn router(app: App, config: &ActionsConfig) -> Router {
    let state = Arc::new(ActionState {
        app,
        config: config.clone(),
    });
    Router::new()
        .route("/chart", post(chart))
        .route("/lookup", post(lookup))
        .route("/openapi.json", get(schema))
        .with_state(state)
}

async fn chart(
    State(state): State<Arc<ActionState>>,
    input: Result<Json<ChartAction>, JsonRejection>,
) -> Response {
    let Json(input) = match input {
        Ok(input) => input,
        Err(err) => return error_response(Error::invalid_argument(err.body_text())),
    };
    if input.birth.date.chars().any(char::is_whitespace)
        || input
            .target
            .as_ref()
            .is_some_and(|t| t.date.chars().any(char::is_whitespace))
    {
        return error_response(Error::invalid_argument(
            "date must not contain a clock or whitespace",
        ));
    }
    if matches!(input.birth.calendar, crate::birth::Calendar::Solar)
        && input.birth.leap != crate::birth::LeapKind::NotLeap
    {
        return error_response(Error::invalid_argument(
            "leap applies only to lunar birth dates",
        ));
    }
    let (target_date, target_time_index) = match input.target {
        Some(target) => {
            if target.date.is_empty() {
                return error_response(Error::invalid_argument("target.date must not be empty"));
            }
            (Some(target.date), Some(target.time_index))
        }
        None => (None, None),
    };
    match state
        .app
        .chart(ChartRequest {
            birth: input.birth.into(),
            target_date,
            target_time_index,
            target_clock: None,
        })
        .await
    {
        Ok(data) => Json(Envelope::ok(data)).into_response(),
        Err(err) => error_response(err),
    }
}

async fn lookup(
    State(state): State<Arc<ActionState>>,
    input: Result<Json<LookupAction>, JsonRejection>,
) -> Response {
    let Json(input) = match input {
        Ok(input) => input,
        Err(err) => return error_response(Error::invalid_argument(err.body_text())),
    };
    match state
        .app
        .lookup(LookupRequest {
            kind: input.kind,
            key: input.key,
            pack: None,
        })
        .await
    {
        Ok(data) => Json(Envelope::ok(data)).into_response(),
        Err(err) => error_response(err),
    }
}

async fn schema(State(state): State<Arc<ActionState>>) -> Json<Value> {
    Json(openapi(&state.config.public_url))
}

/// 从实际 Rust 请求和响应类型生成 OpenAPI 3.1，组件引用使用文档根路径。
fn add_schema<T: JsonSchema>(schemas: &mut Map<String, Value>, name: &str) {
    let mut schema =
        serde_json::to_value(schemars::schema_for!(T)).expect("JSON Schema must serialize");
    if let Some(Value::Object(defs)) = schema
        .as_object_mut()
        .expect("schema is object")
        .remove("$defs")
    {
        schemas.extend(defs);
    }
    schema
        .as_object_mut()
        .expect("schema is object")
        .remove("$schema");
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

fn openapi(public_url: &str) -> Value {
    let mut schemas = Map::new();
    add_schema::<ChartAction>(&mut schemas, "ChartRequest");
    add_schema::<LookupAction>(&mut schemas, "LookupRequest");
    add_schema::<Envelope<ChartView>>(&mut schemas, "ChartResponse");
    add_schema::<Envelope<LookupEntry>>(&mut schemas, "LookupResponse");
    add_schema::<Envelope<()>>(&mut schemas, "ErrorResponse");
    let mut paths = Map::new();
    for (path, operation, summary, request, response) in [
        (
            "/actions/chart",
            "ziwei_chart",
            "排本命盘，可选明确日期和时辰的运限；仅返回事实，不生成解盘结论。",
            "ChartRequest",
            "ChartResponse",
        ),
        (
            "/actions/lookup",
            "ziwei_lookup",
            "按语言无关标识查询默认知识包原文和来源；不替用户选择解盘方法。",
            "LookupRequest",
            "LookupResponse",
        ),
    ] {
        let content = |name: &str| json!({"application/json":{"schema":{"$ref":format!("#/components/schemas/{name}")}}});
        let mut responses = Map::new();
        responses.insert(
            "200".into(),
            json!({"description":"成功，data 为计算或查询结果。","content":content(response)}),
        );
        for (status, description) in [
            ("400", "参数非法或知识条目不存在"),
            ("429", "限流，请稍后重试"),
            ("500", "内部错误"),
            ("503", "知识包不可用"),
        ] {
            responses.insert(
                status.into(),
                json!({"description":description,"content":content("ErrorResponse")}),
            );
        }
        paths.insert(path.into(),json!({"post":{"operationId":operation,"summary":summary,"x-openai-isConsequential":false,"requestBody":{"required":true,"content":content(request)},"responses":responses}}));
    }
    let mut document = json!({"openapi":"3.1.0","info":{"title":"x-ziwei","version":env!("CARGO_PKG_VERSION"),"description":"紫微斗数排盘、运限与知识查询。计算来自 x-iztro；知识文本有来源，不代表唯一解盘方法。"},"servers":[{"url":public_url}],"security":[],"paths":paths,"components":{"schemas":schemas}});
    component_refs(&mut document);
    document
}
