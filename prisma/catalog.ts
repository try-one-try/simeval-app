// 增量补目录与历史基线；只迁移旧默认名称，保留自定义名称、指标和复核。
import type { PrismaClient } from "../src/generated/prisma/client";
import { seedDemoScenarios } from "./demo-fixtures";
import { PROJECT_ID, models, datasets, benchmarks, metricCatalog, metricId, DEMO_RUN_NAMES } from "../src/domain/evaluation-catalog";
export async function seedCatalog(db: PrismaClient) {
  await db.$transaction(async tx => {
    for (const model of models) {
      const { id, name, version } = model;
      await tx.modelVersion.upsert({ where: { id }, create: { id, name, version, projectId: PROJECT_ID, artifactRef: `synthetic://${id}` }, update: {} });
      await tx.modelVersion.updateMany({ where: { id, name: "PickPlace" }, data: { name } });
    }
    for (const dataset of datasets) {
      const { id, name, version, qualityStatus, sampleCount } = dataset;
      await tx.datasetVersion.upsert({ where: { id }, create: { id, name, version, qualityStatus, sampleCount, projectId: PROJECT_ID, metadata: { synthetic: true } }, update: {} });
      await tx.datasetVersion.updateMany({ where: { id, name: id.replace("demo-dataset-", "warehouse-").replace(/-v\d+$/, "") }, data: { name } });
      // 既有 WARNING 报告保留；新目录项提供真实存储的预置检查说明。
      if (id !== "demo-dataset-scenes-v3") await tx.dataQualityCheck.upsert({
        where: { datasetVersionId_checkKey: { datasetVersionId: id, checkKey: "required_fields" } },
        create: { datasetVersionId: id, checkKey: "required_fields", name: "必填字段", status: qualityStatus, affectedCount: qualityStatus === "FAILED" ? 12 : 0, message: qualityStatus === "FAILED" ? "12 条合成样本缺少抓取目标，修复后才能执行。" : "合成样本字段完整，预置检查通过。", details: { synthetic: true } }, update: {},
      });
    }
    for (const benchmark of benchmarks) {
      const { id, name, version } = benchmark;
      await tx.benchmark.upsert({ where: { id }, create: { id, name, version, projectId: PROJECT_ID }, update: {} });
      for (const metric of metricCatalog) {
        const { suffix, ...data } = metric;
        await tx.metricDefinition.upsert({ where: { id: metricId(id, suffix) }, create: { ...data, id: metricId(id, suffix), benchmarkId: id }, update: {} });
      }
    }
    // 历史结果与 v2.3 使用相同数据／基准／200 Episode／Seed；不是用户新创建的评测。
    for (const [index, modelId] of ["demo-model-v21", "demo-model-v22"].entries()) {
      const model = models.find(item => item.id === modelId)!;
      const runId = modelId.replace("model", "run");
      const at = new Date(Date.UTC(2026, 7, 30 + index, 9));
      const finishedAt = new Date(at.getTime() + 8 * 60_000);
      await tx.evaluationRun.upsert({
        where: { id: runId },
        create: { id: runId, name: DEMO_RUN_NAMES[modelId === "demo-model-v21" ? "demo-run-v21" : "demo-run-v22"], projectId: PROJECT_ID, modelVersionId: model.id,
          datasetVersionId: "demo-dataset-scenes-v3", benchmarkId: "demo-benchmark-v1",
          status: "SUCCEEDED", createdById: "demo-user-engineer", provider: "MockEvaluationProvider",
          episodeCount: 200, simulationSeed: 20260901, isDemoFixture: true,
          createdAt: at, startedAt: at, finishedAt, resultsGeneratedAt: finishedAt },
        update: {},
      });
      await tx.evaluationRun.updateMany({ where: { id: runId, name: "PickPlace " + model.version + " 历史合成示例" }, data: { name: DEMO_RUN_NAMES[modelId === "demo-model-v21" ? "demo-run-v21" : "demo-run-v22"] } });
      for (const metric of metricCatalog) {
        const data = { runId, metricDefinitionId: metricId("demo-benchmark-v1", metric.suffix),
          scenarioKey: metric.suffix === "collision" ? "occlusion" : "__overall__",
          sampleCount: metric.suffix === "collision" ? 50 : 200, value: model[metric.suffix] };
        await tx.metricResult.upsert({ where: { id: runId + "-" + metric.suffix }, create: { id: runId + "-" + metric.suffix, ...data }, update: {} });
      }
    }
    // 原固定候选／基线没有名称；只补空值，不覆盖人工改过的任务名。
    for (const id of ["demo-run-baseline", "demo-run-candidate"] as const)
      await tx.evaluationRun.updateMany({ where: { id, name: null }, data: { name: DEMO_RUN_NAMES[id] } });
  });
  await seedDemoScenarios(db);
}
