/**
 * SeekDB API 封装（用于前端调用）
 * 通过 Electron IPC 与主进程通信
 */
import { isElectron, getElectronAPI } from '../electron'
import type { SkillFileNode, SkillPackageImportResult } from '../skillPackage'
import type {
  CreateSiteInput,
  CreateComponentInput,
  UpdateSiteInput,
  UpdateComponentInput,
  QueryOptions,
  SiteMetadata,
  ComponentMetadata,
  GetResult,
  QueryResult,
  CreatePromptInput,
  UpdatePromptInput,
  PromptMetadata,
  PromptVersion,
  CreateAgentSkillInput,
  UpdateAgentSkillInput,
  AgentSkillMetadata,
  AgentSkillVersion,
  CreateSubAgentInput,
  UpdateSubAgentInput,
  SubAgentMetadata,
  SubAgentVersion,
  CreateAgentTeamInput,
  UpdateAgentTeamInput,
  AgentTeamMetadata,
  AgentTeamVersion,
  UserOrganization,
  OrgInvitation,
  RegistrySkill,
  RegistryAgent,
  InstalledSkill,
  LibraryItem,
  CreateLibraryInput,
  UpdateLibraryInput,
  TagDefinition,
} from './types'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 检查是否在 Electron 环境中
 */
function checkElectron(): void {
  if (!isElectron()) {
    throw new Error('SeekDB API 只能在 Electron 环境中使用')
  }
}

// ==================== 站点 API ====================

export const siteAPI = {
  /**
   * 创建站点
   */
  async create(input: CreateSiteInput): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:site:create', input) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '创建站点失败')
    }
  },

  /**
   * 批量创建站点
   */
  async createBatch(inputs: CreateSiteInput[]): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:site:createBatch', inputs) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '批量创建站点失败')
    }
  },

  /**
   * 获取站点
   */
  async get(id: string): Promise<SiteMetadata | null> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:site:get', id) as ApiResponse<SiteMetadata | null>
    if (!result.success) {
      throw new Error(result.error || '获取站点失败')
    }
    return result.data ?? null
  },

  /**
   * 获取所有站点
   */
  async getAll(): Promise<GetResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:site:getAll') as ApiResponse<GetResult>
    if (!result.success) {
      throw new Error(result.error || '获取所有站点失败')
    }
    return result.data!
  },

  /**
   * 更新站点
   */
  async update(id: string, input: UpdateSiteInput): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:site:update', id, input) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '更新站点失败')
    }
  },

  /**
   * 删除站点
   */
  async delete(id: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:site:delete', id) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '删除站点失败')
    }
  },

  /**
   * 批量删除站点
   */
  async deleteBatch(ids: string[]): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:site:deleteBatch', ids) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '批量删除站点失败')
    }
  },

  /**
   * 搜索站点
   */
  async search(options: QueryOptions): Promise<QueryResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:site:search', options) as ApiResponse<QueryResult>
    if (!result.success) {
      throw new Error(result.error || '搜索站点失败')
    }
    return result.data!
  },

  /**
   * 获取站点数量
   */
  async count(): Promise<number> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:site:count') as ApiResponse<number>
    if (!result.success) {
      throw new Error(result.error || '获取站点数量失败')
    }
    return result.data!
  },
}

// ==================== 组件 API ====================

export const componentAPI = {
  /**
   * 创建组件
   */
  async create(input: CreateComponentInput): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:component:create', input) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '创建组件失败')
    }
  },

  /**
   * 批量创建组件
   */
  async createBatch(inputs: CreateComponentInput[]): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:component:createBatch', inputs) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '批量创建组件失败')
    }
  },

  /**
   * 获取组件
   */
  async get(id: string): Promise<ComponentMetadata | null> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:component:get', id) as ApiResponse<ComponentMetadata | null>
    if (!result.success) {
      throw new Error(result.error || '获取组件失败')
    }
    return result.data ?? null
  },

  /**
   * 获取所有组件
   */
  async getAll(): Promise<GetResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:component:getAll') as ApiResponse<GetResult>
    if (!result.success) {
      throw new Error(result.error || '获取所有组件失败')
    }
    return result.data!
  },

  /**
   * 根据站点 ID 获取组件
   */
  async getBySiteId(siteId: string): Promise<GetResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:component:getBySiteId', siteId) as ApiResponse<GetResult>
    if (!result.success) {
      throw new Error(result.error || '获取组件失败')
    }
    return result.data!
  },

  /**
   * 更新组件
   */
  async update(id: string, input: UpdateComponentInput): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:component:update', id, input) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '更新组件失败')
    }
  },

  /**
   * 删除组件
   */
  async delete(id: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:component:delete', id) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '删除组件失败')
    }
  },

  /**
   * 批量删除组件
   */
  async deleteBatch(ids: string[]): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:component:deleteBatch', ids) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '批量删除组件失败')
    }
  },

  /**
   * 根据站点 ID 删除所有组件
   */
  async deleteBySiteId(siteId: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:component:deleteBySiteId', siteId) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '删除组件失败')
    }
  },

  /**
   * 搜索组件
   */
  async search(options: QueryOptions): Promise<QueryResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:component:search', options) as ApiResponse<QueryResult>
    if (!result.success) {
      throw new Error(result.error || '搜索组件失败')
    }
    return result.data!
  },

  /**
   * 获取组件数量
   */
  async count(): Promise<number> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:component:count') as ApiResponse<number>
    if (!result.success) {
      throw new Error(result.error || '获取组件数量失败')
    }
    return result.data!
  },
}

// ==================== Prompt API ====================

export const promptAPI = {
  /**
   * 创建prompt（或新版本）
   */
  async create(input: CreatePromptInput): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:prompt:create', input) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '创建prompt失败')
    }
  },

  /**
   * 批量创建prompt
   */
  async createBatch(inputs: CreatePromptInput[]): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:prompt:createBatch', inputs) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '批量创建prompt失败')
    }
  },

  /**
   * 获取prompt
   */
  async get(id: string): Promise<PromptMetadata | null> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:prompt:get', id) as ApiResponse<PromptMetadata | null>
    if (!result.success) {
      throw new Error(result.error || '获取prompt失败')
    }
    return result.data ?? null
  },

  /**
   * 获取所有prompt
   */
  async getAll(): Promise<GetResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:prompt:getAll') as ApiResponse<GetResult>
    if (!result.success) {
      throw new Error(result.error || '获取所有prompt失败')
    }
    return result.data!
  },

  /**
   * 获取当前版本的prompt（每个promptId只返回一个）
   */
  async getCurrent(): Promise<GetResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:prompt:getCurrent') as ApiResponse<GetResult>
    if (!result.success) {
      throw new Error(result.error || '获取当前版本prompt失败')
    }
    return result.data!
  },

  /**
   * 获取prompt的所有版本
   */
  async getVersions(promptId: string): Promise<PromptVersion[]> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:prompt:getVersions', promptId) as ApiResponse<PromptVersion[]>
    if (!result.success) {
      throw new Error(result.error || '获取prompt版本失败')
    }
    return result.data!
  },

  /**
   * 更新prompt
   */
  async update(id: string, input: UpdatePromptInput): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:prompt:update', id, input) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '更新prompt失败')
    }
  },

  /**
   * 设置某个版本为当前版本
   */
  async setCurrentVersion(promptId: string, versionId: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:prompt:setCurrentVersion', promptId, versionId) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '设置当前版本失败')
    }
  },

  /**
   * 删除prompt（单个版本）
   */
  async delete(id: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:prompt:delete', id) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '删除prompt失败')
    }
  },

  /**
   * 删除prompt的所有版本
   */
  async deleteAllVersions(promptId: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:prompt:deleteAllVersions', promptId) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '删除prompt所有版本失败')
    }
  },

  /**
   * 批量删除prompt
   */
  async deleteBatch(ids: string[]): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:prompt:deleteBatch', ids) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '批量删除prompt失败')
    }
  },

  /**
   * 搜索prompt
   */
  async search(options: QueryOptions): Promise<QueryResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:prompt:search', options) as ApiResponse<QueryResult>
    if (!result.success) {
      throw new Error(result.error || '搜索prompt失败')
    }
    return result.data!
  },

  /**
   * 获取prompt数量
   */
  async count(): Promise<number> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:prompt:count') as ApiResponse<number>
    if (!result.success) {
      throw new Error(result.error || '获取prompt数量失败')
    }
    return result.data!
  },

  async toggleStar(id: string): Promise<boolean> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:prompt:toggleStar', id) as ApiResponse<boolean>
    if (!result.success) throw new Error(result.error || '切换星标失败')
    return result.data!
  },

  async incrementUses(id: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:prompt:incrementUses', id) as ApiResponse
    if (!result.success) throw new Error(result.error || '增加使用计数失败')
  },

  async listCloud(): Promise<unknown[]> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompthub:prompt:listCloud') as ApiResponse<unknown[]>
    if (!result.success) return []
    return result.data || []
  },

  /**
   * 将本地 prompt 上传到云端（需要已登录 PromptHub），返回 cloudId
   */
  async uploadToCloud(localId: string): Promise<{ cloudId: string }> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompthub:prompt:uploadLocal', localId) as ApiResponse<{ cloudId: string }>
    if (!result.success) {
      throw new Error(result.error || '上传到云端失败')
    }
    return result.data!
  },
}

// ==================== Agent Skills API ====================

export const agentSkillAPI = {
  /**
   * 创建 Agent Skill（或新版本）
   */
  async create(input: CreateAgentSkillInput): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentSkill:create', input) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '创建 Agent Skill 失败')
    }
  },

  /**
   * 批量创建 Agent Skill
   */
  async createBatch(inputs: CreateAgentSkillInput[]): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentSkill:createBatch', inputs) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '批量创建 Agent Skill 失败')
    }
  },

  /**
   * 获取 Agent Skill
   */
  async get(id: string): Promise<AgentSkillMetadata | null> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentSkill:get', id) as ApiResponse<AgentSkillMetadata | null>
    if (!result.success) {
      throw new Error(result.error || '获取 Agent Skill 失败')
    }
    return result.data ?? null
  },

  /**
   * 获取所有 Agent Skills
   */
  async getAll(): Promise<GetResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentSkill:getAll') as ApiResponse<GetResult>
    if (!result.success) {
      throw new Error(result.error || '获取所有 Agent Skills 失败')
    }
    return result.data!
  },

  /**
   * 获取当前版本的 Agent Skills（每个skillId只返回一个）
   */
  async getCurrent(): Promise<GetResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentSkill:getCurrent') as ApiResponse<GetResult>
    if (!result.success) {
      throw new Error(result.error || '获取当前版本 Agent Skills 失败')
    }
    return result.data!
  },

  /**
   * 获取 Agent Skill 的所有版本
   */
  async getVersions(skillId: string): Promise<AgentSkillVersion[]> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentSkill:getVersions', skillId) as ApiResponse<AgentSkillVersion[]>
    if (!result.success) {
      throw new Error(result.error || '获取 Agent Skill 版本失败')
    }
    return result.data!
  },

  /**
   * 更新 Agent Skill
   */
  async update(id: string, input: UpdateAgentSkillInput): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentSkill:update', id, input) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '更新 Agent Skill 失败')
    }
  },

  /**
   * 设置某个版本为当前版本
   */
  async setCurrentVersion(skillId: string, versionId: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentSkill:setCurrentVersion', skillId, versionId) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '设置当前版本失败')
    }
  },

  /**
   * 删除 Agent Skill（单个版本）
   * @param options.confirmDisk 外部 fs-scan 技能（sourcePath 命中磁盘文件）删除时的磁盘删除确认；
   *   未确认时主进程拒绝删除（needsDiskConfirm）
   */
  async delete(id: string, options?: { confirmDisk?: boolean }): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentSkill:delete', id, options) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '删除 Agent Skill 失败')
    }
  },

  /**
   * 删除 Agent Skill 的所有版本
   * @param options.confirmDisk 同 delete：外部技能删除磁盘文件的二次确认
   */
  async deleteAllVersions(skillId: string, options?: { confirmDisk?: boolean }): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentSkill:deleteAllVersions', skillId, options) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '删除 Agent Skill 所有版本失败')
    }
  },

  /**
   * 批量删除 Agent Skill
   * @param options.confirmDisk 同 delete：外部技能删除磁盘文件的二次确认
   */
  async deleteBatch(ids: string[], options?: { confirmDisk?: boolean }): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentSkill:deleteBatch', ids, options) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '批量删除 Agent Skill 失败')
    }
  },

  /**
   * 搜索 Agent Skills
   */
  async search(options: QueryOptions): Promise<QueryResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentSkill:search', options) as ApiResponse<QueryResult>
    if (!result.success) {
      throw new Error(result.error || '搜索 Agent Skills 失败')
    }
    return result.data!
  },

  /**
   * 获取 Agent Skills 数量
   */
  async count(): Promise<number> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentSkill:count') as ApiResponse<number>
    if (!result.success) {
      throw new Error(result.error || '获取 Agent Skills 数量失败')
    }
    return result.data!
  },

  async toggleStar(id: string): Promise<boolean> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentSkill:toggleStar', id) as ApiResponse<boolean>
    if (!result.success) throw new Error(result.error || '切换星标失败')
    return result.data!
  },

  async incrementUses(id: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentSkill:incrementUses', id) as ApiResponse
    if (!result.success) throw new Error(result.error || '增加使用计数失败')
  },

  async listCloud(): Promise<unknown[]> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompthub:skill:listCloud') as ApiResponse<unknown[]>
    if (!result.success) return []
    return result.data || []
  },

  // ==================== 多文件技能包 ====================

  /**
   * 从 ZIP 导入技能包；不传 filePath 时由主进程弹出文件选择框
   * @returns 导入结果，用户取消时返回 null
   */
  async importPackageZip(args: {
    skillId: string
    filePath?: string
  }): Promise<SkillPackageImportResult | null> {
    checkElectron()
    const result = await getElectronAPI().invoke(
      'skill:package:importZip',
      args,
    ) as ApiResponse<SkillPackageImportResult | null>
    if (!result.success) throw new Error(result.error || '导入技能包失败')
    return result.data ?? null
  },

  /**
   * 从本地文件夹导入技能包；不传 sourceDir 时由主进程弹出目录选择框
   * @returns 导入结果，用户取消时返回 null
   */
  async importPackageFolder(args: {
    skillId: string
    sourceDir?: string
  }): Promise<SkillPackageImportResult | null> {
    checkElectron()
    const result = await getElectronAPI().invoke(
      'skill:package:importFolder',
      args,
    ) as ApiResponse<SkillPackageImportResult | null>
    if (!result.success) throw new Error(result.error || '导入技能包失败')
    return result.data ?? null
  },

  /** 读取技能包文件树（以磁盘为准，顺便刷新 DB 索引） */
  async getPackageTree(skillId: string): Promise<SkillFileNode[]> {
    checkElectron()
    const result = await getElectronAPI().invoke(
      'skill:package:tree',
      { skillId },
    ) as ApiResponse<SkillFileNode[]>
    if (!result.success) throw new Error(result.error || '读取技能包失败')
    return result.data ?? []
  },

  /** 读取技能包内单个文本文件（用于预览） */
  async readPackageFile(
    skillId: string,
    path: string,
  ): Promise<{ content: string; truncated: boolean }> {
    checkElectron()
    const result = await getElectronAPI().invoke(
      'skill:package:readFile',
      { skillId, path },
    ) as ApiResponse<{ content: string; truncated: boolean }>
    if (!result.success) throw new Error(result.error || '读取文件失败')
    return result.data!
  },

  /** 写入技能包内文本文件（会同步刷新索引；SKILL.md 会回写技能正文） */
  async writePackageFile(args: {
    skillId: string
    path: string
    content: string
  }): Promise<{ fileCount: number; packageSize: number }> {
    checkElectron()
    const result = await getElectronAPI().invoke(
      'skill:package:writeFile',
      args,
    ) as ApiResponse<{ fileCount: number; packageSize: number }>
    if (!result.success) throw new Error(result.error || '写入文件失败')
    return result.data!
  },

  /** 导出技能包 ZIP；用户取消时返回 null */
  async exportPackageZip(args: {
    skillId: string
    suggestedName?: string
  }): Promise<string | null> {
    checkElectron()
    const result = await getElectronAPI().invoke(
      'skill:package:exportZip',
      args,
    ) as ApiResponse<string | null>
    if (!result.success) throw new Error(result.error || '导出 ZIP 失败')
    return result.data ?? null
  },

  async previewRemoteSkills(source: string): Promise<RemoteSkillPreview> {
    checkElectron()
    const result = await getElectronAPI().invoke(
      'skill:remote:preview',
      { source },
    ) as ApiResponse<RemoteSkillPreview>
    if (!result.success) throw new Error(result.error || '探测远程技能失败')
    return result.data!
  },

  async installRemoteSkills(args: {
    source: string
    rootPaths?: string[] | null
    strategy?: 'skip' | 'overwrite' | 'copy'
    libraryId?: string | null
  }): Promise<RemoteSkillInstallPayload> {
    checkElectron()
    const result = await getElectronAPI().invoke(
      'skill:remote:install',
      args,
    ) as ApiResponse<RemoteSkillInstallPayload>
    if (!result.success) throw new Error(result.error || '安装远程技能失败')
    return result.data!
  },

  /** 移除技能包（保留技能本身） */
  async clearPackage(skillId: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke(
      'skill:package:clear',
      { skillId },
    ) as ApiResponse
    if (!result.success) throw new Error(result.error || '移除技能包失败')
  },

  /** 在系统文件管理器中显示技能包目录 */
  async revealPackage(skillId: string): Promise<string> {
    checkElectron()
    const result = await getElectronAPI().invoke(
      'skill:package:reveal',
      { skillId },
    ) as ApiResponse<string>
    if (!result.success) throw new Error(result.error || '打开目录失败')
    return result.data!
  },

  /**
   * 导出 Skill 为文件夹 (SKILL.md 标准结构)
   * 传 skillId 且该技能有多文件包时，导出完整目录树
   * @returns 导出的目录路径，如果用户取消则返回 null
   */
  async exportToFolder(args: {
    folderName: string
    files: Array<{ filename: string; content: string }>
    skillId?: string
  }): Promise<string | null> {
    checkElectron()

    // 1. 选择目录
    const dirResult = await getElectronAPI().invoke('dialog:selectDirectory') as ApiResponse<string | null>
    if (!dirResult.success) {
      throw new Error(dirResult.error || '选择目录失败')
    }
    if (!dirResult.data) {
      return null // 用户取消
    }

    // 2. 写入文件
    const exportResult = await getElectronAPI().invoke('skill:exportToFolder', {
      targetDir: dirResult.data,
      folderName: args.folderName,
      files: args.files,
      skillId: args.skillId,
    }) as ApiResponse<string>
    if (!exportResult.success) {
      throw new Error(exportResult.error || '导出失败')
    }

    return exportResult.data!
  },

  /**
   * 查询本机已知 AI Agent 的安装信息（用于「安装 Skill」弹层）
   */
  async listInstallableAgents(): Promise<InstallableAgentInfo[]> {
    checkElectron()
    const result = await getElectronAPI().invoke(
      'skill:listInstallableAgents',
    ) as ApiResponse<InstallableAgentInfo[]>
    if (!result.success) {
      throw new Error(result.error || '获取 Agent 列表失败')
    }
    return result.data ?? []
  },

  /**
   * 将 Skill 安装到指定 Agent 的默认 skills 目录
   * 传 skillId 且该技能有多文件包时，安装完整目录树
   * @returns 最终写入的 skill 目录绝对路径
   */
  async installToAgent(args: {
    agentId: string
    folderName: string
    files: Array<{ filename: string; content: string }>
    skillId?: string
  }): Promise<string> {
    checkElectron()
    const result = await getElectronAPI().invoke('skill:installToAgent', args) as ApiResponse<string>
    if (!result.success) {
      throw new Error(result.error || '安装 Skill 失败')
    }
    return result.data!
  },
}

/**
 * 已知 AI Agent 的 Skill 安装信息（从主进程返回）
 */
export interface InstallableAgentInfo {
  id: string
  name: string
  parent: string
  skillsSubdir: string
  parentPath: string
  skillsPath: string
  installed: boolean
  skillsDirExists: boolean
}

export interface RemoteDiscoveredSkill {
  rootPath: string
  name: string
  description: string
  skillMd: string
  fileCount: number
}

export interface RemoteSkillPreview {
  source: {
    display: string
    owner: string
    repo: string
    ref: string | null
    subpath: string | null
    skillHint: string | null
    cliEquivalent: string
  }
  commitSha: string | null
  defaultBranch: string | null
  skills: RemoteDiscoveredSkill[]
  cliEquivalent: string
}

export interface RemoteInstallResultItem {
  status: 'created' | 'updated' | 'skipped' | 'failed'
  name: string
  rootPath: string
  id?: string
  error?: string
  cliEquivalent?: string
}

export interface RemoteSkillInstallPayload {
  results: RemoteInstallResultItem[]
  cliEquivalent: string
  commitSha: string | null
}

// ==================== SubAgent API ====================

export const subAgentAPI = {
  /**
   * 创建 SubAgent（或新版本）
   */
  async create(input: CreateSubAgentInput): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:subAgent:create', input) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '创建 SubAgent 失败')
    }
  },

  /**
   * 批量创建 SubAgent
   */
  async createBatch(inputs: CreateSubAgentInput[]): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:subAgent:createBatch', inputs) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '批量创建 SubAgent 失败')
    }
  },

  /**
   * 获取 SubAgent
   */
  async get(id: string): Promise<SubAgentMetadata | null> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:subAgent:get', id) as ApiResponse<SubAgentMetadata | null>
    if (!result.success) {
      throw new Error(result.error || '获取 SubAgent 失败')
    }
    return result.data ?? null
  },

  /**
   * 获取所有 SubAgents
   */
  async getAll(): Promise<GetResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:subAgent:getAll') as ApiResponse<GetResult>
    if (!result.success) {
      throw new Error(result.error || '获取所有 SubAgents 失败')
    }
    return result.data!
  },

  /**
   * 获取当前版本的 SubAgents
   */
  async getCurrent(): Promise<GetResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:subAgent:getCurrent') as ApiResponse<GetResult>
    if (!result.success) {
      throw new Error(result.error || '获取当前版本 SubAgents 失败')
    }
    return result.data!
  },

  /**
   * 获取 SubAgent 的所有版本
   */
  async getVersions(subAgentId: string): Promise<SubAgentVersion[]> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:subAgent:getVersions', subAgentId) as ApiResponse<SubAgentVersion[]>
    if (!result.success) {
      throw new Error(result.error || '获取 SubAgent 版本失败')
    }
    return result.data!
  },

  /**
   * 更新 SubAgent
   */
  async update(id: string, input: UpdateSubAgentInput): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:subAgent:update', id, input) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '更新 SubAgent 失败')
    }
  },

  /**
   * 设置某个版本为当前版本
   */
  async setCurrentVersion(subAgentId: string, versionId: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:subAgent:setCurrentVersion', subAgentId, versionId) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '设置当前版本失败')
    }
  },

  /**
   * 删除 SubAgent（单个版本）
   */
  async delete(id: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:subAgent:delete', id) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '删除 SubAgent 失败')
    }
  },

  /**
   * 删除 SubAgent 的所有版本
   */
  async deleteAllVersions(subAgentId: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:subAgent:deleteAllVersions', subAgentId) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '删除 SubAgent 所有版本失败')
    }
  },

  /**
   * 批量删除 SubAgent
   */
  async deleteBatch(ids: string[]): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:subAgent:deleteBatch', ids) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '批量删除 SubAgent 失败')
    }
  },

  /**
   * 搜索 SubAgents
   */
  async search(options: QueryOptions): Promise<QueryResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:subAgent:search', options) as ApiResponse<QueryResult>
    if (!result.success) {
      throw new Error(result.error || '搜索 SubAgents 失败')
    }
    return result.data!
  },

  /**
   * 获取 SubAgents 数量
   */
  async count(): Promise<number> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:subAgent:count') as ApiResponse<number>
    if (!result.success) {
      throw new Error(result.error || '获取 SubAgents 数量失败')
    }
    return result.data!
  },

  /**
   * 导出 SubAgent 为文件夹 (AGENT.md 标准结构)
   * @returns 导出的目录路径，如果用户取消则返回 null
   */
  async exportToFolder(args: {
    folderName: string
    files: Array<{ filename: string; content: string }>
  }): Promise<string | null> {
    checkElectron()

    // 1. 选择目录
    const dirResult = await getElectronAPI().invoke('dialog:selectDirectory') as ApiResponse<string | null>
    if (!dirResult.success) {
      throw new Error(dirResult.error || '选择目录失败')
    }
    if (!dirResult.data) {
      return null // 用户取消
    }

    // 2. 写入文件
    const exportResult = await getElectronAPI().invoke('subAgent:exportToFolder', {
      targetDir: dirResult.data,
      folderName: args.folderName,
      files: args.files,
    }) as ApiResponse<string>
    if (!exportResult.success) {
      throw new Error(exportResult.error || '导出失败')
    }

    return exportResult.data!
  },
}

// ==================== Agent Team API ====================

export const agentTeamAPI = {
  /**
   * 创建 Agent Team（或新版本）
   */
  async create(input: CreateAgentTeamInput): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentTeam:create', input) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '创建 Agent Team 失败')
    }
  },

  /**
   * 批量创建 Agent Team
   */
  async createBatch(inputs: CreateAgentTeamInput[]): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentTeam:createBatch', inputs) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '批量创建 Agent Team 失败')
    }
  },

  /**
   * 获取 Agent Team
   */
  async get(id: string): Promise<AgentTeamMetadata | null> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentTeam:get', id) as ApiResponse<AgentTeamMetadata | null>
    if (!result.success) {
      throw new Error(result.error || '获取 Agent Team 失败')
    }
    return result.data ?? null
  },

  /**
   * 获取所有 Agent Teams
   */
  async getAll(): Promise<GetResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentTeam:getAll') as ApiResponse<GetResult>
    if (!result.success) {
      throw new Error(result.error || '获取所有 Agent Teams 失败')
    }
    return result.data!
  },

  /**
   * 获取当前版本的 Agent Teams
   */
  async getCurrent(): Promise<GetResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentTeam:getCurrent') as ApiResponse<GetResult>
    if (!result.success) {
      throw new Error(result.error || '获取当前版本 Agent Teams 失败')
    }
    return result.data!
  },

  /**
   * 获取 Agent Team 的所有版本
   */
  async getVersions(teamId: string): Promise<AgentTeamVersion[]> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentTeam:getVersions', teamId) as ApiResponse<AgentTeamVersion[]>
    if (!result.success) {
      throw new Error(result.error || '获取 Agent Team 版本失败')
    }
    return result.data!
  },

  /**
   * 更新 Agent Team
   */
  async update(id: string, input: UpdateAgentTeamInput): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentTeam:update', id, input) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '更新 Agent Team 失败')
    }
  },

  /**
   * 设置某个版本为当前版本
   */
  async setCurrentVersion(teamId: string, versionId: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentTeam:setCurrentVersion', teamId, versionId) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '设置当前版本失败')
    }
  },

  /**
   * 删除 Agent Team（单个版本）
   */
  async delete(id: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentTeam:delete', id) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '删除 Agent Team 失败')
    }
  },

  /**
   * 删除 Agent Team 的所有版本
   */
  async deleteAllVersions(teamId: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentTeam:deleteAllVersions', teamId) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '删除 Agent Team 所有版本失败')
    }
  },

  /**
   * 批量删除 Agent Team
   */
  async deleteBatch(ids: string[]): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentTeam:deleteBatch', ids) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '批量删除 Agent Team 失败')
    }
  },

  /**
   * 搜索 Agent Teams
   */
  async search(options: QueryOptions): Promise<QueryResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentTeam:search', options) as ApiResponse<QueryResult>
    if (!result.success) {
      throw new Error(result.error || '搜索 Agent Teams 失败')
    }
    return result.data!
  },

  /**
   * 获取 Agent Teams 数量
   */
  async count(): Promise<number> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:agentTeam:count') as ApiResponse<number>
    if (!result.success) {
      throw new Error(result.error || '获取 Agent Teams 数量失败')
    }
    return result.data!
  },

  /**
   * 导出 Agent Team 为文件夹 (TEAM.md 标准结构)
   */
  async exportToFolder(args: {
    folderName: string
    files: Array<{ filename: string; content: string }>
  }): Promise<string | null> {
    checkElectron()

    const dirResult = await getElectronAPI().invoke('dialog:selectDirectory') as ApiResponse<string | null>
    if (!dirResult.success) {
      throw new Error(dirResult.error || '选择目录失败')
    }
    if (!dirResult.data) {
      return null
    }

    const exportResult = await getElectronAPI().invoke('agentTeam:exportToFolder', {
      targetDir: dirResult.data,
      folderName: args.folderName,
      files: args.files,
    }) as ApiResponse<string>
    if (!exportResult.success) {
      throw new Error(exportResult.error || '导出失败')
    }

    return exportResult.data!
  },
}

// ==================== Organization API ====================

export interface OrganizationData {
  currentOrg: UserOrganization | null
  invitations: OrgInvitation[]
  sentInvites: OrgInvitation[]
}

export const orgAPI = {
  /**
   * 获取组织数据（当前组织、邀请等）
   */
  async getData(): Promise<OrganizationData> {
    checkElectron()
    const result = await getElectronAPI().invoke('org:getData') as ApiResponse<OrganizationData>
    if (!result.success) {
      throw new Error(result.error || '获取组织数据失败')
    }
    return result.data!
  },

  /**
   * 设置当前组织（加入组织时调用）
   */
  async setCurrentOrg(org: UserOrganization | null): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('org:setCurrent', org) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '设置组织失败')
    }
  },

  /**
   * 退出当前组织
   */
  async leaveOrg(): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('org:leave') as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '退出组织失败')
    }
  },

  /**
   * 发送邀请
   */
  async sendInvite(invitation: OrgInvitation): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('org:invite:send', invitation) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '发送邀请失败')
    }
  },

  /**
   * 接收邀请（Mock：模拟收到邀请）
   */
  async receiveInvite(invitation: OrgInvitation): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('org:invite:receive', invitation) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '接收邀请失败')
    }
  },

  /**
   * 接受/拒绝邀请
   */
  async respondInvite(id: string, status: 'accepted' | 'declined'): Promise<OrgInvitation | null> {
    checkElectron()
    const result = await getElectronAPI().invoke('org:invite:respond', id, status) as ApiResponse<OrgInvitation | null>
    if (!result.success) {
      throw new Error(result.error || '处理邀请失败')
    }
    return result.data || null
  },
}

// ==================== Market Registry API ====================

export interface MarketFetchOptions {
  query?: string
  category?: string
  page?: number
  pageSize?: number
  forceRefresh?: boolean
}

export interface MarketFetchResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  cached: boolean
}

export const marketRegistryAPI = {
  /**
   * 获取 Registry Skills
   */
  async fetchSkills(options?: MarketFetchOptions): Promise<MarketFetchResult<RegistrySkill>> {
    checkElectron()
    const result = await getElectronAPI().invoke('market:fetchSkills', options) as ApiResponse<MarketFetchResult<RegistrySkill>>
    if (!result.success) {
      throw new Error(result.error || '获取 Skills 失败')
    }
    return result.data!
  },

  /**
   * 获取 Registry Agents
   */
  async fetchAgents(options?: MarketFetchOptions): Promise<MarketFetchResult<RegistryAgent>> {
    checkElectron()
    const result = await getElectronAPI().invoke('market:fetchAgents', options) as ApiResponse<MarketFetchResult<RegistryAgent>>
    if (!result.success) {
      throw new Error(result.error || '获取 Agents 失败')
    }
    return result.data!
  },

  /**
   * 获取详情（README）
   */
  async getDetail(repoUrl: string): Promise<{ readme: string } | null> {
    checkElectron()
    const result = await getElectronAPI().invoke('market:getDetail', repoUrl) as ApiResponse<{ readme: string } | null>
    if (!result.success) {
      throw new Error(result.error || '获取详情失败')
    }
    return result.data ?? null
  },

  /**
   * 刷新缓存
   */
  async refresh(): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('market:refresh') as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '刷新缓存失败')
    }
  },
}

// ==================== Discovery / Gallery API ====================

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

export const discoveryAPI = {
  async fetchGalleryItems(params?: {
    q?: string
    category?: string
    sort?: 'popular' | 'newest' | 'rating'
  }): Promise<GalleryItemsResponse> {
    checkElectron()
    const result = await getElectronAPI().invoke('discovery:gallery:items', params) as ApiResponse<GalleryItemsResponse>
    if (!result.success) {
      throw new Error(result.error || '获取 Gallery 数据失败')
    }
    return result.data!
  },

  async fetchGalleryPrompts(params?: {
    limit?: number
    offset?: number
  }): Promise<{ data: Record<string, unknown>[]; total: number }> {
    checkElectron()
    const result = await getElectronAPI().invoke('discovery:gallery:prompts', params) as ApiResponse<{ data: Record<string, unknown>[]; total: number }>
    if (!result.success) {
      throw new Error(result.error || '获取公开 Prompts 失败')
    }
    return result.data!
  },

  async fetchGallerySkills(params?: {
    limit?: number
    offset?: number
  }): Promise<{ data: Record<string, unknown>[]; total: number }> {
    checkElectron()
    const result = await getElectronAPI().invoke('discovery:gallery:skills', params) as ApiResponse<{ data: Record<string, unknown>[]; total: number }>
    if (!result.success) {
      throw new Error(result.error || '获取公开 Skills 失败')
    }
    return result.data!
  },
}

// ==================== CLI API ====================

export interface CLIInstallOptions {
  command: string
  name: string
  registryId?: string
}

export interface CLIInstallResult {
  success: boolean
  installPath?: string
  error?: string
}

export const cliAPI = {
  /**
   * 安装 skill
   */
  async install(options: CLIInstallOptions): Promise<CLIInstallResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('cli:install', options) as ApiResponse<CLIInstallResult>
    if (!result.success) {
      throw new Error(result.error || '安装失败')
    }
    return result.data!
  },

  /**
   * 卸载 skill
   */
  async uninstall(id: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('cli:uninstall', id) as ApiResponse
    if (!result.success) {
      throw new Error(result.error || '卸载失败')
    }
  },

  /**
   * 列出已安装的 skills
   */
  async list(): Promise<InstalledSkill[]> {
    checkElectron()
    const result = await getElectronAPI().invoke('cli:list') as ApiResponse<InstalledSkill[]>
    if (!result.success) {
      throw new Error(result.error || '获取已安装列表失败')
    }
    return result.data || []
  },

  /**
   * 扫描并列出已安装的 skills
   */
  async scan(): Promise<InstalledSkill[]> {
    checkElectron()
    const result = await getElectronAPI().invoke('cli:scan') as ApiResponse<InstalledSkill[]>
    if (!result.success) {
      throw new Error(result.error || '扫描失败')
    }
    return result.data || []
  },

  /**
   * 监听 CLI 输出
   */
  onOutput(callback: (data: { type: 'stdout' | 'stderr' | 'status'; message: string }) => void): void {
    if (isElectron()) {
      getElectronAPI().on('cli:output', callback)
    }
  },

  /**
   * 移除 CLI 输出监听
   */
  removeOutputListener(callback: (...args: unknown[]) => void): void {
    if (isElectron()) {
      getElectronAPI().removeListener('cli:output', callback)
    }
  },
}

// ==================== Tag definitions API ====================

export const tagAPI = {
  async getAll(): Promise<TagDefinition[]> {
    checkElectron();
    const result = (await getElectronAPI().invoke("seekdb:tag:getAll")) as ApiResponse<TagDefinition[]>;
    if (!result.success) throw new Error(result.error || "获取标签失败");
    return result.data || [];
  },

  async create(name: string, color?: string, dimension?: string): Promise<TagDefinition> {
    checkElectron();
    const result = (await getElectronAPI().invoke("seekdb:tag:create", name, color, dimension)) as ApiResponse<TagDefinition>;
    if (!result.success) throw new Error(result.error || "创建标签失败");
    return result.data!;
  },

  async update(id: string, input: { name?: string; color?: string; dimension?: string }): Promise<void> {
    checkElectron();
    const result = (await getElectronAPI().invoke("seekdb:tag:update", id, input)) as ApiResponse;
    if (!result.success) throw new Error(result.error || "更新标签失败");
  },

  async delete(id: string): Promise<void> {
    checkElectron();
    const result = (await getElectronAPI().invoke("seekdb:tag:delete", id)) as ApiResponse;
    if (!result.success) throw new Error(result.error || "删除标签失败");
  },
};

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

export const libraryAPI = {
  async create(input: CreateLibraryInput): Promise<LibraryItem> {
    checkElectron()
    const id = `lib-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const result = await getElectronAPI().invoke('seekdb:library:create', { ...input, id }) as ApiResponse<LibraryItem>
    if (!result.success) throw new Error(result.error || '创建库失败')
    return result.data!
  },

  async get(id: string): Promise<LibraryItem | null> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:library:get', id) as ApiResponse<LibraryItem | null>
    if (!result.success) throw new Error(result.error || '获取库失败')
    return result.data ?? null
  },

  async getAll(): Promise<LibraryItem[]> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:library:getAll') as ApiResponse<LibraryItem[]>
    if (!result.success) throw new Error(result.error || '获取库列表失败')
    return result.data || []
  },

  async update(id: string, input: UpdateLibraryInput): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:library:update', id, input) as ApiResponse
    if (!result.success) throw new Error(result.error || '更新库失败')
  },

  async delete(id: string): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:library:delete', id) as ApiResponse
    if (!result.success) throw new Error(result.error || '删除库失败')
  },

  async movePrompt(promptGroupId: string, libraryId: string | null): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:library:movePrompt', promptGroupId, libraryId) as ApiResponse
    if (!result.success) throw new Error(result.error || '移动提示词到库失败')
  },

  async moveSkill(skillGroupId: string, libraryId: string | null): Promise<void> {
    checkElectron()
    const result = await getElectronAPI().invoke('seekdb:library:moveSkill', skillGroupId, libraryId) as ApiResponse
    if (!result.success) throw new Error(result.error || '移动技能到库失败')
  },

  async listCloudFolders(): Promise<CloudLibraryFolder[]> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompthub:library:listCloudFolders') as ApiResponse<CloudLibraryFolder[]>
    return result.data ?? []
  },

  async listCloudItems(folderId: string | null): Promise<CloudLibraryItem[]> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompthub:library:listCloudItems', folderId) as ApiResponse<CloudLibraryItem[]>
    return result.data ?? []
  },
}

// ==================== Skill Path Sync API ====================

export interface PathSyncResult {
  scannedFiles: number
  imported: number
  skippedUnchanged: number
  errors: string[]
}

export const skillPathSyncAPI = {
  /**
   * 手动触发 skill 路径扫描同步（包含自定义路径 + 已知 plugin cache 目录）
   */
  async syncPaths(): Promise<PathSyncResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('skills:syncPaths') as ApiResponse<PathSyncResult>
    if (!result.success) throw new Error(result.error || 'Skill 路径扫描失败')
    return result.data!
  },

  /**
   * 获取本机已存在的内置 skill 路径列表
   */
  async getKnownPaths(): Promise<string[]> {
    checkElectron()
    const result = await getElectronAPI().invoke('skills:getKnownPaths') as ApiResponse<string[]>
    if (!result.success) throw new Error(result.error || '获取内置路径失败')
    return result.data || []
  },
}

// ==================== Prompt Path Sync API ====================

export const promptPathSyncAPI = {
  /**
   * 手动触发 prompt 路径扫描同步（包含自定义路径 + 已知规则目录）
   */
  async syncPaths(): Promise<PathSyncResult> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompts:syncPaths') as ApiResponse<PathSyncResult>
    if (!result.success) throw new Error(result.error || 'Prompt 路径扫描失败')
    return result.data!
  },

  /**
   * 获取本机已存在的内置 prompt 规则路径列表
   */
  async getKnownPaths(): Promise<string[]> {
    checkElectron()
    const result = await getElectronAPI().invoke('prompts:getKnownPaths') as ApiResponse<string[]>
    if (!result.success) throw new Error(result.error || '获取内置 Prompt 路径失败')
    return result.data || []
  },
}

// ==================== AI API ====================

export interface AIPolishParams {
  content: string
  title?: string
  description?: string
  tags?: string[]
  category?: string
}

export const aiAPI = {
  /**
   * AI 润色 Prompt 内容
   */
  async polish(params: AIPolishParams): Promise<string> {
    checkElectron()
    const result = await getElectronAPI().invoke('ai:polish', params) as ApiResponse<string>
    if (!result.success) {
      throw new Error(result.error || 'AI 润色失败')
    }
    return result.data!
  },
}

