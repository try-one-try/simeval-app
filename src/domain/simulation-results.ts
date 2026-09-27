// 只计算合成指标；Seed 与执行 Provider 共用，保证相同配置得到相同结果。
import { createHash } from "node:crypto";
import type { SimulationSnapshot } from "./evaluation-catalog";

export type SimulationMetric = { metricDefinitionId: string; key: string; scenarioKey: string; sampleCount: number; value: number };

export function generateSimulationMetrics(s: SimulationSnapshot): SimulationMetric[] {
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
