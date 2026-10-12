/**
 * PromptHub API 类型定义
 * 对应后端 API 文档 v1
 */

// ==================== 认证模块 ====================

export interface PromptHubTokenResponse {
  token: string
  userId: string
  email: string
  name: string
}

export interface PromptHubUser {
  id: string
  name: string
  email: string
  avatar: string
  avatarGradient: string
  provider: 'email' | 'github'
  bio?: string | null
  createdAt: string
  apiToken: string
}

export interface PromptHubRegisterResponse {
  user: PromptHubUser
}

export interface PromptHubLoginResponse {
  user: PromptHubUser
}

// ==================== 提示词模块 ====================

export interface PromptHubPrompt {
  id: string
  user_id: string
  org_id: string | null
  name: string
  description: string
  content: string
  category: string
  tags: string[]
  accent: string
  is_starred: boolean
  uses: number
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface PromptHubListResponse {
  data: PromptHubPrompt[]
  limit: number
  offset: number
}

export interface PromptHubSearchResponse {
  data: PromptHubPrompt[]
  total: number
  limit: number
  offset: number
}

export interface PromptHubSyncPullResponse {
  data: PromptHubPrompt[]
  total: number
  limit: number
  offset: number
  serverTime: string
}

export interface PromptUpsertItem {
  id?: string
  name: string
  content: string
  description?: string
  category?: string
  tags?: string[]
  accent?: string
  org_id?: string | null
  is_public?: boolean
  is_starred?: boolean
  client_updated_at?: string
}

export interface PromptHubSyncPushRequest {
  upsert?: PromptUpsertItem[]
  delete?: string[]
}

export type SyncAction = 'created' | 'updated' | 'skipped' | 'deleted' | 'error'

export interface SyncResult {
  id: string
  action: SyncAction
  reason?: string
}

export interface SyncSummary {
  created: number
  updated: number
  skipped: number
  deleted: number
  errors: number
}

export interface PromptHubSyncPushResponse {
  results: SyncResult[]
  summary: SyncSummary
  serverTime: string
}

// ==================== 创建/更新 ====================

export interface CreatePromptHubPromptInput {
  name: string
  content: string
  description?: string
  category?: string
  tags?: string[]
  accent?: string
  org_id?: string | null
  is_public?: boolean
}

export interface UpdatePromptHubPromptInput {
  name?: string
  description?: string
  content?: string
  category?: string
  tags?: string[]
  accent?: string
  is_starred?: boolean
  is_public?: boolean
}

// ==================== 技能模块 ====================

/**
 * 云端技能（/api/skills/sync 返回的列）
 * 技能包（package_* / file_tree）只存本机，不在此列
 */
export interface PromptHubSkill {
  id: string
  user_id: string
  name: string
  description: string
  /** 自由文本版本号，如 'v1.0' */
  version: string
  accent: string
  skill_md: string
  is_active: boolean
  is_public: boolean
  platforms: string[]
  tags: string[]
  uses: number
  library_folder_id?: string | null
  created_at: string
  updated_at: string
}

export interface SkillUpsertItem {
  id?: string
  name: string
  description?: string
  version?: string
  accent?: string
  skill_md?: string
  is_active?: boolean
  is_public?: boolean
  platforms?: string[]
  tags?: string[]
  client_updated_at?: string
}

export interface PromptHubSkillSyncPushRequest {
  upsert?: SkillUpsertItem[]
  delete?: string[]
}

export interface PromptHubSkillSyncPushResponse {
  results: SyncResult[]
  summary: SyncSummary
  serverTime: string
}

export interface PromptHubSkillSyncPullResult {
  skills: PromptHubSkill[]
  serverTime: string
  isFullSync: boolean
  upserted: number
  removed: number
}

// ==================== 本地同步状态记录 ====================

export interface PromptHubSyncState {
  lastSyncTime: string | null
  lastServerTime: string | null
  isFirstSync: boolean
}
