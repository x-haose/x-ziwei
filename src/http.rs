//! HTTP surface: `/` landing page, `GET /healthz`, Streamable HTTP `POST /mcp`.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::body::Body;
use axum::extract::State;
use axum::http::{header, HeaderMap, HeaderValue, Request, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Router;

use crate::error::ApiError;
use crate::mcp::{self, Outcome};

const MAX_BODY: usize = 64 * 1024;

#[derive(Clone)]
pub struct AppState {
    limiter: Arc<RateLimiter>,
}

impl AppState {
    pub fn new(limit: u32, window: Duration) -> Self {
        Self {
            limiter: Arc::new(RateLimiter::new(limit, window)),
        }
    }

    pub fn from_env() -> Self {
        let limit = env_u32("X_ZIWEI_RATE_LIMIT", 60);
        let window_secs = env_u32("X_ZIWEI_RATE_WINDOW_SECS", 60).max(1);
        Self::new(limit, Duration::from_secs(u64::from(window_secs)))
    }
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/", get(index))
        .route("/healthz", get(healthz))
        .route(
            "/mcp",
            post(mcp).get(method_not_allowed).delete(method_not_allowed),
        )
        .layer(middleware::from_fn(cors))
        .with_state(state)
}

pub async fn serve() {
    let state = AppState::from_env();
    let app = router(state);
    let addr = bind_addr();
    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(listener) => listener,
        Err(err) => {
            eprintln!("failed to bind {addr}: {err}");
            std::process::exit(1);
        }
    };
    println!("x-ziwei listening on http://{addr}");
    if let Err(err) = axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(async {
        let _ = tokio::signal::ctrl_c().await;
    })
    .await
    {
        eprintln!("server error: {err}");
        std::process::exit(1);
    }
}

fn bind_addr() -> String {
    if let Ok(bind) = std::env::var("BIND") {
        let bind = bind.trim();
        if !bind.is_empty() {
            return bind.to_string();
        }
    }
    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    format!("0.0.0.0:{port}")
}

fn env_u32(name: &str, default: u32) -> u32 {
    match std::env::var(name) {
        Ok(value) => value.trim().parse().unwrap_or(default),
        Err(_) => default,
    }
}

async fn index() -> Response {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .body(Body::from(include_str!("../static/index.html")))
        .expect("index response")
}

async fn healthz() -> Response {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .body(Body::from("ok\n"))
        .expect("health response")
}

async fn method_not_allowed() -> Response {
    let error = ApiError::bad_request("use POST for Streamable HTTP");
    let mut response = bare(StatusCode::METHOD_NOT_ALLOWED, &error);
    response
        .headers_mut()
        .insert(header::ALLOW, HeaderValue::from_static("POST"));
    response
}

async fn mcp(State(state): State<AppState>, request: Request<Body>) -> Response {
    let peer = request
        .extensions()
        .get::<axum::extract::ConnectInfo<SocketAddr>>()
        .map(|info| info.0);
    let key = client_key(request.headers(), peer);
    if let Err(error) = state.limiter.check(&key) {
        let mut response = bare(StatusCode::TOO_MANY_REQUESTS, &error);
        if let Ok(value) = HeaderValue::from_str(&state.limiter.retry_after_secs().to_string()) {
            response.headers_mut().insert(header::RETRY_AFTER, value);
        }
        return response;
    }

    let headers = request.headers().clone();
    let bytes = match axum::body::to_bytes(request.into_body(), MAX_BODY).await {
        Ok(bytes) => bytes,
        Err(_) => {
            return bare(
                StatusCode::PAYLOAD_TOO_LARGE,
                &ApiError::bad_request("request body exceeds 65536 bytes"),
            );
        }
    };

    match mcp::handle(&headers, &bytes) {
        Outcome::Accepted => Response::builder()
            .status(StatusCode::ACCEPTED)
            .body(Body::empty())
            .expect("accepted response"),
        Outcome::Rpc { body, sse } => {
            if sse {
                let data = serde_json::to_string(&body).unwrap_or_else(|_| "{}".to_string());
                Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, "text/event-stream; charset=utf-8")
                    .header(header::CACHE_CONTROL, "no-cache")
                    .body(Body::from(format!("event: message\ndata: {data}\n\n")))
                    .expect("sse response")
            } else {
                json_response(StatusCode::OK, &body)
            }
        }
        Outcome::Bare { status, error } => bare(status, &error),
    }
}

async fn cors(request: Request<Body>, next: Next) -> Response {
    if request.method() == axum::http::Method::OPTIONS {
        return cors_headers(StatusCode::NO_CONTENT.into_response());
    }
    cors_headers(next.run(request).await)
}

fn cors_headers(mut response: Response) -> Response {
    let headers = response.headers_mut();
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        HeaderValue::from_static("*"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, DELETE, OPTIONS"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static(
            "content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id",
        ),
    );
    response
}

fn bare(status: StatusCode, error: &ApiError) -> Response {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "application/json; charset=utf-8")
        .body(Body::from(error.json_bytes()))
        .expect("error response")
}

fn json_response(status: StatusCode, body: &serde_json::Value) -> Response {
    let bytes = serde_json::to_vec(body).unwrap_or_else(|_| b"{}".to_vec());
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "application/json; charset=utf-8")
        .body(Body::from(bytes))
        .expect("json response")
}

fn client_key(headers: &HeaderMap, peer: Option<SocketAddr>) -> String {
    if let Some(forwarded) = headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
    {
        let first = forwarded.split(',').next().unwrap_or("").trim();
        if !first.is_empty() {
            return first.to_string();
        }
    }
    peer.map(|addr| addr.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

struct Window {
    start: Instant,
    count: u32,
}

struct RateLimiter {
    inner: Mutex<HashMap<String, Window>>,
    limit: u32,
    window: Duration,
}

impl RateLimiter {
    fn new(limit: u32, window: Duration) -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
            limit,
            window,
        }
    }

    fn retry_after_secs(&self) -> u64 {
        self.window.as_secs().max(1)
    }

    /// `limit == 0` disables the limiter.
    fn check(&self, key: &str) -> Result<(), ApiError> {
        if self.limit == 0 {
            return Ok(());
        }
        let mut map = self.inner.lock().unwrap_or_else(|err| err.into_inner());
        let now = Instant::now();
        if map.len() > 10_000 {
            let window = self.window;
            map.retain(|_, entry| now.duration_since(entry.start) < window);
        }
        let entry = map.entry(key.to_string()).or_insert(Window {
            start: now,
            count: 0,
        });
        if now.duration_since(entry.start) >= self.window {
            entry.start = now;
            entry.count = 0;
        }
        if entry.count >= self.limit {
            return Err(ApiError::rate_limited("rate limit exceeded"));
        }
        entry.count += 1;
        Ok(())
    }
}
