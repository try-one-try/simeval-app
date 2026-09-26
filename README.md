# SimEval

SimEval 是面向具身智能团队的评测数据工作台。它围绕数据质量、模拟评测、模型版本对比、异常样本复核、轻量数据回补和证据报告，帮助团队解释候选模型能否替换基线。

## 当前状态

**阶段 2 的本地工程基础与阶段 1.5 的当前 Figma 原型已由项目负责人验收；工程尚未按新原型更新。** 已实现 Next.js 入口、受保护概览、Auth.js 会话、Prisma 迁移和确定性 Seed。本机已验证登录、持久化概览、刷新与退出；lint、类型检查、13 项单元／组件测试、1 项独立 MySQL 集成测试和生产构建通过。网页由项目负责人手工验收；空／错误状态的真实浏览器走查及全新电脑上的初始化脚本运行尚无单独记录，见[阶段任务清单](specs/001-demo-foundation/tasks.md)。项目只使用明确标注的合成数据和模拟评测，不运行真实仿真器或训练模型。OpenAPI 的 19 个业务操作仍是未来切片的契约草案。

## 黄金路径

查看数据集质量 → 创建模拟评测 → 与基线比较 → 下钻回退指标与异常样本 → 人工复核并按需创建回补任务 → 生成、核对并确认报告。

## 从哪里阅读


| 内容       | 位置                                                              | 状态                                 |
| -------- | --------------------------------------------------------------- | ---------------------------------- |
| 产品原型 | [Figma 主线入口](https://www.figma.com/design/Y2ZIhN1yuuXBeieGkxtnsH/Untitled?node-id=11-2) | 当前设计已确认；预设交互，不代表业务代码已实现 |
| 架构与数据边界  | [架构设计](docs/architecture.md)                                    | 本地迁移、Seed 与独立测试库集成测试已通过            |
| HTTP 接口  | [OpenAPI 契约](docs/openapi.yaml)、[请求与响应示例](docs/api-contract.md) | 19 个业务接口仍是设计稿；Auth.js 自有会话路由已接入源码  |
| 项目原则     | [Spec Kit constitution](.specify/memory/constitution.md)        | 已确定的开发约束                           |
| 功能规格     | [演示工作台基础](specs/001-demo-foundation/spec.md)                    | 阶段 2 本地交付已签收；任务清单保留未单独核验项          |
| 代理协作     | [AGENTS.md](AGENTS.md)                                          | 公开仓库的工作规则                          |


`.specify/` 保存 Spec Kit 的共享模板、脚本与项目原则；`.agents/skills/` 保存 Codex 工作流技能。它们是开发工具文件。功能规格经审阅后才用于实施，按 `spec.md → plan.md → tasks.md → 实现与验收` 推进。

## 快速阅读

当前仓库可在本机进入演示概览；后续完整业务路径尚未实现。可先用 30 秒读上面的黄金路径，再按兴趣查看：

1. **产品判断**：先看 [Figma 原型](https://www.figma.com/design/Y2ZIhN1yuuXBeieGkxtnsH/Untitled?node-id=11-2)中的结论、指标与异常证据，再读[演示工作台基础规格](specs/001-demo-foundation/spec.md)；完整业务功能仍需后续切片实现。上线后 README 将提供演示地址与短导览。
2. **API 能力**：[OpenAPI](docs/openapi.yaml) 是机器可读契约，[请求与响应示例](docs/api-contract.md)展示质量门禁、复核、并发冲突和报告证据。
3. **架构与协作**：[架构设计](docs/architecture.md)说明模块边界；[项目原则](.specify/memory/constitution.md)约束实施；[阶段 2 任务](specs/001-demo-foundation/tasks.md)区分已完成与待验收工作。

目标体验是让首次进入的面试官在三分钟内看清“总体提升但遮挡场景回退 → 样本原因不同 → 人工确认结论”。完整写入流程和跨角色权限另有验收路径，不要求在快速导览中逐项操作。此处描述的是交付目标，不代表在线体验已经完成。

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

**平时再次打开**：在 `simeval-app/` 中运行 `npm run dev`，看到 `Ready` 后访问 `http://localhost:3000`；结束时在该终端按 `Ctrl+C`。若端口 3000 已有本项目服务，直接打开网页即可，不要再启动第二个服务。改动依赖锁文件后才需要重新运行 `npm ci`；拉取仓库新增迁移时运行 `db:deploy`，自己修改 Schema 时运行 `db:migrate`，需要重建演示故事时运行 `db:seed`。

当前只开放入口和概览，导航中的后续模块不可点击。本机已完成迁移、两次 Seed、实际登录、持久化概览、刷新、退出和 375px 无横向溢出走查；`npm run lint`、`npm run typecheck`、13 项单元／组件测试、1 项独立 MySQL 集成测试和 `npm run build` 通过。需要本地预览生产构建时，先用 `Ctrl+C` 停止开发服务器，再运行 `npm run build` 和 `npm run start`；仅对自己信任的 localhost 在被忽略的 `.env.local` 中设置 `AUTH_TRUST_HOST="true"`。普通 `npm run dev` 不需要此项。其余命令与待验项目见[完整验收步骤](specs/001-demo-foundation/quickstart.md)。评测执行与 AI 分析的 Provider 属于后续切片。

测试命令按目的区分：`npm run test:unit` 只测试代码逻辑，不需要 MySQL 测试库；`npm run test:integration` 才连接独立的 `simeval_test`，应用已有迁移、连续运行两次 Seed 并核对结果。首次使用集成测试前运行 `.\scripts\setup-local-db.ps1 -Database test`，它只建立测试库与账号，并写入被忽略的 `.env.test.local`；随后再运行 `npm run test:integration`。`npm test` 会运行所有 Vitest 用例，但没有测试库配置时会显示集成测试已跳过，不能当作集成测试通过。网页行为和视觉效果由项目负责人按照 [手工验收步骤](specs/001-demo-foundation/quickstart.md#浏览器走查) 在真实浏览器中检查，不运行自动浏览器测试。

本地 `127.0.0.1` 的 MySQL 地址只供本机使用。未来部署时应在托管环境配置其可访问的独立 MySQL `DATABASE_URL`、`AUTH_SECRET` 和演示入口变量，并对目标库单独执行生产迁移与 Seed；不要上传 `.env.local` 或使用本机数据库地址。
