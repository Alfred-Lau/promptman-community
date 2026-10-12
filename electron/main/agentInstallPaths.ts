/**
 * 已知 AI Agent 的 Skill 默认安装路径定义与探测
 *
 * 用途：
 * - Skill 安装时，根据用户选择的目标 Agent，把 skill 写入到对应工具的默认
 *   skills 目录下（例如 ~/.claude/skills, ~/.cursor/skills）。
 * - 同时返回该 Agent 在当前机器上是否已安装（通过判断父目录是否存在）。
 */
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export interface InstallableAgentDefinition {
  /** 稳定 ID，供前端选择使用 */
  id: string
  /** 展示名称 */
  name: string
  /** Agent 主目录（不含 skills 子目录），以 ~ 开头 */
  parent: string
  /** skills 子目录名，默认 "skills" */
  skillsSubdir: string
}

export interface InstallableAgentInfo extends InstallableAgentDefinition {
  /** Agent 主目录解析后的绝对路径 */
  parentPath: string
  /** skills 目录解析后的绝对路径（即最终的 skill 安装根目录） */
  skillsPath: string
  /** Agent 主目录在本机是否存在（作为「是否已安装」的判定） */
  installed: boolean
  /** skills 目录是否已存在（不存在会在写入时自动创建） */
  skillsDirExists: boolean
}

/**
 * 已知 Agent 清单。顺序即前端展示顺序。
 */
export const INSTALLABLE_AGENT_DEFINITIONS: readonly InstallableAgentDefinition[] = [
  { id: 'claude', name: 'Claude Code', parent: '~/.claude', skillsSubdir: 'skills' },
  { id: 'cursor', name: 'Cursor', parent: '~/.cursor', skillsSubdir: 'skills' },
  { id: 'codex', name: 'Codex', parent: '~/.codex', skillsSubdir: 'skills' },
  { id: 'copilot', name: 'GitHub Copilot', parent: '~/.copilot', skillsSubdir: 'skills' },
  { id: 'windsurf', name: 'Windsurf', parent: '~/.codeium/windsurf', skillsSubdir: 'skills' },
  { id: 'gemini', name: 'Gemini CLI', parent: '~/.gemini', skillsSubdir: 'skills' },
  { id: 'kiro', name: 'Kiro', parent: '~/.kiro', skillsSubdir: 'skills' },
  { id: 'trae', name: 'Trae', parent: '~/.trae', skillsSubdir: 'skills' },
  { id: 'opencode', name: 'OpenCode', parent: '~/.config/opencode', skillsSubdir: 'skills' },
  { id: 'devin', name: 'Devin', parent: '~/.devin', skillsSubdir: 'skills' },
] as const

function expandUserPath(p: string): string {
  if (p.startsWith('~/')) return join(homedir(), p.slice(2))
  if (p === '~') return homedir()
  return p
}

/**
 * 返回所有已知 Agent 的安装信息（包含是否已安装的判定）
 */
export function listInstallableAgents(): InstallableAgentInfo[] {
  return INSTALLABLE_AGENT_DEFINITIONS.map((def) => {
    const parentPath = expandUserPath(def.parent)
    const skillsPath = join(parentPath, def.skillsSubdir)
    return {
      ...def,
      parentPath,
      skillsPath,
      installed: existsSync(parentPath),
      skillsDirExists: existsSync(skillsPath),
    }
  })
}

/**
 * 根据 agent id 查询单个 Agent 的安装信息。未找到返回 null。
 */
export function getInstallableAgent(agentId: string): InstallableAgentInfo | null {
  const def = INSTALLABLE_AGENT_DEFINITIONS.find((d) => d.id === agentId)
  if (!def) return null
  const parentPath = expandUserPath(def.parent)
  const skillsPath = join(parentPath, def.skillsSubdir)
  return {
    ...def,
    parentPath,
    skillsPath,
    installed: existsSync(parentPath),
    skillsDirExists: existsSync(skillsPath),
  }
}
