// 登录页只组合公开设计；访问密码与会话创建由 Server Action 处理。
import Link from "next/link";
import { AccessLoginForm } from "@/features/identity/access-login-form";
import { isDemoRole } from "@/lib/demo-identity";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ role?: string; error?: string }> }) {
  const { role, error } = await searchParams;
  const initialRole = typeof role === "string" && isDemoRole(role) ? role : "ENGINEER";
  const initialError = error === "setup" || error === "signin" || error === "role" ? error : null;
  return <main className="identity-login">
    <section className="identity-intro"><Link href="/" className="brand">simeval.</Link><h1>从一次评测开始。</h1><p className="muted">选择模型与数据，沿结果找到证据，形成可追溯的结论。</p><p className="fine-print">合成数据 · 模拟执行 · 访问密码进入</p></section>
    <section className="identity-entry" aria-labelledby="identity-title">
      <h2 id="identity-title">选择演示身份</h2><p className="muted">选择一种身份进入工作区，可随时切换。</p>
      <AccessLoginForm initialRole={initialRole} initialError={initialError} />
      {error === "signin" && <Link className="inline-link" href="/evaluations">返回已有工作台 →</Link>}
    </section>
  </main>;
}
