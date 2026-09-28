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
