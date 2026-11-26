# 运限的金标

同一生辰（公历 2000-8-16，时辰序号 2，女）在不同运限目标下的盘面文本，取自服务端 `POST /v1/horoscope` 的 `data.text`（x-iztro 0.9.0）。网页对话的 `ziwei_get_horoscope` 工具（`apps/web/app/chat/chat.test.ts`）与它逐字比对，两边对同一目标写到同一层。

| 文件 | `target` |
|---|---|
| `year.md` | `{"year": 2026}` |
| `month.md` | `{"year": 2026, "month": 7}` |
| `day.md` | `{"date": "2026-11-26"}` |
| `hour.md` | `{"date": "2026-11-26", "clock": "23:10"}` |

内核升级后重新生成：`x-ziwei serve --listen 127.0.0.1:18080`，按上表逐个请求，`birth` 为 `{"calendar":"solar","date":"2000-8-16","time_index":2,"gender":"female"}`，把 `data.text` 原样写回对应文件（不加末尾换行）。
