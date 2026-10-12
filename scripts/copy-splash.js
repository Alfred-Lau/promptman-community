#!/usr/bin/env node

/**
 * 跨平台复制 splash.html 到 dist-electron/main/
 * 替代 `cp electron/main/splash.html dist-electron/main/`
 */

const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'electron', 'main', 'splash.html')
const destDir = path.join(__dirname, '..', 'dist-electron', 'main')
const dest = path.join(destDir, 'splash.html')

if (!fs.existsSync(src)) {
  console.error(`❌ splash.html not found: ${src}`)
  process.exit(1)
}

// 确保目标目录存在
fs.mkdirSync(destDir, { recursive: true })

fs.copyFileSync(src, dest)
console.log('✅ splash.html copied to dist-electron/main/')
