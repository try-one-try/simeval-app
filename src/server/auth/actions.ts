"use server";

// 登录校验访客提交的访问密码；身份切换只对已有会话开放，不再次要求输入。
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { z } from "zod";
import { demoIdentities, demoRoles, type DemoRole } from "@/lib/demo-identity";
import { requireViewer } from "@/server/auth/require-viewer";

export type DemoLoginState = { error: "password" | "setup" | "role" | "signin" | null };

function selectedRole(formData: FormData): DemoRole | null {
  const parsed = z.enum(demoRoles).safeParse(formData.get("role"));
  return parsed.success ? parsed.data : null;
}

async function signInDemo(role: DemoRole, accessPassword: string): Promise<DemoLoginState> {
  if (!process.env.ACCESS_PASSWORD || process.env.ACCESS_PASSWORD.length < 6 || !process.env.AUTH_SECRET) {
    return { error: "setup" };
  }

  try {
    await signIn("credentials", {
      role,
      accessPassword,
      redirect: false,
    });
  } catch (error) {
    // 凭据错误与基础设施故障分开提示；不把数据库故障误报成密码错误。
    if (error instanceof AuthError) return { error: error.type === "CredentialsSignin" ? "password" : "signin" };
    throw error;
  }
  // 成功换会话后废弃旧身份的布局缓存，再跳转；导航和正文必须一起更新。
  revalidatePath("/", "layout");
  redirect(demoIdentities[role].home);
}

export async function enterDemo(_previous: DemoLoginState, formData: FormData): Promise<DemoLoginState> {
  const role = selectedRole(formData);
  if (!role) return { error: "role" };
  const password = z.string().min(1).max(256).safeParse(formData.get("accessPassword"));
  if (!password.success) return { error: "password" };
  return signInDemo(role, password.data);
}

// 先验证当前会话再切换；认证失败不先退出，保留原账号可重试。
export async function switchDemo(formData: FormData) {
  const viewer = await requireViewer();
  const role = selectedRole(formData);
  if (!role) redirect("/login?error=role");
  if (viewer.role === role) redirect(demoIdentities[role].home);
  const result = await signInDemo(role, process.env.ACCESS_PASSWORD ?? "");
  redirect("/login?role=" + role + "&error=" + (result.error === "setup" ? "setup" : "signin"));
}

export async function leaveDemo() {
  await signOut({ redirectTo: "/" });
}
