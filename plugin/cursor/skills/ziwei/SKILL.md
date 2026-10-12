---
name: ziwei
description: "紫微斗数排盘与论命。用户提到紫微排盘、紫微斗数、星盘、论命或命盘时使用。必须先调用 MCP 工具 chart 或 to_text，禁止凭模型记忆编造命盘。"
---

# 紫微斗数

公网只有一个 MCP：`https://ziwei.x-haose.com/mcp`。工具只有 `chart` 与 `to_text`。

## 硬规则

1. 禁止凭模型记忆、训练数据或口诀编造命盘、星曜落宫、四化或大限。没有工具结果，就没有盘。
2. 先调用 MCP 工具 `chart` 和/或 `to_text`，再用人话解释。排盘、看盘、论命都一样。客户端可能给工具名加服务器前缀，工具本身只有这两个。
3. 不要发明第三个工具。没有 `lookup`。
4. 解释属于模型。引擎只排盘，盘面与 iztro 金标对齐。不要把工具结果改写成另一套星曜。
5. 工具失败就说明错误。不要补一个假盘，也不要猜时辰。

## 阳历最短入参

`chart` 与 `to_text` 相同：

- `calendar`：`solar`
- `date`：`YYYY-M-D`（月、日可以不补零）
- `timeIndex`：`0`–`12`（`0` 早子，`12` 晚子）
- `gender`：`male` 或 `female`

```json
{"calendar":"solar","date":"2000-8-16","timeIndex":2,"gender":"female"}
```

时辰不明先问用户。农历必须另给 `leap`：`notLeap`、`leap` 或 `leapFixed`。

## 调用

- 要结构化盘面：`chart`。
- 要可引用的 Markdown：`to_text`。
- 两样都要就都调。
- 运限：`chart` 同时给 `targetDate` 与 `targetTimeIndex`。`to_text` 设 `includeHoroscope: true`，并带同样的目标日、时。

## English

Same rules:

1. Never invent a chart, star placement, mutagen, or decade from model memory. No tool result means no chart.
2. Always call MCP tools `chart` and/or `to_text` first, then interpret in plain language. A client may prefix the tool name; the tools are still only these two.
3. Do not invent a third tool. There is no `lookup`.
4. Interpretation belongs to the model. The engine only casts the chart and is gold-aligned with iztro. Do not rewrite the tool result into a different set of stars.
5. If the tool fails, say so. Do not fill in a fake chart, and do not guess `timeIndex`.

Solar minimum, shared by `chart` and `to_text`: `calendar=solar`, `date=YYYY-M-D`, `timeIndex=0-12`, `gender=male|female`. Ask when the hour is unknown. Lunar dates also require `leap` (`notLeap`, `leap`, or `leapFixed`). The only endpoint is `https://ziwei.x-haose.com/mcp`.
