#!/usr/bin/env node
/**
 * Sets BUILD_DATE (local YYYY-MM-DD) for ${env.BUILD_DATE} in electron-builder artifactName.
 * Pass through all CLI args to electron-builder.
 *
 * macOS 若 codesign 报 errSecInternalComponent / unable to build chain：
 * 1) 在「终端.app」对登录钥匙串执行 security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k <密码> ~/Library/Keychains/login.keychain-db
 * 2) 钥匙串访问 → 展开「Developer ID Application」下的私钥 → 访问控制 → 允许 codesign
 * 3) 或从钥匙串导出含私钥的 .p12，设置 CSC_LINK、CSC_KEY_PASSWORD 后再打包（常用以绕过损坏的登录钥匙串）
 * 仅本地试跑可用：pnpm build:mac:unsigned（等价于 --config.mac.identity=null，不签名）
 */
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

if (!process.env.BUILD_DATE) {
  const now = new Date()
  process.env.BUILD_DATE = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

// package.json build.publish.url 使用 ${env.OSS_UPDATE_URL}；即使用 --publish never 也会做宏展开。
if (!process.env.OSS_UPDATE_URL) {
  process.env.OSS_UPDATE_URL = 'https://local-build.invalid/promptman'
}

const root = path.join(__dirname, '..')
const outDir = path.join(root, 'out')
try {
  fs.rmSync(outDir, { recursive: true, force: true })
} catch {
  // 忽略：目录不存在或权限问题由后续 builder 再报错
}

const cli = path.join(root, 'node_modules', 'electron-builder', 'cli.js')
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
  cwd: root,
})

process.exit(result.status ?? 1)
