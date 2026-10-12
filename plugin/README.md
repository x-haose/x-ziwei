# 插件

两层：公网 MCP 只有 `https://ziwei.x-haose.com/mcp`；客户端插件把 Skill 和这个 URL 绑在一起。服务不在这里分叉。

| 路径 | 作用 |
|---|---|
| [`shared/skills/ziwei/SKILL.md`](shared/skills/ziwei/SKILL.md) | Skill 原文。先调 `chart` / `to_text`，再解释。 |
| [`cursor/`](cursor/README.md) | Cursor 插件。本地冒烟目录 `~/.cursor/plugins/local/ziwei`。 |
| [`claude/`](claude/README.md) | Claude Code 插件。`--plugin-dir`，或从本仓库 `marketplace add`。 |

`cursor/skills/ziwei/SKILL.md` 与 `claude/skills/ziwei/SKILL.md` 必须和 shared 原文逐字相同。各客户端只扫描自己的插件根，不能引用插件外的路径。

没有插件壳的客户端见 [`docs/clients/README.md`](../docs/clients/README.md)。Cursor Marketplace 与 Claude 官方目录的提交不在本期。
