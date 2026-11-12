# x-ziwei

紫微斗数的 MCP / HTTP 服务：把盘面事实、知识资料和解读方法全部公开给任何大模型，让模型自己解读。

多数 AI 命理产品把提示词和解读方式藏在里面，用户只能提问。这里反过来，三层都是公开、可替换的：

| 层 | 是什么 | 怎么换 |
|---|---|---|
| 盘面事实 | [x-iztro](https://github.com/x-haose/x-iztro) 算出的本命盘、运限、格局，与 iztro 逐字段对齐 | 不换；这是计算 |
| 知识包 | 星耀、格局、宫位、四化的释义，术语，主题看哪些宫。开放的 JSON 格式，默认包源自 iztro-docs | 自己写一份，整包替换或只覆盖几条 |
| 解读方法 | 一份 Markdown Skill：先问清生辰、调哪些工具、怎么区分事实与观点 | 改它，或者不用它，按自己的方法来 |

服务本身不做解读，不保存命盘，不缓存排盘结果。公开、免费、无需账号。

## 工具

| 工具 | 作用 |
|---|---|
| `ziwei_get_natal_chart` | 本命盘事实（Markdown），可选附知识包释义 |
| `ziwei_get_horoscope` | 指定日期与时辰的大限、小限、流年、流月、流日、流时 |
| `ziwei_get_topic_palaces` | 按知识包里的主题定义（婚恋、事业、财运等）取本命宫位事实与释义 |
| `ziwei_lookup_knowledge` | 按标识查知识包条目原文：释义、古籍引文、成立条件、主题的选宫定义 |
| `ziwei_list_knowledge` | 知识包目录：有哪些条目，名称对应什么标识 |

同一份实现有三个入口：

- MCP Streamable HTTP：`/mcp`
- MCP stdio：`x-ziwei stdio`
- HTTP JSON：`POST /v1/chart` `/v1/horoscope` `/v1/topic` `/v1/lookup` `/v1/catalog`，见 [HTTP 接口](docs/http-api.md)

## 安装

插件把 Skill 和 MCP 一起装上，不用手抄 SKILL.md。目录是 `plugin/`：Claude 读 `.claude-plugin/`，Codex 读 `.codex-plugin/`，共用 `skills/ziwei/SKILL.md` 和 `.mcp.json`。

**Claude Code**

```bash
/plugin marketplace add x-haose/x-ziwei
/plugin install ziwei@x-ziwei
```

**Codex**

```bash
codex plugin marketplace add x-haose/x-ziwei
codex plugin add ziwei@x-ziwei
```

**只接 MCP**：在客户端里填远程 MCP 地址 `https://ziwei.x-haose.com/mcp`，无鉴权。这样没有 Skill，可以把 [`plugin/skills/ziwei/SKILL.md`](plugin/skills/ziwei/SKILL.md) 的正文贴进自定义说明。

## 自己部署

需要 Rust 1.88 以上和 Git。内核由 Cargo 按 `Cargo.toml` 里固定的提交号从 x-iztro 仓库获取，用仓库里的 `Cargo.lock` 构建。

```bash
make check
cargo run -- serve --listen 127.0.0.1:8080
cargo run -- stdio
```

或用 Docker：

```bash
docker build -t x-ziwei .
docker run --rm -p 8080:8080 x-ziwei
```

- 健康检查：`GET /healthz`
- 限流：默认每 IP 10 次/秒、突发 30。服务在反向代理之后时加 `--trust-proxy`，取 `X-Forwarded-For` **最右一跳**作限流键；反代必须覆盖该头，否则客户端可以伪造。
- 公网部署加 `--allowed-host your.domain`，MCP 只接受该 `Host`。
- `--public-url https://your.domain` 开启 `/v1/openapi.json`。

### 用自己的知识包

```bash
x-ziwei stdio --allow-pack-dir ./packs
```

之后工具的 `pack` 参数可以写 `file:./packs/my-school.json`。远程包用 `--allow-pack-url` 逐条登记。不在白名单里的路径和 URL 一律拒绝。

包的格式见 x-iztro 的[知识包格式规范](https://github.com/x-haose/x-iztro/blob/main/knowledge/SCHEMA.md)。`extends` 写 `iztro-docs` 的包会合并到默认包之上，只需写要改的条目；包里 `topics` 段的选宫定义直接决定 `ziwei_get_topic_palaces` 取哪些宫。

## License

MIT
