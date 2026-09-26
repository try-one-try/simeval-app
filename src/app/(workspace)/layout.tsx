// 服务端验证访问者；客户端导航只负责交互，不接触受保护的查询。
import Link from "next/link";
import { WorkspaceNavigation, MobileNavigation } from "@/components/workspace-navigation";
import { requireViewer } from "@/server/auth/require-viewer";
import { leaveDemo } from "@/server/auth/actions";
const roleNames = { ENGINEER: "算法工程师", REVIEWER: "复核员", ADMIN: "管理员" } as const;
export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireViewer();
  return <div className="workspace">
    <WorkspaceNavigation />
    <div className="workspace-main">
      <header className="workspace-top">
        <Link href="/" className="brand mobile-only">simeval.</Link>
        <Link href="/" className="workspace-caption">SimEval / 具身智能评测工作台</Link>
        <span className="demo-label">DEMO · 演示模式</span><MobileNavigation />
      </header>
      {children}
      <footer className="workspace-footer"><span>{viewer.name} · {roleNames[viewer.role]}</span><form action={leaveDemo}><button type="submit" className="text-action">退出演示 ↗</button></form></footer>
    </div>
  </div>;
}