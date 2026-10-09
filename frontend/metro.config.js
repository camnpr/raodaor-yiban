const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
// pnpm monorepo 工作区根（frontend 的 node_modules 是符号链接，真实包在工作区根）
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// 监视整个工作区（monorepo 标准做法）
config.watchFolders = [workspaceRoot];

// 解析顺序：先 frontend 自身 node_modules，再工作区根 node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
