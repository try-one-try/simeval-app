// 静态检查采用 Next.js 与 TypeScript 规则，并排除构建、生成代码和覆盖率产物。
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/prisma/**", "coverage/**"]),
]);
