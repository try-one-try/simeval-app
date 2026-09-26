"use client";

// 提交反馈留在客户端；登录凭据与会话创建仍由服务端动作负责。
import { useFormStatus } from "react-dom";
export function DemoSubmit({ label = "以所选身份进入 →" }: { label?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="primary-button" disabled={pending} aria-busy={pending}>
    {pending ? "正在进入…" : label}
  </button>;
}
