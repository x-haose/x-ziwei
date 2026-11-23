# 路线

各渠道的定位见 AGENTS.md「产品形态」。本页记功能范围、选型、设计流程、顺序与进度。定于 2026-11-23。

## 选型

版本为 2026-11-23 查 npm、crates.io 与官方文档所得。网页框架一项用同一个假 WASM 包（包内 `new URL('./x.wasm', import.meta.url)` 加 `instantiateStreaming`，主线程与模块 Worker 各加载一次）把各候选实际构建，在 Chromium、WebKit 与 macOS 上的 Tauri 2.12.7 里跑通。

| 问题 | 选择 | 比较过的候选与判据 |
|---|---|---|
| 网页放哪 | 产品站 `apps/web`：排盘工具与帮助页（现 `site/` 的内容）同一个应用、同一套设计，上线时接管 `ziwei.x-haose.com`，`site/` 随之下线 | 维护者定：现 `site/` 属于产品帮助，真正的开发文档是 x-iztro 文档站；分成两站会让用户在两套设计间来回跳 |
| 网页框架 | React Router 8.5.2 framework mode，`ssr:false` 加 `prerender` | Next 16.4.6 静态导出（框架底座首页 JS 133.8 KB gz，Tauri 指南停在 14.2.3，Turbopack Worker 有回归史）；TanStack Start 1.169.7（稳定版 6 周，开 SPA 模式后未产出路由正文 HTML）；Vite + TanStack Router 纯 SPA（无预渲染，SEO 要靠标为实验性的 API 自搭）；SvelteKit 3.4.0（首页 JS 34.8 KB，最强对手，但帮助页要用的 Fumadocs 只支持 React 框架）；SolidStart 2.2.3（不支持刚发布的 Solid 2.0）。RR8：「纯静态、部分预渲染、其余走 SPA 回退」是官方正式部署形态，需要服务端的写法构建期报错，与 Tauri 无 Node 服务端的约束一致；首页 JS 106.8 KB |
| 前端库与构建 | React 19.3.1，Vite 8.3.8 | 见上；网页与桌面同一条构建链 |
| 桌面 | Tauri 2（cli 2.12.6、crate 2.12.7），`frontendDist` 即 `apps/web` 的 `build/client` | gpui 0.2.2：界面要再写一遍且 0.x 接口不稳。平台差异放在网页应用的平台层：LLM 请求经 `@tauri-apps/plugin-http` 2.9.0 绕开 CORS、文件导入导出、系统浏览器打开外链；用 `TAURI_ENV_*` 在构建期区分，网页包不含 Tauri 代码 |
| 交互组件 | React Aria Components 1.22.1 | Base UI 1.9.0（无 Tree、无拖放、无内置中文文案）；Radix（无 IME 处理，近一年基本一人维护、有约 10 个月未发版）；Ark UI。React Aria 自带 zh-CN 文案，有知识包编辑器要用的 Tree、GridList、拖放。四家都不支持农历，生辰表单用 Select、NumberField、RadioGroup、ToggleButtonGroup 自己组合 |
| shadcn/ui | 不用，只参考接线写法 | 它的价值在默认类名串，正是要去掉的通用观感 |
| 样式 | vanilla-extract（css 1.21.3、vite-plugin 5.2.6） | Tailwind 4.3.5（任意值可绕开令牌，暗色漏写静默沿用亮色）；CSS Modules（`var()` 拼错静默失效）；Panda 2.6.0（要 codegen、限动态值）；StyleX 0.19.2（要走 babel）。vanilla-extract 用 theme contract 管令牌，令牌写错或明暗漏写都编译报错，零运行时 |
| 动效 | CSS 为主，Motion 14.14.0（LazyMotion）为辅，View Transitions 只作增强 | GSAP 3.15.1 是 Webflow 专有许可、可单方修改，不选。描线用 SVG `pathLength` 加 dashoffset；可打断的进出场用 Motion；尊重「减少动态效果」 |
| 命盘绘制 | Grid 排格子与文字，SVG 只画连线 | Canvas、纯 SVG：中文清晰度、无障碍、按断点重排都不如 |
| 保存图片 | modern-screenshot 4.7.0 | 先用子集字体在 Tauri macOS、Tauri Linux、iOS Safari 各导出一张；不通过就整体换 Takumi 2.22.1（网页 WASM、桌面 Rust crate） |
| 图标 | 自绘约 30 个 | Lucide 是 shadcn 与 Fumadocs 的默认观感；Phosphor、Iconoir、Tabler 作缺漏时的改绘底稿 |
| Markdown | react-markdown 10.1.0 + remend 1.5.0 + remark-gfm + remark-cjk-friendly 2.3.4（约 69 KB gz） | Streamdown 2.8.0 加 CJK 插件约 175 KB gz，大头是允许原始 HTML 的 parse5，模型输出不该允许；对话界面届时再评估 |
| 本机存储 | idb 8.0.4 | idb-keyval 6.3.0 不支持迁移与索引；Dexie 4.4.7 体积大 20 倍 |
| 状态 | 第一期不用库，之后视需要 Zustand 5.1.0 | Jotai、XState 对场景无额外收益 |
| 分享链接 | 生辰放在 `#` 之后，自写 `useSyncExternalStore`；非法 hash 明确报错 | nuqs 不支持 hash |
| 中文字体 | 只用 OFL 字体（思源宋、思源黑、Geist、Geist Mono），自托管同源；原文件按固定提交的地址下载并校验 SHA-256，不进仓库；构建时用 HarfBuzz（subset-font 2.9.0、harfbuzzjs 1.6.4）按 Google Fonts 的简体中文切片策略（googlefonts/nam-files）切片，首屏预载界面文案与盘面用字的关键子集；思源黑的许可证保留了字体名「Source」，切片改名 XZW Sans SC，版权与许可证字段保留；桌面复用同一份产物并附许可证 | 阿里普惠体、HarmonyOS Sans、MiSans、OPPO Sans 禁止转换或修改，方正、汉仪嵌入要书面授权；Google Fonts、jsDelivr 在大陆不可靠。cn-font-split 7.4.3（2026-11-23 实测）：安装脚本从 GitHub Release 下载原生库、不校验且失败被吞掉（`\|\| node -v`），产物丢掉 nameID 7、13、14、16（商标、许可证描述与网址），改用可控的 HarfBuzz 子集 |
| 包管理 | pnpm 12.21.0（`packageManager` 固定）。现阶段 `apps/web` 是独立的 pnpm 项目，自带锁文件，不建根目录工作区；出现第二个 JS 应用或 `packages/*` 时再加 workspaces 与 catalog，不用 Turborepo | npm（依赖提升致未声明依赖可用）；bun。不建根工作区的理由：`site/` 是线上 Vercel 项目，用 npm 与 package-lock 构建，又正被 OpenAI 审核引用，根目录出现 pnpm 工作区会改变它的安装与构建；它随帮助页迁入产品站下线。共享包直接导出 TS 源码，没有可缓存的构建 |
| 测试 | Vitest 5.1.1（含 browser mode 组件截图）、Playwright 1.65.1（跑静态产物）、`@wdio/tauri-service` 1.5.1（桌面冒烟） | Storybook 说不出专门防哪个问题，不加 |
| 浏览器内对话 | AI SDK 7（ai 7.0.179、@ai-sdk/react 4.0.183） | 各厂商官方 SDK（工具循环要各写一遍）、直接 fetch |

仓库结构：`apps/web` 独立安装（理由见上表包管理一行），`site/` 下线、出现共享包后根目录再加 pnpm workspace（成员 `apps/*`、`packages/*`）；`apps/web` 是第二个 Vercel 项目；`apps/desktop/src-tauri` 是独立的 Cargo 项目，不加入根 crate（Dockerfile 只拷根 crate，并入 workspace 会让服务端镜像构建失败）；`packages/*` 只放被两个以上应用用到的代码。

动工前要实测的：Windows（WebView2）与 Linux（WebKitGTK）上的 Tauri；真实 x-iztro 包与 Worker 里的八字反推；React Router 8 静态产物在 Vercel 上的部署；中英文路径前缀的预渲染与 hash 水合；Tauri HTTP 插件配合 AI SDK 的流式输出；`tauri dev` 下的 Worker 与 WASM；React Aria 弹层里拼音组字按 Esc（Safari、WKWebView）；保存图片在 WebKit 上的字体内嵌。

## 设计

设计先于代码：方向未定不写产品代码。网页与桌面共用一套设计规范。

已定：方向「星图」（2026-11-23 维护者从三个方向中选定）。设计规范 `docs/design/DESIGN.md` 是实现阶段的唯一设计依据，对照稿 `docs/design/mockup.html`。以下是选定前的流程记录。

1. 找参考：古代星图（苏州石刻天文图、敦煌星图）、古籍版式（点校本、线装书）、当代一流的工具与编辑类网站。每个参考写明取它哪一点。
2. 三个方向的高保真稿：真实盘面数据，排盘页（盘面 + 提示词）与首页首屏两屏，各有桌面与手机版，浏览器里直接打开。初步构想：
   - 星图：古天文图与仪器的气质，深靛夜色、发丝金线刻度，点宫时三方四正像星官连线那样画出。
   - 宣纸朱印：好书的排版，暖白纸、墨黑字、朱砂是唯一强调色，大留白、局部竖排，盘面像书页上的一张表。
   - 当代仪表：信息设计的做法，几乎只用黑白灰加一个强色，精确的排版，盘面像数据可视化，定位专业工具。
3. 维护者选定方向，或指定各方向的取舍组合。
4. 定设计规范：颜色、字体与字号阶梯、间距、线条、动效，加载、空与出错等状态。
5. 按规范实现，逐页对照设计稿走查，桌面与手机真机由维护者看。
6. 首页与文档页一并换成新设计。

不做：紫蓝渐变、渐变标题、毛玻璃卡片、顶着圆圈图标的卡片阵列、处处大圆角大阴影、emoji 当图标、居中大标题配两个按钮的模板首屏、中英文同一款无衬线字体没有层级。

中文字体先在开源可商用字体里选（思源宋体、霞鹜文楷、汇文明朝体等，用前核实许可证），网页按字符分片加载。要用商业字库须维护者同意购买授权。

## 1. x-iztro 的 JS 包

代码完成，经独立审查与三轮复审，在 x-iztro 的 dev 分支，待随 x-iztro 0.7.0 发布。`wasm32-unknown-unknown` + 现有 alloc/free 与 JSON 协议（可行性验证见 x-iztro 的 `docs/plan/2026-11-11-js-wasm-feasibility.md`），能力与 Python、Go 绑定一致，读同一批金标与快照。发布到 npm 需要维护者的 npm 账号。

## 2. 网页第一期：排盘与提示词

已完成（`apps/web`，排盘内核为 npm 包 x-iztro 0.7.0）：路由与语言前缀、设计令牌与明暗主题、字体管线、首页（内核排出的示例盘与引线）、排盘页、生辰表单（公历与农历含闰月）、命盘（十二宫、中宫、外圈刻度、三方四正连线、宫内收起、读数区）、四层运限、提示词（勾选各段、渲染与原文、复制原文与链接）、分享链接与最近排过、方法页（内容页模板）。

- 内核在浏览器里装载：页面打开后在 effect 里取 wasm（约 1.7 MB，gzip 约 0.5 MB），边下载边计数显示进度；失败显示原因并可重试。预渲染不触发装载。
- 农历：月份、闰月、月长、公历农历互换与年份干支都取自内核（流月一览、按日排盘、按农历排盘、流年干支），本仓库不做农历换算。x-iztro 没有直接的历法查询入口，这里借参照盘的流月一览取月长；在 x-iztro 补上历法入口后改用它。
- 盘面文字一律按 zh-CN 排，英文界面上的盘也是中文，与 reading.en.md「盘面是中文」的说明一致。
- 八字反推这一期用不到，没有做，也没有建 Worker。
- 根路径 `/`：纯静态站与桌面端都没有服务端读 `Accept-Language`，由预渲染页 `<head>` 里的脚本在绘制前按 `navigator.languages` 跳到 `/zh` 或 `/en`（找不到受支持的语言去中文），禁用脚本时页面上是两种语言的入口。比较过：托管平台按请求头改写（只在 Vercel 上有，桌面端没有）、一律去中文（忽略浏览器语言）。
- 主题：`<head>` 最前面的内联脚本读本机选择，在样式与正文之前写好 `data-theme`，首帧不闪；主题按钮的图标由 CSS 按 `data-pref` 显示，不等水合。

- 输入：公历或农历（含闰月）、年月日、时辰（13 档，含早子、晚子）、性别。
- 命盘：十二宫格，每宫主星（亮度、四化）、辅星杂耀、宫干支、大限岁数，标身宫与来因宫，中宫写基本信息；点宫高亮三方四正；选大限、流年、流月把运限叠上盘。
- 提示词：勾选本命盘、释义、某年运限、大限一览、若干年流年一览，写问题，一键复制；附 DeepSeek、豆包、Kimi、ChatGPT 等入口。提示词 = 解读方法（网页应用里的 `prompts/reading.<lang>.md`，没有工具可调的场合用的方法正文，与 Skill 并列维护）+ 盘面各段 + 问题。
- 分享链接把生辰放在 `#` 之后，不发给服务器；最近排过的盘存在本机浏览器。
- 隐私政策同步写明网页在浏览器里计算。

## 3. 知识包

未开始。

- 网页：导入、导出、编辑知识包文件，存在浏览器里，排盘与提示词直接用。
- 服务端加密托管，给 AI 插件渠道用和对外分享：
  - 建包时服务端随机生成数据钥匙加密整包，只存密文。分享链接含包编号与数据钥匙，只能读；管理钥匙另发给建包的人，服务端只存它的哈希，凭它写入、修改、删除。
  - 写入时先按知识包格式校验再加密，存不了任意文件；单包上限 1 MiB，每个地址每天的建包数有上限，总存储量超阈值告警。
  - 180 天无人使用即删除，任何人用一次重新计时。钥匙丢了找不回，所以提供导出，建库流程结束时让用户存一份 JSON。
  - 日志不记 `pack` 参数。
  - 对外说明：只在处理请求时内存里有明文，不落盘；有人凭分享链接举报，可以打开核实并删除。
  - 隐私政策、服务条款、站点知识包页同步改。
- 建库 Skill 单独一份，建库时才加载：读用户的材料，用 `ziwei_list_knowledge` 对上标准标识，整理成要点（不整段照抄原书），分批写入，报告覆盖与缺口，交出分享链接、管理钥匙并教用户存好链接。
- 写入类工具在 0.3.0 上架之后部署；插件 0.4.0 带建库 Skill、`capabilities` 加 Write，重新提交审核。

## 4. 网页用自己的 API Key 对话

未开始。支持 DeepSeek、OpenAI、Anthropic 与兼容 OpenAI 接口的服务，浏览器直连厂商，模型的工具调用在浏览器里执行 x-iztro。2026-11-23 实测跨域预检：DeepSeek、OpenAI 放行；Anthropic 要带 `anthropic-dangerous-direct-browser-access` 请求头。

## 5. 桌面（Tauri）

未开始。网页全部功能，加本机命盘档案（姓名、备注、标签）、本机知识包库、离线可用；作为 ACP 客户端启动用户已装的 Claude Code、Codex、Cursor 解盘，也可用自己的 API Key。ACP 的 Rust 库 agent-client-protocol 5.5.1；ACP 官方列表里 Claude、Codex 经适配器接入，Cursor 自带支持。Rust 外壳是独立的 Cargo 项目（`apps/desktop/src-tauri`），本机 MCP 按路径依赖根 crate 的库部分，不把两者并成一个 Cargo workspace。

## 帮助页迁入产品站

产品站已内置帮助页，内容单一来源：`apps/web` 构建时直接读仓库里的 `site/content/*.mdx` 与 `meta.json`（fumadocs-mdx 15.6.4 的 Vite 插件编译，fumadocs-core 16.19.7 出页面树与搜索索引，2026-11-23 查），不复制文件；界面是产品站自己的内容页模板，不用 fumadocs-ui。`site/` 仍在线上并被插件审核引用，在它下线之前两站读同一份内容，改内容只改 `site/content`。

- 地址与旧站一致：`/{lang}/install`、`tools`、`knowledge`、`api`、`self-host`、`privacy`、`terms`、`support`，全部预渲染；上架时填的网站、支持、隐私、条款四个地址不变。
- 给模型读的入口在构建时生成静态文件：`/llms.txt`（默认语言）、`/{lang}/llms.txt`、`/{lang}/llms-full.txt`，每页加 `.md` 取原文（含方法页）。
- 站内搜索：构建时生成索引 `/search.json`（两种语言一份），浏览器第一次搜索时下载，本地检索；中文按 Unicode 词边界分词。

上线时做：

- 把 `site/content` 搬进 `apps/web`，改内容源路径；`site/` 与它的 Vercel 项目下线，AGENTS.md「站点」一节随之改写。
- 按请求头 `Accept: text/markdown` 返回原文：纯静态站做不到，在托管侧配置条件改写到对应的 `.md`，要实测。

## 暂缓

- 大陆访问速度：站点在 Vercel、接口经 Cloudflare，大陆实际可用性没测过。若要国内节点，牵涉备案与费用。
- 桌面安装包签名：macOS 公证要付费开发者账号，Windows 要代码签名证书。
