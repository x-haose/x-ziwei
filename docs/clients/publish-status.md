# 上架状态

公开目录都还没交。仓库里的清单只让「从本仓库安装」能找到插件，不等于已经上架。

| 渠道 | 状态 |
|---|---|
| Cursor 官方 Marketplace | 未提交 / 未上架 |
| Claude 官方插件目录 | 未提交 |
| Claude 自托管市场（本仓库） | 可用 |

Cursor 团队安装走 Dashboard → Plugins & MCPs → Team Marketplaces → **Import from Repo**，仓库 `https://github.com/x-haose/x-ziwei`。根目录 [`.cursor-plugin/marketplace.json`](../../.cursor-plugin/marketplace.json) 列出插件 `ziwei`，`source` 为 `plugin/cursor`。同一份清单留给以后提交官方 Marketplace；当前没有提交，Customize 的官方市场里搜不到 `ziwei`。

Claude 自托管市场用根目录 [`.claude-plugin/marketplace.json`](../../.claude-plugin/marketplace.json)，指向 `plugin/claude`。不拷贝目录：`claude plugin install ziwei --marketplace x-haose/x-ziwei`。

本地 `cp` 到 `~/.cursor/plugins/local` 只用于开发者自测，见 [`plugin/cursor/README.md`](../../plugin/cursor/README.md)。
