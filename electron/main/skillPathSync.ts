/**
 * 将设置中「自定义扫描路径」下的 SKILL.md 同步到本地 Agent Skills（SQLite）
 * - 每个 SKILL.md 的稳定 skillId 由文件绝对路径哈希决定，重复启动不重复入库
 * - 文件内容相对当前版本有变化时，新增一条版本记录并设为当前版本
 * - 支持深层嵌套目录（如 Cursor/Claude plugin cache 结构）
 */
import { createHash, randomUUID } from 'crypto'
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join, resolve, sep } from 'path'
import { store, DEFAULT_SKILL_APP_SETTINGS } from './store'
import {
  createAgentSkill,
  getAgentSkill,
  getAgentSkillVersions,
  deleteAgentSkillAllVersions,
} from './sqlitedb'
import { getDB } from './sqlitedb/db'
import type { CreateAgentSkillInput } from './sqlitedb'
import { reindexAgentSkills, AGENT_SKILL_EMBEDDING_VERSION } from './sqlitedb/crud'
import type { SkillAppSettings } from './store'

const SKILL_MD_NAMES = ['SKILL.md', 'skill.md', 'Skill.md'] as const

/**
 * fs-scan 无 frontmatter description 时的默认描述前缀（全角冒号）。
 * 兼容历史数据中可能存在的半角冒号版本。
 */
export const LOCAL_SYNC_DESC_PREFIX = '从本地同步：'
export const LOCAL_SYNC_DESC_PREFIX_ASCII = '从本地同步:'

/** 已知的 AI 工具 plugin cache 目录（自动深度扫描） */
const KNOWN_PLUGIN_CACHE_PATHS = [
  '~/.cursor/plugins/cache',
  '~/.claude/plugins/cache',
  '~/.cursor/skills',
  '~/.claude/skills',
  '~/.copilot/skills',
  '~/.codeium/windsurf/skills',
  '~/.kiro/skills',
  '~/.gemini/skills',
  '~/.trae/skills',
  '~/.config/opencode/skills',
  '~/.codex/skills',
  '~/.devin/skills',
] as const

export interface SkillPathSyncResult {
  scannedFiles: number
  imported: number
  skippedUnchanged: number
  removed: number
  errors: string[]
}

export function expandUserPath(input: string): string {
  const t = input.trim()
  if (!t) return ''
  if (t.startsWith('~/')) return join(homedir(), t.slice(2))
  if (t === '~') return homedir()
  return t
}

function resolveScanRoot(raw: string): string {
  return resolve(expandUserPath(raw))
}

function findSkillMdInDir(dir: string): string | null {
  for (const name of SKILL_MD_NAMES) {
    const p = join(dir, name)
    if (existsSync(p)) return p
  }
  return null
}

function isMarkdownSkillFile(absPath: string): boolean {
  const lower = absPath.toLowerCase()
  return lower.endsWith('skill.md')
}

/**
 * 递归扫描目录，收集所有 SKILL.md，支持自定义深度
 */
function collectSkillMdPathsDeep(
  dir: string,
  seen: Set<string>,
  out: string[],
  depth: number,
  maxDepth: number,
  onAccessError?: (depth: number) => void,
): void {
  if (depth > maxDepth) return

  const direct = findSkillMdInDir(dir)
  if (direct) {
    const real = resolve(direct)
    if (!seen.has(real)) {
      seen.add(real)
      out.push(real)
    }
    // 找到 SKILL.md 后不继续往下递归
    return
  }

  if (depth >= maxDepth) return

  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const ent of entries) {
      if (!ent.isDirectory()) continue
      // 跳过 node_modules 和隐藏目录（以 . 开头且不在根层级）
      if (ent.name === 'node_modules') continue
      collectSkillMdPathsDeep(join(dir, ent.name), seen, out, depth + 1, maxDepth, onAccessError)
    }
  } catch {
    onAccessError?.(depth)
  }
}

/**
 * 收集配置路径下所有 SKILL.md 绝对路径（去重）
 * maxDepth: 目录扫描深度，默认 1（直接子目录），plugin cache 目录使用更大值
 */
export function collectSkillMdPaths(customScanPaths: string[], maxDepth = 1): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const raw of customScanPaths) {
    const root = resolveScanRoot(raw)
    if (!root || !existsSync(root)) continue

    let kind: 'file' | 'dir' | null = null
    try {
      const st = statSync(root)
      if (st.isFile()) kind = 'file'
      else if (st.isDirectory()) kind = 'dir'
    } catch { /* ignore */ }

    if (kind === 'file' && isMarkdownSkillFile(root)) {
      const real = resolve(root)
      if (!seen.has(real)) {
        seen.add(real)
        out.push(real)
      }
      continue
    }

    if (kind !== 'dir') continue

    collectSkillMdPathsDeep(root, seen, out, 0, maxDepth)
  }

  return out
}

/**
 * 返回所有已知 AI 工具 plugin/skill 目录中存在的路径
 * 用于「一键添加全部内置路径」或自动扫描
 */
export function getExistingKnownPaths(): string[] {
  return KNOWN_PLUGIN_CACHE_PATHS
    .map(p => expandUserPath(p))
    .filter(p => existsSync(p))
}

/**
 * 扫描所有已知 plugin cache 目录，返回找到的 SKILL.md 列表（不写入数据库）
 * plugin cache 使用深度 5 以覆盖 vendor/plugin/version/skills/name/SKILL.md 结构
 */
export function collectSkillMdPathsFromKnownPlugins(): string[] {
  const existingPaths = getExistingKnownPaths()
  return collectSkillMdPaths(existingPaths, 5)
}

function unquoteYamlScalar(value: string): string {
  const v = value.trim()
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    try {
      return JSON.parse(v) as string
    } catch {
      return v.slice(1, -1)
    }
  }
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) {
    return v.slice(1, -1).replace(/''/g, "'")
  }
  return v
}

function splitCsv(raw: string | undefined): string[] | undefined {
  const t = raw?.trim()
  if (!t) return undefined
  const parts = t.split(/[,，]/).map((s) => unquoteYamlScalar(s.trim())).filter(Boolean)
  return parts.length ? parts : undefined
}

function parseSkillMd(content: string): {
  frontmatter: Record<string, string>
  metadata: Record<string, string>
  body: string
} {
  const fmRegex = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)([\s\S]*)$/
  const match = content.match(fmRegex)
  if (!match) {
    return { frontmatter: {}, metadata: {}, body: content.trim() }
  }
  const fmStr = match[1]
  const body = match[2].trimStart()
  const frontmatter: Record<string, string> = {}
  const metadata: Record<string, string> = {}
  const lines = fmStr.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const indent = (line.match(/^(\s*)/)?.[1] ?? '').length
    if (indent > 0) {
      i++
      continue
    }
    const idx = line.indexOf(':')
    if (idx <= 0) {
      i++
      continue
    }
    const key = line.slice(0, idx).trim()
    const value = unquoteYamlScalar(line.slice(idx + 1))
    if (key === 'metadata') {
      i++
      while (i < lines.length) {
        const nested = lines[i]
        if (!nested.trim()) {
          i++
          continue
        }
        const nIndent = (nested.match(/^(\s*)/)?.[1] ?? '').length
        if (nIndent === 0) break
        const nIdx = nested.indexOf(':')
        if (nIdx > 0) {
          metadata[nested.slice(0, nIdx).trim()] = unquoteYamlScalar(nested.slice(nIdx + 1))
        }
        i++
      }
      continue
    }
    frontmatter[key] = value
    i++
  }
  return { frontmatter, metadata, body }
}

function isPathInsideRoot(absPath: string, root: string): boolean {
  const file = resolve(absPath)
  const base = resolve(root)
  if (file === base) return true
  const prefix = base.endsWith(sep) ? base : base + sep
  return file.startsWith(prefix)
}

function isNonEmptyText(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

function detectEol(raw: string): '\r\n' | '\n' {
  return raw.includes('\r\n') ? '\r\n' : '\n'
}

interface RootScanResult {
  files: string[]
  fatalError: string | null
  nestedAccessError: boolean
}

function tryScanRoot(root: string, maxDepth: number): RootScanResult {
  const files: string[] = []
  if (!root) return { files, fatalError: 'empty path', nestedAccessError: false }
  if (!existsSync(root)) {
    return { files, fatalError: 'not found', nestedAccessError: false }
  }

  let kind: 'file' | 'dir' | null = null
  try {
    const st = statSync(root)
    if (st.isFile()) kind = 'file'
    else if (st.isDirectory()) kind = 'dir'
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { files, fatalError: msg, nestedAccessError: false }
  }

  if (kind === 'file') {
    if (isMarkdownSkillFile(root)) files.push(resolve(root))
    return { files, fatalError: null, nestedAccessError: false }
  }
  if (kind !== 'dir') {
    return { files, fatalError: 'not a file or directory', nestedAccessError: false }
  }

  const seen = new Set<string>()
  let fatalError: string | null = null
  let nestedAccessError = false
  collectSkillMdPathsDeep(root, seen, files, 0, maxDepth, (depth) => {
    if (depth === 0) fatalError = 'unreadable'
    else nestedAccessError = true
  })
  return { files, fatalError, nestedAccessError }
}

/**
 * 回收「source_path 落在该根内且文件已不存在」的整组技能。
 * 整组删除理由：fs-scan 各版本都来自同一 SKILL.md，文件消失后历史版本同样是残行。
 * 安全边界：source_path 为空 / cloud_id / package_dir / 组内混入手建行 一律不碰。
 */
async function pruneMissingSkillsUnderRoot(root: string): Promise<number> {
  const db = getDB()
  const rows = db
    .prepare(
      `SELECT id, skill_id, source_path, cloud_id, package_dir FROM agent_skills
       WHERE source_path IS NOT NULL AND TRIM(source_path) != ''`,
    )
    .all() as Array<{
    id: string
    skill_id: string
    source_path: string
    cloud_id: string | null
    package_dir: string | null
  }>

  const staleSkillIds = new Set<string>()
  for (const row of rows) {
    if (!isPathInsideRoot(row.source_path, root)) continue
    if (existsSync(row.source_path)) continue
    staleSkillIds.add(row.skill_id)
  }

  let removed = 0
  for (const skillId of staleSkillIds) {
    const group = db
      .prepare(
        `SELECT id, source_path, cloud_id, package_dir FROM agent_skills WHERE skill_id = ?`,
      )
      .all(skillId) as Array<{
      id: string
      source_path: string | null
      cloud_id: string | null
      package_dir: string | null
    }>
    if (group.some((r) => isNonEmptyText(r.cloud_id) || isNonEmptyText(r.package_dir))) continue
    if (group.some((r) => !isNonEmptyText(r.source_path))) continue
    if (group.some((r) => isNonEmptyText(r.source_path) && existsSync(r.source_path!))) continue
    try {
      await deleteAgentSkillAllVersions(skillId)
      removed += group.length
    } catch (e) {
      console.warn('[SkillPathSync] prune failed', skillId, e)
    }
  }
  return removed
}

function stableSkillIdForSkillMdPath(absPath: string): string {
  const h = createHash('sha256').update(absPath).digest('hex')
  return `fs-scan-${h.slice(0, 32)}`
}

function readOptionalExamplesMd(skillMdPath: string): string[] | undefined {
  const dir = dirname(skillMdPath)
  const examplesPath = join(dir, 'examples.md')
  if (!existsSync(examplesPath)) return undefined
  try {
    const text = readFileSync(examplesPath, 'utf-8').trim()
    return text ? [text] : undefined
  } catch {
    return undefined
  }
}

/**
 * 从磁盘同步设置里配置的所有扫描路径下的技能
 * 同时扫描已知 plugin cache 目录（深度 5）
 */
export async function syncAgentSkillsFromCustomPaths(): Promise<SkillPathSyncResult> {
  const settings = await store.getSettings()
  const paths = settings.skills?.customScanPaths ?? []

  const rootDepths = new Map<string, number>()
  for (const raw of paths) {
    const root = resolveScanRoot(raw)
    if (!root) continue
    rootDepths.set(root, Math.max(rootDepths.get(root) ?? 0, 1))
  }
  for (const raw of KNOWN_PLUGIN_CACHE_PATHS) {
    const root = resolveScanRoot(raw)
    if (!root) continue
    rootDepths.set(root, Math.max(rootDepths.get(root) ?? 0, 5))
  }

  const result: SkillPathSyncResult = {
    scannedFiles: 0,
    imported: 0,
    skippedUnchanged: 0,
    removed: 0,
    errors: [],
  }
  const seenFiles = new Set<string>()

  for (const [root, maxDepth] of rootDepths) {
    const scan = tryScanRoot(root, maxDepth)
    if (scan.fatalError) {
      console.warn(`[SkillPathSync] skip prune for root ${root}: ${scan.fatalError}`)
      continue
    }

    for (const skillMdPath of scan.files) {
      if (seenFiles.has(skillMdPath)) continue
      seenFiles.add(skillMdPath)
      result.scannedFiles++
      try {
        await importSkillMdFile(skillMdPath, result)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        result.errors.push(`${skillMdPath}: ${msg}`)
        console.warn('[SkillPathSync]', skillMdPath, e)
      }
    }

    if (scan.nestedAccessError) {
      console.warn(`[SkillPathSync] skip prune for root ${root}: nested access errors`)
    } else {
      result.removed += await pruneMissingSkillsUnderRoot(root)
    }
  }

  if (result.imported > 0 || result.removed > 0 || result.errors.length > 0) {
    console.log(
      `[SkillPathSync] files=${result.scannedFiles} imported=${result.imported} unchanged=${result.skippedUnchanged} removed=${result.removed} errors=${result.errors.length}`,
    )
  }

  // 存量重嵌：不 await，避免卡住启动/同步路径
  void maybeReindexAgentSkillEmbeddings()

  return result
}

type SkillsWithEmbedVersion = SkillAppSettings & { embeddingVersion?: number }
let reindexInFlight = false

export async function persistAgentSkillEmbeddingVersion(): Promise<void> {
  const settings = await store.getSettings()
  const nextSkills = Object.assign({}, settings.skills ?? DEFAULT_SKILL_APP_SETTINGS, {
    embeddingVersion: AGENT_SKILL_EMBEDDING_VERSION,
  }) as SkillAppSettings
  await store.updateSettings({ skills: nextSkills })
}

async function maybeReindexAgentSkillEmbeddings(): Promise<void> {
  if (reindexInFlight) return
  reindexInFlight = true
  try {
    const settings = await store.getSettings()
    const current = (settings.skills as SkillsWithEmbedVersion | undefined)?.embeddingVersion
    if (current === AGENT_SKILL_EMBEDDING_VERSION) return
    const result = await reindexAgentSkills()
    if (!result.aborted) await persistAgentSkillEmbeddingVersion()
    console.log(
      `[SkillPathSync] reindex processed=${result.processed} aborted=${result.aborted}`,
    )
  } catch (e) {
    console.warn('[SkillPathSync] reindex failed:', e)
  } finally {
    reindexInFlight = false
  }
}

async function importSkillMdFile(skillMdPath: string, result: SkillPathSyncResult): Promise<void> {
  const raw = readFileSync(skillMdPath, 'utf-8')
  const { frontmatter, metadata, body } = parseSkillMd(raw)
  const folderName = dirname(skillMdPath).split(/[/\\]/).pop() || 'skill'
  const name =
    (frontmatter.name && frontmatter.name.trim()) ||
    folderName
  const description =
    (frontmatter.description && frontmatter.description.trim()) ||
    `${LOCAL_SYNC_DESC_PREFIX}${skillMdPath}`
  const category =
    (metadata.category && metadata.category.trim()) ||
    (frontmatter.category && frontmatter.category.trim()) ||
    '外部目录'

  const tags = splitCsv(metadata.tags || frontmatter.tags)
  const platforms = splitCsv(metadata.platforms || frontmatter.platforms)
  const versionLabelRaw =
    (metadata.version && metadata.version.trim()) ||
    (frontmatter.version && frontmatter.version.trim()) ||
    ''
  const versionLabel = versionLabelRaw || undefined

  const examples = readOptionalExamplesMd(skillMdPath)

  const skillId = stableSkillIdForSkillMdPath(skillMdPath)
  const versions = await getAgentSkillVersions(skillId)
  const current = versions.find((v) => v.isCurrentVersion)

  if (current) {
    const full = await getAgentSkill(current.id)
    if (full) {
      const sameEx =
        JSON.stringify(full.examples ?? []) === JSON.stringify(examples ?? [])
      const sameTags =
        JSON.stringify(full.tags ?? []) === JSON.stringify(tags ?? [])
      const samePlatforms =
        JSON.stringify(full.platforms ?? []) === JSON.stringify(platforms ?? [])
      const sameVersionLabel =
        (full.versionLabel || 'v1.0') === (versionLabel || 'v1.0')
      if (
        full.template === body &&
        full.name === name &&
        full.description === description &&
        full.category === category &&
        sameEx &&
        sameTags &&
        samePlatforms &&
        sameVersionLabel
      ) {
        result.skippedUnchanged++
        return
      }
    }
  }

  const input: CreateAgentSkillInput = {
    id: randomUUID(),
    skillId,
    name,
    description,
    category,
    template: body,
    tags,
    platforms,
    versionLabel,
    examples,
    // 记录源 SKILL.md 路径，供编辑/删除写回磁盘与反查（旧数据见 backfillFsScanSourcePaths）
    sourcePath: skillMdPath,
  }

  await createAgentSkill(input)
  result.imported++
}

// ==================== source_path 旧数据回填 + 磁盘写回辅助 ====================

/**
 * 回填旧 fs-scan 数据：source_path 为 NULL 的 fs-scan 行，
 * 若 description 以「从本地同步：」开头则截取路径回填。
 * 同组其他版本已有 source_path 的行也一并补齐。
 * 幂等，每次扫描前调用一次即可。
 */
export function backfillFsScanSourcePaths(): number {
  const db = getDB()
  let updated = 0
  try {
    // 「从本地同步：」与「从本地同步:」前缀都是 5 个字符，路径从第 6 个字符开始
    const r1 = db
      .prepare(
        `UPDATE agent_skills SET source_path = substr(description, 6)
         WHERE skill_id LIKE 'fs-scan-%'
           AND source_path IS NULL
           AND (description LIKE ? OR description LIKE ?)`,
      )
      .run(`${LOCAL_SYNC_DESC_PREFIX}%`, `${LOCAL_SYNC_DESC_PREFIX_ASCII}%`)
    // 组内其他版本已有 source_path 的，补到本行（描述里没有路径的旧版本行）
    const r2 = db
      .prepare(
        `UPDATE agent_skills SET source_path = (
           SELECT s.source_path FROM agent_skills s
           WHERE s.skill_id = agent_skills.skill_id
             AND s.source_path IS NOT NULL
           LIMIT 1
         )
         WHERE skill_id LIKE 'fs-scan-%' AND source_path IS NULL`,
      )
      .run()
    updated = r1.changes + r2.changes
  } catch (e) {
    console.warn('[SkillPathSync] backfillFsScanSourcePaths:', e)
  }
  if (updated > 0) {
    console.log(`[SkillPathSync] backfilled source_path for ${updated} fs-scan row(s)`)
  }
  return updated
}

/** 将单行 YAML 值序列化为安全文本（含特殊字符时用 JSON 引号包裹） */
function yamlScalar(value: string): string {
  const v = value.replace(/\r?\n/g, ' ').trim()
  if (
    v === '' ||
    /[:#\[\]{}&*!|>'"%@`,?]/.test(v) ||
    /^\s|\s$/.test(v) ||
    /^[-?]:?$/.test(v)
  ) {
    return JSON.stringify(v)
  }
  return v
}

function setTopLevelYamlKey(fmStr: string, key: string, value: string | undefined): string {
  if (value === undefined) return fmStr
  const line = `${key}: ${yamlScalar(value)}`
  const re = new RegExp(`^${key}\\s*:.*$`, 'm')
  if (re.test(fmStr)) return fmStr.replace(re, line)
  return fmStr.replace(/\s*$/, '') + `\n${line}`
}

function setMetadataYamlKeys(
  fmStr: string,
  fields: Record<string, string | undefined>,
): string {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined) as Array<[string, string]>
  if (!entries.length) return fmStr

  const lines = fmStr.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  let metaStart = -1
  let metaEnd = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^metadata\s*:/.test(lines[i]) && !/^\s/.test(lines[i])) {
      metaStart = i
      metaEnd = i + 1
      while (metaEnd < lines.length) {
        const l = lines[metaEnd]
        if (l.trim() === '') {
          metaEnd++
          continue
        }
        const indent = (l.match(/^(\s*)/)?.[1] ?? '').length
        if (indent === 0) break
        metaEnd++
      }
      break
    }
  }

  const indent = '  '
  const apply = (metaLines: string[]): string[] => {
    const next = [...metaLines]
    for (const [k, v] of entries) {
      const line = `${indent}${k}: ${yamlScalar(v)}`
      const idx = next.findIndex((l) => new RegExp(`^\\s+${k}\\s*:`).test(l))
      if (idx >= 0) next[idx] = line
      else next.push(line)
    }
    return next
  }

  if (metaStart >= 0) {
    const before = lines.slice(0, metaStart + 1)
    const metaLines = lines.slice(metaStart + 1, metaEnd)
    const after = lines.slice(metaEnd)
    return [...before, ...apply(metaLines), ...after].join('\n')
  }

  const block = ['metadata:', ...entries.map(([k, v]) => `${indent}${k}: ${yamlScalar(v)}`)]
  return fmStr.replace(/\s*$/, '') + '\n' + block.join('\n')
}

function joinCsv(values: string[] | undefined): string | undefined {
  if (values === undefined) return undefined
  return values.map((s) => s.trim()).filter(Boolean).join(', ')
}

/**
 * 把编辑后的 name/description/template 以及 metadata 四项写回磁盘 SKILL.md：
 * - 顶层保留 name/description；category/tags/platforms/version 写入 metadata:
 * - 未知 frontmatter 键原样保留；body 未提供 template 时保留原文
 * - 行尾风格跟随原文件（CRLF / LF）
 * - 无 frontmatter 的文件：有更新字段时补建 frontmatter
 * 同步写盘（文件小），写失败抛错由调用方决定不落库。
 */
export function rewriteSkillMdOnDisk(
  absPath: string,
  patch: {
    name?: string
    description?: string
    template?: string
    category?: string
    tags?: string[]
    platforms?: string[]
    versionLabel?: string
  },
): void {
  const raw = readFileSync(absPath, 'utf-8')
  const eol = detectEol(raw)
  const fmMatch = raw.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  const category =
    patch.category !== undefined && patch.category.trim() ? patch.category : undefined
  const metaFields: Record<string, string | undefined> = {
    category,
    tags: joinCsv(patch.tags),
    platforms: joinCsv(patch.platforms),
    version: patch.versionLabel,
  }

  const toDisk = (fmNormalized: string, body: string): string => {
    const fmOut = fmNormalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    return `---${eol}${fmOut.split('\n').join(eol)}${eol}---${eol}${body}`
  }

  if (!fmMatch) {
    const fmLines: string[] = []
    if (patch.name !== undefined) fmLines.push(`name: ${yamlScalar(patch.name)}`)
    if (patch.description !== undefined) fmLines.push(`description: ${yamlScalar(patch.description)}`)
    const metaLines = Object.entries(metaFields)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `  ${k}: ${yamlScalar(v!)}`)
    if (metaLines.length > 0) {
      fmLines.push('metadata:')
      fmLines.push(...metaLines)
    }
    const fm = fmLines.length > 0 ? `---${eol}${fmLines.join(eol)}${eol}---${eol}` : ''
    const body = patch.template !== undefined ? patch.template : raw
    writeFileSync(absPath, fm + body, 'utf-8')
    return
  }

  let fmStr = fmMatch[1].replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rest = raw.slice(fmMatch[0].length)

  fmStr = setTopLevelYamlKey(fmStr, 'name', patch.name)
  fmStr = setTopLevelYamlKey(fmStr, 'description', patch.description)
  fmStr = setMetadataYamlKeys(fmStr, metaFields)

  const body = patch.template !== undefined ? patch.template : rest
  writeFileSync(absPath, toDisk(fmStr, body), 'utf-8')
}

/**
 * 删除磁盘上的 SKILL.md 文件本身（保守策略：不同目录内其他文件，
 * 目录是否清空交给用户/agent 自己处理）。
 */
export function deleteSkillMdOnDisk(absPath: string): void {
  if (!existsSync(absPath)) return
  unlinkSync(absPath)
}
