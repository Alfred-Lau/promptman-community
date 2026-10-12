#!/usr/bin/env node
/**
 * 构建并发布到 GitHub Releases
 *
 * 使用方式：
 *   node scripts/publish-to-github.js --mac
 *   node scripts/publish-to-github.js --win
 *   node scripts/publish-to-github.js --mac --win
 *
 * 必须设置的环境变量：
 *   GH_TOKEN  - GitHub Personal Access Token（需要 repo 权限）
 *               在 GitHub Actions 中可直接使用 GITHUB_TOKEN
 *
 * 可选环境变量：
 *   BUILD_DATE - 构建日期（默认：今日，格式 YYYY-MM-DD）
 *
 * 注意：发布配置现在由 package.json 的 build.publish 字段管理
 *   releaseType: "draft" — 发布为草稿，需在 GitHub Releases 页面手动确认
 *                "release" — 直接公开发布
 */
'use strict'

const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// ==================== 环境变量校验 ====================

const ghToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
if (!ghToken) {
  console.error('\n[GitHub Publish] ✗ 缺少 GH_TOKEN 或 GITHUB_TOKEN 环境变量')
  console.error('  本地发布：设置 GH_TOKEN=<your-token>（需要 repo 权限）')
  console.error('  GitHub Actions：使用 secrets.GITHUB_TOKEN 即可\n')
  process.exit(1)
}

// electron-builder 优先读取 GH_TOKEN
process.env.GH_TOKEN = ghToken

// ==================== 规范化签名相关环境变量 ====================
// GitHub Actions 对未配置的 secret 会注入空字符串，electron-builder 会将
// 空字符串当作文件路径去读，path.resolve('') 解析到 CWD，导致：
//   ⨯ /Users/runner/work/<repo>/<repo> not a file
// 这里主动删除空变量，恢复为"未定义"，让 electron-builder 跳过对应逻辑。
const signingEnvKeys = [
  'CSC_LINK',
  'CSC_KEY_PASSWORD',
  'WIN_CSC_LINK',
  'WIN_CSC_KEY_PASSWORD',
  'APPLE_ID',
  'APPLE_APP_SPECIFIC_PASSWORD',
  'APPLE_TEAM_ID',
]
for (const key of signingEnvKeys) {
  if (process.env[key] === '') delete process.env[key]
}

// ==================== 参数解析 ====================

const args = process.argv.slice(2)
const platformArgs = args.filter((a) => ['--mac', '--win', '--linux'].includes(a))

if (platformArgs.length === 0) {
  console.error('[GitHub Publish] ✗ 请指定构建平台：--mac、--win 或 --linux')
  process.exit(1)
}

// ==================== 无签名凭据时的兜底 ====================
// 未提供 CSC_LINK 时：
//   - 本地：如果 keychain 里有 Developer ID Application 证书，让
//     electron-builder 自动发现，保留签名 + 公证能力。
//   - CI：CI runner 一般无 keychain 证书，显式禁用 mac 签名，避免 electron-builder
//     回落到 keychain 自动发现失败。也可通过 DISABLE_MAC_SIGN=1 手动禁用。
const extraArgs = []

function hasKeychainDeveloperIdIdentity() {
  try {
    const res = spawnSync(
      'security',
      ['find-identity', '-v', '-p', 'codesigning'],
      { encoding: 'utf8' }
    )
    if (res.status !== 0) return false
    return /Developer ID Application/i.test(res.stdout || '')
  } catch {
    return false
  }
}

if (platformArgs.includes('--mac') && !process.env.CSC_LINK) {
  const inCI = !!process.env.CI
  const forceDisable = process.env.DISABLE_MAC_SIGN === '1'
  const hasKeychainIdentity = !inCI && !forceDisable && hasKeychainDeveloperIdIdentity()

  if (hasKeychainIdentity) {
    console.log(
      '[GitHub Publish] ✓ 未设置 CSC_LINK，但在 keychain 中检测到 Developer ID Application，使用本地证书签名'
    )
  } else {
    const reason = forceDisable
      ? 'DISABLE_MAC_SIGN=1'
      : inCI
        ? 'CI 环境'
        : '未检测到 CSC_LINK 且 keychain 中无 Developer ID Application 证书'
    console.log(`[GitHub Publish] ⚠ mac 构建将不签名（${reason}）`)
    extraArgs.push('--config.mac.identity=null')
  }
}
if (platformArgs.includes('--win') && !process.env.WIN_CSC_LINK) {
  console.log('[GitHub Publish] ⚠ 未检测到 WIN_CSC_LINK，win 构建将不签名')
}

// ==================== 环境准备 ====================

if (!process.env.BUILD_DATE) {
  const now = new Date()
  process.env.BUILD_DATE = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

// package.json build.publish 中使用了 ${env.OSS_UPDATE_URL}，给占位值避免模板展开报错
if (!process.env.OSS_UPDATE_URL) {
  process.env.OSS_UPDATE_URL = 'https://local-build.invalid/kithub'
}

// ==================== electron-builder 二进制镜像 ====================
// electron-builder 下载 dmg-builder、7zip 等辅助二进制时走的是
// app-builder-lib/out/binDownload.js → @electron/get。
//
// @electron/get 的 mirrorVar('mirror') 优先级（artifact-utils.js:23-38）：
//   1. npm_config_electron_mirror            ← .npmrc 里的 ELECTRON_MIRROR 会变成这个
//   2. NPM_CONFIG_ELECTRON_MIRROR
//   3. npm_config_electron_mirror（重复）
//   4. npm_package_config_electron_mirror
//   5. npm_package_config_electron_mirror
//   6. ELECTRON_MIRROR
//   7. options.mirror                        ← binDownload.js 传入的官方 GitHub 地址
//   8. defaultValue
//
// 关键坑：只要 (1)-(6) 任何一个指向 npmmirror，options.mirror 就永远不会生效，
// dmg-builder 的请求会被打到 npmmirror.com/mirrors/electron/dmg-builder@1.2.0/...
// 再 302 到 cdn.npmmirror.com/binaries/electron/...（404，因为 npmmirror 没同步
// electron-builder-binaries 仓库）。
//
// 所以本脚本里必须同时：
//   (A) 删除所有 electron_mirror 系列变量，让 @electron/get 走到第 7 优先级；
//   (B) 把 ELECTRON_BUILDER_BINARIES_MIRROR 三种大小写都显式设为官方 GitHub，
//       保证 binDownload.js 里 getBinariesMirrorUrl 返回的是官方地址。
//
// Electron 本体（electron-vXX-<arch>.zip）的下载也走 @electron/get，失去
// ELECTRON_MIRROR 后会直连 https://github.com/electron/electron/releases/download/。
// 如果本地已有缓存（~/Library/Caches/electron/），不会触发网络请求；如果没有，
// 国内直连 GitHub 会慢一些，可接受。
const OFFICIAL_BINARIES_MIRROR =
  'https://github.com/electron-userland/electron-builder-binaries/releases/download/'
const BAD_MIRROR_PATTERN = /npmmirror\.com|taobao\.org/i

// (A) 剥离所有可能把 @electron/get 指向 npmmirror 的变量。
const ELECTRON_MIRROR_ENV_KEYS = [
  'ELECTRON_MIRROR',
  'NPM_CONFIG_ELECTRON_MIRROR',
  'npm_config_electron_mirror',
  'npm_package_config_electron_mirror',
  'ELECTRON_CUSTOM_DIR',
  'NPM_CONFIG_ELECTRON_CUSTOM_DIR',
  'npm_config_electron_custom_dir',
  'ELECTRON_NIGHTLY_MIRROR',
]
const strippedMirrorKeys = []
for (const key of ELECTRON_MIRROR_ENV_KEYS) {
  const v = process.env[key]
  if (v && BAD_MIRROR_PATTERN.test(v)) {
    strippedMirrorKeys.push(`${key}=${v}`)
    delete process.env[key]
  }
}
if (strippedMirrorKeys.length > 0) {
  console.log(
    `[GitHub Publish] 剥离 npmmirror 类变量以避免劫持 @electron/get 下载：\n  - ${strippedMirrorKeys.join('\n  - ')}`
  )
}

// (B) 把 binaries mirror 三种大小写同时显式设为官方 GitHub。
const BINARIES_MIRROR_ENV_KEYS = [
  'ELECTRON_BUILDER_BINARIES_MIRROR',
  'NPM_CONFIG_ELECTRON_BUILDER_BINARIES_MIRROR',
  'npm_config_electron_builder_binaries_mirror',
]
let finalBinariesMirror = OFFICIAL_BINARIES_MIRROR
for (const key of BINARIES_MIRROR_ENV_KEYS) {
  const v = process.env[key]
  if (v && v.trim() && !BAD_MIRROR_PATTERN.test(v)) {
    finalBinariesMirror = v.trim()
    break
  }
}
for (const key of BINARIES_MIRROR_ENV_KEYS) {
  process.env[key] = finalBinariesMirror
}
console.log(
  `[GitHub Publish] ELECTRON_BUILDER_BINARIES_MIRROR=${finalBinariesMirror}`
)

// (C) 允许用预先下载好的 dmgbuild 绕过下载（治标手段）。
//     如果 CUSTOM_DMGBUILD_PATH 环境变量设了，dmg-builder 会直接用本地文件，
//     完全不走网络。参见：
//     node_modules/.pnpm/dmg-builder@*/node_modules/dmg-builder/out/dmgUtil.js:24
if (process.env.CUSTOM_DMGBUILD_PATH && process.env.CUSTOM_DMGBUILD_PATH.trim()) {
  console.log(
    `[GitHub Publish] CUSTOM_DMGBUILD_PATH=${process.env.CUSTOM_DMGBUILD_PATH.trim()}（使用本地 dmgbuild，跳过下载）`
  )
}

const root = path.join(__dirname, '..')
const outDir = path.join(root, 'out')

// 清理 out/ 目录
try {
  fs.rmSync(outDir, { recursive: true, force: true })
} catch {
  // 忽略
}

console.log(`\n[GitHub Publish] 平台: ${platformArgs.join(', ')}`)
console.log(`[GitHub Publish] 构建日期: ${process.env.BUILD_DATE}`)
console.log('[GitHub Publish] 使用 package.json build.publish 配置')
console.log('[GitHub Publish] 开始构建并发布到 GitHub Releases...\n')

// ==================== 构建 + 发布 ====================

const cli = path.join(root, 'node_modules', 'electron-builder', 'cli.js')
const result = spawnSync(
  process.execPath,
  [cli, ...platformArgs, ...extraArgs, '--publish', 'always'],
  {
    stdio: 'inherit',
    env: process.env,
    cwd: root,
  }
)

if (result.status !== 0) {
  console.error('\n[GitHub Publish] ✗ 构建或发布失败，请检查上方输出。')
  process.exit(result.status ?? 1)
}

console.log('\n[GitHub Publish] ✓ 发布成功！')
console.log('[GitHub Publish] 请访问以下地址查看 Release：')
console.log('[GitHub Publish] https://github.com/Alfred-Lau/promptman-community/releases\n')
