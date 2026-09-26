// 领域测试覆盖门禁、口径、权限与状态，避免只复述实现。
import { describe, expect, it, vi } from "vitest";
import { assertQuality, assertConfiguration, assertMutable, createRunSchema, type CreateRunInput } from "@/domain/evaluation";
vi.mock("server-only", () => ({}));
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
describe("任务操作", () => {
  const run = {createdById:"owner",isDemoFixture:false,status:"RUNNING" as const};
  it("取消只允许拥有者或管理员，固定故事和终态不修改", () => {
    expect(() => assertMutable({id:"owner",role:"ENGINEER"},run,"cancel")).not.toThrow();
    expect(() => assertMutable({id:"admin",role:"ADMIN"},run,"cancel")).not.toThrow();
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
    expect(provider.nextStatus(task,now(1999))).toBe("QUEUED");
    expect(provider.nextStatus(task,now(2000))).toBe("RUNNING");
    expect(provider.nextStatus({...task,status:"RUNNING"},now(11999))).toBe("RUNNING");
    expect(provider.nextStatus({...task,status:"RUNNING"},now(12000))).toBe("SUCCEEDED");
    expect(provider.nextStatus({...task,status:"RUNNING",mockFailure:true},now(12000))).toBe("FAILED");
    for(const status of ["SUCCEEDED","FAILED","CANCELLED"] as const) expect(provider.nextStatus({...task,status},now(99999))).toBe(status);
  });
  it("确定性合成结果保留基线的指标、场景和样本口径", () => {
    const metrics=[{metricDefinitionId:"m",key:"success_rate",scenarioKey:"overall",sampleCount:200,value:76},{metricDefinitionId:"c",key:"collision_rate",scenarioKey:"occlusion",sampleCount:50,value:8}];
    expect(provider.results(metrics)).toEqual([{...metrics[0],value:81},{...metrics[1],value:13}]);
    expect(metrics[0].value).toBe(76);
  });
});
