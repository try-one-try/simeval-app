// 独立 PostgreSQL 验证复核事务、并发和旧报告标记；仅清理本文件的任务。
import {existsSync} from "node:fs";
import {execSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {beforeAll,afterAll,describe,it,expect,vi} from "vitest";
import {parseDatabaseUrl} from "@/lib/database-url";
import type {Actor,CreateRunInput} from "@/domain/evaluation";
vi.mock("server-only",()=>({}));
if(existsSync(".env.local"))process.loadEnvFile(".env.local");
if(existsSync(".env.test.local"))process.loadEnvFile(".env.test.local");
const testUrl=process.env.TEST_DATABASE_URL,original=process.env.DATABASE_URL;
describe.skipIf(!testUrl)("对比与复核真实数据库",()=>{
 let db:ReturnType<typeof import("@/server/db").getDb>;
 let repo:typeof import("@/server/repositories/comparison-review-repository").comparisonReviewRepository;
 let evaluation:typeof import("@/server/repositories/evaluation-repository").evaluationRepository;
 const ids:string[]=[];
 const engineer:Actor={id:"demo-user-engineer",role:"ENGINEER",requestId:"review-integration"};
 const reviewer:Actor={id:"demo-user-reviewer",role:"REVIEWER",requestId:"review-integration"};
 const input:CreateRunInput={name:"复核集成测试",modelVersionId:"demo-model-candidate",datasetVersionId:"demo-dataset-scenes-v3",benchmarkId:"demo-benchmark-v1",baselineRunId:"demo-run-baseline",episodeCount:200,simulationSeed:20260901,acceptQualityWarning:true,mockFailure:false};
 async function fixture(){
  const {run}=await evaluation.create(engineer,input,randomUUID());ids.push(run.id);
  await evaluation.sync(engineer,run.id,new Date(run.createdAt.getTime()+3000));
  await evaluation.sync(engineer,run.id,new Date(run.createdAt.getTime()+13000));
  const sample=await db.anomalySample.findFirstOrThrow({where:{runId:run.id}});
  return {run,sample};
 }
 beforeAll(async()=>{
  if(!testUrl||parseDatabaseUrl(testUrl).database!=="simeval_test"||testUrl===original)throw new Error("必须使用独立测试库");
  execSync("npm run db:deploy",{env:{...process.env,DATABASE_URL:testUrl,DIRECT_URL:testUrl,DATABASE_URL_UNPOOLED:testUrl},stdio:"pipe",timeout:60000});
  process.env.DATABASE_URL=testUrl;vi.resetModules();
  db=(await import("@/server/db")).getDb();
  const {seedDefaultData}=await import("../../prisma/seed-data");
  if(!process.env.DEMO_PASSWORD)throw new Error("DEMO_PASSWORD is required");
  await db.$transaction(tx=>seedDefaultData(tx,process.env.DEMO_PASSWORD!),{timeout:60_000});
  db=(await import("@/server/db")).getDb();repo=(await import("@/server/repositories/comparison-review-repository")).comparisonReviewRepository;
  evaluation=(await import("@/server/repositories/evaluation-repository")).evaluationRepository;
 },120000);
 afterAll(async()=>{
  if(db){
   const samples=await db.anomalySample.findMany({where:{runId:{in:ids}},select:{id:true}}),sampleIds=samples.map(s=>s.id);
   await db.$transaction(async tx=>{
    await tx.auditLog.deleteMany({where:{entityId:{in:[...ids,...sampleIds]}}});
    await tx.aIReport.deleteMany({where:{runId:{in:ids}}});
    await tx.reviewRecord.deleteMany({where:{anomalySampleId:{in:sampleIds}}});
    await tx.metricResult.deleteMany({where:{runId:{in:ids}}});
    await tx.anomalySample.deleteMany({where:{runId:{in:ids}}});
    await tx.evaluationRun.deleteMany({where:{id:{in:ids}}});
   });await db.$disconnect();
  }
  if(original===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=original;
 });
 it("草稿、确认和修改原子保存；同内容确认不重复增加修订号",async()=>{
  const {run,sample}=await fixture();
  const report=await db.aIReport.create({data:{runId:run.id,baselineRunId:"demo-run-baseline",provider:"TestCache",model:"synthetic",requestedById:engineer.id,inputSnapshot:{synthetic:true},output:{summary:"测试报告"},status:"CONFIRMED"}});
  const draft=await repo.review(engineer,sample.id,{conclusion:"工程师草稿",mode:"draft",expectedVersion:1});
  expect(draft.sample).toMatchObject({conclusion:null,draftConclusion:"工程师草稿",status:"IN_REVIEW",version:2,confirmedRevision:0});
  expect((await db.aIReport.findUniqueOrThrow({where:{id:report.id}})).isStale).toBe(false);
  await expect(repo.review(engineer,sample.id,{conclusion:"越权确认",mode:"confirm",expectedVersion:2})).rejects.toMatchObject({status:403});
  const confirmed=await repo.review(reviewer,sample.id,{conclusion:"确认结论",mode:"confirm",expectedVersion:2});
  expect(confirmed.sample).toMatchObject({conclusion:"确认结论",draftConclusion:null,status:"RESOLVED",version:3,confirmedRevision:1,confirmedById:reviewer.id});
  expect((await db.aIReport.findUniqueOrThrow({where:{id:report.id}})).isStale).toBe(true);
  await db.aIReport.update({where:{id:report.id},data:{isStale:false,staleAt:null}});
  const same=await repo.review(reviewer,sample.id,{conclusion:"确认结论",mode:"confirm",expectedVersion:3});
  expect(same.sample.confirmedRevision).toBe(1);expect((await db.aIReport.findUniqueOrThrow({where:{id:report.id}})).isStale).toBe(false);
  const edit=await repo.review(engineer,sample.id,{conclusion:"新草稿",mode:"draft",expectedVersion:4});
  expect(edit.sample).toMatchObject({conclusion:"确认结论",draftConclusion:"新草稿",status:"RESOLVED",confirmedRevision:1});
  const pending=await repo.list(reviewer,{runId:run.id,reviewState:"pending",page:1,pageSize:20});expect(pending.samples.some(s=>s.id===sample.id)).toBe(true);
  const changed=await repo.review(reviewer,sample.id,{conclusion:"修正结论",mode:"confirm",expectedVersion:5});
  expect(changed.sample.confirmedRevision).toBe(2);expect(changed.history).toHaveLength(5);
  expect(await db.auditLog.count({where:{entityId:sample.id}})).toBe(5);
  expect((await db.aIReport.findUniqueOrThrow({where:{id:report.id}})).isStale).toBe(true);
 });
 it("同版本并发只有一次成功，失败提交不追加历史或审计",async()=>{
  const {sample}=await fixture();
  const results=await Promise.allSettled(["A","B"].map(conclusion=>repo.review(reviewer,sample.id,{conclusion,mode:"confirm",expectedVersion:1})));
  expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
  expect(results.find(r=>r.status==="rejected")).toMatchObject({reason:{code:"VERSION_CONFLICT",status:409}});
  const saved=await db.anomalySample.findUniqueOrThrow({where:{id:sample.id}});expect(saved.version).toBe(2);
  expect(await db.reviewRecord.count({where:{anomalySampleId:sample.id}})).toBe(1);
  expect(await db.auditLog.count({where:{entityId:sample.id}})).toBe(1);
 });
 it("证据只读、父任务校验、角色与隐藏任务在服务端拦截",async()=>{
  const {run,sample}=await fixture();
  await expect(repo.detail(engineer,sample.id,"demo-run-baseline")).rejects.toMatchObject({status:404});
  await repo.detail(reviewer,sample.id);await repo.detail(reviewer,sample.id);
  expect((await db.anomalySample.findUniqueOrThrow({where:{id:sample.id}})).version).toBe(1);
  await expect(repo.review({...engineer,id:reviewer.id},sample.id,{conclusion:"他人任务",mode:"draft",expectedVersion:1})).rejects.toMatchObject({status:403});
  await expect(repo.comparison(reviewer,run.id,null)).rejects.toMatchObject({status:403});
  await evaluation.remove(engineer,run.id);
  await expect(repo.detail(reviewer,sample.id)).rejects.toMatchObject({status:404});
  await expect(repo.review(reviewer,sample.id,{conclusion:"隐藏任务",mode:"confirm",expectedVersion:1})).rejects.toMatchObject({status:404});
 });
 it("旧基线引用可继续读取；任意隐藏任务不能重新作为基线",async()=>{
  const result=await repo.comparison(engineer,"demo-run-candidate","demo-run-baseline");
  expect(result.candidate.metricResults).toHaveLength(4);expect(result.evidence).toHaveLength(2);
  const {run}=await fixture();
  await db.evaluationRun.update({where:{id:run.id},data:{modelVersionId:"demo-model-v25",deletedAt:new Date()}});
  await expect(repo.comparison(engineer,"demo-run-candidate",run.id)).rejects.toMatchObject({status:404});
  await db.evaluationRun.update({where:{id:"demo-run-baseline"},data:{deletedAt:new Date()}});
  try{expect((await repo.comparison(engineer,"demo-run-candidate","demo-run-baseline")).baseline?.id).toBe("demo-run-baseline");}
  finally{await db.evaluationRun.update({where:{id:"demo-run-baseline"},data:{deletedAt:null}});}
 });
});
