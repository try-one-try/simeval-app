# SimEval 架构设计

**2026-09-27：双身份入口、真实切换和角色导航已接通，待负责人验收。** 第一版质量／评测继续可运行；自主配置、完整任务上下文和删除留阶段 4。本轮复用现有用户，未改 Schema、迁移或开发库 Seed。行为看[规格](../specs/002-quality-evaluation/spec.md)，HTTP 字段和实现状态看 [OpenAPI](openapi.yaml)。

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

总览目标是所选任务概况；当前代码仍只查询固定故事。未完成任务只展示状态，没有基线不伪造比较，没有结果不伪造异常。指标按 Benchmark 定义，目录变化必须影响结果口径。

## 4. 数据变化（待迁移）

以下是**新增字段方案，不是当前 Schema 的完成清单**。实施前在计划中定稿，再追加迁移；不 reset，不覆盖已有非预置数据。

| 对象 | 目标变化 |
|---|---|
| EvaluationRun | 现有 name 应在新建时必填；baselineRunId 已可空，但当前 API 仍必填。拟加 successRateThreshold（可空 0.8／0.85）、configurationSnapshotJson、deletedAt／deletedById |
| 模型／数据／Benchmark 目录 | 增加兼容信息与 Episode 范围，Seed 提供可选择的版本及三种质量状态；兼容矩阵在编码前固定 |
| AnomalySample | 拟分开 draftConclusion 与已确认 conclusion，保存修改人／时间、confirmedById／confirmedAt 和 confirmedRevision；现有 version 用于所有编辑防覆盖 |
| ReviewRecord | 只追加每次草稿／确认／修改的内容、操作者、时间与来源版本，不要求人工分类 |
| AIReport | 输入快照保存指标、证据和 sourceReviewVersions（样本 ID → 确认版本）；拟加 isStale／staleAt。过时报告保留原确认历史，当前入口提示重生成 |

草稿保存只增加编辑 version；最终结论内容改变才增加 confirmedRevision 并令旧报告过时。报告确认时再次核对来源版本，避免“生成时有效、确认时已过期”。

当前 Schema／Seed 仍含 ADMIN、分类和 BackfillTask；这是旧数据事实。新产品不开放第三角色、分类步骤或回补管理；迁移需保留历史关联，再决定兼容字段处理。登录已复用各一个工程师和评测人员；历史管理员不能进入产品会话。模拟 Seed 与数据库 Seed 分别负责结果复现和初始化故事。

## 5. 当前可运行行为与写入保护

现有八个操作读取质量、创建／列出／读取任务、读取状态、同步、取消和重试。当前创建仍依赖成功基线；Mock 用基线加固定增量生成四项指标和两条异常。

- GET 只读；POST sync 按服务器时间每次推进一段，约 2 秒运行、12 秒完成，没有后台执行。运行中 progress 为 null。
- 成功的指标、异常、终态和审计同事务提交，重复同步不重复写。
- 取消仅允许 QUEUED／RUNNING；条件更新和事务处理完成竞争。失败重试新建任务并保留 retryOfRunId。
- 创建／重试按用户＋操作＋幂等键和请求摘要识别；同键不同内容拒绝。并发冲突有限重试。
- 新复核用 expectedVersion 防覆盖；软删除过滤普通列表，已有基线／证据引用仍可内部解析。审计只追加。

Schema 改动后生成 Client、应用迁移、重启旧服务，再验网页。新版本相关测试与手工验收看 [Quickstart](../specs/002-quality-evaluation/quickstart.md)；旧测试通过不代表新设计已实现。
