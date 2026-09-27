// 补齐六类核心场景；已有同名演示沿用原 ID，重复执行不重置人工内容或恢复删除。
import type { Prisma } from "../src/generated/prisma/client";
import { PROJECT_ID, DEMO_RUN_NAMES, configurationProfile, metricCatalog, metricId } from "../src/domain/evaluation-catalog";
import { generateSimulationMetrics } from "../src/domain/simulation-results";

type DemoScenario = {
  id: keyof typeof DEMO_RUN_NAMES; modelVersionId: string; datasetVersionId: string; benchmarkId: string;
  status: "SUCCEEDED" | "FAILED" | "CANCELLED"; targetSuccessRate: number;
  retryOfRunId?: string; partialReview?: boolean;
};
const common = { modelVersionId: "demo-model-candidate", datasetVersionId: "demo-dataset-scenes-v3", benchmarkId: "demo-benchmark-v1", targetSuccessRate: .8 };
const scenarios: DemoScenario[] = [
  { ...common, id: "demo-run-evidence-review", status: "SUCCEEDED", partialReview: true },
  { ...common, id: "demo-run-recovery-test", status: "FAILED" },
  { ...common, id: "demo-run-recovery-retry", status: "SUCCEEDED", retryOfRunId: "demo-run-recovery-test" },
  { ...common, id: "demo-run-cancellation", modelVersionId: "demo-model-v25", datasetVersionId: "demo-dataset-clean-v1", status: "CANCELLED" },
  { ...common, id: "demo-run-clean", modelVersionId: "demo-model-v25", datasetVersionId: "demo-dataset-clean-v1", targetSuccessRate: .85, status: "SUCCEEDED" },
  { ...common, id: "demo-run-occlusion", modelVersionId: "demo-model-v25", benchmarkId: "demo-benchmark-occlusion-v1", targetSuccessRate: .85, status: "SUCCEEDED" },
];

export async function seedDemoScenarios(tx: Prisma.TransactionClient) {
    const ids = new Map<string, string>();
    for (const [index, scenario] of scenarios.entries()) {
      const name = DEMO_RUN_NAMES[scenario.id];
      const matches = await tx.evaluationRun.findMany({ where: { projectId: PROJECT_ID, createdById: "demo-user-engineer",
        OR: [{ id: scenario.id }, { name }] } });
      const canonical = matches.find(run => run.id === scenario.id);
      if (!canonical && matches.length > 1) throw new Error(`Ambiguous demo fixture: ${name}`);
      const existing = canonical ?? matches[0];
      if (existing) {
        if (existing.modelVersionId !== scenario.modelVersionId || existing.datasetVersionId !== scenario.datasetVersionId ||
            existing.benchmarkId !== scenario.benchmarkId || existing.status !== scenario.status ||
            existing.episodeCount !== 200 || existing.simulationSeed !== 20260901 || existing.provider !== "MockEvaluationProvider")
          throw new Error(`Existing demo configuration differs: ${name}`);
        if (scenario.retryOfRunId && existing.retryOfRunId !== ids.get(scenario.retryOfRunId))
          throw new Error(`Existing demo retry reference differs: ${name}`);
        ids.set(scenario.id, existing.id);
        // 将已整理的旧演示标成固定示例；不改变配置、指标、复核和原始时间。
        if (!existing.isDemoFixture && !existing.deletedAt) {
          await tx.evaluationRun.update({ where: { id: existing.id }, data: { isDemoFixture: true } });
          await tx.auditLog.create({ data: { actorId: "demo-user-engineer", requestId: "demo-core-fixtures-v1", action: "DEMO_FIXTURE_ADOPTED",
            entityType: "EvaluationRun", entityId: existing.id, metadata: { synthetic: true, fixtureKey: scenario.id } } });
        }
        continue;
      }
      const profile = configurationProfile(scenario.modelVersionId, scenario.datasetVersionId, scenario.benchmarkId);
      if (!profile) throw new Error(`Invalid demo configuration: ${name}`);
      const { model, dataset, benchmark } = profile;
      const snapshot = { algorithm: "mock-v2" as const, modelId: model.id, datasetId: dataset.id, benchmarkId: benchmark.id,
        success: model.success, collision: model.collision, duration: model.duration, intervention: model.intervention,
        difficulty: dataset.difficulty + benchmark.difficulty, episodeCount: 200, simulationSeed: 20260901,
        scenarioKey: benchmark.scenarioKey, scenarioFraction: benchmark.scenarioFraction, successRule: benchmark.successRule,
        metrics: metricCatalog.map(metric => ({ id: metricId(benchmark.id, metric.suffix), key: metric.key })) };
      const createdAt = new Date(Date.UTC(2026, 8, 1, 8, index * 10));
      const finishedAt = new Date(createdAt.getTime() + (scenario.status === "CANCELLED" ? 2000 : 4000));
      const retryOfRunId = scenario.retryOfRunId ? ids.get(scenario.retryOfRunId) : null;
      if (scenario.retryOfRunId && !retryOfRunId) throw new Error("Missing failed demo task for retry");
      await tx.evaluationRun.create({ data: { id: scenario.id, name, projectId: PROJECT_ID, modelVersionId: model.id,
        datasetVersionId: dataset.id, benchmarkId: benchmark.id, status: scenario.status, createdById: "demo-user-engineer",
        provider: "MockEvaluationProvider", episodeCount: 200, simulationSeed: 20260901, isDemoFixture: true,
        targetSuccessRate: scenario.targetSuccessRate, configurationSnapshot: snapshot, retryOfRunId,
        mockFailure: scenario.status === "FAILED", errorCode: scenario.status === "FAILED" ? "MOCK_EXECUTION_FAILED" : null,
        errorMessage: scenario.status === "FAILED" ? "合成故障示例：模拟执行失败，已有独立重试记录。" : null,
        createdAt, startedAt: scenario.status === "CANCELLED" ? null : new Date(createdAt.getTime() + 1000), finishedAt,
        resultsGeneratedAt: scenario.status === "SUCCEEDED" ? finishedAt : null } });
      ids.set(scenario.id, scenario.id);
      if (scenario.status === "SUCCEEDED") {
        await tx.metricResult.createMany({ data: generateSimulationMetrics(snapshot).map(metric => ({ id: scenario.id + "-" + metric.key,
          runId: scenario.id, metricDefinitionId: metric.metricDefinitionId, scenarioKey: metric.scenarioKey, value: metric.value, sampleCount: metric.sampleCount })) });
        const firstConclusion = "合成复核：建议检查遮挡标签是否准确。";
        const finalConclusion = "合成复核：日志显示遮挡标签偏移，建议核对标注并复测；尚不能排除策略影响。";
        for (const number of ["017", "018"]) {
          const confirmed = !!scenario.partialReview && number === "017";
          const sampleId = scenario.id + "-sample-" + number;
          const confirmedAt = confirmed ? new Date(finishedAt.getTime() + 60000) : null;
          await tx.anomalySample.create({ data: { id: sampleId, runId: scenario.id, sampleNumber: "sample_" + number,
            scenarioKey: "occlusion", anomalyType: "collision_event", metricKey: "collision_rate", status: confirmed ? "RESOLVED" : "OPEN",
            logExcerpt: scenario.partialReview ? number === "017" ? "occlusion_label_offset=true" : "collision_during_grasp=true"
              : number === "017" ? "synthetic_collision_contact=true" : "synthetic_grasp_path_collision=true",
            metadata: { synthetic: true }, version: confirmed ? 3 : 1, conclusion: confirmed ? finalConclusion : null,
            confirmedRevision: confirmed ? 2 : 0, confirmedById: confirmed ? "demo-user-reviewer" : null, confirmedAt, resolvedAt: confirmedAt } });
          if (confirmed) {
            await tx.reviewRecord.createMany({ data: [firstConclusion, finalConclusion].map((conclusion, i) => ({ id: sampleId + "-review-" + (i + 1),
              anomalySampleId: sampleId, reviewerId: "demo-user-reviewer", fromStatus: i === 0 ? "OPEN" as const : "RESOLVED" as const,
              toStatus: "RESOLVED" as const, mode: "confirm", conclusion, fromVersion: i + 1, toVersion: i + 2, confirmedRevision: i + 1,
              createdAt: new Date(finishedAt.getTime() + (i + 1) * 30000) })) });
          }
        }
      }
      await tx.auditLog.create({ data: { actorId: "demo-user-engineer", requestId: "demo-core-fixtures-v1", action: "DEMO_FIXTURE_CREATED",
        entityType: "EvaluationRun", entityId: scenario.id, metadata: { synthetic: true, fixtureKey: scenario.id, status: scenario.status } } });
    }
}
