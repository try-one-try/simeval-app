# SimEval 架构设计

**2026-09-27：双身份、自主配置、两步质量确认、独立模拟、多任务与软删除已接通。** 阶段 5 已接入比较、证据与结论编辑。2026-10-03 新增 LangChain 评测助手及报告，本地手工验收待完成。行为看[规格](../specs/002-quality-evaluation/spec.md)，规则矩阵与算法看[计划](../specs/002-quality-evaluation/plan.md)，比较与复核看[003规格](../specs/003-comparison-review/spec.md)，HTTP 看 [OpenAPI](openapi.yaml)。

## 1. 运行边界

Next.js、TypeScript、Auth.js、Prisma、PostgreSQL 组成模块化单体，一个应用部署。合成数据、预置质量报告、模拟执行与缓存报告必须标注；不运行真实仿真、训练或 ETL。不增加微服务、队列、Worker 或 WebSocket。

## 2. 文件与调用关系

| 位置 | 职责 |
|---|---|
| `src/app/(workspace)/` | 核对会话，组合各板块页面 |
| `src/lib/demo-identity.ts`、`src/lib/workspace-navigation.ts` | 公开身份、入口和导航定义；不含口令 |
| `src/server/auth/`、`src/auth.ts` | 访问密码与身份校验，Auth.js 限时 JWT 会话，页面门禁 |
| `src/features/identity/`、`src/app/login/` | 原生单选组与切换弹层；Server Action 建立对应会话 |
| `src/features/` | 表单、任务选择、结果与交互状态；客户端不访问 Prisma |
| `src/app/api/`、`src/server/http/api.ts` | HTTP 入口；身份／角色／Origin／Zod、统一错误和 requestId |
| `src/server/application/` | 组织完整用例，输出不含密钥的 DTO |
| `src/domain/evaluation.ts` | 质量、配置、权限与状态的纯业务规则 |
| `src/server/repositories/` | Prisma 查询、条件更新与事务 |
| `src/server/providers/` | 可替换 EvaluationProvider；现有确定性 Mock |
| `src/server/db.ts`、`prisma/` | 连接池、Schema、追加迁移和幂等 Seed |
| `tests/unit`、`tests/integration` | 规则／HTTP 边界与独立 PostgreSQL 集成验证 |

~~~mermaid
flowchart LR
  B[浏览器] --> P[服务端页面]
  B --> H[HTTP 入口与校验]
  P --> A[应用服务与 DTO]
  H --> A
  A --> D[领域规则]
  A --> R[事务仓储]
  R --> E[现有 Mock 纯计算]
  R --> DB[(PostgreSQL)]
~~~

登录／切换走 Server Action：访客选择身份并输入访问密码 → Credentials 在服务端核对 `ACCESS_PASSWORD` 和预设账号 → Auth.js 签发带授权时间的 JWT Cookie → 角色默认页。相同来源 15 分钟内输错 5 次暂停 15 分钟；数据库只保存来源摘要和失败窗口。会话最多 12 小时；旧令牌没有授权时间会失效。页面与 HTTP 每次用会话 userId 重新查数据库；历史 ADMIN 或不匹配账号视为失效。切换前先核对当前会话，再由服务端重建目标身份会话，不要求访客重输密码。

首屏由 Server Component 直接调用应用服务；业务交互通过 HTTP。当前 Mock 在事务内只做本地纯计算；AI 网络请求已放在事务外，未来外部执行也须如此，校验结果后用短事务保存。

### 页面读取与连接复用

- 页面布局和正文通过 React `cache` 共用本次请求的身份读取；`evaluationRepository.get` 也在同一次 React Server Component（RSC）请求内复用相同任务 ID 的读取结果。缓存不跨请求、不跨访客，换页及 HTTP 读写仍读取当前数据并校验权限。
- 任务列表读取取消只读事务，减少 `BEGIN／COMMIT` 往返；`findMany` 和 `count` 顺序执行，复用已建立的连接，避免冷连接时并发计数额外等待远程握手。列表与总数按各自读取时点返回；写入仍通过服务端状态校验与事务保护。
- 任务选择、分页和助手选择共用 `RunSummaryData`，仓储只查展示字段，用过滤计数统计待复核数。比较下拉候选只查名称和版本；选中的任务与基线才读取完整指标。摘要和详情使用不同类型，接口字段见 OpenAPI 的 `RunSummary` 与 `ComparisonBaseline`。
- 比较页先读取候选任务，再并行读取指定基线（有选择时）、可选历史基线和证据索引，最后校验比较口径。并行只用于这些彼此独立的读取。
- 报告读取保留当前来源指纹核对；确认时继续重查来源并校验 `expectedSourceHash`，防止确认已变化的依据或未读过的报告。
- Prisma 7 开启 `relationJoins`，关联读取默认由数据库合并返回，减少远程往返。目前是 Prisma 的预览特性，升级依赖时需复查；必要时可对个别查询指定 `relationLoadStrategy: "query"`。它只改变查询方式，不需要数据库迁移。机制见 [Prisma 关联查询文档](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/relation-queries)。
- 每个进程最多 5 条连接，空闲 60 秒释放，连接等待上限 10 秒。修改连接配置或重新生成 Prisma Client 后，应重启本地开发服务，避免继续复用旧实例。
- 助手收起时停止随页面切换读取任务，重新展开才核对当前任务；聊天归属和正在执行的调查不受影响。
- 报告页提供 `loading.tsx` 加载占位和 `error.tsx` 读取失败／重试界面；任务选择页点击进入后显示“正在打开…”，等待期间禁用重复进入、切选、分页和删除。反馈使用路由过渡状态，不增加全量预取，也不代表数据库查询耗时下降。
- 本机开发服务到远程数据库仍有网络耗时。开发模式编译、首次建连和业务查询分别计时；查询变快不能直接等同于整页加载达标。

## 3. 新产品怎样映射到工程

| 产品行为 | 工程边界 |
|---|---|
| ENGINEER／REVIEWER 二选一 | 服务端建立对应会话；导航随角色变化，权限重新查数据库 |
| 配置 → 质量确认 → 创建 | 目录返回兼容组合；服务端复查版本、范围和质量，保存配置快照 |
| 基线可选 | 无基线也能模拟；比较时才要求两个成功且同口径的任务 |
| 多任务选择／延续 | URL 和请求明确携带 runId；侧栏先选，正文按钮延续，不能自动覆盖成最近任务 |
| 取消／重试／删除 | 本人权限＋状态校验；重试新 ID；删除用可见性标记，保留引用 |
| 草稿／最终结论 | 两者分开保存；版本保护、历史、审计与报告失效一起写入 |
| 报告 | 每任务一份系统模板；来源未变复用，变化更新原 ID；评测人员确认，更新前正文和确认信息留审计 |

结果页按显式 runId 查询所选任务的状态、配置、指标和待复核数，取消独立总览；旧 /overview 地址只做兼容重定向。未完成任务只展示状态，没有基线不伪造比较，没有结果不伪造异常。指标按 Benchmark 定义，目录变化必须影响结果口径。

## 4. 已迁移与后续数据变化

阶段 4 追加 `202609270001_autonomous_evaluation`，阶段 5 追加 `202609270002_comparison_review`。它们是 MySQL 历史迁移，现已原样归档到 prisma/archive/mysql-migrations。阶段 6 使用当前 Schema 的 PostgreSQL 初始迁移创建独立新库，旧 MySQL 数据库保留；后续 PostgreSQL 变更继续追加。运行、TLS、直连、恢复与上线验证见[部署验收](../specs/004-deployment/quickstart.md)。

| 对象 | 目标变化 |
|---|---|
| EvaluationRun | 新建 name 必填、baselineRunId 可空；已加 targetSuccessRate（可空 0.8／0.85）、configurationSnapshot、deletedAt／deletedById |
| 模型／数据／Benchmark 目录 | 兼容矩阵与命名统一在 domain/evaluation-catalog.ts；catalog.ts 补目录后调用 demo-fixtures.ts，完整 Seed／db:catalog 共用，保留已有结果、人工内容和删除状态 |
| AnomalySample | 已分开 draftConclusion 与已确认 conclusion，保存修改人／时间、confirmedById／confirmedAt 和 confirmedRevision；现有 version 用于所有编辑防覆盖 |
| ReviewRecord | 只追加每次草稿／确认／修改的内容、操作者、时间与来源版本，不要求人工分类 |
| AIReport | 兼容旧表名；currentForRunId 为可空唯一键，非空时必须等于 runId，每任务至多一份当前报告；updatedAt 记录更新。来源 hash 包含任务、指标和样本编辑版本；provider=system-evidence-v1，model=null。旧重复记录保留但不展示 |

草稿保存只增加编辑 version；最终结论内容改变才增加 confirmedRevision 并令报告过时。报告读取和确认还核对完整来源指纹，因此草稿变更也可能使报告过时。更新报告保留 ID，恢复 READY 并清除原确认；更新前正文、来源及确认信息写入 AuditLog。确认同时核对 expectedSourceHash 与当前报告、当前来源，避免确认未读过的新内容。

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

comparison-view / anomaly-list / sample-detail / review-editor → HTTP 统一边界 → comparison-review 应用服务 → 领域规则／仓储 → PostgreSQL。页面首读直接调用同一应用服务；DTO 只发送公开证据、人物姓名与版本。

复核先锁 EvaluationRun，复查成功／未隐藏及权限；再检查 AnomalySample.version 并条件更新。当前内容、ReviewRecord、旧报告过时标记、AuditLog 同事务提交。两个请求拿同一版本时一个成功、另一个 409；前端保留后者输入。任务删除也锁同一任务，防止隐藏后继续写复核。

确认修订号只追踪最终文本变化；编辑版本追踪全部保存。已有 RESOLVED 故事在迁移中补确认修订 1 及历史确认人，旧内容和旧分类／回补关系保留。完整 Seed 初始化新环境时重建固定示例确认字段；本轮开发库只追加迁移，没有重跑完整 Seed。

## 6. 评测调查 Agent

新增 AssistantSession、AssistantTurn、AssistantBudget；共享业务账号之上，以服务端每次登录生成的 accessId 隔离私人聊天。助手接口从认证令牌读取访问标识，不接受客户端自报。报告使用普通业务鉴权，不依赖 accessId、会话或聊天轮次。公开页无助手，工作台按需加载聊天依赖。

LocalRuntime → 本站 NDJSON → assistant 应用服务 → LangChain createAgent → 四个只读业务工具 → 既有应用服务和仓储。模型不能选择账号、执行任意 SQL 或修改业务数据。工具结果带证据 ID、数据快照与时间，引用验证后才能保存为有效分析。

数据库保存聊天历史，但模型仅接收近期三轮成功问答；不是长期记忆。模型前预留费用，完整用量返回后结算差额；状态条件更新避免取消后被成功覆盖。Agent 仅限聊天与只读工具调查，不生成或保存报告。

报告页直接调用独立报告服务，固定模板整理当前任务指标和人工结论，不调用模型、不消耗 AI 预算。生成和确认均锁定任务行，与复核和删除共用锁；数据库唯一键避免并发生成两份。迁移只把每个任务最新一条旧模板报告指定为当前报告，旧重复记录留库；报告接口不返回它们。

详细文件、运行限制与取舍见 [006 实施计划](../specs/006-evaluation-agent/plan.md)。
