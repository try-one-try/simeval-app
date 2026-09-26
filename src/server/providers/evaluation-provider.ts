// Provider 描述执行边界；当前实现只模拟时间与结果，不运行仿真器。
import "server-only";
import type { RunStatus } from "@/domain/evaluation";
export type SimulationTask = { status: RunStatus; createdAt: Date; mockFailure: boolean };
export type GeneratedMetric = { metricDefinitionId: string; key: string; scenarioKey: string; sampleCount: number; value: number };
export interface EvaluationProvider {
  nextStatus(task: SimulationTask, now: Date): RunStatus;
  results(baseline: GeneratedMetric[]): GeneratedMetric[];
}
export class MockEvaluationProvider implements EvaluationProvider {
  nextStatus(task: SimulationTask, now: Date): RunStatus {
    const elapsed = now.getTime() - task.createdAt.getTime();
    if (task.status === "QUEUED" && elapsed >= 2000) return "RUNNING";
    if (task.status === "RUNNING" && elapsed >= 12000) return task.mockFailure ? "FAILED" : "SUCCEEDED";
    return task.status;
  }
  results(baseline: GeneratedMetric[]): GeneratedMetric[] {
    // 固定增量服务演示故事；指标仍来自所选基线，不使用客户端随机数。
    const delta: Record<string, number> = { success_rate: 5, collision_rate: 5, duration: -.6, intervention_rate: -1 };
    return baseline.map((metric) => ({ ...metric, value: Number((metric.value + (delta[metric.key] ?? 0)).toFixed(4)) }));
  }
}
export const evaluationProvider: EvaluationProvider = new MockEvaluationProvider();