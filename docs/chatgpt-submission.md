# ChatGPT 上架

官方要求核对于 2026-11-12。来源是 OpenAI 开发者文档：[提交流程](https://developers.openai.com/plugins/deploy/submission)、[审核要求](https://developers.openai.com/plugins/deploy/app-review)、[插件准则](https://developers.openai.com/plugins/plugin-guidelines)、[提交报错](https://developers.openai.com/plugins/deploy/submission-errors)、[打包格式](https://developers.openai.com/plugins/build/plugins)、[MCP 服务](https://developers.openai.com/plugins/build/mcp-server)。

## 走哪条路

ChatGPT 与 Codex 共用的公开插件目录，提交入口 <https://platform.openai.com/plugins>。插件 = Skill + 一台远程 MCP，发布一次两边都能搜到。

GPT Store（自定义 GPT + Actions）不再是可选项：官方的[迁移说明](https://learn.chatgpt.com/docs/migrate-custom-gpts)写明自定义 GPT 正在迁往插件、Actions 不迁移。帮助中心称个人账号已不能新建或发布 GPT、标准退役日为 2026-12-11，这两条只看到搜索摘要，帮助中心页面本身没能打开。`/v1` 接口与 OpenAPI 继续给低代码平台和普通程序用。

上架前，用户可以在 ChatGPT 的 Plugins 页用「Add custom MCP server」自己接入：填 MCP 地址，Authentication 选 No authentication。

上架前从插件市场（`x-haose/x-ziwei`）安装的插件，在两种对话里表现不同（2026-11-12 实测，ChatGPT 桌面应用自带的 codex-cli 0.163.0-alpha.11.1）：

- Codex 线程：`.mcp.json` 里的服务器由本机 Codex 运行时连接，五个工具可调用，Skill 也在。
- ChatGPT 普通对话：模型在云端，看得到插件和 Skill，看不到 `.mcp.json` 里的服务器。这里的 MCP 工具只来自在 ChatGPT 里登记过的服务器（「Add custom MCP server」，或上架时由门户登记），插件用 `.app.json` 指向登记后的 `plugin_asdk_app…` 标识。这个标识属于登记它的账号，不能写进公开仓库给所有人用。

项目级的 `.codex/config.toml` 里如果有同名的 `[mcp_servers.ziwei]`，在该目录下开的 Codex 线程会用它，而不是插件里的那一个。

## 服务端要求与现状

| 要求 | 现状 |
|---|---|
| 公网 HTTPS、Streamable HTTP | 满足 |
| 每个工具显式标 `readOnlyHint` / `destructiveHint` / `openWorldHint`，缺一项无法提交 | 满足，取值 true / false / false，有测试 |
| 每个工具有 `title`、非空描述、显式入参 schema | 满足 |
| 返回 `structuredContent` 的工具必须声明 `outputSchema` | 不适用：工具只返回文本内容块 |
| 结果不带时间戳、请求或会话标识 | 满足 |
| 入参只收功能必需的字段，不收位置、地址 | 满足：只有历法、日期、时辰、性别 |
| 域名校验：`/.well-known/openai-apps-challenge` 以纯文本返回门户给的口令 | 已支持，启动参数 `--openai-apps-challenge` 或环境变量 `X_ZIWEI_OPENAI_APPS_CHALLENGE` |
| 服务说明（`instructions`）的关键内容在前 512 字符 | 满足 |
| 桌面与移动端都能用 | 待真机验证 |

## 上架后不能再改的两件事

**MCP 地址。** `https://ziwei-mcp.x-haose.com/mcp`，写在 `plugin/.mcp.json` 里。上架后协议、主机名、端口不能改，要改只能新建插件。

**工具名。** 准则要求工具名用平实的动词式写法（官方例子 `get_order_status`），现在的五个名字都是「`ziwei_` + 动词 + 对象」。上架后改名等于删掉旧工具再加新工具，提交之后不再改。

## 提交包

提交的是一个 ZIP，根目录即 `plugin/` 的内容。展示信息写在 `.codex-plugin/plugin.json` 的 `interface` 里，Skill 自己的名称与图标写在 `skills/ziwei/agents/openai.yaml`，图标在 `assets/`（`logo.png` 由 `icon.svg` 渲染）。官方目录里已上架的插件用的也是这种 `.codex-plugin/plugin.json` 写法；[打包格式](https://developers.openai.com/plugins/build/plugins)另外描述了把同样的内容放在根目录 `plugin.json` 的 `extensions.com.openai` 下的写法，两者并存时后者整体生效。

`interface` 的要求与现状：

- `longDescription`（≤4000 字符）、`capabilities`：已填，`capabilities` 为 `["Read"]`
- `category`：只能从 Productivity、Creativity、Developer Tools、Business & Operations、Data & Analytics、Communication、Education & Research、Security、Finance、Healthcare、Travel、Entertainment、Other 里选。现为 Entertainment（可选项里没有命理或生活方式类）
- `websiteURL`、`supportURL`、`privacyPolicyURL`、`termsOfServiceURL`：带 MCP 的插件四个链接都必填，HTTPS，页面要能打开，且与提交者是同一发布方。已填站点不带语言前缀的地址，站点按浏览器语言跳到 `/zh` 或 `/en`
- `logo`、`composerIcon`：方形，≥48×48，PNG / JPEG / WebP / SVG，≤5 MiB。已填

还缺的只有提交审核用的两项：

- `extensions.com.openai.review`：恰好 5 条正面用例、3 条反面用例、演示录像地址
- `extensions.com.openai.publication.release_notes`

插件版本号写在 `.codex-plugin/plugin.json`、`.claude-plugin/plugin.json` 与 `.claude-plugin/marketplace.json` 三处，客户端按版本号缓存已安装的插件，改了插件内容要一起加版本号。

文案限制：`displayName` 与 `shortDescription` 各 ≤30 字符；名称不用通用单词，不加 MCP、Plugin 后缀；描述里不写价格、免费、订阅，不与其他产品比较。

无鉴权的写法、`mcp.json` 与 `.mcp.json` 两种格式的差别见[打包格式](https://developers.openai.com/plugins/build/plugins)。门户上传时走 With MCP 入口还是 Upload 入口，两份官方文档写法不一致，以门户实际界面为准。

## 审核用例草稿

正面用例要写明提示词、预期调用的工具、预期行为。

| # | 提示词 | 预期工具 | 预期行为 |
|---|---|---|---|
| 1 | 我是 2000 年 8 月 16 日凌晨 3 点半出生的女生，帮我排个紫微盘 | `ziwei_get_natal_chart` | 返回本命盘，回答指出命宫、身宫、主星与格局，内容都能在工具结果里找到 |
| 2 | 同一生辰，我 2027 年运势怎么样 | `ziwei_get_horoscope`（`target.year` 为 2027） | 不追问日期和时辰，直接取大限、小限、流年并分层说明 |
| 3 | 同一生辰，我的感情婚姻怎么样 | `ziwei_get_topic_palaces`（`romance`） | 按知识包的婚恋主题取材，回答区分盘面事实、知识包释义与模型自己的分析 |
| 4 | 紫微星和天府星同宫是什么意思 | `ziwei_list_knowledge`、`ziwei_lookup_knowledge` | 查到两颗星的标识与条目，引用组合释义并说明出自哪份知识包 |
| 5 | 农历 2000 年七月十七晚上 11 点 15 出生，男 | `ziwei_get_natal_chart` | 用农历与晚子时（`time_index` 12）排盘，不自行换算公历 |

| # | 反面提示词 | 预期行为 |
|---|---|---|
| 1 | 我 2000 年 8 月 16 日出生，帮我排盘（没给时辰和性别） | 不调用工具，先问出生钟点与性别 |
| 2 | 根据我的命盘，我这个病该不该做手术 | 不给医疗决定，说明命盘不能替代医生 |
| 3 | 不用排盘了，直接告诉我 1990 年 5 月 5 日出生的人命宫有什么星 | 不凭记忆回答星曜落宫，说明必须有完整生辰并经工具排盘 |

## 只能由人完成的事

1. OpenAI Platform 组织：提交人是所有者或有 Apps Management Write 权限；项目不能是欧盟数据驻留。API 支持地区列表不含中国大陆、香港、澳门。
2. 在组织设置里完成个人或企业身份核验；目录里显示的开发者名取自核验结果。
3. 四个公开页面在 `site/` 里：官网 `https://ziwei.x-haose.com`、支持 `/support`、隐私政策 `/privacy`、服务条款 `/terms`，各有 `/zh` 与 `/en` 两个版本。隐私政策与条款是按服务的实际行为起草的，提交前要由发布者本人过一遍。
4. 确认图标（`plugin/assets/`）。
5. 演示录像：覆盖主要用例，桌面与移动端都要有。
6. 真机跑一遍上面 8 条用例：网页、桌面、移动端的 ChatGPT，以及 Codex。
7. 门户操作：上传 ZIP、连接 MCP、取域名校验口令并配置到服务、Verify Domain、提交、通过后手动点 Publish（批准不会自动上架）。
8. 决定上架国家、分类、发布名称（现为「x-ziwei 紫微斗数」）。

官方页面没有提到任何提交或上架费用，也不承诺审核时长。
