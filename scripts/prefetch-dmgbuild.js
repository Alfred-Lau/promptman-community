#!/usr/bin/env node
/**
 * 预先拉取 electron-builder 要用的 dmgbuild-bundle 到本地缓存，绕过构建时的网络请求。
 *
 * 背景：
 *   dmg-builder 要从
 *   https://github.com/electron-userland/electron-builder-binaries/releases/download/dmg-builder@1.2.0/
 *   下载 dmgbuild-bundle-{arm64|x86_64}-<hash>.tar.gz。但 @electron/get 的 mirrorVar
 *   优先级坑很多（见 publish-to-github.js 里的注释），在国内网络环境下经常被
 *   npmmirror 劫持到不存在的路径 404。
 *
 * 此脚本：
 *   1. 直接从官方 GitHub Release 下载 tar.gz（用 https.get，不走 @electron/get）；
 *   2. 解压到 electron-builder 的缓存目录 ~/Library/Caches/electron-builder/
 *      <releaseName>/<folderName>/；
 *   3. 写入 .complete 标记文件，让 binDownload.js 的缓存检查命中、跳过下载。
 *
 * 使用：
 *   node scripts/prefetch-dmgbuild.js           # 拉当前机器架构
 *   node scripts/prefetch-dmgbuild.js --all     # 同时拉 arm64 和 x86_64
 */
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const https = require('https')
const { execSync } = require('child_process')
const { createHash } = require('crypto')

// 版本信息与 dmg-builder@26.9.0 对应（dmgUtil.js:30-34）
const RELEASE_NAME = 'dmg-builder@1.2.0'
const RELEASE_VERSION = '75c8a6c'
const FILES = {
  arm64: {
    name: `dmgbuild-bundle-arm64-${RELEASE_VERSION}.tar.gz`,
    sha256:
      'a785f2a385c8c31996a089ef8e26361904b40c772d5ea65a36001212f1fc25e0',
  },
  x86_64: {
    name: `dmgbuild-bundle-x86_64-${RELEASE_VERSION}.tar.gz`,
    sha256:
      '87b3bb72148b11451ee90ede79cc8d59305c9173b68b0f2b50a3bea51fc4a4e2',
  },
}

// 跟 binDownload.js:hashUrlSafe 完全相同的算法（djb2 XOR），拼出 suffix。
function hashUrlSafe(input, length = 5) {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
  }
  hash >>>= 0
  const out = hash.toString(36)
  return out.length >= length ? out.slice(0, length) : out.padStart(length, '0')
}

function getCacheDir() {
  if (process.env.ELECTRON_BUILDER_CACHE && process.env.ELECTRON_BUILDER_CACHE.trim()) {
    return process.env.ELECTRON_BUILDER_CACHE.trim()
  }
  if (os.platform() === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Caches', 'electron-builder')
  }
  if (os.platform() === 'win32') {
    return path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'electron-builder', 'Cache')
  }
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'electron-builder')
}

function downloadWithRedirects(url, dest, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const fetch = (current, remaining) => {
      https
        .get(current, { headers: { 'User-Agent': 'prefetch-dmgbuild/1.0' } }, (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            if (remaining === 0) return reject(new Error('too many redirects'))
            res.resume()
            return fetch(new URL(res.headers.location, current).toString(), remaining - 1)
          }
          if (res.statusCode !== 200) {
            res.resume()
            return reject(new Error(`HTTP ${res.statusCode} for ${current}`))
          }
          const file = fs.createWriteStream(dest)
          res.pipe(file)
          file.on('finish', () => file.close(() => resolve()))
          file.on('error', reject)
        })
        .on('error', reject)
    }
    fetch(url, maxRedirects)
  })
}

function sha256File(p) {
  const h = createHash('sha256')
  h.update(fs.readFileSync(p))
  return h.digest('hex')
}

async function prefetchOne(archKey) {
  const { name: filename, sha256 } = FILES[archKey]
  const url = `https://github.com/electron-userland/electron-builder-binaries/releases/download/${RELEASE_NAME}/${filename}`
  const baseUrl = 'https://github.com/electron-userland/electron-builder-binaries/releases/download/'
  const suffix = hashUrlSafe(`${baseUrl}-${RELEASE_NAME}-${filename}`, 5)
  const folderName = `${filename.replace(/\.(tar\.gz|tgz)$/, '')}-${suffix}`
  const releaseDir = path.join(getCacheDir(), RELEASE_NAME)
  const extractDir = path.join(releaseDir, folderName)
  const completeMarker = `${extractDir}.complete`

  if (fs.existsSync(completeMarker)) {
    console.log(`[prefetch-dmgbuild] ✓ ${archKey} 已存在缓存，跳过：${extractDir}`)
    return
  }

  fs.mkdirSync(extractDir, { recursive: true })
  const tmpTarPath = path.join(releaseDir, filename)
  console.log(`[prefetch-dmgbuild] 下载 ${archKey}：${url}`)
  await downloadWithRedirects(url, tmpTarPath)

  const got = sha256File(tmpTarPath)
  if (got !== sha256) {
    fs.unlinkSync(tmpTarPath)
    throw new Error(`${archKey} sha256 mismatch: expected ${sha256}, got ${got}`)
  }
  console.log(`[prefetch-dmgbuild] sha256 校验通过（${got.slice(0, 12)}…）`)

  // 解压：--strip-components=1 对齐 binDownload.js 的 strip: 1
  execSync(`tar -xzf "${tmpTarPath}" -C "${extractDir}" --strip-components=1`, {
    stdio: 'inherit',
  })
  fs.unlinkSync(tmpTarPath)
  fs.writeFileSync(completeMarker, '')
  console.log(`[prefetch-dmgbuild] ✓ ${archKey} 已就绪：${extractDir}`)
}

async function main() {
  const all = process.argv.includes('--all')
  const currentArch = process.arch === 'arm64' ? 'arm64' : 'x86_64'
  const targets = all ? Object.keys(FILES) : [currentArch]
  for (const t of targets) {
    await prefetchOne(t)
  }
  console.log('\n[prefetch-dmgbuild] 完成。下次运行 release:github:mac 时 dmg-builder 将复用缓存，不会再触发网络下载。')
}

main().catch((e) => {
  console.error('[prefetch-dmgbuild] ✗', e.message || e)
  process.exit(1)
})
