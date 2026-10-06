// 真实 PostgreSQL 验证事务与并发；只连接独立测试库，只清理本文件创建的记录。
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from "vitest";
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
  const userIds:string[]=[];
  const actor:Actor={id:"demo-user-engineer",role:"ENGINEER",requestId:"integration-evaluation"};
  const input:CreateRunInput={name:"集成测试任务",modelVersionId:"demo-model-candidate",datasetVersionId:"demo-dataset-scenes-v3",benchmarkId:"demo-benchmark-v1",baselineRunId:"demo-run-baseline",episodeCount:200,simulationSeed:20260901,acceptQualityWarning:true,mockFailure:false};
  const create=async(change:Partial<CreateRunInput>={})=>{const result=await repository.create(actor,{...input,name:input.name+" "+randomUUID(),...change},randomUUID());ids.push(result.run.id);return result.run;};
  const at=(run:{createdAt:Date},ms:number)=>new Date(run.createdAt.getTime()+ms);
  beforeAll(async()=>{
    if(!testUrl || parseDatabaseUrl(testUrl).database!=="simeval_test" || testUrl===original)throw new Error("必须使用独立 simeval_test");
    execSync("npm run db:deploy",{env:{...process.env,DATABASE_URL:testUrl,DIRECT_URL:testUrl,DATABASE_URL_UNPOOLED:testUrl},stdio:"pipe",timeout:60000});
    process.env.DATABASE_URL=testUrl;vi.resetModules();
  db=(await import("@/server/db")).getDb();
  const {seedDefaultData}=await import("../../prisma/seed-data");
  await db.$transaction(tx=>seedDefaultData(tx),{timeout:60_000});
    repository=(await import("@/server/repositories/evaluation-repository")).evaluationRepository;
    service=(await import("@/server/application/evaluation")).evaluationService;
    db=(await import("@/server/db")).getDb();
  },120000);
  afterEach(async()=>{if(db) await db.evaluationRun.updateMany({where:{id:{in:ids},status:{in:["QUEUED","RUNNING"]}},data:{status:"CANCELLED",finishedAt:new Date()}});});
  afterAll(async()=>{
    if(db){
      await db.$transaction(async(tx)=>{
        await tx.auditLog.deleteMany({where:{entityType:"EvaluationRun",entityId:{in:ids}}});
        await tx.metricResult.deleteMany({where:{runId:{in:ids}}});
        await tx.anomalySample.deleteMany({where:{runId:{in:ids}}});
        await tx.evaluationRun.updateMany({where:{id:{in:ids}},data:{retryOfRunId:null,baselineRunId:null}});
        await tx.evaluationRun.deleteMany({where:{id:{in:ids}}});
        await tx.user.deleteMany({where:{id:{in:userIds}}});
      });
      await db.$disconnect();
    }
    if(original===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=original;
  });
  it("并发同键只创建一次，已有同名任务仍先幂等重放，同键不同输入冲突",async()=>{
    const key=randomUUID();
    const requestInput={...input,name:input.name+" "+randomUUID()};
    const results=await Promise.all([repository.create(actor,requestInput,key),repository.create(actor,requestInput,key)]);
    ids.push(results[0].run.id);expect(results[0].run.id).toBe(results[1].run.id);
    expect(results.filter((result)=>!result.replay)).toHaveLength(1);
    const replay=await repository.create(actor,requestInput,key);expect(replay.replay).toBe(true);expect(replay.run.id).toBe(results[0].run.id);
    await expect(repository.create(actor,{...requestInput,name:"不同输入"},key)).rejects.toMatchObject({code:"IDEMPOTENCY_CONFLICT",status:409});
    expect(await db.auditLog.count({where:{entityId:results[0].run.id,action:"EVALUATION_CREATED"}})).toBe(1);
  });
  it("同项目名称去两端空格且不区分大小写，取消仍占名称，软删除后可复用",async()=>{
    const name="Name Check "+randomUUID();
    const run=await create({name:"  "+name+"  ",baselineRunId:null});expect(run.name).toBe(name);
    await repository.cancel(actor,run.id);
    await expect(create({name:"\t"+name.toUpperCase()+"\n",baselineRunId:null})).rejects.toMatchObject({
      code:"RUN_NAME_CONFLICT",status:409,fieldErrors:{name:[expect.any(String)]},
    });
    await repository.remove(actor,run.id);
    const replacement=await create({name:name.toLowerCase(),baselineRunId:null});
    expect(replacement.name).toBe(name.toLowerCase());expect(replacement.id).not.toBe(run.id);
  });
  it("同项目不同工程师、不同幂等键并发提交同名只创建一条",async()=>{
    const id="test-name-engineer-"+randomUUID();
    await db.user.create({data:{id,email:id+"@example.invalid",name:"命名并发测试工程师",role:"ENGINEER",isDemo:false}});userIds.push(id);
    const other:Actor={id,role:"ENGINEER",requestId:"integration-name-conflict"};
    const name="Concurrent Name "+randomUUID();
    const outcomes=await Promise.allSettled([
      repository.create(actor,{...input,name,baselineRunId:null},randomUUID()),
      repository.create(other,{...input,name:" "+name.toLowerCase()+" ",baselineRunId:null},randomUUID()),
    ]);
    const successful=outcomes.flatMap(result=>result.status==="fulfilled"?[result.value]:[]);ids.push(...successful.map(result=>result.run.id));
    expect(successful).toHaveLength(1);expect(successful[0].replay).toBe(false);
    expect(outcomes.find(result=>result.status==="rejected")).toMatchObject({reason:{code:"RUN_NAME_CONFLICT",status:409}});
    expect(await db.evaluationRun.count({where:{projectId:"demo-project-warehouse",name:{equals:name,mode:"insensitive"},deletedAt:null}})).toBe(1);
    expect(await db.auditLog.count({where:{entityId:{in:successful.map(result=>result.run.id)},action:"EVALUATION_CREATED"}})).toBe(1);
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
  it("失败重试使用未占名称和新任务，原失败记录保留，同键重放不改名",async()=>{
    const run=await create({mockFailure:true});
    await repository.sync(actor,run.id,at(run,3000));
    expect((await repository.sync(actor,run.id,at(run,13000))).status).toBe("FAILED");
    const occupied=await create({name:run.name+" · 重试 1"});await repository.cancel(actor,occupied.id);
    const key=randomUUID();const next=await repository.retry(actor,run.id,key);ids.push(next.run.id);
    expect(next.run.id).not.toBe(run.id);expect(next.run.retryOfRunId).toBe(run.id);expect(next.run.mockFailure).toBe(false);
    expect(next.run.name).toBe(run.name+" · 重试 2");
    const replay=await repository.retry(actor,run.id,key);expect(replay.replay).toBe(true);expect(replay.run.id).toBe(next.run.id);expect(replay.run.name).toBe(next.run.name);
    const another=await repository.retry(actor,run.id,randomUUID());ids.push(another.run.id);expect(another.run.name).toBe(run.name+" · 重试 3");
    expect((await repository.get(run.id))?.status).toBe("FAILED");
    expect((await repository.get(run.id))?.name).toBe(run.name);
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
  it("无基线执行、两模型与不同基准产生独立结果，保留目标快照",async()=>{
    const first=await create({baselineRunId:null,targetSuccessRate:.8});
    const second=await create({baselineRunId:null,modelVersionId:"demo-model-v25",benchmarkId:"demo-benchmark-occlusion-v1",episodeCount:300,simulationSeed:42});
    for(const run of [first,second]){await repository.sync(actor,run.id,at(run,3000));await repository.sync(actor,run.id,at(run,13000));}
    const a=await service.get(actor,first.id),b=await service.get(actor,second.id);
    expect(a.baselineRunId).toBeNull();expect(a.targetSuccessRate).toBe(.8);expect(a.metrics.find(m=>m.key==="success_rate")?.value).toBe(81);
    expect(a.metrics).not.toEqual(b.metrics);expect(b.metrics.find(m=>m.key==="collision_rate")?.sampleCount).toBe(300);
    expect(first.configurationSnapshot).toMatchObject({algorithm:"mock-v2",episodeCount:200});
    const passed=await create({baselineRunId:null,datasetVersionId:"demo-dataset-clean-v1",acceptQualityWarning:false});expect(passed.status).toBe("QUEUED");
    await expect(create({baselineRunId:null,datasetVersionId:"demo-dataset-clean-v1",benchmarkId:"demo-benchmark-occlusion-v1"})).rejects.toMatchObject({code:"INCOMPATIBLE_CONFIGURATION"});
  });
  it("不同幂等键并发不能突破三个活跃任务，重复提交不占容量",async()=>{
    const requests=[0,1,2,3].map(()=>({...input,name:input.name+" "+randomUUID(),baselineRunId:null}));
    const keys=requests.map(()=>randomUUID());
    const outcomes=await Promise.allSettled(requests.map((requestInput,index)=>repository.create(actor,requestInput,keys[index])));
    const successful=outcomes.flatMap(o=>o.status==="fulfilled"?[o.value]:[]);ids.push(...successful.map(o=>o.run.id));
    expect(successful).toHaveLength(3);
    const index=outcomes.findIndex(o=>o.status==="fulfilled");expect((await repository.create(actor,requests[index],keys[index])).replay).toBe(true);expect(outcomes.filter(o=>o.status==="rejected")).toHaveLength(1);
    const rejected=outcomes.find(o=>o.status==="rejected");expect(rejected?.status==="rejected" && rejected.reason.code).toBe("TASK_LIMIT_REACHED");
    await repository.cancel(actor,successful[0].run.id);const next=await create({baselineRunId:null});expect(next.status).toBe("QUEUED");
  });
  it("软删除幂等、列表隐藏且外键和结果保留；越权、进行中和示例不能删除",async()=>{
    const first=await create({baselineRunId:null});
    await expect(repository.remove(actor,first.id)).rejects.toMatchObject({status:409});
    await repository.sync(actor,first.id,at(first,3000));await repository.sync(actor,first.id,at(first,13000));
    const linked=await create({modelVersionId:"demo-model-v25",baselineRunId:first.id});
    const failedRef=await create({modelVersionId:"demo-model-v25",baselineRunId:first.id,mockFailure:true});
    await expect(repository.remove({...actor,role:"REVIEWER"},first.id)).rejects.toMatchObject({status:403});
    await expect(repository.remove({...actor,id:"demo-user-reviewer"},first.id)).rejects.toMatchObject({status:403});
    const deleted=await repository.remove(actor,first.id);expect(await repository.remove(actor,first.id)).toEqual(deleted);
    await expect(service.get(actor,first.id)).rejects.toMatchObject({status:404});
    expect((await repository.list({page:1,pageSize:100})).runs.some(r=>r.id===first.id)).toBe(false);
    expect(await db.metricResult.count({where:{runId:first.id}})).toBe(4);expect((await repository.get(linked.id))?.baselineRunId).toBe(first.id);
    expect(await db.auditLog.count({where:{entityId:first.id,action:"EVALUATION_DELETED"}})).toBe(1);
    await expect(repository.remove(actor,"demo-run-candidate")).rejects.toMatchObject({status:409});
    await expect(create({modelVersionId:"demo-model-v25",baselineRunId:first.id})).rejects.toMatchObject({code:"NOT_FOUND"});
    await repository.sync(actor,failedRef.id,at(failedRef,3000));await repository.sync(actor,failedRef.id,at(failedRef,13000));
    const retried=await repository.retry(actor,failedRef.id,randomUUID());ids.push(retried.run.id);expect(retried.run.baselineRunId).toBe(first.id);
    // 已保存快照的任务完成不再读取被隐藏的基线。
    await repository.sync(actor,linked.id,at(linked,3000));expect((await repository.sync(actor,linked.id,at(linked,13000))).status).toBe("SUCCEEDED");
  });

});
