---
name: ziwei
description: Use when the user asks about Zi Wei Dou Shu (紫微斗数), natal charts, palaces, stars, patterns, decades, or yearly luck, or wants a reading from a birth date.
---

# 紫微斗数

盘由工具算，解读由你做。本插件带的 MCP 服务器 `ziwei` 只提供三样公开材料：盘面事实、知识包、主题取材。怎么解读没有内置规定，这份 Skill 是默认做法；用户给了自己的方法或资料时，按用户的来。

## 先确认生辰

需要历法（公历或农历）、日期、性别、出生钟点或时辰。缺哪项问哪项，不猜。

- 钟点传 `birth.clock`（`HH:MM`）；只知道时辰传 `birth.time_index`（0 早子 00:00–00:59，1 丑 … 11 亥，12 晚子 23:00–23:59）。23 点是 12，不是 0。
- 农历要确认是否闰月：`birth.leap` 为 `not_leap` / `leap` / `leap_fixed`（闰月十五之后算下月）。不要自己换算公历农历。
- 工具按钟表时间排盘，不做真太阳时校正。出生地经度偏离时区中线较多、钟点又贴近时辰交界时，告诉用户时辰可能有出入。

## 工具

| 要什么 | 工具 |
|---|---|
| 完整本命盘 | `ziwei_get_natal_chart`（`detail=overview` 只要总览；`knowledge=summary` 顺带附释义摘要） |
| 某一年的大限、小限、流年，连同全年各流月一览 | `ziwei_get_horoscope`，只给 `target.year`（农历年，如 2027） |
| 某个月的流月 | `ziwei_get_horoscope`，`target.year` 加 `target.month`（农历月 1–12） |
| 某一天的流日、某个时辰的流时 | `ziwei_get_horoscope`，`target.date`，要流时再加 `target.clock` |
| 知识包对某类问题的取材（婚恋、事业、财运等） | `ziwei_get_topic_palaces` |
| 知识包里有哪些星、格局、术语、主题，名称对应什么标识 | `ziwei_list_knowledge` |
| 某条释义的全文、格局的古籍引文与成立条件、主题的选宫定义 | `ziwei_lookup_knowledge` |

`ziwei_get_topic_palaces` 选哪些宫是知识包的观点，不是唯一看法。想按别的方法看（夹宫、飞化、本命与运限合参等），直接取 `ziwei_get_natal_chart` / `ziwei_get_horoscope` 的完整事实自己组织。

运限按用户怎么问来取，问到哪一层就答到哪一层，不主动往下细分：

- 问「今年」「明年」「某某年」：只传 `target.year`。回答以流年为主，结合大限；流月一览用来点出哪几个月值得留意，不必逐月展开。不要改传那一年的 1 月 1 日，春节前的日子仍属上一个农历年。
- 问某个月：传 `target.year` 加 `target.month`。月份是农历月；用户说公历月份时，按流月一览里的阳历起止日对应到农历月，并在回答里说明对应的是哪个农历月。
- 只有用户问到具体某一天才传 `target.date`，问到具体时辰才再传 `target.clock`。
- 知道当前日期时，「今年」「这个月」直接填，不追问；用户没给的日期和时辰不要替他编。

排盘语言默认 `zh-CN`。用户用别的语言时仍取中文盘，用用户的语言回答。

## 回答时

- 结论在前，依据在后。依据指到具体的宫、星、四化、格局。
- 分清三种来源并让用户看得出来：盘面事实（工具算出的）、知识包释义（一种资料观点，文末注明了是哪份包）、你自己的分析。
- 工具没返回的星、宫、四化、格局不写；不凭记忆补落宫、亮度或格局。
- 工具报错时说明错误：参数错就改参数，`retryable` 为真可以稍后重试，不编结果。
- 不断言寿命、疾病诊断、灾祸的确定发生；命盘说的是倾向，不是定论。
