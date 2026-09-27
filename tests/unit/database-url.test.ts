// 验证数据库 URL 的解析与拒绝规则；示例口令是测试假数据。
import { describe, expect, it } from "vitest";
import { parseDatabaseUrl, databasePoolConfig, getMaintenanceDatabaseUrl } from "@/lib/database-url";

describe("database connection configuration", () => {
  it("decodes credentials and uses the explicit port and database", () => {
    expect(parseDatabaseUrl("postgresql://demo:p%40ssword@127.0.0.1:5433/simeval_dev")).toEqual({
      host: "127.0.0.1",
      port: 5433,
      user: "demo",
      password: "p@ssword",
      database: "simeval_dev",
      connectionString: "postgresql://demo:p%40ssword@127.0.0.1:5433/simeval_dev",
    });
  });

  it("rejects other database engines and incomplete addresses without leaking credentials", () => {
    expect(parseDatabaseUrl("postgres://user:pass@localhost/test").port).toBe(5432);
    expect(() => parseDatabaseUrl("mysql://root@localhost/test")).toThrow();
    expect(() => parseDatabaseUrl("mysql://user:pass@localhost/")).toThrow();
  });

  it("keeps Neon TLS parameters and requires encrypted remote connections", () => {
    const url = "postgresql://user:fake-secret@ep-demo-pooler.example.com/neondb?sslmode=require&channel_binding=require";
    expect(databasePoolConfig(url)).toMatchObject({ connectionString: url, max: 5, connectionTimeoutMillis: 10_000 });
    expect(() => parseDatabaseUrl(url.replace("sslmode=require", "sslmode=disable"))).toThrow();
    expect(() => parseDatabaseUrl("postgres://user:fake-secret@remote.example.com/neondb")).toThrow();
    try { parseDatabaseUrl("mysql://user:private-value@remote/db"); } catch (error) { expect(String(error)).not.toContain("private-value"); }
  });

  it("prefers explicit direct URLs, accepts Neon native variables and falls back locally", () => {
    const pooled = "postgres://user:fake@localhost/pooled";
    const direct = "postgres://user:fake@localhost/direct";
    expect(getMaintenanceDatabaseUrl({ DIRECT_URL: direct, DATABASE_URL: pooled })).toBe(direct);
    expect(getMaintenanceDatabaseUrl({ DATABASE_URL_UNPOOLED: direct, DATABASE_URL: pooled })).toBe(direct);
    expect(getMaintenanceDatabaseUrl({ DATABASE_URL: pooled })).toBe(pooled);
  });
});
