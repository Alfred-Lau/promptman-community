#!/usr/bin/env node

/**
 * 清除 Hugging Face Transformers 模型缓存
 * 用于修复模型文件损坏的问题
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const cacheDir = path.join(
  os.homedir(),
  '.cache',
  'huggingface',
  'transformers'
);

// 也检查 node_modules 中的缓存
const nodeModulesCache = path.join(
  __dirname,
  '..',
  'node_modules',
  '.pnpm',
  '@huggingface+transformers@3.8.1',
  'node_modules',
  '@huggingface',
  'transformers',
  '.cache'
);

function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    console.log(`正在删除: ${dirPath}`);
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`✓ 已删除: ${dirPath}`);
  } else {
    console.log(`目录不存在，跳过: ${dirPath}`);
  }
}

console.log('开始清除模型缓存...\n');

// 清除用户目录下的缓存
if (fs.existsSync(cacheDir)) {
  const entries = fs.readdirSync(cacheDir);
  entries.forEach(entry => {
    const entryPath = path.join(cacheDir, entry);
    if (fs.statSync(entryPath).isDirectory()) {
      removeDir(entryPath);
    }
  });
} else {
  console.log(`缓存目录不存在: ${cacheDir}`);
}

// 清除 node_modules 中的缓存
removeDir(nodeModulesCache);

// 清除 Xenova 缓存
const xenovaCache = path.join(
  os.homedir(),
  '.cache',
  'xenova'
);

removeDir(xenovaCache);

console.log('\n✓ 模型缓存清除完成！');
console.log('请重新运行应用，模型将自动重新下载。');

