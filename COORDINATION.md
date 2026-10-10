# 第 6–15 章协调进度

由协调员云端会话维护（[协调员会话](https://claude.ai/code/session_016zxHxZtmZrxE1GBT4hKD1y)，routine `trig_0159isoeLhFKa8WefBAJZVxN`）。每次状态变化都会更新本文件。

- 同时最多 5 个章节会话；第 11–15 章按章号顺序补位启动。
- 一章完成的标志：`main` 上出现 `chK: done` 提交。完成后协调员检查登记点、JS 语法、本地资源 200、参考代码，结果写进下表。
- 状态：未开始 / 进行中 / 已完成 / 已检查 / 失败

最后更新：2026-10-10 05:15Z

## 章节状态

| 章 | 标题 | 状态 | routine | 会话 | 备注 |
|---|---|---|---|---|---|
| 6 | 组合运动规划 | 进行中 | `trig_01R6CAqeyBQCo2A8WwXribZa` | [session_0117GumvYmhBtHRLGhhL48th](https://claude.ai/code/session_0117GumvYmhBtHRLGhhL48th) | 05:00Z 启动 |
| 7 | 基本运动规划的扩展 | 进行中 | `trig_01HR8QKJxrKurKgKeXsTEjes` | [session_01Aa1PwCbVCxgd8GL2gy2Pgi](https://claude.ai/code/session_01Aa1PwCbVCxgd8GL2gy2Pgi) | 05:00Z 启动 |
| 8 | 反馈运动规划 | 进行中 | `trig_019j1vwSbESxrPviAm5iwigP` | [session_01VTScaP35cowZfXUBrbhqsc](https://claude.ai/code/session_01VTScaP35cowZfXUBrbhqsc) | 05:00Z 启动 |
| 9 | 基本决策论 | 进行中 | `trig_014uPd7zaCLkKo7qjrajZnoQ` | [session_0174jCCz4ZuML9JoY7fpS7K5](https://claude.ai/code/session_0174jCCz4ZuML9JoY7fpS7K5) | 05:00Z 启动 |
| 10 | 序贯决策论 | 进行中 | `trig_01GVoGZU2XKfExAd5uFF6Gp1` | [session_01AxFPc7D1sLo1sdLi5ufFVL](https://claude.ai/code/session_01AxFPc7D1sLo1sdLi5ufFVL) | 05:00Z 启动 |
| 11 | 传感器与信息空间 | 未开始 | — | — | 等名额 |
| 12 | 感知不确定下的规划 | 未开始 | — | — | 等名额 |
| 13 | 微分模型 | 未开始 | — | — | 等名额 |
| 14 | 微分约束下的采样规划 | 未开始 | — | — | 等名额 |
| 15 | 系统理论与解析方法 | 未开始 | — | — | 等名额 |

## 协调员修过的问题

（暂无）

## 协调员的决定

- 本会话里没有名为 RemoteTrigger 的工具，改用等价的 Claude Code Remote 工具：`create_trigger`（`create_new_session_on_fire`、`run_once_at`、`connectors: []` 代替 `clear_mcp_connections`）启动章节会话，`get_trigger` / `get_session` 代替 `list_runs` / `get_run_log` 查运行状态。
