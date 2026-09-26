// 服务端核对身份，再把公开角色传给导航；切换真实会话后重新呈现入口。
import Link from "next/link";
import { WorkspaceNavigation, MobileNavigation } from "@/components/workspace-navigation";
import { requireViewer } from "@/server/auth/require-viewer";
import { leaveDemo } from "@/server/auth/actions";
import { IdentitySwitcher } from "@/features/identity/identity-switcher";
import { demoIdentities } from "@/lib/demo-identity";
export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireViewer();
  return <div className="workspace">
    <WorkspaceNavigation role={viewer.role} />
    <div className="workspace-main">
      <header className="workspace-top">
        <Link href="/" className="brand mobile-only">simeval.</Link>
        <Link href="/" className="workspace-caption">SimEval / 具身智能评测工作台</Link>
        <IdentitySwitcher key={viewer.id} role={viewer.role} /><MobileNavigation role={viewer.role} />
      </header>
      {children}
      <footer className="workspace-footer"><span>{viewer.name} · {demoIdentities[viewer.role].label}</span><form action={leaveDemo}><button type="submit" className="text-action">退出演示 ↗</button></form></footer>
    </div>
  </div>;
}
