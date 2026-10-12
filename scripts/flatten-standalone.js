#!/usr/bin/env node
/**
 * 解引用 dist/standalone/ 下所有符号链接（主要是 pnpm 生成的 node_modules 链接）。
 *
 * 背景：
 *   Next.js standalone 输出的 node_modules/ 采用 pnpm 的符号链接布局：
 *     node_modules/next        -> ../.pnpm/next@x/node_modules/next
 *     node_modules/react       -> ../.pnpm/react@x/node_modules/react
 *     node_modules/.pnpm/next@x/node_modules/react -> ../../react@x/node_modules/react
 *     ...
 *   electron-builder 的 extraFiles 复制这类嵌套符号链接目录时行为不稳定，
 *   经实测会导致整个 node_modules/ 目录在打包后的 app 里直接缺失，
 *   进而 Resources/standalone/server.js 里的 `require('next')` 找不到模块。
 *
 * 做法：
 *   手写递归复制 —— 遇到符号链接就解引用到真实路径，然后递归复制为真实目录/文件。
 *   （Node 自带的 fs.cpSync({ dereference: true }) 在嵌套符号链接场景下实际测试不可靠，
 *   生成结果仍然是符号链接，所以这里不依赖它。）
 *
 * 代价：
 *   pnpm 省下来的磁盘共享效果被展平，大小会翻几倍（同一个包可能在多个位置被复制）。
 *   但这只是打包出的 app 内部布局，不影响分发包大小之外的部分。
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const standaloneDir = path.join(root, 'dist', 'standalone')
const tmpDir = path.join(root, 'dist', 'standalone.flat.tmp')

if (!fs.existsSync(standaloneDir)) {
  console.log('[flatten-standalone] dist/standalone 不存在，跳过（请先运行 pnpm build:next）')
  process.exit(0)
}

console.log('[flatten-standalone] 开始解引用 dist/standalone/ 下的所有符号链接 ...')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
} catch {
  // ignore
}

const started = Date.now()
let copiedFiles = 0
let copiedDirs = 0
let derefCount = 0

/**
 * 递归复制 src 到 dst。如果 src 是符号链接则跟随到真实路径后继续复制。
 */
function copyDeref(src, dst) {
  const st = fs.lstatSync(src)

  if (st.isSymbolicLink()) {
    derefCount += 1
    const real = fs.realpathSync(src)
    // 真实路径可能还是一个符号链接指向的目录/文件，统一用 statSync 取真实类型
    const realSt = fs.statSync(real)
    if (realSt.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true })
      copiedDirs += 1
      for (const entry of fs.readdirSync(real)) {
        copyDeref(path.join(real, entry), path.join(dst, entry))
      }
    } else if (realSt.isFile()) {
      fs.copyFileSync(real, dst)
      copiedFiles += 1
    }
    // 其他类型（socket / fifo / char device）忽略
    return
  }

  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true })
    copiedDirs += 1
    for (const entry of fs.readdirSync(src)) {
      copyDeref(path.join(src, entry), path.join(dst, entry))
    }
    return
  }

  if (st.isFile()) {
    fs.copyFileSync(src, dst)
    copiedFiles += 1
    return
  }
  // 忽略 socket / fifo / char device 等特殊文件
}

try {
  copyDeref(standaloneDir, tmpDir)
} catch (err) {
  console.error('[flatten-standalone] 复制失败:', err && err.message ? err.message : err)
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    // ignore
  }
  process.exit(1)
}

const originalBackup = `${standaloneDir}.symlinked-backup`
try {
  fs.rmSync(originalBackup, { recursive: true, force: true })
} catch {
  // ignore
}

fs.renameSync(standaloneDir, originalBackup)
fs.renameSync(tmpDir, standaloneDir)

try {
  fs.rmSync(originalBackup, { recursive: true, force: true })
} catch (err) {
  console.warn(
    '[flatten-standalone] 清理备份目录失败（可手动删除）:',
    originalBackup,
    err && err.message ? err.message : err,
  )
}

// 校验：关键模块必须存在且是真实目录（而不是符号链接），否则后续 electron-builder 依然会踩坑。
const mustExist = [
  'node_modules/next/package.json',
  'node_modules/react/package.json',
  'node_modules/react-dom/package.json',
]
for (const rel of mustExist) {
  const full = path.join(standaloneDir, rel)
  if (!fs.existsSync(full)) {
    console.error(`[flatten-standalone] 关键文件缺失: ${rel}`)
    process.exit(1)
  }
  const parent = path.dirname(full)
  const stat = fs.lstatSync(parent)
  if (stat.isSymbolicLink()) {
    console.error(`[flatten-standalone] 解引用失败，${rel} 的父目录仍为符号链接`)
    process.exit(1)
  }
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1)
console.log(
  `[flatten-standalone] 完成，耗时 ${elapsed}s，复制 ${copiedFiles} 个文件，${copiedDirs} 个目录，解引用 ${derefCount} 个符号链接`,
)
