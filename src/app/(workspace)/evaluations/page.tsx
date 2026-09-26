// 板块入口恢复最近任务；新建表单有独立地址，不因导航切换而重置。
import { redirect } from "next/navigation";
import { requireViewer } from "@/server/auth/require-viewer";
import { evaluationService } from "@/server/application/evaluation";
export default async function EvaluationsPage() {
  const options = await evaluationService.options(await requireViewer());
  redirect(options.recent[0] ? "/evaluations/" + options.recent[0].id : "/evaluations/new");
}
