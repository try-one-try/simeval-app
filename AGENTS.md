# SimEval 公开仓库协作规则

## 阅读顺序

1. [README.md](README.md)：目标、黄金路径和真实实现状态。
2. [.specify/memory/constitution.md](.specify/memory/constitution.md)：稳定的项目原则与质量门禁。
3. 当前功能的 `specs/<功能>/spec.md`、`plan.md`、`tasks.md`：经审阅的行为、实施方案与任务。
4. [docs/architecture.md](docs/architecture.md) 与 [docs/openapi.yaml](docs/openapi.yaml)：架构边界与 HTTP 契约。

## 执行规则

- 先核对功能规格与当前实现状态，再按垂直切片修改界面、服务端、持久化、校验和必要测试。
- 未经明确决策，不引入真实仿真器、模型训练、微服务、消息队列或额外基础设施。模拟数据、模拟执行和 AI 草稿必须显著标注。
- 路由文件负责页面组合；业务规则进入应用层或领域层；Prisma 访问经仓储层隔离。客户端不得导入服务端密钥或 Prisma。
- 写操作在服务端执行身份、角色、参数与状态校验，并对重要状态变化记录审计。
- HTTP 变化须同步更新 OpenAPI、[接口示例](docs/api-contract.md)与相关测试；行为变化须更新对应公开功能规格。
- 每个完成功能须通过 lint、类型检查、相关测试和浏览器走查。尚未实现的功能与设计稿不得表述为已交付。
- 关键源码文件用简洁中文注释说明职责和重要边界；注释解释设计意图，避免重复代码本身。

## 文档维护

同一事实只保留一个权威出处；README 做导航，constitution 定原则，功能规格定行为，OpenAPI 定 HTTP 契约。优先修改同主题文档，仅在读者或维护周期不同且独立维护更清楚时新建文件。不要在本仓库链接本仓库之外的私人资料。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
