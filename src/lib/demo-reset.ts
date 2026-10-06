// 维护命令必须显式确认并核对目标库名；校验期间不输出凭据。
import { getMaintenanceDatabaseUrl, parseDatabaseUrl } from "./database-url";

export function validateDemoReset(environment: Readonly<Record<string, string | undefined>>, arguments_: string[]) {
  const url = getMaintenanceDatabaseUrl(environment);
  const database = parseDatabaseUrl(url).database;
  if (!arguments_.includes("--confirm=RESET_DEMO_DATA")) throw new Error("请显式传入 --confirm=RESET_DEMO_DATA。");
  if (!environment.DEMO_RESET_DATABASE || environment.DEMO_RESET_DATABASE !== database || ["postgres", "template0", "template1"].includes(database)) {
    throw new Error("请将 DEMO_RESET_DATABASE 设置为专用演示库名，并核对直连地址。");
  }
  return { url, database };
}

// 只展示我们自己写的门禁说明；数据库的原始报错可能带 SQL 或连接密码，不能原样输出。
export class DemoResetGuardError extends Error {
  constructor(readonly reason: "NOT_DEMO_DATABASE" | "ACTIVE_ASSISTANT") {
    super(reason === "NOT_DEMO_DATABASE"
      ? "恢复只允许专用 SimEval 演示库，不能包含其他项目或真实用户。"
      : "请先停止进行中的助手分析，再恢复演示库。");
    this.name = "DemoResetGuardError";
  }
}

const resetFailureHints: Readonly<Record<string, string>> = {
  P2028: "数据库事务未能启动、已超时或被中断；结合失败阶段和耗时判断。",
  P1000: "数据库账号或密码未通过验证。", P1010: "数据库账号无权访问目标库。",
  P1001: "无法连接数据库服务器。", P1002: "连接数据库超时。",
  P1008: "数据库操作超时。", P1017: "数据库连接被关闭。",
  P2002: "默认数据与数据库唯一约束冲突。", P2003: "数据关联被外键约束拒绝。",
  P2021: "目标库缺少当前代码需要的表，请核对迁移状态。",
  P2022: "目标库缺少当前代码需要的字段，请核对迁移状态。",
  P2034: "事务发生并发冲突或死锁。",
  "28P01": "数据库账号或密码未通过验证。", "42501": "数据库账号缺少所需权限。",
  "42P01": "目标库缺少所需的表。", "42703": "目标库缺少所需的字段。",
  "23503": "数据关联被外键约束拒绝。", "23505": "默认数据与数据库唯一约束冲突。",
  "57014": "数据库取消了超时或被中止的操作。",
  ETIMEDOUT: "数据库网络连接超时。", ECONNREFUSED: "数据库连接被拒绝。",
  ECONNRESET: "数据库连接被中断。", ENOTFOUND: "数据库主机名无法解析。",
  EACCES: "当前运行环境不允许访问数据库网络。",
};

export function describeDemoResetFailure(error: unknown) {
  if (error instanceof DemoResetGuardError) return { code: error.reason, reason: error.message };
  const record = (value: unknown): Record<string, unknown> =>
    typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const root = record(error);
  const meta = record(root.meta);
  const adapterCause = record(record(meta.driverAdapterError).cause);
  const cause = record(root.cause);
  // Prisma 驱动有时把 PostgreSQL 错误码放在 meta 中；只取白名单代码，不打印整个错误对象。
  const codes = [root.code, cause.code, meta.code, adapterCause.originalCode, adapterCause.code]
    .filter((code): code is string => typeof code === "string" && Object.hasOwn(resetFailureHints, code));
  const code = codes.find(value => !value.startsWith("P")) ?? codes[0];
  // 只在内部识别 Prisma 的固定超时措辞，输出仍是固定中文文案。
  const messages = [root.message, meta.error].filter((value): value is string => typeof value === "string").join(" ");
  if (codes.includes("P2028") && messages.includes("Unable to start a transaction in the given time")) {
    return { code: "P2028", reason: "等待建立数据库事务超过了允许时间。" };
  }
  if (codes.includes("P2028") && messages.includes("expired transaction")) {
    return { code: "P2028", reason: "清理和重建数据超过了事务执行时间上限。" };
  }
  return { code: code ?? "UNKNOWN", reason: code ? resetFailureHints[code] : "未识别的恢复错误；请结合失败阶段继续排查。" };
}
