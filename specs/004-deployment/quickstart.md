# PostgreSQL 运行与部署验收

## 1. 第一次启动

推荐 Vercel＋Neon：Neon 提供 PostgreSQL，不要求电脑安装数据库。开发环境使用独立数据库或 Neon 开发分支，不能让本地测试修改线上演示库。

1. `npm ci`：按锁文件安装依赖并生成 Prisma Client。
2. 将 `.env.example` 复制为被 Git 忽略的 `.env.local`，填开发环境的连接池 `DATABASE_URL`、直连 `DIRECT_URL`、随机 `AUTH_SECRET` 和至少 6 位的 `ACCESS_PASSWORD`；公开演示建议使用更长的独立随机值。Neon 原生集成已有 `DATABASE_URL_UNPOOLED` 时可替代 `DIRECT_URL`；不要保留指向旧库的 DIRECT_URL。
3. `npm run db:deploy`：将仓库 PostgreSQL 迁移应用到新库。
4. `npm run db:seed`：首次写入十条核心合成任务和预设账号。
5. `npm run dev`：看到 Ready 后访问 localhost:3000。

若已有 MySQL `.env.local`，先在本地备份，再修改数据库连接，并把旧 `DEMO_PASSWORD` 换成新的 `ACCESS_PASSWORD`。旧 MySQL 数据保留，新 PostgreSQL 从默认故事开始，没有自动搬迁临时操作记录。

选择本机 PostgreSQL 时先安装并启动它，再运行 `scripts/setup-local-db.ps1 -Database dev`；脚本只允许 localhost，隐藏询问 postgres 管理员密码，创建专用库／账号和配置后迁移、Seed。已有配置或同名账号／库时拒绝覆盖，改为手动填连接。云端 Neon 不运行这个管理员脚本。

## 2. 平时与测试

- 日常只需 `npm run dev`；依赖变更才 `npm ci`，新增迁移才 `db:deploy`，Schema 变更后生成 Client 并重启服务。
- `db:catalog` 增量补目录／演示缺项，保留已有结果、人工结论和删除状态。`db:seed` 适合初始化，会更新部分固定故事，不是完整清理命令。
- 集成测试使用 `.env.test.local` 中独立的 `TEST_DATABASE_URL`，库名必须 `simeval_test`。本机可用 `scripts/setup-local-db.ps1 -Database test` 准备。然后运行 `npm run test:integration`；未配置时明确失败。
- `npm run test:unit` 不需要数据库。网页仍由负责人手工检查，无自动浏览器测试框架。

## 3. 演示数据的维护边界

首次初始化、增量补目录和完整恢复是三种不同操作。普通构建、发布和登录不会自动清空数据。

完整恢复仅用于专用演示库，由维护者手动执行。程序核对目标和当前状态，在同一事务内清理业务记录并重建默认数据；表结构和 AI 累计费用账本保留，失败时回滚。网站不提供此入口，具体维护步骤单独管理。

## 4. Vercel 部署与上线检查

连接本公开仓库，选 Node.js 22；安装 `npm ci`，构建 `npm run build`。关联 Neon 并配置生产环境连接、`AUTH_SECRET`、`ACCESS_PASSWORD`，使用直连先执行迁移及首次 Seed。预览环境单独配置数据库；普通构建不自动执行迁移、Seed 或恢复。

**从本机初始化线上库**：在被 Git 忽略的 `.env.production.local` 中保存生产环境的 `DATABASE_URL`、`DIRECT_URL`、`AUTH_SECRET` 和 `ACCESS_PASSWORD`；Neon 的 `DATABASE_URL_UNPOOLED` 填到 `DIRECT_URL`。两条连接应来自同一分支／数据库，访问密码与 Vercel Production 相同。Secret 保存后无法从控制台读回，先保管副本再填到平台。

在仓库根目录的专用 PowerShell 中执行。第一条仅清除当前终端的同名变量，避免它们覆盖指定文件，不修改任何配置文件：

```powershell
Remove-Item Env:DATABASE_URL,Env:DIRECT_URL,Env:DATABASE_URL_UNPOOLED,Env:AUTH_SECRET,Env:ACCESS_PASSWORD -ErrorAction SilentlyContinue
node --env-file=.env.production.local node_modules/prisma/build/index.js migrate deploy
node --env-file=.env.production.local --import tsx prisma/seed.ts
```

先确认迁移成功，再执行 Seed；随后在 Vercel Redeploy。Seed 直接由 Node 加载 tsx，沿用同一份初始化逻辑，不依赖终端全局安装 tsx。这两条初始化命令不需要每次发布都运行。

发布后应检查：未登录不能进入工作台或调用业务接口；两身份登录／切换、连续输错限流、创建／完成／取消／重试／删除、对比／复核、刷新持久化和窄屏操作正常。访问密码控制演示入口，不识别访客本人；平台访问保护与不同网络下的可达性需单独核对。
