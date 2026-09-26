"use client";
import Link from "next/link";


// 覆盖会话外壳等上层读取失败，不泄露数据库错误与内部连接信息。
export default function ApplicationError({ retry }: { error: Error; retry: () => void }) {
  return <main className="content state-content"><Link href="/" className="brand">simeval.</Link><h1>演示工作台暂时不可用</h1><p className="muted" role="alert">暂时无法确认会话或读取项目，请稍后再试。</p><button type="button" className="primary-button" onClick={retry}>重试连接</button><Link href="/" className="text-action">返回首页 ↗</Link></main>;
}
