# AGENTS.md

## 项目概述

x-ziwei：让 AI 解读紫微斗数的产品。排盘、运限、格局判定由 [x-iztro](https://github.com/x-haose/x-iztro) 完成；本仓库把那份事实连同知识包与解读方法交给模型，渠道有 AI 插件（远程 MCP + Skill）、HTTP 接口、网页和桌面应用。

设计目标：多数 AI 命理产品把提示词与解读方式藏在产品里，用户只能提问和付费。本项目反过来，向主流大模型完整公开三层材料，让模型自行解读，使用者可以换成自己的知识库和解读方案：

- 盘面事实：x-iztro 的计算结果，不可替换。
- 知识包：释义、术语、主题看哪些宫，开放格式，可整包替换或逐条覆盖。
- 解读方法：`plugin/skills/ziwei/SKILL.md`，一份公开的 Markdown，可改可不用。

本仓库不重写安星，不微调模型，服务端不保存用户命盘，代码里不放解读方法。

## 决策标准

- 代码的功能、质量、架构、干净程度（即「强大」）永远是第一优先。
- 绝不以「最小改动 / 最小破坏」为标准做决定；只做对的决定，不做最小的。
- 某块到了重写更优的程度，只要收益高就重写。
- 零容忍对付、补丁、将就式编码。
- 排盘对错以 x-iztro 为准：本仓库不复制、不改写斗数算法。缺的纯计算入口补在 x-iztro，这里只做编组与取用。

## 产品形态

一个核心，多个渠道。三层材料在每个渠道里相同，渠道只决定用什么方式交给哪个模型：

| 渠道 | 形态 | 模型 |
|---|---|---|
| AI 插件 | 公网远程 MCP + Skill，装进 ChatGPT、Claude、Codex、Cursor 等客户端；另有 stdio 供本机调试 | 客户端自带 |
| HTTP 接口 | `/v1/*` 与 OpenAPI，契约见 `docs/http-api.md` | 调用方自己的 |
| 网页 | 产品站 `apps/web`：排盘、生成提示词复制到任意聊天 AI（含不支持插件的 DeepSeek、豆包、Kimi）、填自己的 API Key 直接对话 | 用户的聊天 AI 或 API Key |
| 桌面 | Tauri 应用，直接打包网页应用的静态产物，作为 ACP 客户端启动用户已装的 Claude Code、Codex、Cursor 等 agent，挂上本机 MCP | 用户已有的订阅 |

各渠道的建设顺序与进度见 `docs/roadmap.md`。

公网服务与接口完全公开、免费，无需鉴权或账号。允许任何人直接调用，也允许集成到免费或收费 App；不因调用方收费而收取 API 使用费。限流只挡住单地址把机器打满，正常人问询无感。

不做账号与用户体系：知识包靠文件与分享链接在渠道间流转，API Key 留在用户的浏览器或本机。真出现账号才能解决的需求（一个人管很多包、找回丢失的钥匙）再加。也不做管理后台、知识包市场、按人生成 Skill。

服务端算完即弃：不建用户命盘库，不缓存排盘结果。随手传入的生辰不是资产；计算足够快，缓存键（时辰、配置、语言、知识包、问题切片）比计算更贵。日志不落完整出生日期。网页在浏览器里用 x-iztro 的 WASM 排盘，生辰不经服务端；API Key 只存在浏览器，直连模型厂商。桌面的命盘与知识包存在本机，由用户自己保管。

知识包的正本是开放格式的 JSON 文件，归用户：桌面存本机，网页存浏览器并可导入导出。服务端托管的包是给 AI 插件渠道用和对外分享的副本，加密存放，不是唯一的一份。

服务端现有能力：

- 默认知识包（x-iztro 内嵌包）；自定义包经启动参数的白名单加载，`extends` 指向默认包时按覆盖包合并
- MCP 工具：`ziwei_get_natal_chart` 本命盘事实；`ziwei_get_horoscope` 运限事实；`ziwei_get_decadal_overview` 一生大限一览；`ziwei_get_yearly_overview` 多年流年一览；`ziwei_find_birth_by_bazi` 八字反推生辰；`ziwei_get_topic_palaces` 按知识包的主题定义取材；`ziwei_lookup_knowledge` 查知识包条目；`ziwei_list_knowledge` 知识包目录
- 一份 Skill（先确认生辰再调工具；工具没返回的星不写；盘面事实、知识包释义、模型分析三者分清）。用户的包是参数，不按人生成第二套用法
- 与 MCP 同一套实现的 HTTPS JSON 接口 `/v1/*` 与 OpenAPI

有意义的例盘（名人、教学、格局正例）是编过的内容，不是用户历史记录。

## 与 x-iztro 的边界

| | x-iztro | x-ziwei |
|---|---|---|
| 是什么 | 排盘内核：Rust crate，Python、Go、JS（WASM）绑定 | 服务、网页、桌面与 Skill |
| 质量契约 | 与 x-iztro 锁定的 iztro 版本金标零容忍；绑定能力同步 | 服务与工具面，发版节奏独立 |
| 知识包 | 协议、合并、默认包、按标识查询、按包的主题定义选宫并渲染 | 加载与白名单、目录、把条目与出处交给模型 |
| 依赖 | 无本仓库 | 服务依赖固定 Git 提交的 x-iztro crate；网页依赖固定版本的 x-iztro JS 包 |

看哪些宫、用哪些材料、按什么步骤解盘属于知识与方法，只能出现在知识包或 Skill 这类 Markdown 文件里（网页生成的提示词也从这类文件取方法正文）：本仓库的代码不出现主题枚举、选宫规则、三方四正几何、安星、格局规则或农历换算。知识包表达不了的方法先写进 Skill 这类可读说明，不在服务里写死，也不因其能写成纯函数就下放到 x-iztro；缺少的通用计算能力才在 x-iztro 补。

## 技术

- 语言：Rust（edition 与 MSRV 跟 x-iztro：2024 / 1.88）
- MCP：官方 SDK [`rmcp`](https://crates.io/crates/rmcp) 3.x（Tier 1，规范 `2026-07-28`）
- 传输：Streamable HTTP（公网主路径）与 stdio（本机）；工具实现一份
- 分发：一个二进制；对外安装故事是 Agent Plugin（`plugin/`：Claude `.claude-plugin/` + Codex `.codex-plugin/` + `.mcp.json` + `skills/ziwei/SKILL.md`）。Skill 与 MCP 一起安装，不手抄 SKILL.md。MCP 指向公网 URL
- 知识包：服务进程读默认包或本地/白名单 URL 的 JSON；不接任意 URL（SSRF）
- 网页：`apps/web`，React Router 8（`ssr:false` 加 `prerender`，Vite 构建）产出纯静态站，排盘在浏览器里调 x-iztro 的 WASM，不调 `/v1`。各项选型与理由见 `docs/roadmap.md`「选型」
- 桌面：`apps/desktop`，Tauri 2，前端就是 `apps/web` 的同一份静态产物，平台差异集中在网页应用的平台层；Rust 外壳是独立的 Cargo 项目，不并入服务端 crate；用 ACP 与 agent 通信
- 设计：网页与桌面共用一套设计规范，方向未定不写界面代码；流程与禁忌见 `docs/roadmap.md`「设计」
- 仓库独立 git；`Cargo.toml` 的完整 `rev` 与 `Cargo.lock` 固定 x-iztro 源码，部署不依赖本机目录布局

公网 API 不要求 API Key 或登录；限流只用于控制调用频率。

## 线上部署

- 地址：`https://ziwei-mcp.x-haose.com`（`/mcp`、`/v1/*`、`/healthz`）。请求经 Cloudflare 代理到 Dokploy 的 Traefik，再到容器的 8080 端口。
- Dokploy 对 `main` 开着自动部署，约 6 分钟。Watch Paths 设为 `src/**`、`Cargo.toml`、`Cargo.lock`、`Dockerfile`：只有这些路径有改动的推送才会重建服务，只改站点或文档的推送不触发。新增会进镜像的路径时要同步加进 Watch Paths，否则改了不会部署，也没有任何提示。
- 启动参数在 Dokploy 的 Advanced → Run Command → Arguments 里：`serve --client-ip-header=cf-connecting-ip --allowed-host=ziwei-mcp.x-haose.com --public-url=https://ziwei-mcp.x-haose.com --openai-apps-challenge=<口令>`。口令是 OpenAI 插件门户（MCPs → Connect → Domain verification）给的域名校验口令，`/.well-known/openai-apps-challenge` 原样返回；本来就公开，不是密钥。门户换发口令时要同步改这里并重新部署。面板地址 `https://admin.haose.love`。
- 限流键取 Cloudflare 写入的 `CF-Connecting-IP`。这个头只有经 Cloudflare 才可信，靠 Traefik 中间件 `cloudflare-only@file` 保证：`ipAllowList` 只放行 Cloudflare 的地址段，绕过 Cloudflare 直连源站返回 403。它定义在 Dokploy 该应用的 Advanced → Traefik 配置里，在 Domains 里挂在 `ziwei-mcp.x-haose.com` 上。地址段取自 <https://www.cloudflare.com/ips/>（2026-11-12），Cloudflare 增减地址段时要同步更新，否则新节点来的请求会被拒。
- 服务只有 `ziwei-mcp.x-haose.com` 这一个域名，没有任何站点反代它。

## 站点

`site/` 是现行的说明站（安装、工具、知识包、接口、隐私与条款等，属于产品帮助，不是开发文档），部署在 `https://ziwei.x-haose.com`：Vercel 项目 `x-ziwei`，Root Directory 为 `site`，推到 `main` 即发布。它与服务分开部署，改站点不需要重新构建服务。产品站 `apps/web` 已经内置同样的帮助页，构建时直接读 `site/content`（内容单一来源，不复制）；上线时 `apps/web` 接管这个域名，再把 `site/content` 搬进 `apps/web` 并下线 `site/`。所以 `site/` 不再加新功能，只维护内容的正确性，改内容只改 `site/content`，两站同时生效。真正的开发文档是 x-iztro 的文档站。排盘库的文档站是另一个 Vercel 项目 `x-iztro`（仓库 `x-haose/x-iztro`，目录 `docs`，域名 `x-iztro.x-haose.com`）。

- 技术栈照抄 x-iztro 文档站：Next.js + Fumadocs + Tailwind，版本见 `site/package.json`。中文是默认语言，`content/` 里无后缀为中文，`.en.mdx` 为英文，两种语言成对维护。
- 页面直接挂在语言段之下（`/zh/install`），不带 `/docs`。`/{lang}/docs/*` 是排盘库文档的旧地址，永久跳转到 `https://x-iztro.x-haose.com`；旧的 MCP 说明页跳到本站安装页。
- 两站互为入口：本站顶栏、页脚、首页指向 x-iztro 文档；x-iztro 文档的「给 AI 用」指向本站。紫微斗数概念、数据结构、准确性说明只在 x-iztro 文档里写，本站不重复。
- 隐私政策、服务条款、支持三页是上架要填的链接，写的都是服务的实际行为；服务的数据处理方式有变化时要同步改这三页。
- 检查：`cd site && npm ci && npm run types:check && npm run build`，CI 的 `site` 任务跑同一组命令。

## 发版

插件的版本号是唯一的发版开关；服务与站点不跟版本号走，推到 `main` 就部署。

1. 改了 `plugin/` 下任何文件，三处 `version`（`plugin/.codex-plugin/plugin.json`、`plugin/.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json`）一起加一版，`tests/plugin_manifest.rs` 断言三处相等。同时把 `.codex-plugin/plugin.json` 的 `publication.release_notes` 改写成这一版的说明（英文；门户与 GitHub Release 都展示它）。
2. 推到 `main`。CI 全过后 `release` 作业看标签 `v<版本>`：不存在就建 GitHub Release 并打标签，附件 `x-ziwei-<版本>.zip` 是上架用的插件包；`plugin/` 有改动而版本号没加，或发布说明与上一版相同，作业失败。
3. Claude Code 与 Codex 的插件市场直接读 `main`，推送即生效。OpenAI 插件目录要人工：门户里对已有插件 Upload new version，上传 Release 的 ZIP，检查通过后提交审核，批准后手动 Publish。门户没有公开的上传接口（2026-11-22 查官方文档）。

只改工具（名称、描述、入参、注解）或服务内部、不动 `plugin/` 时不用发版：OpenAI 每天扫描 MCP 服务，工具定义的改动通过自动检查后直接替换线上定义，门户 MCPs 页的 Rescan 可立即触发；检查通过前线上仍是旧定义，所以服务要同时兼容新旧两版调用。清单、图标、Skill 的改动才需要新版本和人工审核；每次提交都是一轮新审核，同一插件同时只能有一个审核。

## 注释规范

- 只解释「当前代码在当前项目的含义」，必须自包含。
- 禁止对话痕迹、变更日志、「以前 / 现在 / 后续 / 待改」。
- 覆盖要全：所有字段、方法、函数、类型都写。
- 零信息注释与没写同等对待。名字已经说尽的不写。

## Git

提交格式：`<type>: <描述>`，type 为 `feat` / `fix` / `refactor` / `docs` / `test` / `chore` / `perf` / `ci`。

提交信息与任何 PR / issue / 注释里都不得出现 AI 署名、`Co-Authored-By` 指向模型、或「本提交由 AI 协助」一类标记。

## 上架

第一个目标是 ChatGPT 与 Codex 共用的公开插件目录，提交物是 `plugin/` 目录（Skill + 远程 MCP）。要求、现状与待办见 `docs/chatgpt-submission.md`。对服务端的硬性约束：

- 每个工具显式标 `readOnlyHint`、`destructiveHint`、`openWorldHint` 并带 `title`；工具全部只读。
- 工具结果只含与请求直接相关的内容，不带时间戳、请求或会话标识。
- 上架后工具名与入参保持向后兼容；MCP 的协议、主机名、端口不能再改。
- 日志不落生辰，也不落客户端随调用送来的用户或会话标识。
