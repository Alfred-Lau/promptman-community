/**
 * PromptHub 云同步服务
 *
 * 负责：
 * 1. Token 验证（启动时）
 * 2. 全量/增量拉取 → 写入本地 SQLite
 * 3. 本地变更 → 批量推送到 PromptHub
 */
import { store } from '../store'
import { getDB } from '../sqlitedb/db'
import { saveEmbedding, makeDocument } from '../sqlitedb/crud'
import { normalizeTagsForSave, resolveTagIdsToNames } from '../sqlitedb/tags'
import {
  verifyToken,
  syncPull,
  syncPush,
  PromptHubAPIError,
  listPrompts,
  searchPrompts as clientSearchPrompts,
  createPrompt as clientCreatePrompt,
  updatePrompt as clientUpdatePrompt,
  deletePrompt as clientDeletePrompt,
} from './client'
import type {
  PromptHubPrompt,
  PromptHubSyncPushRequest,
  PromptHubSyncPushResponse,
  PromptHubSyncPullResponse,
  CreatePromptHubPromptInput,
  UpdatePromptHubPromptInput,
} from './client'
import { PROMPTHUB_SYNC_NOT_LOGGED_IN } from './syncErrors'

export type {
  PromptHubPrompt,
  PromptHubSyncPushRequest,
  PromptHubSyncPushResponse,
  PromptHubSyncPullResponse,
  CreatePromptHubPromptInput,
  UpdatePromptHubPromptInput,
}

/** 云端 prompt id 前缀；本地原生 prompt（prompt-*）绝不能被云端删除逻辑波及 */
const CLOUD_ID_PREFIX = 'p_'

// ==================== Token 管理 ====================

/**
 * 获取已保存的 PromptHub Token，若不存在则返回 null
 */
export async function getPromptHubToken(): Promise<string | null> {
  const hubAuth = await store.getPromptHubAuth()
  return hubAuth.token
}

/**
 * 启动时验证 Token 有效性
 * - 有效：返回 token 信息
 * - 无效或无 token：返回 null
 */
export async function checkPromptHubToken(): Promise<{
  token: string
  userId: string
  email: string
  name: string
} | null> {
  const hubAuth = await store.getPromptHubAuth()
  if (!hubAuth.token) return null

  try {
    const result = await verifyToken(hubAuth.token)
    // 更新本地存储（以防服务端更新了用户信息）
    await store.setPromptHubAuth({
      token: result.token,
      userId: result.userId,
      email: result.email,
      name: result.name,
    })
    return result
  } catch (err) {
    if (err instanceof PromptHubAPIError && err.statusCode === 401) {
      await store.clearUnifiedSession()
      return null
    }
    throw err
  }
}

/**
 * 登出云端（与应用登录统一：一并清除本地会话）
 */
export async function logoutPromptHub(): Promise<void> {
  await store.clearUnifiedSession()
}

// ==================== 数据同步 ====================

/**
 * 将云端 PromptHubPrompt 写入（upsert）本地 SQLite
 * - id 已存在：更新 title/content/description/category/tags/updated_at
 * - id 不存在：新建，用云端 id 作为本地 id（保持一致，便于后续推送时对账）
 */
function upsertHubPromptToLocal(prompt: PromptHubPrompt): void {
  const db = getDB()
  const existing = db
    .prepare('SELECT id, prompt_id, updated_at FROM prompts WHERE id = ?')
    .get(prompt.id) as { id: string; prompt_id: string; updated_at: string } | undefined

  const tagIds = normalizeTagsForSave(prompt.tags || [])
  const tagsJson = JSON.stringify(tagIds)
  const updatedAt = prompt.updated_at || new Date().toISOString()

  if (existing) {
    // 已存在：仅当云端更新时间 >= 本地时才覆盖（防止覆盖更新的本地改动）
    if (updatedAt >= existing.updated_at) {
      db.prepare(
        `UPDATE prompts SET title=?, content=?, description=?, category=?, tags=?, updated_at=?, cloud_id=? WHERE id=?`
      ).run(
        prompt.name,
        prompt.content,
        prompt.description || '',
        prompt.category || '',
        tagsJson,
        updatedAt,
        prompt.id,
        prompt.id
      )
      const doc = makeDocument([
        prompt.name,
        prompt.content,
        prompt.description,
        prompt.category,
        ...resolveTagIdsToNames(tagIds),
      ])
      saveEmbedding(prompt.id, 'prompts', doc)
    }
  } else {
    // 不存在：新建，使用云端 id 作为本地 id 和 prompt_id，并标记 cloud_id
    const createdAt = prompt.created_at || updatedAt
    db.prepare(
      `INSERT INTO prompts (id, prompt_id, title, content, description, category, tags, change_notes, version, is_current_version, created_at, updated_at, cloud_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, '', 1, 1, ?, ?, ?)`
    ).run(
      prompt.id,
      prompt.id,   // prompt_id 与 id 保持一致（云端无版本概念）
      prompt.name,
      prompt.content,
      prompt.description || '',
      prompt.category || '',
      tagsJson,
      createdAt,
      updatedAt,
      prompt.id    // cloud_id = 云端 id
    )
    const doc = makeDocument([
      prompt.name,
      prompt.content,
      prompt.description,
      prompt.category,
      ...resolveTagIdsToNames(tagIds),
    ])
    saveEmbedding(prompt.id, 'prompts', doc)
  }
}

/**
 * 从本地 SQLite 删除云端已删除的 prompt（全量同步后调用）
 * 全量同步时，云端返回的是当前所有 prompt，不在列表中的说明已被删除
 *
 * 只处理确实来自云端的行，本地原生 prompt 不受影响。两道保险：
 * 1. id 前缀必须精确等于 'p_' —— 这里**不能**用 `LIKE 'p_%'`，因为 SQLite 的 LIKE
 *    把 `_` 当单字符通配符，本地新建的 `prompt-<ts>-<rand>` 会被误匹配并删除。
 * 2. cloud_id 必须非空（只有同步/上传过的行才会写 cloud_id）。
 */
function removeDeletedHubPrompts(cloudIds: Set<string>): void {
  const db = getDB()
  const rows = db
    .prepare(
      `SELECT id FROM prompts
       WHERE substr(id, 1, ?) = ? AND cloud_id IS NOT NULL`
    )
    .all(CLOUD_ID_PREFIX.length, CLOUD_ID_PREFIX) as { id: string }[]
  for (const row of rows) {
    if (!cloudIds.has(row.id)) {
      db.prepare('DELETE FROM prompts WHERE id = ?').run(row.id)
    }
  }
}

/**
 * 拉取同步
 * - isFirstSync 或 lastServerTime 为 null：全量拉取
 * - 否则：增量拉取
 *
 * 拉取到的数据会实时 upsert 到本地 SQLite，UI 刷新列表后即可看到最新数据
 */
export async function pullSync(options?: {
  forceFullSync?: boolean
  limit?: number
}): Promise<{
  prompts: PromptHubPrompt[]
  serverTime: string
  isFullSync: boolean
  upserted: number
}> {
  const token = await getPromptHubToken()
  if (!token) throw new Error(PROMPTHUB_SYNC_NOT_LOGGED_IN)

  const syncState = await store.getPromptHubSync()
  const isFullSync = options?.forceFullSync || !syncState.lastServerTime

  const resp = await syncPull(token, {
    since: isFullSync ? undefined : syncState.lastServerTime ?? undefined,
    limit: options?.limit ?? 500,
  })

  // 写入本地 SQLite
  const db = getDB()
  const upsertTx = db.transaction(() => {
    for (const prompt of resp.data) {
      upsertHubPromptToLocal(prompt)
    }
    // 全量同步时，删除云端不再存在的 prompt
    if (isFullSync) {
      const cloudIds = new Set(resp.data.map(p => p.id))
      removeDeletedHubPrompts(cloudIds)
    }
  })
  upsertTx()

  // 保存新的 serverTime
  await store.setPromptHubSync({
    lastServerTime: resp.serverTime,
    lastSyncAt: new Date().toISOString(),
  })

  return {
    prompts: resp.data,
    serverTime: resp.serverTime,
    isFullSync,
    upserted: resp.data.length,
  }
}

/**
 * 推送同步：将本地变更批量推送到 PromptHub
 */
export async function pushSync(
  payload: PromptHubSyncPushRequest
): Promise<PromptHubSyncPushResponse> {
  const token = await getPromptHubToken()
  if (!token) throw new Error(PROMPTHUB_SYNC_NOT_LOGGED_IN)

  const resp = await syncPush(token, payload)

  // 更新 serverTime
  if (resp.serverTime) {
    await store.setPromptHubSync({
      lastServerTime: resp.serverTime,
      lastSyncAt: new Date().toISOString(),
    })
  }

  return resp
}

// ==================== 单条操作（直接 API） ====================

export async function hubListPrompts(params?: {
  category?: string
  org_id?: string
  limit?: number
  offset?: number
}): Promise<PromptHubPrompt[]> {
  const token = await getPromptHubToken()
  if (!token) throw new Error(PROMPTHUB_SYNC_NOT_LOGGED_IN)
  const resp = await listPrompts(token, params)
  return resp.data
}

export async function hubSearchPrompts(params: {
  q: string
  category?: string
  limit?: number
  offset?: number
}): Promise<{ data: PromptHubPrompt[]; total: number }> {
  const token = await getPromptHubToken()
  if (!token) throw new Error(PROMPTHUB_SYNC_NOT_LOGGED_IN)
  const resp = await clientSearchPrompts(token, params)
  return { data: resp.data, total: resp.total }
}

export async function hubCreatePrompt(
  input: CreatePromptHubPromptInput
): Promise<PromptHubPrompt> {
  const token = await getPromptHubToken()
  if (!token) throw new Error(PROMPTHUB_SYNC_NOT_LOGGED_IN)
  const resp = await clientCreatePrompt(token, input)
  return resp.data
}

export async function hubUpdatePrompt(
  id: string,
  input: UpdatePromptHubPromptInput
): Promise<PromptHubPrompt> {
  const token = await getPromptHubToken()
  if (!token) throw new Error(PROMPTHUB_SYNC_NOT_LOGGED_IN)
  const resp = await clientUpdatePrompt(token, id, input)
  return resp.data
}

export async function hubDeletePrompt(id: string): Promise<void> {
  const token = await getPromptHubToken()
  if (!token) throw new Error(PROMPTHUB_SYNC_NOT_LOGGED_IN)
  await clientDeletePrompt(token, id)
}

/**
 * 获取当前 PromptHub 登录用户信息
 */
export async function getPromptHubUser(): Promise<{
  token: string
  userId: string
  email: string
  name: string
} | null> {
  const hubAuth = await store.getPromptHubAuth()
  if (!hubAuth.token || !hubAuth.userId) return null
  return {
    token: hubAuth.token,
    userId: hubAuth.userId,
    email: hubAuth.email || '',
    name: hubAuth.name || '',
  }
}

/**
 * 获取同步状态
 */
export async function getSyncState(): Promise<{
  lastServerTime: string | null
  lastSyncAt: string | null
}> {
  return store.getPromptHubSync()
}

/**
 * 将本地 prompt 上传到云端，并更新本地 cloud_id
 */
export async function hubUploadLocalPrompt(localId: string): Promise<{
  cloudId: string
}> {
  const token = await getPromptHubToken()
  if (!token) throw new Error(PROMPTHUB_SYNC_NOT_LOGGED_IN)

  const db = getDB()
  const row = db
    .prepare('SELECT * FROM prompts WHERE id = ?')
    .get(localId) as Record<string, unknown> | undefined
  if (!row) throw new Error(`Prompt ${localId} 不存在`)

  const resp = await clientCreatePrompt(token, {
    name: row.title as string,
    content: row.content as string,
    description: (row.description as string) || undefined,
    category: (row.category as string) || undefined,
    tags: JSON.parse((row.tags as string) || '[]'),
  })

  const cloudId = resp.data.id
  // 更新所有相同 prompt_id 的版本的 cloud_id
  db.prepare('UPDATE prompts SET cloud_id = ? WHERE prompt_id = ?').run(cloudId, row.prompt_id as string)

  return { cloudId }
}
