// 对比口径与结论规则是纯逻辑；编辑版本和确认修订号解决不同的问题。
import { z } from "zod";
import { AppError, assertRole, idSchema, type Actor } from "./evaluation";
export const comparisonQuerySchema = z.object({ candidateRunId: idSchema, baselineRunId: idSchema.optional(), scenarioKey: z.string().trim().min(1).max(120).optional() }).strict();
export const sampleQuerySchema = z.object({
  runId: idSchema, metricKey: z.string().trim().min(1).max(120).optional(), scenarioKey: z.string().trim().min(1).max(120).optional(),
  status: z.enum(["OPEN","IN_REVIEW","RESOLVED","REOPENED"]).optional(), reviewState: z.enum(["pending","confirmed"]).optional(),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export const reviewSchema = z.object({ conclusion: z.string().trim().min(1,"请填写结论").max(4000,"结论最多 4000 字"), mode: z.enum(["draft","confirm"]), expectedVersion: z.number().int().min(1) }).strict();
export type ReviewInput = z.infer<typeof reviewSchema>;
export type SampleQuery = z.infer<typeof sampleQuerySchema>;
type ComparableRun = { projectId: string; datasetVersionId: string; benchmarkId: string; modelVersionId: string; episodeCount: number; simulationSeed: number; status: string };
export function assertComparable(candidate: ComparableRun, baseline: ComparableRun) {
  if (candidate.status !== "SUCCEEDED" || baseline.status !== "SUCCEEDED" || candidate.modelVersionId === baseline.modelVersionId ||
      candidate.projectId !== baseline.projectId || candidate.datasetVersionId !== baseline.datasetVersionId || candidate.benchmarkId !== baseline.benchmarkId ||
      candidate.episodeCount !== baseline.episodeCount || candidate.simulationSeed !== baseline.simulationSeed)
    throw new AppError("INCOMPATIBLE_CONFIGURATION","仅能比较同项目、数据、Benchmark、Episode 和 Seed 的成功任务，模型版本需不同");
}
export type MetricPoint = { key: string; name: string; unit: string; direction: "HIGHER_IS_BETTER"|"LOWER_IS_BETTER"; scenarioKey: string; value: number; sampleCount: number };
export type ComparisonMetric = Omit<MetricPoint,"value"|"sampleCount"> & {
  candidateValue: number|null; baselineValue: number|null; candidateSampleCount: number|null; baselineSampleCount: number|null;
  delta: number|null; deltaUnit: string; verdict: "IMPROVEMENT"|"REGRESSION"|"UNCHANGED"|"NOT_COMPARABLE"|"CURRENT_ONLY"; reason: string|null; evidenceCount: number;
};
export function compareMetrics(candidate: MetricPoint[], baseline: MetricPoint[]|null, evidence: {metricKey:string;scenarioKey:string}[]): ComparisonMetric[] {
  const identity = (m:{key:string;scenarioKey:string}) => m.key + ":" + m.scenarioKey;
  const identities = [...new Set([...candidate,...baseline??[]].map(identity))];
  return identities.map(key => {
    const current = candidate.find(m=>identity(m)===key), old = baseline?.find(m=>identity(m)===key), point = current ?? old!;
    const reason = baseline === null ? null : !current || !old ? "一侧缺少指标" : current.unit!==old.unit || current.direction!==old.direction ? "单位或方向不一致" : current.sampleCount!==old.sampleCount ? "样本数不一致" : null;
    const delta = baseline !== null && reason === null ? Number((current!.value-old!.value).toFixed(4)) : null;
    const verdict = baseline === null ? "CURRENT_ONLY" : reason ? "NOT_COMPARABLE" : delta === 0 ? "UNCHANGED" : ((point.direction==="HIGHER_IS_BETTER") === (delta!>0)) ? "IMPROVEMENT" : "REGRESSION";
    return { key:point.key,name:point.name,unit:point.unit,direction:point.direction,scenarioKey:point.scenarioKey,candidateValue:current?.value??null,baselineValue:old?.value??null,
      candidateSampleCount:current?.sampleCount??null,baselineSampleCount:old?.sampleCount??null,delta,deltaUnit:point.unit==="%"?"pp":point.unit,verdict,reason,
      evidenceCount:evidence.filter(s=>s.metricKey===point.key && s.scenarioKey===point.scenarioKey).length };
  });
}
export function assertReview(actor: Actor, ownerId: string, mode: ReviewInput["mode"]) {
  assertRole(actor,["ENGINEER","REVIEWER"]);
  if (mode==="confirm" && actor.role!=="REVIEWER" || actor.role==="ENGINEER" && actor.id!==ownerId) throw new AppError("FORBIDDEN","工程师仅能编辑本人任务草稿，最终结论需评测人员确认",403);
}
export function isPendingReview(sample: {status:string;draftConclusion?:string|null}) { return sample.status!=="RESOLVED" || !!sample.draftConclusion; }
