# SimEval｜具身智能模型评测平台

SimEval 是一个具身智能模型评测平台，涵盖评测配置、结果分析、异常复核和报告生成。当前版本以仓储抓取与放置为示例，通过合成数据和模拟评测展示完整流程。

项目从 PRD、Figma 原型开始，使用 GitHub Spec Kit 组织需求和开发任务，由 Codex 辅助实现，再通过 Vercel、Neon 和 Cloudflare 部署上线。设计文档、功能规格和源码都保留在本仓库中。

**在线体验：[www.jaimeqianqian.com](https://www.jaimeqianqian.com)**

[产品需求 PRD](docs/PRD.md) · [Figma 产品原型](https://www.figma.com/design/Y2ZIhN1yuuXBeieGkxtnsH/simeval?node-id=371-484) · [架构与全部接口](docs/架构与接口.md) · [开发流程](docs/开发流程.md)

> 演示边界：评测数据与样本日志为合成内容，数据质量检查为预置结果，评测执行为模拟，不运行真实仿真器或训练模型。AI 助手通过 OpenAI API 进行真实问答；系统评测报告由程序整理指标与人工结论生成。

## 可以体验什么

| 功能 | 具体内容 |
|---|---|
| 评测配置与质量确认 | 选择模型、数据集和评测基准，配置执行参数；检查任务名称与组合是否可用，确认数据质量后再创建。 |
| 模拟评测与任务管理 | 查看等待、执行和结束状态，管理多个任务，支持取消、失败重试和软删除；相同配置与随机种子可复现结果。 |
| 结果与模型对比 | 查看总体和分场景指标，选择相同评测条件下的历史版本进行比较；没有基线也可查看本次结果。 |
| 异常样本复核 | 从指标找到相关样本，查看日志、编辑草稿、确认结论，保留修改历史与操作审计。 |
| 系统评测报告 | 每个成功任务保留一份当前报告，汇总指标和人工结论；来源变化后更新内容并重新确认。 |
| AI 评测调查助手 | 围绕当前任务提问，由模型选择只读工具查询资料，展示流式回答、证据引用和实际工具记录，支持历史与快捷追问。 |
| 交互主页 | 用 Canvas 序列帧动画将鼠标方向和触屏拖动映射为人物动作，配合 WebP 图集、预加载与静态降级。 |

### 建议体验顺序

1. 打开主页，查看人物交互和项目资料，点击「开始体验」。
2. 输入访问密码，选择「算法工程师」。可直接查看预置任务，也可使用演示配置创建一条任务。
3. 确认数据质量，完成模拟评测，查看结果并按需选择历史基线。
4. 从指标进入异常样本，查看证据并保存复核草稿；切换为「评测人员」后确认结论。
5. 生成系统报告，查看人工结论与确认状态。调查过程中可随时打开右下角助手提问。

两种身份用于演示权限差异，无需注册。任务、复核和报告属于共享演示数据；AI 聊天按账号与本次登录共同隔离。助手只查询和解释资料，修改任务、保存结论和确认报告仍在对应页面操作。

## 产品与原型设计

先用 [PRD](docs/PRD.md) 确定平台的主要流程、角色权限、MVP 范围和功能规则，再在 [Figma](https://www.figma.com/design/Y2ZIhN1yuuXBeieGkxtnsH/simeval?node-id=371-484) 中设计页面与交互。

视觉采用**极简主义设计与黑白灰视觉体系**。主要信息先展示，详细指标和证据按需展开；创建评测分步完成，查看结果时持续保留当前任务与基线，操作后给出明确反馈。原型用于提前梳理布局、功能衔接和不同状态，正式网页保留后续实现中的调整。

## Vibe Coding, with a Spec

项目使用 **Spec Driven Development（规格驱动开发，SDD）** 组织 AI 辅助开发。通过 [GitHub Spec Kit](https://github.com/github/spec-kit) 为功能整理三类文件，再交给 Codex 按任务实现：

| 文件 | 在本项目中的用途 |
|---|---|
| `spec.md` | 写清功能做什么、哪些不做、角色权限、边界情况和验收条件。 |
| `plan.md` | 确定实现方式，包括页面、服务、数据库、接口和关键技术选择。 |
| `tasks.md` | 将方案拆成可执行任务，记录交付与检查情况。 |

开发过程中由作者确定范围、审阅方案、核对实现并验收体验。需求变化时同步更新规格，再调整代码。[项目原则](.specify/memory/constitution.md) 约束架构与质量要求，[功能规格目录](specs/) 保留各部分的需求、计划和任务。

## 技术栈与实现

| 部分 | 技术与用途 |
|---|---|
| 页面与交互 | Next.js、React、TypeScript、Tailwind CSS；Canvas 绘制主页人物序列帧。 |
| 登录与校验 | Auth.js 管理密码准入与 JWT 会话；Zod 校验输入，服务端检查角色和操作权限。 |
| 数据库 | Prisma 访问 PostgreSQL，Prisma Migrate 管理增量迁移；事务、幂等与版本检查保护关键写入。 |
| AI 助手 | LangChain、OpenAI API、assistant-ui；四个只读业务工具、流式响应、证据快照、聊天持久化与调用限额。 |
| 部署与检查 | Vercel 部署应用，Neon 托管 PostgreSQL，Cloudflare 管理域名 DNS；GitHub Actions 执行代码、类型、测试与构建检查。 |

应用采用**分层的模块化单体**：在一个 Next.js 应用中，按业务组织评测、复核、报告和助手代码；按职责区分页面、HTTP 入口、应用服务、领域规则和数据访问。详细调用链、数据库关系和代码目录见[架构与接口文档](docs/架构与接口.md)。

## 文档导航

| 文档 | 阅读内容 |
|---|---|
| [产品需求文档（PRD）](docs/PRD.md) | 项目定位、角色、主要流程、功能规则和验收要求。 |
| [Figma 产品原型](https://www.figma.com/design/Y2ZIhN1yuuXBeieGkxtnsH/simeval?node-id=371-484) | 页面布局、角色入口和交互设计。 |
| [架构与接口](docs/架构与接口.md) | 分层与业务模块、数据关系、关键流程、带注释的代码目录，以及全部现行业务接口。 |
| [开发流程](docs/开发流程.md) | 从产品定义、原型和功能开发到部署上线的实施过程。 |
| [OpenAPI](docs/openapi.yaml)／[接口示例](docs/api-contract.md) | 接口参数、响应与错误约定；OpenAPI 中区分已实现和计划中的接口。 |
| [项目原则](.specify/memory/constitution.md)／[仓库协作规则](AGENTS.md) | 架构边界、验证范围和文档维护规则。 |

各功能的 `spec.md`、`plan.md`、`tasks.md` 和 `quickstart.md` 分别记录需求、方案、任务与运行验收方法：

| 功能规格 | 内容 |
|---|---|
| [001 · 工程基础](specs/001-demo-foundation/) | 初始工程、数据和身份入口。 |
| [002 · 质量与评测](specs/002-quality-evaluation/) | 自主配置、数据质量确认、模拟执行与任务管理。 |
| [003 · 比较与复核](specs/003-comparison-review/) | 同口径模型对比、异常证据与结论复核。 |
| [004 · 部署](specs/004-deployment/) | PostgreSQL、环境配置与部署流程。 |
| [005 · 交互主页](specs/005-homepage/) | 主页布局、人物交互、内容修改与手工验收。 |
| [006 · 评测助手](specs/006-evaluation-agent/) | Agent 查询、聊天隔离、证据与单份系统报告。 |

规格中的早期交付记录保留了当时状态，当前功能范围以 PRD 和现行实现为准。

## 本地运行

使用 Node.js 22 和独立的 PostgreSQL 开发库，也可使用 Neon 开发分支。

1. 执行 `npm ci` 安装依赖。
2. 将 [`.env.example`](.env.example) 复制为 `.env.local`，配置开发库连接、会话密钥和访问密码；体验真实助手时再配置 OpenAI API。真实配置文件不提交到 Git。
3. 在自己的开发库执行 `npm run db:deploy` 应用迁移，首次使用时执行 `npm run db:seed` 写入演示数据。
4. 执行 `npm run dev`，访问 [localhost:3000](http://localhost:3000)。

详细配置见[运行与部署说明](specs/004-deployment/quickstart.md)和[助手运行说明](specs/006-evaluation-agent/quickstart.md)。

GitHub Actions 检查 lint、TypeScript、业务单元测试、独立 PostgreSQL 集成测试和生产构建。人物序列帧交互与 Agent 问答采用手工功能验收，具体范围见对应规格。

## 在线访问

平台已部署上线，可直接访问：[www.jaimeqianqian.com](https://www.jaimeqianqian.com)。
