"use client";
// 两步创建保留同一份输入；服务端复查权限、质量、兼容性、任务名和容量。
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RUN_NAME_MAX_LENGTH, type Actor } from "@/domain/evaluation";
import { configurationProfile, CUSTOM_DEMO_RUN_NAME } from "@/domain/evaluation-catalog";
import type { EvaluationOptions, QualityData, RunData } from "@/lib/evaluation-dto";
import { apiRequest, ClientError, errorText } from "@/lib/api-client";
export function CreateForm({ options, actor }: { options: EvaluationOptions; actor: Actor }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [modelId, setModelId] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [benchmarkId, setBenchmarkId] = useState("");
  const [baselineId, setBaselineId] = useState("");
  const [target, setTarget] = useState("");
  const [episodes, setEpisodes] = useState(200);
  const [seed, setSeed] = useState(20260901);
  const [quality, setQuality] = useState<QualityData | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [mockFailure, setMockFailure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const submission = useRef<{ body: string; key: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const benchmark = options.benchmarks.find(b => b.id === benchmarkId);
  const profile = configurationProfile(modelId, datasetId, benchmarkId);
  const compatibleBaselines = options.baselines.filter(b => b.datasetVersionId === datasetId && b.benchmarkId === benchmarkId && b.modelVersionId !== modelId && b.episodeCount === episodes && b.simulationSeed === seed);
  const valid = actor.role === "ENGINEER" && !!name.trim() && !!profile && Number.isInteger(episodes) && episodes >= profile.minEpisodes && episodes <= profile.maxEpisodes && Number.isInteger(seed) && seed >= 0 && seed <= 2147483647;
  const canStart = valid && !!quality?.canStartEvaluation && (quality.dataset.qualityStatus !== "WARNING" || accepted);
  function configurationChanged() { setBaselineId(""); setAccepted(false); setQuality(null); setError(""); }
  function demo() {
    setName(CUSTOM_DEMO_RUN_NAME); setModelId("demo-model-candidate"); setDatasetId("demo-dataset-scenes-v3");
    setBenchmarkId("demo-benchmark-v1"); setEpisodes(200); setSeed(20260901);
    setTarget("0.8"); setBaselineId(""); setAccepted(false); setQuality(null); setError(""); setFields({});
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError(""); setFields({});
    try {
      if (step === 1) {
        setQuality(await apiRequest<QualityData>("/api/datasets/" + datasetId + "/quality"));
        setStep(2); setAccepted(false); requestAnimationFrame(() => heading.current?.focus());
      } else if (canStart) {
        const body = JSON.stringify({ name: name.trim(), modelVersionId: modelId, datasetVersionId: datasetId, benchmarkId, baselineRunId: baselineId || null, targetSuccessRate: target ? Number(target) : null, episodeCount: episodes, simulationSeed: seed, acceptQualityWarning: accepted, mockFailure });
        // 请求失败重试复用同一幂等键，避免同一任务创建两次。
        if (submission.current?.body !== body) submission.current = { body, key: crypto.randomUUID() };
        const run = await apiRequest<RunData>("/api/evaluation-runs", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": submission.current!.key }, body });
        router.push("/evaluations/" + run.id);
        return;
      }
    } catch (failure) {
      setError(errorText(failure));
      if (failure instanceof ClientError) {
        setFields(failure.fieldErrors ?? {});
        if (failure.fieldErrors?.name?.length) {
          // 名称在第一步：保留其他配置，回到这里改名，再重新确认质量。
          setStep(1); setAccepted(false);
          requestAnimationFrame(() => nameInput.current?.focus());
        }
      }
    }
    setBusy(false);
  }
  return <section className="content workflow-content create-view">
    <div className="page-context">创建评测 / {step === 1 ? "配置与确认" : "02 确认数据质量"}<span>01 配置评测　02 确认数据质量</span></div>
    <div className="overview-heading"><div><h1 ref={heading} tabIndex={-1}>{step === 1 ? "创建评测" : "确认所选数据质量"}</h1><p className="muted">{step === 1 ? "先选择测试对象与评测口径，再检查数据质量。" : name}</p></div>
      {step === 1 && <div className="demo-config"><p className="fine-print">快速体验</p><button className="text-action" onClick={demo} disabled={busy}>使用演示配置 ↗</button><p className="fine-print">由你点击填入 · 不会直接创建任务</p></div>}</div>
    <form onSubmit={submit}>
      {step === 1 ? <>
        <div className="evaluation-fields">
          <label className="task-name-field">任务名称 · 必填<input ref={nameInput} name="name" value={name} maxLength={RUN_NAME_MAX_LENGTH} required disabled={busy} placeholder="请输入任务名称" aria-invalid={!!fields.name?.length} aria-describedby={fields.name?.length ? "task-name-hint task-name-error" : "task-name-hint"} onChange={e => {
            setName(e.target.value); setError("");
            setFields(current => { const next = { ...current }; delete next.name; return next; });
          }} /><span id="task-name-hint" className="fine-print">用场景和目的命名，1–120 字；同项目不可重名。</span>{!!fields.name?.length && <span id="task-name-error" className="risk-text">{fields.name.join("；")}</span>}</label>
          <label className="model-field">模型版本<select value={modelId} disabled={busy} required onChange={e => { setModelId(e.target.value); configurationChanged(); }}><option value="">请选择模型版本</option>{options.models.map(m => <option key={m.id} value={m.id}>{m.name} {m.version}</option>)}</select><span className="fine-print">选择要测试的候选模型</span></label>
          <div className="readonly-field success-rule-field"><span>成功判定规则</span><p>{benchmark?.successRule ?? "选择 Benchmark 后查看成功规则"}</p></div>
          <label className="dataset-field">数据集版本<select value={datasetId} disabled={busy} required onChange={e => { setDatasetId(e.target.value); configurationChanged(); }}><option value="">请选择数据集版本</option>{options.datasets.map(({ dataset: d }) => <option key={d.id} value={d.id}>{d.name} {d.version} · {d.qualityStatus}</option>)}</select><span className="fine-print">合成样本；质量确认在下一步</span></label>
          <label className="goal-field">达标阈值 · 可选<select value={target} disabled={busy} onChange={e => setTarget(e.target.value)}><option value="">不设置达标阈值</option><option value="0.8">总体成功率 ≥ 80%</option><option value="0.85">总体成功率 ≥ 85%</option></select><span className="fine-print">这是目标，不是历史比较基线</span></label>
          <label className="benchmark-field">Benchmark · 评测基准<select value={benchmarkId} disabled={busy} required onChange={e => { setBenchmarkId(e.target.value); configurationChanged(); }}><option value="">请选择 Benchmark</option>{options.benchmarks.map(b => <option key={b.id} value={b.id}>{b.name} {b.version}</option>)}</select><span className="fine-print">定义测试场景、指标和成功规则</span></label>
          <label className="baseline-field">对比基线 · 可选<select value={baselineId} disabled={busy} onChange={e => setBaselineId(e.target.value)}><option value="">不对比历史结果</option>{compatibleBaselines.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select><span className="fine-print">{compatibleBaselines.length ? "仅显示同口径、不同模型的成功任务" : "暂无兼容历史结果；首次评测可不选"}</span></label>
        </div>
        {!!modelId && !!datasetId && !!benchmarkId && !profile && <p className="risk-text" role="alert">所选数据集不支持此 Benchmark，请修改配置。</p>}
        <details className="advanced-settings"><summary>运行参数 · 推荐 200 Episodes · 固定 Seed</summary>
          <div className="evaluation-fields"><label>Episode 数量<input type="number" value={episodes} min={profile?.minEpisodes ?? 50} max={profile?.maxEpisodes ?? 1000} step="1" disabled={busy} onChange={e => { setEpisodes(Number(e.target.value)); configurationChanged(); }} /><span>{profile ? profile.minEpisodes + "–" + profile.maxEpisodes : "选择目录后确定范围"}</span></label>
          <label>模拟 Seed<input type="number" value={seed} min="0" max="2147483647" step="1" disabled={busy} onChange={e => { setSeed(Number(e.target.value)); configurationChanged(); }} /><span>相同配置与 Seed 复现相同结果</span></label></div>
          <label className="warning-consent"><input type="checkbox" checked={mockFailure} disabled={busy} onChange={e => setMockFailure(e.target.checked)} />模拟执行失败（演示重试流程）</label>
        </details>
      </> : quality && <>
        <p className="selected-task-name">{quality.dataset.name} {quality.dataset.version}</p>
        <div className="conclusion"><p>{quality.dataset.qualityStatus === "FAILED" ? "质量未通过 · 暂不能执行" : quality.dataset.qualityStatus === "WARNING" ? "质量警告 · 需要确认" : "质量通过"}</p><h2>{quality.dataset.qualityStatus === "FAILED" ? "请返回选择可用数据，或等待质量问题修复。" : quality.dataset.qualityStatus === "WARNING" ? "了解质量风险后，再启动本次评测。" : "所选数据可以用于本次模拟评测。"}</h2></div>
        <div className="quality-rows">{quality.checks.map(c => <div className="quality-row" key={c.key}><div><h2>{c.name}</h2><p className="muted">{c.message}</p></div><p className={c.status === "PASSED" ? "" : "risk-text"}>{c.status}</p></div>)}</div>
        <p className="fine-print quality-caption">预置质量报告 · 合成数据 · 不是实时扫描</p>
        {quality.dataset.qualityStatus === "WARNING" && <label className="warning-consent"><input type="checkbox" checked={accepted} disabled={busy} onChange={e => setAccepted(e.target.checked)} />我已了解这些质量警告，仍继续本次模拟评测。</label>}
        <details className="advanced-settings"><summary>本次配置</summary><p>{options.models.find(m => m.id === modelId)?.name} {options.models.find(m => m.id === modelId)?.version} · {benchmark?.name}</p><p>{episodes} Episodes · Seed {seed} · {baselineId ? "已选择历史基线" : "无比较基线"} · {target ? "目标 " + Number(target) * 100 + "%" : "未设达标目标"}</p></details>
      </>}
      {error && <div className="request-error" role="alert"><p>{error}</p>{Object.entries(fields).filter(([key]) => key !== "name").map(([key, values]) => <p key={key}>{values.join("；")}</p>)}</div>}
      <div className="workflow-actions"><button className="primary-button" type="submit" disabled={busy || (step === 1 ? !valid : !canStart)}>{busy ? (step === 1 ? "正在读取质量…" : "正在创建…") : step === 1 ? "检查数据质量 →" : quality?.dataset.qualityStatus === "FAILED" ? "质量未通过，不能创建" : quality?.dataset.qualityStatus === "WARNING" && !accepted ? "请先接受质量警告" : "创建并启动评测 →"}</button>
        {step === 2 && <button className="text-action" type="button" disabled={busy} onClick={() => { setStep(1); setAccepted(false); setError(""); requestAnimationFrame(() => heading.current?.focus()); }}>返回修改配置 ←</button>}</div>
    </form>
    <p className="fine-print">合成数据 · 模拟执行，不训练模型、不运行真实仿真器。最多同时运行 {options.activeTaskLimit} 个任务。</p>
  </section>;
}
