/**
 * PromptHub 云同步前端 API 封装
 * 通过 Electron IPC 与主进程通信，调用 PromptHub 远端接口
 */
import { isElectron, getElectronAPI } from '../electron'
import type {
  PromptHubPrompt,
  PromptHubSyncPushRequest,
  PromptHubSyncPushResponse,
  PromptHubSyncPullResponse,
  CreatePromptHubPromptInput,
  UpdatePromptHubPromptInput,
  PromptHubTokenResponse,
  PromptHubSkillSyncPushRequest,
  PromptHubSkillSyncPushResponse,
  PromptHubSkillSyncPullResult,
} from './types'

export type * from './types'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

function checkElectron(): void {
  if (!isElectron()) {
    throw new Error('PromptHub API 只能在 Electron 环境中使用')
  }
}

// ==================== 认证 API ====================

export const promptHubAuthAPI = {
  /**
   * 验证已保存的 Token 是否有效（应用启动时调用）
   * - 有效：返回用户信息
   * - 无效或无 token：返回 null
   */
  async check(): Promise<PromptHubTokenResponse | null> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompthub:auth:check') as ApiResponse<PromptHubTokenResponse | null>
    if (!result.success) {
      throw new Error(result.error || '验证 Token 失败')
    }
    return result.data ?? null
  },

  /**
   * 获取本地缓存的用户信息（不验证 token）
   */
  async getUser(): Promise<{
    token: string
    userId: string
    email: string
    name: string
  } | null> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompthub:auth:user') as ApiResponse<{
      token: string
      userId: string
      email: string
      name: string
    } | null>
    if (!result.success) {
      throw new Error(result.error || '获取用户信息失败')
    }
    return result.data ?? null
  },

  /**
   * 登出 PromptHub（清除本地 token 和同步记录）
   */
  async logout(): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompthub:auth:logout') as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '登出失败')
    }
  },
}

// ==================== 同步 API ====================

export const promptHubSyncAPI = {
  /**
   * 拉取同步
   * - forceFullSync=true 或首次同步：全量拉取
   * - 否则：增量拉取（since=lastServerTime）
   */
  async pull(options?: {
    forceFullSync?: boolean
    limit?: number
  }): Promise<{
    prompts: PromptHubPrompt[]
    serverTime: string
    isFullSync: boolean
  }> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompthub:sync:pull', options) as ApiResponse<{
      prompts: PromptHubPrompt[]
      serverTime: string
      isFullSync: boolean
    }>
    if (!result.success) {
      throw new Error(result.error || '同步拉取失败')
    }
    return result.data!
  },

  /**
   * 推送同步：将本地新增/修改/删除推送到 PromptHub
   */
  async push(payload: PromptHubSyncPushRequest): Promise<PromptHubSyncPushResponse> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompthub:sync:push', payload) as ApiResponse<PromptHubSyncPushResponse>
    if (!result.success) {
      throw new Error(result.error || '同步推送失败')
    }
    return result.data!
  },

  /**
   * 获取本地同步状态（上次同步时间等）
   */
  async getState(): Promise<{
    lastServerTime: string | null
    lastSyncAt: string | null
  }> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompthub:sync:state') as ApiResponse<{
      lastServerTime: string | null
      lastSyncAt: string | null
    }>
    if (!result.success) {
      throw new Error(result.error || '获取同步状态失败')
    }
    return result.data!
  },
}

// ==================== 技能同步 API ====================

/**
 * 技能同步与提示词同步共享登录态，但游标独立
 * （/api/prompts/sync 与 /api/skills/sync 各自推进 serverTime）
 */
export const promptHubSkillSyncAPI = {
  /**
   * 拉取技能同步
   * - forceFullSync=true 或首次同步：全量拉取，并清理云端已删除的技能
   * - 否则：增量拉取（since=lastServerTime）
   */
  async pull(options?: {
    forceFullSync?: boolean
    limit?: number
  }): Promise<PromptHubSkillSyncPullResult> {
    checkElectron()
    const result = await getElectronAPI().invoke(
      'prompthub:skill:syncPull',
      options,
    ) as ApiResponse<PromptHubSkillSyncPullResult>
    if (!result.success) {
      throw new Error(result.error || '技能同步拉取失败')
    }
    return result.data!
  },

  /** 批量推送本地技能变更 */
  async push(payload: PromptHubSkillSyncPushRequest): Promise<PromptHubSkillSyncPushResponse> {
    checkElectron()
    const result = await getElectronAPI().invoke(
      'prompthub:skill:syncPush',
      payload,
    ) as ApiResponse<PromptHubSkillSyncPushResponse>
    if (!result.success) {
      throw new Error(result.error || '技能同步推送失败')
    }
    return result.data!
  },

  /**
   * 推送单个本地技能（保存后调用）
   * 已有 cloud_id 走更新，否则新建并把 cloud_id 回写到本地所有版本
   */
  async pushOne(skillId: string): Promise<{
    cloudId: string | null
    action: string
    reason?: string
  }> {
    checkElectron()
    const result = await getElectronAPI().invoke(
      'prompthub:skill:pushOne',
      { skillId },
    ) as ApiResponse<{ cloudId: string | null; action: string; reason?: string }>
    if (!result.success) {
      throw new Error(result.error || '推送技能失败')
    }
    return result.data!
  },

  /** 把本地技能上传为一条全新的云端技能 */
  async upload(skillId: string): Promise<{ cloudId: string }> {
    checkElectron()
    const result = await getElectronAPI().invoke(
      'prompthub:skill:upload',
      { skillId },
    ) as ApiResponse<{ cloudId: string }>
    if (!result.success) {
      throw new Error(result.error || '上传技能失败')
    }
    return result.data!
  },

  /** 获取技能同步状态 */
  async getState(): Promise<{
    lastServerTime: string | null
    lastSyncAt: string | null
  }> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompthub:skill:syncState') as ApiResponse<{
      lastServerTime: string | null
      lastSyncAt: string | null
    }>
    if (!result.success) {
      throw new Error(result.error || '获取技能同步状态失败')
    }
    return result.data!
  },
}

// ==================== 云端提示词 CRUD API ====================

export const promptHubPromptAPI = {
  /**
   * 获取云端提示词列表
   */
  async list(params?: {
    category?: string
    org_id?: string
    limit?: number
    offset?: number
  }): Promise<PromptHubPrompt[]> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompthub:prompt:list', params) as ApiResponse<PromptHubPrompt[]>
    if (!result.success) {
      throw new Error(result.error || '获取云端提示词失败')
    }
    return result.data!
  },

  /**
   * 在云端创建提示词
   */
  async create(input: CreatePromptHubPromptInput): Promise<PromptHubPrompt> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompthub:prompt:create', input) as ApiResponse<PromptHubPrompt>
    if (!result.success) {
      throw new Error(result.error || '创建云端提示词失败')
    }
    return result.data!
  },

  /**
   * 更新云端提示词
   */
  async update(id: string, input: UpdatePromptHubPromptInput): Promise<PromptHubPrompt> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompthub:prompt:update', id, input) as ApiResponse<PromptHubPrompt>
    if (!result.success) {
      throw new Error(result.error || '更新云端提示词失败')
    }
    return result.data!
  },

  /**
   * 删除云端提示词
   */
  async delete(id: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompthub:prompt:delete', id) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '删除云端提示词失败')
    }
  },
}
