"use client";
import Link from "next/link";


// 读取失败不显示零值；使用当前 Next.js 错误边界的 retry 重新获取数据。
export default function OverviewError({ retry }: { error: Error; retry: () => void }) {
  return <main className="content state-content"><p className="breadcrumb">总览 / 当前演示项目</p><h1>暂时无法读取项目数据</h1><p role="alert" className="muted">连接或查询失败，请稍后重试。当前没有可靠结果可展示。</p><button className="primary-button" type="button" onClick={retry}>重试读取</button><Link href="/" className="text-action">返回首页 ↗</Link></main>;
}