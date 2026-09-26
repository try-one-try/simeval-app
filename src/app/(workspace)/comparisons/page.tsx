import { requireViewer } from "@/server/auth/require-viewer";
import { WorkspaceNotice } from "@/components/workspace-notice";
export default async function ComparisonsPage() {
  const viewer = await requireViewer();
  return viewer.role === "ENGINEER"
    ? <WorkspaceNotice title="模型对比" description="同口径模型对比与指标下钻尚未开放。可以先查看已有评测任务；比较功能将在后续切片接入。" />
    : <WorkspaceNotice denied title="当前身份无法使用模型对比" description="模型对比由算法工程师操作。评测人员核对样本结论与报告，可通过右上角切换演示身份。" />;
}
