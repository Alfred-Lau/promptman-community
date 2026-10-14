/**
 * SeekDB 相关类型定义
 */

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

export interface PromptMetadata {
  title: string;
  content: string;
  description?: string;
  category?: string;
  tags?: string[];
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
  // 结构化指导字段（prompt-as-code 模板规范），用于展示辅助与检索增强
  useWhen?: string[]; // 适用场景：什么任务/输入适合用这个 Prompt
  guidance?: string[]; // 使用指导：关键指令、变量说明、调优建议
  pitfalls?: string[]; // 常见陷阱：已知局限、易错点、失败模式
}

export interface CreatePromptInput {
  id: string;
  promptId?: string; // 如果提供，则创建新版本；如果不提供，则创建新的prompt
  title: string;
  content: string;
  description?: string;
  category?: string;
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

/**
 * 技能包内的单个文件/目录节点（与 prompthub-website 的 SkillFileNode 保持一致）
 */
export interface SkillFileNode {
  path: string;
  name: string;
  size: number;
  isDir: boolean;
  /** 是否可作为文本预览 */
  isText: boolean;
}

export interface AgentSkillMetadata {
  name: string;
  description: string;
  category: string;
  template: string; // SKILL.md 正文
  parameters?: Record<string, unknown>; // 技能参数定义
  examples?: string[]; // 使用示例
  tags?: string[];
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
  // 云端对齐字段
  platforms?: string[]; // 兼容平台（Cursor / Claude / ...）
  isActive?: boolean;
  versionLabel?: string; // 云端自由文本版本号，如 'v1.0'
  cloudId?: string | null; // 云端 ID（sk_ 前缀），非 null 表示已同步到云端
  // 外部目录同步来源（fs-scan）：源 SKILL.md 的绝对路径，供编辑/删除写回磁盘与反查
  sourcePath?: string | null;
  // 多文件技能包索引（真实文件在 <dataRoot>/skill-packages/<skillId>/）
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
  description: string;
  category: string;
  libraryId?: string | null;
  template: string;
  parameters?: Record<string, unknown>;
  examples?: string[];
  tags?: string[];
  createdAt?: string;
  accent?: string;
  platforms?: string[];
  isActive?: boolean;
  versionLabel?: string;
  isPublic?: boolean;
  /** 外部目录同步来源（fs-scan）：源 SKILL.md 的绝对路径 */
  sourcePath?: string | null;
  sourceType?: string;
  sourceRef?: string;
  sourceSkill?: string;
  sourceCommit?: string;
}

export interface UpdateAgentSkillInput {
  name?: string;
  description?: string;
  category?: string;
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
  description: string;
  category: string;
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
  name: string;                    // 子代理名称
  description?: string;             // 子代理描述
  category?: string;                // 分类（如：开发、测试、部署等）
  type: SubAgentType;              // 子代理类型
  model?: string;                  // 使用的模型（如：fast、default）
  instructions: string;            // 系统指令/提示词
  tools?: string[];                // 可用工具列表
  handoffConditions?: string;      // 移交条件说明
  inputSchema?: Record<string, unknown>;  // 输入参数 schema
  outputFormat?: string;           // 输出格式描述
  maxTokens?: number;              // 最大输出 token 数
  temperature?: number;            // 温度参数
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
  subAgentId: string;              // 用于版本管理的唯一标识
  isCurrentVersion?: boolean;       // 是否为当前版本
}

export type SubAgentType =
  | 'generalPurpose'    // 通用型子代理
  | 'explore'           // 代码探索型
  | 'shell'             // 命令执行型
  | 'codeReview'        // 代码审查型
  | 'testing'           // 测试型
  | 'documentation'     // 文档型
  | 'refactoring'       // 重构型
  | 'custom';           // 自定义型

export interface CreateSubAgentInput {
  id: string;
  subAgentId?: string;              // 如果提供，则创建新版本
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

// ==================== Agent Team 相关类型 ====================

/**
 * Agent Team 元数据
 * 基于 Claude Agent Teams 标准规范，定义团队协作配置
 * 参考：https://code.claude.com/docs/en/agent-teams
 */
export interface AgentTeamMetadata {
  name: string;                    // 团队名称
  description?: string;             // 团队描述
  category?: string;                // 分类（如：研发、审查、调试等）
  displayMode: TeamDisplayMode;    // 显示模式
  leadInstructions: string;        // 团队负责人（lead）的系统指令
  leadModel?: string;              // lead 使用的模型
  delegateMode?: boolean;          // 是否启用委派模式（lead 仅协调不编码）
  requirePlanApproval?: boolean;   // 是否要求队友在实施前提交计划审批
  teammates: string;               // JSON 格式的队友定义列表 TeammateDef[]
  taskTemplate?: string;           // 任务分配模板（描述团队如何拆解任务）
  qualityGates?: string;           // 质量门控规则描述
  maxTeammates?: number;           // 最大队友数
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
  teamId: string;                  // 用于版本管理的唯一标识
  isCurrentVersion?: boolean;       // 是否为当前版本
}

/**
 * 队友定义
 */
export interface TeammateDef {
  role: string;                    // 角色名称（如：security-reviewer, architect）
  description?: string;             // 角色描述
  model?: string;                  // 使用的模型
  spawnPrompt: string;             // 生成提示词（spawn prompt）
  tools?: string[];                // 可用工具列表
  requirePlanApproval?: boolean;   // 该队友是否需要计划审批
}

export type TeamDisplayMode =
  | 'auto'           // 自动选择（tmux 环境用分屏，否则进程内）
  | 'in-process'     // 进程内模式
  | 'split-panes';   // 分屏模式（需要 tmux 或 iTerm2）

export interface CreateAgentTeamInput {
  id: string;
  teamId?: string;                  // 如果提供，则创建新版本
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

export interface LibraryMetadata {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLibraryInput {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string | null;
}

export interface UpdateLibraryInput {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string | null;
  shareEnabled?: boolean;
}

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

