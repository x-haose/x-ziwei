# 插件

两层：公网 MCP 只有 `https://ziwei.x-haose.com/mcp`；客户端插件把 Skill 和这个 URL 绑在一起。服务不在这里分叉。

| 路径 | 作用 |
|---|---|
| [`shared/skills/ziwei/SKILL.md`](shared/skills/ziwei/SKILL.md) | Skill 原文。先调 `chart` / `to_text`，再解释。 |
| [`cursor/`](cursor/README.md) | Cursor 插件。官方 Marketplace 未上架；团队对本仓库 Import from Repo。 |
| [`claude/`](claude/README.md) | Claude Code 插件。本仓库自托管市场可装；官方目录未提交。 |

`cursor/skills/ziwei/SKILL.md` 与 `claude/skills/ziwei/SKILL.md` 必须和 shared 原文逐字相同。各客户端只扫描自己的插件根，不能引用插件外的路径。

没有插件壳的客户端见 [`docs/clients/README.md`](../docs/clients/README.md)。上架状态见 [`docs/clients/publish-status.md`](../docs/clients/publish-status.md)。
