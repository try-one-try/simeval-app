// 运行上限集中在这里。金额用整数微美元计算，避免小数累加误差。
import "server-only";
import { AppError } from "@/domain/evaluation";

export const agentLimits = {
  modelCalls: 6, toolCalls: 8, maxOutputTokens: 1800,
  maxInputBytes: 40000, timeoutMs: 60000, historyTurns: 3, sessionTurns: 16,
  turnsPerHour: 12, globalConcurrent: 3,
  // 按每次 <= 56000 输入 token（含工具定义余量）、1800 输出 token 保守预留。
  // 默认模型每百万输入 $0.75、输出 $4.50；6 次最坏估算约 $0.301，取 $0.40。
  reserveMicros: 400000,
} as const;
export const promptVersion = "investigator-v1";
export function agentConfig() {
  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
  if (model !== "gpt-5.4-mini") throw new AppError("MODEL_CONFIG", "模型配置未匹配费用上限，请管理员核对模型与价格", 503);
  if (!process.env.OPENAI_API_KEY) throw new AppError("MODEL_UNAVAILABLE", "AI 服务尚未配置，请联系管理员", 503);
  const budget = Number(process.env.ASSISTANT_BUDGET_USD || "3");
  if (!Number.isFinite(budget) || budget < 0 || budget > 1000) throw new AppError("MODEL_CONFIG", "AI 总额度配置不正确", 503);
  return { model, budgetMicros: Math.floor(budget * 1e6), budgetKey: "assistant-v1" };
}
export function usageMicros(input: number, output: number) {
  return Math.ceil(input * .75 + output * 4.5);
}
