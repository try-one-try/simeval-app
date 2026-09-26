// 按身份提供公开导航；显示规则不能替代页面与写接口的服务端授权。
import type { DemoRole } from "@/lib/demo-identity";
const items = {
  create: { label: "创建评测", description: "配置与执行任务", href: "/evaluations/new" },
  tasks: { label: "评测任务", description: "任务列表与执行状态", href: "/evaluations" },
  compare: { label: "模型对比", description: "版本差异与指标 · 未开放", href: "/comparisons" },
  review: { label: "异常复核", description: "证据与人工结论 · 未开放", href: "/anomalies" },
  reports: { label: "报告", description: "结论与人工确认 · 未开放", href: "/reports" },
  overview: { label: "总览", description: "当前展示固定演示故事", href: "/overview" },
} as const;
export function workspaceItems(role: DemoRole) {
  return (role === "ENGINEER" ? ["create", "tasks", "compare", "review", "reports", "overview"] as const
    : ["review", "reports", "tasks", "overview"] as const).map((key) => items[key]);
}
export function isCurrentItem(path: string, href: string) {
  if (href === "/evaluations/new") return path === href || path === "/quality";
  if (href === "/evaluations") return path === href || (path.startsWith(href + "/") && path !== "/evaluations/new");
  return path === href || path.startsWith(href + "/");
}
