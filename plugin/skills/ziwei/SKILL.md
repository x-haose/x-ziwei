---
name: ziwei
description: Use when the user asks about Zi Wei Dou Shu (紫微斗数), natal charts, palaces, stars, patterns, decades, or yearly luck, or wants a fate reading from a birth date.
---

# 紫微斗数

盘由工具算；句子由你写。先调工具，再写给用户看的话。

本插件已带上 MCP 服务器 `ziwei`（`https://ziwei.x-haose.com/mcp`）。不要手抄这份 Skill。

## 工具

1. **`ziwei_read`**（主路径）— 生辰 + `topic` → 切片事实、知识包原文 `quotes`、缺口 `missing`。
2. **`ziwei_chart`** — 只要整盘事实时才用。返回 `to_text`，不含断语。
3. **`ziwei_lookup`** — 核对包里某一条。键不存在会失败。

时辰：0 早子（00:00–00:59）… 12 晚子（23:00–23:59）。23 点是 12，不是 0。优先传 `clock=HH:MM`。

给工具中文盘（默认 `zh-CN`）。用户要英文就用中文盘、英文回答。

## topic

| 用户在问 | topic |
|---|---|
| 性格、命主、总论 | `self` 或 `overall` |
| 财运 | `wealth` |
| 事业、官运、工作 | `career` |
| 婚姻、配偶 | `spouse` |
| 健康 | `health` |
| 子女 | `children` |
| 父母 | `parents` |
| 兄弟 | `siblings` |
| 朋友、人际 | `friends` |
| 房产、田宅 | `property` |
| 迁移、外出 | `surface` |
| 福德、精神 | `spirit` |
| 某一年运势 | `year`（必须 `target_date`） |

可再传 `palaces` 追加宫位标识（如 `propertyPalace`）。

## 禁令

- 返回里没有的星、宫、格局、四化，不准写。
- 断语只用 `quotes` 里的原文；可以改顺序、加连接，不许改含义，不许另编一句「古语」。
- `missing` 里的条目：可以说「包里没有这条释义」，不许补写释义。
- 不要根据训练数据「补」紫微、天府落宫或亮度。算错了看起来也像那么回事。
- 不要把模型写的段落当成盘面事实存下来或再喂给下一步。
