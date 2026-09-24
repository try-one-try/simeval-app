// 工作台共享外壳：先在服务端核对访问者，再展示导航与当前身份。
import Link from "next/link";
import { Activity, Boxes, ClipboardCheck, Database, FileText, LayoutDashboard, LogOut, ScanSearch } from "lucide-react";
import { leaveDemo } from "@/server/auth/actions";
import { requireViewer } from "@/server/auth/require-viewer";

const roleNames = { ENGINEER: "算法工程师", REVIEWER: "复核员", ADMIN: "管理员" } as const;

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireViewer();

  return (
    <div className="workspace">
      <aside className="sidebar" aria-label="工作台导航">
        <Link href="/overview" className="brand"><span className="brand-mark" aria-hidden="true">S</span> SimEval</Link>
        <nav>
          <div className="sidebar-caption">工作空间</div>
          <div className="nav-list">
            <Link className="nav-link" href="/overview" aria-current="page"><LayoutDashboard size={16} aria-hidden="true" /> 总览</Link>
            <span className="nav-disabled"><Database size={16} aria-hidden="true" /> 数据质量 <span>规划中</span></span>
            <span className="nav-disabled"><Activity size={16} aria-hidden="true" /> 评测任务 <span>规划中</span></span>
            <span className="nav-disabled"><Boxes size={16} aria-hidden="true" /> 版本对比 <span>规划中</span></span>
            <span className="nav-disabled"><ScanSearch size={16} aria-hidden="true" /> 异常样本 <span>规划中</span></span>
            <span className="nav-disabled"><ClipboardCheck size={16} aria-hidden="true" /> 人工复核 <span>规划中</span></span>
            <span className="nav-disabled"><FileText size={16} aria-hidden="true" /> 证据报告 <span>规划中</span></span>
          </div>
        </nav>
        <div className="sidebar-bottom">合成数据 · 模拟评测<br />当前仅开放演示入口与概览</div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-top">
          <div className="workspace-top-label">工作台 <span aria-hidden="true">/</span> 项目总览</div>
          <div className="identity">
            <span className="avatar" aria-hidden="true">{viewer.name.slice(0, 1)}</span>
            <span>{viewer.name} · {roleNames[viewer.role]}</span>
            <form action={leaveDemo}><button className="signout" type="submit"><LogOut size={13} style={{ display: "inline", marginRight: 4 }} aria-hidden="true" />退出</button></form>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
