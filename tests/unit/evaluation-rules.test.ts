// 领域测试覆盖门禁、口径、权限与状态，避免只复述实现。
import { describe, expect, it, vi } from "vitest";
import { assertQuality, assertConfiguration, assertMutable, createRunSchema, resolveRunName, RUN_NAME_MAX_LENGTH, type CreateRunInput } from "@/domain/evaluation";
vi.mock("server-only", () => ({}));
import { configurationProfile, type SimulationSnapshot } from "@/domain/evaluation-catalog";
import { MockEvaluationProvider } from "@/server/providers/evaluation-provider";
const input: CreateRunInput = { name:"评测", modelVersionId:"candidate", datasetVersionId:"dataset", benchmarkId:"benchmark", baselineRunId:"baseline", episodeCount:200, simulationSeed:20260901, acceptQualityWarning:true, mockFailure:false };
const baseline = { projectId:"project", modelVersionId:"old", datasetVersionId:"dataset", benchmarkId:"benchmark", status:"SUCCEEDED", episodeCount:200, simulationSeed:20260901 };
describe("质量与配置门禁", () => {
  it.each([["PASSED",false],["WARNING",true]])("%s 可创建", (status, accepted) => { expect(() => assertQuality(status, accepted)).not.toThrow(); });
  it.each([["WARNING",false],["FAILED",true],["FAILED",false]])("%s 无法绕过门禁", (status, accepted) => { expect(() => assertQuality(status, accepted)).toThrow(); });
  it("只接受同项目、同口径成功基线与不同模型", () => {
    expect(() => assertConfiguration(input,["project","project","project"],baseline)).not.toThrow();
    for (const change of [{simulationSeed:2},{episodeCount:201},{datasetVersionId:"other"},{benchmarkId:"other"},{modelVersionId:"old"}]) expect(() => assertConfiguration({...input,...change},["project"],baseline)).toThrow();
    expect(() => assertConfiguration(input,["other"],baseline)).toThrow();
    expect(() => assertConfiguration(input,["project"],{...baseline,status:"FAILED"})).toThrow();
  });
  it("拒绝越界数字、空名称与额外字段", () => {
    for (const change of [{episodeCount:0},{episodeCount:10001},{simulationSeed:-1},{simulationSeed:1.1},{name:" "},{createdById:"forged"}]) expect(createRunSchema.safeParse({...input,...change}).success).toBe(false);
  });
});
describe("任务命名边界",()=>{
  it("兼容旧名称的空白、大小写和空值，不把不同名称误判为冲突",()=>{
    const existing=[null,"\tWarehouse Check  \n"];
    expect(()=>resolveRunName(" warehouse check ",existing,false)).toThrow("已存在同名任务");
    expect(resolveRunName("  Warehouse Check v2  ",existing,false)).toBe("Warehouse Check v2");
  });
  it("长名称重试保留完整编号，跳过已占用名且不截断 emoji",()=>{
    const base="a".repeat(112)+"😀"+"z".repeat(6);
    expect(base.length).toBe(RUN_NAME_MAX_LENGTH);
    const occupied="A".repeat(112)+" · 重试 1";
    const name=resolveRunName(base,[" "+occupied+" "],true);
    expect(name).toBe("a".repeat(112)+" · 重试 2");
    expect(name.length).toBeLessThanOrEqual(RUN_NAME_MAX_LENGTH);
    expect(createRunSchema.safeParse({...input,name}).success).toBe(true);
    const fullLength=resolveRunName("评".repeat(RUN_NAME_MAX_LENGTH),[],true);
    expect(fullLength.length).toBe(RUN_NAME_MAX_LENGTH);expect(fullLength.endsWith(" · 重试 1")).toBe(true);
  });
});

describe("任务操作", () => {
  const run = {createdById:"owner",isDemoFixture:false,status:"RUNNING" as const};
  it("取消只允许工程师拥有者，固定故事和终态不修改", () => {
    expect(() => assertMutable({id:"owner",role:"ENGINEER"},run,"cancel")).not.toThrow();
    expect(() => assertMutable({id:"admin",role:"ADMIN"},run,"cancel")).toThrow();
    for (const actor of [{id:"other",role:"ENGINEER" as const},{id:"owner",role:"REVIEWER" as const}]) expect(() => assertMutable(actor,run,"cancel")).toThrow();
    expect(() => assertMutable({id:"owner",role:"ENGINEER"},{...run,status:"SUCCEEDED"},"cancel")).toThrow();
    expect(() => assertMutable({id:"owner",role:"ENGINEER"},{...run,isDemoFixture:true},"cancel")).toThrow();
  });
  it("重试只针对失败任务", () => {
    expect(() => assertMutable({id:"owner",role:"ENGINEER"},{...run,status:"FAILED"},"retry")).not.toThrow();
    expect(() => assertMutable({id:"owner",role:"ENGINEER"},run,"retry")).toThrow();
  });
});
describe("模拟 Provider", () => {
  const provider=new MockEvaluationProvider();
  const createdAt=new Date("2026-09-01T00:00:00Z");
  const now=(ms:number)=>new Date(createdAt.getTime()+ms);
  it("按服务器时间推进一段状态，终态稳定", () => {
    const task={status:"QUEUED" as const,createdAt,mockFailure:false};
    expect(provider.nextStatus(task,now(999))).toBe("QUEUED");
    expect(provider.nextStatus(task,now(1000))).toBe("RUNNING");
    expect(provider.nextStatus({...task,status:"RUNNING"},now(3999))).toBe("RUNNING");
    expect(provider.nextStatus({...task,status:"RUNNING"},now(4000))).toBe("SUCCEEDED");
    expect(provider.nextStatus({...task,status:"RUNNING",mockFailure:true},now(4000))).toBe("FAILED");
    for(const status of ["SUCCEEDED","FAILED","CANCELLED"] as const) expect(provider.nextStatus({...task,status},now(99999))).toBe(status);
  });
  const snapshot: SimulationSnapshot = { algorithm:"mock-v2", modelId:"model", datasetId:"dataset", benchmarkId:"benchmark", success:81, collision:13, duration:11.8, intervention:5, difficulty:0, episodeCount:200, simulationSeed:20260901, scenarioKey:"occlusion", scenarioFraction:.25, successRule:"合成规则", metrics:[{id:"s",key:"success_rate"},{id:"c",key:"collision_rate"}] };
  it("无基线也能复现固定故事，并保持总体与场景样本数", () => {
    expect(provider.results(snapshot)).toEqual([{metricDefinitionId:"s",key:"success_rate",scenarioKey:"__overall__",sampleCount:200,value:81},{metricDefinitionId:"c",key:"collision_rate",scenarioKey:"occlusion",sampleCount:50,value:13}]);
    expect(provider.results(snapshot)).toEqual(provider.results({...snapshot}));
  });
  it("模型、难度、Seed、规模确实影响模拟；目标不影响结果",()=>{
    const base=provider.results(snapshot);
    for(const change of [{success:84},{difficulty:6},{simulationSeed:42},{episodeCount:500}]) expect(provider.results({...snapshot,...change})).not.toEqual(base);
  });
});
it("首次无基线合法，跨项目仍拒绝；可空目标与严格字段校验",()=>{
  expect(()=>assertConfiguration({...input,baselineRunId:null},["p","p","p"],null)).not.toThrow();
  expect(()=>assertConfiguration({...input,baselineRunId:null},["p","other"],null)).toThrow();
  expect(createRunSchema.safeParse({...input,baselineRunId:null,targetSuccessRate:.8}).success).toBe(true);
  expect(createRunSchema.safeParse({...input,targetSuccessRate:.9}).success).toBe(false);
});
it("目录不兼容有明确边界；软删除只允许本人终态，预置示例受保护",()=>{
  expect(configurationProfile("demo-model-v25","demo-dataset-clean-v1","demo-benchmark-occlusion-v1")).toBeNull();
  const owner={id:"owner",role:"ENGINEER" as const},run={createdById:"owner",isDemoFixture:false,status:"SUCCEEDED" as const};
  expect(()=>assertMutable(owner,run,"delete")).not.toThrow();
  for(const change of [{status:"RUNNING" as const},{isDemoFixture:true},{createdById:"other"}]) expect(()=>assertMutable(owner,{...run,...change},"delete")).toThrow();
});
