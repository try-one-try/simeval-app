// Provider 只模拟执行；参数来自创建时保存的快照，基线不参与结果计算。
import "server-only";
import { createHash } from "node:crypto";
import type { RunStatus } from "@/domain/evaluation";
import type { SimulationSnapshot } from "@/domain/evaluation-catalog";
export type SimulationTask = { status: RunStatus; createdAt: Date; mockFailure: boolean };
export type GeneratedMetric = { metricDefinitionId: string; key: string; scenarioKey: string; sampleCount: number; value: number };
export interface EvaluationProvider {
  nextStatus(task: SimulationTask, now: Date): RunStatus;
  results(snapshot: SimulationSnapshot): GeneratedMetric[];
}
export class MockEvaluationProvider implements EvaluationProvider {
  nextStatus(task: SimulationTask, now: Date): RunStatus {
    const elapsed = now.getTime() - task.createdAt.getTime();
    if (task.status === "QUEUED" && elapsed >= 2000) return "RUNNING";
    if (task.status === "RUNNING" && elapsed >= 12000) return task.mockFailure ? "FAILED" : "SUCCEEDED";
    return task.status;
  }
  results(s: SimulationSnapshot): GeneratedMetric[] {
    // 推荐参数保持固定故事；其他 Seed／规模产生可复现的小幅偏移，不宣称统计实测。
    const digest = createHash("sha256").update(s.simulationSeed + ":" + s.episodeCount).digest().readUInt32BE(0);
    const variation = s.simulationSeed === 20260901 && s.episodeCount === 200 ? 0 : (digest % 401 - 200) / 100;
    const clamp = (n: number, high = 100) => Number(Math.max(0, Math.min(high, n)).toFixed(4));
    const values: Record<string, number> = {
      success_rate: clamp(s.success - s.difficulty + variation),
      collision_rate: clamp(s.collision + s.difficulty / 2 - variation / 2),
      duration: clamp(s.duration + s.difficulty / 5 - variation / 10, 1000),
      intervention_rate: clamp(s.intervention + s.difficulty / 3 - variation / 4),
    };
    return s.metrics.map(metric => ({ metricDefinitionId: metric.id, key: metric.key,
      scenarioKey: metric.key === "collision_rate" ? s.scenarioKey : "__overall__",
      sampleCount: metric.key === "collision_rate" ? Math.max(1, Math.round(s.episodeCount * s.scenarioFraction)) : s.episodeCount,
      value: values[metric.key] ?? 0 }));
  }
}
export const evaluationProvider: EvaluationProvider = new MockEvaluationProvider();
