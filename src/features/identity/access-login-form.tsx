"use client";

// 身份单选与下划线密码字段来自设计稿；错误状态不回传或保存用户输入。
import { useActionState } from "react";
import { enterDemo, type DemoLoginState } from "@/server/auth/actions";
import { type DemoRole } from "@/lib/demo-identity";
import { IdentityFields } from "@/features/identity/identity-fields";
import { DemoSubmit } from "@/components/demo-submit";

export function AccessLoginForm({ initialRole, initialError }: { initialRole: DemoRole; initialError: DemoLoginState["error"] }) {
  const [state, action] = useActionState(enterDemo, { error: initialError });
  const invalidPassword = state.error === "password";
  return <form action={action}>
    <IdentityFields initialRole={initialRole} />
    <div className="access-password-field">
      <label htmlFor="access-password">访问密码</label>
      <input id="access-password" name="accessPassword" type="password" placeholder="请输入访问密码" autoComplete="current-password" maxLength={256} required aria-invalid={invalidPassword} aria-describedby="access-password-help" />
      <p id="access-password-help" className={invalidPassword ? "access-password-error" : ""} role={invalidPassword ? "alert" : undefined}>
        {invalidPassword ? "访问密码不正确，请重试。" : "仅首次进入时填写，切换身份无需重复输入。"}
      </p>
    </div>
    <DemoSubmit label="验证并进入工作区 →" />
    {state.error === "setup" && <p role="alert" className="entry-error">演示环境尚未配置访问密码，请联系项目负责人。</p>}
    {state.error === "role" && <p role="alert" className="entry-error">请选择算法工程师或评测人员。</p>}
    {state.error === "signin" && <p role="alert" className="entry-error">暂时无法进入所选身份，请重试。</p>}
  </form>;
}
