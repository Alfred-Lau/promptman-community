/**
 * SeekDB 相关类型定义
 */
import type { SkillFileNode } from '../skillPackage';

export type { SkillFileNode };

export interface SiteMetadata {
  name: string;
  description: string;
  url: string;
  previewUrl?: string;
  thumbnail?: string;
  category: string[];
  tags: string[];
  framework?: string;
  addedAt: string;
  featured?: boolean;
  status?: string;
}

export interface ComponentMetadata {
  siteId: string;
  siteName: string;
  name: string;
  description: string;
  category?: string;
  codeExample?: string;
  docUrl: string;
  tags?: string[];
  createdAt: string;
}

export interface CreateSiteInput {
  id: string;
  name: string;
  description: string;
  url: string;
  previewUrl?: string;
  thumbnail?: string;
  category: string[];
  tags: string[];
  framework?: string;
  addedAt?: string;
  featured?: boolean;
  status?: string;
}

export interface CreateComponentInput {
  id: string;
  siteId: string;
  siteName: string;
  name: string;
  description: string;
  category?: string;
  codeExample?: string;
  docUrl: string;
  tags?: string[];
  createdAt?: string;
}

export interface UpdateSiteInput {
  name?: string;
  description?: string;
  url?: string;
  previewUrl?: string;
  thumbnail?: string;
  category?: string[];
  tags?: string[];
  framework?: string;
  featured?: boolean;
  status?: string;
}

export interface UpdateComponentInput {
  name?: string;
  description?: string;
  category?: string;
  codeExample?: string;
  docUrl?: string;
  tags?: string[];
}

export interface QueryOptions {
  queryTexts: string[];
  nResults?: number;
  include?: ("documents" | "metadatas" | "distances")[];
}

export interface QueryResult {
  ids: string[][];
  documents?: string[][];
  metadatas?: Record<string, unknown>[][];
  distances?: number[][];
}

export interface GetResult {
  ids: string[];
  documents: string[];
  metadatas: (Record<string, unknown> | SiteMetadata | ComponentMetadata | PromptMetadata | AgentSkillMetadata | SubAgentMetadata | AgentTeamMetadata)[];
}

// ==================== Prompt 相关类型 ====================

/** 独立表 tag_definitions，prompts.tags JSON 存 id 列表 */
export interface TagDefinition {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface PromptMetadata {
  title: string;
  content: string;
  description?: string;
  category?: string;
  /** 展示用标签名（由 tag id 解析） */
  tags?: string[];
  /** 存储用标签 id，与 tag_definitions 表对应 */
  tagIds?: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
  promptId: string; // 用于版本管理的唯一标识，同一prompt的不同版本共享此ID
  isCurrentVersion?: boolean; // 是否为当前版本
  changeNotes?: string; // 版本变更说明，记录本次迭代改了什么
  cloudId?: string; // 云端 ID（p_ 前缀），非 null 表示已同步到云端
  libraryId?: string; // 所属库的ID
  isStarred?: boolean;
  uses?: number;
  lastUsedAt?: string;
  accent?: string;
  isPublic?: boolean;
  /** 适用场景：什么任务/输入适合用这个 Prompt（prompt-as-code 规范） */
  useWhen?: string[];
  /** 使用指导：关键指令、变量说明、调优建议 */
  guidance?: string[];
  /** 常见陷阱：已知局限、易错点、失败模式 */
  pitfalls?: string[];
}

export interface CreatePromptInput {
  id: string;
  promptId?: string; // 如果提供，则创建新版本；如果不提供，则创建新的prompt
  title: string;
  content: string;
  description?: string;
  category?: string;
  /** 归属库；创建时写入 library_id */
  libraryId?: string | null;
  tags?: string[];
  createdAt?: string;
  changeNotes?: string; // 版本变更说明
  accent?: string;
  useWhen?: string[];
  guidance?: string[];
  pitfalls?: string[];
}

export interface UpdatePromptInput {
  title?: string;
  content?: string;
  description?: string;
  category?: string;
  /** 更新归属库；传 null 表示移出库 */
  libraryId?: string | null;
  tags?: string[];
  isStarred?: boolean;
  accent?: string;
  isPublic?: boolean;
  useWhen?: string[];
  guidance?: string[];
  pitfalls?: string[];
}

export interface PromptVersion {
  id: string;
  version: number;
  title: string;
  content: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  isCurrentVersion: boolean;
  changeNotes?: string; // 版本变更说明
  useWhen?: string[];
  guidance?: string[];
  pitfalls?: string[];
}

// ==================== Agent Skills 相关类型 ====================

export interface AgentSkillMetadata {
  name: string;
  description?: string;
  category?: string;
  template: string; // SKILL.md 正文
  parameters?: Record<string, unknown>; // 技能参数定义
  examples?: string[]; // 使用示例
  /** 展示用标签名 */
  tags?: string[];
  /** 存储用标签 id */
  tagIds?: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
  skillId: string; // 用于版本管理的唯一标识
  isCurrentVersion?: boolean; // 是否为当前版本
  libraryId?: string; // 所属库的ID
  isStarred?: boolean;
  uses?: number;
  lastUsedAt?: string;
  accent?: string;
  isPublic?: boolean;
  /** 兼容平台（Cursor / Claude / VS Code ...），与云端 platforms 对齐 */
  platforms?: string[];
  /** 是否启用；与云端 is_active 对齐 */
  isActive?: boolean;
  /** 云端自由文本版本号，如 'v1.0'；与本地整数 version 无关 */
  versionLabel?: string;
  /** 云端 ID（sk_ 前缀），非 null 表示已同步到云端 */
  cloudId?: string | null;
  /** 外部目录同步来源（fs-scan）：源 SKILL.md 的绝对路径，非 null 时编辑/删除会写回磁盘 */
  sourcePath?: string | null;
  /** 多文件技能包目录名（真实文件在 <dataRoot>/skill-packages/<packageDir>/） */
  packageDir?: string | null;
  fileTree?: SkillFileNode[];
  fileCount?: number;
  packageSize?: number;
  sourceType?: string;
  sourceRef?: string;
  sourceSkill?: string;
  sourceCommit?: string;
}

export interface CreateAgentSkillInput {
  id: string;
  skillId?: string; // 如果提供，则创建新版本；如果不提供，则创建新的技能
  name: string;
  description?: string;
  category?: string;
  /** 归属库；创建时写入 library_id */
  libraryId?: string | null;
  template: string;
  parameters?: Record<string, unknown>;
  examples?: string[];
  tags?: string[];
  accent?: string;
  createdAt?: string;
  platforms?: string[];
  isActive?: boolean;
  versionLabel?: string;
  isPublic?: boolean;
  sourceType?: string;
  sourceRef?: string;
  sourceSkill?: string;
  sourceCommit?: string;
}

export interface UpdateAgentSkillInput {
  name?: string;
  description?: string;
  category?: string;
  /** 更新归属库；传 null 表示移出库 */
  libraryId?: string | null;
  template?: string;
  parameters?: Record<string, unknown>;
  examples?: string[];
  tags?: string[];
  isStarred?: boolean;
  accent?: string;
  isPublic?: boolean;
  platforms?: string[];
  isActive?: boolean;
  versionLabel?: string;
}

export interface AgentSkillVersion {
  id: string;
  version: number;
  name: string;
  description?: string;
  category?: string;
  template: string;
  createdAt: string;
  updatedAt: string;
  isCurrentVersion: boolean;
}

// ==================== SubAgent 相关类型 ====================

/**
 * SubAgent 元数据
 * 基于 Claude subagent 标准规范，定义子代理配置
 */
export interface SubAgentMetadata {
  name: string;
  description?: string;
  category?: string;
  type: SubAgentType;
  model?: string;
  instructions: string;
  tools?: string[];
  handoffConditions?: string;
  inputSchema?: Record<string, unknown>;
  outputFormat?: string;
  maxTokens?: number;
  temperature?: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
  subAgentId: string;
  isCurrentVersion?: boolean;
}

export type SubAgentType =
  | 'generalPurpose'
  | 'explore'
  | 'shell'
  | 'codeReview'
  | 'testing'
  | 'documentation'
  | 'refactoring'
  | 'custom';

export interface CreateSubAgentInput {
  id: string;
  subAgentId?: string;
  name: string;
  description?: string;
  category?: string;
  type: SubAgentType;
  model?: string;
  instructions: string;
  tools?: string[];
  handoffConditions?: string;
  inputSchema?: Record<string, unknown>;
  outputFormat?: string;
  maxTokens?: number;
  temperature?: number;
  tags?: string[];
  createdAt?: string;
}

export interface UpdateSubAgentInput {
  name?: string;
  description?: string;
  category?: string;
  type?: SubAgentType;
  model?: string;
  instructions?: string;
  tools?: string[];
  handoffConditions?: string;
  inputSchema?: Record<string, unknown>;
  outputFormat?: string;
  maxTokens?: number;
  temperature?: number;
  tags?: string[];
}

export interface SubAgentVersion {
  id: string;
  version: number;
  name: string;
  description?: string;
  category?: string;
  type: SubAgentType;
  instructions: string;
  createdAt: string;
  updatedAt: string;
  isCurrentVersion: boolean;
}

// ==================== Organization 相关类型 ====================

/**
 * 用户所属组织
 * 组织是一个概念：用户归属于某个组织
 */
export interface UserOrganization {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

/**
 * 组织邀请
 */
export interface OrgInvitation {
  id: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  invitedBy: string;         // 邀请人用户名
  invitedByAvatar?: string;
  invitedAt: string;
  status: 'pending' | 'accepted' | 'declined';
}

// ==================== Market Registry 相关类型 ====================

/**
 * 远程 Registry 中的 Skill 条目
 * 从 GitHub awesome-skills 仓库获取
 */
export interface RegistrySkill {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  repoUrl: string;          // Skill 所在仓库
  installCommand?: string;  // CLI 安装命令
  version: string;
  downloads: number;
  rating: number;
  featured?: boolean;
  readme?: string;
}

/**
 * 远程 Registry 中的 Agent 条目
 */
export interface RegistryAgent {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  repoUrl: string;
  installCommand?: string;
  version: string;
  downloads: number;
  rating: number;
  featured?: boolean;
  readme?: string;
}

/**
 * 已通过 CLI 安装的 Skill 包
 */
export interface InstalledSkill {
  id: string;
  name: string;
  version: string;
  installPath: string;
  installedAt: string;
  source: 'registry' | 'manual';
  registryId?: string;  // 关联的 RegistrySkill id
}

// ==================== Agent Team 相关类型 ====================

/**
 * Agent Team 元数据
 * 基于 Claude Agent Teams 标准规范，定义团队协作配置
 * 参考：https://code.claude.com/docs/en/agent-teams
 */
export interface AgentTeamMetadata {
  name: string;
  description?: string;
  category?: string;
  displayMode: TeamDisplayMode;
  leadInstructions: string;
  leadModel?: string;
  delegateMode?: boolean;
  requirePlanApproval?: boolean;
  teammates: string;               // JSON 格式的队友定义列表
  taskTemplate?: string;
  qualityGates?: string;
  maxTeammates?: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
  teamId: string;
  isCurrentVersion?: boolean;
}

export interface TeammateDef {
  role: string;
  description?: string;
  model?: string;
  spawnPrompt: string;
  tools?: string[];
  requirePlanApproval?: boolean;
}

export type TeamDisplayMode =
  | 'auto'
  | 'in-process'
  | 'split-panes';

export interface CreateAgentTeamInput {
  id: string;
  teamId?: string;
  name: string;
  description?: string;
  category?: string;
  displayMode?: TeamDisplayMode;
  leadInstructions: string;
  leadModel?: string;
  delegateMode?: boolean;
  requirePlanApproval?: boolean;
  teammates: TeammateDef[];
  taskTemplate?: string;
  qualityGates?: string;
  maxTeammates?: number;
  tags?: string[];
  createdAt?: string;
}

export interface UpdateAgentTeamInput {
  name?: string;
  description?: string;
  category?: string;
  displayMode?: TeamDisplayMode;
  leadInstructions?: string;
  leadModel?: string;
  delegateMode?: boolean;
  requirePlanApproval?: boolean;
  teammates?: TeammateDef[];
  taskTemplate?: string;
  qualityGates?: string;
  maxTeammates?: number;
  tags?: string[];
}

export interface AgentTeamVersion {
  id: string;
  version: number;
  name: string;
  description?: string;
  category?: string;
  displayMode: TeamDisplayMode;
  leadInstructions: string;
  teammates: TeammateDef[];
  createdAt: string;
  updatedAt: string;
  isCurrentVersion: boolean;
}

// ==================== Library 相关类型 ====================

export interface LibraryItem {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  parentId?: string;
  shareToken?: string;
  shareEnabled?: boolean;
}

export interface CreateLibraryInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string;
}

export interface UpdateLibraryInput {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string;
  shareEnabled?: boolean;
}

