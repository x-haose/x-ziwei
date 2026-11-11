//! Streamable HTTP（`/mcp`）与可选 JSON 门（`/v1/*`）。限流按对端 IP，把打满变成 429。

use std::net::{IpAddr, SocketAddr};
use std::num::NonZeroU32;
use std::sync::Arc;

use axum::extract::{ConnectInfo, DefaultBodyLimit, Request, State};
use axum::http::{HeaderMap, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use governor::clock::DefaultClock;
use governor::{Quota, RateLimiter};
use rmcp::transport::streamable_http_server::session::local::LocalSessionManager;
use rmcp::transport::streamable_http_server::{StreamableHttpServerConfig, StreamableHttpService};
use serde::Serialize;
use tokio_util::sync::CancellationToken;
use tower_http::cors::CorsLayer;

use crate::error::{Error, ErrorCode};
use crate::mcp::ZiweiMcp;
use crate::service::{App, ChartRequest, LookupRequest, ReadRequest};

/// 每 IP 令牌桶。`per_second` 为补充速率，`burst` 为桶深。
#[derive(Debug, Clone, Copy)]
pub struct RateLimit {
    /// 每秒补充的令牌数。
    pub per_second: NonZeroU32,
    /// 突发上限。
    pub burst: NonZeroU32,
}

impl RateLimit {
    /// 正常人问询无感、单地址打满会被挡住。10/s、桶深 30。
    pub fn default_public() -> Self {
        Self {
            per_second: NonZeroU32::new(10).expect("10 is non-zero"),
            burst: NonZeroU32::new(30).expect("30 is non-zero"),
        }
    }
}

/// HTTP 服务配置。
#[derive(Clone)]
pub struct HttpConfig {
    /// 监听地址。
    pub listen: SocketAddr,
    /// 为 `true` 时用 `X-Forwarded-For` **最右边**一跳作为限流键（须在会覆盖该头的可信反代之后）。
    pub trust_proxy: bool,
    /// `None` 关闭限流（stdio 不走这里；测试可关）。
    pub rate_limit: Option<RateLimit>,
    /// MCP `Host` 白名单。空列表表示不检查 Host（公网默认）；生产应填公网域名。
    pub allowed_hosts: Vec<String>,
    /// 配置公网地址后开放 GPT Actions；None 不注册对应路由。
    pub actions: Option<crate::actions::ActionsConfig>,
}

/// JSON 门的统一信封。失败时没有 `data`。
#[derive(Debug, Serialize, schemars::JsonSchema)]
pub struct Envelope<T: Serialize> {
    /// 是否成功。
    pub ok: bool,
    /// 成功时的载荷；失败时为 `null`，不会缺这个键。
    pub data: Option<T>,
    /// 失败时的错误。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ErrorBody>,
}

/// 对外错误体。
#[derive(Debug, Serialize, schemars::JsonSchema)]
pub struct ErrorBody {
    /// 机器可读分类。
    pub code: &'static str,
    /// 给人看的说明。
    pub message: String,
    /// 出站依赖故障为 `true`。
    pub retryable: bool,
}

impl<T: Serialize> Envelope<T> {
    pub(crate) fn ok(data: T) -> Self {
        Self {
            ok: true,
            data: Some(data),
            error: None,
        }
    }

    fn err(err: &Error) -> Envelope<()> {
        Envelope {
            ok: false,
            data: None,
            error: Some(ErrorBody {
                code: err.code.as_str(),
                message: err.message.clone(),
                retryable: err.code.retryable(),
            }),
        }
    }
}

/// axum 共享状态：编排层 + 可选每 IP 限流。
struct HttpState {
    app: App,
    ip_limiter: Option<Arc<KeyedLimiter>>,
    trust_proxy: bool,
}

type KeyedLimiter =
    RateLimiter<IpAddr, governor::state::keyed::DefaultKeyedStateStore<IpAddr>, DefaultClock>;

/// 构造 axum 路由：`/mcp`、`/v1/*`、`/healthz`。返回已注入状态的 `Router<()>`。
pub fn router(app: App, config: &HttpConfig, cancel: CancellationToken) -> Router {
    let mcp = ZiweiMcp::new(app.clone());
    let mut mcp_config = StreamableHttpServerConfig::default()
        .with_legacy_session_mode(false)
        .with_json_response(true)
        .with_cancellation_token(cancel.child_token())
        .with_max_request_body_bytes(64 * 1024);
    mcp_config = if config.allowed_hosts.is_empty() {
        mcp_config.disable_allowed_hosts()
    } else {
        mcp_config.with_allowed_hosts(config.allowed_hosts.clone())
    };
    let service = StreamableHttpService::new(
        move || Ok(mcp.clone()),
        LocalSessionManager::default().into(),
        mcp_config,
    );

    let ip_limiter = config.rate_limit.map(|rl| {
        let quota = Quota::per_second(rl.per_second).allow_burst(rl.burst);
        Arc::new(RateLimiter::keyed(quota))
    });
    if let Some(limiter) = ip_limiter.clone() {
        let stop = cancel.clone();
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(std::time::Duration::from_secs(60));
            loop {
                tokio::select! {
                    _ = stop.cancelled() => break,
                    _ = tick.tick() => {
                        limiter.retain_recent();
                        limiter.shrink_to_fit();
                    }
                }
            }
        });
    }

    let state = Arc::new(HttpState {
        app,
        ip_limiter,
        trust_proxy: config.trust_proxy,
    });

    let routes = Router::new()
        .route("/healthz", get(healthz))
        .route("/v1/chart", post(v1_chart))
        .route("/v1/read", post(v1_read))
        .route("/v1/lookup", post(v1_lookup))
        .nest_service("/mcp", service)
        .with_state(Arc::clone(&state));
    let routes = match &config.actions {
        Some(actions) => routes.nest(
            "/actions",
            crate::actions::router(state.app.clone(), actions),
        ),
        None => routes,
    };
    routes
        .layer(middleware::from_fn_with_state(
            Arc::clone(&state),
            rate_limit_mw,
        ))
        .layer(DefaultBodyLimit::max(64 * 1024))
        .layer(CorsLayer::permissive())
}

async fn healthz() -> impl IntoResponse {
    Json(serde_json::json!({ "ok": true }))
}

async fn v1_chart(State(state): State<Arc<HttpState>>, Json(req): Json<ChartRequest>) -> Response {
    match state.app.chart(req).await {
        Ok(data) => (StatusCode::OK, Json(Envelope::ok(data))).into_response(),
        Err(err) => error_response(err),
    }
}

async fn v1_read(State(state): State<Arc<HttpState>>, Json(req): Json<ReadRequest>) -> Response {
    match state.app.read(req).await {
        Ok(data) => (StatusCode::OK, Json(Envelope::ok(data))).into_response(),
        Err(err) => error_response(err),
    }
}

async fn v1_lookup(
    State(state): State<Arc<HttpState>>,
    Json(req): Json<LookupRequest>,
) -> Response {
    match state.app.lookup(req).await {
        Ok(data) => (StatusCode::OK, Json(Envelope::ok(data))).into_response(),
        Err(err) => error_response(err),
    }
}

async fn rate_limit_mw(
    State(state): State<Arc<HttpState>>,
    request: Request,
    next: Next,
) -> Response {
    if request.uri().path() == "/healthz" {
        return next.run(request).await;
    }
    if let Some(limiter) = state.ip_limiter.as_ref() {
        let ip = client_ip(state.trust_proxy, request.headers(), request.extensions());
        if limiter.check_key(&ip).is_err() {
            let err = Error::new(ErrorCode::RateLimited, "rate limit exceeded");
            return (
                StatusCode::TOO_MANY_REQUESTS,
                Json(Envelope::<()>::err(&err)),
            )
                .into_response();
        }
    }
    next.run(request).await
}

fn client_ip(trust_proxy: bool, headers: &HeaderMap, extensions: &http::Extensions) -> IpAddr {
    if trust_proxy && let Some(ip) = forwarded_ip(headers) {
        return ip;
    }
    extensions
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(addr)| addr.ip())
        .unwrap_or(IpAddr::from([0, 0, 0, 0]))
}

fn forwarded_ip(headers: &HeaderMap) -> Option<IpAddr> {
    let value = headers.get("x-forwarded-for")?.to_str().ok()?;
    value
        .split(',')
        .map(str::trim)
        .rfind(|s| !s.is_empty())
        .and_then(|s| s.parse().ok())
}

pub(crate) fn error_response(err: Error) -> Response {
    let status = match err.code {
        ErrorCode::PackUnavailable => StatusCode::SERVICE_UNAVAILABLE,
        ErrorCode::RateLimited => StatusCode::TOO_MANY_REQUESTS,
        ErrorCode::Internal => StatusCode::INTERNAL_SERVER_ERROR,
        _ => StatusCode::BAD_REQUEST,
    };
    (status, Json(Envelope::<()>::err(&err))).into_response()
}

/// 在 `listen` 上启动 HTTP，直到取消。
pub async fn serve(app: App, config: HttpConfig, cancel: CancellationToken) -> anyhow::Result<()> {
    let listener = tokio::net::TcpListener::bind(config.listen).await?;
    tracing::info!(listen = %config.listen, "http listening");
    let app = router(app, &config, cancel.child_token())
        .into_make_service_with_connect_info::<SocketAddr>();
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            cancel.cancelled().await;
        })
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pack::{PackPolicy, PackStore};
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    fn test_app() -> App {
        App {
            packs: Arc::new(PackStore::new(PackPolicy::default()).unwrap()),
        }
    }

    fn test_router() -> Router {
        router(
            test_app(),
            &HttpConfig {
                listen: "127.0.0.1:0".parse().unwrap(),
                trust_proxy: false,
                rate_limit: None,
                allowed_hosts: Vec::new(),
                actions: None,
            },
            CancellationToken::new(),
        )
    }

    #[test]
    fn forwarded_ip_uses_rightmost_hop() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-forwarded-for",
            "1.0.0.1, 10.0.0.2, 192.0.2.8".parse().unwrap(),
        );
        assert_eq!(
            forwarded_ip(&headers).unwrap(),
            "192.0.2.8".parse::<IpAddr>().unwrap()
        );
    }

    #[tokio::test]
    async fn healthz_ok() {
        let resp = test_router()
            .oneshot(
                Request::builder()
                    .uri("/healthz")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn lookup_ziwei_via_json() {
        let resp = test_router()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/lookup")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"kind":"star","key":"ziweiMaj"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(v["ok"], true);
        assert_eq!(v["data"]["key"], "ziweiMaj");
        assert!(v["data"]["text"].as_str().unwrap().len() > 8);
    }

    #[tokio::test]
    async fn read_wealth_via_json() {
        let body = serde_json::json!({
            "date": "2000-8-16",
            "time_index": 2,
            "gender": "female",
            "topic": "wealth"
        });
        let resp = test_router()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/read")
                    .header("content-type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(v["ok"], true);
        assert_eq!(v["data"]["topic"], "wealth");
        assert!(v["data"]["quotes"].as_array().unwrap().len() > 3);
        assert!(
            v["data"]["palaces"]
                .as_array()
                .unwrap()
                .iter()
                .any(|p| p["key"] == "wealthPalace")
        );
    }

    #[tokio::test]
    async fn lookup_unknown_is_400() {
        let resp = test_router()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/lookup")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"kind":"star","key":"notAStar"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(v["ok"], false);
        assert_eq!(v["data"], serde_json::Value::Null);
        assert_eq!(v["error"]["code"], "unknown_key");
    }
}
