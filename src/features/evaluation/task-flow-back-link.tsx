// 正文返回与侧栏切换分开：链接保留当前任务，次级按钮不抢下一步主操作。
import Link from "next/link";
export function TaskFlowBackLink({ href, label }: { href: string; label: string }) {
  return <nav aria-label="当前任务的返回导航"><Link className="secondary-button task-flow-back-link" href={href}><span aria-hidden="true">←</span>{label}</Link></nav>;
}
