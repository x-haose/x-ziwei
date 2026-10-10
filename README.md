# x-ziwei

紫微斗数 MCP / HTTP 服务。排盘由 [x-iztro](https://github.com/x-haose/x-iztro) 完成。

**一期目标**：公网一行 URL 可装；工具只暴露 `chart` / `to_text`；契约可钉；盘与 iztro v2.5.8 金标对齐。

## 安装

MCP（Streamable HTTP）：

https://ziwei.x-haose.com/mcp

```json
{
  "mcpServers": {
    "x-ziwei": {
      "url": "https://ziwei.x-haose.com/mcp"
    }
  }
}
```

健康检查：同域 [`/healthz`](https://ziwei.x-haose.com/healthz)。落地页在同域 `/`。

## 本地

需要 Rust 1.88+。`x-iztro` 钉死在 crates.io `0.6.1`。

```bash
cargo run
```

默认监听 `0.0.0.0:8080`。`PORT` 或 `BIND` 可改地址。`POST /mcp` 为 Streamable HTTP；`GET /healthz` 返回 `ok`。

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

- MCP：`https://ziwei.x-haose.com/mcp`
- 健康检查：同域 `/healthz`
- 落地页：同域单页（why + 一行配置 + solar 最短示例）

## 不做（一期）

`lookup`、知识包市场、用户体系、网页排盘、自定义包 / OAuth。

## License

MIT
