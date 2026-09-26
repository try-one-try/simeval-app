// 未开放与无权限分别说明；入口可导航，但不伪造后续业务数据或成功操作。
import Link from "next/link";
export function WorkspaceNotice({ title, description, denied = false }: { title: string; description: string; denied?: boolean }) {
  return <main className="content state-content"><p className="breadcrumb">{denied ? "当前身份无权限" : "功能尚未开放"}</p><h1>{title}</h1><p className="muted">{description}</p><Link href="/evaluations" className="primary-button">查看评测任务 →</Link></main>;
}
