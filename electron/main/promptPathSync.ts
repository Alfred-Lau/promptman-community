/**
 * 将外部 Prompt 文件（Markdown、.cursorrules、CLAUDE.md 等）同步到本地 Prompts（SQLite）
 *
 * 支持的文件格式：
 * - YAML frontmatter（title, description, category, tags）+ Markdown 正文
 * - 纯 Markdown（用文件名作为 title）
 * - .cursorrules / CLAUDE.md 等无扩展名或特殊名称文件
 *
 * 稳定 promptId 由文件绝对路径哈希决定，重复启动不重复入库；
 * 内容有变化时新增一条版本记录并设为当前版本。
 */
import { createHash, randomUUID } from 'crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { basename, extname, join, resolve } from 'path'
import { store } from './store'
import { expandUserPath } from './skillPathSync'
import { createPrompt, getPrompt, getPromptVersions } from './sqlitedb'
import type { CreatePromptInput } from './sqlitedb'

/** 支持扫描的 prompt 文件名（精确匹配，不含扩展名） */
const KNOWN_PROMPT_FILE_NAMES = [
  'CLAUDE.md',
  'claude.md',
  '.cursorrules',
  'cursorrules',
  'AGENTS.md',
  'agents.md',
  'PROMPT.md',
  'prompt.md',
  'SYSTEM.md',
  'system.md',
  'SYSTEM_PROMPT.md',
  'system_prompt.md',
] as const

/** 支持扫描的 prompt 文件扩展名 */
const PROMPT_EXTENSIONS = new Set(['.md', '.txt', '.prompt', '.mdc'])

/** 已知的外部 prompt 规则目录（自动扫描） */
const KNOWN_PROMPT_RULE_PATHS = [
  '~/.cursor/rules',
  '~/.claude/rules',
  '~/.config/opencode/rules',
  '~/.gemini/rules',
] as const

export interface PromptPathSyncResult {
  scannedFiles: number
  imported: number
  skippedUnchanged: number
  errors: string[]
}

function isPromptFile(filePath: string): boolean {
  const name = basename(filePath)
  if ((KNOWN_PROMPT_FILE_NAMES as readonly string[]).includes(name)) return true
  const ext = extname(name).toLowerCase()
  return PROMPT_EXTENSIONS.has(ext)
}

/**
 * 收集目录下（一层）所有 prompt 文件路径
 */
function collectPromptFilesInDir(dir: string, seen: Set<string>, out: string[]): void {
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const ent of entries) {
      if (ent.isDirectory()) continue
      const absPath = resolve(join(dir, ent.name))
      if (seen.has(absPath)) continue
      if (!isPromptFile(ent.name)) continue
      seen.add(absPath)
      out.push(absPath)
    }
  } catch { /* ignore */ }
}

/**
 * 收集配置路径和已知规则目录下的所有 prompt 文件路径（去重）
 */
export function collectPromptFilePaths(customScanPaths: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  // 已知 prompt 规则目录
  for (const raw of KNOWN_PROMPT_RULE_PATHS) {
    const dir = expandUserPath(raw)
    if (existsSync(dir)) {
      collectPromptFilesInDir(dir, seen, out)
    }
  }

  // 用户自定义路径
  for (const raw of customScanPaths) {
    const p = resolve(expandUserPath(raw))
    if (!p || !existsSync(p)) continue

    let kind: 'file' | 'dir' | null = null
    try {
      const st = statSync(p)
      if (st.isFile()) kind = 'file'
      else if (st.isDirectory()) kind = 'dir'
    } catch { /* ignore */ }

    if (kind === 'file' && isPromptFile(p)) {
      if (!seen.has(p)) {
        seen.add(p)
        out.push(p)
      }
    } else if (kind === 'dir') {
      collectPromptFilesInDir(p, seen, out)
    }
  }

  return out
}

interface ParsedPromptFile {
  frontmatter: Record<string, string>
  body: string
}

function parsePromptFile(content: string): ParsedPromptFile {
  // YAML frontmatter: --- ... ---
  const fmRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/
  const match = content.match(fmRegex)
  if (match) {
    const fmStr = match[1]
    const body = match[2].trimStart()
    const frontmatter: Record<string, string> = {}
    for (const line of fmStr.split('\n')) {
      const idx = line.indexOf(':')
      if (idx > 0) {
        const key = line.slice(0, idx).trim()
        const value = line.slice(idx + 1).trim()
        frontmatter[key] = value
      }
    }
    return { frontmatter, body }
  }
  return { frontmatter: {}, body: content.trim() }
}

function titleFromFilePath(filePath: string): string {
  const name = basename(filePath)
  const ext = extname(name)
  const stem = ext ? name.slice(0, -ext.length) : name
  // 去掉前缀 . 并用空格替换连字符/下划线
  return stem.replace(/^\./, '').replace(/[-_]/g, ' ').trim() || name
}

function stablePromptIdForPath(absPath: string): string {
  const h = createHash('sha256').update(absPath).digest('hex')
  return `fs-prompt-${h.slice(0, 32)}`
}

/**
 * 从磁盘同步配置路径及已知规则目录下的 prompt 文件
 */
export async function syncPromptsFromCustomPaths(): Promise<PromptPathSyncResult> {
  const settings = await store.getSettings()
  const paths = settings.prompts?.customScanPaths ?? []
  const promptFiles = collectPromptFilePaths(paths)

  const result: PromptPathSyncResult = {
    scannedFiles: promptFiles.length,
    imported: 0,
    skippedUnchanged: 0,
    errors: [],
  }

  for (const filePath of promptFiles) {
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const { frontmatter, body } = parsePromptFile(raw)

      if (!body.trim()) continue

      const title = (frontmatter.title?.trim()) || titleFromFilePath(filePath)
      const description =
        (frontmatter.description?.trim()) || `从本地同步：${filePath}`
      const category = (frontmatter.category?.trim()) || '外部文件'

      let tags: string[] | undefined
      const tagsRaw = frontmatter.tags?.trim()
      if (tagsRaw) {
        tags = tagsRaw.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
      }

      const promptId = stablePromptIdForPath(filePath)
      const versions = await getPromptVersions(promptId)
      const current = versions.find((v) => v.isCurrentVersion)

      if (current) {
        const full = await getPrompt(current.id)
        if (full) {
          const sameTags =
            JSON.stringify(full.tags ?? []) === JSON.stringify(tags ?? [])
          if (
            full.content === body &&
            full.title === title &&
            full.description === description &&
            full.category === category &&
            sameTags
          ) {
            result.skippedUnchanged++
            continue
          }
        }
      }

      const input: CreatePromptInput = {
        id: randomUUID(),
        promptId,
        title,
        content: body,
        description,
        category,
        tags,
        changeNotes: current ? '从外部文件更新' : '从外部文件导入',
      }

      await createPrompt(input)
      result.imported++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      result.errors.push(`${filePath}: ${msg}`)
      console.warn('[PromptPathSync]', filePath, e)
    }
  }

  if (result.imported > 0 || result.errors.length > 0) {
    console.log(
      `[PromptPathSync] files=${result.scannedFiles} imported=${result.imported} unchanged=${result.skippedUnchanged} errors=${result.errors.length}`,
    )
  }

  return result
}

/**
 * 返回所有已知 prompt 规则目录中存在的路径
 */
export function getExistingKnownPromptPaths(): string[] {
  return KNOWN_PROMPT_RULE_PATHS
    .map(p => expandUserPath(p))
    .filter(p => existsSync(p))
}
