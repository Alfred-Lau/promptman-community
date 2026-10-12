/**
 * PromptHub 技能云同步
 *
 * 与 sync.ts（提示词）结构一致，但游标独立（store.promptHubSkillSync），
 * 因为 /api/prompts/sync 与 /api/skills/sync 各自推进自己的 serverTime。
 *
 * 同步范围：元数据 + SKILL.md 正文。
 * 多文件技能包（package_dir / file_tree）只存本机，不参与同步——
 * 桌面端因此不需要持有 OSS 凭证。
 */
import { store } from '../store'
import { getDB } from '../sqlitedb/db'
import { saveEmbedding, makeDocument } from '../sqlitedb/crud'
import { normalizeTagsForSave, resolveTagIdsToNames } from '../sqlitedb/tags'
import { deletePackageDir } from '../skillPackages'
import {
  skillSyncPull,
  skillSyncPush,
  createSkill as clientCreateSkill,
  updateSkill as clientUpdateSkill,
  deleteSkill as clientDeleteSkill,
  searchSkills as clientSearchSkills,
  listSkills as clientListSkills,
} from './client'
import type {
  PromptHubSkill,
  PromptHubSkillSyncPullResponse,
  PromptHubSkillSyncPushRequest,
  PromptHubSkillSyncPushResponse,
  SkillUpsertItem,
  CreatePromptHubSkillInput,
  UpdatePromptHubSkillInput,
} from './types'
import { PROMPTHUB_SYNC_NOT_LOGGED_IN } from './syncErrors'

export type {
  PromptHubSkill,
  PromptHubSkillSyncPullResponse,
  PromptHubSkillSyncPushRequest,
  PromptHubSkillSyncPushResponse,
  SkillUpsertItem,
}

/** 云端技能 id 前缀；本地原生技能（skill_* / fs-scan-*）绝不能被云端删除逻辑波及 */
const CLOUD_ID_PREFIX = 'sk_'

async function requireToken(): Promise<string> {
  const hubAuth = await store.getPromptHubAuth()
  if (!hubAuth.token) throw new Error(PROMPTHUB_SYNC_NOT_LOGGED_IN)
  return hubAuth.token
}

function toBoolInt(value: unknown, fallback = 0): number {
  if (value === undefined || value === null) return fallback
  return value ? 1 : 0
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v))
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : []
    } catch {
      return []
    }
  }
  return []
}

// ==================== 拉取 ====================

/**
 * 将云端技能写入（upsert）本地 SQLite
 * - 云端 id 同时作为本地 id 与 skill_id（云端无版本概念）
 * - 已存在时仅当云端 updated_at >= 本地才覆盖，避免盖掉更新的本地改动
 */
function upsertHubSkillToLocal(skill: PromptHubSkill): void {
  const db = getDB()
  const existing = db
    .prepare('SELECT id, updated_at FROM agent_skills WHERE id = ?')
    .get(skill.id) as { id: string; updated_at: string } | undefined

  const tagIds = normalizeTagsForSave(toStringArray(skill.tags))
  const tagsJson = JSON.stringify(tagIds)
  const platformsJson = JSON.stringify(toStringArray(skill.platforms))
  const updatedAt = skill.updated_at || new Date().toISOString()
  const skillMd = typeof skill.skill_md === 'string' ? skill.skill_md : ''

  const reindex = (): void => {
    const doc = makeDocument([
      skill.name,
      skill.description || '',
      skillMd,
      ...resolveTagIdsToNames(tagIds),
    ])
    saveEmbedding(skill.id, 'agent_skills', doc)
  }

  if (existing) {
    if (updatedAt < existing.updated_at) return
    db.prepare(
      `UPDATE agent_skills SET name=?, description=?, template=?, tags=?, accent=?,
         platforms=?, is_active=?, version_label=?, is_public=?, uses=?, updated_at=?, cloud_id=?
       WHERE id=?`
    ).run(
      skill.name,
      skill.description || '',
      skillMd,
      tagsJson,
      skill.accent || '#6ee7f7',
      platformsJson,
      toBoolInt(skill.is_active, 1),
      skill.version || 'v1.0',
      toBoolInt(skill.is_public, 0),
      Number(skill.uses) || 0,
      updatedAt,
      skill.id,
      skill.id
    )
    reindex()
    return
  }

  const createdAt = skill.created_at || updatedAt
  db.prepare(
    `INSERT INTO agent_skills
       (id, skill_id, name, description, category, template, parameters, examples, tags,
        version, is_current_version, created_at, updated_at, accent, platforms, is_active,
        version_label, is_public, uses, cloud_id)
     VALUES (?, ?, ?, ?, '', ?, '{}', '[]', ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    skill.id,
    skill.id, // skill_id 与 id 保持一致（云端无版本概念）
    skill.name,
    skill.description || '',
    skillMd,
    tagsJson,
    createdAt,
    updatedAt,
    skill.accent || '#6ee7f7',
    platformsJson,
    toBoolInt(skill.is_active, 1),
    skill.version || 'v1.0',
    toBoolInt(skill.is_public, 0),
    Number(skill.uses) || 0,
    skill.id
  )
  reindex()
}

/**
 * 全量同步后清理云端已删除的技能
 *
 * 只处理确实来自云端的行，本地原生技能不受影响。两道保险：
 * 1. id 前缀必须精确等于 'sk_' —— 这里**不能**用 `LIKE 'sk_%'`，因为 SQLite 的 LIKE
 *    把 `_` 当单字符通配符，本地新建的 `skill-<ts>-<rand>` 会被误匹配并删除。
 * 2. cloud_id 必须非空（只有同步/上传过的行才会写 cloud_id）。
 */
function removeDeletedHubSkills(cloudIds: Set<string>): string[] {
  const db = getDB()
  const rows = db
    .prepare(
      `SELECT id, skill_id FROM agent_skills
       WHERE substr(id, 1, ?) = ? AND cloud_id IS NOT NULL`
    )
    .all(CLOUD_ID_PREFIX.length, CLOUD_ID_PREFIX) as { id: string; skill_id: string }[]

  const removed: string[] = []
  for (const row of rows) {
    if (cloudIds.has(row.id)) continue
    db.prepare('DELETE FROM agent_skills WHERE id = ?').run(row.id)
    // 云端技能被删除时，本机对应的技能包目录一并清理
    deletePackageDir(row.skill_id)
    removed.push(row.id)
  }
  return removed
}

/**
 * 拉取同步
 * - forceFullSync 或首次同步：全量拉取
 * - 否则：增量拉取（since = 上次 serverTime）
 */
export async function pullSyncSkills(options?: {
  forceFullSync?: boolean
  limit?: number
}): Promise<{
  skills: PromptHubSkill[]
  serverTime: string
  isFullSync: boolean
  upserted: number
  removed: number
}> {
  const token = await requireToken()

  const syncState = await store.getPromptHubSkillSync()
  const isFullSync = options?.forceFullSync || !syncState.lastServerTime

  const resp = await skillSyncPull(token, {
    since: isFullSync ? undefined : syncState.lastServerTime ?? undefined,
    limit: options?.limit ?? 500,
  })

  const data = Array.isArray(resp.data) ? resp.data : []
  let removed = 0

  const db = getDB()
  const upsertTx = db.transaction(() => {
    for (const skill of data) {
      upsertHubSkillToLocal(skill)
    }
    if (isFullSync) {
      removed = removeDeletedHubSkills(new Set(data.map((s) => s.id))).length
    }
  })
  upsertTx()

  await store.setPromptHubSkillSync({
    lastServerTime: resp.serverTime,
    lastSyncAt: new Date().toISOString(),
  })

  return {
    skills: data,
    serverTime: resp.serverTime,
    isFullSync,
    upserted: data.length,
    removed,
  }
}

// ==================== 推送 ====================

/**
 * 推送同步：将本地变更批量推送到云端
 */
export async function pushSyncSkills(
  payload: PromptHubSkillSyncPushRequest
): Promise<PromptHubSkillSyncPushResponse> {
  const token = await requireToken()
  const resp = await skillSyncPush(token, payload)

  if (resp.serverTime) {
    await store.setPromptHubSkillSync({
      lastServerTime: resp.serverTime,
      lastSyncAt: new Date().toISOString(),
    })
  }
  return resp
}

/**
 * 把本地某个技能（按 skill_id 取当前版本）组装成推送载荷
 * 返回 null 表示技能不存在
 */
export function buildSkillUpsertItem(skillId: string): SkillUpsertItem | null {
  const row = getDB()
    .prepare(
      `SELECT * FROM agent_skills WHERE skill_id = ?
       ORDER BY is_current_version DESC, version DESC LIMIT 1`
    )
    .get(skillId) as Record<string, unknown> | undefined
  if (!row) return null

  const tagIds = toStringArray(row.tags)
  const cloudId = (row.cloud_id as string) || null

  return {
    // 已同步过的技能带上云端 id 走更新分支；本地新技能省略 id 让服务端生成 sk_ id
    ...(cloudId ? { id: cloudId } : {}),
    name: row.name as string,
    description: (row.description as string) || '',
    version: (row.version_label as string) || 'v1.0',
    accent: (row.accent as string) || '#6ee7f7',
    skill_md: (row.template as string) || '',
    is_active: row.is_active === undefined || row.is_active === null ? true : !!row.is_active,
    is_public: !!row.is_public,
    platforms: toStringArray(row.platforms),
    tags: resolveTagIdsToNames(tagIds),
    client_updated_at: (row.updated_at as string) || new Date().toISOString(),
  }
}

/**
 * 推送单个本地技能，并把服务端返回的 cloud_id 回写到该技能的所有版本
 */
export async function pushLocalSkill(skillId: string): Promise<{
  cloudId: string | null
  action: string
  reason?: string
}> {
  const item = buildSkillUpsertItem(skillId)
  if (!item) throw new Error(`技能 ${skillId} 不存在`)

  const resp = await pushSyncSkills({ upsert: [item] })
  const result = resp.results?.[0]
  if (!result) return { cloudId: item.id ?? null, action: 'error', reason: '服务端未返回结果' }
  if (result.action === 'error') {
    throw new Error(result.reason || '推送技能失败')
  }

  if (result.action === 'created' || result.action === 'updated') {
    getDB()
      .prepare('UPDATE agent_skills SET cloud_id = ? WHERE skill_id = ?')
      .run(result.id, skillId)
  }

  return { cloudId: result.id, action: result.action, reason: result.reason }
}

/**
 * 把本地技能上传为一条全新的云端技能（用于「上传到云端」按钮）
 * 与 pushLocalSkill 的区别：忽略已有 cloud_id，总是新建
 */
export async function hubUploadLocalSkill(skillId: string): Promise<{ cloudId: string }> {
  const token = await requireToken()
  const item = buildSkillUpsertItem(skillId)
  if (!item) throw new Error(`技能 ${skillId} 不存在`)

  const resp = await clientCreateSkill(token, {
    name: item.name,
    description: item.description,
    version: item.version,
    accent: item.accent,
    skill_md: item.skill_md,
    is_active: item.is_active,
    is_public: item.is_public,
    platforms: item.platforms,
    tags: item.tags,
  })

  const cloudId = resp.data.id
  getDB()
    .prepare('UPDATE agent_skills SET cloud_id = ? WHERE skill_id = ?')
    .run(cloudId, skillId)
  return { cloudId }
}

/**
 * 删除云端技能，并推进同步游标
 */
export async function hubDeleteSkill(cloudId: string): Promise<void> {
  const token = await requireToken()
  await clientDeleteSkill(token, cloudId)
}

// ==================== 单条操作（直接 API） ====================

export async function hubListSkills(params?: { limit?: number }): Promise<
  Record<string, unknown>[]
> {
  const token = await requireToken()
  const resp = await clientListSkills(token, params)
  return resp.data ?? []
}

export async function hubSearchSkills(params: {
  q: string
  limit?: number
  offset?: number
}): Promise<{ data: PromptHubSkill[]; total: number }> {
  const token = await requireToken()
  const resp = await clientSearchSkills(token, params)
  return { data: resp.data ?? [], total: resp.total ?? 0 }
}

export async function hubCreateSkill(
  input: CreatePromptHubSkillInput
): Promise<PromptHubSkill> {
  const token = await requireToken()
  const resp = await clientCreateSkill(token, input)
  return resp.data
}

export async function hubUpdateSkill(
  id: string,
  input: UpdatePromptHubSkillInput
): Promise<PromptHubSkill> {
  const token = await requireToken()
  const resp = await clientUpdateSkill(token, id, input)
  return resp.data
}

/**
 * 获取技能同步状态
 */
export async function getSkillSyncState(): Promise<{
  lastServerTime: string | null
  lastSyncAt: string | null
}> {
  return store.getPromptHubSkillSync()
}
