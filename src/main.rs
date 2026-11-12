//! x-ziwei 入口：`serve` 为公网 Streamable HTTP，`stdio` 为本机 MCP。

use std::net::SocketAddr;
use std::num::NonZeroU32;
use std::path::PathBuf;
use std::sync::Arc;

use clap::{Parser, Subcommand};
use tokio_util::sync::CancellationToken;
use tracing_subscriber::EnvFilter;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use x_ziwei::http::{self, HttpConfig, RateLimit};
use x_ziwei::mcp::ZiweiMcp;
use x_ziwei::pack::{PackPolicy, PackStore};
use x_ziwei::service::App;

/// 命令行。
#[derive(Parser)]
#[command(name = "x-ziwei", version, about = "Zi Wei Dou Shu MCP / HTTP service")]
struct Cli {
    /// 子命令。
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Streamable HTTP（`/mcp`）+ JSON 接口（`/v1/*`）。
    Serve {
        /// 监听地址。
        #[arg(long, default_value = "0.0.0.0:8080")]
        listen: SocketAddr,
        /// 信任 `X-Forwarded-For` / `X-Real-IP` 作为限流键。只在可信反代后打开。
        #[arg(long, default_value_t = false)]
        trust_proxy: bool,
        /// 每 IP 每秒补充令牌数。
        #[arg(long, default_value_t = 10)]
        rate_per_second: u32,
        /// 每 IP 突发上限。
        #[arg(long, default_value_t = 30)]
        rate_burst: u32,
        /// MCP 允许的 `Host`（可重复，如 `ziwei.x-haose.com`）。省略则不检查 Host，便于公网反代。
        #[arg(long = "allowed-host")]
        allowed_host: Vec<String>,
        /// 对外的 HTTPS 根地址（如 `https://ziwei.example.com`）；设置后在 `/v1/openapi.json` 提供 OpenAPI 文档。
        #[arg(long, env = "X_ZIWEI_PUBLIC_URL")]
        public_url: Option<String>,
        /// OpenAI 插件门户发放的域名校验口令；设置后 `/.well-known/openai-apps-challenge` 原样返回它。
        #[arg(long, env = "X_ZIWEI_OPENAI_APPS_CHALLENGE")]
        openai_apps_challenge: Option<String>,
        /// 知识包白名单。
        #[command(flatten)]
        packs: PackArgs,
    },
    /// 本机 stdio MCP。日志只写 stderr。
    Stdio {
        /// 知识包白名单。
        #[command(flatten)]
        packs: PackArgs,
    },
}

/// 知识包加载范围。公网默认只有内嵌包。
#[derive(clap::Args, Clone)]
struct PackArgs {
    /// 允许从该目录读取本地知识包（可重复）。包参数写作 `file:相对或绝对路径`。
    #[arg(long = "allow-pack-dir")]
    allow_pack_dir: Vec<PathBuf>,
    /// 允许拉取的知识包 URL（可重复，精确匹配）。
    #[arg(long = "allow-pack-url")]
    allow_pack_url: Vec<String>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Command::Serve {
            listen,
            trust_proxy,
            rate_per_second,
            rate_burst,
            allowed_host,
            public_url,
            openai_apps_challenge,
            packs,
        } => {
            init_tracing(false);
            let app = build_app(packs)?;
            let per_second = NonZeroU32::new(rate_per_second)
                .ok_or_else(|| anyhow::anyhow!("rate-per-second must be >= 1"))?;
            let burst = NonZeroU32::new(rate_burst)
                .ok_or_else(|| anyhow::anyhow!("rate-burst must be >= 1"))?;
            let cancel = shutdown_token()?;
            let config = HttpConfig {
                listen,
                trust_proxy,
                rate_limit: Some(RateLimit { per_second, burst }),
                allowed_hosts: allowed_host,
                public_url: public_url
                    .as_deref()
                    .map(x_ziwei::openapi::PublicUrl::new)
                    .transpose()?,
                openai_apps_challenge,
            };
            http::serve(app, config, cancel).await?;
        }
        Command::Stdio { packs } => {
            init_tracing(true);
            let app = build_app(packs)?;
            let server = ZiweiMcp::new(app);
            let io = (tokio::io::stdin(), tokio::io::stdout());
            rmcp::serve_server(server, io).await?;
        }
    }
    Ok(())
}

fn build_app(packs: PackArgs) -> anyhow::Result<App> {
    let policy = PackPolicy {
        allow_dirs: packs.allow_pack_dir,
        allow_urls: packs.allow_pack_url,
    };
    let store = PackStore::new(policy)?;
    Ok(App {
        packs: Arc::new(store),
    })
}

fn init_tracing(stdio: bool) {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let registry = tracing_subscriber::registry().with(filter);
    if stdio {
        registry
            .with(
                tracing_subscriber::fmt::layer()
                    .with_writer(std::io::stderr)
                    .with_target(false),
            )
            .init();
    } else {
        registry
            .with(
                tracing_subscriber::fmt::layer()
                    .json()
                    .with_writer(std::io::stderr)
                    .flatten_event(true),
            )
            .init();
    }
}

/// 收到 SIGINT 或 SIGTERM 时取消；容器编排用 SIGTERM 停服务。
fn shutdown_token() -> anyhow::Result<CancellationToken> {
    use tokio::signal::unix::{SignalKind, signal};
    let mut interrupt = signal(SignalKind::interrupt())?;
    let mut terminate = signal(SignalKind::terminate())?;
    let token = CancellationToken::new();
    let child = token.clone();
    tokio::spawn(async move {
        tokio::select! {
            _ = interrupt.recv() => {}
            _ = terminate.recv() => {}
        }
        child.cancel();
    });
    Ok(token)
}
