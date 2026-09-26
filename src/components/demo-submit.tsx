"use client";

// 提交反馈留在客户端；登录凭据与会话创建仍由服务端动作负责。
import { useFormStatus } from "react-dom";
export function DemoSubmit({ compact = false }: { compact?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={compact ? "text-action" : "primary-button"} disabled={pending} aria-busy={pending}>
    {pending ? "正在进入…" : compact ? "体验演示 ↗" : "体验一次评测 →"}
  </button>;
}