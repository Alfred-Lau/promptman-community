#!/usr/bin/env node
/**
 * 构建并发布到阿里云 OSS
 *
 * 使用方式：
 *   node scripts/publish-to-oss.js --mac
 *   node scripts/publish-to-oss.js --win
 *   node scripts/publish-to-oss.js --mac --win
 *
 * 必须设置的环境变量（参考 .env.example）：
 *   OSS_REGION            - OSS 地域，如 oss-cn-hangzhou
 *   OSS_BUCKET            - Bucket 名称
 *   OSS_ACCESS_KEY_ID     - AccessKey ID
 *   OSS_ACCESS_KEY_SECRET - AccessKey Secret
 *   OSS_UPDATE_URL        - 公开访问基础 URL（需与 package.json 中的配置一致）
 *
 * 可选环境变量：
 *   OSS_PATH              - OSS 存储路径前缀（默认：releases）
 *   BUILD_DATE            - 构建日期（默认：今日，格式 YYYY-MM-DD）
 */
'use strict'

const { spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

// ==================== 环境变量校验 ====================

const REQUIRED_ENV = [
  'OSS_REGION',
  'OSS_BUCKET',
  'OSS_ACCESS_KEY_ID',
  'OSS_ACCESS_KEY_SECRET',
  'OSS_UPDATE_URL',
]

const missing = REQUIRED_ENV.filter((key) => !process.env[key])
if (missing.length > 0) {
  console.error('\n[OSS Publish] ✗ 缺少必要的环境变量：')
  missing.forEach((k) => console.error(`    ${k}`))
  console.error('\n请参考 .env.example 文件，使用 export 命令或 CI/CD 变量配置。\n')
  process.exit(1)
}

// ==================== 参数解析 ====================

const args = process.argv.slice(2)
const platformArgs = args.filter((a) => ['--mac', '--win', '--linux'].includes(a))

if (platformArgs.length === 0) {
  console.error('[OSS Publish] ✗ 请指定构建平台：--mac、--win 或 --linux')
  process.exit(1)
}

// ==================== 构建阶段 ====================

if (!process.env.BUILD_DATE) {
  const now = new Date()
  process.env.BUILD_DATE = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

const root = path.join(__dirname, '..')
const outDir = path.join(root, 'out')

// 清理 out/ 目录
try {
  fs.rmSync(outDir, { recursive: true, force: true })
} catch {
  // 目录不存在时忽略
}

console.log(`\n[OSS Publish] 平台: ${platformArgs.join(', ')}`)
console.log(`[OSS Publish] 构建日期: ${process.env.BUILD_DATE}`)
console.log(`[OSS Publish] 更新地址: ${process.env.OSS_UPDATE_URL}`)
console.log('[OSS Publish] 开始构建...\n')

// 创建临时配置文件，将 app-update.yml 中的 provider 覆盖为 generic（指向 OSS）。
// 否则打包产物默认使用 package.json 中的 github provider，打开应用检查更新时
// 会请求私有 GitHub 仓库的 releases.atom 而收到 404 错误。
const tempConfigPath = path.join(os.tmpdir(), `electron-builder-oss-${Date.now()}.json`)
fs.writeFileSync(tempConfigPath, JSON.stringify({
  publish: [{
    provider: 'generic',
    url: process.env.OSS_UPDATE_URL,
    channel: 'latest',
  }]
}))

const cli = path.join(root, 'node_modules', 'electron-builder', 'cli.js')
const buildResult = spawnSync(
  process.execPath,
  [cli, ...platformArgs, '--publish', 'never', '--config', tempConfigPath],
  {
    stdio: 'inherit',
    env: process.env,
    cwd: root,
  }
)

// 清理临时配置文件
try { fs.unlinkSync(tempConfigPath) } catch { /* 忽略 */ }

if (buildResult.status !== 0) {
  console.error('\n[OSS Publish] ✗ 构建失败，终止发布。')
  process.exit(buildResult.status ?? 1)
}

// ==================== 上传阶段 ====================

console.log('\n[OSS Publish] 构建完成，开始上传到阿里云 OSS...\n')

let OSS
try {
  OSS = require('ali-oss')
} catch {
  console.error('[OSS Publish] ✗ 找不到 ali-oss 依赖，请运行：pnpm add -D ali-oss')
  process.exit(1)
}

const ossPath = (process.env.OSS_PATH || 'releases').replace(/\/+$/, '')
const client = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
})

// 需要上传的文件后缀（安装包 + 更新元数据 + 分块映射）
const UPLOAD_EXTS = new Set(['.dmg', '.zip', '.exe', '.AppImage', '.deb', '.yml', '.blockmap'])

// electron-builder 调试/配置产物，不应出现在公开更新目录
const SKIP_FILES = new Set(['builder-debug.yml', 'builder-effective-config.yaml'])

function formatSize(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

async function run() {
  const allFiles = fs.readdirSync(outDir)
  const toUpload = allFiles.filter(
    (f) => UPLOAD_EXTS.has(path.extname(f)) && !SKIP_FILES.has(f)
  )

  if (toUpload.length === 0) {
    console.error('[OSS Publish] ✗ out/ 目录中未找到可上传的构建产物')
    process.exit(1)
  }

  // YAML 文件（更新元数据）最后上传，避免客户端读到尚未上传完成的安装包
  const sorted = [
    ...toUpload.filter((f) => !f.endsWith('.yml')),
    ...toUpload.filter((f) => f.endsWith('.yml')),
  ]

  console.log(`[OSS Publish] 共 ${sorted.length} 个文件待上传：\n`)

  for (const file of sorted) {
    const localPath = path.join(outDir, file)
    const ossKey = `${ossPath}/${file}`
    const isYaml = file.endsWith('.yml')
    const size = fs.statSync(localPath).size

    // YAML 元数据文件禁用缓存；安装包设置长期缓存（内容不可变）
    const headers = isYaml
      ? { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      : { 'Cache-Control': 'public, max-age=31536000, immutable' }

    process.stdout.write(`  ↑ ${file} (${formatSize(size)}) ...`)

    try {
      await client.put(ossKey, localPath, { headers })
      process.stdout.write(' ✓\n')
    } catch (err) {
      process.stdout.write(` ✗\n`)
      console.error(`[OSS Publish] 上传失败：${err.message}`)
      process.exit(1)
    }
  }

  console.log('\n[OSS Publish] ✓ 全部上传成功！')
  console.log(`[OSS Publish] Bucket:   oss://${process.env.OSS_BUCKET}/${ossPath}/`)
  console.log(`[OSS Publish] 更新地址: ${process.env.OSS_UPDATE_URL}\n`)
}

run().catch((err) => {
  console.error('[OSS Publish] ✗ 发布失败：', err.message)
  process.exit(1)
})
