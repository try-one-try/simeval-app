// Provider 只模拟执行；参数来自创建时保存的快照，基线不参与结果计算。
import "server-only";
import type { RunStatus } from "@/domain/evaluation";
import type { SimulationSnapshot } from "@/domain/evaluation-catalog";
import { generateSimulationMetrics, type SimulationMetric } from "@/domain/simulation-results";
// 演示时长集中配置，单位毫秒；以创建时间为起点，页面同步时才推进状态。
export const MOCK_EXECUTION_TIMING = { startAfterMs: 1_000, finishAfterMs: 4_000 } as const;
export type SimulationTask = { status: RunStatus; createdAt: Date; mockFailure: boolean };
export type GeneratedMetric = SimulationMetric;
export interface EvaluationProvider {
  nextStatus(task: SimulationTask, now: Date): RunStatus;
  results(snapshot: SimulationSnapshot): GeneratedMetric[];
}
export class MockEvaluationProvider implements EvaluationProvider {
  nextStatus(task: SimulationTask, now: Date): RunStatus {
    const elapsed = now.getTime() - task.createdAt.getTime();
    if (task.status === "QUEUED" && elapsed >= MOCK_EXECUTION_TIMING.startAfterMs) return "RUNNING";
    if (task.status === "RUNNING" && elapsed >= MOCK_EXECUTION_TIMING.finishAfterMs) return task.mockFailure ? "FAILED" : "SUCCEEDED";
    return task.status;
  }
  results(s: SimulationSnapshot): GeneratedMetric[] {
    return generateSimulationMetrics(s);
  }
}
export const evaluationProvider: EvaluationProvider = new MockEvaluationProvider();
