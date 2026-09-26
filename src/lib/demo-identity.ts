// 公开的演示身份与入口；这里只存标签和固定账号标识，不存口令或会话。
export const demoRoles = ["ENGINEER", "REVIEWER"] as const;
export type DemoRole = typeof demoRoles[number];
export const demoIdentities = {
  ENGINEER: { label: "算法工程师", email: "engineer@demo.simeval.local", description: "创建评测、比较结果与分析异常", home: "/evaluations/new" },
  REVIEWER: { label: "评测人员", email: "reviewer@demo.simeval.local", description: "复核样本与确认报告", home: "/anomalies" },
} as const;

export function isDemoRole(role: string): role is DemoRole {
  return role === "ENGINEER" || role === "REVIEWER";
}

// 三个条件都来自数据库；旧管理员和被改错角色的账号不能继续演示会话。
export function isDemoAccount(user: { email: string; role: string; isDemo: boolean }): boolean {
  return user.isDemo && isDemoRole(user.role) && user.email === demoIdentities[user.role].email;
}
