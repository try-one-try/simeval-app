"use client";
import Link from "next/link";
// 读取失败与没有数据分开；恢复入口保留当前 URL 的任务和筛选。
export function ReviewReadError({reset}:{reset:()=>void}){return <main className="content state-content"><p className="page-context">读取失败</p><h1>暂时无法读取评测证据</h1><p className="muted">当前查看条件保留，请重试。</p><button className="primary-button" onClick={reset}>重新读取</button><Link className="text-action" href="/evaluations">选择其他任务 ↗</Link></main>;}
