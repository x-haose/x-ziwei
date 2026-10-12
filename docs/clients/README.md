# 连接器

B 档（ChatGPT / Grok / Codex）使用公网 MCP。A 档是 Cursor / Claude 插件，见 [`plugin/README.md`](../../plugin/README.md)。ChatGPT 有插件页，尚未进公开目录；能导入时走本仓 GitHub 插件市场，不是 Popular 里的一键安装。

公网只有这一个地址：

https://ziwei.x-haose.com/mcp

Streamable HTTP，无鉴权。工具只有 `chart`、`to_text`。市场里的 `ziwei` 自带 Skill。没有 Skill 通道时，把 [`instructions.md`](instructions.md) 贴进系统提示或自定义说明。

只写核对过的入口。有插件页不等于已经上架。状态见 [`publish-status.md`](publish-status.md)。

## ChatGPT

有插件页；尚未进公开目录；上架后主路径改为搜索「紫微 / ziwei」再点装。现在没有官方一键安装链接。

打开 [ChatGPT Plugins](https://chatgpt.com/plugins)（侧栏 **插件**）。页上有 Plugins、Popular（Gmail / GitHub 等）。右上角 **添加** 的菜单是三项，分开看：

### 添加插件市场

能导入市场时，这是公开目录上架前的主路径。它要的是 GitHub 仓库地址，不是只填 MCP URL，也不是上传 ZIP。

来源：[Importing and syncing plugin marketplaces from GitHub](https://help.openai.com/en/articles/20001504-importing-and-syncing-plugin-marketplaces-from-github)，[Plugin management](https://learn.chatgpt.com/zh-Hans/docs/enterprise/plugin-management)。

1. **添加** → **添加插件市场**。
2. Source 填 `https://github.com/x-haose/x-ziwei`。只要仓库 URL，不要带分支或子目录。
3. Path 留空。仓库根有 [`.agents/plugins/marketplace.json`](../../.agents/plugins/marketplace.json)（Codex）和 [`.claude-plugin/marketplace.json`](../../.claude-plugin/marketplace.json)（Claude），都列出 `ziwei`。不要把文件名填进 Path。Codex CLI 先读 `.agents` 那份。ChatGPT 导入在两份都在时先用哪一份，**待真机确认**。
4. Branch、tag 或 commit 可留空，用默认分支。
5. 导入后从该市场安装插件 `ziwei`。包在 [`plugin/claude`](../../plugin/claude)，Skill 与 `.mcp.json` 都指向 `https://ziwei.x-haose.com/mcp`，无鉴权。

工作区管理员文档的路径是 Admin > Plugins > Add > Import marketplace：Source、Path、可选的 Branch / tag / commit，然后授权 GitHub。个人界面的菜单名是「添加插件市场」，意思相同。

**待真机确认**：个人「添加插件市场」能否在没有工作区管理员控制台时导入这个公开仓库。个人表单字段是否与管理员的 Source / Path / Branch 用词一致，也待真机确认。导入之后个人界面上安装 `ziwei` 的具体点击，待真机确认。

OpenAI 写明：导入的插件若声明了 `mcp.json` 或 `.mcp.json`，会标成 Desktop only，只在 ChatGPT 桌面端运行，远程 HTTPS 也一样。网页对话要直接调工具时，用下面的「创建插件」。

Codex CLI 等价命令（市场名是清单里的 `x-ziwei`）：

```bash
codex plugin marketplace add x-haose/x-ziwei
codex plugin add ziwei@x-ziwei
```

来源：[Codex CLI reference](https://developers.openai.com/codex/cli/reference)。装好后新开一轮会话再使用。

### 创建插件

这是另一项。不经过插件市场、只接 MCP 时走这里。不要把它叫成「添加插件市场」。

来源：[Add custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server)。英文文档写的是 Plugins 页 plus button → **Add custom MCP server**。

1. Name 填 `ziwei`（描述可选）。
2. Connection 选 Server URL，填 `https://ziwei.x-haose.com/mcp`。不要选 Tunnel。
3. Authentication 选 **No authentication**。
4. 接受风险提示，**Create as a plugin**，然后 Install。
5. 对话里输入 `@`，选中这个插件。
6. 若有自定义说明 / 系统提示位，贴 [`instructions.md`](instructions.md) 的中文或英文段。先调 `chart` / `to_text`。

协议支持 SSE 与 streaming HTTP。工作区权限和 Lockdown 仍适用。

**待真机确认**：个人界面点「创建插件」之后，字段是否就是上面这份英文表单。

### 录制技能

「录制技能」是编写 Skill 的入口，不是紫微用户的安装路径。

公开目录的材料见 [`chatgpt-publish.md`](chatgpt-publish.md)。本期不提交。

## Grok

网页：打开 [grok.com/connectors](https://grok.com/connectors)，**New Connector** → **Custom**，URL 填 `https://ziwei.x-haose.com/mcp`。本服务无鉴权；对话框若要求认证，留空或不做 OAuth。Grok Business / Enterprise 要先由团队管理员在控制台加连接器，成员才能用。

Grok Build 也可以写进配置。命令会记到 `~/.grok/config.toml`：

```bash
grok mcp add --transport http ziwei https://ziwei.x-haose.com/mcp
```

或手写：

```toml
[mcp_servers.ziwei]
url = "https://ziwei.x-haose.com/mcp"
```

## Codex

带 Skill 的装法与上面的「添加插件市场」是同一仓库，用 `codex plugin marketplace add`，不要把这条叫成 ChatGPT 公开目录点装。只接 MCP、不装插件时，才写 `config.toml`。

来源：[Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp)，[Codex CLI reference](https://developers.openai.com/codex/cli/reference)。

1. 装插件：

```bash
codex plugin marketplace add x-haose/x-ziwei
codex plugin add ziwei@x-ziwei
```

2. 只接 MCP：

```bash
codex mcp add ziwei --url https://ziwei.x-haose.com/mcp
```

3. 第二条写入 `~/.codex/config.toml`。受信任的项目也可以用项目里的 `.codex/config.toml`：

```toml
[mcp_servers.ziwei]
url = "https://ziwei.x-haose.com/mcp"
```

4. 不要设 `bearer_token_env_var`。不要对这台服务器跑 `codex mcp login`。没有任何凭证来源时，Codex 可以无认证连接。
5. ChatGPT 桌面端、Codex CLI、IDE 扩展共用这份 MCP 配置。界面里若有 MCP 添加入口，选 Streamable HTTP，URL 填同一地址。IDE 扩展不能浏览插件。

OpenAI Agents SDK 是旁路，不是产品路径。托管调用用 `HostedMCPTool`，`server_url` 为 `https://ziwei.x-haose.com/mcp`。进程内自己连用 `MCPServerStreamableHttp`，`params["url"]` 为同一地址。两种都不要附带 Authorization。

## 其他 Streamable HTTP 客户端

能填远程 MCP URL 的客户端，地址都是 `https://ziwei.x-haose.com/mcp`，不要加认证头。

Cascade（Windsurf / Devin Desktop）的远程 HTTP 条目用 `serverUrl`。在 MCP 菜单里打开配置文件再写入。当前 Devin 文档的默认路径是 `~/.config/devin/mcp_config.json`（设置了 `XDG_CONFIG_HOME` 时走该目录）。

```json
{
  "mcpServers": {
    "ziwei": {
      "serverUrl": "https://ziwei.x-haose.com/mcp"
    }
  }
}
```
