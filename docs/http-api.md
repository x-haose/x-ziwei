# HTTP JSON 接口

`/v1` 与 MCP 工具是同一份实现的两种协议：五个操作一一对应、入参相同。给不接 MCP 的程序、低代码平台和 GPT Actions 用。

接口公开、免费，无需 API Key、账号或登录。允许第三方直接调用并集成到免费或收费产品，本服务不因此收费。

## 操作

全部是 `POST`，请求体与响应体都是 JSON。请求里出现未知字段即拒绝。

| 路径 | 同名 MCP 工具 | 作用 |
|---|---|---|
| `/v1/chart` | `ziwei_get_natal_chart` | 本命盘事实，可选附释义 |
| `/v1/horoscope` | `ziwei_get_horoscope` | 运限事实，层数随目标精度 |
| `/v1/topic` | `ziwei_get_topic_palaces` | 按知识包的主题定义取本命宫位事实与释义 |
| `/v1/lookup` | `ziwei_lookup_knowledge` | 按标识查知识包条目 |
| `/v1/catalog` | `ziwei_list_knowledge` | 知识包目录 |

响应信封：成功 `{"ok": true, "data": …}`；失败 `{"ok": false, "data": null, "error": {"code", "message", "retryable"}}`。

### 生辰 `birth`

```json
{"calendar": "solar", "date": "2000-8-16", "clock": "23:15", "gender": "female"}
```

- `calendar`：`solar`（默认）或 `lunar`。
- `date`：`YYYY-M-D`，只含年月日；是否存在由内核校验，范围 1–9999 年。
- 时辰：`clock` 为 `HH:MM`，或 `time_index` 为 0–12；至少给一个，都给时必须指向同一时辰。23 点是晚子 12，0 点是早子 0。
- `gender`：`male` / `female`，也接受 `男` / `女`。
- `leap`：农历闰月，`not_leap`（默认）/ `leap` / `leap_fixed`（闰月十五之后按下月）。公历只能省略或 `not_leap`。
- `fix_leap`：公历排盘换算农历时的闰月处理，默认 `true`，与 iztro 默认一致。
- `language`：盘面文本语言，`zh-CN`（默认）`zh-TW` `en-US` `ja-JP` `ko-KR` `vi-VN`。默认知识包只有中文。

### `/v1/chart`

```json
{"birth": {…}, "detail": "full", "knowledge": "summary"}
```

- `detail`：`full`（默认，含十二宫详解）或 `overview`（基本信息、十二宫总览表、格局）。
- `knowledge`：`summary` 或 `full`，在各宫与格局后附知识包释义；省略只返回事实。
- `pack`：见「知识包」。只在给了 `knowledge` 时可用。
- 返回 `data.text`（Markdown）、`data.language`，带释义时另有 `data.pack`（包的 `id`、`version`、`language`）。

### `/v1/horoscope`

```json
{"birth": {…}, "target": {"year": 2027}}
```

`target` 给到哪个精度，返回的 Markdown 就写到哪一层：

| 用户问 | `target` | 返回 |
| --- | --- | --- |
| 今年、明年、某一年 | `{"year": 2027}` | 大限、小限、流年 |
| 这个月、某一天 | `{"date": "2027-3-1"}` | 再加流月、流日 |
| 某个时辰 | `{"date": "2027-3-1", "clock": "12:00"}` | 再加流时 |

- `year` 是农历年，用公历年份数字表示：2027 指 2027 年正月初一起的丁未年。公历年初到春节前的日子仍属上一个农历年，所以问某一年要给 `year`，不要给那一年的 1 月 1 日。只给 `year` 时，标题里的日期是该农历年六月初一，三层取自那一天。
- `date` 恒为公历，不含钟点。`year` 与 `date` 二选一。
- 时辰用 `clock` 或 `time_index`，只能跟着 `date`。目标时辰不继承出生时辰，服务也不读取当前时间。
- `detail`、`knowledge`、`pack` 同 `/v1/chart`。

### `/v1/topic`

```json
{"birth": {…}, "topic": "romance"}
```

- `topic`：知识包里的主题 slug，用 `/v1/catalog` 的 `kind=topic` 列出。默认包有 `career` `children` `friends` `health` `overall` `parents` `personality` `property` `romance` `siblings` `spirit` `travel` `wealth`。
- 选哪些宫由包里该主题的 `surround`（连三方四正）与 `palaces`（只取本宫）决定；换包即换选宫。
- `knowledge`：`summary`（默认）或 `full`。`detail`、`pack` 同上。
- 只取本命宫位；运限用 `/v1/horoscope`。

### `/v1/lookup`

```json
{"kind": "star", "keys": ["ziweiMaj", "tianfuMaj"]}
```

- `kind`：`star` / `pattern` / `palace` / `mutagen` / `concept` / `topic`。
- `keys`：1–20 个语言无关标识，不接受译名。任一不存在则整次失败（`unknown_key`），不返回相近条目。
- 返回 `data.pack` 与 `data.entries`；每条的 `entry` 是包里该条目的原样内容，字段见 x-iztro 的[知识包格式规范](https://github.com/x-haose/x-iztro/blob/main/knowledge/SCHEMA.md)。

### `/v1/catalog`

```json
{"kind": "topic"}
```

- `kind` 省略则列全部六段。每段是 `{key, name}` 列表，用来把盘面文本里的名称对应到标识。

## 知识包

`pack` 省略或为 `builtin` 时用 x-iztro 内嵌的默认包。`file:路径` 与 `https://…` 必须在服务启动参数的白名单内（`--allow-pack-dir` / `--allow-pack-url`），否则 `pack_not_allowed`。公网服务没有开白名单，只有默认包；要用自己的包，自行部署本服务。

自定义包的 `extends` 写默认包的 `id`（`iztro-docs`）时按覆盖包处理：合并到默认包之上，只需写要改或要加的条目。不写 `extends` 的包整包独立使用。

## 错误与限制

| HTTP | `error.code` | 含义 |
|---|---|---|
| 400 | `invalid_date` `invalid_time_index` `invalid_clock` `time_mismatch` `invalid_argument` | 入参非法 |
| 400 | `unknown_key` `unknown_topic` | 知识条目或主题不存在 |
| 400 | `pack_not_allowed` | 知识包不在白名单 |
| 413 | `invalid_argument` | 请求体超过 64 KiB |
| 429 | `rate_limited` | 单地址超过限流，可重试 |
| 500 | `internal` | 内部错误 |
| 503 | `pack_unavailable` | 白名单内的知识包读不到，可重试 |

- 请求体上限 64 KiB，超限返回 413 与 `invalid_argument`。路径或方法不对由 HTTP 框架直接拒绝，不带信封。
- 与 `/mcp` 共用每 IP 限流，默认 10 次/秒、突发 30。
- 允许任意来源跨域访问，不使用 Cookie 或其他凭证。
- 全部操作只读，不创建用户记录，不缓存命盘。

## OpenAPI 与 GPT Actions

启动时给出公网 HTTPS 根地址（443 端口，不带路径、查询串或凭据）后，`/v1/openapi.json` 提供 OpenAPI 3.1 文档，结构由 Rust 请求与响应类型生成；不给则该路径 404，其余接口照常。

```bash
./target/release/x-ziwei serve --listen 127.0.0.1:8080 \
  --public-url https://ziwei.example.com \
  --allowed-host ziwei.example.com
```

也可用环境变量 `X_ZIWEI_PUBLIC_URL`。HTTPS 由反向代理提供；反代不得记录请求体。在反代之后用 `--client-ip-header` 指明带客户端地址的请求头（Cloudflare 为 `cf-connecting-ip`），反代必须覆盖该头，否则客户端可以伪造限流地址。

自定义 GPT 正在退役、Actions 不随之迁移（见 [ChatGPT 上架](chatgpt-submission.md)），ChatGPT 侧的公开分发改走插件目录。仍在使用的 GPT 编辑器可导入 `<公网根地址>/v1/openapi.json`，Authentication 选 **None**。五个操作都标了 `x-openai-isConsequential: false`。GPT 的指令可直接用 [`plugin/skills/ziwei/SKILL.md`](../plugin/skills/ziwei/SKILL.md) 的正文。

本机验证，路径与公网一致：

```bash
curl --fail-with-body http://127.0.0.1:8080/v1/chart \
  -H 'Content-Type: application/json' \
  -d '{"birth":{"date":"2000-8-16","clock":"23:15","gender":"female"}}'
curl --fail-with-body http://127.0.0.1:8080/v1/lookup \
  -H 'Content-Type: application/json' \
  -d '{"kind":"star","keys":["ziweiMaj"]}'
```

Actions 的官方要求核对于 2026-11-11：[接入](https://developers.openai.com/api/docs/actions/getting-started)、[鉴权](https://developers.openai.com/api/docs/actions/authentication)、[生产要求](https://developers.openai.com/api/docs/actions/production)。当时的要求是公网 HTTPS（TLS 1.2 以上、有效证书、443 端口），调用超时 45 秒，请求与响应各小于 100,000 字符。本服务最大的响应是 `/v1/chart` 带全文释义，约 2 万字符。
