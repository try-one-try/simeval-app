# SimEval HTTP 接口说明

[OpenAPI](openapi.yaml) 是方法、字段与实现状态的权威契约。本文解释调用和取舍；认证会话由 Auth.js 管理，不把其内部路由算成业务 API。

## 1. 先分清可调用与待实施

**2026-09-27 文档版本 0.4.0。** 现有八个质量／评测操作保留第一版实际契约；新原型认可不等于接口已改造。

| 状态 | 内容 |
|---|---|
| implemented | 质量读取、任务创建／列表／详情、状态读取、同步、取消、重试 |
| x-target-*（待改造） | 已有接口的新目标：双角色、可选基线、自主目录和目标值、过滤软删除 |
| planned | 目录、软删除、比较、异常读取／结论编辑、报告生成／确认 |
| needs-detail | 指派／重开保留后续草案，尚不纳入当前主线 |

新产品只有 ENGINEER／REVIEWER。工程师管理本人任务、编辑草稿、生成／阅读报告；评测人员确认结论／报告。当前 implemented 仍允许旧 ADMIN，创建仍必填 baselineRunId；实际变更通过测试后再更新契约。独立回补和人工分类已从计划接口移除，旧数据库历史保留。

## 2. 公共规则

- **身份与写入**：校验 Session 和数据库角色；写入要求同源 Origin、Zod 与业务权限。当前八个操作写入均为 POST；后续 PATCH／DELETE 同样受保护。
- **输入与分页**：ID 长 1–64，仅字母／数字／下划线／连字符；Body 拒绝多余字段。任务名 trim 后 1–120 字，Episode 1–10000，Seed 0–2147483647；新版另按目录收紧 Episode。page 从 1，pageSize 默认 20／最多 100，时间倒序＋ID 稳定排序。
- **响应**：成功 `{data,meta:{requestId}}`；错误 `{error:{code,message,fieldErrors,requestId}}`。fieldErrors 为字段消息数组映射或 null；不泄漏 SQL、密码或堆栈。
- **幂等**：创建／重试／计划的报告生成带 1–128 字符 Idempotency-Key。同用户／操作／键及内容重复返回原对象；同键换内容 409。创建首次 201，重复 200。
- **四个标识**：requestId 跟踪一次请求；runId 定位任务；幂等键识别重复动作；expectedVersion 防止编辑覆盖。

## 3. 当前状态与模拟逻辑

PASSED 可创建，WARNING 明确接受，FAILED 阻断。当前要求成功基线且同项目／数据／Benchmark／Episode／Seed、不同模型版本；新目标是无基线也可创建，仅比较才校验基线。

创建保存 QUEUED；POST sync 满 2 秒可进入 RUNNING、满 12 秒可完成，每次推进一段，无后台执行。GET 始终只读，运行中 progress 为 null。当前 Mock 用基线固定增量生成四项指标和两条 OPEN 异常，结果／终态／审计同事务提交，不代表执行真实 Episode。

QUEUED／RUNNING 可取消，完成竞争返回最新状态或 409；FAILED 重试新 ID 并保留 retryOfRunId。重试重新检查配置／质量，沿用审计中的真实警告接受；未接受的新 WARNING 返回 422。mockFailure 是故障展示，重试默认清除。

## 4. 可执行请求示例

先从网页进入演示会话，HTTP 客户端使用自己的本地 Session Cookie。不要保存或上传真实 Cookie。

```http
@baseUrl = http://localhost:3000
@sessionCookie = REPLACE_WITH_LOCAL_COOKIE_HEADER

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
  "baselineRunId": "demo-run-baseline",
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

### 满 2 秒同步运行，满 12 秒再次同步完成
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
```

### 代表性成功响应

质量报告的 dataset 为 `warehouse-scenes v3`、sampleCount 2400、qualityStatus WARNING；检查含 name 和 message，遮挡场景分布 affectedCount 18。18 是质量统计，2 是每个完成任务实际保存的异常数。

创建／详情／取消／重试返回完整 Run：ID、名称、配置 ID、状态、时间、Provider、基线／重试来源、错误、异常数，以及模型／数据集／Benchmark 展示名称、创建者和固定任务标记。完整字段见 OpenAPI 的 Run；创建时 startedAt／finishedAt／errorCode／errorMessage 均为 null、anomalyCount 为 0。

```json
{
  "data": {
    "runId": "CREATED_RUN_ID",
    "status": "RUNNING",
    "progress": null,
    "startedAt": "2026-09-26T10:00:02Z",
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
| 409 | IDEMPOTENCY_CONFLICT／STATE_CONFLICT | 重复键内容不同或状态不允许 |
| 422 | VALIDATION_ERROR | 结构、路径、分页、字段或请求头不合法 |
| 422 | QUALITY_WARNING_NOT_ACCEPTED／DATASET_QUALITY_BLOCKED | 未确认警告或质量阻断 |
| 422 | INCOMPATIBLE_CONFIGURATION | 非同项目、非同口径或基线缺结果 |
| 503 | EXTERNAL_SERVICE_ERROR | 完成时基线结果不可用，本次事务回滚 |
| 500 | INTERNAL_ERROR | 未预期错误 |

## 5. 新原型的计划示例

以下不是当前可调用请求。目标创建使用 TargetCreateRunRequest，可省略 baselineRunId，增加可选 successRateThreshold（0.8／0.85）；目录返回可选版本、兼容关系和范围。选择必须影响执行，不能只改显示名称。

~~~http
### 编辑或确认结论；mode=confirm 仅评测人员
PATCH {{baseUrl}}/api/anomaly-samples/{{sampleId}}/review
Origin: http://localhost:3000
Content-Type: application/json

{"conclusion":"证据显示抓取路径在遮挡区域碰撞，建议调整后复测。","mode":"confirm","expectedVersion":2}

### 删除本人已结束任务：软删除，保留证据引用
DELETE {{baseUrl}}/api/evaluation-runs/{{runId}}
Origin: http://localhost:3000
~~~

结论不要求分类。保存草稿不覆盖已确认内容；确认／修改追加历史与审计，版本冲突返回 409 并保留输入。最终结论内容变化令旧报告过时；草稿变动不会让已确认报告失效。

报告可无基线，服务端组装指标／证据／确认版本快照；AI 只输出草稿。确认时重新核对来源版本，过时报告不能确认或当作最新。错误复用公共结构；后续 Provider 超时、缓存和降级策略在报告切片定稿。

## 6. 变更记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-09-23 | 0.1–0.2 draft | 初始契约、只读状态／同步拆分与重开草案 |
| 2026-09-26 | 0.3.0 | 八个质量／评测操作实现，补齐 DTO、Origin、幂等和错误 |
| 2026-09-27 | 0.4.0 文档 | 保留实际八项；新目标与 planned 分开，移除回补，新增目录／软删除，结论编辑与报告版本修订；未改运行接口 |
