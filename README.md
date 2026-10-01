# SimEval

面向具身智能团队的评测数据工作台：自主配置评测，用数据质量、指标与样本证据解释版本表现，再由人工确认结论与报告。

## 产品与真实状态

**当前阶段 3–5 的核心业务已实现，阶段 6 的部署版本已上线；主页与 AI 报告仍待完善。** 目标流程是：

选择模型／数据／Benchmark → 确认质量 → 创建并模拟执行 → 查看结果／按需比较基线 → 异常复核 → 生成并确认报告。

产品只有算法工程师和评测人员，输入共享访问密码后选择演示身份、无注册；工程师管理本人任务和草稿，评测人员确认结论／报告。除创建外先选择任务，后续按钮延续当前任务；支持多任务、取消／重试／软删除。首次没有基线也应能评测；不做独立回补管理或人工分类步骤。

**当前已实现访问密码入口、双身份登录／切换、角色导航、自主配置与质量两步、无基线模拟、多任务单选／上下文延续、所选任务总览、取消／重试／软删除。** 同口径比较、异常证据下钻及自由结论草稿／确认／修改历史也已实现，共十四个业务 HTTP 操作。AI 报告生成／确认尚未开放，方案待重新讨论。合成数据、预置报告与模拟执行明确标注，不运行真实仿真或训练。

质量检查、实际验证证据与待验步骤见各规格 quickstart。目标是在几分钟内看懂“总体提升但遮挡回退 → 日志证据 → 人工确认”。首次访问计时仍待最终验收。

新环境预置 10 条英文命名的核心合成任务，两页 6＋4，覆盖多版本比较、复核历史、失败／重试、取消、不同数据与专项评测。已有环境用 `npm run db:catalog` 补缺项，保留人工内容；详情见[核心演示集](specs/002-quality-evaluation/spec.md#核心演示集)。固定示例受保护，可另建任务体验取消／重试／删除。

## 项目文档

产品范围和验收口径见 [PRD](docs/PRD.md)；代码分层、数据关系、全部接口和请求示例见 [技术架构与 API 文档](docs/架构与接口.md)。两份文档均可独立阅读。

| 内容 | 入口 |
|---|---|
| 产品与技术文档 | [PRD](docs/PRD.md)、[技术架构与 API](docs/架构与接口.md) |
| 产品与交互 | [Figma 现行工程页](https://www.figma.com/design/Y2ZIhN1yuuXBeieGkxtnsH/simeval?node-id=371-484)；访问密码登录参考[设计画框](https://www.figma.com/design/Y2ZIhN1yuuXBeieGkxtnsH/simeval?node-id=197-476) |
| 评测与任务规格 | [需求](specs/002-quality-evaluation/spec.md) → [计划](specs/002-quality-evaluation/plan.md) → [任务](specs/002-quality-evaluation/tasks.md) → [验收](specs/002-quality-evaluation/quickstart.md) |
| 比较与复核规格 | [需求](specs/003-comparison-review/spec.md) → [计划](specs/003-comparison-review/plan.md) → [任务](specs/003-comparison-review/tasks.md) → [验收](specs/003-comparison-review/quickstart.md) |
| 架构与数据 | [架构设计](docs/architecture.md)，分层、事务与迁移说明 |
| API | [OpenAPI](docs/openapi.yaml)、[调用与错误示例](docs/api-contract.md)，区分 implemented／planned／待改造 |
| 工程基础证据 | [基础规格](specs/001-demo-foundation/spec.md)、[原任务](specs/001-demo-foundation/tasks.md) |
| 开发规范 | [项目原则](.specify/memory/constitution.md)、[代理规则](AGENTS.md) |

`.specify/` 与 `.agents/skills/` 保存共享开发工作流。规格经审阅后用于实现，文件存在不等于功能完成。公开仓库中的材料可独立阅读；真实环境变量不提交。

## 本地运行与检查

采用 Next.js、TypeScript、Prisma 7、PostgreSQL 和 Auth.js。线上使用 Vercel＋Neon；Neon 提供云数据库，本机不必安装 PostgreSQL。

首次：`npm ci` → 复制 `.env.example` 为 `.env.local` 并填开发库连接与密钥 → `npm run db:deploy` → `npm run db:seed` → `npm run dev`。平时只需 `npm run dev`，看到 Ready 后访问 localhost:3000。

**已有 MySQL 配置需先备份并改为 PostgreSQL。** 旧数据库保留，新库使用默认故事；原迁移归档，没有自动搬迁临时任务。配置、测试、Vercel 发布和后台恢复详见[运行与部署验收](specs/004-deployment/quickstart.md)，方案与进度见[部署规格](specs/004-deployment/spec.md)、[计划](specs/004-deployment/plan.md)、[任务](specs/004-deployment/tasks.md)。

### 手动恢复默认演示数据

在 `simeval-app/` 的 PowerShell 中，按目标**只运行其中一条**：

```powershell
.\scripts\reset-dev-demo.ps1         # Neon dev 分支
.\scripts\reset-production-demo.ps1  # Neon Production；运行时还需输入确认词
```

首次使用先在所选命令后加 `--check` 核对目标；检查不会连接数据库或修改数据。恢复会清除新增任务和人工改动，再写回默认 Seed。详细步骤与防误操作说明见[部署验收文档](specs/004-deployment/quickstart.md#3-负责人手动恢复)。

| 配置／文件 | 作用 |
|---|---|
| .env.example／.env.local | 公开模板／本地真实值；真实配置被 Git 忽略 |
| DATABASE_URL | 网页连接池地址，含数据库账号密码；不能放入 NEXT_PUBLIC 变量 |
| DIRECT_URL／DATABASE_URL_UNPOOLED | 迁移、Seed 和维护用的直连，优先前者；本机可与运行地址相同 |
| AUTH_SECRET／ACCESS_PASSWORD | 会话密钥／访客输入的共享访问密码；均不用于数据库连接 |
| prisma7.config.ts／prisma/schema.prisma | CLI 配置与路径／表、关系、索引 |
| src/server/db.ts／prisma/migrations | 网页客户端与连接池／当前 PostgreSQL 迁移 |
| next.config.ts／postcss.config.mjs | Next.js 配置／Tailwind 处理 |
| eslint.config.mjs／vitest.config.ts | 静态检查／测试与路径别名 |
| package.json／tsconfig.json | 命令和依赖／类型规则；JSON 不支持注释，在此解释 |

| 命令 | 什么时候用 |
|---|---|
| npm ci | 首次或锁文件变化时安装依赖，并生成 Client |
| npm run dev | 本地开发；退出按 Ctrl+C |
| npm run db:deploy | 将仓库已有迁移应用到目标库 |
| npm run db:migrate | 修改 Schema 后生成新迁移；仅开发环境，需要 shadow database 权限 |
| npm run db:generate | Schema 变化后生成 Prisma Client，随后重启服务 |
| npm run db:seed／db:catalog | 首次故事初始化／增量补缺项；都不等于完整清理 |
| .\scripts\reset-dev-demo.ps1／reset-production-demo.ps1 | 分别恢复 Neon dev／Production 的默认 Seed；先用 `--check` 核对目标，详见部署验收 |
| npm run lint／typecheck／test:unit | 静态、类型和单元检查 |
| npm run test:integration | 独立 simeval_test 上的真实数据库验证；无配置时失败 |
| npm run build／start | 生产构建／本地运行构建；可信本机预览设置 AUTH_TRUST_HOST=true |

GitHub Actions 使用独立 PostgreSQL 检查 lint、类型、单元、集成和构建。Vercel 的发布与访问保护在平台控制台管理；普通构建不自动清理数据库。网页由负责人按[评测验收](specs/002-quality-evaluation/quickstart.md)与[比较复核验收](specs/003-comparison-review/quickstart.md)检查，不引入自动浏览器测试框架。AI 报告仍待后续实施。
