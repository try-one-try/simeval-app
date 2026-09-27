// 增量目录写入只补模型、数据与基准，不修改用户创建的任务或历史故事。
import type { PrismaClient } from "../src/generated/prisma/client";
import { PROJECT_ID, models, datasets, benchmarks, metricCatalog, metricId } from "../src/domain/evaluation-catalog";
export async function seedCatalog(db: PrismaClient) {
  await db.$transaction(async tx => {
    for (const model of models) {
      const { id, name, version } = model;
      await tx.modelVersion.upsert({ where: { id }, create: { id, name, version, projectId: PROJECT_ID, artifactRef: `synthetic://${id}` }, update: {} });
    }
    for (const dataset of datasets) {
      const { id, name, version, qualityStatus, sampleCount } = dataset;
      await tx.datasetVersion.upsert({ where: { id }, create: { id, name, version, qualityStatus, sampleCount, projectId: PROJECT_ID, metadata: { synthetic: true } }, update: {} });
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
  });
}
