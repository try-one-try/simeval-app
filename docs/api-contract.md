# SimEval HTTP 接口契约（编码前草案）

**状态：19 个业务接口仍是设计稿。** [openapi.yaml](openapi.yaml) 是计划中的业务 HTTP 方法、路径、参数、请求响应结构与角色的机器可读契约；本文件保存接口约定、黄金路径请求和成功／错误响应示例。项目的实现边界见[架构设计](architecture.md)，具体功能行为由对应的 `specs/<功能>/spec.md` 固定。实现每个接口时需更新本目录，并用实现与测试核对契约，不能因为文件存在就声称接口可用。

格式遵循 [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0)；Next.js Route Handler 是计划中的业务 HTTP 入口。当前 `src/app/api/auth/[...nextauth]` 已接入 Auth.js 框架会话路由，本地数据库演示登录、概览刷新和退出已通过浏览器走查；跨角色及异常状态仍待验收。19 个业务 Route Handler 均未实现。

Auth.js 管理的 `/api/auth/*` 供浏览器会话使用，内部 CSRF、回调、Cookie 和错误响应遵循所锁定的 Auth.js 版本，不属于下方统一业务 JSON 响应契约。入口页通过服务端动作发起 Credentials 登录；成功后进入 `/overview`，失败或未配置时不能读取受保护概览。客户端不得把 Auth.js 内部路由当作稳定的第三方集成接口。

## 1. 当前接口覆盖

| 模块 | 操作 | 当前状态 |
|---|---|---|
| 数据质量 | GET 质量摘要 | 设计稿 |
| 评测 | 列表、创建、详情、只读状态、模拟同步、取消、失败重试 | 设计稿 |
| 对比 | GET 基线与候选指标 | 设计稿 |
| 异常 | 列表、详情、指派、复核、重开 | 设计稿 |
| 回补 | 创建、更新 | 设计稿 |
| 报告 | 生成、详情、人工确认 | 设计稿 |

当前为 **19 个操作**。页面首屏读取可由 Server Component 直接调用应用查询服务，不一定需要一一对应的 GET HTTP 接口；写操作始终有服务端入口和契约。

## 2. 通用约定

- **身份**：Auth.js Session Cookie。OpenAPI 中的 `authjs.session-token` 是开发环境占位名称；具体 cookie 名、Secure 前缀与会话配置在阶段 2 固定。Cookie 不是角色授权，Route Handler 仍需校验 Session 与服务端角色。
- **统一响应**：成功 `{ "data": ..., "meta": { "requestId": "..." } }`；列表的 `meta` 另含 `page`、`pageSize`、`total`。错误 `{ "error": { "code": "...", "message": "...", "fieldErrors": null, "requestId": "..." } }`。`fieldErrors` 为字段名到消息数组的映射或 `null`。
- **分页**：`page` 从 1 开始，`pageSize` 默认 20、最大 100；默认创建时间倒序。列表查询失败不能以空数组伪装。
- **校验**：写操作在服务端依序做身份、角色、Zod 结构校验和领域规则检查。Path、Query、Body、幂等头都要校验；客户端预校验只改善体验。
- **幂等**：创建评测、重试、创建回补、生成报告需要 `Idempotency-Key`。同一操作者、同一操作、同一键和同一请求体，首次返回 201，重放返回 200 与原资源；同键不同请求体返回 409 `IDEMPOTENCY_CONFLICT`。键不得跨用户复用推断他人资源。具体持久化结构在阶段 2 落地。
- **乐观并发**：指派、复核与重开带 `expectedVersion`；版本不符返回 409 `VERSION_CONFLICT`，不覆盖他人结论。
- **状态同步**：`GET /status` 只读；`POST /sync` 根据服务器时间推进模拟任务，重复或并发调用只能生成一份结果。这个拆分避免 GET 暗中写库。
- **证据**：对比指标返回单位、方向和 evidenceCount；报告只能引用当前任务真实存在的样本编号，草稿必须显著标为未经人工确认。
- **事务**：评测结果、复核记录、回补任务与审计等关联写入遵循[架构设计](architecture.md)中的事务边界。HTTP 成功响应只在事务提交后发出。

## 3. HTTP 错误与业务 code

| HTTP | code | 触发条件 |
|---|---|---|
| 401 | `UNAUTHENTICATED` | 无有效 Session |
| 403 | `FORBIDDEN` | 已登录，但该角色不能执行操作 |
| 404 | `NOT_FOUND` | 资源不存在或按权限不可见 |
| 409 | `STATE_CONFLICT` | 终态任务取消、非 FAILED 任务重试、非法复核或回补流转 |
| 409 | `VERSION_CONFLICT` | `expectedVersion` 与当前版本不同 |
| 409 | `IDEMPOTENCY_CONFLICT` | 幂等键与首次请求内容不同 |
| 422 | `VALIDATION_ERROR` | 结构、字段、范围或分页参数不合法 |
| 422 | `QUALITY_WARNING_NOT_ACCEPTED` | WARNING 数据集未显式确认 |
| 422 | `DATASET_QUALITY_BLOCKED` | FAILED 数据集禁止评测 |
| 422 | `INCOMPATIBLE_CONFIGURATION` | 模型、数据集或 Benchmark 不兼容，或两个任务不能同口径比较 |
| 422 | `INVALID_EVIDENCE` | AI 输出引用不存在的指标或样本 |
| 503 | `EXTERNAL_SERVICE_ERROR` | Provider 调用失败或超时；历史报告不删除 |
| 500 | `INTERNAL_ERROR` | 未预期服务端错误；响应不暴露密钥、SQL 或堆栈 |

OpenAPI 中各操作列出的 HTTP 响应是计划覆盖；具体业务 code 由应用错误映射到上表。发布实现前，需补充每个操作的测试断言与成功／失败示例。

## 4. 关键操作细则

### 创建评测

`WARNING` 需 `acceptQualityWarning: true`；`FAILED` 无论该字段为何都拒绝。验证模型、数据集和 Benchmark 属于兼容项目；基线任务必须已成功且能比较。成功创建 `QUEUED` 任务，并记录操作者、配置、质量警告接受情况与审计。

### 复核与回补

`POST /review` 的 `resolve: false` 是保存复核内容；`resolve: true` 仅 REVIEWER/ADMIN，且必须已有负责人、分类和非空人工结论。`createBackfillTask: true` 仅允许 DATA_ISSUE/INVALID_SAMPLE，并与复核及审计同事务完成。若通过复核操作已建回补任务，客户端不应再调用独立创建接口；独立接口用于后续单独建任务。每个样本重复创建回补任务的唯一性规则仍需在数据模型中最终确定。

`POST /api/anomaly-samples/{sampleId}/reopen` 是独立操作，仅 REVIEWER/ADMIN 可用。仅 `RESOLVED` 可重开；请求必须包含去除首尾空白后非空的 `reason` 和 `expectedVersion`。成功后状态为 `REOPENED`，保留负责人，清空当前分类、结论和解决时间；旧结论与重开原因留在复核历史和审计中。新草稿保存后进入 `IN_REVIEW`，需要重新满足解决条件。状态不符返回 409 `STATE_CONFLICT`，版本不符返回 409 `VERSION_CONFLICT`。

### 报告

报告请求只传任务 ID；服务端组装有限输入快照，调用 InsightProvider，校验结构、指标和样本编号，再保存 `READY` 草稿。确认接口仅 REVIEWER/ADMIN，可将 READY 改为 CONFIRMED，并记录确认人和时间。Provider 失败返回 503，不能删掉历史报告。

## 5. 尚待决定，不可默认为已实现

| 待决事项 | 建议默认方案 | 当前契约状态 |
|---|---|---|
| 取消与完成并发 | 允许取消 QUEUED/RUNNING；通过条件更新确保取消和完成只有一方成功 | 取消接口已列，精确状态机待确认 |
| 对比数据集口径 | 基线与候选应使用同一数据集版本和 Benchmark | 当前仅强制同 Benchmark 和成功状态 |
| 重复回补 | 一个样本同一时间最多一个未完成回补任务 | 具体唯一约束待落地 |
| 会话与 Provider | 实现时固定 Cookie、CSRF/Origin 策略、AI 超时与降级阈值 | 阶段 2/6 决定，当前未实现 |

这些未决项在进入对应切片前由功能规格明确，并同步改动 OpenAPI、架构设计、数据模型实现与测试。

## 6. 接口变更记录规则

每次新增或修改 HTTP 接口，在同一切片中更新：`openapi.yaml` 的请求／响应／错误／角色、本文件的代表性请求及成功与失败例、对应的公开功能规格与相关测试。工程初始化后将 OpenAPI 校验纳入自动检查。接口状态从“设计稿”变为“已实现”须有真实 Route Handler、测试和浏览器证据。

## 7. 设计变更记录

| 日期 | 版本 | 内容 |
|---|---|---|
| 2026-09-23 | 0.1.0-draft | 将接口清单细化为 OpenAPI、请求与响应示例；增加只读 GET 状态与 POST 模拟同步的边界；记录待决状态机与对比口径。 |
| 2026-09-23 | 0.2.0-draft | 确定异常样本重开状态流转，新增独立重开接口、并发与错误约定。 |

## 8. 黄金路径请求示例

以下请求使用合成 ID 和占位 Session Cookie，仅用于审阅契约。复制单个请求时，可从本节代码块取用。

```http
# SimEval HTTP 示例（设计稿，未实现）
# 合成 ID 与数值仅用于固定演示故事。不要将真实 Session Cookie 写入仓库。
@baseUrl = http://localhost:3000
@sessionCookie = REPLACE_WITH_LOCAL_SESSION_COOKIE

### 1. 获取数据集质量
GET {{baseUrl}}/api/datasets/dataset_warehouse_v3/quality
Cookie: {{sessionCookie}}

### 2. 创建候选评测；WARNING 需显式确认
POST {{baseUrl}}/api/evaluation-runs
Cookie: {{sessionCookie}}
Content-Type: application/json
Idempotency-Key: create-run-v24-001

{
  "name": "v2.4 仓储抓取评测",
  "modelVersionId": "model_v24",
  "datasetVersionId": "dataset_warehouse_v3",
  "benchmarkId": "benchmark_warehouse_pick",
  "baselineRunId": "run_baseline_v23",
  "episodeCount": 500,
  "simulationSeed": 42,
  "acceptQualityWarning": true
}

### 3. 同步模拟任务，再只读获取状态
POST {{baseUrl}}/api/evaluation-runs/run_candidate_v24/sync
Cookie: {{sessionCookie}}

###
GET {{baseUrl}}/api/evaluation-runs/run_candidate_v24/status
Cookie: {{sessionCookie}}

### 4. 同口径比较
GET {{baseUrl}}/api/comparisons?baselineRunId=run_baseline_v23&candidateRunId=run_candidate_v24&scenarioKey=occlusion
Cookie: {{sessionCookie}}

### 5. 从遮挡回退下钻样本
GET {{baseUrl}}/api/anomaly-samples?runId=run_candidate_v24&scenarioKey=occlusion&metricKey=collision_rate&page=1&pageSize=20
Cookie: {{sessionCookie}}

### 6. 指派样本（示例版本号应先从详情读取）
PATCH {{baseUrl}}/api/anomaly-samples/sample_017/assignment
Cookie: {{sessionCookie}}
Content-Type: application/json

{ "assigneeId": "user_reviewer", "expectedVersion": 2 }

### 7. REVIEWER 解决数据问题并在同一事务建回补任务
POST {{baseUrl}}/api/anomaly-samples/sample_017/review
Cookie: {{sessionCookie}}
Content-Type: application/json

{
  "category": "DATA_ISSUE",
  "conclusion": "遮挡场景抓取点标注偏移，需要回补",
  "labels": ["occlusion", "annotation"],
  "resolve": true,
  "createBackfillTask": true,
  "expectedVersion": 3
}

### 8. 独立创建回补任务（仅未在复核操作中创建时使用）
POST {{baseUrl}}/api/backfill-tasks
Cookie: {{sessionCookie}}
Content-Type: application/json
Idempotency-Key: backfill-sample-017

{
  "anomalySampleId": "sample_017",
  "reason": "修正遮挡场景抓取点标注",
  "assigneeId": "user_reviewer"
}

### 9. 生成报告草稿
POST {{baseUrl}}/api/ai-reports
Cookie: {{sessionCookie}}
Content-Type: application/json
Idempotency-Key: report-run-v24-001

{ "runId": "run_candidate_v24", "baselineRunId": "run_baseline_v23" }

### 10. REVIEWER/ADMIN 确认已校验证据的 READY 报告
POST {{baseUrl}}/api/ai-reports/report_v24_001/confirm
Cookie: {{sessionCookie}}

# 代表性错误响应（示例，不是可执行请求）：
# HTTP/1.1 409 Conflict
# {"error":{"code":"VERSION_CONFLICT","message":"样本已被其他人更新，请刷新后重试","fieldErrors":null,"requestId":"req_review_017"}}
# HTTP/1.1 422 Unprocessable Entity
# {"error":{"code":"QUALITY_WARNING_NOT_ACCEPTED","message":"请先确认数据集质量警告","fieldErrors":{"acceptQualityWarning":["必须显式确认"]},"requestId":"req_create_001"}}
```

### 可选维护操作：重新打开已解决样本

重开不在几分钟的主演示中；它用于解释状态机、并发和审计。以下仍是设计稿请求，不可对当前原型执行。

```http
POST {{baseUrl}}/api/anomaly-samples/sample_017/reopen
Cookie: {{sessionCookie}}
Content-Type: application/json

{ "reason": "发现新的标注证据，需要重新复核", "expectedVersion": 4 }
```

成功返回 200，当前结论清空，历史仍可追溯：

```json
{
  "data": {
    "id": "sample_017", "runId": "run_candidate_v24", "sampleNumber": 17,
    "scenarioKey": "occlusion", "anomalyType": "collision", "metricKey": "collision_rate",
    "status": "REOPENED", "reviewCategory": null, "assigneeId": "user_reviewer",
    "conclusion": null, "resolvedAt": null, "mediaPath": null, "logExcerpt": "synthetic episode 17", "version": 5,
    "reviewHistory": [
      { "reviewerId": "user_reviewer", "fromStatus": "IN_REVIEW", "toStatus": "RESOLVED",
        "category": "DATA_ISSUE", "conclusion": "遮挡场景抓取点标注偏移，需要回补",
        "reopenReason": null, "createdAt": "2026-09-23T10:04:00Z" },
      { "reviewerId": "user_reviewer", "fromStatus": "RESOLVED", "toStatus": "REOPENED",
        "category": null, "conclusion": null, "reopenReason": "发现新的标注证据，需要重新复核",
        "createdAt": "2026-09-23T10:05:00Z" }
    ]
  },
  "meta": { "requestId": "req_reopen_017" }
}
```

若样本已经是 `REOPENED`，返回 409：

```json
{ "error": { "code": "STATE_CONFLICT", "message": "只有已解决样本可以重新打开", "fieldErrors": null, "requestId": "req_reopen_018" } }
```

原因仅为空白时返回 422 `VALIDATION_ERROR`，`fieldErrors.reason` 指向该字段；无权限返回 403 `FORBIDDEN`，版本不符返回 409 `VERSION_CONFLICT`。

## 9. 代表性响应示例

以下 ID、数值和文本都是固定的合成演示故事。具体数值在 Seed 与 Provider 实现时锁定；本页用于审阅返回结构，不证明系统已运行。

### 质量报告：200

```json
{
  "data": {
    "dataset": { "id": "dataset_warehouse_v3", "name": "warehouse-scenes", "version": "v3", "sampleCount": 12000, "qualityStatus": "WARNING" },
    "checks": [
      { "key": "invalid_annotations", "status": "WARNING", "affectedCount": 18, "message": "18 个遮挡场景样本需要复核" }
    ],
    "canStartEvaluation": true
  },
  "meta": { "requestId": "req_quality_001" }
}
```

### 创建评测：201；相同幂等请求重放：200

```json
{
  "data": {
    "id": "run_candidate_v24", "projectId": "project_warehouse", "name": "v2.4 仓储抓取评测", "status": "QUEUED",
    "modelVersionId": "model_v24", "datasetVersionId": "dataset_warehouse_v3",
    "benchmarkId": "benchmark_warehouse_pick", "baselineRunId": "run_baseline_v23",
    "retryOfRunId": null, "episodeCount": 500, "simulationSeed": 42,
    "provider": "mock", "createdAt": "2026-09-23T10:00:00Z", "startedAt": null,
    "finishedAt": null, "errorCode": null, "errorMessage": null
  },
  "meta": { "requestId": "req_create_001" }
}
```

### 模拟状态同步：200

```json
{
  "data": {
    "runId": "run_candidate_v24", "status": "SUCCEEDED", "progress": 1,
    "startedAt": "2026-09-23T10:00:02Z", "finishedAt": "2026-09-23T10:00:12Z",
    "pollAfterMs": 0
  },
  "meta": { "requestId": "req_sync_001" }
}
```

### 模型对比：200

```json
{
  "data": {
    "baselineRunId": "run_baseline_v23", "candidateRunId": "run_candidate_v24",
    "metrics": [
      {
        "metricKey": "collision_rate", "scenarioKey": "occlusion", "unit": "%",
        "direction": "LOWER_IS_BETTER", "baselineValue": 8, "candidateValue": 13,
        "delta": 5, "verdict": "REGRESSION", "evidenceCount": 2
      }
    ]
  },
  "meta": { "requestId": "req_compare_001" }
}
```

`delta` 始终为候选值减基线值；改善或回退由 `direction` 和差值共同判定。此处碰撞率越低越好，故 `+5` 是回退。

### 数据问题复核并创建回补：200

```json
{
  "data": {
    "sample": {
      "id": "sample_017", "runId": "run_candidate_v24", "sampleNumber": 17,
      "scenarioKey": "occlusion", "anomalyType": "collision", "metricKey": "collision_rate", "status": "RESOLVED",
      "reviewCategory": "DATA_ISSUE", "assigneeId": "user_reviewer",
      "conclusion": "遮挡场景抓取点标注偏移，需要回补", "mediaPath": null,
      "logExcerpt": "synthetic episode 17", "version": 4
    },
    "backfillTask": {
      "id": "backfill_017", "anomalySampleId": "sample_017",
      "reason": "遮挡场景抓取点标注偏移", "status": "OPEN",
      "assigneeId": "user_reviewer", "resolutionNote": null
    }
  },
  "meta": { "requestId": "req_review_017" }
}
```

### 报告草稿：201

```json
{
  "data": {
    "id": "report_v24_001", "runId": "run_candidate_v24",
    "baselineRunId": "run_baseline_v23", "status": "READY",
    "summary": "总体成功率提高，但遮挡场景碰撞率回退；需区分模型与数据原因。AI 草稿，尚未人工确认。",
    "findings": [
      { "category": "DATA_ISSUE", "summary": "遮挡场景标注偏移", "evidenceSampleIds": ["sample_017"] },
      { "category": "MODEL_ISSUE", "summary": "接近路径过窄", "evidenceSampleIds": ["sample_018"] }
    ],
    "evidenceSampleIds": ["sample_017", "sample_018"],
    "provider": "cached", "confirmedById": null, "confirmedAt": null
  },
  "meta": { "requestId": "req_report_001" }
}
```

### 版本冲突：409

```json
{
  "error": {
    "code": "VERSION_CONFLICT", "message": "样本已被其他人更新，请刷新后重试",
    "fieldErrors": null, "requestId": "req_review_017"
  }
}
```

### 质量警告未接受：422

```json
{
  "error": {
    "code": "QUALITY_WARNING_NOT_ACCEPTED", "message": "请先确认数据集质量警告",
    "fieldErrors": { "acceptQualityWarning": ["必须显式确认"] },
    "requestId": "req_create_002"
  }
}
```
