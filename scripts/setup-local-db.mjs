// 可选的本机 PostgreSQL 初始化；Neon 用户直接配置连接，无需运行管理员建库脚本。
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import pg from 'pg';
const mode = process.argv[2];
const settings = { dev: { database: 'simeval_dev', user: 'simeval_user', envFile: '.env.local' }, test: { database: 'simeval_test', user: 'simeval_test_user', envFile: '.env.test.local' } }[mode];
async function main() {
  if (!settings) throw new Error('MODE_REQUIRED');
  if (!existsSync('node_modules')) throw new Error('RUN_NPM_CI_FIRST');
  if (existsSync(settings.envFile)) throw new Error('ENV_FILE_EXISTS');
  if (mode === 'test' && !existsSync('.env.local')) throw new Error('DEV_ENV_REQUIRED_FOR_TEST_SEED');
  const password = process.env.SIMEVAL_DB_ADMIN_PASSWORD;
  if (!password) throw new Error('ADMIN_PASSWORD_REQUIRED');
  const host = process.env.SIMEVAL_DB_ADMIN_HOST || '127.0.0.1';
  const port = Number(process.env.SIMEVAL_DB_ADMIN_PORT || 5432);
  if (!['127.0.0.1','localhost'].includes(host)) throw new Error('LOCAL_POSTGRESQL_ONLY');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_PORT');
  const dbPassword = randomBytes(24).toString('hex');
  const admin = new pg.Client({host, port, user: process.env.SIMEVAL_DB_ADMIN_USER || 'postgres', password, database:'postgres', connectionTimeoutMillis:10000});
  await admin.connect();
  try {
    const role = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [settings.user]);
    const database = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [settings.database]);
    // 已有账号或库时拒绝重新设密码，避免破坏别的环境；已有库可手动填写连接。
    if (role.rowCount || database.rowCount) throw new Error('LOCAL_OBJECT_EXISTS_USE_MANUAL_CONFIG');
    await admin.query('CREATE ROLE "' + settings.user + '" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD \'' + dbPassword + '\'');
    await admin.query('CREATE DATABASE "' + settings.database + '" OWNER "' + settings.user + '"');
  } finally { await admin.end(); }
  const databaseUrl = 'postgresql://' + settings.user + ':' + dbPassword + '@127.0.0.1:' + port + '/' + settings.database;
  const demoPassword = mode === 'dev' ? randomBytes(24).toString('base64url') : null;
  const content = mode === 'dev'
    ? '# 本地真实值，Git 已忽略。\nDATABASE_URL="' + databaseUrl + '"\nDIRECT_URL="' + databaseUrl + '"\nAUTH_SECRET="' + randomBytes(48).toString('base64url') + '"\nDEMO_PASSWORD="' + demoPassword + '"\n'
    : '# 独立测试库，Git 已忽略。\nTEST_DATABASE_URL="' + databaseUrl + '"\n';
  await writeFile(settings.envFile, content, {flag:'wx',mode:0o600});
  const environment = {...process.env, DATABASE_URL:databaseUrl, DIRECT_URL:databaseUrl, DATABASE_URL_UNPOOLED:databaseUrl};
  delete environment.SIMEVAL_DB_ADMIN_PASSWORD;
  if (mode === 'dev') {
    environment.DEMO_PASSWORD = demoPassword;
    for (const arguments_ of [['migrate','deploy'],['db','seed']]) execFileSync(process.execPath, ['node_modules/prisma/build/index.js',...arguments_], {env:environment,stdio:'inherit'});
    console.log('本地 PostgreSQL 与演示数据已准备好，运行 npm run dev。');
  } else console.log('独立 PostgreSQL 测试库已准备好，运行 npm run test:integration。');
}
main().catch(error => {
  console.error('本机初始化失败：' + (error?.message?.match(/^[A-Z_]+$/)?.[0] || '请核对 PostgreSQL 管理员连接与权限'));
  process.exitCode = 1;
});
