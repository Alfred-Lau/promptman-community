#!/usr/bin/env node

/**
 * 跨平台的静态文件复制脚本
 * 替代 `cp -r dist/static dist/standalone/files/promptman/dist/`
 * 兼容 Windows 和 macOS/Linux
 *
 * 复制内容：
 *  1. dist/static  → dist/standalone/.../dist/static   (_next/static JS/CSS)
 *  2. public/      → dist/standalone/.../public/       (图标、字体等静态资源)
 */

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const standaloneRoot = path.join(root, 'dist', 'standalone')

// 1. _next/static 资源
const staticSrc  = path.join(root, 'dist', 'static')
const staticDest = path.join(standaloneRoot, 'dist', 'static')

// 2. public/ 资源
const publicSrc  = path.join(root, 'public')
const publicDest = path.join(standaloneRoot, 'public')

function copyDirSync(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true })
  const entries = fs.readdirSync(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath  = path.join(srcDir,  entry.name)
    const destPath = path.join(destDir, entry.name)
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// ── 1. 复制 _next/static ──────────────────────────────────────
if (!fs.existsSync(staticSrc)) {
  console.error(`❌ Source directory not found: ${staticSrc}`)
  console.error('   Please run "pnpm build:next" first.')
  process.exit(1)
}

console.log('📦 Copying _next/static files...')
console.log(`   From: ${staticSrc}`)
console.log(`   To:   ${staticDest}`)

try {
  copyDirSync(staticSrc, staticDest)
  console.log('✅ Static files copied successfully.')
} catch (error) {
  console.error('❌ Failed to copy static files:', error.message)
  process.exit(1)
}

// ── 2. 复制 public/ ───────────────────────────────────────────
if (!fs.existsSync(publicSrc)) {
  console.warn('⚠️  public/ directory not found, skipping.')
} else {
  console.log('📦 Copying public/ assets...')
  console.log(`   From: ${publicSrc}`)
  console.log(`   To:   ${publicDest}`)
  try {
    copyDirSync(publicSrc, publicDest)
    console.log('✅ Public assets copied successfully.')
  } catch (error) {
    console.error('❌ Failed to copy public assets:', error.message)
    process.exit(1)
  }
}
