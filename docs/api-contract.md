# SimEval HTTP 接口说明

[OpenAPI](openapi.yaml) 是方法、字段与实现状态的权威契约。本文解释调用和取舍；认证会话由 Auth.js 管理，不把其内部路由算成业务 API。

## 1. 可调用与待实施

**2026-09-27，接口版本 0.6.0。** 质量／评测十项操作，加上比较、异常列表／详情、结论编辑共十四项已实现。报告待阶段 5 验收后重新讨论；指派／重开未实现。

仅两个预设账号会话有效，旧 ADMIN 返回 401。工程师管理本人任务，评测人员只读任务；服务端拒绝越权写入。回补和人工分类退出当前产品，历史数据库关系保留。

## 2. 公共规则

- **身份与写入**：校验 Session、预设账号 email／isDemo 和数据库角色；写入要求同源 Origin、Zod 与业务权限。POST／PATCH／DELETE 都校验 Origin。
- **输入与分页**：ID 长 1–64，仅字母／数字／下划线／连字符；Body 拒绝多余字段。任务名 trim 后 1–120 字，Episode 1–10000，Seed 0–2147483647；目录另收紧 Episode。page 从 1，pageSize 默认 20／最多 100，任务按时间倒序＋ID 排序；异常按 sampleNumber＋ID 升序。
- **响应**：成功 `{data,meta:{requestId}}`；错误 `{error:{code,message,fieldErrors,requestId}}`。fieldErrors 为字段消息数组映射或 null；不泄漏 SQL、密码或堆栈。
- **幂等**：创建／重试／计划的报告生成带 1–128 字符 Idempotency-Key。同用户／操作／键及内容重复返回原对象；同键换内容 409。创建首次 201，重复 200。
- **四个标识**：requestId 跟踪一次请求；runId 定位任务；幂等键识别重复动作；expectedVersion 防止编辑覆盖。

## 3. 当前状态与模拟逻辑

PASSED 可创建，WARNING 明确接受，FAILED 阻断。基线可不选；选了才要求成功、同项目／数据／Benchmark／Episode／Seed、不同模型版本且未隐藏。可选 targetSuccessRate 为 0.8／0.85；这是达标目标，不参与指标计算。

创建保存 QUEUED；POST sync 创建后满 1 秒可进入 RUNNING、满 4 秒可完成，每次推进一段，无后台执行。GET 始终只读，运行中 progress 为 null。Mock 按创建时配置快照、模型参数、数据／基准难度、Seed 与 Episode 生成四项指标和两条预置 OPEN 证据片段，结果／终态／审计同事务提交，不代表执行真实 Episode。

QUEUED／RUNNING 可取消，完成竞争返回最新状态或 409；FAILED 重试新 ID 并保留 retryOfRunId。重试重新检查配置／质量，沿用审计中的真实警告接受；未接受的新 WARNING 返回 422。mockFailure 是故障展示，重试默认清除。

每个工程师最多同时有 3 个 QUEUED／RUNNING 任务；先锁账号行，再查幂等与容量。终态释放名额。软删除只允许本人终态、保护预置示例；列表和详情隐藏，被已有任务引用的指标仍保留，重复删除只写一次审计。

## 4. 可执行请求示例

先从网页进入演示会话，HTTP 客户端使用自己的本地 Session Cookie。不要保存或上传真实 Cookie。

```http
@baseUrl = http://localhost:3000
@sessionCookie = REPLACE_WITH_LOCAL_COOKIE_HEADER

### 可选目录：200，固定仓储项目
GET {{baseUrl}}/api/evaluation-catalog
Cookie: {{sessionCookie}}

### 质量报告：200，四项检查
GET {{baseUrl}}/api/datasets/demo-dataset-scenes-v3/quality
Cookie: {{sessionCookie}}

### 首次创建 201，同键同内容重复 200
POST {{baseUrl}}/api/evaluation-runs
Cookie: {{sessionCookie}}
Origin: http://localhost:3000
Content-Type: application/json
Idempotency-Key: interview-evaluation-001

{
  "name": "v2.4 仓储操作评测",
  "modelVersionId": "demo-model-candidate",
  "datasetVersionId": "demo-dataset-scenes-v3",
  "benchmarkId": "demo-benchmark-v1",
  "baselineRunId": null,
  "targetSuccessRate": 0.8,
  "episodeCount": 200,
  "simulationSeed": 20260901,
  "acceptQualityWarning": true,
  "mockFailure": false
}

### 将返回的 data.id 填入此处
@runId = REPLACE_WITH_CREATED_RUN_ID

### 列表
GET {{baseUrl}}/api/evaluation-runs?page=1&pageSize=20
Cookie: {{sessionCookie}}

### 详情与只读状态
GET {{baseUrl}}/api/evaluation-runs/{{runId}}
Cookie: {{sessionCookie}}

###
GET {{baseUrl}}/api/evaluation-runs/{{runId}}/status
Cookie: {{sessionCookie}}

### 创建后满 1 秒同步运行，满 4 秒再次同步完成
POST {{baseUrl}}/api/evaluation-runs/{{runId}}/sync
Cookie: {{sessionCookie}}
Origin: http://localhost:3000

### 未完成的任务可取消；已完成返回 409
POST {{baseUrl}}/api/evaluation-runs/{{runId}}/cancel
Cookie: {{sessionCookie}}
Origin: http://localhost:3000

### 另建 mockFailure=true 的任务，同步至 FAILED 后才能重试
POST {{baseUrl}}/api/evaluation-runs/{{runId}}/retry
Cookie: {{sessionCookie}}
Origin: http://localhost:3000
Idempotency-Key: interview-retry-001

### 本人终态任务软删除：重复删除仍 200
DELETE {{baseUrl}}/api/evaluation-runs/{{runId}}
Cookie: {{sessionCookie}}
Origin: http://localhost:3000
```

### 代表性成功响应

质量报告的 dataset 为 `warehouse-scenes v3`、sampleCount 2400、qualityStatus WARNING；检查含 name 和 message，遮挡场景分布 affectedCount 18。18 是质量统计，2 是每个完成任务实际保存的异常数。

创建／详情／取消／重试返回完整 Run：ID、名称、配置 ID、状态、时间、Provider、基线／重试来源、错误、异常数，以及模型／数据集／Benchmark 展示名称、创建者和固定任务标记。新增 targetSuccessRate、pendingReviewCount、successRule 和 metrics；完整字段见 OpenAPI 的 Run；创建时 startedAt／finishedAt／errorCode／errorMessage 均为 null、anomalyCount 为 0。

```json
{
  "data": {
    "runId": "CREATED_RUN_ID",
    "status": "RUNNING",
    "progress": null,
    "startedAt": "2026-09-26T10:00:01Z",
    "finishedAt": null,
    "pollAfterMs": 1500
  },
  "meta": { "requestId": "EXAMPLE_REQUEST_UUID" }
}
```

### 代表性错误响应

```json
{
  "error": {
    "code": "QUALITY_WARNING_NOT_ACCEPTED",
    "message": "请先确认数据集质量警告",
    "fieldErrors": { "acceptQualityWarning": ["必须明确接受质量警告"] },
    "requestId": "EXAMPLE_REQUEST_UUID"
  }
}
```

| HTTP | code | 含义 |
|---|---|---|
| 401 | UNAUTHENTICATED | 会话无效 |
| 403 | FORBIDDEN | 角色、任务归属或 Origin 不满足 |
| 404 | NOT_FOUND | 对象不存在 |
| 409 | IDEMPOTENCY_CONFLICT／STATE_CONFLICT／TASK_LIMIT_REACHED／VERSION_CONFLICT | 重复键内容不同、状态不允许、容量已满或结论版本已更新 |
| 422 | VALIDATION_ERROR | 结构、路径、分页、字段或请求头不合法 |
| 422 | QUALITY_WARNING_NOT_ACCEPTED／DATASET_QUALITY_BLOCKED | 未确认警告或质量阻断 |
| 422 | INCOMPATIBLE_CONFIGURATION | 非同项目、非同口径或基线缺结果 |
| 503 | EXTERNAL_SERVICE_ERROR | 模拟配置不可用，本次事务回滚 |
| 500 | INTERNAL_ERROR | 未预期错误 |

## 5. 比较与复核：已可调用

两侧任务必须成功、同项目／数据／Benchmark／Episode／Seed，模型不同。指标再核对单位、方向与样本数；不满足时 delta=null、NOT_COMPARABLE，不把缺失当作零。百分比差使用百分点 pp，例如 81%−76%=+5 pp。总体场景保留 __overall__。

~~~http
### ENGINEER：同口径比较；省略 baselineRunId 就只读当前结果
GET {{baseUrl}}/api/comparisons?candidateRunId=demo-run-candidate&baselineRunId=demo-run-baseline
Cookie: {{sessionCookie}}

### 两身份：按任务／指标／场景／复核状态筛选
GET {{baseUrl}}/api/anomaly-samples?runId={{runId}}&metricKey=collision_rate&scenarioKey=occlusion&reviewState=pending&page=1&pageSize=20
Cookie: {{sessionCookie}}

@sampleId = REPLACE_WITH_SAMPLE_ID

### 详情返回 sample、run、history、staleReportCount；runId 可选用于校验归属
GET {{baseUrl}}/api/anomaly-samples/{{sampleId}}?runId={{runId}}
Cookie: {{sessionCookie}}

### 使用刚读到的 sample.version；工程师仅能保存本人任务草稿
PATCH {{baseUrl}}/api/anomaly-samples/{{sampleId}}/review
Cookie: {{sessionCookie}}
Origin: http://localhost:3000
Content-Type: application/json

{"conclusion":"日志显示遮挡区域碰撞，建议调整路径后复测。","mode":"draft","expectedVersion":1}

### REVIEWER：重新读取最新版本后，改 mode=confirm 确认最终结论
~~~

PATCH 返回完整详情，sample.version 是下一次编辑的 expectedVersion。两身份均能读证据；评测人员可存草稿或确认。结论 trim 后 1–4000 字，不要求分类。隐藏任务／错误父任务返回 404，未完成返回 409，未知字段或零版本返回 422。

草稿与最终内容分开；保存增加编辑 version，最终文本变化才增加 confirmedRevision。每次成功保存追加历史与审计，版本冲突 409 不写任何部分；界面保留输入，读取最新记录后人工核对再存。

确认内容改变时，同事务标记引用此任务的旧报告 isStale；草稿及相同文本确认不会标记过时。此阶段只保护已有报告，尚未实现报告生成、确认或自动更新。网页首次比较沿用任务创建时的基线；用户选择“不对比”只改 URL，不改任务配置。

## 6. 变更记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-09-23 | 0.1–0.2 draft | 初始契约、只读状态／同步拆分与重开草案 |
| 2026-09-26 | 0.3.0 | 八个质量／评测操作实现，补齐 DTO、Origin、幂等和错误 |
| 2026-09-27 | 0.4.0 文档 | 保留实际八项；新目标与 planned 分开，移除回补，新增目录／软删除，结论编辑与报告版本修订；未改运行接口 |

| 2026-09-27 | 0.4.1 | 双身份会话门禁已实现，旧 ADMIN 会话失效；八项请求字段／响应结构不变 |

| 2026-09-27 | 0.5.0 | 自主目录、可空基线、目标与结果摘要、三任务容量及软删除已实现；targetSuccessRate 为实际目标字段 |

| 2026-09-27 | 0.6.0 | 比较、异常列表／详情和自由结论编辑已实现；补安全 DTO、草稿／确认版本、并发与旧报告过时契约 |
