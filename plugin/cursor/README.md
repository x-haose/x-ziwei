# Cursor 插件

把紫微 Skill 和公网 MCP `https://ziwei.x-haose.com/mcp` 绑在一起。无鉴权。工具只有 `chart`、`to_text`。

Skill 在 `skills/ziwei/SKILL.md`，与 [`plugin/shared/skills/ziwei/SKILL.md`](../shared/skills/ziwei/SKILL.md) 内容相同。安装目录必须自带这份副本，Cursor 不接受跳出插件根目录的路径。

## 本地冒烟

把本目录拷进本地插件目录（拷贝，不要指到仓库外的符号链接）：

```bash
mkdir -p ~/.cursor/plugins/local
rm -rf ~/.cursor/plugins/local/ziwei
cp -a plugin/cursor ~/.cursor/plugins/local/ziwei
```

重载窗口（Developer: Reload Window）。在 Customize 里确认插件 `ziwei`、技能，以及 MCP `https://ziwei.x-haose.com/mcp`。然后用自然语言问一次排盘，例如「阳历 2000-8-16 寅时女命，排紫微盘」。回答前必须先调用 `chart` 或 `to_text`。

Team / Enterprise 若关闭了 Allow Local Plugin Imports，这个目录不会被加载。同名市场插件已安装时，市场安装优先于本地副本。

提交 Cursor Marketplace 不在本期。
