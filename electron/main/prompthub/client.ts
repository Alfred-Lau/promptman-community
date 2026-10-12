/**
 * PromptHub HTTP API 客户端
 * 运行在 Electron 主进程，通过 fetch 直接调用远端 API
 */
import type {
  PromptHubTokenResponse,
  PromptHubLoginResponse,
  PromptHubRegisterResponse,
  PromptHubPrompt,
  PromptHubListResponse,
  PromptHubSearchResponse,
  PromptHubSyncPullResponse,
  PromptHubSyncPushRequest,
  PromptHubSyncPushResponse,
  CreatePromptHubPromptInput,
  UpdatePromptHubPromptInput,
  PromptHubSkill,
  PromptHubSkillSyncPullResponse,
  PromptHubSkillSyncPushRequest,
  PromptHubSkillSyncPushResponse,
  CreatePromptHubSkillInput,
  UpdatePromptHubSkillInput,
} from './types'

import { appendIPCApiLog } from '../appErrorLog'

export { }
export type * from './types'

/**
 * PromptHub 云同步 API 地址（开源版默认占位符）。
 *
 * 云同步是可选能力：本地核心功能（创建/搜索/版本管理）完全离线可用，
 * 只有登录/云同步才需要后端服务。开源贡献者与下游用户请自行部署或
 * 对接自己的 PromptHub 兼容后端，然后通过环境变量覆盖：
 *
 *   PROMPTHUB_API_BASE_URL=https://your-prompt-hub.example.com
 *
 * 不要依赖本占位符地址 —— 它不指向任何真实服务。
 */
const PRODUCTION_API_BASE = 'https://your-prompt-hub.example.com'

function getApiBaseUrl(): string {
  const fromEnv = process.env.PROMPTHUB_API_BASE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  // 开源版：未配置环境变量时不指向任何真实后端；本地调试可通过
  // PROMPTHUB_API_BASE_URL=http://localhost:3000 覆盖
  return PRODUCTION_API_BASE
}

/** 兼容服务端返回 token / apiToken、扁平字段或嵌套 user */
function parsePromptHubTokenPayload(body: Record<string, unknown>): PromptHubTokenResponse {
  const user = body.user as Record<string, unknown> | undefined
  const token = [body.token, body.apiToken, user?.apiToken].find(
    (v) => typeof v === 'string' && (v as string).length > 0
  ) as string | undefined
  const userId = [body.userId, user?.id].find(
    (v) => typeof v === 'string' && (v as string).length > 0
  ) as string | undefined
  const email = [body.email, user?.email].find(
    (v) => typeof v === 'string' && (v as string).length > 0
  ) as string | undefined
  const nameRaw = [body.name, user?.name].find((v) => typeof v === 'string') as string | undefined

  if (!token || !userId || !email) {
    throw new PromptHubAPIError('PromptHub 返回的 Token 数据格式异常', 500)
  }

  return {
    token,
    userId,
    email,
    name: (nameRaw?.trim() || email.split('@')[0] || 'User').trim(),
  }
}

// ==================== 内部工具函数 ====================

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options
  const base = getApiBaseUrl()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // 服务端有同源检查（sec-fetch-site / Referer），Electron 主进程 fetch 不会自动携带
    // 需要手动注入 Origin 和 Referer，否则登录/注册返回 401
    'Origin': base,
    'Referer': `${base}/login`,
    ...(fetchOptions.headers as Record<string, string> | undefined),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await fetch(`${base}${path}`, {
      ...fetchOptions,
      headers,
    })

    let body: Record<string, unknown>
    try {
      body = (await res.json()) as Record<string, unknown>
    } catch {
      appendIPCApiLog(`[PromptHub] ${path} HTTP ${res.status} 响应非 JSON`)
      throw new PromptHubAPIError(`HTTP ${res.status} 响应非 JSON`, res.status)
    }

    if (!res.ok) {
      const msg = (body.error as string) || `HTTP ${res.status}`
      appendIPCApiLog(`[PromptHub] ${path} HTTP ${res.status} ${msg}`)
      throw new PromptHubAPIError(msg, res.status)
    }

    return body as T
  } catch (e) {
    if (e instanceof PromptHubAPIError) throw e
    appendIPCApiLog(
      `[PromptHub] ${path} 网络或请求异常: ${e instanceof Error ? e.message : String(e)}`,
    )
    throw e
  }
}

export class PromptHubAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message)
    this.name = 'PromptHubAPIError'
  }
}

// ==================== 认证 API ====================

/**
 * 注册新用户
 */
export async function register(
  email: string,
  password: string,
  name: string,
  code: string
): Promise<PromptHubRegisterResponse> {
  return request<PromptHubRegisterResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name, code }),
  })
}

/**
 * 发送邮箱验证码
 * purpose 为 'register' 时会校验邮箱未被占用
 */
export async function sendEmailCode(
  email: string,
  purpose?: 'register'
): Promise<{ success: boolean; message?: string; devCode?: string }> {
  return request<{ success: boolean; message?: string; devCode?: string }>('/api/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ contact: email, ...(purpose ? { purpose } : {}) }),
  })
}

/**
 * 邮箱密码登录，返回完整用户信息（含 apiToken）
 */
export async function login(
  email: string,
  password: string
): Promise<PromptHubLoginResponse> {
  return request<PromptHubLoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

/**
 * 桌面端推荐：邮箱密码直接换 Token
 */
export async function getToken(
  email: string,
  password: string
): Promise<PromptHubTokenResponse> {
  const raw = await request<Record<string, unknown>>('/api/auth/token', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return parsePromptHubTokenPayload(raw)
}

/**
 * 验证 Token 有效性（桌面端启动时调用）
 */
export async function verifyToken(token: string): Promise<PromptHubTokenResponse> {
  const raw = await request<Record<string, unknown>>('/api/auth/token', {
    method: 'GET',
    token,
  })
  return parsePromptHubTokenPayload(raw)
}

/**
 * 吊销并重置 Token
 */
export async function revokeToken(token: string): Promise<{ token: string }> {
  return request<{ token: string }>('/api/auth/token', {
    method: 'DELETE',
    token,
  })
}

// ==================== 提示词 API ====================

/**
 * 获取提示词列表
 */
export async function listPrompts(
  token: string,
  params?: {
    category?: string
    org_id?: string
    limit?: number
    offset?: number
  }
): Promise<PromptHubListResponse> {
  const qs = new URLSearchParams()
  if (params?.category) qs.set('category', params.category)
  if (params?.org_id) qs.set('org_id', params.org_id)
  if (params?.limit !== undefined) qs.set('limit', String(params.limit))
  if (params?.offset !== undefined) qs.set('offset', String(params.offset))
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return request<PromptHubListResponse>(`/api/prompts${query}`, { token })
}

/**
 * 创建提示词
 */
export async function createPrompt(
  token: string,
  input: CreatePromptHubPromptInput
): Promise<{ data: PromptHubPrompt }> {
  return request<{ data: PromptHubPrompt }>('/api/prompts', {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  })
}

/**
 * 获取单条提示词（会使 uses +1）
 */
export async function getPrompt(
  token: string,
  id: string
): Promise<{ data: PromptHubPrompt }> {
  return request<{ data: PromptHubPrompt }>(`/api/prompts/${id}`, { token })
}

/**
 * 更新提示词
 */
export async function updatePrompt(
  token: string,
  id: string,
  input: UpdatePromptHubPromptInput
): Promise<{ data: PromptHubPrompt }> {
  return request<{ data: PromptHubPrompt }>(`/api/prompts/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(input),
  })
}

/**
 * 删除提示词
 */
export async function deletePrompt(
  token: string,
  id: string
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/prompts/${id}`, {
    method: 'DELETE',
    token,
  })
}

/**
 * 搜索提示词
 */
export async function searchPrompts(
  token: string,
  params: {
    q: string
    category?: string
    org_id?: string
    limit?: number
    offset?: number
  }
): Promise<PromptHubSearchResponse> {
  const qs = new URLSearchParams()
  qs.set('q', params.q)
  if (params.category) qs.set('category', params.category)
  if (params.org_id) qs.set('org_id', params.org_id)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  if (params.offset !== undefined) qs.set('offset', String(params.offset))
  return request<PromptHubSearchResponse>(`/api/prompts/search?${qs.toString()}`, { token })
}

/**
 * 增量/全量拉取同步
 * - since 不传：全量拉取
 * - since 传入上次的 serverTime：增量拉取
 */
export async function syncPull(
  token: string,
  params?: {
    since?: string
    limit?: number
    offset?: number
  }
): Promise<PromptHubSyncPullResponse> {
  const qs = new URLSearchParams()
  if (params?.since) qs.set('since', params.since)
  if (params?.limit !== undefined) qs.set('limit', String(params.limit))
  if (params?.offset !== undefined) qs.set('offset', String(params.offset))
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return request<PromptHubSyncPullResponse>(`/api/prompts/sync${query}`, { token })
}

/**
 * 批量推送本地变更
 */
export async function syncPush(
  token: string,
  payload: PromptHubSyncPushRequest
): Promise<PromptHubSyncPushResponse> {
  return request<PromptHubSyncPushResponse>('/api/prompts/sync', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

// ==================== Library API ====================

export interface CloudLibraryFolder {
  id: string
  name: string
  parent_id: string | null
  share_enabled?: boolean
  share_token?: string | null
}

export interface CloudLibraryItem {
  kind: 'prompt' | 'skill'
  id: string
  name: string
  accent: string
  description: string | null
  library_folder_id: string | null
  updated_at: string
}

export async function listCloudLibraryFolders(
  token: string
): Promise<CloudLibraryFolder[]> {
  const res = await request<{ data?: CloudLibraryFolder[] }>('/api/library/folders?tree=1', { token })
  return res.data ?? []
}

export async function listCloudLibraryItems(
  token: string,
  folderId: string | null
): Promise<CloudLibraryItem[]> {
  const q = folderId ? encodeURIComponent(folderId) : 'unfiled'
  const [pRes, sRes] = await Promise.all([
    request<{ data?: Record<string, unknown>[] }>(`/api/prompts?limit=200&library_folder_id=${q}`, { token }),
    request<{ data?: Record<string, unknown>[] }>(`/api/skills?limit=200&library_folder_id=${q}`, { token }),
  ])
  const items: CloudLibraryItem[] = []
  for (const r of pRes.data ?? []) {
    items.push({
      kind: 'prompt',
      id: String(r.id ?? ''),
      name: String(r.name ?? ''),
      accent: String(r.accent ?? '#f59e0b'),
      description: (r.description as string | null) ?? null,
      library_folder_id: (r.library_folder_id as string | null) ?? null,
      updated_at: String(r.updated_at ?? ''),
    })
  }
  for (const r of sRes.data ?? []) {
    items.push({
      kind: 'skill',
      id: String(r.id ?? ''),
      name: String(r.name ?? ''),
      accent: String(r.accent ?? '#6ee7f7'),
      description: (r.description as string | null) ?? null,
      library_folder_id: (r.library_folder_id as string | null) ?? null,
      updated_at: String(r.updated_at ?? ''),
    })
  }
  return items.sort((a, b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0))
}

// ==================== Skills API ====================

export async function listSkills(
  token: string,
  params?: { limit?: number }
): Promise<{ data?: Record<string, unknown>[] }> {
  const qs = new URLSearchParams()
  if (params?.limit !== undefined) qs.set('limit', String(params.limit))
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return request<{ data?: Record<string, unknown>[] }>(`/api/skills${query}`, { token })
}

export async function getSkill(
  token: string,
  id: string
): Promise<{ data: PromptHubSkill }> {
  return request<{ data: PromptHubSkill }>(`/api/skills/${encodeURIComponent(id)}`, { token })
}

export async function createSkill(
  token: string,
  input: CreatePromptHubSkillInput
): Promise<{ data: PromptHubSkill }> {
  return request<{ data: PromptHubSkill }>('/api/skills', {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  })
}

export async function updateSkill(
  token: string,
  id: string,
  input: UpdatePromptHubSkillInput
): Promise<{ data: PromptHubSkill }> {
  return request<{ data: PromptHubSkill }>(`/api/skills/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(input),
  })
}

export async function deleteSkill(
  token: string,
  id: string
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/skills/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
  })
}

export async function searchSkills(
  token: string,
  params: { q: string; limit?: number; offset?: number }
): Promise<{ data: PromptHubSkill[]; total: number }> {
  const qs = new URLSearchParams()
  qs.set('q', params.q)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  if (params.offset !== undefined) qs.set('offset', String(params.offset))
  return request<{ data: PromptHubSkill[]; total: number }>(
    `/api/skills/search?${qs.toString()}`,
    { token }
  )
}

/**
 * 技能增量/全量拉取同步
 * - since 不传：全量拉取
 * - since 传入上次的 serverTime：增量拉取
 */
export async function skillSyncPull(
  token: string,
  params?: {
    since?: string
    limit?: number
    offset?: number
  }
): Promise<PromptHubSkillSyncPullResponse> {
  const qs = new URLSearchParams()
  if (params?.since) qs.set('since', params.since)
  if (params?.limit !== undefined) qs.set('limit', String(params.limit))
  if (params?.offset !== undefined) qs.set('offset', String(params.offset))
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return request<PromptHubSkillSyncPullResponse>(`/api/skills/sync${query}`, { token })
}

/**
 * 技能批量推送本地变更
 */
export async function skillSyncPush(
  token: string,
  payload: PromptHubSkillSyncPushRequest
): Promise<PromptHubSkillSyncPushResponse> {
  return request<PromptHubSkillSyncPushResponse>('/api/skills/sync', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

// ==================== Discovery / Gallery API (public, no auth) ====================

export interface GalleryItem {
  id: string
  titleZh: string
  titleEn: string
  descZh: string
  descEn: string
  content: string
  category: string
  tags: string[]
  accent: string
  author: string
  uses: number
  rating: number
  difficulty: string
  platforms: string[]
  createdAt: string
  source: string
  type: string
}

export interface GalleryItemsResponse {
  data: GalleryItem[]
  total: number
  categoryCounts?: Record<string, number>
}

export async function fetchGalleryItems(params?: {
  q?: string
  category?: string
  sort?: 'popular' | 'newest' | 'rating'
}): Promise<GalleryItemsResponse> {
  const qs = new URLSearchParams()
  qs.set('counts', '1')
  if (params?.q) qs.set('q', params.q)
  if (params?.category && params.category !== 'all') qs.set('category', params.category)
  if (params?.sort) qs.set('sort', params.sort)
  return request<GalleryItemsResponse>(`/api/gallery/items?${qs.toString()}`)
}

export async function fetchGalleryPrompts(params?: {
  limit?: number
  offset?: number
}): Promise<{ data: Record<string, unknown>[]; total: number }> {
  const qs = new URLSearchParams()
  if (params?.limit !== undefined) qs.set('limit', String(params.limit))
  if (params?.offset !== undefined) qs.set('offset', String(params.offset))
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return request<{ data: Record<string, unknown>[]; total: number }>(`/api/gallery/prompts${query}`)
}

export async function fetchGallerySkills(params?: {
  limit?: number
  offset?: number
}): Promise<{ data: Record<string, unknown>[]; total: number }> {
  const qs = new URLSearchParams()
  if (params?.limit !== undefined) qs.set('limit', String(params.limit))
  if (params?.offset !== undefined) qs.set('offset', String(params.offset))
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return request<{ data: Record<string, unknown>[]; total: number }>(`/api/gallery/skills${query}`)
}
