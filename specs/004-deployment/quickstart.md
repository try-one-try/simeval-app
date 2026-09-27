# PostgreSQL 运行与部署验收

## 1. 第一次启动

推荐 Vercel＋Neon：Neon 提供 PostgreSQL，不要求电脑安装数据库。开发环境使用独立数据库或 Neon 开发分支，不能让本地测试修改线上演示库。

1. `npm ci`：按锁文件安装依赖并生成 Prisma Client。
2. 将 `.env.example` 复制为被 Git 忽略的 `.env.local`，填开发环境的连接池 `DATABASE_URL`、直连 `DIRECT_URL`、随机 `AUTH_SECRET` 和 `DEMO_PASSWORD`。Neon 原生集成已有 `DATABASE_URL_UNPOOLED` 时可替代 `DIRECT_URL`；不要保留指向旧库的 DIRECT_URL。
3. `npm run db:deploy`：将仓库 PostgreSQL 迁移应用到新库。
4. `npm run db:seed`：首次写入十条核心合成任务和预设账号。
5. `npm run dev`：看到 Ready 后访问 localhost:3000。

若已有 MySQL `.env.local`，先在本地备份，再只修改数据库连接；会话密钥和演示口令可继续使用。旧 MySQL 数据保留，新 PostgreSQL 从默认故事开始，没有自动搬迁临时操作记录。

选择本机 PostgreSQL 时先安装并启动它，再运行 `scripts/setup-local-db.ps1 -Database dev`；脚本只允许 localhost，隐藏询问 postgres 管理员密码，创建专用库／账号和配置后迁移、Seed。已有配置或同名账号／库时拒绝覆盖，改为手动填连接。云端 Neon 不运行这个管理员脚本。

## 2. 平时与测试

- 日常只需 `npm run dev`；依赖变更才 `npm ci`，新增迁移才 `db:deploy`，Schema 变更后生成 Client 并重启服务。
- `db:catalog` 增量补目录／演示缺项，保留已有结果、人工结论和删除状态。`db:seed` 适合初始化，会更新部分固定故事，不是完整清理命令。
- 集成测试使用 `.env.test.local` 中独立的 `TEST_DATABASE_URL`，库名必须 `simeval_test`。本机可用 `scripts/setup-local-db.ps1 -Database test` 准备。然后运行 `npm run test:integration`；未配置时明确失败。
- `npm run test:unit` 不需要数据库。网页仍由负责人手工检查，无自动浏览器测试框架。

## 3. 负责人手动恢复

只对专用演示库使用；在无人操作时执行。先将当前维护环境的 `DEMO_RESET_DATABASE` 设置为实际库名（例如 neondb），核对直连地址，再运行：

```powershell
npm run db:reset-demo -- --confirm=RESET_DEMO_DATA
```

命令在同一事务内删除业务数据、重建默认 Seed；新增任务、人工修改和删除标记被清除，只保留默认故事，表结构与环境文件保留。校验失败或重建失败会回滚。网站没有恢复入口，普通 build／push／登录不触发。不要在 Git 中保存数据库凭据。

## 4. Vercel 上线仍需完成

连接本公开仓库，选 Node.js 22；安装 `npm ci`，构建 `npm run build`。关联 Neon 并配置生产环境连接、AUTH_SECRET、DEMO_PASSWORD，使用直连先执行迁移及首次 Seed。预览环境单独配置数据库；普通构建不自动执行迁移、Seed 或恢复。

上线验收：未获邀请不能访问网页和接口；两身份登录／切换、创建／完成／取消／重试／删除、对比／复核、刷新持久化、375px、日志与恢复均有实际证据。Vercel 访问保护和分享链接待控制台设置后验证；代码适配不代表已经上线。
