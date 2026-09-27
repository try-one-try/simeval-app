"use server";

// 演示入口与退出只在服务端执行；按钮提交后，服务端读取 DEMO_PASSWORD 完成便捷登录。
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { z } from "zod";
import { demoIdentities, demoRoles, type DemoRole } from "@/lib/demo-identity";
import { requireViewer } from "@/server/auth/require-viewer";

function selectedRole(formData: FormData): DemoRole {
  const parsed = z.enum(demoRoles).safeParse(formData.get("role"));
  if (!parsed.success) redirect("/login?error=role");
  return parsed.data;
}
async function signInDemo(role: DemoRole) {
  const errorPage = "/login?role=" + role;
  const password = process.env.DEMO_PASSWORD;
  if (!password || !process.env.AUTH_SECRET) {
    redirect(errorPage + "&error=setup");
  }

  try {
    await signIn("credentials", {
      email: demoIdentities[role].email,
      role,
      password,
      redirect: false,
    });
  } catch (error) {
    // Auth.js 的预期认证失败提供恢复入口；Next.js 成功重定向必须继续抛出。
    if (error instanceof AuthError) redirect(errorPage + "&error=signin");
    throw error;
  }
  // 成功换会话后废弃旧身份的布局缓存，再跳转；导航和正文必须一起更新。
  revalidatePath("/", "layout");
  redirect(demoIdentities[role].home);
}

export async function enterDemo(formData: FormData) {
  await signInDemo(selectedRole(formData));
}

// 先验证当前会话再切换；认证失败不先退出，保留原账号可重试。
export async function switchDemo(formData: FormData) {
  const viewer = await requireViewer();
  const role = selectedRole(formData);
  if (viewer.role === role) redirect(demoIdentities[role].home);
  await signInDemo(role);
}

export async function leaveDemo() {
  await signOut({ redirectTo: "/" });
}
