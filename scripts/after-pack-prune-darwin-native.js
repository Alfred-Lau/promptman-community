#!/usr/bin/env node
/**
 * afterPack hook:
 *
 * 1. (macOS) Strip stale code-signing extended attributes from .app bundle.
 * 2. Remove wrong-architecture native deps from bundled Next standalone.
 * 3. Remove cross-platform onnxruntime binaries (keep only current platform).
 * 4. Remove @next/swc-* (not needed at runtime).
 * 5. Remove @huggingface/transformers wasm files (Node uses onnxruntime-node).
 * 6. Remove @img/sharp-* from asarUnpacked (not used in Electron main).
 * 7. Remove typescript from standalone (not needed at runtime).
 * 8. Deduplicate nested onnxruntime-node inside @huggingface/transformers.
 *
 * builder-util Arch: x64 = 1, arm64 = 3
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const Arch = { x64: 1, arm64: 3 }

function rmDir(dir, label) {
  if (!fs.existsSync(dir)) return 0
  const stat = fs.statSync(dir)
  const sizeMB = Math.round(dirSize(dir) / 1024 / 1024)
  fs.rmSync(dir, { recursive: true, force: true })
  console.log(`[afterPack] pruned ${label} (${sizeMB}MB)`)
  return sizeMB
}

function rmGlob(baseDir, patterns, label) {
  if (!fs.existsSync(baseDir)) return 0
  let total = 0
  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!patterns.some(p => entry.name.includes(p))) continue
    total += rmDir(path.join(baseDir, entry.name), `${label}/${entry.name}`)
  }
  return total
}

function dirSize(dir) {
  let size = 0
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        size += dirSize(fullPath)
      } else if (entry.isFile()) {
        size += fs.statSync(fullPath).size
      }
    }
  } catch { /* ignore */ }
  return size
}

function rmFiles(dir, exts, label) {
  if (!fs.existsSync(dir)) return 0
  let total = 0
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      total += rmFiles(fullPath, exts, label)
    } else if (entry.isFile() && exts.some(e => entry.name.endsWith(e))) {
      const size = fs.statSync(fullPath).size
      fs.rmSync(fullPath, { force: true })
      total += size
    }
  }
  return total
}

function getPlatformKey(electronPlatformName, arch) {
  if (electronPlatformName === 'darwin') return arch === Arch.arm64 ? 'darwin/arm64' : 'darwin/x64'
  if (electronPlatformName === 'win32') return 'win32/x64'
  return 'linux/x64'
}

exports.default = async function afterPack(context) {
  const { arch, appOutDir, packager, electronPlatformName } = context
  const platformKey = getPlatformKey(electronPlatformName, arch)
  let totalSavedMB = 0

  console.log(`[afterPack] target platform: ${platformKey}`)

  // macOS: determine app bundle path
  let resourcesRoot
  if (electronPlatformName === 'darwin') {
    const appFolder = `${packager.appInfo.productFilename}.app`
    const appPath = path.join(appOutDir, appFolder)

    try {
      execFileSync('xattr', ['-cr', appPath])
      console.log(`[afterPack] cleared xattrs on ${appFolder}`)
    } catch (e) {
      console.warn(`[afterPack] xattr -cr failed (non-fatal): ${e.message}`)
    }

    resourcesRoot = path.join(appPath, 'Contents', 'Resources')
  } else {
    resourcesRoot = path.join(appOutDir, 'resources')
  }

  const unpackedModules = path.join(resourcesRoot, 'app.asar.unpacked', 'node_modules')
  const standaloneRoot = path.join(resourcesRoot, 'standalone')

  // ─── 1. Remove cross-platform onnxruntime binaries ───
  // Keep only the current platform binaries
  const onnxDirs = [
    path.join(unpackedModules, 'onnxruntime-node', 'bin'),
  ]
  // Also check nested onnxruntime inside @huggingface/transformers
  const nestedOnnxBin = path.join(unpackedModules, '@huggingface', 'transformers', 'node_modules', 'onnxruntime-node', 'bin')
  if (fs.existsSync(nestedOnnxBin)) onnxDirs.push(nestedOnnxBin)

  const currentPlatform = electronPlatformName === 'darwin' ? 'darwin' : electronPlatformName === 'win32' ? 'win32' : 'linux'
  const removePlatforms = ['darwin', 'win32', 'linux'].filter(p => p !== currentPlatform)

  for (const onnxBinDir of onnxDirs) {
    if (!fs.existsSync(onnxBinDir)) continue
    // onnxruntime-node/bin/napi-v{N}/{platform}
    for (const napiDir of fs.readdirSync(onnxBinDir, { withFileTypes: true })) {
      if (!napiDir.isDirectory()) continue
      const napiPath = path.join(onnxBinDir, napiDir.name)
      for (const plat of removePlatforms) {
        totalSavedMB += rmDir(path.join(napiPath, plat), `onnxruntime-node/${napiDir.name}/${plat}`)
      }
    }
  }

  // ─── 2. Deduplicate nested onnxruntime-node in @huggingface/transformers ───
  // The transformers package bundles its own onnxruntime-node (~141MB).
  // Since the top-level onnxruntime-node is already in asarUnpack, create a
  // symlink instead or just remove the nested one to rely on Node module resolution.
  const nestedOnnx = path.join(unpackedModules, '@huggingface', 'transformers', 'node_modules', 'onnxruntime-node')
  if (fs.existsSync(nestedOnnx) && fs.existsSync(path.join(unpackedModules, 'onnxruntime-node'))) {
    totalSavedMB += rmDir(nestedOnnx, '@huggingface/transformers/node_modules/onnxruntime-node (duplicate)')
  }
  // Also remove nested onnxruntime-common if top-level exists
  const nestedCommon = path.join(unpackedModules, '@huggingface', 'transformers', 'node_modules', 'onnxruntime-common')
  if (fs.existsSync(nestedCommon)) {
    totalSavedMB += rmDir(nestedCommon, '@huggingface/transformers/node_modules/onnxruntime-common (duplicate)')
  }

  // ─── 3. Remove @next/swc-* (compile-time only, not needed at runtime) ───
  totalSavedMB += rmGlob(unpackedModules, ['@next'], 'asar-unpacked/@next')
  totalSavedMB += rmGlob(path.join(unpackedModules, '@next'), ['swc-'], '@next/swc')

  // ─── 4. Remove wasm files from @huggingface/transformers (Node uses native onnxruntime) ───
  const transformersDist = path.join(unpackedModules, '@huggingface', 'transformers', 'dist')
  if (fs.existsSync(transformersDist)) {
    const wasmBytes = rmFiles(transformersDist, ['.wasm'], 'transformers wasm')
    const mapBytes = rmFiles(transformersDist, ['.map'], 'transformers sourcemaps')
    const savedMB = Math.round((wasmBytes + mapBytes) / 1024 / 1024)
    if (savedMB > 0) {
      console.log(`[afterPack] pruned transformers wasm+maps (${savedMB}MB)`)
      totalSavedMB += savedMB
    }
  }

  // ─── 5. Remove @img/sharp-* from asar-unpacked (not used in Electron main) ───
  totalSavedMB += rmGlob(unpackedModules, ['@img'], 'asar-unpacked/@img')

  // ─── 6. Remove typescript from standalone (not needed at runtime) ───
  totalSavedMB += rmDir(path.join(standaloneRoot, 'node_modules', 'typescript'), 'standalone/typescript')

  // ─── 7. Prune standalone wrong-arch native deps ───
  const pnpmDir = path.join(standaloneRoot, 'node_modules', '.pnpm')
  if (fs.existsSync(pnpmDir)) {
    const archPatterns =
      electronPlatformName === 'darwin'
        ? (arch === Arch.arm64
          ? ['sharp-darwin-x64', 'sharp-libvips-darwin-x64', 'sqlite-vec-darwin-x64']
          : ['sharp-darwin-arm64', 'sharp-libvips-darwin-arm64', 'sqlite-vec-darwin-arm64'])
        : []

    for (const ent of fs.readdirSync(pnpmDir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue
      if (!archPatterns.some(p => ent.name.includes(p))) continue
      totalSavedMB += rmDir(path.join(pnpmDir, ent.name), `standalone/.pnpm/${ent.name}`)
    }
  }

  console.log(`[afterPack] ✅ total pruned: ~${totalSavedMB}MB`)
}
