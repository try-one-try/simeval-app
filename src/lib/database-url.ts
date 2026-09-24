// 解析 DATABASE_URL：把地址拆成驱动需要的主机、账号、密码和库名；不记录或输出密码。
import { z } from "zod";

const databaseUrlSchema = z.string().url().refine((value) => value.startsWith("mysql://"), {
  message: "DATABASE_URL must use mysql://",
});

export function parseDatabaseUrl(input: unknown) {
  const url = new URL(databaseUrlSchema.parse(input));
  if (!url.hostname || !url.username || !url.password || !url.pathname.slice(1)) {
    throw new Error("DATABASE_URL is missing host, user, password, or database");
  }

  const port = url.port ? Number(url.port) : 3306;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DATABASE_URL has an invalid port");
  }

  return {
    host: url.hostname,
    port,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
  };
}
