# Cursor 插件

把紫微 Skill 和公网 MCP `https://ziwei.x-haose.com/mcp` 绑在一起。无鉴权。工具只有 `chart`、`to_text`。

Skill 在 `skills/ziwei/SKILL.md`，与 [`plugin/shared/skills/ziwei/SKILL.md`](../shared/skills/ziwei/SKILL.md) 内容相同。安装目录必须自带这份副本，Cursor 不接受跳出插件根目录的路径。

## 安装

产品路径是市场，不是把目录拷进 `~/.cursor/plugins/local`。

Cursor 官方 Marketplace **未提交、未上架**。在那之前，团队用 Dashboard → Plugins & MCPs → Team Marketplaces → Add Marketplace → **Import from Repo**，仓库填：

https://github.com/x-haose/x-ziwei

仓库根 [`.cursor-plugin/marketplace.json`](../../.cursor-plugin/marketplace.json) 列出插件 `ziwei`，`source` 为 `plugin/cursor`。导入后在团队市场里安装 `ziwei`。这是团队从本仓库导入，不是官方 Cursor Marketplace 上架。以后提交官方市场也用这份清单。

装好后用自然语言问一次排盘，例如「阳历 2000-8-16 寅时女命，排紫微盘」。回答前必须先调用 `chart` 或 `to_text`。

上架状态见 [`docs/clients/publish-status.md`](../../docs/clients/publish-status.md)。

## 开发者自测

贡献者在本机确认插件目录能被 Cursor 加载时，才把本目录拷进本地插件目录（拷贝，不要指到仓库外的符号链接）。这不是产品安装路径。

```bash
mkdir -p ~/.cursor/plugins/local
rm -rf ~/.cursor/plugins/local/ziwei
cp -a plugin/cursor ~/.cursor/plugins/local/ziwei
```

重载窗口（Developer: Reload Window）。在 Customize 里确认插件 `ziwei`、技能，以及 MCP `https://ziwei.x-haose.com/mcp`。

Team / Enterprise 若关闭了 Allow Local Plugin Imports，这个目录不会被加载。同名市场插件已安装时，市场安装优先于本地副本。
