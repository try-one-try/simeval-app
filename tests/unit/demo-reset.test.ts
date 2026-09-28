import { describe, expect, it } from "vitest";
import { validateDemoReset } from "@/lib/demo-reset";
const configuration = { DATABASE_URL: "postgres://user:fake@localhost/simeval_dev", DEMO_RESET_DATABASE: "simeval_dev" };
describe("专用演示库恢复门禁", () => {
  it("requires deliberate confirmation and a matching database", () => {
    expect(() => validateDemoReset(configuration, [])).toThrow();
    expect(() => validateDemoReset({ ...configuration, DEMO_RESET_DATABASE: "other" }, ["--confirm=RESET_DEMO_DATA"])).toThrow();
    expect(validateDemoReset(configuration, ["--confirm=RESET_DEMO_DATA"]).database).toBe("simeval_dev");
  });
  it("checks the actual maintenance connection and refuses system databases", () => {
    expect(() => validateDemoReset({ ...configuration, DIRECT_URL: "postgres://user:fake@localhost/other" }, ["--confirm=RESET_DEMO_DATA"])).toThrow();
    expect(() => validateDemoReset({ ...configuration, DATABASE_URL: "postgres://user:fake@localhost/postgres", DEMO_RESET_DATABASE: "postgres" }, ["--confirm=RESET_DEMO_DATA"])).toThrow();
  });
});
