// 验证数据库 URL 的解析与拒绝规则；示例口令是测试假数据。
import { describe, expect, it } from "vitest";
import { parseDatabaseUrl } from "@/lib/database-url";

describe("database connection configuration", () => {
  it("decodes credentials and uses the explicit port and database", () => {
    expect(parseDatabaseUrl("mysql://demo:p%40ssword@127.0.0.1:3307/simeval_dev")).toEqual({
      host: "127.0.0.1",
      port: 3307,
      user: "demo",
      password: "p@ssword",
      database: "simeval_dev",
    });
  });

  it("rejects non-MySQL URLs and missing credentials before opening a connection", () => {
    expect(() => parseDatabaseUrl("postgres://user:pass@localhost/test")).toThrow();
    expect(() => parseDatabaseUrl("mysql://root@localhost/test")).toThrow();
    expect(() => parseDatabaseUrl("mysql://user:pass@localhost/")).toThrow();
  });
});
