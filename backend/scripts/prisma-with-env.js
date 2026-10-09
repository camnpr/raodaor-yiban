#!/usr/bin/env node
/**
 * Prisma 环境变量加载器
 *
 * 按环境加载 .env.development / .env.production，注入 process.env 后运行 prisma 命令。
 * 不依赖 dotenv-cli / Prisma --env-file，纯 Node 实现。
 *
 * 用法：
 *   node scripts/prisma-with-env.js generate              → 加载 .env.development + prisma generate
 *   node scripts/prisma-with-env.js migrate dev           → 加载 .env.development + prisma migrate dev
 *   node scripts/prisma-with-env.js --prod migrate deploy → 加载 .env.production + prisma migrate deploy
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const isProd = process.argv.includes('--prod');
const env = isProd ? 'production' : 'development';
const envPath = path.join(__dirname, '..', `.env.${env}`);

if (!fs.existsSync(envPath)) {
  console.error(`[prisma-env] 环境文件不存在: ${envPath}`);
  process.exit(1);
}

// 解析 env 文件，注入 process.env（不覆盖系统已有的同名变量）
// 去掉 UTF-8 BOM（EF BB BF），避免首行变量名被污染（如 "DATABASE_URL"）
const content = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
for (const line of content.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  if (!(key in process.env)) process.env[key] = val;
}

// 移除 --prod 标志，剩余参数作为 prisma 命令参数
const rawArgs = process.argv.slice(2).filter((a) => a !== '--prod');

try {
  execFileSync('prisma', rawArgs, { stdio: 'inherit', env: process.env, shell: true });
} catch (e) {
  process.exit(e.status || 1);
}
