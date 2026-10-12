/**
 * 本地数据存储 - 使用 JSON 文件持久化用户数据和设置
 */
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import { getDataRoot } from './dataPaths'

export interface GitHubUser {
  id: string | number
  provider: 'github' | 'google' | 'email'
  login: string
  name: string | null
  avatar_url: string
  html_url: string
  email: string | null
  bio: string | null
}

export interface AuthData {
  provider: 'github' | 'google' | 'email' | null
  accessToken: string | null
  refreshToken: string | null
  user: GitHubUser | null
}

/** Agent Skill 与外部工具目录相关偏好 */
export interface SkillAppSettings {
  /** CLI 安装到工具目录时的策略（当前版本仅保存偏好，安装器后续可读取） */
  installMethod: 'symlink' | 'copy'
  /** 额外扫描 SKILL.md 的目录或文件路径（支持 ~；启动与保存设置时会同步到 Agent Skills） */
  customScanPaths: string[]
  /** 预留：监听外部目录变更 */
  watchExternalFolders: boolean
}

/** Prompt 文件扫描相关偏好 */
export interface PromptAppSettings {
  /** 额外扫描 prompt 文件的目录（支持 ~；启动与保存设置时会同步到 Prompts） */
  customScanPaths: string[]
  /** 是否启用启动时自动扫描 */
  autoScanOnStartup: boolean
}

export const DEFAULT_SKILL_APP_SETTINGS: SkillAppSettings = {
  installMethod: 'symlink',
  customScanPaths: [],
  watchExternalFolders: true,
}

export const DEFAULT_PROMPT_APP_SETTINGS: PromptAppSettings = {
  customScanPaths: [],
  autoScanOnStartup: true,
}

/** 系统桌面通知偏好 */
export interface NotificationAppSettings {
  enabled: boolean
  copySuccess: boolean
  saveSuccess: boolean
}

export const DEFAULT_NOTIFICATION_APP_SETTINGS: NotificationAppSettings = {
  enabled: true,
  copySuccess: true,
  saveSuccess: true,
}

export interface AppSettings {
  github: {
    clientId: string
    clientSecret: string
  }
  google: {
    clientId: string
    clientSecret: string
  }
  theme: 'dark' | 'light' | 'system'
  language: 'zh' | 'en'
  marketRegistryUrl?: string  // 自定义 awesome-skills 仓库地址
  ai?: {
    provider: 'openai' | 'anthropic' | 'deepseek' | 'custom' | 'bailian_coding'
    apiKey: string
    baseUrl?: string  // 自定义端点（兼容 OpenAI 格式）
    model?: string
    /** 百炼 Coding Plan：中国大陆 / 国际端点 */
    bailianCodingRegion?: 'cn' | 'intl'
  }
  skills?: SkillAppSettings
  prompts?: PromptAppSettings
  notifications?: NotificationAppSettings
}

// ==================== Organization 相关类型 ====================

/**
 * 用户所属组织信息
 * 组织是一个概念：用户归属于某个组织，而非管理组织
 */
export interface UserOrganization {
  id: string
  name: string
  slug: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
}

/**
 * 组织邀请
 */
export interface OrgInvitation {
  id: string
  orgId: string
  orgName: string
  orgSlug: string
  invitedBy: string        // 邀请人用户名
  invitedByAvatar?: string
  invitedAt: string
  status: 'pending' | 'accepted' | 'declined'
}

export interface OrganizationData {
  currentOrg: UserOrganization | null   // 当前所属组织
  invitations: OrgInvitation[]          // 收到的邀请
  sentInvites: OrgInvitation[]          // 发出的邀请（owner/admin 可用）
}

// ==================== Market Cache 相关类型 ====================

export interface MarketCacheData {
  skills: unknown[]
  agents: unknown[]
  lastFetchedAt: string | null
  ttlHours: number
}

// ==================== Installed Skills 相关类型 ====================

export interface InstalledSkillRecord {
  id: string
  name: string
  version: string
  installPath: string
  installedAt: string
  source: 'registry' | 'manual'
  registryId?: string
}

// ==================== PromptHub 云同步相关类型 ====================

export interface PromptHubAuth {
  token: string | null
  userId: string | null
  email: string | null
  name: string | null
}

export interface PromptHubSyncState {
  lastServerTime: string | null
  lastSyncAt: string | null
}

export interface StoreData {
  auth: AuthData
  settings: AppSettings
  orgData: OrganizationData
  marketCache: MarketCacheData
  installedSkills: InstalledSkillRecord[]
  promptHubAuth: PromptHubAuth
  promptHubSync: PromptHubSyncState
  /** 技能同步游标：与 prompts 独立，两个接口的 serverTime 各自推进 */
  promptHubSkillSync: PromptHubSyncState
}

function isAuthProvider(value: unknown): value is 'github' | 'google' | 'email' {
  return value === 'github' || value === 'google' || value === 'email'
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeAuthUser(rawUser: unknown, fallbackProvider: AuthData['provider']): GitHubUser | null {
  if (!rawUser || typeof rawUser !== 'object') return null

  const user = rawUser as Record<string, unknown>
  const provider = isAuthProvider(user.provider)
    ? user.provider
    : isAuthProvider(fallbackProvider)
      ? fallbackProvider
      : 'github'

  const email = toStringOrNull(user.email)
  const login = toStringOrNull(user.login)
    || (email ? email.split('@')[0] : null)
    || toStringOrNull(user.name)
    || 'user'
  const normalizedName = toStringOrNull(user.name)
  const avatarUrl = toStringOrNull(user.avatar_url) || ''
  const htmlUrl = toStringOrNull(user.html_url) || ''
  const bio = toStringOrNull(user.bio)
  const rawId = user.id
  const id = (typeof rawId === 'string' || typeof rawId === 'number') ? rawId : login

  return {
    id,
    provider,
    login,
    name: normalizedName,
    avatar_url: avatarUrl,
    html_url: htmlUrl,
    email,
    bio,
  }
}

function normalizeAuthData(rawAuth: unknown): AuthData {
  if (!rawAuth || typeof rawAuth !== 'object') {
    return {
      provider: null,
      accessToken: null,
      refreshToken: null,
      user: null,
    }
  }

  const auth = rawAuth as Record<string, unknown>
  const provider = isAuthProvider(auth.provider) ? auth.provider : null
  const user = normalizeAuthUser(auth.user, provider)

  return {
    provider: provider || user?.provider || null,
    accessToken: toStringOrNull(auth.accessToken),
    refreshToken: toStringOrNull(auth.refreshToken),
    user,
  }
}

const DEFAULT_STORE: StoreData = {
  auth: {
    provider: null,
    accessToken: null,
    refreshToken: null,
    user: null,
  },
  settings: {
    github: {
      clientId: '',
      clientSecret: '',
    },
    google: {
      clientId: '',
      clientSecret: '',
    },
    theme: 'system',
    language: 'en',
    skills: { ...DEFAULT_SKILL_APP_SETTINGS },
    prompts: { ...DEFAULT_PROMPT_APP_SETTINGS },
    notifications: { ...DEFAULT_NOTIFICATION_APP_SETTINGS },
  },
  orgData: {
    currentOrg: null,
    invitations: [],
    sentInvites: [],
  },
  marketCache: {
    skills: [],
    agents: [],
    lastFetchedAt: null,
    ttlHours: 24,
  },
  installedSkills: [],
  promptHubAuth: {
    token: null,
    userId: null,
    email: null,
    name: null,
  },
  promptHubSync: {
    lastServerTime: null,
    lastSyncAt: null,
  },
  promptHubSkillSync: {
    lastServerTime: null,
    lastSyncAt: null,
  },
}

class Store {
  private data: StoreData = { ...DEFAULT_STORE }
  private filePath: string = ''
  private initialized = false

  private getStorePath(): string {
    if (this.filePath) return this.filePath
    this.filePath = join(getDataRoot(), 'promptman-store.json')
    return this.filePath
  }

  async init(): Promise<void> {
    if (this.initialized) return
    try {
      const storePath = this.getStorePath()
      const dir = dirname(storePath)
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }
      if (existsSync(storePath)) {
        const raw = await readFile(storePath, 'utf-8')
        const parsed = JSON.parse(raw) as Record<string, unknown>
        const parsedSettings = (parsed.settings || {}) as Partial<AppSettings>
        const rawSkillPaths = parsedSettings.skills?.customScanPaths
        const mergedSkills: SkillAppSettings = {
          ...DEFAULT_SKILL_APP_SETTINGS,
          ...(parsedSettings.skills || {}),
          customScanPaths: Array.isArray(rawSkillPaths)
            ? rawSkillPaths.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
            : DEFAULT_SKILL_APP_SETTINGS.customScanPaths,
        }
        const rawPromptPaths = parsedSettings.prompts?.customScanPaths
        const mergedPrompts: PromptAppSettings = {
          ...DEFAULT_PROMPT_APP_SETTINGS,
          ...(parsedSettings.prompts || {}),
          customScanPaths: Array.isArray(rawPromptPaths)
            ? rawPromptPaths.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
            : DEFAULT_PROMPT_APP_SETTINGS.customScanPaths,
        }
        const mergedNotifications: NotificationAppSettings = {
          ...DEFAULT_NOTIFICATION_APP_SETTINGS,
          ...(parsedSettings.notifications || {}),
        }
        // 合并默认值，确保新字段有默认值
        this.data = {
          auth: normalizeAuthData(parsed.auth),
          settings: {
            ...DEFAULT_STORE.settings,
            ...parsedSettings,
            github: {
              ...DEFAULT_STORE.settings.github,
              ...(parsedSettings.github || {}),
            },
            google: {
              ...DEFAULT_STORE.settings.google,
              ...(parsedSettings.google || {}),
            },
            skills: mergedSkills,
            prompts: mergedPrompts,
            notifications: mergedNotifications,
          },
          orgData: {
            ...DEFAULT_STORE.orgData,
            ...((parsed.orgData || {}) as Partial<OrganizationData>),
          },
          marketCache: {
            ...DEFAULT_STORE.marketCache,
            ...((parsed.marketCache || {}) as Partial<MarketCacheData>),
          },
          installedSkills: Array.isArray(parsed.installedSkills)
            ? (parsed.installedSkills as InstalledSkillRecord[])
            : [],
          promptHubAuth: {
            ...DEFAULT_STORE.promptHubAuth,
            ...((parsed.promptHubAuth || {}) as Partial<PromptHubAuth>),
          },
          promptHubSync: {
            ...DEFAULT_STORE.promptHubSync,
            ...((parsed.promptHubSync || {}) as Partial<PromptHubSyncState>),
          },
          promptHubSkillSync: {
            ...DEFAULT_STORE.promptHubSkillSync,
            ...((parsed.promptHubSkillSync || {}) as Partial<PromptHubSyncState>),
          },
        }
      } else {
        this.data = { ...DEFAULT_STORE }
        await this.save()
      }
      this.initialized = true
    } catch (error) {
      console.error('Store init error:', error)
      this.data = { ...DEFAULT_STORE }
      this.initialized = true
    }
  }

  private async save(): Promise<void> {
    try {
      const storePath = this.getStorePath()
      await writeFile(storePath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (error) {
      console.error('Store save error:', error)
    }
  }

  // Auth 相关
  async getAuth(): Promise<AuthData> {
    await this.init()
    return this.data.auth
  }

  async setAuth(auth: AuthData): Promise<void> {
    await this.init()
    this.data.auth = auth
    await this.save()
  }

  async clearAuth(): Promise<void> {
    await this.init()
    this.data.auth = { provider: null, accessToken: null, refreshToken: null, user: null }
    await this.save()
  }

  /** 应用登录与 PromptHub 云端视为同一会话：一并清除 */
  async clearUnifiedSession(): Promise<void> {
    await this.init()
    this.data.auth = { provider: null, accessToken: null, refreshToken: null, user: null }
    this.data.promptHubAuth = { token: null, userId: null, email: null, name: null }
    this.data.promptHubSync = { lastServerTime: null, lastSyncAt: null }
    this.data.promptHubSkillSync = { lastServerTime: null, lastSyncAt: null }
    await this.save()
  }

  // Settings 相关
  async getSettings(): Promise<AppSettings> {
    await this.init()
    const s = this.data.settings
    const language: AppSettings['language'] =
      s.language === 'zh' || s.language === 'en' ? s.language : 'en'
    return { ...s, language }
  }

  async updateSettings(settings: Partial<AppSettings>): Promise<void> {
    await this.init()
    /** 避免 { ...prev, ...settings } 时把 undefined 写入磁盘，尤其是旧配置缺少 language 时曾会抹掉语言 */
    settings = Object.fromEntries(
      Object.entries(settings).filter(([, v]) => v !== undefined),
    ) as Partial<AppSettings>
    const prev = this.data.settings
    const mergedSkills: SkillAppSettings = {
      ...DEFAULT_SKILL_APP_SETTINGS,
      ...(prev.skills || {}),
      ...(settings.skills !== undefined ? settings.skills : {}),
    }
    if (settings.skills?.customScanPaths !== undefined) {
      mergedSkills.customScanPaths = settings.skills.customScanPaths.filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      )
    }
    const mergedPrompts: PromptAppSettings = {
      ...DEFAULT_PROMPT_APP_SETTINGS,
      ...(prev.prompts || {}),
      ...(settings.prompts !== undefined ? settings.prompts : {}),
    }
    if (settings.prompts?.customScanPaths !== undefined) {
      mergedPrompts.customScanPaths = settings.prompts.customScanPaths.filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      )
    }
    const mergedNotifications: NotificationAppSettings = {
      ...DEFAULT_NOTIFICATION_APP_SETTINGS,
      ...(prev.notifications || {}),
      ...(settings.notifications !== undefined ? settings.notifications : {}),
    }
    this.data.settings = {
      ...prev,
      ...settings,
      github: {
        ...prev.github,
        ...(settings.github || {}),
      },
      google: {
        ...prev.google,
        ...(settings.google || {}),
      },
      ai: settings.ai ? { ...prev.ai, ...settings.ai } : prev.ai,
      skills: mergedSkills,
      prompts: mergedPrompts,
      notifications: mergedNotifications,
    }
    await this.save()
  }

  // ==================== Organization 相关 ====================

  async getOrgData(): Promise<OrganizationData> {
    await this.init()
    return this.data.orgData
  }

  async setCurrentOrg(org: UserOrganization | null): Promise<void> {
    await this.init()
    this.data.orgData.currentOrg = org
    await this.save()
  }

  async addInvitation(invitation: OrgInvitation): Promise<void> {
    await this.init()
    this.data.orgData.invitations.push(invitation)
    await this.save()
  }

  async updateInvitation(id: string, status: 'accepted' | 'declined'): Promise<OrgInvitation | null> {
    await this.init()
    const inv = this.data.orgData.invitations.find(i => i.id === id)
    if (!inv) return null
    inv.status = status
    await this.save()
    return inv
  }

  async addSentInvite(invitation: OrgInvitation): Promise<void> {
    await this.init()
    this.data.orgData.sentInvites.push(invitation)
    await this.save()
  }

  async leaveOrg(): Promise<void> {
    await this.init()
    this.data.orgData.currentOrg = null
    await this.save()
  }

  // ==================== Market Cache 相关 ====================

  async getMarketCache(): Promise<MarketCacheData> {
    await this.init()
    return this.data.marketCache
  }

  async setMarketCache(cache: Partial<MarketCacheData>): Promise<void> {
    await this.init()
    this.data.marketCache = {
      ...this.data.marketCache,
      ...cache,
    }
    await this.save()
  }

  // ==================== Installed Skills 相关 ====================

  async getInstalledSkills(): Promise<InstalledSkillRecord[]> {
    await this.init()
    return this.data.installedSkills
  }

  async addInstalledSkill(skill: InstalledSkillRecord): Promise<void> {
    await this.init()
    this.data.installedSkills.push(skill)
    await this.save()
  }

  async removeInstalledSkill(id: string): Promise<void> {
    await this.init()
    this.data.installedSkills = this.data.installedSkills.filter(s => s.id !== id)
    await this.save()
  }

  // ==================== PromptHub Auth 相关 ====================

  async getPromptHubAuth(): Promise<PromptHubAuth> {
    await this.init()
    return this.data.promptHubAuth
  }

  async setPromptHubAuth(auth: PromptHubAuth): Promise<void> {
    await this.init()
    this.data.promptHubAuth = auth
    await this.save()
  }

  async clearPromptHubAuth(): Promise<void> {
    await this.init()
    this.data.promptHubAuth = { token: null, userId: null, email: null, name: null }
    await this.save()
  }

  // ==================== PromptHub Sync 相关 ====================

  async getPromptHubSync(): Promise<PromptHubSyncState> {
    await this.init()
    return this.data.promptHubSync
  }

  async setPromptHubSync(state: Partial<PromptHubSyncState>): Promise<void> {
    await this.init()
    this.data.promptHubSync = { ...this.data.promptHubSync, ...state }
    await this.save()
  }

  // ==================== PromptHub Skill Sync 相关（独立游标）====================

  async getPromptHubSkillSync(): Promise<PromptHubSyncState> {
    await this.init()
    return this.data.promptHubSkillSync
  }

  async setPromptHubSkillSync(state: Partial<PromptHubSyncState>): Promise<void> {
    await this.init()
    this.data.promptHubSkillSync = { ...this.data.promptHubSkillSync, ...state }
    await this.save()
  }
}

// 单例
export const store = new Store()
