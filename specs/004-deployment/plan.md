# 实施计划

1. 使用 Prisma 7.10 的 PostgreSQL 驱动，保留分层；连接参数保留 TLS，限制每进程连接数和等待时间。
2. 当前 Schema 生成独立 PostgreSQL 初始迁移；原 MySQL SQL 原样放入 `prisma/archive/mysql-migrations/`，不在新库执行。
3. 修正 PostgreSQL 大小写表名行锁；保留 Serializable／ReadCommitted 和有限冲突重试。
4. Seed 提取为可传入事务的函数；CLI 包装负责直连和关闭连接。恢复先核对专用演示库及明确确认，再在同一事务中清理数据、执行 Seed，失败不留半个故事。
5. 本地初始化脚本改为 PostgreSQL；云端不运行管理员建库脚本。隔离集成测试显式覆盖运行与直连地址，不能误用开发或线上库。
6. lint、类型、单元、真实 PostgreSQL 集成和构建；网页沿用手工验收，云资源和 Git 发布另行推进。

运行连接支持 `DATABASE_URL`；CLI 优先 `DIRECT_URL`，兼容 Neon 集成的 `DATABASE_URL_UNPOOLED`，本地无连接池时回退 `DATABASE_URL`。Vercel 构建只生成 Client 和构建代码，不自动 Seed 或恢复。
