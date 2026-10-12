/**
 * CLI Runner - 在 Electron 主进程中执行 shell 命令来安装 skill 包
 * 支持 npm/npx 等包管理器，实时输出日志流
 */
import { spawn, type ChildProcess } from 'child_process'
import { app } from 'electron'
import { join } from 'path'
import { getDataRoot } from './dataPaths'
import { mkdir } from 'fs/promises'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { store, type InstalledSkillRecord } from './store'

// ==================== 类型定义 ====================

export interface InstallOptions {
  command: string          // 完整安装命令，如 "npx @promptman/skill-installer code-review"
  name: string             // 包/技能名称
  registryId?: string      // 关联的 registry skill ID
}

export interface InstallResult {
  success: boolean
  installPath?: string
  error?: string
}

export type OutputCallback = (data: { type: 'stdout' | 'stderr' | 'status'; message: string }) => void

// ==================== 全局状态 ====================

const runningProcesses = new Map<string, ChildProcess>()

// ==================== 辅助函数 ====================

/**
 * 获取 skills 安装目录
 */
function getSkillsDir(): string {
  return join(getDataRoot(), 'skills')
}

/**
 * 确保安装目录存在
 */
async function ensureSkillsDir(): Promise<string> {
  const dir = getSkillsDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  return dir
}

/**
 * 解析安装命令中的包名
 */
function parsePackageName(command: string): string {
  // 支持的格式：
  // npx @promptman/skill-installer <name>
  // npm install <name>
  // pnpm add <name>
  const parts = command.trim().split(/\s+/)
  return parts[parts.length - 1] || 'unknown'
}

// ==================== 核心功能 ====================

/**
 * 执行安装命令
 * @param options 安装选项
 * @param onOutput 实时输出回调
 */
export async function installSkill(
  options: InstallOptions,
  onOutput?: OutputCallback
): Promise<InstallResult> {
  const { command, name, registryId } = options
  const installId = `install-${Date.now()}`

  try {
    const skillsDir = await ensureSkillsDir()
    const installPath = join(skillsDir, name.replace(/[^a-zA-Z0-9_-]/g, '-'))

    // 确保安装路径存在
    if (!existsSync(installPath)) {
      await mkdir(installPath, { recursive: true })
    }

    onOutput?.({ type: 'status', message: `Starting installation: ${command}` })
    onOutput?.({ type: 'status', message: `Install path: ${installPath}` })

    // 解析命令
    const parts = command.trim().split(/\s+/)
    const cmd = parts[0]
    const args = parts.slice(1)

    // 执行命令
    const result = await new Promise<InstallResult>((resolve) => {
      const proc = spawn(cmd, args, {
        cwd: installPath,
        shell: true,
        env: {
          ...process.env,
          HOME: app.getPath('home'),
          PATH: process.env.PATH,
        },
      })

      runningProcesses.set(installId, proc)

      let stderrOutput = ''

      proc.stdout?.on('data', (data: Buffer) => {
        const msg = data.toString()
        onOutput?.({ type: 'stdout', message: msg })
      })

      proc.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString()
        stderrOutput += msg
        onOutput?.({ type: 'stderr', message: msg })
      })

      proc.on('close', (code) => {
        runningProcesses.delete(installId)
        if (code === 0) {
          resolve({ success: true, installPath })
        } else {
          resolve({
            success: false,
            error: stderrOutput || `Process exited with code ${code}`,
          })
        }
      })

      proc.on('error', (err) => {
        runningProcesses.delete(installId)
        resolve({
          success: false,
          error: err.message,
        })
      })
    })

    // 安装成功后记录到 store
    if (result.success) {
      const packageName = parsePackageName(command)
      const record: InstalledSkillRecord = {
        id: `installed-${Date.now()}`,
        name: name || packageName,
        version: '1.0.0', // 会在扫描阶段更新
        installPath: installPath,
        installedAt: new Date().toISOString(),
        source: registryId ? 'registry' : 'manual',
        registryId,
      }

      await store.addInstalledSkill(record)
      onOutput?.({ type: 'status', message: `Successfully installed: ${name}` })
    } else {
      onOutput?.({ type: 'status', message: `Installation failed: ${result.error}` })
    }

    return result
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    onOutput?.({ type: 'status', message: `Installation error: ${errMsg}` })
    return { success: false, error: errMsg }
  }
}

/**
 * 卸载已安装的 skill 包
 */
export async function uninstallSkill(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const skills = await store.getInstalledSkills()
    const skill = skills.find(s => s.id === id)

    if (!skill) {
      return { success: false, error: 'Skill not found' }
    }

    // 删除安装目录（使用 rimraf 逻辑）
    if (existsSync(skill.installPath)) {
      const { rm } = await import('fs/promises')
      await rm(skill.installPath, { recursive: true, force: true })
    }

    // 从 store 中移除
    await store.removeInstalledSkill(id)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 列出已安装的 skills
 */
export async function listInstalledSkills(): Promise<InstalledSkillRecord[]> {
  return store.getInstalledSkills()
}

/**
 * 扫描安装目录，发现新的 skills
 */
export async function scanInstalledSkills(): Promise<InstalledSkillRecord[]> {
  const skillsDir = getSkillsDir()
  if (!existsSync(skillsDir)) return []

  const installed = await store.getInstalledSkills()
  const existingPaths = new Set(installed.map(s => s.installPath))
  const newSkills: InstalledSkillRecord[] = []

  try {
    const entries = readdirSync(skillsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const skillPath = join(skillsDir, entry.name)
      if (existingPaths.has(skillPath)) continue

      // 检查是否有 SKILL.md 或 package.json
      const hasSkillMd = existsSync(join(skillPath, 'SKILL.md'))
      const packageJsonPath = join(skillPath, 'package.json')
      const hasPackageJson = existsSync(packageJsonPath)

      if (hasSkillMd || hasPackageJson) {
        let name = entry.name
        let version = '1.0.0'

        if (hasPackageJson) {
          try {
            const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
            name = pkg.name || name
            version = pkg.version || version
          } catch { /* ignore parse errors */ }
        }

        const record: InstalledSkillRecord = {
          id: `scanned-${Date.now()}-${entry.name}`,
          name,
          version,
          installPath: skillPath,
          installedAt: new Date().toISOString(),
          source: 'manual',
        }

        newSkills.push(record)
        await store.addInstalledSkill(record)
      }
    }
  } catch (error) {
    console.error('Error scanning skills directory:', error)
  }

  return [...installed, ...newSkills]
}

/**
 * 终止正在运行的安装进程
 */
export function cancelInstall(installId: string): boolean {
  const proc = runningProcesses.get(installId)
  if (proc) {
    proc.kill('SIGTERM')
    runningProcesses.delete(installId)
    return true
  }
  return false
}
