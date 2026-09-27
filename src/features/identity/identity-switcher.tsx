"use client";

// 原生弹层选择另一身份；关闭恢复焦点，实际切换由服务端验证并重建会话。
import { useRef, useState } from "react";
import { demoIdentities, type DemoRole } from "@/lib/demo-identity";
import { leaveDemo, switchDemo } from "@/server/auth/actions";
import { IdentityFields } from "@/features/identity/identity-fields";
import { DemoSubmit } from "@/components/demo-submit";
export function IdentitySwitcher({ role }: { role: DemoRole }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [opened, setOpened] = useState(false);
  return <>
    <button ref={trigger} type="button" className="identity-trigger" aria-haspopup="dialog" aria-controls="identity-switch" aria-expanded={opened} onClick={() => { dialog.current?.showModal(); setOpened(true); }}>演示身份：<strong>{demoIdentities[role].label}</strong><span> · 切换 ↓</span></button>
    <dialog ref={dialog} id="identity-switch" className="confirm-dialog identity-dialog" aria-labelledby="switch-title" onClose={() => { setOpened(false); trigger.current?.focus(); }}>
      <div className="identity-dialog-heading"><h2 id="switch-title">切换演示身份</h2><button type="button" className="text-action" autoFocus onClick={() => dialog.current?.close()}>关闭 ×</button></div>
      <p className="muted">评测记录保留，操作权限随身份变化。</p>
      <form action={switchDemo}><IdentityFields initialRole={role} /><DemoSubmit label="以所选身份继续 →" /></form>
      <form action={leaveDemo} className="identity-exit"><button type="submit" className="text-action">退出演示 ↗</button></form>
    </dialog>
  </>;
}
