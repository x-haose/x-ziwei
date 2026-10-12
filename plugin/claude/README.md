# Claude Code 插件

把紫微 Skill 和公网 MCP `https://ziwei.x-haose.com/mcp` 绑在一起。`.mcp.json` 使用 `type: http`（Claude Code 也接受别名 `streamable-http`）。无鉴权。工具只有 `chart`、`to_text`。

Skill 在 `skills/ziwei/SKILL.md`，与 [`plugin/shared/skills/ziwei/SKILL.md`](../shared/skills/ziwei/SKILL.md) 内容相同。组件都在插件根目录，不放进 `.claude-plugin/`。

## 本地目录

在仓库里直接加载，不经过市场：

```bash
claude --plugin-dir ./plugin/claude
```

## 从本仓库安装

仓库根的 [`.claude-plugin/marketplace.json`](../../.claude-plugin/marketplace.json) 是本仓库的插件目录，用来让下面两条命令找到 `plugin/claude`。它不是 Claude 官方插件市场，本期也不提交官方目录。

```bash
claude plugin marketplace add x-haose/x-ziwei
claude plugin install ziwei@x-ziwei
```

会话里对应 `/plugin marketplace add x-haose/x-ziwei`，再安装 `ziwei@x-ziwei`。

装好后用自然语言问一次排盘。回答前必须先调用 `chart` 或 `to_text`。
