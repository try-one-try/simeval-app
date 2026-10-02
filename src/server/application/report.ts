// 报告能力独立于模型调用；保存和确认不会再次消耗模型额度。
import "server-only";
import { reportRepository } from "@/server/repositories/report-repository";
export const reportService = reportRepository;
