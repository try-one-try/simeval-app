# MySQL 迁移归档

`mysql-migrations/` 原样保留阶段 3–5 的 MySQL 迁移，供审核历史实现；不由当前 Prisma CLI 执行。

阶段 6 改用 PostgreSQL，新库从 `prisma/migrations/202609270003_postgresql_init/` 建立当前完整结构，再执行 Seed。原 MySQL 数据库未清理，也不把 MySQL SQL 当作 PostgreSQL 升级脚本。今后的表结构变化继续向当前 migrations 追加文件。
