# GPT Actions 首版接口

首版只提供本命排盘、明确目标的运限与默认知识包查询。`ziwei_read`、固定主题选宫、自定义包地址不进入 Actions；已有 MCP 与 `/v1` 接口独立保留。

## 启用

接口完全公开、免费，无需 API Key、账号或登录。允许第三方直接调用并集成到免费或收费产品；本服务不因此收取费用。

设置 `X_ZIWEI_ACTIONS_PUBLIC_URL` 为公网 HTTPS 根地址，例如 `https://ziwei.x-haose.com`，443 端口，不带路径、查询串或凭据。该配置用于生成 OpenAPI；未设置时不注册 `/actions` 路由。

构建并启动（将域名替换为实际部署域名）：

```bash
make check
X_ZIWEI_ACTIONS_PUBLIC_URL=https://ziwei.x-haose.com \
  ./target/release/x-ziwei serve --listen 127.0.0.1:8080 \
  --allowed-host ziwei.x-haose.com
```

HTTPS 由部署反向代理提供；本地调试 HTTP 不代表已经满足公网要求。反代需要转发 `/actions/*`、`/mcp` 和 `/healthz`，不能记录请求体。只在反代覆盖 `X-Forwarded-For` 时加 `--trust-proxy`，否则客户端可伪造限流地址。

GPT 编辑器导入 `<公网根地址>/actions/openapi.json`，Authentication 选择 **None**。OpenAPI 只声明以下两个操作，请求和响应结构从 Rust 类型生成。普通 App 使用相同的 HTTP 接口，无需接入 GPT。

本机可用以下请求验证，路径与公网一致：

```bash
curl --fail-with-body http://127.0.0.1:8080/actions/openapi.json
curl --fail-with-body http://127.0.0.1:8080/actions/chart \
  -H 'Content-Type: application/json' \
  -d '{"birth":{"date":"2000-8-16","clock":"23:15","gender":"female"}}'
curl --fail-with-body http://127.0.0.1:8080/actions/lookup \
  -H 'Content-Type: application/json' \
  -d '{"kind":"star","key":"ziweiMaj"}'
```

## `POST /actions/chart` · `ziwei_chart`

```json
{
  "birth": {
    "calendar": "solar",
    "date": "2000-8-16",
    "clock": "23:15",
    "gender": "female"
  },
  "target": {
    "date": "2026-11-11",
    "time_index": 12
  }
}
```

- 出生时辰：`clock` 为 HH:MM，或提供 `time_index` 0–12；两者至少一个，同时提供必须一致。23 点为晚子 12，0 点为早子 0。缺失时先向用户确认，不猜。
- 日期只含年月日，不含钟点；实际存在性由内核校验。性别支持 male/female、男/女。
- 公历 `calendar=solar`；农历 `calendar=lunar`，通过 `leap=not_leap/leap/leap_fixed` 明确闰月。公历不能指定闰月。
- 公历出生排盘的 `fix_leap` 默认 true；输出语言默认 zh-CN，可显式指定支持的语言码。
- `target` 整体省略表示只要本命；提供时 date 和 time_index 都必须给出。目标日期始终是公历，时辰不继承出生时辰，也不读取当前时间。用户只问年份时，具体选取哪个目标日期/时辰需要在 GPT 指令或交互中明确。
- 返回 `ok/data/error` 信封，data 含本命 Markdown 事实、可选运限事实与语言无关 key，不生成主题解盘结论。

## `POST /actions/lookup` · `ziwei_lookup`

```json
{"kind":"star","key":"ziweiMaj"}
```

kind 为 star/pattern/palace/mutagen/concept。只查默认包，返回名称、正文、可用的格局古籍引文和包 id/version。不存在的标识明确失败，不猜相近条目；不接受 pack、文件路径或 URL。

知识释义属于资料观点；排盘事实、知识原文与模型分析应分别表达。此接口不提供主题/方法发现，也不自动选择解盘方法。

## GPT 配置

Actions 使用下述独立指令；`plugin/skills/ziwei/SKILL.md` 面向 MCP，含本接口没有的 `ziwei_read`，不能直接作为 GPT 指令使用。

```text
你提供紫微斗数排盘事实和知识资料查询。
排盘前确认出生历法、日期、性别及钟点或时辰。农历日期确认是否闰月及其处理方式。
不猜缺失的生辰，不自行换算农历，不把 23 点当作早子。
需要运限时，确认目标公历日期和目标时辰；仅给年份不足以确定完整运限，不擅自补日期。
使用 ziwei_chart 获得盘面事实；使用 ziwei_lookup 按已确认的语言无关 key 核对默认知识包。
只描述工具实际返回的星曜、宫位、四化和格局，不从常识补造盘面。
明确区分盘面事实、知识包释义和模型分析；知识包是一种资料观点，不代表唯一论法。
本接口没有主题或方法发现能力，不把默认选宫规则说成唯一解盘方法。
调用失败时说明错误；可重试错误可稍后重试，参数错误先更正参数，不编造结果。
```

GPT 编辑器的验证场景：公历与等价农历结果一致、23 点使用晚子、缺失生辰先追问、运限缺少目标时辰先追问、未知知识 key 明确失败。发布前还需提供公开可访问的隐私说明，核实反代及托管平台的日志策略；应用不保存命盘不等于基础设施没有访问日志。

## 错误与运行限制

- 400：字段、日期、时辰或知识标识非法；429：限流；500：内部错误；503：知识源不可用。
- JSON 字段类型与业务校验错误返回错误信封；请求体上限 64 KiB，超限或不支持的方法还可能由 HTTP 框架直接拒绝。
- Actions 与其他 HTTP 入口共用每 IP 限流。反向代理下按已有 `--trust-proxy` 约定配置。
- HTTP 接口允许任意来源跨域访问，支持浏览器网页 App 直接请求；不使用 Cookie 或其他登录凭证。
- 两个操作都只读，OpenAPI 标记 `x-openai-isConsequential=false`，不创建用户记录，不缓存命盘。

官方资料核对日期 2026-11-11：[Actions 接入](https://developers.openai.com/api/docs/actions/getting-started)、[鉴权](https://developers.openai.com/api/docs/actions/authentication)、[生产要求](https://developers.openai.com/api/docs/actions/production)。当前官方要求公网 HTTPS/TLS 1.2 以上、有效证书和 443 端口，调用超时 45 秒、请求响应各小于 100,000 字符。正式发布还需部署、隐私说明和 GPT 编辑器实际联调，本地测试不能代替这些步骤。
