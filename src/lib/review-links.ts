// 跨页只携带已知业务筛选，不接受任意外部返回地址。
export type EvidenceContext={metricKey?:string;scenarioKey?:string;reviewState?:string;baselineRunId?:string};
export function evidenceHref(runId:string,context:EvidenceContext={},sampleId?:string) {
  const query=new URLSearchParams({runId});
  for(const key of ["metricKey","scenarioKey","reviewState","baselineRunId"] as const) if(context[key]!==undefined) query.set(key,context[key]!);
  return (sampleId?"/anomalies/"+encodeURIComponent(sampleId):"/anomalies")+"?"+query;
}
export function comparisonHref(runId:string,baselineRunId?:string) {return "/comparisons?"+new URLSearchParams({runId,...(baselineRunId===undefined?{}:{baselineRunId})});}
export function scenarioLabel(key:string) {return key==="__overall__"?"总体":key==="occlusion"?"遮挡场景":key;}
