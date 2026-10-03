// 旧链接继续可用；任务概况已合并到评测结果，不再显示独立总览。
import { redirect } from "next/navigation";
import { AppError, idSchema } from "@/domain/evaluation";
import { requireViewer } from "@/server/auth/require-viewer";
import { evaluationService } from "@/server/application/evaluation";
type LegacyParams = Promise<Record<string, string | string[] | undefined>>;
export default async function Page({ searchParams }: { searchParams: LegacyParams }) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const parsedId = idSchema.safeParse(params.runId);
  let href = "/evaluations";
  if (parsedId.success) {
    try {
      const run = await evaluationService.get(viewer, parsedId.data);
      href = "/evaluations/" + encodeURIComponent(run.id);
    } catch (error) {
      // 不存在或已删除的任务回到列表；连接失败交给错误边界提示重试。
      if (!(error instanceof AppError && error.status === 404)) throw error;
    }
  }
  redirect(href);
}
