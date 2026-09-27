// 校验 PostgreSQL 地址并保留 TLS 等驱动参数；错误信息不包含真实连接或密码。
export function parseDatabaseUrl(input: unknown) {
  try {
    if (typeof input !== "string") throw new Error();
    const url = new URL(input);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
    if (!url.hostname || !url.username || !url.password || !url.pathname.slice(1)) throw new Error();
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (!local && !["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? "")) throw new Error();
    const port = url.port ? Number(url.port) : 5432;
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
    return {
      host: url.hostname, port,
      user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)), connectionString: input,
    };
  } catch {
    throw new Error("数据库连接配置无效：需要完整 PostgreSQL 地址；远程连接必须启用 TLS。");
  }
}

// Neon 网页连接池与 CLI 直连分开；本地 PostgreSQL 可共用一个地址。
export function getMaintenanceDatabaseUrl(environment: Readonly<Record<string, string | undefined>>) {
  return parseDatabaseUrl(environment.DIRECT_URL || environment.DATABASE_URL_UNPOOLED || environment.DATABASE_URL).connectionString;
}

export function databasePoolConfig(input: unknown, max = 5) {
  return { connectionString: parseDatabaseUrl(input).connectionString, max, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000 };
}
