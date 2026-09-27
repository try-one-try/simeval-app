// 合成目录的兼容规则与模拟参数共用一个出处；不是实测模型性能。
import { z } from "zod";
export const ACTIVE_TASK_LIMIT = 3;
export const PROJECT_ID = "demo-project-warehouse";
export const models = [
  { id: "demo-model-v21", name: "PickPlace", version: "v2.1", selectable: false, success: 70, collision: 11, duration: 13.8, intervention: 8 },
  { id: "demo-model-v22", name: "PickPlace", version: "v2.2", selectable: false, success: 73, collision: 9, duration: 13, intervention: 7 },
  { id: "demo-model-baseline", name: "PickPlace", version: "v2.3", selectable: false, success: 76, collision: 8, duration: 12.4, intervention: 6 },
  { id: "demo-model-candidate", name: "PickPlace", version: "v2.4", selectable: true, success: 81, collision: 13, duration: 11.8, intervention: 5 },
  { id: "demo-model-v25", name: "PickPlace", version: "v2.5", selectable: true, success: 84, collision: 9, duration: 11.4, intervention: 4 },
];
export const datasets = [
  { id: "demo-dataset-scenes-v3", name: "warehouse-scenes", version: "v3", qualityStatus: "WARNING" as const, sampleCount: 2400, difficulty: 0, minEpisodes: 50, maxEpisodes: 1000 },
  { id: "demo-dataset-clean-v1", name: "warehouse-clean", version: "v1", qualityStatus: "PASSED" as const, sampleCount: 1200, difficulty: -3, minEpisodes: 50, maxEpisodes: 1000 },
  { id: "demo-dataset-invalid-v1", name: "warehouse-invalid", version: "v1", qualityStatus: "FAILED" as const, sampleCount: 300, difficulty: 4, minEpisodes: 50, maxEpisodes: 300 },
];
export const benchmarks = [
  { id: "demo-benchmark-v1", name: "Warehouse Manipulation", version: "v1", successRule: "在规定时间内完成抓取和放置；总体成功率按 Episode 统计。", difficulty: 0, minEpisodes: 50, maxEpisodes: 1000, scenarioKey: "occlusion", scenarioFraction: .25, datasetIds: datasets.map(d => d.id), modelIds: models.filter(m => m.selectable).map(m => m.id) },
  { id: "demo-benchmark-occlusion-v1", name: "Occlusion Stress", version: "v1", successRule: "遮挡场景下完成抓取和放置；所有 Episode 均为遮挡场景。", difficulty: 6, minEpisodes: 50, maxEpisodes: 500, scenarioKey: "occlusion", scenarioFraction: 1, datasetIds: ["demo-dataset-scenes-v3", "demo-dataset-invalid-v1"], modelIds: models.filter(m => m.selectable).map(m => m.id) },
];
export const metricCatalog = [
  { suffix: "success", key: "success_rate", name: "任务成功率", unit: "%", direction: "HIGHER_IS_BETTER" as const },
  { suffix: "collision", key: "collision_rate", name: "碰撞率", unit: "%", direction: "LOWER_IS_BETTER" as const },
  { suffix: "duration", key: "duration", name: "平均耗时", unit: "s", direction: "LOWER_IS_BETTER" as const },
  { suffix: "intervention", key: "intervention_rate", name: "人工干预率", unit: "%", direction: "LOWER_IS_BETTER" as const },
] as const;
export const metricId = (benchmarkId: string, suffix: string) => benchmarkId === "demo-benchmark-v1" ? `demo-metric-${suffix}` : `demo-occlusion-metric-${suffix}`;
export const snapshotSchema = z.object({
  algorithm: z.literal("mock-v2"), modelId: z.string(), datasetId: z.string(), benchmarkId: z.string(),
  success: z.number(), collision: z.number(), duration: z.number(), intervention: z.number(), difficulty: z.number(),
  episodeCount: z.number().int().positive(), simulationSeed: z.number().int(), scenarioKey: z.string(), scenarioFraction: z.number(), successRule: z.string(),
  metrics: z.array(z.object({ id: z.string(), key: z.string() })),
});
export type SimulationSnapshot = z.infer<typeof snapshotSchema>;
export function configurationProfile(modelId: string, datasetId: string, benchmarkId: string) {
  const model = models.find(m => m.id === modelId && m.selectable);
  const dataset = datasets.find(d => d.id === datasetId);
  const benchmark = benchmarks.find(b => b.id === benchmarkId);
  if (!model || !dataset || !benchmark || !benchmark.datasetIds.includes(datasetId) || !benchmark.modelIds.includes(modelId)) return null;
  return { model, dataset, benchmark, minEpisodes: Math.max(dataset.minEpisodes, benchmark.minEpisodes), maxEpisodes: Math.min(dataset.maxEpisodes, benchmark.maxEpisodes) };
}
