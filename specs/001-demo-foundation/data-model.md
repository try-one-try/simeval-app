# Data Model: 演示工作台基础

**状态**：阶段 2 数据设计；初始迁移已在本地开发库和独立测试库应用。此文件规定本切片的表与 Seed 关系；HTTP 字段仍以 [OpenAPI](../../docs/openapi.yaml) 为准。

## 模型与关系

| 实体 | 核心字段与约束 | 本切片用途 |
|---|---|---|
| User | `id`、唯一 `email`、`name`、`role`、`passwordHash`、`isDemo` | 会话身份与演示账号。默认快捷入口仅使用 ENGINEER；密码摘要不返回页面。 |
| Project | `id`、唯一 `slug`、`name`、`description` | Warehouse Manipulation 演示项目。 |
| ModelVersion | `id`、`projectId`、`name`、`version`；`projectId+name+version` 唯一 | 固定的 v2.3 基线与 v2.4 候选。 |
| DatasetVersion | `id`、`projectId`、`name`、`version`、`sampleCount`、`qualityStatus`；`projectId+name+version` 唯一 | 固定的 warehouse-scenes-v3，状态 WARNING。 |
| DataQualityCheck | `id`、`datasetVersionId`、`checkKey`、`status`、`affectedCount`、`message` | 预置 18 条遮挡场景警告，概览可查来源。 |
| Benchmark | `id`、`projectId`、`name`、`version` | 约束比较口径。 |
| MetricDefinition | `id`、`benchmarkId`、`key`、`unit`、`direction` | 成功率、碰撞率、耗时、人工干预率定义。 |
| EvaluationRun | `id`、`projectId`、模型／数据集／Benchmark 外键、`baselineRunId`、`status`、`createdById`、Episode 与 Seed、时间及 Provider 字段 | 已完成基线与候选任务；后续新建任务与预置任务分开。 |
| MetricResult | `runId`、`metricDefinitionId`、非空 `scenarioKey`、`value`、`sampleCount`；三字段唯一 | 固定指标。整体指标用 `__overall__`，避免 MySQL 对组合唯一中的 NULL 放行。 |
| AnomalySample | `id`、`runId`、`sampleNumber`、`scenarioKey`、`metricKey`、状态／分类、负责人、结论、`version`、证据字段 | `sample_017` 数据问题，`sample_018` 模型问题；可从回退指标定位。 |
| ReviewRecord | 样本、操作者、前后状态、分类、结论或重开原因、时间 | 保留预置的人工作业证据，后续只追加。 |
| BackfillTask | 来源样本、原因、负责人、状态、处理说明 | 数据问题样本的轻量回补记录，不执行 ETL。 |
| AIReport | 候选／基线任务、状态、输入快照、结构化输出、Provider、确认人和时间 | 预置一份缓存且已人工确认的合成报告。 |
| AuditLog | 操作者、动作、实体、请求编号、补充信息和时间 | 预置故事及后续重要写入可追溯。 |

具体字段、枚举和关系将在 `prisma/schema.prisma` 中实现，迁移文件作为公开证据提交。经常筛选、连接和排序的属性使用正式字段；仅可变补充信息使用 JSON。使用固定 ID 是为了稳定导览和测试，不把用户提供的真实资料写入 Seed。

## 不变量

1. 模型版本、数据集版本、Benchmark 和任务归属同一项目；候选任务的基线任务已成功。
2. `MetricResult` 的 `scenarioKey` 在数据库非空；整体使用 `__overall__`，对外展示时映射为“总体”或 HTTP 契约中的 `null`。
3. 候选遮挡碰撞率由基线 8% 到候选 13%，因此是回退；总体成功率由 76% 到 81%。这些数值是**合成示例**，不是模型真实表现。
4. `sample_017` 的人工分类是 `DATA_ISSUE`，且有关联的 OPEN 回补任务；`sample_018` 是 `MODEL_ISSUE`。两条样本都属于候选任务、遮挡场景与碰撞率指标。
5. 预置报告只引用当前候选任务真实存在的指标与样本，输入快照、复核记录和确认人可查；不得将固定文本直接硬编码为页面数据。
6. 用于快速导览的预置记录由 Seed 确定性重建；后续写入流程创建独立 ID，避免覆盖导览证据链。
7. 业务状态与复核历史分开保存。重开规则属于后续复核切片，数据库字段在本阶段预留但不开放虚假的重开页面。

## Seed 设计与可重复性

- 固定生成三个演示角色账号、一个项目、两个模型版本、一个 WARNING 数据集及质量检查、一个 Benchmark 和四个指标定义。
- 固定生成一条 SUCCEEDED 基线和一条 SUCCEEDED 候选、相应整体与遮挡指标、两条已复核样本、一条回补任务和一份 CONFIRMED 缓存报告。
- Seed 使用稳定键或 upsert，使再次运行不产生重复。重置若会删除数据，必须仅面向明确的项目专用开发／测试库，并在执行前确认目标库；普通 Seed 运行不删除其他用户数据。
- 用同一个仓储查询取得概览数据；空库或断开数据库时分别给出空状态或错误状态，不在 UI 中回退到伪造常量。

## 数据访问边界

页面调用概览查询服务，查询服务通过仓储接口读取必要字段并组装小型 DTO。Prisma 客户端与凭据只在服务端仓储和认证模块内使用。阶段 2 尚不对外开放这些实体的业务写 HTTP 接口；后续每个切片按对应规格补充状态校验、事务和测试。
