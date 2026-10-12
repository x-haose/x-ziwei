# 连接器

没有 Cursor / Claude 插件壳时，把同一个公网 MCP 填进连接器。地址：

https://ziwei.x-haose.com/mcp

Streamable HTTP，无鉴权。工具只有 `chart`、`to_text`。这些客户端不带本仓库的 Skill，把 [`instructions.md`](instructions.md) 贴进系统提示或自定义说明。

下面只写当前文档里能核对的入口。没有官方插件壳的产品，不要当成已经上架。Cursor 与 Claude 的市场上架状态见 [publish-status.md](publish-status.md)。

## ChatGPT

网页：[ChatGPT Plugins](https://chatgpt.com/plugins)。点加号，选 **Add custom MCP server**。Connection 里 Server URL 填 `https://ziwei.x-haose.com/mcp`。认证选 **No authentication**。确认风险提示后 **Create as a plugin**，装上之后在对话里用 `@` 选中。

支持 SSE 与 streaming HTTP。工作区权限和 Lockdown 仍适用。这是用户自己添加的自定义 MCP，不是已发布的目录插件。

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

## Codex / OpenAI Agents

Codex 的 Streamable HTTP 条目在 `~/.codex/config.toml`（受信任的项目也可用项目里的 `.codex/config.toml`）。ChatGPT 桌面端、Codex CLI、IDE 扩展共用这份配置。

```toml
[mcp_servers.ziwei]
url = "https://ziwei.x-haose.com/mcp"
```

等价命令：

```bash
codex mcp add ziwei --url https://ziwei.x-haose.com/mcp
```

不要加 bearer token，也不要跑 `codex mcp login`。文档写明：没有任何凭证来源时，Codex 可以无认证连接。桌面端或 IDE 里选 Streamable HTTP，URL 填同一地址。

OpenAI Agents SDK 走 Responses 托管调用时，用 `HostedMCPTool`，`server_url` 为 `https://ziwei.x-haose.com/mcp`。进程内自己连则用 `MCPServerStreamableHttp`，`params["url"]` 为同一地址。两种都不要附带 Authorization。

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
