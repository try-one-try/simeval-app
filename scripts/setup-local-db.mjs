// 一次性本机初始化：管理员只负责建库和授权；应用始终使用生成的受限账号。
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import mysql from 'mysql2/promise';

const mode = process.argv[2];
const settings = {
  dev: { database: 'simeval_dev', user: 'simeval_user', envFile: '.env.local' },
  test: { database: 'simeval_test', user: 'simeval_test_user', envFile: '.env.test.local' },
}[mode];

async function main() {
  if (!settings) throw new Error('MODE_REQUIRED');
  if (!existsSync(resolve('node_modules'))) throw new Error('RUN_NPM_CI_FIRST');
  if (existsSync(resolve(settings.envFile))) throw new Error('ENV_FILE_EXISTS');
  if (mode === 'test' && !existsSync(resolve('.env.local'))) throw new Error('DEV_ENV_REQUIRED_FOR_TEST_SEED');

  const adminPassword = process.env.SIMEVAL_DB_ADMIN_PASSWORD;
  if (!adminPassword) throw new Error('ADMIN_PASSWORD_REQUIRED');
  const host = process.env.SIMEVAL_DB_ADMIN_HOST || '127.0.0.1';
  const port = Number(process.env.SIMEVAL_DB_ADMIN_PORT || 3306);
  const user = process.env.SIMEVAL_DB_ADMIN_USER || 'root';
  if (host !== '127.0.0.1' && host !== 'localhost') throw new Error('LOCAL_MYSQL_ONLY');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_PORT');

  const dbPassword = randomBytes(24).toString('hex');
  const authSecret = mode === 'dev' ? randomBytes(48).toString('base64url') : null;
  const demoPassword = mode === 'dev' ? randomBytes(24).toString('base64url') : null;
  const account = `'${settings.user}'@'127.0.0.1'`;
  const admin = await mysql.createConnection({ host, port, user, password: adminPassword });
  try {
    // 库名、账号和密码均由程序固定或随机生成，不拼接外部任意 SQL 输入。
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${settings.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await admin.query(`CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY '${dbPassword}'`);
    await admin.query(`ALTER USER ${account} IDENTIFIED BY '${dbPassword}'`);
    await admin.query(`GRANT ALL PRIVILEGES ON \`${settings.database}\`.* TO ${account}`);
  } finally {
    await admin.end();
  }

  const databaseUrl = `mysql://${settings.user}:${dbPassword}@127.0.0.1:${port}/${settings.database}`;
  const content = mode === 'dev'
    ? `# 本机开发专用，Git 已忽略。账号密码由初始化脚本生成。\nDATABASE_URL="${databaseUrl}"\nAUTH_SECRET="${authSecret}"\nDEMO_PASSWORD="${demoPassword}"\n# 仅可信 localhost 的 npm run start 预览时启用。\n# AUTH_TRUST_HOST="true"\n`
    : `# 独立测试库专用，Git 已忽略。\nTEST_DATABASE_URL="${databaseUrl}"\n`;
  await writeFile(resolve(settings.envFile), content, { flag: 'wx', mode: 0o600 });

  const { SIMEVAL_DB_ADMIN_PASSWORD: unused, ...childEnv } = process.env;
  void unused;
  const env = { ...childEnv, DATABASE_URL: databaseUrl };

  // 开发模式准备可运行应用；测试模式只准备独立库，测试由显式命令启动。
  if (mode === 'dev') {
    env.DEMO_PASSWORD = demoPassword;
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env, stdio: 'inherit' });
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'seed'], { env, stdio: 'inherit' });
    console.log('本机开发库、账号、环境文件、迁移和 Seed 已准备好。运行 npm run dev 即可启动。');
  } else {
    console.log('独立测试库、账号和 .env.test.local 已准备好。运行 npm run test:integration 开始测试。');
  }
}

main().catch((error) => {
  // 避免把连接字符串、SQL 或管理员密码写入终端。
  console.error(`本机数据库初始化失败：${error?.code || error?.message?.match(/^[A-Z_]+$/)?.[0] || '请检查 MySQL 管理员连接与权限'}`);
  process.exitCode = 1;
});
