# 实施计划
## 1. 文件顺序
1. domain/comparison-review.ts 固定输入、同口径和指标判读。
2. Prisma 追加草稿／确认与历史字段、报告过时标记；保留旧状态／分类／回补关联，只补历史确认来源。
3. comparison-review-repository.ts 查真实指标／证据，事务保存复核；应用服务整理安全 DTO。
4. HTTP 四操作：比较、异常列表、异常详情、保存草稿／确认。统一会话、角色、Origin、Zod、错误与 requestId。
5. comparison-view、anomaly-list、sample-detail、review-editor 复用任务上下文／导航／设计 token；列表到详情独立下钻，编辑用原生弹层。
6. 隔离数据库验证并发与原子性，真实浏览器验证主线／375px／键盘，再更新文档。

## 2. 持久化决定
AnomalySample 加 draftConclusion／draftUpdatedById／draftUpdatedAt、confirmedById／confirmedAt／confirmedRevision；version 是所有写入的乐观锁。ReviewRecord 加 mode、fromVersion／toVersion／confirmedRevision，只追加。旧 RESOLVED 非空结论补修订 1，保留原内容、状态和历史。
AIReport 只加 isStale／staleAt，最终改变后保守标记关联候选或基线任务的现有报告过时；报告生成与确认留阶段 8 重新设计；阶段 6 先部署，阶段 7 改主页。
复核先锁 EvaluationRun，确认未软删除且成功，再用 sample.version 条件更新；历史、审计、报告过时同事务。更新竞争返回 409 VERSION_CONFLICT，输入保留。草稿不替换最终内容，确认修订号与编辑 version 分开。

## 3. 交互与 API
返回导航复用 `task-flow-back-link.tsx` 与次级按钮 token，放在标题上方左侧；主操作保留在内容后。`review-links.ts` 统一结果／比较／异常／报告 URL；结果页读取并校验 baselineRunId，回到比较时恢复显式选择（含空值“不比较”）。报告返回保留异常场景／指标／复核筛选；身份边界不变。
比较查询必填 candidateRunId、可选 baselineRunId／scenarioKey，输出当前指标、可比差值、基线选项与证据数量。异常查询必填 runId，可按 metricKey、scenarioKey、status、reviewState、page／pageSize 筛选；详情可附 runId 核对归属。PATCH review 接受 conclusion、mode=draft|confirm、expectedVersion。
增量目录以稳定 ID／upsert 只补两个历史模型与成功任务、每任务四指标；不覆盖已有记录，不重跑开发库完整 Seed。完成页按角色继续当前任务；等待／执行使用不确定进度条和已用时间，不伪造百分比，正常流程无刷新按钮，同步出错时提供重新连接；取消紧邻进度。复核示例只根据当前日志填表，不写库。
工程师的对比页保留显式基线与上下文；评测人员直访对比仍拒绝。复核界面显示草稿和最终两个区块；两身份都有明显编辑入口，评测人员才能最终确认。

2026-10-04：入口文案统一为“编辑/复核结论”，详情保留主按钮和 `review-workspace` 独立复核区域；区域 ID 为 `review-conclusion`，异常列表状态链接携带该锚点，详情状态链接定位本页区域，保留基线和筛选。入口后续按负责人反馈收敛：删除 `review-guide` 的“下一步”提示框，结果／比较不展示独立待复核跳转条，任务选择页的待复核数量恢复为普通红字；可点击状态仅保留在异常列表和详情。原生单选与原有异常主入口保持可用。仅调整展示和导航，无 Schema 或 HTTP 变更；按负责人约定不运行测试。
