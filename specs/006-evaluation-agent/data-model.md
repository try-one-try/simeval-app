# 助手数据与接口实施约定

2026-10-03。功能边界见 [spec.md](spec.md)。本文件固定本次增量迁移和接口实现约束。

## 数据

- `AssistantSession`：账号、每次登录的随机访问标识、任务、显式基线、标题。查询必须同时限制账号和访问标识。
- `AssistantTurn`：问题、唯一请求标识、状态、答案、问答快照、证据、工具记录、来源摘要、模型用量、费用预留、截止时间。`sessionId + requestKey` 唯一，重复请求不能重新调用模型。
- `AssistantBudget`：应用累计额度账本，以整数微美元保存。事务锁同一行后预留单轮最坏费用；知道实际用量才退回差额，异常且用量未知保留预留。默认演示额度 3 美元，不自动按日期重置。
- `AIReport`：复用已有表。从成功分析显式生成当前任务的结构化业务报告，使用系统指标与样本复核内容，避免把私聊和无权查看的比较文本自动共享。只由 REVIEWER 确认；保存和确认都检查来源版本并写审计。

新增表不清理既有评测或复核数据。开发迁移使用 `.env.local`，执行前核对端点与保存的正式端点不同。

## 接口分工

`GET/POST /api/assistant/sessions` 列表／创建；`GET /api/assistant/sessions/{sessionId}` 恢复历史；`POST /api/assistant/sessions/{sessionId}/messages` 发送并返回 NDJSON 流；`POST /api/assistant/sessions/{sessionId}/turns/{turnId}/stop` 停止。客户端只传新问题、请求标识和样本提示，不传可伪造的历史角色或登录访问标识。

`GET/POST /api/ai-reports` 列表／从成功轮次保存报告；`GET /api/ai-reports/{reportId}` 详情；`POST /api/ai-reports/{reportId}/confirm` 确认。完整 HTTP 契约随实现更新到 `docs/openapi.yaml` 和 `docs/api-contract.md`。

## 状态

轮次由 RUNNING 进入 SUCCEEDED、FAILED、CANCELLED、TIMED_OUT 之一。写终态需条件匹配，停止后晚到的成功不得覆盖。遗留运行在读取或下次请求时按截止时间收敛；不承诺关闭页面后继续执行或恢复推理。

本阶段由负责人手工功能验收，不新增或运行 Agent 自动化测试。
