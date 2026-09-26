# Tasks: 演示工作台基础

## 2026-09-26 新原型实施

验证：lint、typecheck、21 项单元／组件测试、1 项独立 MySQL 集成测试、生产构建通过。数据库集成补查实际总览仓储的指标／异常／回补／确认人关联。代理浏览器已核对桌面与 375px、登录提交反馈、刷新、退出后受保护访问、菜单关闭与焦点恢复；空／错误有组件回归，尚无隔离实例中的真实浏览器故障记录。负责人已确认继续阶段 4，视为新视觉验收通过。

- [x] R001 替换入口、总览、文字侧栏与全局 token，保留数据库与真实会话。
- [x] R002 服务端整理固定故事摘要；缺数据不伪造结论，加载／空／错可恢复。
- [x] R003 完成悬浮／点击展开、375px 菜单、键盘与减少动态效果支持。
- [x] R004 lint、类型、相关单元、独立数据库集成与生产构建通过。
- [x] R005 代理浏览器走查与文档同步完成；负责人确认继续阶段 4，新视觉验收通过。

**Inputs**: [spec.md](spec.md)、[plan.md](plan.md)、[research.md](research.md)、[data-model.md](data-model.md)、[quickstart.md](quickstart.md)  
**Status**: Local stage 3 delivery accepted by the project owner on 2026-09-24; unchecked tasks remain incomplete or unverified and are not retroactively marked done

每项完成时勾选，并记录命令、结果与限制。`[P]` 只表示文件独立可并行处理，不要求使用多个代理。受控数据、认证和界面组成一个完整切片；任何阶段检查不能只凭文件存在判定通过。

## Phase 1: 工程设置

- [x] T001 在 `package.json`、`package-lock.json` 建立 Next.js App Router、TypeScript、React、Tailwind、ESLint、Vitest、Prisma 7、MySQL adapter、Auth.js 的精确依赖及脚本；`npm ci` 可复现。
- [x] T002 [P] 在 `tsconfig.json`、`eslint.config.mjs`、`postcss.config.mjs`、`next.config.ts` 建立严格类型、lint、样式构建和运行配置；在 `.gitignore` 忽略本地 npm 缓存。
- [ ] T003 [P] 在 `.env.example`、`src/server/env.ts` 描述并校验数据库、会话密钥和演示入口需要的服务端变量，不向客户端暴露凭据。
- [x] T004 在 `src/app/layout.tsx`、`src/app/globals.css` 与当前页面组件建立实际使用的响应式基础布局、焦点样式和状态组件。

**检查点**：依赖安装、lint、类型检查、生产构建的空壳可运行；不把它视作用户故事完成。

## Phase 2: 共享持久化和会话基础

- [x] T005 在 `prisma/schema.prisma` 与 `prisma7.config.ts` 实现 [数据设计](data-model.md) 的实体、关系、唯一约束与索引，并验证 schema。
- [x] T006 核对目标数据库后生成 `prisma/migrations/` 的正式迁移并执行；记录迁移名和结果，不对未知数据库做 reset。
- [x] T007 在 `src/server/db.ts` 与 `src/server/repositories/` 建立仅服务端的 Prisma 连接及仓储接口；页面组件不直接访问 Prisma。
- [x] T008 在 `src/server/auth/`、`src/auth.ts`、`src/app/api/auth/[...nextauth]/route.ts` 接入 Auth.js Credentials、口令摘要验证、JWT 身份及服务端角色读取；使用 Zod 校验输入。
- [x] T009 在 `src/server/application/` 建立演示入口用例与概览查询 DTO，明确空数据、读取失败和未授权的不同结果。

**检查点**：数据库迁移可复现，受保护查询只能在有效服务端会话下执行；无客户端数据库访问。

## Phase 3: US1 快速进入演示工作台（P1）

**独立验收**：全新浏览器进入、看到真实持久化概览、刷新结果一致，导航无假功能链接。

- [ ] T010 [US1] 在 `tests/integration/overview.test.ts` 写出概览来源、空数据、读取错误的有意义用例，并确认实现前失败。
- [x] T011 [US1] 在 `src/server/repositories/overview-repository.ts` 与 `src/server/application/get-overview.ts` 查询项目、质量检查和预置评测，输出最小概览 DTO。
- [x] T012 [US1] 在 `src/app/page.tsx` 与 `src/server/auth/actions.ts` 提供说明清楚、无需手输密码的演示入口及合成数据标识。
- [x] T013 [US1] 在 `src/app/(workspace)/overview/page.tsx` 与工作台外壳展示项目、质量警告、评测状态及来源明确的下一步文案；未实现动作不可点击。
- [x] T014 [US1] 在 `src/app/(workspace)/overview/loading.tsx`、`error.tsx` 和相关组件覆盖加载、空、读取错误与重试；对桌面和 375px 布局走查。

**检查点**：US1 从 UI 到仓储独立可用，所见值能查到保存记录。

## Phase 4: US2 角色与访问状态（P2）

**独立验收**：无会话直达被拒绝；登录显示服务器确认的角色；退出后刷新不能读取概览。

- [ ] T015 [US2] 用单元／集成测试覆盖凭据与服务端角色判断；用手工浏览器验收登录、无会话直达、失效、退出和身份显示。原计划的测试先红没有执行，不能追认。
- [x] T016 [US2] 在 `src/app/(workspace)/layout.tsx` 与 `src/server/auth/require-viewer.ts` 实现服务器会话门禁和角色读取，传给界面的仅是展示 DTO。
- [ ] T017 [US2] 在 `src/features/demo-entry/` 与工作台外壳加入进入、退出、身份与角色反馈；重复点击不生成重复身份。
- [x] T018 [US2] 验证 `src/server/auth/` 不信任客户端角色字段，REVIEWER 与 ADMIN 不作为默认快捷入口，并核对敏感值不会进入浏览器包。

**检查点**：US2 权限用例及浏览器路径通过。

## Phase 5: US3 固定故事可重复核验（P3）

**独立验收**：两次 Seed 后关键 ID、数量、关系和概览结果相同；预置导览记录与后续写入记录可区分。

- [ ] T019 [US3] 在 `tests/integration/seed.test.ts` 建立重复运行、关系完整、指标样本证据的检查，并确认缺实现时失败。
- [x] T020 [US3] 在 `prisma/seed.ts` 生成固定项目、账号角色、数据集与模型版本、质量警告、基线和候选评测、指标、异常样本、复核、回补、报告、审计；所有数据明确合成。
- [x] T021 [US3] 在 `prisma/seed.ts` 使用稳定键与幂等 upsert/事务，避免重复实体或覆盖非预置记录；在 `package.json` 提供显式 `db:seed` 命令。
- [x] T022 [US3] 连续执行两次 Seed，核对 `src/server/application/get-overview.ts` 的概览数据稳定，并记录实际计数与标识。

**检查点**：US3 可在新环境重建相同面试故事。

## Phase 6: 整体验收与说明

- [ ] T023 对照 FR-001–FR-011、SC-001–SC-005 逐项复核；记录无法在本机或部署前实测的项，不将目标写成结果。
- [x] T024 运行 `npm run lint`、`npm run typecheck`、相关 `npm test`、`npm run build`；记录命令及结果。
- [ ] T025 项目负责人用真实浏览器在桌面和 375px 检查首次进入、刷新、退出、无会话、空/错误、键盘焦点和导航；记录截图或检查结果。
- [ ] T026 更新 `README.md` 的真实启动方式与已实现范围，核对 `docs/architecture.md` 和 `docs/openapi.yaml` 的状态描述；执行 [quickstart.md](quickstart.md) 并修正与实际不符的说明。
- [ ] T027 核对 `git status`、忽略规则及敏感信息，确认公开仓库没有依赖私人工作区的路径；准备可供面试官阅读的提交和推送提示。

## 依赖与门禁

T001–T004 后可进入 T005–T009。US1 依赖概览仓储、演示会话与 Seed 的最小数据；因此实际编排可先做 T019–T021，再完成 US1 的浏览器验收。US2 的服务端门禁在 US1 对外开放前必须生效。所有故事最终以真实端到端路径验收，不能因任务顺序将未受保护的页面当成已交付 MVP。T023–T027 在三个故事均完成后进行。

## 本地已复核证据（2026-09-24）

- 在确认新建的项目专用 `simeval_dev` 无既有数据后，`npm run db:migrate` 应用 `202609240001_demo_foundation` 成功；未执行 reset。
- `npm run db:seed` 连续两次完成，均报告 1 个项目、2 条预置评测、2 个异常样本；复核数据库共有 3 个用户、4 条质量检查、8 条指标、2 条复核、1 条回补、1 份报告和 4 条审计。
- 本地生产构建下的浏览器已验证首页进入、工程师会话、持久化概览、刷新、退出、无会话直达返回首页；桌面和 375px 首页／概览均无横向溢出。未实现导航不可点击。
- `npm run lint`、`npm run typecheck`、当前 2 项单元测试和 `npm run build` 通过。T010、T015、T019 所列集成／端到端测试及空／错误、多角色、键盘路径仍未完成，因此整体验收任务保持未勾选。

## 补充验证（2026-09-24）

- 增加概览与会话的单元／组件状态测试：`npm test` 现有 13 项通过；空数据与查询失败不会被当作零条记录，角色每次从服务端用户记录确认。这些测试在实现后补写，不能称为测试先行。
- Playwright 在本地生产构建上通过 4 条路径：未登录直达、工程师进入／刷新／退出、375px 键盘操作、REVIEWER 与 ADMIN 的真实会话角色。首次整套运行曾遇到 MySQL `ER_CON_COUNT_ERROR`，服务重启后单项及整套重跑通过，原因尚未定位，不能称为稳定性验收通过。
- 检查 14 个客户端静态构建文件，未发现本机数据库密码、演示口令和会话密钥。`npm run lint`、`npm run typecheck`、`npm run build` 再次通过。
- 新增一次性本地初始化脚本：先 `npm ci`，再运行 `scripts/setup-local-db.ps1 -Database dev` 或 `-Database test`。脚本隐藏读取管理员密码，创建专用库与账号、生成被忽略的环境文件；开发模式应用现有迁移和 Seed，测试模式执行独立库测试。已有环境文件时拒绝覆盖。脚本已通过语法检查，但全新机器的端到端初始化尚未实跑。
- 数据库集成测试已编写，并且限定只操作 `simeval_test`；当前没有 `.env.test.local`，因此该项明确跳过。待独立测试库准备后运行并记录结果。T010、T015、T019 原计划要求测试先红，实际是实现后补写，相关任务仍未按原文勾选；浏览器空／错误状态尚未独立走查。

## 测试方案调整（2026-09-24）

- 项目负责人决定亲自验收网页，移除 Playwright 用例、配置和直接依赖。此前自动浏览器测试的结果只作为历史记录，不作为当前阶段门禁。
- `npm run test:unit` 的 13 项通过；`npm run test:integration` 在独立的 `simeval_test` 中应用迁移并两次运行相同 Seed，1 项通过。第一次执行时 `tsx` 子进程在受限环境中触发 `os.userInfo()` 错误；改为在 Vitest 中直接导入同一个 Seed 文件后通过。
- 当前代码测试由单元／组件测试与真实 MySQL 集成测试承担；T025 的网页交互、布局与视觉判断继续由项目负责人按 Quickstart 手工完成。

## 阶段验收与推送前核对（2026-09-24）

- 项目负责人确认阶段 3 的本地交付通过验收。此前已验证主要浏览器路径；空／错误状态的真实浏览器记录、全新电脑初始化脚本实跑仍未单独取得，保留为明确限制，不把相关未勾选任务追认完成。
- 当前公开交付包含 13 项单元／组件测试和 1 项独立 MySQL 集成测试；原任务 T010、T019 的“先写失败测试”并未执行，测试策略与实际顺序如实保留。
- 推送前核对：Git 根目录是 `simeval-app/`；`.env.local` 与 `.env.test.local` 被 `.gitignore` 忽略。对 84 个拟公开的项目文件进行了本机环境值匹配扫描，未发现本机凭据值。仓库公开文档未引用私人工作区路径。推送只应在本仓库提交后进行。
