#!/usr/bin/env node
/**
 * Remove sharp packages from dist/standalone before electron-builder packaging
 * to avoid codesign issues on macOS 15+
 *
 * This script removes:
 * 1. All sharp/@img directories
 * 2. All symlinks pointing to sharp/@img directories
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const standaloneRoot = path.join(root, 'dist', 'standalone')

if (!fs.existsSync(standaloneRoot)) {
  console.log('[prune-standalone] standalone not built yet, skipping')
  process.exit(0)
}

console.log('[prune-standalone] Removing sharp packages from standalone...')

let prunedCount = 0

// Remove all sharp/@img directories and symlinks recursively
function removeSharp(dir) {
  if (!fs.existsSync(dir)) return

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isSymbolicLink()) {
      // Remove symlinks pointing to sharp/@img
      try {
        const target = fs.readlinkSync(fullPath)
        if (target.includes('sharp') || target.includes('@img')) {
          fs.rmSync(fullPath, { force: true })
          console.log(`  removed symlink: ${fullPath.replace(standaloneRoot, '')}`)
          prunedCount++
        }
      } catch (e) {
        // Ignore broken symlinks
      }
    } else if (entry.isDirectory()) {
      // Remove directories named 'sharp' or '@img'
      if (entry.name === 'sharp' || entry.name === '@img') {
        fs.rmSync(fullPath, { recursive: true, force: true })
        console.log(`  pruned directory: ${fullPath.replace(standaloneRoot, '')}`)
        prunedCount++
        continue
      }

      // Remove pnpm packages containing 'sharp'
      if (entry.name.includes('sharp')) {
        fs.rmSync(fullPath, { recursive: true, force: true })
        console.log(`  pruned package: ${fullPath.replace(standaloneRoot, '')}`)
        prunedCount++
        continue
      }

      // Recurse into all subdirectories
      removeSharp(fullPath)
    }
  }
}

// Process root standalone directory (recursively handles all subdirectories)
removeSharp(standaloneRoot)

console.log(`[prune-standalone] Done. Pruned ${prunedCount} directories/symlinks.`)
