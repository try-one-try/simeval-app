// 显式运行数据库集成测试：没有独立测试库配置时直接失败，避免“跳过”被误读成通过。
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!process.env.TEST_DATABASE_URL && !existsSync('.env.test.local')) {
  console.error('缺少 .env.test.local：先运行 .\\scripts\\setup-local-db.ps1 -Database test。');
  process.exit(1);
}

try {
  execFileSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/integration', '--no-file-parallelism'], { stdio: 'inherit' });
} catch (error) {
  process.exitCode = error?.status || 1;
}
