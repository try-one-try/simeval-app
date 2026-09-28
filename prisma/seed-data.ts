// 固定故事的写入逻辑：由调用方提供事务，初始化与完整恢复共用同一份数据。
import type { Prisma } from "../src/generated/prisma/client";
import { seedCatalogData } from "./catalog";
import { MODEL_FAMILY_NAME, DEMO_RUN_NAMES, datasets } from "../src/domain/evaluation-catalog";

const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 8, 1, hour, minute));

async function seedUsers(db: Prisma.TransactionClient) {
  const accounts = [
    { id: "demo-user-engineer", email: "engineer@demo.simeval.local", name: "林工", role: "ENGINEER" as const },
    { id: "demo-user-reviewer", email: "reviewer@demo.simeval.local", name: "陈复核", role: "REVIEWER" as const },
    { id: "demo-user-admin", email: "admin@demo.simeval.local", name: "周管理员", role: "ADMIN" as const },
  ];

  for (const account of accounts) {
    // 演示身份不再持有个人密码；重复 Seed 同时清除旧演示口令摘要。
    await db.user.upsert({
      where: { email: account.email },
      create: { ...account, passwordHash: null, isDemo: true },
      update: { name: account.name, role: account.role, passwordHash: null, isDemo: true },
    });
  }
}

async function seedStory(tx: Prisma.TransactionClient) {
    await tx.project.upsert({
      where: { slug: "warehouse-manipulation" },
      create: { id: "demo-project-warehouse", slug: "warehouse-manipulation", name: "Warehouse Manipulation", description: "比较仓储抓取策略在遮挡场景中的表现。" },
      update: { name: "Warehouse Manipulation", description: "比较仓储抓取策略在遮挡场景中的表现。" },
    });

    for (const model of [
      { id: "demo-model-baseline", name: MODEL_FAMILY_NAME, version: "v2.3" },
      { id: "demo-model-candidate", name: MODEL_FAMILY_NAME, version: "v2.4" },
    ]) {
      await tx.modelVersion.upsert({
        where: { id: model.id },
        create: { ...model, projectId: "demo-project-warehouse", artifactRef: `synthetic://${model.id}` },
        update: { name: model.name, version: model.version, artifactRef: `synthetic://${model.id}` },
      });
    }

    await tx.datasetVersion.upsert({
      where: { id: "demo-dataset-scenes-v3" },
      create: { id: "demo-dataset-scenes-v3", projectId: "demo-project-warehouse", name: datasets.find(dataset => dataset.id === "demo-dataset-scenes-v3")!.name, version: "v3", sampleCount: 2400, qualityStatus: "WARNING", metadata: { synthetic: true } },
      update: { name: datasets.find(dataset => dataset.id === "demo-dataset-scenes-v3")!.name, sampleCount: 2400, qualityStatus: "WARNING", metadata: { synthetic: true } },
    });

    for (const check of [
      { id: "demo-check-fields", checkKey: "required_fields", name: "必填字段", status: "PASSED" as const, affectedCount: 0, message: "预置样本字段完整。" },
      { id: "demo-check-annotations", checkKey: "invalid_annotations", name: "标注有效性", status: "PASSED" as const, affectedCount: 0, message: "预置标注通过规则检查。" },
      { id: "demo-check-media", checkKey: "missing_media", name: "媒体引用", status: "PASSED" as const, affectedCount: 0, message: "预置引用完整。" },
      { id: "demo-check-occlusion", checkKey: "scenario_distribution", name: "遮挡场景分布", status: "WARNING" as const, affectedCount: 18, message: "18 条遮挡场景样本需要人工复核。" },
    ]) {
      await tx.dataQualityCheck.upsert({
        where: { id: check.id },
        create: { ...check, datasetVersionId: "demo-dataset-scenes-v3", details: { synthetic: true } },
        update: { name: check.name, status: check.status, affectedCount: check.affectedCount, message: check.message, details: { synthetic: true } },
      });
    }

    await tx.benchmark.upsert({
      where: { id: "demo-benchmark-v1" },
      create: { id: "demo-benchmark-v1", projectId: "demo-project-warehouse", name: "Warehouse Manipulation", version: "v1" },
      update: { name: "Warehouse Manipulation", version: "v1" },
    });
    for (const metric of [
      { id: "demo-metric-success", key: "success_rate", name: "任务成功率", unit: "%", direction: "HIGHER_IS_BETTER" as const },
      { id: "demo-metric-collision", key: "collision_rate", name: "碰撞率", unit: "%", direction: "LOWER_IS_BETTER" as const },
      { id: "demo-metric-duration", key: "duration", name: "平均耗时", unit: "s", direction: "LOWER_IS_BETTER" as const },
      { id: "demo-metric-intervention", key: "intervention_rate", name: "人工干预率", unit: "%", direction: "LOWER_IS_BETTER" as const },
    ]) {
      await tx.metricDefinition.upsert({
        where: { id: metric.id },
        create: { ...metric, benchmarkId: "demo-benchmark-v1" },
        update: { name: metric.name, unit: metric.unit, direction: metric.direction },
      });
    }

    for (const run of [
      { id: "demo-run-baseline", modelVersionId: "demo-model-baseline", baselineRunId: null, createdAt: at(9), finishedAt: at(9, 8) },
      { id: "demo-run-candidate", modelVersionId: "demo-model-candidate", baselineRunId: "demo-run-baseline", createdAt: at(10), finishedAt: at(10, 8) },
    ]) {
      const data = {
        name: DEMO_RUN_NAMES[run.id as "demo-run-baseline" | "demo-run-candidate"],
        projectId: "demo-project-warehouse", modelVersionId: run.modelVersionId,
        datasetVersionId: "demo-dataset-scenes-v3", benchmarkId: "demo-benchmark-v1",
        baselineRunId: run.baselineRunId, status: "SUCCEEDED" as const,
        createdById: "demo-user-engineer", provider: "MockEvaluationProvider",
        episodeCount: 200, simulationSeed: 20260901, isDemoFixture: true,
        startedAt: run.createdAt, finishedAt: run.finishedAt,
        resultsGeneratedAt: run.finishedAt, createdAt: run.createdAt,
      };
      await tx.evaluationRun.upsert({ where: { id: run.id }, create: { id: run.id, ...data }, update: data });
    }

    for (const result of [
      ["baseline-success", "demo-run-baseline", "demo-metric-success", "__overall__", 76, 200],
      ["candidate-success", "demo-run-candidate", "demo-metric-success", "__overall__", 81, 200],
      ["baseline-collision", "demo-run-baseline", "demo-metric-collision", "occlusion", 8, 50],
      ["candidate-collision", "demo-run-candidate", "demo-metric-collision", "occlusion", 13, 50],
      ["baseline-duration", "demo-run-baseline", "demo-metric-duration", "__overall__", 12.4, 200],
      ["candidate-duration", "demo-run-candidate", "demo-metric-duration", "__overall__", 11.8, 200],
      ["baseline-intervention", "demo-run-baseline", "demo-metric-intervention", "__overall__", 6, 200],
      ["candidate-intervention", "demo-run-candidate", "demo-metric-intervention", "__overall__", 5, 200],
    ] as const) {
      const [suffix, runId, metricDefinitionId, scenarioKey, value, sampleCount] = result;
      const data = { runId, metricDefinitionId, scenarioKey, value, sampleCount };
      await tx.metricResult.upsert({ where: { id: `demo-result-${suffix}` }, create: { id: `demo-result-${suffix}`, ...data }, update: data });
    }

    for (const sample of [
      { id: "demo-sample-017", sampleNumber: "sample_017", reviewCategory: "DATA_ISSUE" as const, conclusion: "遮挡标签偏移，属于数据问题；已创建回补任务。", logExcerpt: "occlusion_label_offset=true" },
      { id: "demo-sample-018", sampleNumber: "sample_018", reviewCategory: "MODEL_ISSUE" as const, conclusion: "遮挡下抓取路径碰撞，属于模型问题。", logExcerpt: "collision_during_grasp=true" },
    ]) {
      const data = {
        runId: "demo-run-candidate", sampleNumber: sample.sampleNumber,
        scenarioKey: "occlusion", anomalyType: "collision_regression",
        metricKey: "collision_rate", reviewCategory: sample.reviewCategory,
        status: "RESOLVED" as const, assigneeId: "demo-user-reviewer",
        logExcerpt: sample.logExcerpt, metadata: { synthetic: true },
        conclusion: sample.conclusion, version: 1, resolvedAt: at(11),
        draftConclusion: null, draftUpdatedById: null, draftUpdatedAt: null,
        confirmedRevision: 1, confirmedById: "demo-user-reviewer", confirmedAt: at(11),
      };
      await tx.anomalySample.upsert({ where: { id: sample.id }, create: { id: sample.id, ...data }, update: data });
      await tx.reviewRecord.upsert({
        where: { id: `demo-review-${sample.sampleNumber}` },
        create: { id: `demo-review-${sample.sampleNumber}`, anomalySampleId: sample.id, reviewerId: "demo-user-reviewer", fromStatus: "OPEN", toStatus: "RESOLVED", category: sample.reviewCategory, conclusion: sample.conclusion, createdAt: at(11) },
        update: { category: sample.reviewCategory, conclusion: sample.conclusion },
      });
    }

    await tx.backfillTask.upsert({
      where: { id: "demo-backfill-017" },
      create: { id: "demo-backfill-017", anomalySampleId: "demo-sample-017", reason: "修复遮挡标签偏移并复核样本。", status: "OPEN", assigneeId: "demo-user-reviewer", createdById: "demo-user-reviewer", createdAt: at(11, 5) },
      update: { reason: "修复遮挡标签偏移并复核样本。", status: "OPEN", assigneeId: "demo-user-reviewer" },
    });

    const report = {
      runId: "demo-run-candidate", baselineRunId: "demo-run-baseline",
      status: "CONFIRMED" as const, isStale: false, staleAt: null,
      inputSnapshot: { synthetic: true, metrics: ["demo-result-baseline-success", "demo-result-candidate-success", "demo-result-baseline-collision", "demo-result-candidate-collision"], samples: ["demo-sample-017", "demo-sample-018"] },
      output: { summary: "合成示例：总体成功率上升，但遮挡场景碰撞率回退，需要先处理数据标签问题并改进抓取路径。", evidence: ["demo-result-candidate-collision", "demo-sample-017", "demo-sample-018"] },
      provider: "CachedInsightProvider", model: "synthetic-fixture",
      requestedById: "demo-user-engineer", confirmedById: "demo-user-reviewer", confirmedAt: at(12), createdAt: at(11, 30),
    };
    await tx.aIReport.upsert({ where: { id: "demo-report-confirmed" }, create: { id: "demo-report-confirmed", ...report }, update: report });

    for (const audit of [
      { id: "demo-audit-review-017", actorId: "demo-user-reviewer", action: "ANOMALY_REVIEWED", entityType: "AnomalySample", entityId: "demo-sample-017", createdAt: at(11) },
      { id: "demo-audit-review-018", actorId: "demo-user-reviewer", action: "ANOMALY_REVIEWED", entityType: "AnomalySample", entityId: "demo-sample-018", createdAt: at(11) },
      { id: "demo-audit-backfill", actorId: "demo-user-reviewer", action: "BACKFILL_CREATED", entityType: "BackfillTask", entityId: "demo-backfill-017", createdAt: at(11, 5) },
      { id: "demo-audit-report", actorId: "demo-user-reviewer", action: "REPORT_CONFIRMED", entityType: "AIReport", entityId: "demo-report-confirmed", createdAt: at(12) },
    ]) {
      await tx.auditLog.upsert({
        where: { id: audit.id },
        create: { ...audit, requestId: audit.id, metadata: { synthetic: true } },
        update: { action: audit.action, metadata: { synthetic: true } },
      });
    }
}

export async function seedDefaultData(tx: Prisma.TransactionClient) {
  await seedUsers(tx);
  await seedStory(tx);
  await seedCatalogData(tx);
}
