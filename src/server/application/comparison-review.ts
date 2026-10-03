// 应用层按真实指标组织判读和复核 DTO；不从固定故事复制结论。
import "server-only";
import { comparisonReviewRepository as repository, type StoredSample } from "@/server/repositories/comparison-review-repository";
import { runDto } from "./evaluation";
import { compareMetrics,isPendingReview,type MetricPoint,type SampleQuery,type ReviewInput } from "@/domain/comparison-review";
import type { Actor } from "@/domain/evaluation";
import type { StoredRun } from "@/server/repositories/evaluation-repository";
import type { ComparisonData,SampleData,SampleDetailData,SampleListData } from "@/lib/review-dto";
import { demoIdentityLabel } from "@/lib/demo-identity";
// 只把角色名称交给界面，旧复核记录仍保留原账号 ID，便于追溯。
function publicIdentity(user:{id:string;role:string}|null) {
  return user ? {id:user.id,name:demoIdentityLabel(user.role)} : null;
}
function metricPoints(run:StoredRun,scenarioKey?:string):MetricPoint[] {
  return run.metricResults.filter(m=>!scenarioKey||m.scenarioKey===scenarioKey).map(m=>({key:m.metricDefinition.key,name:m.metricDefinition.name,unit:m.metricDefinition.unit,
    direction:m.metricDefinition.direction,scenarioKey:m.scenarioKey,value:Number(m.value),sampleCount:m.sampleCount}));
}
function sampleDto(sample:StoredSample):SampleData {
  const title=sample.logExcerpt?.includes("label_offset")?"遮挡标签偏移":sample.logExcerpt?.includes("collision_during_grasp")?"遮挡下抓取路径碰撞":"合成异常证据";
  return {id:sample.id,runId:sample.runId,sampleNumber:sample.sampleNumber,scenarioKey:sample.scenarioKey,metricKey:sample.metricKey,anomalyType:sample.anomalyType,status:sample.status,version:sample.version,title,
    logExcerpt:sample.logExcerpt,mediaPath:sample.mediaPath,conclusion:sample.conclusion,draftConclusion:sample.draftConclusion,draftUpdatedBy:publicIdentity(sample.draftUpdatedBy),
    draftUpdatedAt:sample.draftUpdatedAt?.toISOString()??null,confirmedBy:publicIdentity(sample.confirmedBy),confirmedAt:sample.confirmedAt?.toISOString()??null,confirmedRevision:sample.confirmedRevision,pendingReview:isPendingReview(sample)};
}
function detailDto(value:Awaited<ReturnType<typeof repository.detail>>):SampleDetailData {
  return {sample:sampleDto(value.sample),run:runDto(value.run),staleReportCount:value.staleReportCount,
    history:value.history.map(r=>({id:r.id,mode:r.mode??"legacy",conclusion:r.conclusion,actor:{id:r.reviewer.id,name:demoIdentityLabel(r.reviewer.role),role:r.reviewer.role},createdAt:r.createdAt.toISOString(),fromVersion:r.fromVersion,toVersion:r.toVersion,confirmedRevision:r.confirmedRevision}))};
}
export const comparisonReviewService={
  async comparison(actor:Actor,id:string,baselineId:string|null,scenarioKey?:string):Promise<ComparisonData> {
    const value=await repository.comparison(actor,id,baselineId,scenarioKey);
    const candidate=runDto(value.candidate), baseline=value.baseline?runDto(value.baseline):null;
    return {candidate,baseline,baselines:value.baselines.map(runDto),metrics:compareMetrics(metricPoints(value.candidate,scenarioKey),value.baseline?metricPoints(value.baseline,scenarioKey):null,value.evidence),
      anomalyCount:candidate.anomalyCount,pendingReviewCount:candidate.pendingReviewCount};
  },
  async list(actor:Actor,input:SampleQuery):Promise<SampleListData> {
    const value=await repository.list(actor,input);
    return {data:value.samples.map(sampleDto),total:value.total,run:runDto(value.run),pendingCount:value.all.filter(isPendingReview).length,sampleCount:value.all.length,
      scenarios:[...new Set(value.all.map(s=>s.scenarioKey))],metricKeys:[...new Set(value.all.map(s=>s.metricKey))]};
  },
  async detail(actor:Actor,id:string,runId?:string) { return detailDto(await repository.detail(actor,id,runId)); },
  async review(actor:Actor,id:string,input:ReviewInput) { return detailDto(await repository.review(actor,id,input)); },
};
