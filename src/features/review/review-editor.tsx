"use client";
// 原生弹层约束焦点；版本冲突保留输入，读取最新内容不会替换正在编辑的文字。
import { useRef,useState } from "react";
import type { Actor } from "@/domain/evaluation";
import type { SampleDetailData } from "@/lib/review-dto";
import { reviewExample } from "@/lib/review-example";
import { apiRequest,ClientError,errorText } from "@/lib/api-client";
export function ReviewEditor({detail,actor,onSaved}:{detail:SampleDetailData;actor:Actor;onSaved:(data:SampleDetailData)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),textarea=useRef<HTMLTextAreaElement>(null);
  const [text,setText]=useState(""),[mode,setMode]=useState<"draft"|"confirm">(actor.role==="REVIEWER"?"confirm":"draft");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[conflict,setConflict]=useState(false),[message,setMessage]=useState("");
  const canEdit=actor.role==="REVIEWER"||actor.id===detail.run.createdById;
  function open(){setText(detail.sample.draftConclusion??detail.sample.conclusion??"");setError("");setConflict(false);setMessage("");dialog.current?.showModal();textarea.current?.focus();}
  async function save() {
    if(busy||!text.trim()) return;
    setBusy(true);setError("");
    try{const data=await apiRequest<SampleDetailData>("/api/anomaly-samples/"+detail.sample.id+"/review",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({conclusion:text.trim(),mode,expectedVersion:detail.sample.version})});onSaved(data);dialog.current?.close();setMessage(mode==="confirm"?"最终结论已确认，历史已保存。":"草稿已保存；最终结论保持不变。");}
    catch(failure){setError(errorText(failure));setConflict(failure instanceof ClientError&&failure.status===409);}
    finally{setBusy(false);}
  }
  async function latest(){
    setBusy(true);
    try{const data=await apiRequest<SampleDetailData>("/api/anomaly-samples/"+detail.sample.id+"?runId="+detail.run.id);onSaved(data);setConflict(false);setError("");setMessage("已读取最新记录；下方仍是你的输入，请核对最新结论后再保存。");}
    catch(failure){setError(errorText(failure));}finally{setBusy(false);}
  }
  return <>
    <button ref={trigger} className="text-action inline-link edit-conclusion" disabled={!canEdit} onClick={open}>编辑／修改结论 ↗</button>
    {!canEdit&&<p className="fine-print">工程师只能编辑本人任务草稿。</p>}
    {message&&<p className="review-message" role="status">{message}</p>}
    <dialog ref={dialog} className="confirm-dialog review-dialog" aria-labelledby="review-edit-title" onCancel={e=>{if(busy)e.preventDefault();}} onClose={()=>trigger.current?.focus()}>
      <div className="identity-dialog-heading"><h2 id="review-edit-title">编辑复核结论</h2><button className="text-action" disabled={busy} onClick={()=>dialog.current?.close()}>关闭 ×</button></div>
      <p className="fine-print">{detail.sample.sampleNumber} · {detail.run.name} · 编辑版本 {detail.sample.version}</p>
      <div className="latest-conclusion"><p className="fine-print">最新已确认结论</p><p>{detail.sample.conclusion??"尚未确认"}</p></div>
      {actor.role==="REVIEWER"?<fieldset className="review-mode" disabled={busy}><legend>保存方式</legend><label><input type="radio" name="reviewMode" checked={mode==="draft"} onChange={()=>setMode("draft")}/>仅保存草稿</label><label><input type="radio" name="reviewMode" checked={mode==="confirm"} onChange={()=>setMode("confirm")}/>确认最终结论</label></fieldset>:<p className="muted">本次保存为草稿，最终结论需评测人员确认。</p>}
      <div className="review-demo-actions"><button className="text-action inline-link" disabled={busy} onClick={()=>{setText(reviewExample(detail.sample.logExcerpt));textarea.current?.focus();}}>填入演示结论 ↗</button><p className="fine-print">替换当前输入，仅填表示例；可修改后再保存。</p></div>
      <label className="review-text-label">结论与处理建议<textarea ref={textarea} rows={7} maxLength={4000} disabled={busy} value={text} onChange={e=>setText(e.target.value)} placeholder="结合日志写明判断依据、仍不确定的地方，以及后续处理建议。"/></label><p className="fine-print">{text.length} / 4000 字</p>
      {error&&<p className="request-error" role="alert">{error}</p>}{conflict&&<button className="text-action inline-link" disabled={busy} onClick={latest}>读取最新内容，保留我的输入 ↗</button>}
      {message&&<p className="review-message" role="status">{message}</p>}
      <div className="workflow-actions"><button className="primary-button" disabled={busy||!text.trim()||conflict} onClick={save}>{busy?"正在处理…":mode==="confirm"?"确认最终结论":"保存复核草稿"}</button><button className="text-action" disabled={busy} onClick={()=>dialog.current?.close()}>取消</button></div>
      <p className="fine-print">{mode==="confirm"?"修改最终内容会使关联旧报告过时；原确认和修改历史保留。":"草稿与已确认结论分开保存，不会覆盖最终内容。"}</p>
    </dialog>
  </>;
}
