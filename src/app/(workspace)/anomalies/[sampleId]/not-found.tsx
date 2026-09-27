import Link from "next/link";
export default function NotFound(){return <main className="content state-content"><h1>未找到这个样本</h1><p className="muted">样本不存在、任务已隐藏，或链接不属于当前任务。</p><Link className="primary-button" href="/anomalies">重新选择任务 →</Link></main>;}
