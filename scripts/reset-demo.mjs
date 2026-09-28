// 两个 PowerShell 入口共用的安全启动器：只选环境、核对目标，再调用已有恢复程序。
// 数据清理和 Seed 在 prisma/reset-demo.ts → reset-data.ts 中的同一数据库事务完成。
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
const checkOnly = process.argv.length === 4 && process.argv[3] === '--check';
// 固定当前线上端点，防止把改错的 .env 文件当作 Production；Neon 重建主分支后须人工更新。
const productionHost = 'ep-quiet-bar-b8hki12i.c-14.us-east-1.aws.neon.tech';

if (!['dev', 'production'].includes(target) || (process.argv.length > 3 && !checkOnly)) {
  console.error('用法：reset-dev-demo.ps1 或 reset-production-demo.ps1 [--check]');
  process.exit(1);
}

const envFile = target === 'dev' ? '.env.local' : '.env.production.local';
let configuration;
try {
  // 直接读取指定文件，避免当前终端残留的 DATABASE_URL 抢先于目标文件生效。
  configuration = parseEnv(readFileSync(join(projectRoot, envFile), 'utf8'));
} catch {
  console.error(`找不到或无法读取 ${envFile}，未修改数据库。`);
  process.exit(1);
}

function checkedUrl(value) {
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.username || !url.password) throw new Error();
    if (!['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode'))) throw new Error();
    if (decodeURIComponent(url.pathname.slice(1)) !== 'neondb') throw new Error();
    return url;
  } catch {
    // 错误消息只说哪项配置不合格，不打印含密码的 URL。
    throw new Error(`${envFile} 需要完整的 Neon PostgreSQL neondb 地址，并启用 TLS。`);
  }
}

try {
  if (!configuration.DATABASE_URL || !configuration.DIRECT_URL) throw new Error(`${envFile} 缺少 DATABASE_URL 或 DIRECT_URL。`);
  const pooled = checkedUrl(configuration.DATABASE_URL);
  const direct = checkedUrl(configuration.DIRECT_URL);
  // Neon 池化和直连主机只差 -pooler；必须是同一分支、同一库、同一账号。
  const directFromPooled = pooled.hostname.replace('-pooler.', '.');
  if (directFromPooled !== direct.hostname || pooled.username !== direct.username || pooled.password !== direct.password || pooled.port !== direct.port) {
    throw new Error(`${envFile} 的池化地址与直连地址不属于同一数据库连接。`);
  }
  if (target === 'production' && direct.hostname !== productionHost) {
    throw new Error('生产地址与已核对的 Neon Production 端点不符；若重建了生产分支，请先审核并更新此脚本。');
  }
  if (target === 'dev' && direct.hostname === productionHost) {
    throw new Error('.env.local 指向线上 Production 端点，已拒绝恢复。');
  }

  console.log(`环境：${target === 'dev' ? 'Neon dev' : 'Neon Production'}`);
  console.log(`配置文件：${envFile}`);
  console.log(`数据库：neondb；直连主机：${direct.hostname}`);
  console.log('影响：删除新增任务和人工改动，保留表结构，然后恢复默认 Seed。');
  if (checkOnly) {
    console.log('仅检查配置：未连接数据库，未修改数据。');
    process.exit(0);
  }

  if (target === 'production') {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    let answer;
    try {
      answer = await prompt.question('确认线上目标无误后，输入 RESET_PRODUCTION 继续：');
    } finally {
      prompt.close();
    }
    if (answer !== 'RESET_PRODUCTION') throw new Error('未输入确认词，已取消恢复。');
  }

  // 子进程只使用目标文件的连接；父终端环境变量和配置文件本身都不改动。
  const childEnvironment = { ...process.env };
  delete childEnvironment.DATABASE_URL;
  delete childEnvironment.DIRECT_URL;
  delete childEnvironment.DATABASE_URL_UNPOOLED;
  Object.assign(childEnvironment, configuration);
  // 原 CLI 要求显式传入目标库名和确认参数；用户不必记住那串较长的原始命令。
  childEnvironment.DEMO_RESET_DATABASE = 'neondb';
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'prisma/reset-demo.ts', '--confirm=RESET_DEMO_DATA'], {
    cwd: projectRoot, env: childEnvironment, stdio: 'inherit',
  });
  if (result.error) throw new Error('无法启动恢复程序；请先在项目中运行 npm ci。');
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
