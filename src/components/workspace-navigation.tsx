"use client";

// 导航只管理展开和菜单状态，不参与身份判断或读取数据库。
import Link from "next/link";
import { useRef, useState } from "react";
const items = [
  ["总览", "项目全貌"], ["数据质量", "质量与覆盖"],
  ["创建评测", "配置与执行任务"], ["模型对比", "版本差异与指标"],
  ["异常复核", "证据与人工结论"], ["报告", "结论与人工确认"],
] as const;
function NavigationItems() {
  return <nav aria-label="工作台导航" className="nav-list">{items.map(([label, description], index) => (
    index === 0 ? <Link key={label} href="/overview" className="nav-item" aria-current="page">
      <span className="nav-name">{label}<span className="nav-arrow" aria-hidden="true">↗</span></span>
      <span className="nav-description">{description}</span>
    </Link> : <span key={label} className="nav-item" aria-disabled="true">
      <span className="nav-name">{label}</span><span className="nav-description">{description} · 未开放</span>
    </span>
  ))}</nav>;
}
export function WorkspaceNavigation() {
  const [expanded, setExpanded] = useState(false);
  return <aside className={`sidebar${expanded ? " is-expanded" : ""}`}
    onPointerEnter={(event) => { if (event.pointerType === "mouse") setExpanded(true); }}
    onPointerLeave={(event) => { if (event.pointerType === "mouse") setExpanded(false); }}
    onFocusCapture={() => setExpanded(true)}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false); }}>
    <Link href="/" className="brand">simeval.</Link>
    <div className="sidebar-label"><span>工作区</span><button className="expand-control" type="button" aria-label={expanded ? "收起导航说明" : "展开导航说明"} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "‹" : "›"}</button></div>
    <NavigationItems /><p className="sidebar-note">合成演示数据 · 当前开放总览</p>
  </aside>;
}
export function MobileNavigation() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => dialog.current?.close();
  return <>
    <button ref={trigger} type="button" className="text-action menu-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => { dialog.current?.showModal(); setOpen(true); }}>菜单 +</button>
    {/* 原生对话框约束焦点、支持 Escape；关闭后恢复触发按钮焦点。 */}
    <dialog ref={dialog} id="mobile-navigation" className="mobile-menu" aria-label="工作台菜单" onClose={() => { setOpen(false); trigger.current?.focus(); }}>
      <div className="mobile-menu-header"><Link href="/" className="brand" onClick={close}>simeval.</Link><button type="button" className="text-action" autoFocus onClick={close}>关闭 ×</button></div>
      <div onClick={(event) => { if ((event.target as HTMLElement).closest("a")) close(); }}><NavigationItems /></div>
      <p className="muted">当前开放总览，其余板块随功能切片上线。</p>
    </dialog>
  </>;
}
