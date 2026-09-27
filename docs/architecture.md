# SimEval 架构设计

**2026-09-27：双身份、自主配置、两步质量确认、独立模拟、多任务与软删除已接通。** 阶段 5 已接入比较、证据与结论编辑；报告待重新讨论。行为看[规格](../specs/002-quality-evaluation/spec.md)，规则矩阵与算法看[计划](../specs/002-quality-evaluation/plan.md)，比较与复核看[003规格](../specs/003-comparison-review/spec.md)，HTTP 看 [OpenAPI](openapi.yaml)。

## 1. 运行边界

Next.js、TypeScript、Auth.js、Prisma、MySQL 组成模块化单体，一个应用部署。合成数据、预置质量报告、模拟执行与缓存报告必须标注；不运行真实仿真、训练或 ETL。不增加微服务、队列、Worker 或 WebSocket。

## 2. 文件与调用关系

| 位置 | 职责 |
|---|---|
| `src/app/(workspace)/` | 核对会话，组合各板块页面 |
| `src/lib/demo-identity.ts`、`src/lib/workspace-navigation.ts` | 公开身份、入口和导航定义；不含口令 |
| `src/server/auth/`、`src/auth.ts` | 身份 Zod／账号／密码摘要校验，Auth.js JWT 会话，页面门禁 |
| `src/features/identity/`、`src/app/login/` | 原生单选组与切换弹层；Server Action 建立对应会话 |
| `src/features/` | 表单、任务选择、结果与交互状态；客户端不访问 Prisma |
| `src/app/api/`、`src/server/http/api.ts` | HTTP 入口；身份／角色／Origin／Zod、统一错误和 requestId |
| `src/server/application/` | 组织完整用例，输出不含密钥的 DTO |
| `src/domain/evaluation.ts` | 质量、配置、权限与状态的纯业务规则 |
| `src/server/repositories/` | Prisma 查询、条件更新与事务 |
| `src/server/providers/` | 可替换 EvaluationProvider；现有确定性 Mock |
| `src/server/db.ts`、`prisma/` | 连接池、Schema、追加迁移和幂等 Seed |
| `tests/unit`、`tests/integration` | 规则／HTTP 边界与独立 MySQL 集成验证 |

~~~mermaid
flowchart LR
  B[浏览器] --> P[服务端页面]
  B --> H[HTTP 入口与校验]
  P --> A[应用服务与 DTO]
  H --> A
  A --> D[领域规则]
  A --> R[事务仓储]
  R --> E[现有 Mock 纯计算]
  R --> DB[(MySQL)]
~~~

登录／切换走 Server Action：所选身份 → 服务端读取演示口令 → Credentials 核对预设 email、isDemo、数据库角色和 bcrypt 摘要 → Auth.js 更新 Cookie → 角色默认页。页面与 HTTP 每次用会话 userId 重新查数据库；历史 ADMIN 或不匹配账号视为失效。切换前不退出原账号，认证失败仍可返回原会话。

首屏由 Server Component 直接调用应用服务；业务交互通过 HTTP。当前 Mock 在事务内只做本地纯计算；未来外部执行与 AI 网络请求放到事务外，校验结果后用短事务保存。

## 3. 新产品怎样映射到工程

| 产品行为 | 工程边界 |
|---|---|
| ENGINEER／REVIEWER 二选一 | 服务端建立对应会话；导航随角色变化，权限重新查数据库 |
| 配置 → 质量确认 → 创建 | 目录返回兼容组合；服务端复查版本、范围和质量，保存配置快照 |
| 基线可选 | 无基线也能模拟；比较时才要求两个成功且同口径的任务 |
| 多任务选择／延续 | URL 和请求明确携带 runId；侧栏先选，正文按钮延续，不能自动覆盖成最近任务 |
| 取消／重试／删除 | 本人权限＋状态校验；重试新 ID；删除用可见性标记，保留引用 |
| 草稿／最终结论 | 两者分开保存；版本保护、历史、审计与报告失效一起写入 |
| 报告 | 输入由服务端组装；校验指标／样本引用；评测人员确认，过时报告保留历史 |

总览按显式 runId 查询所选任务的状态、配置、指标和待复核数。未完成任务只展示状态，没有基线不伪造比较，没有结果不伪造异常。指标按 Benchmark 定义，目录变化必须影响结果口径。

## 4. 已迁移与后续数据变化

阶段 4 追加 `202609270001_autonomous_evaluation`，阶段 5 追加 `202609270002_comparison_review`。不 reset，不覆盖已有用户任务。

| 对象 | 目标变化 |
|---|---|
| EvaluationRun | 新建 name 必填、baselineRunId 可空；已加 targetSuccessRate（可空 0.8／0.85）、configurationSnapshot、deletedAt／deletedById |
| 模型／数据／Benchmark 目录 | 兼容矩阵与命名统一在 domain/evaluation-catalog.ts；catalog.ts 补目录后调用 demo-fixtures.ts，完整 Seed／db:catalog 共用，保留已有结果、人工内容和删除状态 |
| AnomalySample | 已分开 draftConclusion 与已确认 conclusion，保存修改人／时间、confirmedById／confirmedAt 和 confirmedRevision；现有 version 用于所有编辑防覆盖 |
| ReviewRecord | 只追加每次草稿／确认／修改的内容、操作者、时间与来源版本，不要求人工分类 |
| AIReport | 输入快照保存指标、证据和 sourceReviewVersions（样本 ID → 确认版本）；已加 isStale／staleAt；生成与确认尚未实现。过时报告保留原确认历史，当前入口提示重生成 |

草稿保存只增加编辑 version；最终结论内容改变才增加 confirmedRevision 并令旧报告过时。报告确认时再次核对来源版本，避免“生成时有效、确认时已过期”。

当前 Schema／Seed 仍含 ADMIN、分类和 BackfillTask；这是旧数据事实。新产品不开放第三角色、分类步骤或回补管理；迁移需保留历史关联，再决定兼容字段处理。登录已复用各一个工程师和评测人员；历史管理员不能进入产品会话。模拟 Seed 与数据库 Seed 分别负责结果复现和初始化故事。

## 5. 当前可运行行为与写入保护

质量／评测十个操作包含目录、质量、创建／列表／详情、状态、同步、取消、重试和软删除。创建保存 mock-v2 参数快照；结果独立于基线，保留四项指标和两条预置证据片段。模型与难度改变指标，Seed／Episode 产生确定性偏移；目标仅判断达标，不改变结果。纯计算集中在 domain/simulation-results.ts，执行 Provider 与演示 Seed 共用，客户端不导入该 Node.js 模块。

- GET 只读；POST sync 按服务器时间每次推进一段，创建后满 1 秒可运行、满 4 秒可完成，没有后台执行。运行中 progress 为 null。
- 成功的指标、异常、终态和审计同事务提交，重复同步不重复写。
- 取消仅允许 QUEUED／RUNNING；条件更新和事务处理完成竞争。失败重试新建任务并保留 retryOfRunId。
- 创建／重试按用户＋操作＋幂等键和请求摘要识别；同键不同内容拒绝。并发冲突有限重试。
- 创建先锁 User 行，查幂等再查三个活跃任务容量；取消／终态释放名额。
- 软删除过滤普通列表和详情；指标及已有外键引用保留，重复删除不重复审计。
- 结论编辑使用 expectedVersion 防覆盖，事务统一保存当前内容、历史、审计与旧报告过时标记。

Schema 改动后生成 Client、应用迁移、重启旧服务，再验网页。新版本相关测试与手工验收看 [Quickstart](../specs/002-quality-evaluation/quickstart.md)；旧测试通过不代表新设计已实现。

### 阶段 5 的调用与事务

comparison-view / anomaly-list / sample-detail / review-editor → HTTP 统一边界 → comparison-review 应用服务 → 领域规则／仓储 → MySQL。页面首读直接调用同一应用服务；DTO 只发送公开证据、人物姓名与版本。

复核先锁 EvaluationRun，复查成功／未隐藏及权限；再检查 AnomalySample.version 并条件更新。当前内容、ReviewRecord、旧报告过时标记、AuditLog 同事务提交。两个请求拿同一版本时一个成功、另一个 409；前端保留后者输入。任务删除也锁同一任务，防止隐藏后继续写复核。

确认修订号只追踪最终文本变化；编辑版本追踪全部保存。已有 RESOLVED 故事在迁移中补确认修订 1 及历史确认人，旧内容和旧分类／回补关系保留。完整 Seed 初始化新环境时重建固定示例确认字段；本轮开发库只追加迁移，没有重跑完整 Seed。
