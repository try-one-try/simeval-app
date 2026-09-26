// 真实 MySQL 验证事务与并发；只连接独立测试库，只清理本文件创建的记录。
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { parseDatabaseUrl } from "@/lib/database-url";
import type { CreateRunInput, Actor } from "@/domain/evaluation";
vi.mock("server-only",()=>({}));
if(existsSync(".env.local"))process.loadEnvFile(".env.local");
if(existsSync(".env.test.local"))process.loadEnvFile(".env.test.local");
const testUrl=process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)("评测真实数据库事务",()=>{
  let repository:typeof import("@/server/repositories/evaluation-repository").evaluationRepository;
  let service:typeof import("@/server/application/evaluation").evaluationService;
  let db:ReturnType<typeof import("@/server/db").getDb>;
  const original=process.env.DATABASE_URL;
  const ids:string[]=[];
  const actor:Actor={id:"demo-user-engineer",role:"ENGINEER",requestId:"integration-evaluation"};
  const input:CreateRunInput={name:"集成测试任务",modelVersionId:"demo-model-candidate",datasetVersionId:"demo-dataset-scenes-v3",benchmarkId:"demo-benchmark-v1",baselineRunId:"demo-run-baseline",episodeCount:200,simulationSeed:20260901,acceptQualityWarning:true,mockFailure:false};
  const create=async(change:Partial<CreateRunInput>={})=>{const result=await repository.create(actor,{...input,...change},randomUUID());ids.push(result.run.id);return result.run;};
  const at=(run:{createdAt:Date},ms:number)=>new Date(run.createdAt.getTime()+ms);
  beforeAll(async()=>{
    if(!testUrl || parseDatabaseUrl(testUrl).database!=="simeval_test" || testUrl===original)throw new Error("必须使用独立 simeval_test");
    execSync("npm run db:deploy",{env:{...process.env,DATABASE_URL:testUrl},stdio:"pipe",timeout:60000});
    process.env.DATABASE_URL=testUrl;vi.resetModules();await import("../../prisma/seed");
    repository=(await import("@/server/repositories/evaluation-repository")).evaluationRepository;
    service=(await import("@/server/application/evaluation")).evaluationService;
    db=(await import("@/server/db")).getDb();
  },120000);
  afterAll(async()=>{
    if(db){
      await db.$transaction(async(tx)=>{
        await tx.auditLog.deleteMany({where:{entityType:"EvaluationRun",entityId:{in:ids}}});
        await tx.metricResult.deleteMany({where:{runId:{in:ids}}});
        await tx.anomalySample.deleteMany({where:{runId:{in:ids}}});
        await tx.evaluationRun.updateMany({where:{id:{in:ids}},data:{retryOfRunId:null}});
        await tx.evaluationRun.deleteMany({where:{id:{in:ids}}});
      });
      await db.$disconnect();
    }
    if(original===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=original;
  });
  it("并发同键只创建一次，同键不同输入冲突",async()=>{
    const key=randomUUID();
    const results=await Promise.all([repository.create(actor,input,key),repository.create(actor,input,key)]);
    ids.push(results[0].run.id);expect(results[0].run.id).toBe(results[1].run.id);
    expect(results.filter((result)=>!result.replay)).toHaveLength(1);
    await expect(repository.create(actor,{...input,name:"不同输入"},key)).rejects.toMatchObject({status:409});
    expect(await db.auditLog.count({where:{entityId:results[0].run.id,action:"EVALUATION_CREATED"}})).toBe(1);
  });
  it("质量警告、FAILED、权限与同口径都在服务端拦截",async()=>{
    await expect(repository.create(actor,{...input,acceptQualityWarning:false},randomUUID())).rejects.toMatchObject({code:"QUALITY_WARNING_NOT_ACCEPTED"});
    await expect(repository.create({...actor,role:"REVIEWER"},input,randomUUID())).rejects.toMatchObject({status:403});
    await expect(repository.create(actor,{...input,episodeCount:201},randomUUID())).rejects.toMatchObject({code:"INCOMPATIBLE_CONFIGURATION"});
    const id="test-failed-"+randomUUID();
    await db.datasetVersion.create({data:{id,projectId:"demo-project-warehouse",name:"失败测试",version:"test",sampleCount:0,qualityStatus:"FAILED"}});
    try{await expect(repository.create(actor,{...input,datasetVersionId:id},randomUUID())).rejects.toMatchObject({code:"DATASET_QUALITY_BLOCKED"});}
    finally{await db.datasetVersion.delete({where:{id}});}
  });
  it("GET 不推进，并发同步只保存一次指标、异常和状态审计",async()=>{
    const run=await create();
    expect((await service.get(actor,run.id)).status).toBe("QUEUED");
    expect((await service.get(actor,run.id)).status).toBe("QUEUED");
    expect((await repository.sync(actor,run.id,at(run,3000))).status).toBe("RUNNING");
    const results=await Promise.all([1,2,3].map(()=>repository.sync(actor,run.id,at(run,13000))));
    expect(results.every((result)=>result.status==="SUCCEEDED")).toBe(true);
    expect(await db.metricResult.count({where:{runId:run.id}})).toBe(4);
    expect(await db.anomalySample.count({where:{runId:run.id,status:"OPEN"}})).toBe(2);
    expect(await db.auditLog.count({where:{entityId:run.id}})).toBe(3);
    const success=await db.metricResult.findFirst({where:{runId:run.id,metricDefinition:{key:"success_rate"}}});expect(Number(success?.value)).toBe(81);
    await expect(repository.cancel(actor,run.id)).rejects.toMatchObject({status:409});
  });
  it("取消后不生成结果，固定故事不能取消",async()=>{
    const run=await create();expect((await repository.cancel(actor,run.id)).status).toBe("CANCELLED");
    expect((await repository.sync(actor,run.id,at(run,13000))).status).toBe("CANCELLED");
    expect(await db.metricResult.count({where:{runId:run.id}})).toBe(0);
    await expect(repository.cancel(actor,"demo-run-candidate")).rejects.toMatchObject({status:409});
  });
  it("失败重试创建新任务，原失败记录保留，重复重试返回相同记录",async()=>{
    const run=await create({mockFailure:true});
    await repository.sync(actor,run.id,at(run,3000));
    expect((await repository.sync(actor,run.id,at(run,13000))).status).toBe("FAILED");
    const key=randomUUID();const next=await repository.retry(actor,run.id,key);ids.push(next.run.id);
    expect(next.run.id).not.toBe(run.id);expect(next.run.retryOfRunId).toBe(run.id);expect(next.run.mockFailure).toBe(false);
    expect((await repository.retry(actor,run.id,key)).run.id).toBe(next.run.id);
    expect((await repository.get(run.id))?.status).toBe("FAILED");
    expect(await db.metricResult.count({where:{runId:run.id}})).toBe(0);
  });
  it("取消与完成竞争只有一个终态，事务不会留下半套结果",async()=>{
    const run=await create();await repository.sync(actor,run.id,at(run,3000));
    const outcomes=await Promise.allSettled([repository.sync(actor,run.id,at(run,13000)),repository.cancel(actor,run.id,at(run,13000))]);
    expect(outcomes.some((outcome)=>outcome.status==="fulfilled")).toBe(true);
    const latest=await repository.get(run.id);expect(["SUCCEEDED","CANCELLED"]).toContain(latest?.status);
    expect(await db.metricResult.count({where:{runId:run.id}})).toBe(latest?.status==="SUCCEEDED"?4:0);
    expect(await db.anomalySample.count({where:{runId:run.id}})).toBe(latest?.status==="SUCCEEDED"?2:0);
    expect(await db.auditLog.count({where:{entityId:run.id,action:{in:["EVALUATION_SUCCEEDED","EVALUATION_CANCELLED"]}}})).toBe(1);
  });
});
