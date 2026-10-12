/**
 * sqlitedb 模块统一导出
 * 与 seekdb/index.ts 导出完全兼容，ipc.ts 只需改 import 路径
 */

// 配置与 DB 管理
export { initDB, getDB, closeDB, isVecAvailable } from "./db";

// 类型定义（与 seekdb/types.ts 完全一致）
export type {
  SiteMetadata,
  ComponentMetadata,
  CreateSiteInput,
  CreateComponentInput,
  UpdateSiteInput,
  UpdateComponentInput,
  PromptMetadata,
  CreatePromptInput,
  UpdatePromptInput,
  PromptVersion,
  AgentSkillMetadata,
  CreateAgentSkillInput,
  UpdateAgentSkillInput,
  AgentSkillVersion,
  SkillFileNode,
  SubAgentMetadata,
  SubAgentType,
  CreateSubAgentInput,
  UpdateSubAgentInput,
  SubAgentVersion,
  AgentTeamMetadata,
  TeammateDef,
  TeamDisplayMode,
  CreateAgentTeamInput,
  UpdateAgentTeamInput,
  AgentTeamVersion,
  LibraryMetadata,
  LibraryItem,
  CreateLibraryInput,
  UpdateLibraryInput,
} from "./types";

// 共用查询类型
export type { QueryOptions, QueryResult, GetResult } from "./crud";

// Sites CRUD
export {
  createSite,
  createSites,
  getSite,
  getAllSites,
  updateSite,
  deleteSite,
  deleteSites,
  searchSites,
  getSitesCount,
  ensureSitesCollection,
} from "./crud";

// Components CRUD
export {
  createComponent,
  createComponents,
  getComponent,
  getAllComponents,
  getComponentsBySiteId,
  updateComponent,
  deleteComponent,
  deleteComponents,
  deleteComponentsBySiteId,
  searchComponents,
  getComponentsCount,
  ensureComponentsCollection,
} from "./crud";

// Prompts CRUD
export {
  createPrompt,
  createPrompts,
  getPrompt,
  getAllPrompts,
  getCurrentPrompts,
  getPromptVersions,
  updatePrompt,
  setCurrentVersion,
  deletePrompt,
  deletePromptAllVersions,
  deletePrompts,
  searchPrompts,
  getPromptsCount,
  togglePromptStar,
  incrementPromptUses,
  ensurePromptsCollection,
  setPromptCloudId,
} from "./crud";

// Agent Skills CRUD
export {
  createAgentSkill,
  getAgentSkill,
  getAllAgentSkills,
  getCurrentAgentSkills,
  getAgentSkillVersions,
  updateAgentSkill,
  setAgentSkillCurrentVersion,
  deleteAgentSkill,
  deleteAgentSkillAllVersions,
  deleteAgentSkills,
  searchAgentSkills,
  getAgentSkillsCount,
  toggleAgentSkillStar,
  incrementAgentSkillUses,
  setAgentSkillPackageIndex,
  getCurrentAgentSkillBySkillId,
  findCurrentAgentSkillByName,
  setAgentSkillSource,
  ensureAgentSkillsCollection,
} from "./crud";

// SubAgents CRUD
export {
  createSubAgent,
  getSubAgent,
  getAllSubAgents,
  getCurrentSubAgents,
  getSubAgentVersions,
  updateSubAgent,
  setSubAgentCurrentVersion,
  deleteSubAgent,
  deleteSubAgentAllVersions,
  deleteSubAgents,
  searchSubAgents,
  getSubAgentsCount,
  ensureSubAgentsCollection,
} from "./crud";

// Agent Teams CRUD
export {
  createAgentTeam,
  getAgentTeam,
  getAllAgentTeams,
  getCurrentAgentTeams,
  getAgentTeamVersions,
  updateAgentTeam,
  setAgentTeamCurrentVersion,
  deleteAgentTeam,
  deleteAgentTeamAllVersions,
  deleteAgentTeams,
  searchAgentTeams,
  getAgentTeamsCount,
  ensureAgentTeamsCollection,
} from "./crud";

// Library CRUD
export {
  createLibrary,
  getLibrary,
  getAllLibraries,
  updateLibrary,
  deleteLibrary,
  movePromptToLibrary,
  moveSkillToLibrary,
} from "./crud";

// 标签定义
export {
  getAllTagDefinitions,
  createTagDefinition,
  updateTagDefinition,
  deleteTagDefinition,
} from "./tags";
export type { TagDefinitionRow } from "./tags";
