"use client";

// 查询失败时保留明确的错误状态，并允许访问者主动重试。
export default function OverviewError({ reset }: { error: Error; reset: () => void }) {
  return <main className="content"><div className="eyebrow">Overview / 项目总览</div><h1>暂时无法读取项目数据</h1><p className="content-intro">连接或查询失败。请稍后重试；我们不会把读取错误显示成零条记录。</p><button className="primary-button" type="button" onClick={reset}>重试读取</button></main>;
}
