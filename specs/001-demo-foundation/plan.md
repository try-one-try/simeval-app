> 数据库更新：本文保留基础切片的 MySQL 历史方案与证据；当前 PostgreSQL 配置、迁移和运行以[部署切片](../004-deployment/quickstart.md)为准。

## 2026-09-28 访问密码改造

沿用 Auth.js Credentials 与现有 JWT Cookie。登录表单提交身份和访问密码，服务端核对环境配置后定位固定演示账号；切换身份先校验当前会话，再由服务端使用同一访问密码建立目标角色会话。JWT 记录首次通过门禁的时间并限制绝对有效期，旧会话缺少该记录时拒绝。页面、业务 API 仍按 userId 回查数据库角色。

将演示账号的 `passwordHash` 改为可空，Seed 与后台恢复不再生成账号口令摘要。新增 PostgreSQL 增量迁移：放开该列的非空约束，并建立访问失败计数表，不清理现有业务记录。来源地址先用服务端密钥做摘要，只保存摘要与失败窗口；15 分钟内输错 5 次暂停 15 分钟。登录页面复用现有单选组件和主按钮样式，新增密码字段与错误状态。更新被忽略的本地配置和公开环境说明；线上变量由负责人配置后再发布新代码。

# Implementation Plan: 演示工作台基础

**Feature directory**: `specs/001-demo-foundation` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)  
**Status**: 基础数据／认证与 2026-09-26 新视觉已交付并获负责人认可；保留当时范围。

新版双身份、自主创建与任务上下文由 [002 计划](../002-quality-evaluation/plan.md)承接，尚待工程改造。

## Summary

在现有独立仓库内建立一个可运行的模块化单体。阶段 3 的可见结果是：首次访问者能便捷进入真实演示会话，看到从持久化合成数据读取的项目概览、数据质量警告和已有评测状态；退出或会话失效后无法继续读取。固定 Seed 为后续切片准备完整证据链，但本阶段不开放尚未实现的质量详情、评测创建、对比、复核或报告动作。

## Technical Context

| 项 | 决策 |
|---|---|
| Language/Runtime | Node.js 22、TypeScript strict |
| Framework | Next.js App Router 单应用；Server Component 首屏读取 |
| UI | Tailwind CSS；先建立设计 token 与可访问的基础组件，按需引入 shadcn/ui |
| Auth | Auth.js 的锁定 beta 版本；Credentials 演示账号、JWT 会话、服务端角色核对 |
| Storage | MySQL 8；Prisma ORM 7、正式迁移文件和显式 Seed |
| Validation | Zod 校验登录输入与未来 HTTP 输入；页面不直接读取 Prisma |
| Tests | ESLint、TypeScript、Vitest 单元与数据库集成检查、项目负责人手工浏览器验收、生产构建 |
| Platform | 本机 Windows 开发；原计划候选为 Vercel＋托管 MySQL；现于阶段 6 重做部署选型，仍保留 Next.js＋MySQL |
| Constraints | 保留现有未提交文件；只在 `simeval-app/` 创建公开代码；不用微服务、队列、WebSocket；不能修改既有数据库 |

当前官方版本依据、Auth.js 权衡与本机阻碍见 [research.md](research.md)。安装时在 `package-lock.json` 固定实际通过验证的精确依赖版本，不直接把 `latest` 视为兼容性保证。

## Constitution Check

| 原则 | 设计响应 | 结果 |
|---|---|---|
| 黄金路径完整 | 本切片提供真实入口、会话、概览和完整 Seed；后续业务动作保持明确未实现状态，阶段 4–6 接续 | 通过 |
| 模拟与证据如实呈现 | 页面标注合成数据；所有概览值来自仓储查询；不展示虚构的已实现按钮 | 通过 |
| 模块化单体与服务端边界 | 页面只组合 UI 和查询服务；Prisma 经仓储；Auth、密钥、Provider 留在服务端 | 通过 |
| 受控写入与状态 | 本切片仅提供登录及 Seed 管理命令；业务写接口留给对应规格，后续均在服务端校验 | 通过 |
| 验收与文档同步 | lint、类型、种子重复运行、浏览器认证和视觉走查均列为门禁；不把脚手架当功能完成 | 通过 |

设计复核：本计划没有引入新的公开业务 HTTP 接口，现有 [OpenAPI](../../docs/openapi.yaml) 的 19 个操作仍是未来切片契约，不在本切片标为已实现。Auth.js 自有会话端点由其适配器提供；页面读取直接调用应用查询服务，不绕回本应用 HTTP API。

## Project Structure

只创建本切片确实使用的文件，不预建空业务模块。最终结构预计如下：

```text
simeval-app/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/...
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── page.tsx                       演示入口
│   │   ├── (workspace)/layout.tsx         服务端会话门禁与工作台外壳
│   │   ├── (workspace)/overview/page.tsx  持久化概览
│   │   ├── api/auth/[...nextauth]/route.ts Auth.js Handler
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── features/demo-entry/               演示入口和状态组件
│   ├── features/overview/                 概览展示组件
│   ├── components/ui/                     当前页面实际使用的基础控件
│   ├── server/application/                概览查询与演示角色用例
│   ├── server/repositories/               仓储接口和 Prisma 实现
│   ├── server/auth/                       会话、凭据校验、角色解析
│   └── lib/                               浏览器安全的格式化与 DTO
├── tests/
│   ├── unit/
│   ├── integration/
├── .env.example
├── package.json
└── package-lock.json
```

路由文件只负责会话门禁和页面组合。仓储提供概览查询；应用服务组合 DTO，不把 Prisma Model 对象直接传给客户端。服务端模块使用 `server-only` 并禁止被 Client Component 导入。工作台侧栏只展示已实现页面；后续模块用明确的“建设中”文案说明，不提供通向空白页面的假链接。

## Data and Auth Design

实体、约束和 Seed 场景见 [data-model.md](data-model.md)。阶段 3 落地基础表与迁移，包含项目、不可变版本、质量检查、评测、指标、样本、复核、回补、报告、审计。数据库中的预置记录支持三分钟只读导览；新建任务将使用独立标识，不覆盖预置故事。

演示账号有 ENGINEER、REVIEWER、ADMIN 三种角色；公开便捷入口默认以 ENGINEER 演示账号建立服务端 Session。REVIEWER/ADMIN 不作为默认快捷入口。Credentials 校验从数据库读取账号与口令摘要；便捷入口只在服务端使用演示凭据，不在页面或客户端包中放出口令。JWT 保存最小标识；后续写操作还须重读用户角色。Auth.js 的具体回调和配置在编码时按锁定版本验证。

数据库连接与 Auth Secret 只在本地被忽略的环境文件中配置，`.env.example` 仅列变量名和安全占位值。迁移前必须核对目标库为项目专用数据库，不对未知或既有业务库执行重置；本地已按此规则创建独立账号和数据库并完成初始迁移与重复 Seed，实际结果记录在 [quickstart.md](quickstart.md)。

## UI and Interaction Design

- 入口首屏：一句话定位、合成数据标识、固定故事摘要及唯一主要动作“进入演示”。
- 概览首屏：项目、WARNING 质量状态、预置 SUCCEEDED 评测状态与下一步说明；数字和标签由查询 DTO 提供。
- 视觉：白色内容与侧栏、黑色主按钮、棕红色风险强调；用留白与细标记表达层次，替换旧绿色方案。桌面侧栏展开覆盖预留区，不推动正文；375px 使用原生对话框菜单。
- 总览展示拆入功能组件；仓储读取预置任务的指标、异常、回补与报告，应用层整理只读摘要；不新增业务 HTTP 接口或改动 Seed、迁移。
- 状态：加载时保留页面骨架；无数据解释如何准备环境；读取错误不伪装成零值；未登录回入口；成功与退出有可见反馈。
- 文案明确“模拟评测／合成数据”，不把 Codex 开发代理写成产品内 AI 功能。

## Implementation Order

1. 保留当前仓库内容，建立项目包与本地 npm 缓存；完成依赖安装和精确锁定。
2. 建立 TypeScript、ESLint、Tailwind、环境变量校验和基础视觉 token；完成无数据库的入口页面。
3. 落地 Prisma schema 与迁移，核对目标数据库后运行；生成确定性 Seed 和重复执行检查。
4. 接入 Auth.js 演示登录及服务端门禁；实现概览仓储与查询服务。
5. 完成入口、概览、加载／空／错误状态及响应布局；导航仅通向已实现能力。
6. 运行 lint、类型、单元与数据库集成测试、生产构建；项目负责人按 Quickstart 手工完成浏览器验收，再更新 README 与规格任务状态。

每一步的具体文件与依赖见 [tasks.md](tasks.md)。本功能只有在数据库、认证、Seed、UI 与浏览器证据全部通过后才算完成。

## Complexity Tracking

无宪法原则例外。Auth.js 当前版本权衡、Prisma 7 与 MySQL 的兼容选择记录在 [research.md](research.md)，不构成额外基础设施。
