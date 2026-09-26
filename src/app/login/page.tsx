// 登录页只组合公开身份选项；口令与会话操作均在 Server Action 中。
import Link from "next/link";
import { enterDemo } from "@/server/auth/actions";
import { IdentityFields } from "@/features/identity/identity-fields";
import { DemoSubmit } from "@/components/demo-submit";
import { isDemoRole } from "@/lib/demo-identity";
const messages: Record<string, string> = {
  setup: "演示环境尚未准备，请按 README 完成配置。",
  signin: "暂时无法进入所选身份，请重试。若已有会话，可以返回工作台。",
  role: "请选择算法工程师或评测人员。",
};
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ role?: string; error?: string }> }) {
  const { role, error } = await searchParams;
  const initialRole = typeof role === "string" && isDemoRole(role) ? role : "ENGINEER";
  return <main className="identity-login">
    <section className="identity-intro"><Link href="/" className="brand">simeval.</Link><h1>从一次评测开始。</h1><p className="muted">选择模型与数据，沿结果找到证据，形成可追溯的结论。</p><p className="fine-print">合成数据 · 模拟执行 · 无需注册</p></section>
    <section className="identity-entry" aria-labelledby="identity-title">
      <h2 id="identity-title">选择演示身份</h2><p className="muted">选择一种身份进入工作区，可随时切换。</p>
      <form action={enterDemo}><IdentityFields initialRole={initialRole} /><DemoSubmit />
        {error && <p role="alert" className="entry-error">{typeof error === "string" && Object.hasOwn(messages, error) ? messages[error] : "暂时无法进入，请重试。"}</p>}
      </form>
      {error === "signin" && <Link className="inline-link" href="/overview">返回已有工作台 →</Link>}
    </section>
  </main>;
}
