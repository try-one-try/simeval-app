# SimEval

面向具身智能团队的评测数据工作台：自主配置评测，用数据质量、指标与样本证据解释版本表现，再由人工确认结论与报告。

## 产品与真实状态

**2026-09-27：阶段 3–4 已验收；阶段 5 模型比较与结论复核已接通，待负责人验收。** 目标流程是：

选择模型／数据／Benchmark → 确认质量 → 创建并模拟执行 → 查看结果／按需比较基线 → 异常复核 → 生成并确认报告。

产品只有算法工程师和评测人员，预设登录二选一、无注册；工程师管理本人任务和草稿，评测人员确认结论／报告。除创建外先选择任务，后续按钮延续当前任务；支持多任务、取消／重试／软删除。首次没有基线也应能评测；不做独立回补管理或人工分类步骤。

**当前已实现双身份登录／切换、角色导航、自主配置与质量两步、无基线模拟、多任务单选／上下文延续、所选任务总览、取消／重试／软删除。** 同口径比较、异常证据下钻及自由结论草稿／确认／修改历史也已实现，共十四个业务 HTTP 操作。AI 报告生成／确认尚未开放，方案待重新讨论。合成数据、预置报告与模拟执行明确标注，不运行真实仿真或训练。

质量检查、实际验证证据与待验步骤见各规格 quickstart。目标是在几分钟内看懂“总体提升但遮挡回退 → 日志证据 → 人工确认”。部署与首次访问计时仍待完成。

## 面试官从哪里看

| 内容 | 入口 |
|---|---|
| 产品与交互 | [Figma 原型](https://www.figma.com/design/Y2ZIhN1yuuXBeieGkxtnsH/simeval?node-id=43-2)，预设交互不等于业务实现 |
| 评测与任务规格 | [需求](specs/002-quality-evaluation/spec.md) → [计划](specs/002-quality-evaluation/plan.md) → [任务](specs/002-quality-evaluation/tasks.md) → [验收](specs/002-quality-evaluation/quickstart.md) |
| 比较与复核规格 | [需求](specs/003-comparison-review/spec.md) → [计划](specs/003-comparison-review/plan.md) → [任务](specs/003-comparison-review/tasks.md) → [验收](specs/003-comparison-review/quickstart.md) |
| 架构与数据 | [架构设计](docs/architecture.md)，分层、事务与迁移说明 |
| API | [OpenAPI](docs/openapi.yaml)、[调用与错误示例](docs/api-contract.md)，区分 implemented／planned／待改造 |
| 工程基础证据 | [基础规格](specs/001-demo-foundation/spec.md)、[原任务](specs/001-demo-foundation/tasks.md) |
| 开发规范 | [项目原则](.specify/memory/constitution.md)、[代理规则](AGENTS.md) |

`.specify/` 与 `.agents/skills/` 保存共享开发工作流。规格经审阅后用于实现，文件存在不等于功能完成。公开仓库中的材料可独立阅读；真实环境变量不提交。

## 本地运行与当前验收

采用 Next.js、TypeScript、Prisma 7、MySQL 和 Auth.js 的模块化单体。项目需要 Node.js 22 和本机 MySQL。首次可运行 PowerShell 初始化脚本自动建立项目库、专用账号和被 Git 忽略的 `.env.local`；已有配置也可参考 `.env.example` 手动设置。真实值不得提交。


| 配置                                           | 作用                                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `.env.example` / `.env.local`                | 公开占位模板 / 本地真实值。`DATABASE_URL` 是应用账号连接地址，`DEMO_PASSWORD` 是演示用户口令，`AUTH_SECRET` 用于会话。修改本地文件不会自动修改 MySQL 服务端的账号密码。 |
| `prisma7.config.ts` / `prisma/schema.prisma` | 前者让 Prisma CLI 读取本地连接并找到迁移与 Seed；后者定义表、关系和索引。                                                                   |
| `next.config.ts` / `postcss.config.mjs`      | Next.js 运行配置 / Tailwind 样式处理。                                                                                   |
| `eslint.config.mjs` / `vitest.config.ts`     | 静态检查规则 / 单元与集成测试入口及路径别名。                                                                                        |
| `package.json` / `tsconfig.json`             | 命令与依赖 / TypeScript 规则与 `@/` 别名。JSON 不支持注释，故在此解释。                                                                |
| `next-env.d.ts` / `prisma/migrations/`       | Next.js 生成的类型声明 / Prisma 生成并已应用的迁移历史；不为说明而手动修改。                                                                 |


网页的连接和登录调用顺序见[架构设计](docs/architecture.md)；业务源码中的中文注释说明各模块职责。

**第一次在新环境准备**（先安装并启动 MySQL，进入克隆后的仓库根目录；初始化脚本会隐藏询问 MySQL 管理员密码，不把它写入项目）：

```powershell
npm ci
.\scripts\setup-local-db.ps1 -Database dev
npm run dev
```

`npm ci` 按锁文件安装依赖并生成 Prisma Client。脚本固定创建或复用 `simeval_dev`，建立 `simeval_user`、生成随机数据库密码／会话密钥／演示口令，写入 `.env.local`，再执行仓库已有迁移和 Seed；已有 `.env.local` 时拒绝覆盖。最后 `dev` 启动网页。若你已手动配置数据库与 `.env.local`，跳过初始化脚本，核对目标库后运行 `npm run db:deploy`、`npm run db:seed`。修改 Prisma Schema 并创建新迁移时才运行 `npm run db:migrate`，它还需要 shadow database 权限。重装依赖前先停止正在运行的开发服务器。

**平时再次打开**：在 `simeval-app/` 中运行 `npm run dev`，看到 `Ready` 后访问 `http://localhost:3000`；结束时在该终端按 `Ctrl+C`。若端口 3000 已有本项目服务，直接打开网页即可，不要再启动第二个服务。改动依赖锁文件后才需要重新运行 `npm ci`；拉取仓库新增迁移时运行 `db:deploy`，自己修改 Schema 时运行 `db:migrate`，需要重建演示故事时运行 `db:seed`。Schema 变化后另运行 `db:generate` 并重启旧开发服务。

打开 `/login` 选择身份：工程师默认进入创建，评测人员进入异常复核的任务选择页。右上角可切换；角色导航和实际会话同步变化。创建默认空选，演示配置只填表；总览显示所选任务；阶段 4 更新已有环境：停止旧 dev，依次运行 `npm run db:generate`、`npm run db:deploy`、`npm run db:catalog`、`npm run dev`；新环境完整 Seed 已包含目录。评测检查看 [阶段4验收](specs/002-quality-evaluation/quickstart.md)，比较与复核看 [阶段5验收](specs/003-comparison-review/quickstart.md)。

生产预览先停止开发服务，再运行 `npm run build`、`npm run start`；仅对可信 localhost 在本地配置 `AUTH_TRUST_HOST="true"`，普通开发无需此项。MockEvaluationProvider 已接入，AI Provider 后续实现。

测试命令按目的区分：`npm run test:unit` 只测试代码逻辑，不需要 MySQL 测试库；`npm run test:integration` 才连接独立的 `simeval_test`，应用已有迁移、连续运行两次 Seed 并核对结果。首次使用集成测试前运行 `.\scripts\setup-local-db.ps1 -Database test`，它只建立测试库与账号，并写入被忽略的 `.env.test.local`；随后再运行 `npm run test:integration`。`npm test` 会运行所有 Vitest 用例，但没有测试库配置时会显示集成测试已跳过，不能当作集成测试通过。网页行为和视觉效果由项目负责人按照 [当前手工验收步骤](specs/002-quality-evaluation/quickstart.md#3-阶段-4-实现后再验) 在真实浏览器中检查，不运行自动浏览器测试。

本地 `127.0.0.1` 的 MySQL 地址只供本机使用。未来部署时应在托管环境配置其可访问的独立 MySQL `DATABASE_URL`、`AUTH_SECRET` 和演示入口变量，并对目标库单独执行生产迁移与 Seed；不要上传 `.env.local` 或使用本机数据库地址。
