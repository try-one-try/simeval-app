// 服务端核对身份，再把公开角色传给导航；切换真实会话后重新呈现入口。
import Link from "next/link";
import { WorkspaceNavigation, MobileNavigation } from "@/components/workspace-navigation";
import { requireViewer } from "@/server/auth/require-viewer";
import { IdentitySwitcher } from "@/features/identity/identity-switcher";
import { AssistantHost } from "@/features/assistant/assistant-host";
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
    </div>
    {/* 先通过密码门禁才显示助手；工作台内换页保留面板，切换角色重新创建。 */}
    <AssistantHost key={viewer.id} role={viewer.role} />
  </div>;
}
