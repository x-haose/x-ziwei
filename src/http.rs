//! Streamable HTTP（`/mcp`）与 JSON 接口（`/v1/*`）。两者调用同一份服务层；限流按对端 IP，把打满变成 429。

use std::net::{IpAddr, SocketAddr};
use std::num::NonZeroU32;
use std::sync::Arc;

use axum::extract::rejection::JsonRejection;
use axum::extract::{ConnectInfo, DefaultBodyLimit, Request, State};
use axum::http::{HeaderMap, HeaderName, StatusCode};
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
use crate::openapi::{self, PublicUrl};
use crate::service::{
    App, CatalogRequest, ChartRequest, HoroscopeRequest, LookupRequest, TopicRequest,
};

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
    /// 带客户端地址的请求头，如 Cloudflare 的 `cf-connecting-ip`、Traefik 与 nginx 的 `x-real-ip`；
    /// 给出后其值作为限流键。只有前面的代理一定会覆盖该头时才能设置，否则客户端可以伪造限流地址。
    /// `None` 或请求里没有该头时用对端地址。
    pub client_ip_header: Option<HeaderName>,
    /// `None` 关闭限流（stdio 不走这里；测试可关）。
    pub rate_limit: Option<RateLimit>,
    /// MCP `Host` 白名单。空列表表示不检查 Host（公网默认）；生产应填公网域名。
    pub allowed_hosts: Vec<String>,
    /// 对外的 HTTPS 根地址；给出后在 `/v1/openapi.json` 提供 OpenAPI 文档，`None` 不注册该路由。
    pub public_url: Option<PublicUrl>,
    /// OpenAI 插件门户发放的域名校验口令；给出后 `/.well-known/openai-apps-challenge` 以纯文本原样返回它，`None` 不注册该路由。
    pub openai_apps_challenge: Option<String>,
}

/// JSON 接口的统一信封。
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
    fn ok(data: T) -> Self {
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
    client_ip_header: Option<HeaderName>,
}

type KeyedLimiter =
    RateLimiter<IpAddr, governor::state::keyed::DefaultKeyedStateStore<IpAddr>, DefaultClock>;

/// 构造 axum 路由：`/mcp`、`/v1/*`、`/healthz`。全部路由允许任意来源跨域访问，不使用 Cookie。
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
        client_ip_header: config.client_ip_header.clone(),
    });

    let mut routes = Router::new()
        .route("/healthz", get(healthz))
        .route("/v1/chart", post(v1_chart))
        .route("/v1/horoscope", post(v1_horoscope))
        .route("/v1/topic", post(v1_topic))
        .route("/v1/lookup", post(v1_lookup))
        .route("/v1/catalog", post(v1_catalog))
        .nest_service("/mcp", service);
    if let Some(public_url) = &config.public_url {
        let document = openapi::document(public_url);
        routes = routes.route(
            "/v1/openapi.json",
            get(move || std::future::ready(Json(document.clone()))),
        );
    }
    if let Some(token) = config.openai_apps_challenge.clone() {
        routes = routes.route(
            "/.well-known/openai-apps-challenge",
            get(move || std::future::ready(token.clone())),
        );
    }
    routes
        .with_state(Arc::clone(&state))
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

/// 请求体解析失败（非 JSON、类型不符、未知字段）与服务层错误都落到同一个错误信封。
async fn respond<Req, Res, Fut>(
    input: Result<Json<Req>, JsonRejection>,
    call: impl FnOnce(Req) -> Fut,
) -> Response
where
    Res: Serialize,
    Fut: Future<Output = Result<Res, Error>>,
{
    let Json(req) = match input {
        Ok(input) => input,
        Err(rejection) => return error_response(Error::invalid_argument(rejection.body_text())),
    };
    match call(req).await {
        Ok(data) => Json(Envelope::ok(data)).into_response(),
        Err(err) => error_response(err),
    }
}

async fn v1_chart(
    State(state): State<Arc<HttpState>>,
    input: Result<Json<ChartRequest>, JsonRejection>,
) -> Response {
    respond(input, |req| state.app.chart(req)).await
}

async fn v1_horoscope(
    State(state): State<Arc<HttpState>>,
    input: Result<Json<HoroscopeRequest>, JsonRejection>,
) -> Response {
    respond(input, |req| state.app.horoscope(req)).await
}

async fn v1_topic(
    State(state): State<Arc<HttpState>>,
    input: Result<Json<TopicRequest>, JsonRejection>,
) -> Response {
    respond(input, |req| state.app.topic(req)).await
}

async fn v1_lookup(
    State(state): State<Arc<HttpState>>,
    input: Result<Json<LookupRequest>, JsonRejection>,
) -> Response {
    respond(input, |req| state.app.lookup(req)).await
}

async fn v1_catalog(
    State(state): State<Arc<HttpState>>,
    input: Result<Json<CatalogRequest>, JsonRejection>,
) -> Response {
    respond(input, |req| state.app.catalog(req)).await
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
        let Some(ip) = client_ip(
            state.client_ip_header.as_ref(),
            request.headers(),
            request.extensions(),
        ) else {
            return error_response(Error::internal("peer address missing from connection"));
        };
        if limiter.check_key(&ip).is_err() {
            return error_response(Error::new(ErrorCode::RateLimited, "rate limit exceeded"));
        }
    }
    next.run(request).await
}

/// 限流键：配置了客户端地址头且请求带着合法取值时用它，否则用对端地址。
/// 取不到对端地址说明监听没有带连接信息启动，属于本进程的装配错误，不拿一个共用地址顶替。
fn client_ip(
    header: Option<&HeaderName>,
    headers: &HeaderMap,
    extensions: &http::Extensions,
) -> Option<IpAddr> {
    let from_header = header
        .and_then(|name| headers.get(name))
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.trim().parse().ok());
    from_header.or_else(|| {
        extensions
            .get::<ConnectInfo<SocketAddr>>()
            .map(|ConnectInfo(addr)| addr.ip())
    })
}

fn error_response(err: Error) -> Response {
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

    #[test]
    fn rate_limit_key_prefers_the_configured_header() {
        let name = HeaderName::from_static("cf-connecting-ip");
        let peer: SocketAddr = "10.0.0.2:4000".parse().unwrap();
        let mut extensions = http::Extensions::new();
        extensions.insert(ConnectInfo(peer));
        let mut headers = HeaderMap::new();

        assert_eq!(
            client_ip(Some(&name), &headers, &extensions),
            Some(peer.ip())
        );
        headers.insert(&name, "not-an-ip".parse().unwrap());
        assert_eq!(
            client_ip(Some(&name), &headers, &extensions),
            Some(peer.ip())
        );
        headers.insert(&name, "2001:db8::7".parse().unwrap());
        assert_eq!(
            client_ip(Some(&name), &headers, &extensions),
            Some("2001:db8::7".parse().unwrap())
        );
        assert_eq!(client_ip(None, &headers, &extensions), Some(peer.ip()));
        assert_eq!(
            client_ip(Some(&name), &headers, &http::Extensions::new()),
            Some("2001:db8::7".parse().unwrap())
        );
        assert_eq!(
            client_ip(None, &HeaderMap::new(), &http::Extensions::new()),
            None
        );
    }
}
