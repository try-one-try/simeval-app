// 跨页只携带已知业务筛选，不接受任意外部返回地址。
export type EvidenceContext={metricKey?:string;scenarioKey?:string;reviewState?:string;baselineRunId?:string};
function taskQuery(runId:string,context:EvidenceContext={}) {
  const query=new URLSearchParams({runId});
  for(const key of ["metricKey","scenarioKey","reviewState","baselineRunId"] as const) if(context[key]!==undefined) query.set(key,context[key]!);
  return query;
}
export function evidenceHref(runId:string,context:EvidenceContext={},sampleId?:string) {
  return (sampleId?"/anomalies/"+encodeURIComponent(sampleId):"/anomalies")+"?"+taskQuery(runId,context);
}
export function reportHref(runId:string,context:EvidenceContext={}) {return "/reports?"+taskQuery(runId,context);}
// undefined 沿用任务原基线；显式空字符串保留用户的“不对比”选择。
export function resultsHref(runId:string,baselineRunId?:string) {return "/evaluations/"+encodeURIComponent(runId)+(baselineRunId===undefined?"":"?"+new URLSearchParams({baselineRunId}));}
export function comparisonHref(runId:string,baselineRunId?:string) {return "/comparisons?"+new URLSearchParams({runId,...(baselineRunId===undefined?{}:{baselineRunId})});}
export function scenarioLabel(key:string) {return key==="__overall__"?"总体":key==="occlusion"?"遮挡场景":key;}
