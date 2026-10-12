/**
 * SeekDB CRUD 操作
 */
import { AddOptions, Metadata } from "seekdb";
import { getSeekDBClient } from "./client";
import {
  CreateSiteInput,
  CreateComponentInput,
  UpdateSiteInput,
  UpdateComponentInput,
  QueryOptions,
  QueryResult,
  GetResult,
  SiteMetadata,
  ComponentMetadata,
  CreatePromptInput,
  UpdatePromptInput,
  PromptMetadata,
  PromptVersion,
  CreateAgentSkillInput,
  UpdateAgentSkillInput,
  AgentSkillMetadata,
  AgentSkillVersion,
} from "./types";

const SITES_COLLECTION_NAME = "animation_sites";
const COMPONENTS_COLLECTION_NAME = "site_components";
const PROMPTS_COLLECTION_NAME = "prompts";
const AGENT_SKILLS_COLLECTION_NAME = "agent_skills";

// ==================== 站点集合操作 ====================

/**
 * 生成站点的搜索文本
 */
function generateSiteSearchText(site: {
  name: string;
  description: string;
  category: string[];
  tags: string[];
  framework?: string;
}): string {
  const parts = [site.name, site.description, ...site.category, ...site.tags];
  if (site.framework) {
    parts.push(site.framework);
  }
  return parts.join(" ");
}

/**
 * 生成组件的搜索文本
 */
function generateComponentSearchText(component: {
  name: string;
  description: string;
  category?: string;
  siteName?: string;
}): string {
  const parts = [
    component.name,
    component.description,
    component.category || "",
    component.siteName || "",
  ].filter(Boolean);
  return parts.join(" ");
}

/**
 * 创建站点集合（如果不存在）
 */
export async function ensureSitesCollection() {
  const client = getSeekDBClient();
  return await client.getOrCreateCollection({
    name: SITES_COLLECTION_NAME,
  });
}

/**
 * 创建组件集合（如果不存在）
 */
export async function ensureComponentsCollection() {
  const client = getSeekDBClient();
  return await client.getOrCreateCollection({
    name: COMPONENTS_COLLECTION_NAME,
  });
}

// ==================== 站点 CRUD ====================

/**
 * 创建站点
 */
export async function createSite(input: CreateSiteInput): Promise<void> {
  const collection = await ensureSitesCollection();
  const searchText = generateSiteSearchText({
    name: input.name,
    description: input.description,
    category: input.category,
    tags: input.tags,
    framework: input.framework,
  });

  const metadata: SiteMetadata = {
    name: input.name,
    description: input.description,
    url: input.url,
    previewUrl: input.previewUrl || "",
    thumbnail: input.thumbnail || "",
    category: input.category,
    tags: input.tags,
    framework: input.framework,
    addedAt: input.addedAt || new Date().toISOString(),
    featured: input.featured || false,
    status: input.status || "approved",
  };

  await collection.add({
    ids: [input.id],
    documents: [searchText],
    metadatas: [metadata as unknown as Metadata],
  } as AddOptions);
}

/**
 * 批量创建站点
 */
export async function createSites(inputs: CreateSiteInput[]): Promise<void> {
  if (inputs.length === 0) return;

  const collection = await ensureSitesCollection();
  const ids: string[] = [];
  const documents: string[] = [];
  const metadatas: Metadata[] = [];

  for (const input of inputs) {
    ids.push(input.id);
    documents.push(
      generateSiteSearchText({
        name: input.name,
        description: input.description,
        category: input.category,
        tags: input.tags,
        framework: input.framework,
      })
    );
    metadatas.push({
      name: input.name,
      description: input.description,
      url: input.url,
      previewUrl: input.previewUrl || "",
      thumbnail: input.thumbnail || "",
      category: JSON.stringify(input.category),
      tags: JSON.stringify(input.tags),
      framework: input.framework,
      addedAt: input.addedAt || new Date().toISOString(),
      featured: input.featured || false,
      status: input.status || "approved",
    } as Metadata);
  }

  await collection.add({
    ids,
    documents,
    metadatas,
  } as AddOptions);
}

/**
 * 根据 ID 获取站点
 */
export async function getSite(id: string): Promise<SiteMetadata | null> {
  const collection = await ensureSitesCollection();
  const result = await collection.get({
    ids: [id],
    include: ["documents", "metadatas"],
  });

  if (result.ids.length === 0 || !result.metadatas || result.metadatas.length === 0) {
    return null;
  }

  const metadata = result.metadatas[0] as unknown as SiteMetadata;
  // 解析 JSON 字符串字段
  if (typeof metadata.category === "string") {
    metadata.category = JSON.parse(metadata.category);
  }
  if (typeof metadata.tags === "string") {
    metadata.tags = JSON.parse(metadata.tags);
  }

  return metadata;
}

/**
 * 获取所有站点
 */
export async function getAllSites(): Promise<GetResult> {
  const collection = await ensureSitesCollection();
  const result = await collection.get({
    include: ["documents", "metadatas"],
  });

  // 解析 JSON 字符串字段
  const metadatas = (result.metadatas || []).map((meta: Metadata | null) => {
    if (!meta) return {};
    const m = { ...meta } as Record<string, unknown>;
    if (typeof m.category === "string") {
      m.category = JSON.parse(m.category);
    }
    if (typeof m.tags === "string") {
      m.tags = JSON.parse(m.tags);
    }
    return m;
  });

  return {
    ids: [...result.ids],
    documents: result.documents ? result.documents.filter((d): d is string => d !== null) : [],
    metadatas,
  };
}

/**
 * 更新站点
 */
export async function updateSite(
  id: string,
  input: UpdateSiteInput
): Promise<void> {
  const collection = await ensureSitesCollection();
  const existing = await getSite(id);

  if (!existing) {
    throw new Error(`站点 ${id} 不存在`);
  }

  // 合并更新数据
  const updated: SiteMetadata = {
    ...existing,
    ...input,
    category: input.category || existing.category,
    tags: input.tags || existing.tags,
  };

  // 重新生成搜索文本
  const searchText = generateSiteSearchText({
    name: updated.name,
    description: updated.description,
    category: updated.category,
    tags: updated.tags,
    framework: updated.framework,
  });

  // 先删除旧记录
  await collection.delete({ ids: [id] });

  // 再添加更新后的记录
  await collection.add({
    ids: [id],
    documents: [searchText],
    metadatas: [
      {
        ...updated,
        category: JSON.stringify(updated.category),
        tags: JSON.stringify(updated.tags),
      } as Metadata,
    ],
  } as AddOptions);
}

/**
 * 删除站点
 */
export async function deleteSite(id: string): Promise<void> {
  const collection = await ensureSitesCollection();
  await collection.delete({ ids: [id] });
}

/**
 * 批量删除站点
 */
export async function deleteSites(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const collection = await ensureSitesCollection();
  await collection.delete({ ids });
}

/**
 * 搜索站点
 */
export async function searchSites(options: QueryOptions): Promise<QueryResult> {
  const collection = await ensureSitesCollection();
  const result = await collection.query({
    queryTexts: options.queryTexts,
    nResults: options.nResults || 10,
    include: options.include || ["documents", "metadatas", "distances"],
  });
  return {
    ids: result.ids.map(arr => arr.filter(id => id !== null) as string[]),
    documents: result.documents?.map(arr => arr.filter(d => d !== null) as string[]) || [],
    metadatas: result.metadatas?.map(arr => arr.filter(m => m !== null).map(m => m as Record<string, unknown>)) || [],
    distances: result.distances?.map(arr => arr.filter(d => d !== null) as number[]),
  };
}

/**
 * 获取站点数量
 */
export async function getSitesCount(): Promise<number> {
  const collection = await ensureSitesCollection();
  return await collection.count();
}

// ==================== 组件 CRUD ====================

/**
 * 创建组件
 */
export async function createComponent(
  input: CreateComponentInput
): Promise<void> {
  const collection = await ensureComponentsCollection();
  const searchText = generateComponentSearchText({
    name: input.name,
    description: input.description,
    category: input.category,
    siteName: input.siteName,
  });

  const metadata: ComponentMetadata = {
    siteId: input.siteId,
    siteName: input.siteName,
    name: input.name,
    description: input.description,
    category: input.category || "",
    codeExample: input.codeExample || "",
    docUrl: input.docUrl,
    tags: input.tags || [],
    createdAt: input.createdAt || new Date().toISOString(),
  };

  await collection.add({
    ids: [input.id],
    documents: [searchText],
    metadatas: [metadata as unknown as Metadata],
  } as AddOptions);
}

/**
 * 批量创建组件
 */
export async function createComponents(
  inputs: CreateComponentInput[]
): Promise<void> {
  if (inputs.length === 0) return;

  const collection = await ensureComponentsCollection();
  const ids: string[] = [];
  const documents: string[] = [];
  const metadatas: Metadata[] = [];

  for (const input of inputs) {
    ids.push(input.id);
    documents.push(
      generateComponentSearchText({
        name: input.name,
        description: input.description,
        category: input.category,
        siteName: input.siteName,
      })
    );
    metadatas.push({
      siteId: input.siteId,
      siteName: input.siteName,
      name: input.name,
      description: input.description,
      category: input.category || "",
      codeExample: input.codeExample || "",
      docUrl: input.docUrl,
      tags: JSON.stringify(input.tags || []),
      createdAt: input.createdAt || new Date().toISOString(),
    } as Metadata);
  }

  await collection.add({
    ids,
    documents,
    metadatas,
  } as AddOptions);
}

/**
 * 根据 ID 获取组件
 */
export async function getComponent(
  id: string
): Promise<ComponentMetadata | null> {
  const collection = await ensureComponentsCollection();
  const result = await collection.get({
    ids: [id],
    include: ["documents", "metadatas"],
  });

  if (result.ids.length === 0 || !result.metadatas || result.metadatas.length === 0) {
    return null;
  }

  const metadata = result.metadatas[0] as unknown as ComponentMetadata;
  // 解析 JSON 字符串字段
  if (typeof metadata.tags === "string") {
    metadata.tags = JSON.parse(metadata.tags);
  }

  return metadata;
}

/**
 * 获取所有组件
 */
export async function getAllComponents(): Promise<GetResult> {
  const collection = await ensureComponentsCollection();
  const result = await collection.get({
    include: ["documents", "metadatas"],
  });

  // 解析 JSON 字符串字段
  const metadatas = (result.metadatas || []).map((meta: Metadata | null) => {
    if (!meta) return {};
    const m = { ...meta } as Record<string, unknown>;
    if (typeof m.tags === "string") {
      m.tags = JSON.parse(m.tags);
    }
    return m;
  });

  return {
    ids: [...result.ids],
    documents: result.documents ? result.documents.filter((d): d is string => d !== null) : [],
    metadatas,
  };
}

/**
 * 根据站点 ID 获取组件
 */
export async function getComponentsBySiteId(
  siteId: string
): Promise<GetResult> {
  const collection = await ensureComponentsCollection();
  // 先获取所有组件，然后过滤（SeekDB 可能不支持直接按 metadata 过滤）
  const all = await getAllComponents();
  const filtered = all.metadatas
    .map((meta: any, index: number) => {
      const m = meta as Record<string, unknown>;
      return {
        id: all.ids[index],
        document: all.documents[index],
        metadata: m as unknown as ComponentMetadata,
      };
    })
    .filter((item) => item.metadata.siteId === siteId);

  return {
    ids: filtered.map((item) => item.id),
    documents: filtered.map((item) => item.document),
    metadatas: filtered.map((item) => item.metadata as unknown as Record<string, unknown>),
  };
}

/**
 * 更新组件
 */
export async function updateComponent(
  id: string,
  input: UpdateComponentInput
): Promise<void> {
  const collection = await ensureComponentsCollection();
  const existing = await getComponent(id);

  if (!existing) {
    throw new Error(`组件 ${id} 不存在`);
  }

  // 合并更新数据
  const updated: ComponentMetadata = {
    ...existing,
    ...input,
    tags: input.tags || existing.tags,
  };

  // 重新生成搜索文本
  const searchText = generateComponentSearchText({
    name: updated.name,
    description: updated.description,
    category: updated.category,
    siteName: updated.siteName,
  });

  // 先删除旧记录
  await collection.delete({ ids: [id] });

  // 再添加更新后的记录
  await collection.add({
    ids: [id],
    documents: [searchText],
    metadatas: [
      {
        ...updated,
        tags: JSON.stringify(updated.tags || []),
      } as Metadata,
    ],
  } as AddOptions);
}

/**
 * 删除组件
 */
export async function deleteComponent(id: string): Promise<void> {
  const collection = await ensureComponentsCollection();
  await collection.delete({ ids: [id] });
}

/**
 * 批量删除组件
 */
export async function deleteComponents(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const collection = await ensureComponentsCollection();
  await collection.delete({ ids });
}

/**
 * 根据站点 ID 删除所有组件
 */
export async function deleteComponentsBySiteId(siteId: string): Promise<void> {
  const components = await getComponentsBySiteId(siteId);
  if (components.ids.length > 0) {
    await deleteComponents(components.ids);
  }
}

/**
 * 搜索组件
 */
export async function searchComponents(
  options: QueryOptions
): Promise<QueryResult> {
  const collection = await ensureComponentsCollection();
  const result = await collection.query({
    queryTexts: options.queryTexts,
    nResults: options.nResults || 10,
    include: options.include || ["documents", "metadatas", "distances"],
  });
  return {
    ids: result.ids.map(arr => arr.filter(id => id !== null) as string[]),
    documents: result.documents?.map(arr => arr.filter(d => d !== null) as string[]) || [],
    metadatas: result.metadatas?.map(arr => arr.filter(m => m !== null).map(m => m as Record<string, unknown>)) || [],
    distances: result.distances?.map(arr => arr.filter(d => d !== null) as number[]),
  };
}

/**
 * 获取组件数量
 */
export async function getComponentsCount(): Promise<number> {
  const collection = await ensureComponentsCollection();
  return await collection.count();
}

// ==================== Prompt 集合操作 ====================

/**
 * 生成prompt的搜索文本
 */
function generatePromptSearchText(prompt: {
  title: string;
  content: string;
  description?: string;
  category?: string;
  tags?: string[];
}): string {
  const parts = [
    prompt.title,
    prompt.content,
    prompt.description || "",
    prompt.category || "",
    ...(prompt.tags || []),
  ].filter(Boolean);
  return parts.join(" ");
}

/**
 * 创建prompt集合（如果不存在）
 */
export async function ensurePromptsCollection() {
  const client = getSeekDBClient();
  return await client.getOrCreateCollection({
    name: PROMPTS_COLLECTION_NAME,
  });
}

// ==================== Prompt CRUD ====================

/**
 * 创建prompt（或新版本）
 */
export async function createPrompt(input: CreatePromptInput): Promise<void> {
  const collection = await ensurePromptsCollection();
  
  // 如果提供了promptId，说明是创建新版本
  let promptId = input.promptId;
  let version = 1;
  
  if (promptId) {
    // 获取该prompt的所有版本，找到最大版本号
    const allPrompts = await getAllPrompts();
    const versions = allPrompts.metadatas
      .map((meta, index) => ({
        id: allPrompts.ids[index],
        metadata: meta as PromptMetadata,
      }))
      .filter((item) => item.metadata.promptId === promptId);
    
    if (versions.length > 0) {
      version = Math.max(...versions.map((v) => v.metadata.version)) + 1;
      // 将之前的版本标记为非当前版本
      for (const v of versions) {
        if (v.metadata.isCurrentVersion) {
          await updatePrompt(v.id, { isCurrentVersion: false });
        }
      }
    }
  } else {
    // 创建新的prompt，生成唯一的promptId
    promptId = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const searchText = generatePromptSearchText({
    title: input.title,
    content: input.content,
    description: input.description,
    category: input.category,
    tags: input.tags,
  });

  const now = input.createdAt || new Date().toISOString();
  const metadata: PromptMetadata = {
    title: input.title,
    content: input.content,
    description: input.description || "",
    category: input.category || "",
    tags: input.tags || [],
    createdAt: now,
    updatedAt: now,
    version,
    promptId,
    isCurrentVersion: true,
    changeNotes: input.changeNotes || "",
  };

  await collection.add({
    ids: [input.id],
    documents: [searchText],
    metadatas: [metadata as unknown as Metadata],
  } as AddOptions);
}

/**
 * 批量创建prompt
 */
export async function createPrompts(inputs: CreatePromptInput[]): Promise<void> {
  if (inputs.length === 0) return;

  const collection = await ensurePromptsCollection();
  
  // 先获取所有现有prompt，用于计算版本号
  const allPrompts = await getAllPrompts();
  const versionMap = new Map<string, number>();
  
  // 构建版本号映射
  allPrompts.metadatas.forEach((meta) => {
    const promptMeta = meta as PromptMetadata;
    const currentVersion = versionMap.get(promptMeta.promptId) || 0;
    if (promptMeta.version > currentVersion) {
      versionMap.set(promptMeta.promptId, promptMeta.version);
    }
  });

  const ids: string[] = [];
  const documents: string[] = [];
  const metadatas: Metadata[] = [];
  const promptIdToUpdate = new Set<string>();

  for (const input of inputs) {
    let promptId = input.promptId;
    let version = 1;

    if (promptId) {
      const currentMaxVersion = versionMap.get(promptId) || 0;
      version = currentMaxVersion + 1;
      versionMap.set(promptId, version);
      promptIdToUpdate.add(promptId);
    } else {
      promptId = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      versionMap.set(promptId, 1);
    }

    ids.push(input.id);
    documents.push(
      generatePromptSearchText({
        title: input.title,
        content: input.content,
        description: input.description,
        category: input.category,
        tags: input.tags,
      })
    );
    const now = input.createdAt || new Date().toISOString();
    metadatas.push({
      title: input.title,
      content: input.content,
      description: input.description || "",
      category: input.category || "",
      tags: JSON.stringify(input.tags || []),
      createdAt: now,
      updatedAt: now,
      version,
      promptId,
      isCurrentVersion: true,
    } as Metadata);
  }

  // 将同一promptId的其他版本标记为非当前版本
  const idsToUpdate: string[] = [];
  for (const promptId of promptIdToUpdate) {
    const versions = allPrompts.metadatas
      .map((meta, index) => ({
        id: allPrompts.ids[index],
        metadata: meta as PromptMetadata,
      }))
      .filter((item) => item.metadata.promptId === promptId && item.metadata.isCurrentVersion);

    for (const version of versions) {
      idsToUpdate.push(version.id);
    }
  }

  // 批量更新其他版本为非当前版本
  for (const id of idsToUpdate) {
    const existing = await getPrompt(id);
    if (existing && existing.isCurrentVersion) {
      await updatePrompt(id, { isCurrentVersion: false });
    }
  }

  await collection.add({
    ids,
    documents,
    metadatas,
  } as AddOptions);
}

/**
 * 根据 ID 获取prompt
 */
export async function getPrompt(id: string): Promise<PromptMetadata | null> {
  const collection = await ensurePromptsCollection();
  const result = await collection.get({
    ids: [id],
    include: ["documents", "metadatas"],
  });

  if (result.ids.length === 0 || !result.metadatas || result.metadatas.length === 0) {
    return null;
  }

  const metadata = result.metadatas[0] as unknown as PromptMetadata;
  // 解析 JSON 字符串字段
  if (typeof metadata.tags === "string") {
    metadata.tags = JSON.parse(metadata.tags);
  }

  return metadata;
}

/**
 * 获取所有prompt
 */
export async function getAllPrompts(): Promise<GetResult> {
  const collection = await ensurePromptsCollection();
  const result = await collection.get({
    include: ["documents", "metadatas"],
  });

  // 解析 JSON 字符串字段
  const metadatas = (result.metadatas || []).map((meta: Metadata | null) => {
    if (!meta) return {};
    const m = { ...meta } as Record<string, unknown>;
    if (typeof m.tags === "string") {
      m.tags = JSON.parse(m.tags);
    }
    return m;
  });

  return {
    ids: [...result.ids],
    documents: result.documents ? result.documents.filter((d): d is string => d !== null) : [],
    metadatas,
  };
}

/**
 * 根据promptId获取所有版本
 */
export async function getPromptVersions(promptId: string): Promise<PromptVersion[]> {
  const allPrompts = await getAllPrompts();
  const versions = allPrompts.metadatas
    .map((meta, index) => ({
      id: allPrompts.ids[index],
      metadata: meta as PromptMetadata,
    }))
    .filter((item) => item.metadata.promptId === promptId)
    .sort((a, b) => b.metadata.version - a.metadata.version);

  return versions.map((v) => ({
    id: v.id,
    version: v.metadata.version,
    title: v.metadata.title,
    content: v.metadata.content,
    description: v.metadata.description,
    createdAt: v.metadata.createdAt,
    updatedAt: v.metadata.updatedAt,
    isCurrentVersion: v.metadata.isCurrentVersion || false,
    changeNotes: v.metadata.changeNotes || "",
  }));
}

/**
 * 获取当前版本（每个promptId只返回一个）
 */
export async function getCurrentPrompts(): Promise<GetResult> {
  const allPrompts = await getAllPrompts();
  const currentMap = new Map<string, { id: string; index: number; metadata: PromptMetadata }>();

  allPrompts.metadatas.forEach((meta, index) => {
    const promptMeta = meta as PromptMetadata;
    if (promptMeta.isCurrentVersion) {
      const existing = currentMap.get(promptMeta.promptId);
      if (!existing || promptMeta.version > existing.metadata.version) {
        currentMap.set(promptMeta.promptId, {
          id: allPrompts.ids[index],
          index,
          metadata: promptMeta,
        });
      }
    }
  });

  const currentIds: string[] = [];
  const currentDocuments: string[] = [];
  const currentMetadatas: Record<string, unknown>[] = [];

  currentMap.forEach((item) => {
    currentIds.push(item.id);
    currentDocuments.push(allPrompts.documents[item.index]);
    currentMetadatas.push(item.metadata as unknown as Record<string, unknown>);
  });

  return {
    ids: currentIds,
    documents: currentDocuments,
    metadatas: currentMetadatas,
  };
}

/**
 * 更新prompt
 */
export async function updatePrompt(
  id: string,
  input: UpdatePromptInput & { isCurrentVersion?: boolean }
): Promise<void> {
  const collection = await ensurePromptsCollection();
  const existing = await getPrompt(id);

  if (!existing) {
    throw new Error(`Prompt ${id} 不存在`);
  }

  // 如果设置为当前版本，需要将同一promptId的其他版本设置为false
  if (input.isCurrentVersion === true && existing.promptId) {
    const versions = await getPromptVersions(existing.promptId);
    for (const version of versions) {
      if (version.id !== id && version.isCurrentVersion) {
        await updatePrompt(version.id, { isCurrentVersion: false });
      }
    }
  }

  // 合并更新数据
  const updated: PromptMetadata = {
    ...existing,
    ...input,
    tags: input.tags || existing.tags,
    updatedAt: new Date().toISOString(),
    isCurrentVersion: input.isCurrentVersion !== undefined ? input.isCurrentVersion : existing.isCurrentVersion,
  };

  // 重新生成搜索文本
  const searchText = generatePromptSearchText({
    title: updated.title,
    content: updated.content,
    description: updated.description,
    category: updated.category,
    tags: updated.tags,
  });

  // 先删除旧记录
  await collection.delete({ ids: [id] });

  // 再添加更新后的记录
  await collection.add({
    ids: [id],
    documents: [searchText],
    metadatas: [
      {
        ...updated,
        tags: JSON.stringify(updated.tags || []),
      } as Metadata,
    ],
  } as AddOptions);
}

/**
 * 设置某个版本为当前版本
 */
export async function setCurrentVersion(promptId: string, versionId: string): Promise<void> {
  // 获取该prompt的所有版本
  const versions = await getPromptVersions(promptId);
  
  // 将所有版本标记为非当前版本
  for (const version of versions) {
    await updatePrompt(version.id, { isCurrentVersion: version.id === versionId });
  }
}

/**
 * 删除prompt（单个版本）
 */
export async function deletePrompt(id: string): Promise<void> {
  const collection = await ensurePromptsCollection();
  await collection.delete({ ids: [id] });
}

/**
 * 删除prompt的所有版本
 */
export async function deletePromptAllVersions(promptId: string): Promise<void> {
  const versions = await getPromptVersions(promptId);
  if (versions.length > 0) {
    const ids = versions.map((v) => v.id);
    await deletePrompts(ids);
  }
}

/**
 * 批量删除prompt
 */
export async function deletePrompts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const collection = await ensurePromptsCollection();
  await collection.delete({ ids });
}

/**
 * 搜索prompt
 */
export async function searchPrompts(options: QueryOptions): Promise<QueryResult> {
  const collection = await ensurePromptsCollection();
  const result = await collection.query({
    queryTexts: options.queryTexts,
    nResults: options.nResults || 10,
    include: options.include || ["documents", "metadatas", "distances"],
  });
  return {
    ids: result.ids.map(arr => arr.filter(id => id !== null) as string[]),
    documents: result.documents?.map(arr => arr.filter(d => d !== null) as string[]) || [],
    metadatas: result.metadatas?.map(arr => arr.filter(m => m !== null).map(m => m as Record<string, unknown>)) || [],
    distances: result.distances?.map(arr => arr.filter(d => d !== null) as number[]),
  };
}

/**
 * 获取prompt数量
 */
export async function getPromptsCount(): Promise<number> {
  const collection = await ensurePromptsCollection();
  return await collection.count();
}

// ==================== Agent Skills CRUD ====================

/**
 * 生成 Agent Skill 的搜索文本
 */
function generateAgentSkillSearchText(skill: {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
}): string {
  const parts = [
    skill.name,
    skill.description,
    skill.category,
    ...(skill.tags || []),
  ].filter(Boolean);
  return parts.join(" ");
}

/**
 * 创建 Agent Skills 集合（如果不存在）
 */
export async function ensureAgentSkillsCollection() {
  const client = getSeekDBClient();
  return await client.getOrCreateCollection({
    name: AGENT_SKILLS_COLLECTION_NAME,
  });
}

/**
 * 创建 Agent Skill（或新版本）
 */
export async function createAgentSkill(input: CreateAgentSkillInput): Promise<void> {
  const collection = await ensureAgentSkillsCollection();
  
  // 如果提供了skillId，说明是创建新版本
  let skillId = input.skillId;
  let version = 1;
  
  if (skillId) {
    // 获取该skill的所有版本，找到最大版本号
    const allSkills = await getAllAgentSkills();
    const versions = allSkills.metadatas
      .map((meta, index) => ({
        id: allSkills.ids[index],
        metadata: meta as AgentSkillMetadata,
      }))
      .filter((item) => item.metadata.skillId === skillId);
    
    if (versions.length > 0) {
      version = Math.max(...versions.map((v) => v.metadata.version)) + 1;
      // 将之前的版本标记为非当前版本
      for (const v of versions) {
        if (v.metadata.isCurrentVersion) {
          await updateAgentSkill(v.id, { isCurrentVersion: false });
        }
      }
    }
  } else {
    // 创建新的skill，生成唯一的skillId
    skillId = `skill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const searchText = generateAgentSkillSearchText({
    name: input.name,
    description: input.description,
    category: input.category,
    tags: input.tags,
  });

  const now = input.createdAt || new Date().toISOString();
  const metadata: AgentSkillMetadata = {
    name: input.name,
    description: input.description,
    category: input.category,
    template: input.template,
    parameters: input.parameters || {},
    examples: input.examples || [],
    tags: input.tags || [],
    createdAt: now,
    updatedAt: now,
    version,
    skillId,
    isCurrentVersion: true,
  };

  await collection.add({
    ids: [input.id],
    documents: [searchText],
    metadatas: [metadata as unknown as Metadata],
  } as AddOptions);
}

/**
 * 获取 Agent Skill
 */
export async function getAgentSkill(id: string): Promise<AgentSkillMetadata | null> {
  const collection = await ensureAgentSkillsCollection();
  const result = await collection.get({
    ids: [id],
    include: ["metadatas"],
  });

  if (!result.metadatas || result.metadatas.length === 0 || !result.metadatas[0]) {
    return null;
  }

  const metadata = { ...result.metadatas[0] } as Record<string, unknown>;
  
  // 解析 JSON 字符串字段
  if (typeof metadata.tags === "string") {
    metadata.tags = JSON.parse(metadata.tags);
  }
  if (typeof metadata.parameters === "string") {
    metadata.parameters = JSON.parse(metadata.parameters);
  }
  if (typeof metadata.examples === "string") {
    metadata.examples = JSON.parse(metadata.examples);
  }

  return metadata as unknown as AgentSkillMetadata;
}

/**
 * 获取所有 Agent Skills
 */
export async function getAllAgentSkills(): Promise<GetResult> {
  const collection = await ensureAgentSkillsCollection();
  const result = await collection.get({
    include: ["documents", "metadatas"],
  });

  // 解析 JSON 字符串字段
  const metadatas = (result.metadatas || []).map((meta: Metadata | null) => {
    if (!meta) return {};
    const m = { ...meta } as Record<string, unknown>;
    if (typeof m.tags === "string") {
      m.tags = JSON.parse(m.tags);
    }
    if (typeof m.parameters === "string") {
      m.parameters = JSON.parse(m.parameters);
    }
    if (typeof m.examples === "string") {
      m.examples = JSON.parse(m.examples);
    }
    return m;
  });

  return {
    ids: [...result.ids],
    documents: result.documents ? result.documents.filter((d): d is string => d !== null) : [],
    metadatas,
  };
}

/**
 * 根据skillId获取所有版本
 */
export async function getAgentSkillVersions(skillId: string): Promise<AgentSkillVersion[]> {
  const allSkills = await getAllAgentSkills();
  const versions = allSkills.metadatas
    .map((meta, index) => ({
      id: allSkills.ids[index],
      metadata: meta as AgentSkillMetadata,
    }))
    .filter((item) => item.metadata.skillId === skillId)
    .sort((a, b) => b.metadata.version - a.metadata.version)
    .map((v) => ({
      id: v.id,
      version: v.metadata.version,
      name: v.metadata.name,
      description: v.metadata.description,
      category: v.metadata.category,
      template: v.metadata.template,
      createdAt: v.metadata.createdAt,
      updatedAt: v.metadata.updatedAt,
      isCurrentVersion: v.metadata.isCurrentVersion || false,
    }));
  return versions;
}

/**
 * 获取当前版本（每个skillId只返回一个）
 */
export async function getCurrentAgentSkills(): Promise<GetResult> {
  const allSkills = await getAllAgentSkills();
  const currentMap = new Map<string, { id: string; index: number; metadata: AgentSkillMetadata }>();

  allSkills.metadatas.forEach((meta, index) => {
    const skillMeta = meta as AgentSkillMetadata;
    if (skillMeta.isCurrentVersion) {
      const existing = currentMap.get(skillMeta.skillId);
      if (!existing || skillMeta.version > existing.metadata.version) {
        currentMap.set(skillMeta.skillId, {
          id: allSkills.ids[index],
          index,
          metadata: skillMeta,
        });
      }
    }
  });

  const currentIds: string[] = [];
  const currentDocuments: string[] = [];
  const currentMetadatas: Record<string, unknown>[] = [];

  currentMap.forEach((item) => {
    currentIds.push(item.id);
    currentDocuments.push(allSkills.documents[item.index]);
    currentMetadatas.push(item.metadata as unknown as Record<string, unknown>);
  });

  return {
    ids: currentIds,
    documents: currentDocuments,
    metadatas: currentMetadatas,
  };
}

/**
 * 更新 Agent Skill
 */
export async function updateAgentSkill(
  id: string,
  input: UpdateAgentSkillInput & { isCurrentVersion?: boolean }
): Promise<void> {
  const collection = await ensureAgentSkillsCollection();
  const existing = await getAgentSkill(id);
  
  if (!existing) {
    throw new Error("Agent Skill not found");
  }

  const updated: AgentSkillMetadata = {
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
  };

  // 重新生成搜索文本
  const searchText = generateAgentSkillSearchText({
    name: updated.name,
    description: updated.description,
    category: updated.category,
    tags: updated.tags,
  });

  // 先删除旧记录
  await collection.delete({ ids: [id] });

  // 再添加更新后的记录
  await collection.add({
    ids: [id],
    documents: [searchText],
    metadatas: [
      {
        ...updated,
        tags: JSON.stringify(updated.tags || []),
        parameters: JSON.stringify(updated.parameters || {}),
        examples: JSON.stringify(updated.examples || []),
      } as Metadata,
    ],
  } as AddOptions);
}

/**
 * 设置某个版本为当前版本
 */
export async function setAgentSkillCurrentVersion(skillId: string, versionId: string): Promise<void> {
  // 获取该skill的所有版本
  const versions = await getAgentSkillVersions(skillId);
  
  // 将所有版本标记为非当前版本
  for (const version of versions) {
    await updateAgentSkill(version.id, { isCurrentVersion: version.id === versionId });
  }
}

/**
 * 删除 Agent Skill（单个版本）
 */
export async function deleteAgentSkill(id: string): Promise<void> {
  const collection = await ensureAgentSkillsCollection();
  await collection.delete({ ids: [id] });
}

/**
 * 删除 Agent Skill 的所有版本
 */
export async function deleteAgentSkillAllVersions(skillId: string): Promise<void> {
  const versions = await getAgentSkillVersions(skillId);
  if (versions.length > 0) {
    const ids = versions.map((v) => v.id);
    await deleteAgentSkills(ids);
  }
}

/**
 * 批量删除 Agent Skill
 */
export async function deleteAgentSkills(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const collection = await ensureAgentSkillsCollection();
  await collection.delete({ ids });
}

/**
 * 搜索 Agent Skills
 */
export async function searchAgentSkills(options: QueryOptions): Promise<QueryResult> {
  const collection = await ensureAgentSkillsCollection();
  const result = await collection.query({
    queryTexts: options.queryTexts,
    nResults: options.nResults || 10,
    include: options.include || ["documents", "metadatas", "distances"],
  });
  return {
    ids: result.ids.map(arr => arr.filter(id => id !== null) as string[]),
    documents: result.documents?.map(arr => arr.filter(d => d !== null) as string[]) || [],
    metadatas: result.metadatas?.map(arr => arr.filter(m => m !== null).map(m => m as Record<string, unknown>)) || [],
    distances: result.distances?.map(arr => arr.filter(d => d !== null) as number[]),
  };
}

/**
 * 获取 Agent Skills 数量
 */
export async function getAgentSkillsCount(): Promise<number> {
  const collection = await ensureAgentSkillsCollection();
  return await collection.count();
}

