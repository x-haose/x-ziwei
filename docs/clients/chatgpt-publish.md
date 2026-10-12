# ChatGPT 公开目录

紫微尚未提交，也尚未上架。下面只列 OpenAI 文档里的最短路径和材料，不代替实际提交。

公开目录上架前，能导入市场的用户走 **添加 → 添加插件市场**，见 [`README.md`](README.md)。自定义 MCP 是备用。上架之后，主路径改为在 [ChatGPT Plugins](https://chatgpt.com/plugins) 搜索「紫微 / ziwei」再点装。OpenAI 写明：批准后还要自己发布，插件才会出现在 ChatGPT 与 Codex 共用的目录里；目录主页面只有被选中 enhanced distribution 才会展示。确认是否上架，用发布名称搜索，或打开提交门户里的目录链接。紫微未发布，不要当成已经能在 Popular 里点装。

## 官方路径

提交流程以 [Upload and submit your plugin](https://developers.openai.com/plugins/deploy/submission) 为准。远程 MCP 的组织核验、权限和服务器要求见 [Remote MCP server review requirements](https://developers.openai.com/plugins/deploy/app-review)。

1. 在组织设置完成个人或企业身份核验。组织所有者可提交；其他人需要 `api.apps.write`。欧盟数据驻留的项目目前不能提交带 MCP 的插件。
2. 打开 Plugins，选 **Upload new or existing plugin**。选已核验的 Developer identity，上传 ZIP。
3. MCP 必须写进第一份 ZIP。已有的纯 Skill 插件目前不能后补 MCP。一个插件只能连接一台 MCP。
4. 在 MCPs 里 Connect：核对 Server URL 与 Authentication，完成门户给出的域名校验，等工具扫描结束。
5. 补齐审阅材料，处理必须先解决的检查，勾选政策确认，**Submit for review**。
6. 通过后在门户里自己点 **Publish plugin**。批准不会自动上架。

本服务用通用 URL，不要选 Template：

https://ziwei.x-haose.com/mcp

无鉴权。门户连接表单支持 No authentication。不要在包里放 token，也不要把需要登录的服务器标成无认证。

域名校验：把门户给出的 challenge token 以纯文本放在它指定的地址，形如 `https://<challenge-base-host>/.well-known/openai-apps-challenge`。只返回该 token，不要包成 JSON。

## 材料清单

ZIP 里要有插件清单，以及恰好一台远程 MCP（Agent Plugins 用根目录 `mcp.json`，Codex 格式用 `.mcp.json`）。公开提交不收带 `apps` / `.app.json` 或 lifecycle hooks 的包。

MCP 公开审阅要有这些上架字段（限额以文档为准）：

- `displayName`、`shortDescription`（各至多 30 字）、`longDescription`、`developerName`、`category`
- `websiteURL`、`supportURL`、`privacyPolicyURL`、`termsOfServiceURL`（HTTPS，无内嵌凭证）
- 主图标（方形，至少 48×48；PNG、JPEG、WebP 或 SVG，单张至多 5 MiB）

发布名称要能被搜到「紫微 / ziwei」。四个 HTTPS 链接本仓库还没有对应页面，提交前要单独备好。

初次 MCP 审阅还要：

- 正面用例 5 条：场景、用户提示、期望工具、期望结果
- 反面用例 3 条：不该完成的请求，以及拒绝、追问或安全退路
- 审阅可打开的演示录像 URL
- 这一版的 release notes
- 本服务无登录，不需要审阅账号。账号若以后需要，只填在门户的 Review details，不要写进 ZIP

工具只有 `chart`、`to_text`。扫描会收走工具名、说明、schema、注解和服务器 `instructions`。只读行为要在服务器上标 `readOnlyHint: true`，不要只在说明文字里改口。

## 本期不做

不上传 ZIP，不点 Submit for review，不点 Publish。不声称已经出现在 Popular 或搜索结果里。
