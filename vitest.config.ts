// 单元测试使用 Node 环境，@ 别名与应用的 src/ 目录一致。
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // 集成文件都运行 Seed，串行避免同一测试库的固定故事互相改写。
  test: { fileParallelism: false, environment: "node", include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"] },
});
