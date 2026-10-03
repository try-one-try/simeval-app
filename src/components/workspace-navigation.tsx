"use client";

// 文字导航按服务端确认的身份呈现；悬浮、点击展开与窄屏菜单只管理交互。
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import type { DemoRole } from "@/lib/demo-identity";
import { isCurrentItem, workspaceItems } from "@/lib/workspace-navigation";

function NavigationItems({ role }: { role: DemoRole }) {
  const pathname = usePathname();
  return <nav aria-label="工作台导航" className="nav-list">{workspaceItems(role).map((item) =>
    <Link key={item.href} href={item.href} className="nav-item" aria-current={isCurrentItem(pathname, item.href) ? "page" : undefined}>
      <span className="nav-name">{item.label}<span className="nav-arrow" aria-hidden="true">↗</span></span>
      <span className="nav-description">{item.description}</span>
    </Link>
  )}</nav>;
}
export function WorkspaceNavigation({ role }: { role: DemoRole }) {
  const [expanded, setExpanded] = useState(false);
  return <aside className={`sidebar${expanded ? " is-expanded" : ""}`}
    onPointerEnter={(event) => { if (event.pointerType === "mouse") setExpanded(true); }}
    onPointerLeave={(event) => { if (event.pointerType === "mouse") setExpanded(false); }}
    onFocusCapture={() => setExpanded(true)}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false); }}>
    <Link href="/" className="brand">simeval.</Link>
    <div className="sidebar-label"><span>工作区</span><button className="expand-control" type="button" aria-label={expanded ? "收起导航说明" : "展开导航说明"} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "‹" : "›"}</button></div>
    <NavigationItems role={role} /><p className="sidebar-note">合成演示数据 · 模拟执行</p>
  </aside>;
}
export function MobileNavigation({ role }: { role?: DemoRole }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => dialog.current?.close();
  return <>
    <button ref={trigger} type="button" className="text-action menu-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => { dialog.current?.showModal(); setOpen(true); }}>菜单 +</button>
    {/* 原生对话框约束焦点、支持 Escape；关闭后恢复触发按钮焦点。 */}
    <dialog ref={dialog} id="mobile-navigation" className="mobile-menu" aria-label={role ? "工作台菜单" : "首页菜单"} onClose={() => { setOpen(false); trigger.current?.focus(); }}>
      <div className="mobile-menu-header"><Link href="/" className="brand" onClick={close}>simeval.</Link><button type="button" className="text-action" autoFocus onClick={close}>关闭 ×</button></div>
      <div onClick={(event) => { if ((event.target as HTMLElement).closest("a")) close(); }}>
        {role ? <NavigationItems role={role} /> : <nav className="nav-list" aria-label="首页导航"><Link className="nav-item" href="/#workflow">产品概览</Link><Link className="nav-item" href="/login">选择演示身份 →</Link></nav>}
      </div>
      <p className="muted">合成演示数据 · 后续模块明确标注未开放。</p>
    </dialog>
  </>;
}
