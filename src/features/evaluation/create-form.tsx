"use client";
// 表单负责输入与反馈；质量门禁、权限和同口径约束均由服务端再次验证。
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Actor } from "@/domain/evaluation";
import type { EvaluationOptions, RunData } from "@/lib/evaluation-dto";
import { apiRequest, ClientError, errorText } from "@/lib/api-client";
export function CreateForm({ options, actor }: { options: EvaluationOptions; actor: Actor }) {
  const router = useRouter();
  const firstBaseline = options.baselines[0];
  const [baselineId, setBaselineId] = useState(firstBaseline?.id ?? "");
  const baseline = options.baselines.find((item) => item.id === baselineId);
  const [modelId, setModelId] = useState(options.models.find((item) => item.id !== firstBaseline?.modelVersionId)?.id ?? "");
  const [datasetId, setDatasetId] = useState(firstBaseline?.datasetVersionId ?? options.datasets[0]?.dataset.id ?? "");
  const [benchmarkId, setBenchmarkId] = useState(firstBaseline?.benchmarkId ?? options.benchmarks[0]?.id ?? "");
  const [name, setName] = useState("仓储操作模拟评测");
  const [accepted, setAccepted] = useState(false);
  const [mockFailure, setMockFailure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const submission = useRef<{ body: string; key: string } | null>(null);
  const quality = options.datasets.find((item) => item.dataset.id === datasetId);
  const warning = quality?.dataset.qualityStatus === "WARNING";
  const canWrite = actor.role !== "REVIEWER";
  const compatible = baseline?.datasetVersionId === datasetId && baseline?.benchmarkId === benchmarkId && baseline?.modelVersionId !== modelId;
  const enabled = canWrite && quality?.canStartEvaluation && compatible && (!warning || accepted) && !!modelId && !!baseline;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || !baseline || busy) return;
    const body = JSON.stringify({ name, modelVersionId: modelId, datasetVersionId: datasetId, benchmarkId, baselineRunId: baseline.id, episodeCount: baseline.episodeCount, simulationSeed: baseline.simulationSeed, acceptQualityWarning: accepted, mockFailure });
    // 同一输入的网络重试复用幂等键；输入变化才生成新键。
    if (submission.current?.body !== body) submission.current = { body, key: crypto.randomUUID() };
    setBusy(true); setError(""); setFields({});
    try {
      const run = await apiRequest<RunData>("/api/evaluation-runs", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": submission.current!.key }, body });
      router.push("/evaluations/" + run.id);
    } catch (failure) { setError(errorText(failure)); if (failure instanceof ClientError) setFields(failure.fieldErrors ?? {}); setBusy(false); }
  }
  return <section className="content workflow-content create-view">
    <div className="page-context">创建评测 / 01 配置与确认<span>任务步骤　01 配置与确认　02 任务状态</span></div>
    <div className="overview-heading"><div><h1>创建模拟评测</h1><p className="muted">{options.project?.name ?? "暂无项目"} · 合成数据</p></div><div className="overview-status"><strong>{baseline?.episodeCount ?? "—"} Episodes</strong><p className="muted">Mock Provider · 模拟执行</p></div></div>
    <div className="conclusion"><p>质量前提</p><h2>{!quality ? "暂无可用数据集。" : !quality.canStartEvaluation ? "数据集质量未通过，不能创建评测。" : warning ? quality.checks.filter((item) => item.status === "WARNING").map((item) => item.message).join(" ") : "数据质量通过，可以继续。"}</h2><p className="muted">{warning ? "只有明确了解质量警告后，才能继续提交。" : "配置须与成功基线保持相同口径。"} <Link href="/quality" className="inline-link">查看质量详情 ↗</Link></p></div>
    <form onSubmit={submit}>
      <div className="evaluation-fields">
        <label className="model-field">候选模型<select value={modelId} onChange={(event) => setModelId(event.target.value)} disabled={busy}>{options.models.filter((item) => item.id !== baseline?.modelVersionId).map((item) => <option key={item.id} value={item.id}>{item.name} {item.version}</option>)}</select></label>
        <label className="baseline-field">成功基线<select value={baselineId} onChange={(event) => setBaselineId(event.target.value)} disabled={busy}>{options.baselines.map((item) => <option key={item.id} value={item.id}>{item.modelName} {item.modelVersion} · 已完成</option>)}</select></label>
        <label className="dataset-field">数据集<select value={datasetId} onChange={(event) => { setDatasetId(event.target.value); setAccepted(false); }} disabled={busy}>{options.datasets.map(({ dataset }) => <option key={dataset.id} value={dataset.id}>{dataset.name} {dataset.version}</option>)}</select></label>
        <div className="readonly-field episode-field"><span>Episode 数量</span><p>{baseline?.episodeCount ?? "—"}</p></div>
        <label className="benchmark-field">Benchmark<select value={benchmarkId} onChange={(event) => setBenchmarkId(event.target.value)} disabled={busy}>{options.benchmarks.map((item) => <option key={item.id} value={item.id}>{item.name} {item.version}</option>)}</select></label>
        <div className="readonly-field seed-field"><span>模拟 Seed</span><p>{baseline?.simulationSeed ?? "—"}</p></div>
      </div>
      {!compatible && <p className="risk-text">请选择与成功基线一致的数据集和 Benchmark，以及不同的候选模型。</p>}
      {warning && <label className="warning-consent"><input type="checkbox" checked={accepted} disabled={busy} onChange={(event) => setAccepted(event.target.checked)} />我已了解质量警告，仍继续本次模拟评测。</label>}
      <details className="advanced-settings"><summary>更多设置与故障演示</summary><label>任务名称<input value={name} maxLength={120} required disabled={busy} onChange={(event) => setName(event.target.value)} /></label><label className="warning-consent"><input type="checkbox" checked={mockFailure} disabled={busy} onChange={(event) => setMockFailure(event.target.checked)} />模拟执行失败（仅用于演示失败与重试，不运行真实仿真）</label></details>
      {!canWrite && <p className="risk-text">复核员可查看任务；创建评测需要算法工程师或管理员角色。</p>}
      {error && <div role="alert" className="request-error"><p>{error}</p>{Object.entries(fields).map(([key, values]) => <p key={key}>{values.join("；")}</p>)}<Link href="/" className="inline-link">重新进入演示 ↗</Link></div>}
      <div className="workflow-actions"><button type="submit" disabled={!enabled || busy} className="primary-button">{busy ? "正在创建…" : "创建模拟评测 →"}</button></div>
    </form>
    <p className="fine-print">合成数据 · 结果按固定规则生成；本次任务会独立保存。</p>
    {options.recent.length > 0 && <details className="recent-runs"><summary>最近的任务</summary>{options.recent.map((run) => <Link key={run.id} href={"/evaluations/" + run.id}>{run.name} · {run.status} ↗</Link>)}</details>}
  </section>;
}
