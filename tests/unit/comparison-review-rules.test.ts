// 对比方向、口径与角色规则用纯函数验证，不依赖数据库。
import { expect,it } from "vitest";
import { compareMetrics,assertComparable,assertReview,reviewSchema,sampleQuerySchema,isPendingReview,type MetricPoint } from "@/domain/comparison-review";
const metric:MetricPoint={key:"success_rate",name:"成功率",unit:"%",direction:"HIGHER_IS_BETTER",scenarioKey:"__overall__",value:81,sampleCount:200};
it("百分比差值使用百分点；收益方向随指标定义变化",()=>{
 const result=compareMetrics([metric,{...metric,key:"collision",direction:"LOWER_IS_BETTER",value:13}],[{...metric,value:76},{...metric,key:"collision",direction:"LOWER_IS_BETTER",value:8}],[{metricKey:"collision",scenarioKey:"__overall__"}]);
 expect(result[0]).toMatchObject({delta:5,deltaUnit:"pp",verdict:"IMPROVEMENT"});
 expect(result[1]).toMatchObject({delta:5,verdict:"REGRESSION",evidenceCount:1});
});
it.each([{sampleCount:50},{unit:"s"},{direction:"LOWER_IS_BETTER" as const}])("口径不一致时不计算差值：%j",change=>{
 expect(compareMetrics([metric],[{...metric,...change}],[])[0]).toMatchObject({delta:null,verdict:"NOT_COMPARABLE"});
});
it("缺失、无基线、相同数值不会编造变化",()=>{
 expect(compareMetrics([metric],[],[])[0].verdict).toBe("NOT_COMPARABLE");
 expect(compareMetrics([metric],null,[])[0]).toMatchObject({baselineValue:null,delta:null,verdict:"CURRENT_ONLY"});
 expect(compareMetrics([metric],[metric],[])[0].verdict).toBe("UNCHANGED");
});
it("同一指标的场景互不混算",()=>{
 const values=compareMetrics([metric],[{...metric,scenarioKey:"occlusion"}],[]);
 expect(values).toHaveLength(2);expect(values.every(v=>v.verdict==="NOT_COMPARABLE")).toBe(true);
});
it("任务比较需同口径、不同模型且两侧成功",()=>{
 const run={projectId:"p",datasetVersionId:"d",benchmarkId:"b",modelVersionId:"a",episodeCount:200,simulationSeed:1,status:"SUCCEEDED"};
 expect(()=>assertComparable(run,{...run,modelVersionId:"b"})).not.toThrow();
 for(const change of [{episodeCount:201},{status:"RUNNING"},{modelVersionId:"a"},{simulationSeed:2}])
 expect(()=>assertComparable(run,{...run,modelVersionId:"b",...change})).toThrow();
});
it("只有评测人员能确认；工程师仅能编辑本人任务草稿",()=>{
 const engineer={id:"owner",role:"ENGINEER" as const};
 expect(()=>assertReview(engineer,"owner","draft")).not.toThrow();
 expect(()=>assertReview(engineer,"owner","confirm")).toThrow();
 expect(()=>assertReview(engineer,"other","draft")).toThrow();
 expect(()=>assertReview({id:"reviewer",role:"REVIEWER"},"owner","confirm")).not.toThrow();
});
it("空结论、零版本、额外分类字段被拒绝；筛选默认分页且不接受未知字段",()=>{
 for(const change of [{conclusion:" "},{expectedVersion:0},{category:"DATA_ISSUE"}])
 expect(reviewSchema.safeParse({conclusion:"结论",mode:"draft",expectedVersion:1,...change}).success).toBe(false);
 expect(sampleQuerySchema.parse({runId:"run"})).toMatchObject({page:1,pageSize:20});
 expect(sampleQuerySchema.safeParse({runId:"run",unknown:true}).success).toBe(false);
});
it("已确认样本出现新草稿仍待复核；相同结论无草稿时不待办",()=>{
 expect(isPendingReview({status:"RESOLVED",draftConclusion:"待确认修改"})).toBe(true);
 expect(isPendingReview({status:"RESOLVED",draftConclusion:null})).toBe(false);
 expect(isPendingReview({status:"OPEN"})).toBe(true);
});
