import Link from "next/link";
export default function NotFound() { return <section className="content state-content"><h1>评测任务不存在</h1><p className="muted">请核对任务地址，或重新创建模拟评测。</p><Link href="/evaluations/new" className="primary-button">新建评测 →</Link></section>; }
