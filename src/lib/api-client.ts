// 浏览器统一读取 HTTP 契约；错误保留 requestId，网络失败不清空用户输入。
export class ClientError extends Error {
  constructor(message: string, public status = 0, public requestId?: string, public fieldErrors?: Record<string, string[]>) { super(message); }
}
export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body: { data: T; error?: { message: string; requestId?: string; fieldErrors?: Record<string, string[]> } } = await response.json();
  if (!response.ok) throw new ClientError(body.error?.message ?? "请求失败，请稍后重试", response.status, body.error?.requestId, body.error?.fieldErrors);
  return body.data;
}
export function errorText(error: unknown) {
  return error instanceof ClientError ? error.message + (error.requestId ? "（请求号：" + error.requestId + "）" : "") : "网络连接失败，请重试；当前输入已保留。";
}
