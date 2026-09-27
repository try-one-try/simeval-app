// 服务端先校验身份与任务存在性；浏览器刷新读取已保存状态。
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/require-viewer";
import { evaluationService } from "@/server/application/evaluation";
import { AppError, idSchema } from "@/domain/evaluation";
import { TaskStatus } from "@/features/evaluation/task-status";
export default async function EvaluationPage({ params, searchParams }: { params: Promise<{ runId: string }>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const viewer = await requireViewer();
  const { runId } = await params;
  if (!idSchema.safeParse(runId).success) notFound();
  const baselineRunId = (await searchParams).baselineRunId;
  if (baselineRunId !== undefined && (typeof baselineRunId !== "string" || baselineRunId !== "" && !idSchema.safeParse(baselineRunId).success)) notFound();
  let run;
  try {
    run = await evaluationService.get(viewer, runId);

  } catch (error) { if (error instanceof AppError && error.status === 404) notFound(); throw error; }
  return <TaskStatus key={run.id} initialRun={run} actor={{ id: viewer.id, role: viewer.role }} baselineRunId={baselineRunId} />;
}
