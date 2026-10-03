/** 助手的名字、提示语和示例问题集中放这里，改文案不用改浮窗逻辑。 */
export const assistantContent = {
  name: "SimEval 助手",
  greeting: "一起，把结果看明白。",
  introduction: "从评测指标到异常证据，陪你理清每一步。",
  status: "评测调查 · 有据可查",
  suggestions: [
    { title: "读懂本次评测", description: "概括结果，说明值得关注的指标", prompt: "帮我概括当前评测的结果，有哪些指标需要关注？" },
    { title: "调查异常样本", description: "从异常记录中寻找可核对的线索", prompt: "当前任务有哪些异常样本值得优先复核？请列出证据。" },
    { title: "解释版本差异", description: "对照已选基线，理解指标变化", prompt: "与我选中的基线相比，当前版本有哪些变化？哪些结论还不能确定？" },
  ],
  guide: "先配置评测、确认数据质量，再创建模拟评测。完成后查看指标、按需对比基线、复核异常。助手只通过聊天解释当前任务记录，并给出证据链接。每个任务的系统评测报告在报告页生成与更新，由评测人员确认，不包含私人聊天。业务数据是合成演示，AI 分析仍需人工核对。",
} as const;

// 工作台共享入口会在换页后继续存在；退出或切换身份时，用此事件清除输入草稿。
export const ASSISTANT_RESET_EVENT = "simeval:assistant-reset";
