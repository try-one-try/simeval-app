// 网页运行时的服务端配置入口；从环境变量读取连接 URL，再交给解析函数校验。
import "server-only";
import { databasePoolConfig } from "@/lib/database-url";

export function getDatabaseConnection() {
  return databasePoolConfig(process.env.DATABASE_URL);
}
