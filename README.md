# x-ziwei

紫微斗数的 MCP / HTTP 服务。排盘由 [x-iztro](https://github.com/x-haose/x-iztro) 完成；本仓库把事实编成三个工具，并附一份论法 Skill。

盘由 x-iztro 保证；断法由知识包保证；句子由调用方的模型组织。不保存用户命盘、不缓存排盘结果。

## 工具

| 工具 | 作用 |
|---|---|
| `ziwei_chart` | 本命盘（可选运限）事实 + 语言无关 key |
| `ziwei_read` | 按封闭 topic 取材：切片事实、对得上的断语原文、缺口 |
| `ziwei_lookup` | 按标识核对知识包一条 |

公网主路径是 Streamable HTTP：客户端填一个 HTTPS URL 即可。同一套工具另有 stdio。

## 运行

开发期需要本机 [x-iztro](https://github.com/x-haose/x-iztro) 仓库（`Cargo.toml` 里 path 依赖）。

```bash
make check
cargo run -- serve --listen 127.0.0.1:8080
cargo run -- stdio
```

- MCP：`http://127.0.0.1:8080/mcp`
- JSON：`POST /v1/chart` `POST /v1/read` `POST /v1/lookup`
- 健康检查：`GET /healthz`

默认每 IP 10 次/秒、突发 30。`--trust-proxy` 才把 `X-Forwarded-For` **最右一跳**当限流键（反代必须覆盖该头）。生产 MCP 应加 `--allowed-host your.domain`。

知识包默认只用 x-iztro 内嵌包。本地文件与远程 URL 必须出现在 `--allow-pack-dir` / `--allow-pack-url`，否则拒绝。

## GPT Actions

首版 Actions 提供排盘（可选运限）与默认知识包查询，无需 API Key、注册或登录；不包含 `ziwei_read`。
接口公开、免费，允许第三方集成到免费或收费 App，本服务不因此收费。
配置、OpenAPI 导入和请求示例见 [GPT Actions](docs/gpt-actions.md)。

## 安装（Skill + MCP 一起进来，不用复制 SKILL.md）

插件目录是 `plugin/`：同一份 `skills/ziwei/SKILL.md` 和 `.mcp.json`，Claude 读 `.claude-plugin/`，Codex 读 `.codex-plugin/`。

**Claude Code**

```bash
# 本机仓库当 marketplace
/plugin marketplace add /Users/haose/code/work-hs/x-ziwei
/plugin install ziwei@x-ziwei
```

仓库上 GitHub 之后：

```bash
/plugin marketplace add x-haose/x-ziwei
/plugin install ziwei@x-ziwei
```

开发期不装 marketplace，直接：

```bash
claude --plugin-dir ./plugin
```

**Codex**

在本仓库里，Codex 会读 `.agents/plugins/marketplace.json`。在插件目录里安装 `ziwei`，或：

```bash
codex plugin marketplace add /Users/haose/code/work-hs/x-ziwei
```

装上后 MCP 指向 `https://ziwei.x-haose.com/mcp`。本机还没部署公网时，先起服务再单独加本地 MCP（Skill 仍走插件，不用手抄）：

```bash
./target/release/x-ziwei serve --listen 127.0.0.1:8080
claude mcp add --transport http ziwei http://127.0.0.1:8080/mcp
```
