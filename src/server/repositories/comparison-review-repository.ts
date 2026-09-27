// 证据读取与复核事务：锁任务可见性，再用样本版本防覆盖；历史、审计、过时标记原子保存。
import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/server/db";
import { includeRun } from "./evaluation-repository";
import { AppError, assertRole, type Actor } from "@/domain/evaluation";
import { assertComparable, assertReview, type ReviewInput, type SampleQuery } from "@/domain/comparison-review";
export const includeSample = { draftUpdatedBy:{select:{id:true,name:true}}, confirmedBy:{select:{id:true,name:true}} } as const;
export type StoredSample = Prisma.AnomalySampleGetPayload<{include:typeof includeSample}>;
async function run(id:string) {
  const value=await getDb().evaluationRun.findFirst({where:{id,deletedAt:null},include:includeRun});
  if(!value) throw new AppError("NOT_FOUND","评测任务不存在",404);
  if(value.status!=="SUCCEEDED") throw new AppError("STATE_CONFLICT","评测完成后才能查看指标与证据",409);
  return value;
}
const readers=["ENGINEER","REVIEWER"] as const;
export const comparisonReviewRepository = {
  async comparison(actor:Actor,id:string,baselineId:string|null,scenarioKey?:string) {
    assertRole(actor,["ENGINEER"]);
    const candidate=await run(id);
    const baseline=baselineId ? await getDb().evaluationRun.findFirst({where:{id:baselineId,...(candidate.baselineRunId===baselineId?{}:{deletedAt:null})},include:includeRun}):null;
    if(baselineId && !baseline) throw new AppError("NOT_FOUND","比较基线不存在或已隐藏",404);
    if(baseline) assertComparable(candidate,baseline);
    const [baselines,evidence]=await Promise.all([
      getDb().evaluationRun.findMany({where:{deletedAt:null,status:"SUCCEEDED",projectId:candidate.projectId,datasetVersionId:candidate.datasetVersionId,benchmarkId:candidate.benchmarkId,
        episodeCount:candidate.episodeCount,simulationSeed:candidate.simulationSeed,modelVersionId:{not:candidate.modelVersionId}},include:includeRun,orderBy:[{createdAt:"desc"},{id:"desc"}]}),
      getDb().anomalySample.findMany({where:{runId:id,...(scenarioKey?{scenarioKey}:{})},select:{metricKey:true,scenarioKey:true}}),
    ]);
    return {candidate,baseline,baselines,evidence};
  },
  async list(actor:Actor,input:SampleQuery) {
    assertRole(actor,readers); const selected=await run(input.runId);
    const where:Prisma.AnomalySampleWhereInput={runId:input.runId,...(input.metricKey?{metricKey:input.metricKey}:{}),...(input.scenarioKey?{scenarioKey:input.scenarioKey}:{}),
      ...(input.status?{status:input.status}:{}),...(input.reviewState==="pending"?{OR:[{status:{not:"RESOLVED"}},{draftConclusion:{not:null}}]}:input.reviewState==="confirmed"?{AND:[{status:"RESOLVED",draftConclusion:null}]}:{} )};
    const [samples,total,all]=await Promise.all([
      getDb().anomalySample.findMany({where,include:includeSample,orderBy:[{sampleNumber:"asc"},{id:"asc"}],skip:(input.page-1)*input.pageSize,take:input.pageSize}),
      getDb().anomalySample.count({where}),
      getDb().anomalySample.findMany({where:{runId:input.runId},select:{metricKey:true,scenarioKey:true,status:true,draftConclusion:true}}),
    ]);
    return {samples,total,run:selected,all};
  },
  async detail(actor:Actor,id:string,runId?:string) {
    assertRole(actor,readers);
    const sample=await getDb().anomalySample.findUnique({where:{id},include:includeSample});
    if(!sample || runId && sample.runId!==runId) throw new AppError("NOT_FOUND","样本不存在或不属于当前任务",404);
    const selected=await run(sample.runId);
    const [history,staleReportCount]=await Promise.all([
      getDb().reviewRecord.findMany({where:{anomalySampleId:id},include:{reviewer:{select:{id:true,name:true,role:true}}},orderBy:[{createdAt:"desc"},{id:"desc"}]}),
      getDb().aIReport.count({where:{isStale:true,OR:[{runId:sample.runId},{baselineRunId:sample.runId}]}}),
    ]);
    return {sample,run:selected,history,staleReportCount};
  },
  async review(actor:Actor,id:string,input:ReviewInput) {
    assertRole(actor,readers);
    await getDb().$transaction(async tx=>{
      const identity=await tx.anomalySample.findUnique({where:{id},select:{runId:true}});
      if(!identity) throw new AppError("NOT_FOUND","样本不存在",404);
      // 和任务删除使用同一行锁，防止隐藏后仍然提交复核。
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "EvaluationRun" WHERE id = ${identity.runId} FOR UPDATE`);
      const selected=await tx.evaluationRun.findUnique({where:{id:identity.runId}});
      if(!selected || selected.deletedAt) throw new AppError("NOT_FOUND","任务已隐藏，不能继续复核",404);
      if(selected.status!=="SUCCEEDED") throw new AppError("STATE_CONFLICT","任务完成后才能复核",409);
      assertReview(actor,selected.createdById,input.mode);
      const sample=await tx.anomalySample.findUniqueOrThrow({where:{id}});
      if(sample.version!==input.expectedVersion) throw new AppError("VERSION_CONFLICT","结论已被更新。当前输入已保留，请读取最新内容后核对。",409);
      const now=new Date(), confirmed=input.mode==="confirm";
      const changed=confirmed && sample.conclusion!==input.conclusion;
      const revision=sample.confirmedRevision+(changed?1:0);
      // 已确认内容的相同草稿无需待办；新草稿不会修改已确认状态或报告。
      const draft=confirmed || input.conclusion===sample.conclusion ? null : input.conclusion;
      const nextStatus=confirmed?"RESOLVED":sample.status==="RESOLVED"?"RESOLVED":"IN_REVIEW";
      const updated=await tx.anomalySample.updateMany({where:{id,version:input.expectedVersion},data:{
        version:{increment:1},status:nextStatus,
        ...(confirmed?{conclusion:input.conclusion,confirmedRevision:revision,confirmedById:actor.id,confirmedAt:now,resolvedAt:now}:{}),
        draftConclusion:draft,draftUpdatedById:draft?actor.id:null,draftUpdatedAt:draft?now:null,
      }});
      if(updated.count!==1) throw new AppError("VERSION_CONFLICT","结论已被更新，请读取最新内容后核对。",409);
      await tx.reviewRecord.create({data:{anomalySampleId:id,reviewerId:actor.id,fromStatus:sample.status,toStatus:nextStatus,conclusion:input.conclusion,mode:input.mode,
        fromVersion:sample.version,toVersion:sample.version+1,confirmedRevision:revision,createdAt:now}});
      const affected=changed ? await tx.aIReport.updateMany({where:{isStale:false,OR:[{runId:sample.runId},{baselineRunId:sample.runId}]},data:{isStale:true,staleAt:now}}):{count:0};
      await tx.auditLog.create({data:{actorId:actor.id,requestId:actor.requestId??randomUUID(),action:confirmed?"ANOMALY_CONFIRMED":"ANOMALY_DRAFT_SAVED",entityType:"AnomalySample",entityId:id,
        metadata:{fromVersion:sample.version,toVersion:sample.version+1,confirmedRevision:revision,confirmedContentChanged:changed,staleReports:affected.count}}});
    },{isolationLevel:"ReadCommitted",timeout:15000,maxWait:10000});
    return this.detail(actor,id);
  },
};
