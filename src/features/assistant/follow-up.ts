// 只用已保存证据选择追问；不调用模型，也不把历史证据编号当成样本身份。
import type { Evidence, SessionView, TurnView } from "@/domain/assistant";
import { assistantContent } from "./content";

export type Suggestion = Readonly<{ title: string; prompt: string }>;
type FollowUpKey = keyof typeof assistantContent.followUps;
type SampleReference = { id: string; sampleNumber: string | null };

const sampleIdPattern = /^[a-zA-Z0-9_-]{1,64}$/;
const alreadyAsked: Record<FollowUpKey, RegExp> = {
  sampleLogs: /日志|log/i,
  sampleReview: /人工复核信息|复核记录|人工结论|已确认结论|未确认草稿|草稿/,
  sampleChecks: /核查步骤|核对步骤|人工核查|下一步|接下来/,
  comparisonScenarios: /分场景|场景差异|比较口径/,
  comparisonSamples: /差异.*(?:样本|异常)|(?:样本|异常).*差异/,
  anomalyEvidence: /详细日志|读取.*日志|代表性.*样本|选.*样本/,
  anomalyReview: /待复核|尚待|未复核/,
  metricMeaning: /指标定义|计算口径|目标规则|达标|指标.*含义|解释.*指标/,
  uncertainties: /证据缺口|证据不足|补充证据|(?:哪些|什么).*(?:不能确定|不确定)/,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function readSample(value: unknown): SampleReference | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string" || !sampleIdPattern.test(record.id)) return null;
  return {
    id: record.id,
    sampleNumber: typeof record.sampleNumber === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(record.sampleNumber)
      ? record.sampleNumber : null,
  };
}

function sampleFromEvidence(evidence: Evidence): SampleReference | null {
  if (evidence.kind === "sample") {
    const sample = readSample(evidence.snapshot);
    if (sample) return sample;
    // 仅接受服务端生成的站内样本链接，避免从自由文本猜测身份。
    const match = /^\/anomalies\/([a-zA-Z0-9_-]{1,64})\?runId=[a-zA-Z0-9_-]{1,64}$/.exec(evidence.href);
    return match ? { id: match[1], sampleNumber: null } : null;
  }
  if (evidence.kind === "samples") {
    const snapshot = asRecord(evidence.snapshot);
    const samples = snapshot?.samples;
    if (Array.isArray(samples)) {
      for (const value of samples) {
        const sample = readSample(value);
        if (sample) return sample;
      }
    }
  }
  return null;
}

function sampleReference(sample: SampleReference): string {
  return (sample.sampleNumber ? assistantContent.followUpSample.withNumber : assistantContent.followUpSample.withoutNumber)
    .replace("{sampleNumber}", sample.sampleNumber ?? "")
    .replace("{sampleId}", sample.id);
}

function normalizeQuestion(value: string): string {
  return value.toLowerCase().replace(/[\s，。！？、：；]/g, "");
}

export function getFollowUpSuggestions(turn: TurnView, session: SessionView): readonly Suggestion[] {
  if (turn.status !== "SUCCEEDED" || !turn.answer?.trim()) return [];

  // 详细样本优先，再取列表中的一个样本；所有追问都能独立定位当前记录。
  const sampleEvidence = turn.evidence.filter(item => item.kind === "sample").reverse();
  const listedEvidence = turn.evidence.filter(item => item.kind === "samples").reverse();
  const sample = [...sampleEvidence, ...listedEvidence].map(sampleFromEvidence).find(item => item !== null);
  const hasComparison = Boolean(session.baselineRunId) && turn.evidence.some(item => item.kind === "comparison");
  const keys: FollowUpKey[] = sample
    ? ["sampleLogs", "sampleReview", "sampleChecks", "metricMeaning", "uncertainties"]
    : hasComparison
      ? ["comparisonScenarios", "comparisonSamples", "anomalyReview", "metricMeaning", "uncertainties"]
      : listedEvidence.length
        ? ["anomalyReview", "anomalyEvidence", "metricMeaning", "uncertainties"]
        : ["metricMeaning", "anomalyEvidence", "anomalyReview", "uncertainties"];
  const question = normalizeQuestion(turn.question);
  const result: Suggestion[] = [];
  for (const key of keys) {
    const template = assistantContent.followUps[key];
    const prompt = template.prompt.replace("{sample}", sample ? sampleReference(sample) : "");
    if (alreadyAsked[key].test(turn.question) || normalizeQuestion(prompt) === question) continue;
    result.push({ title: template.title, prompt });
    if (result.length === 3) break;
  }
  // 综合问题可能覆盖全部主题；仍给一个可独立发送且不与原文重复的追问。
  if (!result.length) {
    const fallback = assistantContent.followUpFallbacks
      .find(item => normalizeQuestion(item.prompt) !== question);
    if (fallback) result.push(fallback);
  }
  return result;
}
