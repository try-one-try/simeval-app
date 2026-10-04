# 评测助手实施计划与当前实现

2026-10-04：代码 `3b81783` 已部署，正式库增量迁移完成，生产登录与只读接口检查通过。负责人已确认 Production 三项 AI 变量和 Redeploy Ready；模型失败已定位为 401 密钥认证失败，待更换 Production 密钥后重新部署并验证一次真实问答。负责人完整页面验收和阶段验收仍未完成。范围见 [spec.md](spec.md)，数据见 [data-model.md](data-model.md)，操作见 [quickstart.md](quickstart.md)。

## 1. 实际技术栈

| 层 | 采用 | 负责什么 |
|---|---|---|
| 页面与 HTTP | 现有 Next.js 16、React 19、TypeScript | 工作台常驻入口、HTTP 流、服务端认证 |
| 聊天状态 | assistant-ui/react 0.15.23 LocalRuntime | 管理消息和停止；适配本站接口，无额外助手云服务 |
| Agent | langchain 1.5.15、core 1.2.14 | createAgent 提供模型与工具循环，无独立 LangGraph Server |
| 模型 | langchain/openai 1.6.2、gpt-5.4-mini | 官方 Chat Completions、工具调用和文本流，reasoning=none |
| 本机网络 | undici 6.29.0 ProxyAgent | 仅模型请求可选代理，不改数据库或全局 fetch；Vercel 忽略本机代理 |
| 业务与保存 | Zod、Prisma 7、现有 Neon PostgreSQL | 复用业务服务，新增三张助手表，复用 AIReport |

一个 Agent 已能完成当前调查，没有引入 RAG、向量库、多 Agent、队列、WebSocket 或断点恢复平台。LangChain 的间接 LangGraph 依赖只用于当前进程执行。

## 2. 调用链与维护入口

发送问题 → HTTP 核验身份／Origin／参数 → 应用服务预留预算、创建轮次 → LangChain 选择工具 → 工具查询已有业务服务 → 模型解释工具结果 → 校验引用 → 保存结果、结束流。

| 文件 | 职责 |
|---|---|
| features/assistant/appearance.ts、content.ts | 起伏／倾斜／弹跳参数、名字、示例问题和继续询问文案 |
| features/assistant/follow-up.ts | 纯函数按本轮可信证据、样本、基线与原问题选择最多三个追问 |
| assistant-host.tsx、assistant-panel.tsx | 登录后单次挂载、按需加载、任务／基线和窗口／历史状态 |
| conversation.tsx、report-list.tsx | 聊天适配器、停止、Markdown、调用记录、证据卡、继续询问按钮、报告界面 |
| auth.ts、server/http/assistant-api.ts | 每次登录生成 accessId，接口重查账号及访问标识 |
| server/agent/model.ts | 唯一模型接入点、官方地址、局部代理，无隐式重试 |
| server/agent/error-diagnostics.ts | 读取框架包装内的错误分类，仅记录允许的状态码和诊断字段 |
| server/agent/agent.ts | 提示词、最近三轮成功问答、调用计数和引用校验 |
| server/agent/tools.ts | 四个只读工具、有限结果、证据快照与真实记录 |
| server/agent/config.ts | 次数、上下文、超时、模型价格和预算限制 |
| server/application/assistant.ts | 执行、中止、用量结算与终态 |
| server/repositories/assistant-repository.ts | 归属、预算行锁、幂等、历史、来源指纹 |
| server/repositories/report-repository.ts | 模板、来源重查、角色、任务行锁与审计 |
| domain/assistant.ts | 参数、证据、流事件和报告格式 |

页面只提供 URL 中的任务、基线、样本 ID，不读取或上传整页 DOM。ID 只是提示，服务端仍核验。对话绑定对象不随页面悄悄变化；模型只查数据。报告生成、更新和确认由用户在报告页独立触发，不经过聊天调用链。

## 3. 上下文与报告

2026-10-03 修订：Agent 保留聊天与只读工具调查；报告移出聊天操作，每个成功且可见任务只有一份当前系统报告。新增 currentForRunId 唯一约束及 updatedAt，将每任务最新的旧模板报告接为当前报告，其余记录保留并退出当前报告展示。生成／更新锁任务，数据相同保留原 ID 和确认状态；来源变化更新同 ID，更新前内容写审计并清除旧确认。来源摘要模块由聊天和报告共用，报告不导入 Agent 配置或模型模块。取消独立总览，评测结果页承接原信息，旧 `/overview` 经认证后跳到有效任务的结果页或任务列表。

报告入口为 `POST /api/ai-reports {runId}`，不接收聊天轮次。确认入口为 `POST /api/ai-reports/{reportId}/confirm {expectedSourceHash}`。报告已被其他人更新时返回 VERSION_CONFLICT；报告来源已变化时返回 SOURCE_CHANGED，均拒绝确认并要求先重新核对。

登录访问标识与账号共同隔离聊天；旧令牌缺标识需重新登录。每轮向模型提供最近三轮成功问答；工具数据快照和调用记录另外落库，历史引用不能作为本轮证据。失败轮次不混入下次上下文；未实现长期记忆。

继续询问由客户端从固定文案中选择，依据本轮 TurnView 的可信证据类型、样本证据、绑定基线与原问题；历史成功回答复用同一函数重建。仅成功轮次显示，无基线不推荐比较。conversation.tsx 接入轻量 CSS 按钮，点击替换并聚焦输入框，用户编辑后自行发送；新一轮生成时按钮禁用。建议选择与点击不增加模型调用、token、HTTP 请求或数据库字段。

Markdown 禁用 HTML、模型图片和外链；只有服务端生成的证据卡可导航。报告使用当前任务指标及人工结论套模板，完全不调用模型，不复制私聊或工程师专用比较文本。两个角色可生成、更新和查看，只有评测人员确认。

来源指纹包括任务状态、指标和样本编辑版本，因此修改草稿也可能触发过时，这是保守处理。报告保存／确认与人工复核锁同一任务行。程序能核对引用与权限，不能保证每句推断正确。

## 4. 执行与费用边界

最多 6 次模型／8 次工具、60 秒一轮；单次输出 1800 token，近期三轮上下文，会话最多 16 轮。单次登录每小时 12 轮、40 个对话、同时一轮；全应用最多三轮并发。消息与工具结果限制体积。

按模型公开价格每百万输入 $0.75／输出 $4.50 保守估算（缓存也按普通价格）。一次最多预留 $0.40，完整用量返回后退差额；中止、断线或未知用量不盲目退费。SDK 与模型重试均关闭。

本次开发与生产验证合计不超过 $3；应用默认累计额度也为 $3。账本在数据库，重启或恢复演示数据不重置预算，已用与预留金额继续累计。更换模型必须同步核对价格与上限。

停止落库并尽力取消上游。进程硬退出后，读取历史／下次请求按截止时间收敛遗留 RUNNING；不自动续跑，也不保证取消后供应商未收费。

## 5. 实施与验证

三批连续实施：依赖／迁移／查询 → 多工具／历史／流／限制 → 报告／文档。具体状态见 tasks。

- 开发库与正式库均已应用 20261003090000_assistant_sessions 和 20261003100000_single_system_report；本次只做增量迁移，没有 Seed 或重置。
- 开发库报告迁移前后计数保留：任务 10、样本 10、复核 4、聊天轮次 7、报告 7。其中 2 份被选为当前报告，其余历史报告隐藏于当前报告接口和页面，不删除原数据。
- 正式库已在用户确认 Production 连接匹配后备份并迁移。迁移前后业务内容指纹一致：任务 10、指标 32、样本 10、复核 4；原有 1 份报告及其 ID 保留。该数据与开发库的 7 份报告分开记录。
- 本地真实接通检查：2 次模型，1581 输入／163 输出 token，约 15.2 秒，估算 $0.00192；工具查询、145 个文本片段与保存成功。仅一个案例，不代表全部工具或页面通过。
- 首次检查在模型调用前遇到锁函数 void 返回值无法被 Prisma 解码，转 text 后修复。
- 回答曾混淆执行成功与业务达标，已在提示词区分；修改后的效果留待人工检查，不宣称准确率。
- 本次修订的 lint、类型与生产构建均通过；收尾结果见任务清单。已同步退役总览的测试契约，未运行测试；按约定不新增或运行 Agent 自动化测试，页面由负责人手工验收。
- 代码 `3b81783` 已部署。正式域名通过密码与 CSRF 正常登录后，`GET /api/auth/session`、`GET /api/assistant/sessions` 和成功任务列表均返回 200，列表包含 8 个成功任务；这组发送问题前的检查共 0 次模型请求。
- 负责人已确认 Production 的 `OPENAI_API_KEY`、`OPENAI_MODEL` 和 `ASSISTANT_BUDGET_USD` 已配置，且 Redeploy 为 Ready。变量变更需新部署生效，数据库迁移本身不需要重建应用。
- 随后正式站发送一条问题：登录、初始化和创建会话均返回 200，消息 HTTP 也为 200，但流的 `done.turn.status=FAILED`，无回答、工具调用或证据。只读已保存轮次确认 `MODEL_ERROR`、`modelCalls=1`，输入／输出用量和 `chargedMicros` 均为 null。HTTP 200 不表示模型回答成功。
- 未知用量按规则保留 400000 微美元（$0.40）预算预留，该金额不是已确认的实际费用。已定位为该部署所用密钥认证失败，具体为何无效仍未核实。待负责人替换 Vercel Production 的 `OPENAI_API_KEY`、Redeploy 到 Ready 后验证一次真实问答；更换前不重复请求，不清账本。真实问答、流、保存、平台时限和页面验收仍未通过。
- 服务端诊断代码已线上生效：LangChain 中间件把供应商错误放入 `cause`，新日志限深读取原因链，只记录白名单诊断字段，不输出错误正文、聊天或密钥。负责人提供的 23:26 `assistant_run_failed` 日志确认 `status=401`、`providerCode=invalid_api_key`、`providerType=invalid_request_error`、`langchainCode=MODEL_AUTHENTICATION`。诊断代码按约定只做源码审阅，未运行检查；HTTP、前端提示和费用规则均未变。
- 继续询问代码与文档已实现，页面待负责人按 quickstart 手工验收；本次按约定未运行检查、测试、构建或模型请求，不视为线上接通或验收通过。

## 官方依据

- [OpenAI 模型与价格](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [LangChain Agent](https://docs.langchain.com/oss/javascript/langchain/agents)、[流式输出](https://docs.langchain.com/oss/javascript/langchain/streaming)
- [assistant-ui LocalRuntime](https://www.assistant-ui.com/docs/runtimes/custom/local-runtime)

安装包类型优先于旧示例；本次 assistant-ui 使用 useAui，没有沿用旧 useAssistantRuntime。
