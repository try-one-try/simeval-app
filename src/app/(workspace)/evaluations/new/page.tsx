// 只向客户端传递公开选项与最小身份，不暴露数据库对象。
import { requireViewer } from "@/server/auth/require-viewer";
import { evaluationService } from "@/server/application/evaluation";
import { CreateForm } from "@/features/evaluation/create-form";
import { WorkspaceNotice } from "@/components/workspace-notice";
export default async function NewEvaluationPage() {
  const viewer = await requireViewer();
  if (viewer.role !== "ENGINEER") return <WorkspaceNotice denied title="当前身份无法创建评测" description="创建与管理任务由算法工程师操作；评测人员可查看任务与结果，后续负责确认结论和报告。" />;
  return <><p className="legacy-notice">当前创建流程沿用第一版；自主配置与质量两步将在阶段 4 接通。</p><CreateForm options={await evaluationService.options(viewer)} actor={{ id: viewer.id, role: viewer.role }} /></>;
}
