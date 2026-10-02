// 浏览器只访问本站接口；密钥、历史组装和工具执行全部留在服务端。
export async function assistantRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal, cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "请求失败，请稍后重试");
  return result.data as T;
}
