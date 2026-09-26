# 阶段 3 技术调研与决策

**日期**：2026-09-23  
**范围**：只支持 [演示工作台基础规格](spec.md)。以下是编码前决策和环境核对，不表示依赖已安装或功能已实现。

## R-001 · Next.js 工程入口

**决策**：在现有独立仓库内建立单个 Next.js App Router 项目，保留 TypeScript、ESLint、Tailwind 与 `src/` 结构。生产构建、lint、类型检查分别执行；不能认为构建自动完成 lint。Node.js 22.17.1 满足官方最低 20.9 要求。

**理由**：符合已确定的模块化单体和 Server Component／Route Handler 边界；无需第二个前端或服务。

**未采用**：拆分前后端、微服务、额外消息系统。

**来源**：[Next.js 安装](https://nextjs.org/docs/app/getting-started/installation)、[认证指南](https://nextjs.org/docs/app/guides/authentication)。

## R-002 · MySQL 与 Prisma 版本

**决策**：本项目已确定 MySQL，因此锁定 Prisma ORM 7 系列，并让 CLI、Client 和适配器版本匹配；按锁定版本的官方 MySQL quickstart 生成配置，不凭记忆手写配置文件名。开发迁移使用 `migrate dev`，部署使用 `migrate deploy`；`db seed` 显式执行。迁移前核对目标数据库，不能对用户既有库执行 reset。

**理由**：Prisma 当前版本的官方迁移说明列明 MySQL 支持差异，直接使用 `latest` 有兼容风险。版本锁定和可审阅迁移便于复现。

**未采用**：为了使用最新版 Prisma 改换数据库，或用 `db push` 代替正式迁移历史。

**来源**：[Prisma 7 MySQL 指南](https://www.prisma.io/docs/v7/prisma-orm/quickstart/mysql)、[迁移流程](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production)、[Seed 工作流](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/seeding)。

## R-003 · 演示会话与角色

**决策**：沿用已定的 Auth.js 方案，安装并锁定实测的 `next-auth@beta` 精确版本。演示账号预置在业务数据中；便捷演示入口由服务端发起登录，浏览器不会因为选择角色标签而获得权限。Credentials Provider 采用 JWT 会话；后续关键写操作还须从服务端会话与当前用户记录核对角色。公开便捷入口只暴露合成演示数据，ADMIN 不作为默认快捷账号。

**理由**：保持既定架构与阶段设计；Auth.js Credentials 不会自动持久化用户，也不能把 JWT 中的过期角色声明当作唯一授权来源。

**权衡**：Auth.js 官方现在推荐新项目考虑 Better Auth，但也说明 Auth.js 仍获得安全补丁与关键修复。本项目已有 Auth.js 决策，现阶段继续使用并锁版本；若实测遇到兼容问题，再作为独立架构变更评估。

**来源**：[Auth.js Next.js 安装](https://authjs.dev/getting-started/installation?framework=next-js)、[Credentials Provider](https://authjs.dev/reference/core/providers/credentials)、[官方迁移说明](https://authjs.dev/getting-started/migrate-to-better-auth)。

## R-004 · 视觉组件

**决策**：使用 Tailwind CSS 的官方 Next.js 集成。视觉规范先明确排版、色彩语义、间距、焦点和状态；如需 shadcn/ui，只按实际页面需要添加组件，不整体覆盖现有公开文档或原型。

**理由**：阶段 3 要建立可持续的工作台外壳，同时保持界面一致和小范围依赖。

**来源**：[Tailwind Next.js 指南](https://tailwindcss.com/docs/installation/framework-guides/nextjs)、[shadcn/ui Next.js 安装](https://ui.shadcn.com/docs/installation/next)。

## R-005 · 本机环境与阻碍处理

- 研究时，本机 MySQL 8.0.31 服务正在运行，但无密码的 `root` 只读连接返回 `ERROR 1045`；当时 `.env.local` 的 `DATABASE_URL` 留空。之后已创建项目专用数据库与独立账号，连接、迁移和两次 Seed 的实际结果见 [quickstart.md](quickstart.md)。真实密码始终不写进规格、日志或公开仓库。
- 默认 npm 缓存目录读取返回 `EPERM`。已改用被忽略的项目专属 `.npm-cache/` 完成安装。首次安装遇到 registry 空闲超时，重试后完成；传递依赖安全告警由精确覆盖版本修复，后续安装显示 0 条告警。
- Prisma schema 校验、客户端生成、lint、类型检查、现有单元测试及生产构建已通过。最初只生成迁移 SQL；后来已在项目专用库应用、两次执行 Seed，并验证登录与概览主要浏览器路径。异常状态、跨角色与集成测试仍待完成，不能据此宣称阶段 3 已验收。
