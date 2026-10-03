"use client";
import Link from "next/link";
export default function ErrorPage({ retry }: { retry: () => void }) { return <section className="content state-content"><h1>暂时无法读取质量报告</h1><p className="muted">请检查数据库连接后重试。已保存的数据不会因此删除。</p><button className="primary-button" onClick={retry}>重新读取 →</button><Link className="text-action" href="/evaluations">返回评测任务</Link></section>; }
