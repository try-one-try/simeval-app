// 代理只用于 OpenAI 请求；不修改全局 fetch，不影响 Neon 和其他服务。
import "server-only";
import { ProxyAgent } from "undici";
import { ChatOpenAI } from "@langchain/openai";
import { agentConfig, agentLimits } from "./config";

const local = globalThis as typeof globalThis & { assistantProxy?: { url: string; dispatcher: ProxyAgent } };
export function createAnalysisModel() {
  const { model } = agentConfig();
  const proxy = process.env.VERCEL ? undefined : process.env.OPENAI_PROXY_URL;
  if (proxy && local.assistantProxy?.url !== proxy) {
    void local.assistantProxy?.dispatcher.close();
    local.assistantProxy = { url: proxy, dispatcher: new ProxyAgent(proxy) };
  }
  return new ChatOpenAI({ model, apiKey: process.env.OPENAI_API_KEY,
    maxTokens: agentLimits.maxOutputTokens, maxRetries: 0, timeout: 55000,
    reasoning: { effort: "none" }, streamUsage: true, useResponsesApi: false,
    configuration: { baseURL: "https://api.openai.com/v1", maxRetries: 0,
      fetchOptions: proxy ? { dispatcher: local.assistantProxy?.dispatcher } : undefined },
  });
}
