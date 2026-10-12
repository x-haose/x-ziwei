# 插件

两层：公网 MCP 只有 `https://ziwei.x-haose.com/mcp`；客户端插件把 Skill 和这个 URL 绑在一起。服务不在这里分叉。

| 路径 | 作用 |
|---|---|
| [`shared/skills/ziwei/SKILL.md`](shared/skills/ziwei/SKILL.md) | Skill 原文。先调 `chart` / `to_text`，再解释。 |
| [`cursor/`](cursor/README.md) | Cursor 插件。本地冒烟目录 `~/.cursor/plugins/local/ziwei`。 |
| [`claude/`](claude/README.md) | Claude Code 插件，也是 ChatGPT / Codex 市场条目 `ziwei` 的包。Skill 与 `.mcp.json` 都在这个目录。 |

仓库根两份市场清单指向同一插件目录 `./plugin/claude`：

| 文件 | 谁读 |
|---|---|
| [`.agents/plugins/marketplace.json`](../.agents/plugins/marketplace.json) | Codex 市场格式。Codex CLI 在两份都在时先读它。 |
| [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) | Claude 兼容格式。`claude plugin marketplace add` 仍用它。 |

`cursor/skills/ziwei/SKILL.md` 与 `claude/skills/ziwei/SKILL.md` 必须和 shared 原文逐字相同。各客户端只扫描自己的插件根，不能引用插件外的路径。

B 档（ChatGPT / Grok / Codex）见 [`docs/clients/README.md`](../docs/clients/README.md)。Cursor Marketplace、Claude 官方目录、ChatGPT 公开目录本期都未提交。GitHub 插件市场导入用上面的清单，状态见 [`docs/clients/publish-status.md`](../docs/clients/publish-status.md)。
