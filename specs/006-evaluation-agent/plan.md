# 评测助手实施计划

2026-10-03：已开始全站助手入口与布局预览；Agent 依赖、真实模型调用和数据库切片尚未实施。功能边界以 [spec.md](spec.md) 为准。

## 技术选型与复用

| 层 | 计划采用 | 复用与新增 |
|---|---|---|
| 页面与接口 | 现有 Next.js、React、TypeScript | 共享布局挂载一个 AI 人按钮和聊天面板，业务页提供上下文 |
| Agent | langchain 的 createAgent、tool | 使用现成循环，不再叠加 AI SDK Agent |
| 模型 | OpenAI 官方 API，接入时验证 @langchain/openai | 先验证账户可用性、工具回传、流式及结构化输出；模型和价格以官方当前文档及账户为准 |
| 聊天 UI | 优先验证 assistant-ui LocalRuntime 与按需组件 | 自定义 ChatModelAdapter 连接现有 Route Handler，不采用要求额外 LangGraph 服务的默认模板 |
| 校验与业务 | 现有 Zod、应用服务、比较规则 | 工具只是受权限约束的业务入口 |
| 存储 | 现有 Prisma、Neon PostgreSQL | 会话与轮次记录，复用 AIReport |
| 部署与验证 | 现有 Vercel、Vitest、CI | 新功能按风险成批验证 |

LangChain 内部使用 LangGraph，不等于本项目需部署 LangGraph Server。首版通过数据库重建有限的近期消息上下文，不同时引入第二套 checkpointer 持久化；MemorySaver 不能当作 Vercel 生产数据库。后续只有出现任务恢复需求时才重新评估。

负责人已选择 OpenAI，替代先前的 DeepSeek 候选。首轮候选 `gpt-5.4-mini`：2026-10-03 官方模型页确认支持工具调用、流式和结构化输出；实际账户权限、LangChain 适配和分析效果仍需验证。模型名通过服务端配置保留替换能力，不为界面动效调用模型。LangChain 仍负责 Agent 循环，不再另接一套 Agent 框架。

负责人在本机被 Git 忽略的 `.env.local` 配置 `OPENAI_API_KEY`，核对 API 可用额度并确定本次验证预算；部署时再配置 Vercel。模型名称计划通过 `OPENAI_MODEL` 配置，实际读取逻辑在模型接入时新增；目前只是入口预览，配置变量不会自动产生费用。密钥仅由服务端读取，不用 `NEXT_PUBLIC_` 前缀，也不写进聊天、日志或文档。

### 入口预览与形象

已在根布局挂载共享 AssistantHost；首次展开才加载面板，提供静态产品说明和示例问题预填。发送暂不可用，并明确显示“AI 分析尚未接通”。当前没有读取私人会话或调用模型，不能当作 Agent 闭环验收。

形象采用负责人提供的托腮照片生成的 Q 版透明 WebP，保留黑发、墨镜、浅蓝衬衫。待机往返高度 20px／周期 2.4 秒，靠近时倾斜最多 10 度，点击弹跳 24px；面板展开暂停待机起伏，减少动态效果模式禁用动画。参数集中在 `src/features/assistant/appearance.ts`，文案在 `content.ts`。这是二维素材与 CSS 变换，不宣称骨骼动画或真正转头。

前端组件最终采用与否以第一批接入验证为准。保留黑白设计；组件生成器可能修改全局样式，须审阅改动。只引入对话、输入、工具展示和必要 Markdown 渲染；关闭未实现的附件、语音、编辑分支等操作。流式文本禁用原始 HTML，链接只允许安全协议，证据链接由服务器构造。

## 调用链与文件职责

用户发送问题 → Next.js HTTP 边界 → assistant 应用服务核验身份／会话／任务 → LangChain 选择工具 → Zod 与权限检查 → 现有业务服务和仓储 → 工具结果返回模型 → 校验回答证据 → 保存并展示。

| 计划位置 | 职责 |
|---|---|
| src/app/layout.tsx 与共享客户端 AssistantHost | 全站单次挂载浮动按钮和面板；不新增助手页面 |
| src/app/api/assistant/ | 会话／轮次 HTTP 入口、认证、Origin 与请求校验 |
| src/features/assistant/ | 浮动头像、面板／放大模式、上下文桥接、聊天适配器、真实工具状态、证据卡 |
| src/server/agent/agent.ts | createAgent 配置、提示词、执行上限 |
| src/server/agent/tools.ts | 四个工具及业务调用包装 |
| src/server/agent/evidence.ts | 证据登记、来源快照、引用验证 |
| src/server/providers/analysis-provider.ts | 实时 LangChain 实现与明确标注的测试／示例实现 |
| src/server/application/assistant.ts | 授权、会话上下文、运行和保存 |
| src/server/repositories/assistant-repository.ts | 数据库访问与短事务 |
| src/domain/assistant.ts | 请求／结果 Schema 与状态规则 |

现有 comparisonReviewService、evaluationService 和仓储是主要复用点。业务工具直接调用应用服务，不向自己的 HTTP API 发请求。需要统一的授权先补应用层，不只依赖 UI 隐藏按钮。

共享 AssistantHost 持有面板／会话状态，具体页面通过轻量上下文桥提供 pageType、runId、baselineRunId、sampleId。URL／桥接数据只是候选标识，服务端重新核对；不读取整个 DOM 或默认上传页面文本。公开入口只显示静态帮助，身份由服务端核验。退出／身份切换通知 Host 取消运行并清空状态；路由卸载时清除旧页面上下文。浮动层按需加载聊天依赖，使用轻量头像，检查与主页加载屏、导航、对话框和键盘的层级关系。

## 数据与接口草案

新增 AssistantSession：创建者、任务、显式基线、标题、创建／更新时间。新增 AssistantTurn：会话、幂等请求 ID、问题、状态、截止时间、回答、消息／调用 JSON、证据快照、来源版本、模型／提示词版本、用量与耗时。首版调用记录用 JSON，不单独建设日志平台。

普通对话只对创建者可见，报告另按报告权限分享。保留成功的完整消息块和对应工具结果；失败／取消的一轮不把悬空 tool call 混入下次上下文。旧证据标为历史数据，需要当前结论时重新查工具。序列化只保存允许字段，不保存密钥或模型内部推理。

计划需要会话创建／列表／详情、发送消息流、停止轮次和报告保存／确认能力。实施时先核对已有 planned 报告 HTTP 契约，统一更新 docs/openapi.yaml 和 api-contract.md；本文件中的能力不代表接口已经存在。

候选流事件：轮次开始、工具开始、工具结果／错误、回答片段、引用验证结果、轮次结束。根据锁定版本的 LangChain 流 API 转换到有限的公开事件，响应中不透传全部框架内部状态。回答片段显示生成中，引用校验完成后才显示为正式结果。

停止信号从浏览器传给服务端及模型调用；工具间检查取消状态与截止时间。进程终止后以持久化截止时间和条件更新收敛状态，旧运行不能覆盖新运行。关闭页面不承诺后台继续，重试生成新轮次且不重复原报告写入。

## 三批实施

### 第一批 最小可运行主线

1. 核对模型服务商、工具调用支持、部署地区可达性和预算；检查项目 Node／React／Zod 与依赖兼容性，锁定版本。阅读实际 Next.js Route Handler 文档。
2. 确认浮动 AI 人、聊天面板及放大／收起布局和一个演示任务；快捷问题只预填，不自动发送。审阅具体 Schema／HTTP 契约后执行增量迁移。
3. 先接 getEvaluationSummary，完成页面发送 → 真实模型请求 → 真实查询 → 显示工具结果 → 保存本轮记录。验证 assistant-ui 的文本、工具事件和取消适配。
4. 加入其余三个工具，模型根据问题选择路径；保留现有比较门禁。增加结构化输出和基本引用验证。

完成标准：本机网页实际跑通一次查询和一次多工具调查，原始证据可打开，模型错误和缺少密钥有明确状态。密钥未就绪时只完成界面／替身验证，不把它记为真实 Agent 通过。

### 第二批 可追问且可解释

5. 会话历史、任务隔离、最近完整轮次上下文、来源版本与过时提示；同一会话串行、幂等提交。适配历史渲染，不让前端伪造 assistant／tool 历史。
6. 加上证据卡、可展开实际调用摘要、追问、停止、超时、失败后重新发起。验证同任务跨页保留对话、不同对象显式开启新对话、收起仍可收到完成状态、退出／身份切换立即清空，以及移动端键盘与焦点。为权限、无基线、无证据和注入文本编写关键测试。
7. 统一执行预算。初始建议最多 6 次模型调用、8 次业务工具调用、60 秒单轮预算；这些是待实测参数，框架内部图步数不能直接当成模型调用次数。并发工具共同计数，模型重试和结构化修复也计入预算。重复只读查询可在本轮复用。

完成标准：追问正确承接对象；刷新能查看已保存结果；取消、超时、双击不生成虚假成功；工具和提示词错误可定位到调用记录。确认 API 请求级取消是尽力传播，不承诺退回已消耗的模型用量。

### 第三批 报告闭环与发布验收

8. 显式把已验证分析转换为 AIReport 草稿；能确定性套模板时不再次调用模型。来源检查、确认角色、审计、旧报告过时复用现有机制。
9. 固定用例做离线规则验证，再用少量真实模型调用检查选工具、引用相关性和中文解释。记录模型／提示词版本、调用次数、用量、耗时和失败样例，不追求逐字一致。
10. 更新 PRD、架构与接口、开发流程和启动说明；检查 Vercel 执行时限、变量与流式响应，再按既有发布流程上线。预算在应用端限制并与平台时限匹配，不以流式响应推断可无限运行。

完成标准：完整流程、两身份权限及线上真实调用通过；性能与用量只写实测值。模型不可用时可以打开已保存且标明日期／模型／来源的历史示例，由用户主动选择，不自动冒充实时回答。

## 关键验收案例

| 案例 | 检查结果 |
|---|---|
| 可比任务询问退步 | 调用比较，并用实际指标支持回答 |
| 问待复核样本 | 使用筛选工具，不必固定跑完四工具 |
| 基于上一轮追问 | 保持任务和样本上下文，必要时重新查询 |
| 没有基线／不可比 | 说明限制，不编造提升或绕过同口径规则 |
| 没有异常／工具报错 | 区分空结果和查询失败 |
| 另一任务样本／另一身份会话 | 服务端拒绝访问 |
| 无效引用／来源改动 | 拒绝有效证据标记；报告不能错误确认 |
| 日志含“忽略规则”等文本 | 作为数据处理，权限不能改变 |
| 停止／超时／重复提交 | 状态收敛，有限执行，不重复保存报告 |

离线测试复用 Vitest 和工具替身；真实调用集中做小批验证，UI 与简单文案调整不反复全量测试。每批可运行功能按仓库要求完成 lint、类型、相关测试和实际页面检查。

## 官方依据

- [OpenAI GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini)：候选模型的工具、流式和结构化输出支持。
- [OpenAI 生产实践](https://developers.openai.com/api/docs/guides/production-best-practices)：密钥与应用环境配置。
- [LangChain TypeScript Agent](https://docs.langchain.com/oss/javascript/langchain/agents)：createAgent 与工具循环。
- [LangChain Streaming](https://docs.langchain.com/oss/javascript/langchain/streaming)：实际模型／工具事件；使用锁定版本对应 API。
- [结构化输出](https://docs.langchain.com/oss/javascript/langchain/structured-output)：Schema 验证不等于业务证据正确。
- [短期记忆](https://docs.langchain.com/oss/javascript/langchain/short-term-memory)：理解会话状态与 checkpointer，首版采用应用数据库管理完整近期轮次。
- [assistant-ui LocalRuntime](https://www.assistant-ui.com/docs/runtimes/custom/local-runtime)：现成聊天状态与自定义后端适配。
- [assistant-ui LangGraph Runtime](https://www.assistant-ui.com/docs/runtimes/langgraph/overview)：默认后端要求与本项目单体边界不同，不直接套用。
