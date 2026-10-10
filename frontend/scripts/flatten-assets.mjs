#!/usr/bin/env node
/*
 * 打包后处理：把 dist 中「深层嵌套」的静态资源压平到浅层，并同步修正产物里的引用。
 *
 * ## 为什么需要它
 *
 * Expo 导出 web 时，资源按**真实文件位置**落盘（见 @expo/cli 的 metroAssetLocalPath.js：
 * 把 `assets/../node_modules/...` 中的 `../` 转义成 `_`）。而 pnpm 默认的隔离式（isolated）
 * 布局把包真身放在：
 *
 *   node_modules/.pnpm/<pkg>@<ver>_<hash>/node_modules/<pkg>/...
 *
 * 于是产物里出现超深路径：
 *
 *   dist/assets/_node_modules/.pnpm/@expo+vector-icons@15.1.1_e_38cc…/node_modules/
 *     @expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.<hash>.ttf
 *
 * 相对 dist 长达 **224 字符** → 目标 IIS 站点根目录只要超过 36 字符（260 − 224）就突破
 * Windows MAX_PATH(260)，整棵 dist 无法复制到 Windows Server。
 *
 * ## 本脚本做什么
 *
 * 1. 遍历 dist，找出 `assets/` 下**深层嵌套**的资源（已处于 `assets/` 或 `assets/fonts/` 的跳过）；
 * 2. 字体（.ttf/.otf/.woff/.woff2/.eot）→ `assets/fonts/<名称>`，其它类型 → `assets/<名称>`；
 * 3. 在所有文本产物（.js/.html/.json/.css/.map/.txt/.webmanifest）中把旧 URL 字面量替换为新 URL
 *    （同时覆盖 `/`、`\`、`\\` 三种斜杠写法）；
 * 4. 清理因此变空的目录；
 * 5. **自检**：若产物中仍残留旧路径引用，或文件未落到目标位置 → 打印错误并以非零码退出，
 *    让构建失败（宁可构建失败，也不要部署出静默坏掉的 bundle）。
 *
 * 幂等：已压平则不做任何改动。撤销：重新执行 `pnpm build`（dist 会重建）。
 *
 * ## 用法
 *
 *   node scripts/flatten-assets.mjs                  # 处理 ./dist
 *   node scripts/flatten-assets.mjs --dry-run        # 只打印计划，不写盘
 *   node scripts/flatten-assets.mjs --dist build     # 指定产物目录
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');

/** 字体后缀 → 统一收敛到 assets/fonts */
const FONT_EXT = new Set(['.ttf', '.otf', '.woff', '.woff2', '.eot']);
/** 会被扫描并改写引用的文本产物后缀 */
const TEXT_EXT = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.html',
  '.htm',
  '.json',
  '.css',
  '.map',
  '.txt',
  '.webmanifest',
]);

const ASSETS_DIR = 'assets';
const FONT_DIR = 'assets/fonts';

const log = (...args) => console.log('[flatten-assets]', ...args);

function fail(message) {
  console.error('[flatten-assets] ❌', message);
  process.exitCode = 1;
}

function parseArgs(argv) {
  let dist = 'dist';
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--dist') {
      dist = argv[i + 1] ?? dist;
      i += 1;
    } else if (arg.startsWith('--dist=')) {
      dist = arg.slice('--dist='.length);
    }
  }
  return { distDir: path.resolve(PROJECT_ROOT, dist), dryRun };
}

function walkFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(abs));
    } else {
      out.push(abs);
    }
  }
  return out;
}

const toPosix = (value) => value.split(path.sep).join('/');
const toAbs = (distDir, posixRel) => path.join(distDir, ...posixRel.split('/'));

/** 同一路径在产物里可能的三种字面量写法（JS 字符串 / JSON 中会出现转义） */
function slashVariants(posixPath) {
  return [posixPath, posixPath.replace(/\//g, '\\'), posixPath.replace(/\//g, '\\\\')];
}

/** 纯字符串替换（不用正则，避免路径里的 @ + . 等字符被当元字符） */
function replaceAllLiterals(text, needle, replacement) {
  if (!needle) return { text, count: 0 };
  const parts = text.split(needle);
  if (parts.length === 1) return { text, count: 0 };
  return { text: parts.join(replacement), count: parts.length - 1 };
}

function longestRelPath(files, distDir) {
  let max = 0;
  let sample = '';
  for (const abs of files) {
    const relPath = toPosix(path.relative(distDir, abs));
    if (relPath.length > max) {
      max = relPath.length;
      sample = relPath;
    }
  }
  return { max, sample };
}

/** 自底向上删除空目录（不删 dir 自身） */
function pruneEmptyDirs(dir) {
  let removed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const abs = path.join(dir, entry.name);
    removed += pruneEmptyDirs(abs);
    if (fs.readdirSync(abs).length === 0) {
      fs.rmdirSync(abs);
      removed += 1;
    }
  }
  return removed;
}

function main() {
  const { distDir, dryRun } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(distDir) || !fs.statSync(distDir).isDirectory()) {
    fail(`未找到产物目录：${distDir}（请先执行 expo export / pnpm build）`);
    return;
  }

  const before = longestRelPath(walkFiles(distDir), distDir);
  log(`产物目录：${distDir}${dryRun ? '（dry-run，不写盘）' : ''}`);

  const allFiles = walkFiles(distDir);
  const textFiles = allFiles.filter((abs) => TEXT_EXT.has(path.extname(abs).toLowerCase()));

  // ── 1) 找出 assets/ 下的深层嵌套资源 ────────────────────────────────────────
  const moves = [];
  for (const abs of allFiles) {
    const relPath = toPosix(path.relative(distDir, abs));
    if (!relPath.startsWith(`${ASSETS_DIR}/`)) continue;
    const dir = path.posix.dirname(relPath);
    if (dir === ASSETS_DIR || dir === FONT_DIR) continue; // 已在浅层，跳过
    const isFont = FONT_EXT.has(path.posix.extname(relPath).toLowerCase());
    moves.push({
      from: relPath,
      base: path.posix.basename(relPath),
      to: '',
      isFont,
      targetDir: isFont ? FONT_DIR : ASSETS_DIR,
    });
  }

  log(`扫描：${allFiles.length} 个文件（文本产物 ${textFiles.length}），assets/ 深层资源 ${moves.length} 个`);
  log(`最长相对路径（处理前）：${before.max} 字符`);

  if (moves.length === 0) {
    log('✅ 无需处理：assets/ 下已无深层嵌套资源');
    return;
  }

  // ── 2) 计算目标名（同名冲突时加稳定序号，保证重复执行结果一致）──────────────
  moves.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  const taken = new Set();
  for (const dir of [ASSETS_DIR, FONT_DIR]) {
    const abs = toAbs(distDir, dir);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) taken.add(`${dir}/${name}`);
  }
  for (const move of moves) {
    let name = move.base;
    if (taken.has(`${move.targetDir}/${name}`)) {
      const ext = path.posix.extname(name);
      const stem = name.slice(0, name.length - ext.length);
      let seq = 2;
      while (taken.has(`${move.targetDir}/${stem}-${seq}${ext}`)) seq += 1;
      name = `${stem}-${seq}${ext}`;
      log(`⚠️ 目标同名冲突，重命名：${move.base} → ${name}`);
    }
    move.to = `${move.targetDir}/${name}`;
    taken.add(move.to);
  }

  const fontCount = moves.filter((move) => move.isFont).length;
  log(`压平资源 ${moves.length} 个（字体 ${fontCount}，其它 ${moves.length - fontCount}）`);
  for (const move of moves.slice(0, 5)) log(`  ${move.from}\n      → ${move.to}`);
  if (moves.length > 5) log(`  … 其余 ${moves.length - 5} 个同理`);

  if (dryRun) {
    log('dry-run 结束：未改动任何文件');
    return;
  }

  // ── 3) 移动文件 ───────────────────────────────────────────────────────────
  for (const move of moves) {
    const src = toAbs(distDir, move.from);
    const dest = toAbs(distDir, move.to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      fs.renameSync(src, dest);
    } catch {
      // 跨盘符等场景回退为「复制 + 删除」
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
    }
  }

  // ── 4) 改写产物中的引用（长路径优先，避免前缀互相干扰）──────────────────────
  const pairs = moves
    .map((move) => ({ from: move.from, to: move.to }))
    .sort((a, b) => b.from.length - a.from.length);

  let changedFiles = 0;
  let replacedCount = 0;
  for (const abs of textFiles) {
    let text = fs.readFileSync(abs, 'utf8');
    let hits = 0;
    for (const pair of pairs) {
      const fromVariants = slashVariants(pair.from);
      const toVariants = slashVariants(pair.to);
      for (let v = 0; v < fromVariants.length; v += 1) {
        const result = replaceAllLiterals(text, fromVariants[v], toVariants[v]);
        text = result.text;
        hits += result.count;
      }
    }
    if (hits > 0) {
      fs.writeFileSync(abs, text);
      changedFiles += 1;
      replacedCount += hits;
    }
  }

  // ── 5) 清理空目录 ─────────────────────────────────────────────────────────
  const assetsAbs = toAbs(distDir, ASSETS_DIR);
  const pruned = fs.existsSync(assetsAbs) ? pruneEmptyDirs(assetsAbs) : 0;

  // ── 6) 自检（失败即让构建非零退出，避免部署出静默坏掉的 bundle）─────────────
  const strayFiles = moves
    .map((move) => move.to)
    .filter((relPath) => !fs.existsSync(toAbs(distDir, relPath)));
  if (strayFiles.length > 0) {
    fail(`有 ${strayFiles.length} 个文件未落到目标位置（示例：${strayFiles[0]}）`);
  }

  const needles = new Set();
  for (const pair of pairs) {
    for (const variant of slashVariants(pair.from)) needles.add(variant);
  }
  const leftovers = [];
  for (const abs of textFiles) {
    const text = fs.readFileSync(abs, 'utf8');
    for (const needle of needles) {
      if (text.includes(needle)) {
        leftovers.push(`${toPosix(path.relative(distDir, abs))} ← ${needle}`);
        break;
      }
    }
  }
  if (leftovers.length > 0) {
    fail(
      `自检未通过：仍有 ${leftovers.length} 个产物文件残留旧路径引用（示例：${leftovers[0]}）。` +
        '请检查是否有产物未被 TEXT_EXT 覆盖。',
    );
  } else {
    log('✅ 自检通过：无残留旧路径引用');
  }

  const after = longestRelPath(walkFiles(distDir), distDir);
  log(
    `移动 ${moves.length} 个，改写 ${replacedCount} 处引用（涉及 ${changedFiles} 个文件），清理空目录 ${pruned} 个`,
  );
  log(`最长相对路径：${before.max} → ${after.max} 字符`);
  log(`  处理后最长：${after.sample}`);
  log(process.exitCode ? '❌ 完成，但自检失败（见上方错误）' : '✅ 完成');
}

main();
