# x-ziwei

紫微斗数 MCP / HTTP 服务。排盘由 [x-iztro](https://github.com/x-haose/x-iztro) 完成。

**一期目标**：公网一行 URL 可装；工具只暴露 `chart` / `to_text`；契约可钉；盘与 iztro v2.5.8 金标对齐。

## 契约（已冻）

| 文件 | 内容 |
|---|---|
| [`contracts/mcp-tools.schema.json`](contracts/mcp-tools.schema.json) | `chart` / `to_text` 入参出参 |
| [`contracts/error-codes.json`](contracts/error-codes.json) | 引擎四码 + `rate_limited` / `bad_request` |

门禁只 diff 稳定键与六码；译名字段不进 diff。可选薄 `config` 六开关；自定义四化/亮度表与 `patternConfig` 一期不做。

## 公网（规划）

- MCP：`https://ziwei.x-haose.com/mcp`
- 健康检查：同域 `/healthz`
- 落地页：同域单页（why + 一行配置 + solar 最短示例）

## 不做（一期）

`lookup`、知识包市场、用户体系、网页排盘、自定义包 / OAuth。

## License

MIT
