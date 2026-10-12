# x-ziwei

紫微斗数 MCP / HTTP 服务。排盘由 [x-iztro](https://github.com/x-haose/x-iztro) 完成。

**一期目标**：公网一行 URL 可装；工具只暴露 `chart` / `to_text`；契约可钉；盘与 iztro v2.6.1 金标对齐。

## 安装

公网只有一个 MCP（Streamable HTTP，无鉴权）：

https://ziwei.x-haose.com/mcp

工具只有 `chart` / `to_text`。装好之后用自然语言问紫微排盘或论命；回答前必须先调这两个工具。

### 插件（推荐）

插件把 Skill 和上面的 URL 绑在一起。Skill 要求先排盘再解释，禁止凭记忆编盘。总览见 [`plugin/README.md`](plugin/README.md)。

| 客户端 | 目录 |
|---|---|
| Cursor | [`plugin/cursor`](plugin/cursor/README.md) |
| Claude Code | [`plugin/claude`](plugin/claude/README.md) |

Cursor 的产品安装是官方 Marketplace，或把本 GitHub 仓库做 Team Marketplace 的 Import from Repo（`https://github.com/x-haose/x-ziwei`）。官方 Marketplace 未提交、未上架。仓库根 [`.cursor-plugin/marketplace.json`](.cursor-plugin/marketplace.json) 列出插件 `ziwei`，`source` 为 `plugin/cursor`，供这次导入和以后提交官方市场使用。本地 `cp` 到 `~/.cursor/plugins/local` 只写在「开发者自测」里。

Claude Code 不拷贝目录：`claude plugin install ziwei --marketplace x-haose/x-ziwei`。官方目录未提交；本仓库自托管市场已可用。状态见 [`docs/clients/publish-status.md`](docs/clients/publish-status.md)。

### 连接器

没有插件壳的客户端，用同一 URL。步骤见 [`docs/clients/README.md`](docs/clients/README.md)：ChatGPT、Grok、Codex。

### URL 与自定义说明

没有 Skill 通道时，自己填上面的 URL，并把 [`docs/clients/instructions.md`](docs/clients/instructions.md) 贴进系统提示或自定义说明。中英短模板规则与 Skill 相同。

### 兼容：只填 URL

```json
{
  "mcpServers": {
    "x-ziwei": {
      "url": "https://ziwei.x-haose.com/mcp"
    }
  }
}
```

只填 URL 时没有 Skill。能贴自定义说明就贴上一段。

健康检查：同域 [`/healthz`](https://ziwei.x-haose.com/healthz)。`GET /install` 301 到[文档站 MCP 页](https://ziwei.x-haose.com/zh/docs/guide/mcp)（不是 `GET /`）。

## 本地

需要 Rust 1.88+。`x-iztro` 钉死在 crates.io `0.6.1`。

```bash
cargo run
```

默认监听 `0.0.0.0:8080`。`PORT` 或 `BIND` 可改地址。`POST /mcp` 为 Streamable HTTP；`GET /healthz` 返回 `ok`；`GET /install` 301 到文档站 MCP 页。

限流按客户端 IP（优先 `X-Forwarded-For` 首段）计 `POST /mcp`。默认每 60 秒 60 次，超出 HTTP 429，正文 `{"code":"rate_limited","message":"rate limit exceeded"}`。`X_ZIWEI_RATE_LIMIT=0` 关闭限流。窗口用 `X_ZIWEI_RATE_WINDOW_SECS`。

阳历最短入参（`chart` 与 `to_text` 相同）：

```json
{"calendar":"solar","date":"2000-8-16","timeIndex":2,"gender":"female"}
```

## 契约（已冻）

| 文件 | 内容 |
|---|---|
| [`contracts/mcp-tools.schema.json`](contracts/mcp-tools.schema.json) | `chart` / `to_text` 入参出参 |
| [`contracts/error-codes.json`](contracts/error-codes.json) | 引擎四码 + `rate_limited` / `bad_request` |

门禁只 diff 稳定键与六码；译名字段不进 diff。可选薄 `config` 六开关；自定义四化/亮度表与 `patternConfig` 一期不做。

`chart` 返回 `to_dto()` JSON。带 `targetDate` 与 `targetTimeIndex` 时附运限 DTO。`to_text` 只回一个 `text` 字段：`astrolabe_to_text`，`includeHoroscope` 时再接 `horoscope_to_text`。`knowledge` 默认 true，走 `TextOptions::knowledge` 的内置知识包。

错误正文只有 `code` 与 `message`。进 `x-iztro` 之前的入参与信封校验用 `bad_request`。`invalid_date`、`invalid_time_index`、`invalid_argument`、`internal` 只转发 `IztroError::code()`。

## 公网

- MCP：`https://ziwei.x-haose.com/mcp`（上游把该 URL 改写到本服务的 `/mcp`）
- 健康检查：同域 `/healthz`
- `GET /install`：301 到 `https://ziwei.x-haose.com/zh/docs/guide/mcp`。不占用 `GET /`，避免反代盖住文档站首页。

## 部署（Dokploy）

Dokploy 选择仓库根目录 `Dockerfile` 构建。官方 `rust` 与 `debian:bookworm-slim` 都带 `linux/amd64` 和 `linux/arm64`，Oracle aarch64 上按本机架构编译即可。容器暴露 `8080`，进程默认听 `0.0.0.0:8080`。健康检查用 `GET /healthz`。

Traefik 以后按 Host 接入。在那之前公网 MCP 仍是 `https://ziwei.x-haose.com/mcp`，由上游改写到容器内 `/mcp`。

本地冒烟：

```bash
docker compose up --build
```

## 不做（一期）

`lookup`、知识包市场、用户体系、网页排盘、自定义包 / OAuth。

## License

MIT
