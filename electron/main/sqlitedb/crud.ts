/**
 * SQLite CRUD 操作
 * 与 seekdb/crud.ts 导出完全相同的函数签名，IPC 层无需修改
 */
import { getDB, isVecAvailable } from "./db";
import { embed, vecToBuffer, EMBED_DIMENSION } from "./embedder";
import type {
  CreateSiteInput,
  UpdateSiteInput,
  SiteMetadata,
  CreateComponentInput,
  UpdateComponentInput,
  ComponentMetadata,
  CreatePromptInput,
  UpdatePromptInput,
  PromptMetadata,
  PromptVersion,
  CreateAgentSkillInput,
  UpdateAgentSkillInput,
  AgentSkillMetadata,
  AgentSkillVersion,
  SkillFileNode,
  CreateSubAgentInput,
  UpdateSubAgentInput,
  SubAgentMetadata,
  SubAgentVersion,
  CreateAgentTeamInput,
  UpdateAgentTeamInput,
  AgentTeamMetadata,
  AgentTeamVersion,
  TeammateDef,
  CreateLibraryInput,
  UpdateLibraryInput,
  LibraryItem,
} from "./types";
import { normalizeTagsForSave, resolveTagIdsToNames } from "./tags";
import { deletePackageDir } from "../skillPackages";

// ==================== 共用类型（与 seekdb/crud.ts 兼容）====================

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
  metadatas: Record<string, unknown>[];
}

// ==================== 工具函数 ====================

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function parseJson<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val !== "string") return val as T;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function toBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (typeof val === "string") return val === "true" || val === "1";
  return false;
}

/**
 * 生成文档全文（用于 embedding 和全文搜索降级）
 */
export function makeDocument(parts: (string | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * MiniLM-L6-v2 最大约 256 token；正文取 1200 字既覆盖 SKILL.md 主体，又避免把整份长文塞进 tokenizer。
 * 检索返回 snippet 取 500 字，够 UI 高亮命中片段。
 */
export const AGENT_SKILL_EMBEDDING_VERSION = 2;
const AGENT_SKILL_EMBED_TEMPLATE_CHARS = 1200;
const AGENT_SKILL_DOCUMENT_SNIPPET_CHARS = 500;

function clipText(text: string | undefined | null, max: number): string | undefined {
  if (!text) return undefined;
  return text.length <= max ? text : text.slice(0, max);
}

function makeAgentSkillEmbedDoc(input: {
  name?: string | null;
  description?: string | null;
  category?: string | null;
  tagNames?: string[];
  template?: string | null;
}): string {
  return makeDocument([
    input.name,
    input.description,
    input.category,
    ...(input.tagNames || []),
    clipText(input.template, AGENT_SKILL_EMBED_TEMPLATE_CHARS),
  ]);
}

function makeAgentSkillResultDoc(row: {
  name?: unknown;
  description?: unknown;
  template?: unknown;
}): string {
  return makeDocument([
    row.name as string,
    row.description as string,
    clipText(row.template as string, AGENT_SKILL_DOCUMENT_SNIPPET_CHARS),
  ]);
}

/**
 * 存储 embedding（写入时异步生成，失败不阻断主流程）
 */
export async function saveEmbedding(
  id: string,
  collection: string,
  text: string
): Promise<void> {
  try {
    const vec = await embed(text);
    const buf = vecToBuffer(vec);
    const db = getDB();
    db.prepare(
      "INSERT OR REPLACE INTO embeddings (id, collection, vec) VALUES (?, ?, ?)"
    ).run(id, collection, buf);
  } catch (err) {
    console.warn(`[CRUD] Failed to save embedding for ${collection}/${id}:`, err);
  }
}

/**
 * 删除 embedding
 */
function deleteEmbedding(id: string, collection: string): void {
  try {
    getDB()
      .prepare("DELETE FROM embeddings WHERE id = ? AND collection = ?")
      .run(id, collection);
  } catch {
    // 忽略
  }
}

/**
 * 向量相似度搜索（sqlite-vec），降级为全文 LIKE 搜索
 */
async function vecSearch(
  collection: string,
  queryText: string,
  nResults: number
): Promise<Array<{ id: string; distance: number }>> {
  const db = getDB();

  if (isVecAvailable()) {
    try {
      const queryVec = await embed(queryText);
      const queryBuf = vecToBuffer(queryVec);
      // sqlite-vec KNN 查询
      const rows = db
        .prepare(
          `SELECT id, vec_distance_cosine(vec, ?) AS distance
           FROM embeddings
           WHERE collection = ?
           ORDER BY distance ASC
           LIMIT ?`
        )
        .all(queryBuf, collection, nResults) as Array<{
        id: string;
        distance: number;
      }>;
      return rows;
    } catch (err) {
      console.warn("[CRUD] Vector search failed, falling back to full-text:", err);
    }
  }

  // 降级：从各集合表全量拉取 id，返回默认距离 0
  const tableMap: Record<string, string> = {
    prompts: "prompts",
    agent_skills: "agent_skills",
    sub_agents: "sub_agents",
    agent_teams: "agent_teams",
    sites: "sites",
    components: "components",
  };
  const table = tableMap[collection];
  if (!table) return [];

  // 简单全文 LIKE 搜索
  const keyword = `%${queryText.replace(/%/g, "\\%")}%`;
  let rows: Array<{ id: string }> = [];
  try {
    if (collection === "prompts") {
      rows = db
        .prepare(
          `SELECT id FROM prompts
           WHERE (title LIKE ? OR content LIKE ? OR description LIKE ? OR category LIKE ?)
             AND is_current_version = 1
           LIMIT ?`
        )
        .all(keyword, keyword, keyword, keyword, nResults) as Array<{ id: string }>;
    } else if (collection === "agent_skills") {
      rows = db
        .prepare(
          `SELECT id FROM agent_skills
           WHERE (name LIKE ? OR description LIKE ? OR category LIKE ? OR template LIKE ?)
             AND is_current_version = 1
           LIMIT ?`
        )
        .all(keyword, keyword, keyword, keyword, nResults) as Array<{ id: string }>;
    } else if (collection === "sub_agents") {
      rows = db
        .prepare(
          `SELECT id FROM sub_agents
           WHERE (name LIKE ? OR description LIKE ? OR instructions LIKE ?)
             AND is_current_version = 1
           LIMIT ?`
        )
        .all(keyword, keyword, keyword, nResults) as Array<{ id: string }>;
    } else if (collection === "agent_teams") {
      rows = db
        .prepare(
          `SELECT id FROM agent_teams
           WHERE (name LIKE ? OR description LIKE ? OR lead_instructions LIKE ?)
             AND is_current_version = 1
           LIMIT ?`
        )
        .all(keyword, keyword, keyword, nResults) as Array<{ id: string }>;
    } else if (collection === "sites") {
      rows = db
        .prepare(
          `SELECT id FROM sites WHERE name LIKE ? OR description LIKE ? LIMIT ?`
        )
        .all(keyword, keyword, nResults) as Array<{ id: string }>;
    } else if (collection === "components") {
      rows = db
        .prepare(
          `SELECT id FROM components WHERE name LIKE ? OR description LIKE ? LIMIT ?`
        )
        .all(keyword, keyword, nResults) as Array<{ id: string }>;
    }
  } catch {
    // 忽略
  }
  return rows.map((r) => ({ id: r.id, distance: 0 }));
}

// ==================== Sites ====================

function rowToSiteMetadata(row: Record<string, unknown>): SiteMetadata {
  return {
    name: row.name as string,
    description: row.description as string,
    url: row.url as string,
    previewUrl: row.preview_url as string,
    thumbnail: row.thumbnail as string,
    category: parseJson<string[]>(row.category, []),
    tags: parseJson<string[]>(row.tags, []),
    framework: row.framework as string,
    addedAt: row.added_at as string,
    featured: toBool(row.featured),
    status: row.status as string,
  };
}

export async function createSite(input: CreateSiteInput): Promise<void> {
  const db = getDB();
  const now = input.addedAt || new Date().toISOString();
  db.prepare(
    `INSERT INTO sites (id, name, description, url, preview_url, thumbnail, category, tags, framework, added_at, featured, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.name,
    input.description,
    input.url,
    input.previewUrl || "",
    input.thumbnail || "",
    JSON.stringify(input.category),
    JSON.stringify(input.tags),
    input.framework || "",
    now,
    input.featured ? 1 : 0,
    input.status || "approved"
  );
  const doc = makeDocument([input.name, input.description, ...input.category, ...input.tags, input.framework]);
  saveEmbedding(input.id, "sites", doc);
}

export async function createSites(inputs: CreateSiteInput[]): Promise<void> {
  for (const input of inputs) {
    await createSite(input);
  }
}

export async function getSite(id: string): Promise<SiteMetadata | null> {
  const row = getDB()
    .prepare("SELECT * FROM sites WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToSiteMetadata(row) : null;
}

export async function getAllSites(): Promise<GetResult> {
  const rows = getDB()
    .prepare("SELECT * FROM sites")
    .all() as Record<string, unknown>[];
  return {
    ids: rows.map((r) => r.id as string),
    documents: rows.map((r) =>
      makeDocument([r.name as string, r.description as string])
    ),
    metadatas: rows.map(rowToSiteMetadata) as unknown as Record<string, unknown>[],
  };
}

export async function updateSite(id: string, input: UpdateSiteInput): Promise<void> {
  const existing = await getSite(id);
  if (!existing) throw new Error(`Site ${id} 不存在`);
  const updated = { ...existing, ...input };
  getDB().prepare(
    `UPDATE sites SET name=?, description=?, url=?, preview_url=?, thumbnail=?, category=?, tags=?, framework=?, featured=?, status=? WHERE id=?`
  ).run(
    updated.name,
    updated.description,
    updated.url,
    updated.previewUrl || "",
    updated.thumbnail || "",
    JSON.stringify(updated.category),
    JSON.stringify(updated.tags),
    updated.framework || "",
    updated.featured ? 1 : 0,
    updated.status || "approved",
    id
  );
  const doc = makeDocument([updated.name, updated.description, ...updated.category, ...updated.tags, updated.framework]);
  saveEmbedding(id, "sites", doc);
}

export async function deleteSite(id: string): Promise<void> {
  getDB().prepare("DELETE FROM sites WHERE id = ?").run(id);
  deleteEmbedding(id, "sites");
}

export async function deleteSites(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  getDB().prepare(`DELETE FROM sites WHERE id IN (${placeholders})`).run(...ids);
  ids.forEach((id) => deleteEmbedding(id, "sites"));
}

export async function searchSites(options: QueryOptions): Promise<QueryResult> {
  const nResults = options.nResults || 10;
  const queryText = options.queryTexts[0] || "";
  const hits = await vecSearch("sites", queryText, nResults);
  if (!hits.length) return { ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] };

  const ids = hits.map((h) => h.id);
  const rows = getDB()
    .prepare(`SELECT * FROM sites WHERE id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as Record<string, unknown>[];

  const rowMap = new Map(rows.map((r) => [r.id as string, r]));
  const orderedRows = ids.map((id) => rowMap.get(id)).filter(Boolean) as Record<string, unknown>[];

  return {
    ids: [orderedRows.map((r) => r.id as string)],
    documents: [orderedRows.map((r) => makeDocument([r.name as string, r.description as string]))],
    metadatas: [orderedRows.map(rowToSiteMetadata) as unknown as Record<string, unknown>[]],
    distances: [hits.map((h) => h.distance)],
  };
}

export async function getSitesCount(): Promise<number> {
  const row = getDB().prepare("SELECT COUNT(*) as cnt FROM sites").get() as { cnt: number };
  return row.cnt;
}

// ==================== Components ====================

function rowToComponentMetadata(row: Record<string, unknown>): ComponentMetadata {
  return {
    siteId: row.site_id as string,
    siteName: row.site_name as string,
    name: row.name as string,
    description: row.description as string,
    category: row.category as string,
    codeExample: row.code_example as string,
    docUrl: row.doc_url as string,
    tags: parseJson<string[]>(row.tags, []),
    createdAt: row.created_at as string,
  };
}

export async function createComponent(input: CreateComponentInput): Promise<void> {
  const db = getDB();
  const now = input.createdAt || new Date().toISOString();
  db.prepare(
    `INSERT INTO components (id, site_id, site_name, name, description, category, code_example, doc_url, tags, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.siteId,
    input.siteName,
    input.name,
    input.description,
    input.category || "",
    input.codeExample || "",
    input.docUrl,
    JSON.stringify(input.tags || []),
    now
  );
  const doc = makeDocument([input.name, input.description, input.category, input.siteName]);
  saveEmbedding(input.id, "components", doc);
}

export async function createComponents(inputs: CreateComponentInput[]): Promise<void> {
  for (const input of inputs) {
    await createComponent(input);
  }
}

export async function getComponent(id: string): Promise<ComponentMetadata | null> {
  const row = getDB()
    .prepare("SELECT * FROM components WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToComponentMetadata(row) : null;
}

export async function getAllComponents(): Promise<GetResult> {
  const rows = getDB().prepare("SELECT * FROM components").all() as Record<string, unknown>[];
  return {
    ids: rows.map((r) => r.id as string),
    documents: rows.map((r) => makeDocument([r.name as string, r.description as string])),
    metadatas: rows.map(rowToComponentMetadata) as unknown as Record<string, unknown>[],
  };
}

export async function getComponentsBySiteId(siteId: string): Promise<GetResult> {
  const rows = getDB()
    .prepare("SELECT * FROM components WHERE site_id = ?")
    .all(siteId) as Record<string, unknown>[];
  return {
    ids: rows.map((r) => r.id as string),
    documents: rows.map((r) => makeDocument([r.name as string, r.description as string])),
    metadatas: rows.map(rowToComponentMetadata) as unknown as Record<string, unknown>[],
  };
}

export async function updateComponent(id: string, input: UpdateComponentInput): Promise<void> {
  const existing = await getComponent(id);
  if (!existing) throw new Error(`Component ${id} 不存在`);
  const updated = { ...existing, ...input };
  getDB().prepare(
    `UPDATE components SET name=?, description=?, category=?, code_example=?, doc_url=?, tags=? WHERE id=?`
  ).run(
    updated.name,
    updated.description,
    updated.category || "",
    updated.codeExample || "",
    updated.docUrl,
    JSON.stringify(updated.tags || []),
    id
  );
  const doc = makeDocument([updated.name, updated.description, updated.category, updated.siteName]);
  saveEmbedding(id, "components", doc);
}

export async function deleteComponent(id: string): Promise<void> {
  getDB().prepare("DELETE FROM components WHERE id = ?").run(id);
  deleteEmbedding(id, "components");
}

export async function deleteComponents(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  getDB().prepare(`DELETE FROM components WHERE id IN (${placeholders})`).run(...ids);
  ids.forEach((id) => deleteEmbedding(id, "components"));
}

export async function deleteComponentsBySiteId(siteId: string): Promise<void> {
  const rows = getDB()
    .prepare("SELECT id FROM components WHERE site_id = ?")
    .all(siteId) as Array<{ id: string }>;
  const ids = rows.map((r) => r.id);
  await deleteComponents(ids);
}

export async function searchComponents(options: QueryOptions): Promise<QueryResult> {
  const nResults = options.nResults || 10;
  const queryText = options.queryTexts[0] || "";
  const hits = await vecSearch("components", queryText, nResults);
  if (!hits.length) return { ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] };

  const ids = hits.map((h) => h.id);
  const rows = getDB()
    .prepare(`SELECT * FROM components WHERE id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as Record<string, unknown>[];

  const rowMap = new Map(rows.map((r) => [r.id as string, r]));
  const orderedRows = ids.map((id) => rowMap.get(id)).filter(Boolean) as Record<string, unknown>[];

  return {
    ids: [orderedRows.map((r) => r.id as string)],
    documents: [orderedRows.map((r) => makeDocument([r.name as string, r.description as string]))],
    metadatas: [orderedRows.map(rowToComponentMetadata) as unknown as Record<string, unknown>[]],
    distances: [hits.map((h) => h.distance)],
  };
}

export async function getComponentsCount(): Promise<number> {
  const row = getDB().prepare("SELECT COUNT(*) as cnt FROM components").get() as { cnt: number };
  return row.cnt;
}

// ==================== Prompts ====================

function rowToPromptMetadata(row: Record<string, unknown>): PromptMetadata {
  const tagIds = parseJson<string[]>(row.tags, []);
  return {
    title: row.title as string,
    content: row.content as string,
    description: row.description as string,
    category: row.category as string,
    tags: resolveTagIdsToNames(tagIds),
    tagIds,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    version: row.version as number,
    promptId: row.prompt_id as string,
    isCurrentVersion: toBool(row.is_current_version),
    changeNotes: row.change_notes as string,
    cloudId: (row.cloud_id as string) || undefined,
    libraryId: (row.library_id as string) || undefined,
    isStarred: toBool(row.is_starred),
    uses: (row.uses as number) || 0,
    lastUsedAt: (row.last_used_at as string) || undefined,
    accent: (row.accent as string) || '#f59e0b',
    isPublic: toBool(row.is_public),
    useWhen: parseJson<string[]>(row.use_when, []),
    guidance: parseJson<string[]>(row.guidance, []),
    pitfalls: parseJson<string[]>(row.pitfalls, []),
  };
}

export function setPromptCloudId(id: string, cloudId: string): void {
  getDB()
    .prepare("UPDATE prompts SET cloud_id = ? WHERE id = ?")
    .run(cloudId, id);
}

export async function createPrompt(input: CreatePromptInput): Promise<void> {
  const db = getDB();
  let promptId = input.promptId;
  let version = 1;

  if (promptId) {
    // 创建新版本：找最大版本号
    const maxRow = db
      .prepare("SELECT MAX(version) as max_v FROM prompts WHERE prompt_id = ?")
      .get(promptId) as { max_v: number | null };
    if (maxRow.max_v !== null) {
      version = maxRow.max_v + 1;
      // 将旧当前版本标记为 false（事务内）
      db.prepare(
        "UPDATE prompts SET is_current_version = 0 WHERE prompt_id = ? AND is_current_version = 1"
      ).run(promptId);
    }
  } else {
    promptId = genId("prompt");
  }

  const now = input.createdAt || new Date().toISOString();
  const libraryId = input.libraryId ?? null;
  const tagIds = normalizeTagsForSave(input.tags);
  db.prepare(
    `INSERT INTO prompts (id, prompt_id, title, content, description, category, tags, change_notes, version, is_current_version, created_at, updated_at, library_id, accent, use_when, guidance, pitfalls)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    promptId,
    input.title,
    input.content,
    input.description || "",
    input.category || "",
    JSON.stringify(tagIds),
    input.changeNotes || "",
    version,
    now,
    now,
    libraryId,
    input.accent || '#f59e0b',
    JSON.stringify(input.useWhen ?? []),
    JSON.stringify(input.guidance ?? []),
    JSON.stringify(input.pitfalls ?? [])
  );

  const doc = makeDocument([
    input.title,
    input.content,
    input.description,
    input.category,
    ...resolveTagIdsToNames(tagIds),
    ...(input.useWhen ?? []),
    ...(input.guidance ?? []),
  ]);
  saveEmbedding(input.id, "prompts", doc);

  // 新版本：同组所有版本共享 library_id
  if (input.promptId && input.libraryId !== undefined) {
    db.prepare("UPDATE prompts SET library_id = ? WHERE prompt_id = ?").run(input.libraryId, promptId);
  }
}

export async function createPrompts(inputs: CreatePromptInput[]): Promise<void> {
  // 使用事务批量插入
  const db = getDB();
  const insertMany = db.transaction(async () => {
    for (const input of inputs) {
      await createPrompt(input);
    }
  });
  await insertMany();
}

export async function getPrompt(id: string): Promise<PromptMetadata | null> {
  const row = getDB()
    .prepare("SELECT * FROM prompts WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToPromptMetadata(row) : null;
}

export async function getAllPrompts(): Promise<GetResult> {
  const rows = getDB().prepare("SELECT * FROM prompts ORDER BY prompt_id, version").all() as Record<string, unknown>[];
  return {
    ids: rows.map((r) => r.id as string),
    documents: rows.map((r) => makeDocument([r.title as string, r.content as string])),
    metadatas: rows.map(rowToPromptMetadata) as unknown as Record<string, unknown>[],
  };
}

export async function getCurrentPrompts(): Promise<GetResult> {
  const rows = getDB()
    .prepare("SELECT * FROM prompts WHERE is_current_version = 1 ORDER BY updated_at DESC")
    .all() as Record<string, unknown>[];
  return {
    ids: rows.map((r) => r.id as string),
    documents: rows.map((r) => makeDocument([r.title as string, r.content as string])),
    metadatas: rows.map(rowToPromptMetadata) as unknown as Record<string, unknown>[],
  };
}

export async function getPromptVersions(promptId: string): Promise<PromptVersion[]> {
  const rows = getDB()
    .prepare("SELECT * FROM prompts WHERE prompt_id = ? ORDER BY version DESC")
    .all(promptId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    version: r.version as number,
    title: r.title as string,
    content: r.content as string,
    description: r.description as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    isCurrentVersion: toBool(r.is_current_version),
    changeNotes: r.change_notes as string,
    useWhen: parseJson<string[]>(r.use_when, []),
    guidance: parseJson<string[]>(r.guidance, []),
    pitfalls: parseJson<string[]>(r.pitfalls, []),
  }));
}

export async function updatePrompt(
  id: string,
  input: UpdatePromptInput & { isCurrentVersion?: boolean }
): Promise<void> {
  const db = getDB();
  const existing = await getPrompt(id);
  if (!existing) throw new Error(`Prompt ${id} 不存在`);

  // 如果设置为当前版本，先把同组其他版本设为 false
  if (input.isCurrentVersion === true) {
    db.prepare(
      "UPDATE prompts SET is_current_version = 0 WHERE prompt_id = ? AND is_current_version = 1"
    ).run(existing.promptId);
  }

  const nextLibraryId =
    input.libraryId !== undefined ? input.libraryId : (existing.libraryId ?? null);

  const nextTagIds =
    input.tags !== undefined
      ? normalizeTagsForSave(input.tags)
      : (existing.tagIds ?? []);

  const updated = {
    title: input.title ?? existing.title,
    content: input.content ?? existing.content,
    description: input.description ?? existing.description ?? "",
    category: input.category ?? existing.category ?? "",
    tags: JSON.stringify(nextTagIds),
    isCurrentVersion: input.isCurrentVersion !== undefined ? (input.isCurrentVersion ? 1 : 0) : (existing.isCurrentVersion ? 1 : 0),
    updatedAt: new Date().toISOString(),
    libraryId: nextLibraryId,
    isStarred: input.isStarred !== undefined ? (input.isStarred ? 1 : 0) : (existing.isStarred ? 1 : 0),
    accent: input.accent ?? existing.accent ?? '#f59e0b',
    isPublic: input.isPublic !== undefined ? (input.isPublic ? 1 : 0) : (existing.isPublic ? 1 : 0),
    useWhen: JSON.stringify(input.useWhen !== undefined ? input.useWhen : (existing.useWhen ?? [])),
    guidance: JSON.stringify(input.guidance !== undefined ? input.guidance : (existing.guidance ?? [])),
    pitfalls: JSON.stringify(input.pitfalls !== undefined ? input.pitfalls : (existing.pitfalls ?? [])),
  };

  db.prepare(
    `UPDATE prompts SET title=?, content=?, description=?, category=?, tags=?, is_current_version=?, updated_at=?, library_id=?, is_starred=?, accent=?, is_public=?, use_when=?, guidance=?, pitfalls=? WHERE id=?`
  ).run(
    updated.title,
    updated.content,
    updated.description,
    updated.category,
    updated.tags,
    updated.isCurrentVersion,
    updated.updatedAt,
    updated.libraryId,
    updated.isStarred,
    updated.accent,
    updated.isPublic,
    updated.useWhen,
    updated.guidance,
    updated.pitfalls,
    id
  );

  const doc = makeDocument([
    updated.title,
    updated.content,
    updated.description,
    updated.category,
    ...resolveTagIdsToNames(nextTagIds),
    ...(input.useWhen ?? existing.useWhen ?? []),
    ...(input.guidance ?? existing.guidance ?? []),
  ]);
  saveEmbedding(id, "prompts", doc);

  if (input.libraryId !== undefined) {
    db.prepare("UPDATE prompts SET library_id = ? WHERE prompt_id = ?").run(nextLibraryId, existing.promptId);
  }
}

export async function togglePromptStar(id: string): Promise<boolean> {
  const db = getDB();
  const row = db.prepare("SELECT is_starred FROM prompts WHERE id = ?").get(id) as { is_starred: number } | undefined;
  if (!row) throw new Error(`Prompt ${id} not found`);
  const newVal = row.is_starred ? 0 : 1;
  db.prepare("UPDATE prompts SET is_starred = ? WHERE id = ?").run(newVal, id);
  return newVal === 1;
}

export async function incrementPromptUses(id: string): Promise<void> {
  getDB().prepare("UPDATE prompts SET uses = uses + 1, last_used_at = ? WHERE id = ?").run(new Date().toISOString(), id);
}

export async function setCurrentVersion(promptId: string, versionId: string): Promise<void> {
  const db = getDB();
  db.prepare("UPDATE prompts SET is_current_version = 0 WHERE prompt_id = ?").run(promptId);
  db.prepare("UPDATE prompts SET is_current_version = 1 WHERE id = ?").run(versionId);
}

export async function deletePrompt(id: string): Promise<void> {
  getDB().prepare("DELETE FROM prompts WHERE id = ?").run(id);
  deleteEmbedding(id, "prompts");
}

export async function deletePromptAllVersions(promptId: string): Promise<void> {
  const rows = getDB()
    .prepare("SELECT id FROM prompts WHERE prompt_id = ?")
    .all(promptId) as Array<{ id: string }>;
  const ids = rows.map((r) => r.id);
  await deletePrompts(ids);
}

export async function deletePrompts(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  getDB().prepare(`DELETE FROM prompts WHERE id IN (${placeholders})`).run(...ids);
  ids.forEach((id) => deleteEmbedding(id, "prompts"));
}

export async function searchPrompts(options: QueryOptions): Promise<QueryResult> {
  const nResults = options.nResults || 10;
  const queryText = options.queryTexts[0] || "";
  const hits = await vecSearch("prompts", queryText, nResults);
  if (!hits.length) return { ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] };

  const ids = hits.map((h) => h.id);
  const rows = getDB()
    .prepare(`SELECT * FROM prompts WHERE id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as Record<string, unknown>[];

  const rowMap = new Map(rows.map((r) => [r.id as string, r]));
  const orderedRows = ids.map((id) => rowMap.get(id)).filter(Boolean) as Record<string, unknown>[];

  return {
    ids: [orderedRows.map((r) => r.id as string)],
    documents: [orderedRows.map((r) => makeDocument([r.title as string, r.content as string]))],
    metadatas: [orderedRows.map(rowToPromptMetadata) as unknown as Record<string, unknown>[]],
    distances: [hits.map((h) => h.distance)],
  };
}

export async function getPromptsCount(): Promise<number> {
  const row = getDB().prepare("SELECT COUNT(*) as cnt FROM prompts").get() as { cnt: number };
  return row.cnt;
}

// ==================== Agent Skills ====================

function rowToAgentSkillMetadata(row: Record<string, unknown>): AgentSkillMetadata {
  const tagIds = parseJson<string[]>(row.tags, []);
  return {
    name: row.name as string,
    description: row.description as string,
    category: row.category as string,
    template: row.template as string,
    parameters: parseJson<Record<string, unknown>>(row.parameters, {}),
    examples: parseJson<string[]>(row.examples, []),
    tags: resolveTagIdsToNames(tagIds),
    tagIds,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    version: row.version as number,
    skillId: row.skill_id as string,
    isCurrentVersion: toBool(row.is_current_version),
    libraryId: (row.library_id as string) || undefined,
    isStarred: toBool(row.is_starred),
    uses: (row.uses as number) || 0,
    lastUsedAt: (row.last_used_at as string) || undefined,
    accent: (row.accent as string) || '#6ee7f7',
    isPublic: toBool(row.is_public),
    platforms: parseJson<string[]>(row.platforms, []),
    isActive: row.is_active === undefined || row.is_active === null ? true : toBool(row.is_active),
    versionLabel: (row.version_label as string) || 'v1.0',
    cloudId: (row.cloud_id as string) || null,
    sourcePath: (row.source_path as string) || null,
    packageDir: (row.package_dir as string) || null,
    fileTree: parseJson<SkillFileNode[]>(row.file_tree, []),
    fileCount: (row.file_count as number) || 0,
    packageSize: (row.package_size as number) || 0,
    sourceType: (row.source_type as string) || "",
    sourceRef: (row.source_ref as string) || "",
    sourceSkill: (row.source_skill as string) || "",
    sourceCommit: (row.source_commit as string) || "",
  };
}

export async function createAgentSkill(input: CreateAgentSkillInput): Promise<void> {
  const db = getDB();
  let skillId = input.skillId;
  let version = 1;

  if (skillId) {
    const maxRow = db
      .prepare("SELECT MAX(version) as max_v FROM agent_skills WHERE skill_id = ?")
      .get(skillId) as { max_v: number | null };
    if (maxRow.max_v !== null) {
      version = maxRow.max_v + 1;
      db.prepare(
        "UPDATE agent_skills SET is_current_version = 0 WHERE skill_id = ? AND is_current_version = 1"
      ).run(skillId);
    }
  } else {
    skillId = genId("skill");
  }

  const now = input.createdAt || new Date().toISOString();
  const skillLibraryId = input.libraryId ?? null;
  const tagIds = normalizeTagsForSave(input.tags);
  // 技能包属于整个 skill_id 组，新建版本时继承上一版本的包索引
  const inheritedPackage = input.skillId
    ? (db
        .prepare(
          "SELECT package_dir, file_tree, file_count, package_size FROM agent_skills WHERE skill_id = ? ORDER BY version DESC LIMIT 1"
        )
        .get(skillId) as
        | { package_dir: string | null; file_tree: string; file_count: number; package_size: number }
        | undefined)
    : undefined;

  db.prepare(
    `INSERT INTO agent_skills (id, skill_id, name, description, category, template, parameters, examples, tags, version, is_current_version, created_at, updated_at, library_id, accent, platforms, is_active, version_label, is_public, source_path, package_dir, file_tree, file_count, package_size, source_type, source_ref, source_skill, source_commit)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    skillId,
    input.name,
    input.description,
    input.category || "",
    input.template,
    JSON.stringify(input.parameters || {}),
    JSON.stringify(input.examples || []),
    JSON.stringify(tagIds),
    version,
    now,
    now,
    skillLibraryId,
    input.accent || '#6ee7f7',
    JSON.stringify(input.platforms || []),
    input.isActive === false ? 0 : 1,
    input.versionLabel || 'v1.0',
    input.isPublic ? 1 : 0,
    input.sourcePath ?? null,
    inheritedPackage?.package_dir ?? null,
    inheritedPackage?.file_tree ?? '[]',
    inheritedPackage?.file_count ?? 0,
    inheritedPackage?.package_size ?? 0,
    input.sourceType || "",
    input.sourceRef || "",
    input.sourceSkill || "",
    input.sourceCommit || "",
  );

  const doc = makeAgentSkillEmbedDoc({
    name: input.name,
    description: input.description,
    category: input.category,
    tagNames: resolveTagIdsToNames(tagIds),
    template: input.template,
  });
  saveEmbedding(input.id, "agent_skills", doc);

  if (input.skillId && input.libraryId !== undefined) {
    db.prepare("UPDATE agent_skills SET library_id = ? WHERE skill_id = ?").run(input.libraryId, skillId);
  }
}

export async function getAgentSkill(id: string): Promise<AgentSkillMetadata | null> {
  const row = getDB()
    .prepare("SELECT * FROM agent_skills WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToAgentSkillMetadata(row) : null;
}

export async function getAllAgentSkills(): Promise<GetResult> {
  const rows = getDB()
    .prepare("SELECT * FROM agent_skills ORDER BY skill_id, version")
    .all() as Record<string, unknown>[];
  return {
    ids: rows.map((r) => r.id as string),
    documents: rows.map((r) => makeAgentSkillResultDoc(r)),
    metadatas: rows.map(rowToAgentSkillMetadata) as unknown as Record<string, unknown>[],
  };
}

export async function getCurrentAgentSkills(): Promise<GetResult> {
  const rows = getDB()
    .prepare("SELECT * FROM agent_skills WHERE is_current_version = 1 ORDER BY updated_at DESC")
    .all() as Record<string, unknown>[];
  return {
    ids: rows.map((r) => r.id as string),
    documents: rows.map((r) => makeAgentSkillResultDoc(r)),
    metadatas: rows.map(rowToAgentSkillMetadata) as unknown as Record<string, unknown>[],
  };
}

export async function getAgentSkillVersions(skillId: string): Promise<AgentSkillVersion[]> {
  const rows = getDB()
    .prepare("SELECT * FROM agent_skills WHERE skill_id = ? ORDER BY version DESC")
    .all(skillId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    version: r.version as number,
    name: r.name as string,
    description: r.description as string,
    category: r.category as string,
    template: r.template as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    isCurrentVersion: toBool(r.is_current_version),
  }));
}

export async function updateAgentSkill(
  id: string,
  input: UpdateAgentSkillInput & { isCurrentVersion?: boolean }
): Promise<void> {
  const db = getDB();
  const existing = await getAgentSkill(id);
  if (!existing) throw new Error("Agent Skill not found");

  if (input.isCurrentVersion === true) {
    db.prepare(
      "UPDATE agent_skills SET is_current_version = 0 WHERE skill_id = ? AND is_current_version = 1"
    ).run(existing.skillId);
  }

  const nextSkillLibraryId =
    input.libraryId !== undefined ? input.libraryId : (existing.libraryId ?? null);

  const nextSkillTagIds =
    input.tags !== undefined
      ? normalizeTagsForSave(input.tags)
      : (existing.tagIds ?? []);

  const updated = {
    name: input.name ?? existing.name,
    description: input.description ?? existing.description,
    category: input.category ?? existing.category,
    template: input.template ?? existing.template,
    parameters: JSON.stringify(input.parameters ?? existing.parameters ?? {}),
    examples: JSON.stringify(input.examples ?? existing.examples ?? []),
    tags: JSON.stringify(nextSkillTagIds),
    isCurrentVersion: input.isCurrentVersion !== undefined ? (input.isCurrentVersion ? 1 : 0) : (existing.isCurrentVersion ? 1 : 0),
    updatedAt: new Date().toISOString(),
    libraryId: nextSkillLibraryId,
    isStarred: input.isStarred !== undefined ? (input.isStarred ? 1 : 0) : (existing.isStarred ? 1 : 0),
    accent: input.accent ?? existing.accent ?? '#6ee7f7',
    isPublic: input.isPublic !== undefined ? (input.isPublic ? 1 : 0) : (existing.isPublic ? 1 : 0),
    platforms: JSON.stringify(input.platforms ?? existing.platforms ?? []),
    isActive: input.isActive !== undefined ? (input.isActive ? 1 : 0) : (existing.isActive === false ? 0 : 1),
    versionLabel: input.versionLabel ?? existing.versionLabel ?? 'v1.0',
  };

  db.prepare(
    `UPDATE agent_skills SET name=?, description=?, category=?, template=?, parameters=?, examples=?, tags=?, is_current_version=?, updated_at=?, library_id=?, is_starred=?, accent=?, is_public=?, platforms=?, is_active=?, version_label=? WHERE id=?`
  ).run(
    updated.name, updated.description, updated.category, updated.template,
    updated.parameters, updated.examples, updated.tags,
    updated.isCurrentVersion, updated.updatedAt, updated.libraryId,
    updated.isStarred, updated.accent, updated.isPublic,
    updated.platforms, updated.isActive, updated.versionLabel, id
  );

  const doc = makeAgentSkillEmbedDoc({
    name: updated.name,
    description: updated.description,
    category: updated.category,
    tagNames: resolveTagIdsToNames(nextSkillTagIds),
    template: updated.template,
  });
  saveEmbedding(id, "agent_skills", doc);

  if (input.libraryId !== undefined) {
    db.prepare("UPDATE agent_skills SET library_id = ? WHERE skill_id = ?").run(nextSkillLibraryId, existing.skillId);
  }
}

/**
 * 写入技能包索引。包属于整个 skill_id 组（而非单个版本），因此按 skill_id 整组更新。
 * 与 library_id 的处理方式一致。
 */
export function setAgentSkillPackageIndex(
  skillId: string,
  index: {
    packageDir: string | null;
    fileTree: SkillFileNode[];
    fileCount: number;
    packageSize: number;
  }
): void {
  getDB()
    .prepare(
      "UPDATE agent_skills SET package_dir = ?, file_tree = ?, file_count = ?, package_size = ? WHERE skill_id = ?"
    )
    .run(
      index.packageDir,
      JSON.stringify(index.fileTree),
      index.fileCount,
      index.packageSize,
      skillId
    );
}

/**
 * 按 skillId 取当前版本（技能包相关操作以 skill_id 为单位，需要先定位当前版本行）
 * 返回值额外带上行 id，便于紧接着调用 updateAgentSkill
 */
export function findCurrentAgentSkillByName(
  name: string
): (AgentSkillMetadata & { id: string }) | null {
  const row = getDB()
    .prepare(
      "SELECT * FROM agent_skills WHERE is_current_version = 1 AND lower(name) = lower(?) LIMIT 1"
    )
    .get(String(name || "").trim()) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { ...rowToAgentSkillMetadata(row), id: row.id as string };
}

export function setAgentSkillSource(
  skillId: string,
  source: {
    sourceType: string;
    sourceRef: string;
    sourceSkill: string;
    sourceCommit: string | null;
  }
): void {
  getDB()
    .prepare(
      "UPDATE agent_skills SET source_type = ?, source_ref = ?, source_skill = ?, source_commit = ? WHERE skill_id = ?"
    )
    .run(
      source.sourceType || "",
      source.sourceRef || "",
      source.sourceSkill || "",
      source.sourceCommit || "",
      skillId
    );
}

export async function getCurrentAgentSkillBySkillId(
  skillId: string
): Promise<(AgentSkillMetadata & { id: string }) | null> {
  const row = getDB()
    .prepare(
      "SELECT * FROM agent_skills WHERE skill_id = ? ORDER BY is_current_version DESC, version DESC LIMIT 1"
    )
    .get(skillId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { ...rowToAgentSkillMetadata(row), id: row.id as string };
}

export async function setAgentSkillCurrentVersion(skillId: string, versionId: string): Promise<void> {
  const db = getDB();
  db.prepare("UPDATE agent_skills SET is_current_version = 0 WHERE skill_id = ?").run(skillId);
  db.prepare("UPDATE agent_skills SET is_current_version = 1 WHERE id = ?").run(versionId);
}

export async function deleteAgentSkill(id: string): Promise<void> {
  getDB().prepare("DELETE FROM agent_skills WHERE id = ?").run(id);
  deleteEmbedding(id, "agent_skills");
}

export async function deleteAgentSkillAllVersions(skillId: string): Promise<void> {
  const rows = getDB()
    .prepare("SELECT id FROM agent_skills WHERE skill_id = ?")
    .all(skillId) as Array<{ id: string }>;
  await deleteAgentSkills(rows.map((r) => r.id));
  // 技能整体删除时一并清掉磁盘上的技能包（单个版本删除不动包）
  deletePackageDir(skillId);
}

export async function deleteAgentSkills(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  getDB().prepare(`DELETE FROM agent_skills WHERE id IN (${placeholders})`).run(...ids);
  ids.forEach((id) => deleteEmbedding(id, "agent_skills"));
}

export async function searchAgentSkills(options: QueryOptions): Promise<QueryResult> {
  const nResults = options.nResults || 10;
  const queryText = options.queryTexts[0] || "";
  const hits = await vecSearch("agent_skills", queryText, nResults);
  if (!hits.length) return { ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] };

  const ids = hits.map((h) => h.id);
  const rows = getDB()
    .prepare(`SELECT * FROM agent_skills WHERE id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as Record<string, unknown>[];

  const rowMap = new Map(rows.map((r) => [r.id as string, r]));
  const orderedRows = ids.map((id) => rowMap.get(id)).filter(Boolean) as Record<string, unknown>[];

  return {
    ids: [orderedRows.map((r) => r.id as string)],
    documents: [orderedRows.map((r) => makeAgentSkillResultDoc(r))],
    metadatas: [orderedRows.map(rowToAgentSkillMetadata) as unknown as Record<string, unknown>[]],
    distances: [hits.map((h) => h.distance)],
  };
}

export async function getAgentSkillsCount(): Promise<number> {
  const row = getDB().prepare("SELECT COUNT(*) as cnt FROM agent_skills").get() as { cnt: number };
  return row.cnt;
}

let agentSkillReindexGeneration = 0;

export interface ReindexAgentSkillsResult {
  processed: number;
  aborted: boolean;
}

/**
 * 按当前嵌入文本规则重嵌全部 agent_skills。
 * 分批 + setImmediate 让出事件循环；再次调用会打断上一次。
 */
export async function reindexAgentSkills(opts?: {
  signal?: AbortSignal;
}): Promise<ReindexAgentSkillsResult> {
  const gen = ++agentSkillReindexGeneration;
  const BATCH = 25;
  const rows = getDB()
    .prepare("SELECT id, name, description, category, tags, template FROM agent_skills")
    .all() as Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    tags: string;
    template: string;
  }>;

  let processed = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    if (gen !== agentSkillReindexGeneration || opts?.signal?.aborted) {
      return { processed, aborted: true };
    }
    const batch = rows.slice(i, i + BATCH);
    for (const r of batch) {
      const tagIds = parseJson<string[]>(r.tags, []);
      const doc = makeAgentSkillEmbedDoc({
        name: r.name,
        description: r.description,
        category: r.category,
        tagNames: resolveTagIdsToNames(tagIds),
        template: r.template,
      });
      await saveEmbedding(r.id, "agent_skills", doc);
      processed++;
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  return { processed, aborted: false };
}

export async function toggleAgentSkillStar(id: string): Promise<boolean> {
  const db = getDB();
  const row = db.prepare("SELECT is_starred FROM agent_skills WHERE id = ?").get(id) as { is_starred: number } | undefined;
  if (!row) throw new Error(`Agent skill not found: ${id}`);
  const newVal = row.is_starred ? 0 : 1;
  db.prepare("UPDATE agent_skills SET is_starred = ? WHERE id = ?").run(newVal, id);
  return newVal === 1;
}

export async function incrementAgentSkillUses(id: string): Promise<void> {
  const db = getDB();
  db.prepare("UPDATE agent_skills SET uses = uses + 1, last_used_at = ? WHERE id = ?").run(new Date().toISOString(), id);
}

// ==================== SubAgents ====================

function rowToSubAgentMetadata(row: Record<string, unknown>): SubAgentMetadata {
  return {
    name: row.name as string,
    description: row.description as string,
    category: row.category as string,
    type: row.type as SubAgentMetadata["type"],
    model: row.model as string,
    instructions: row.instructions as string,
    tools: parseJson<string[]>(row.tools, []),
    handoffConditions: row.handoff_conditions as string,
    inputSchema: parseJson<Record<string, unknown>>(row.input_schema, {}),
    outputFormat: row.output_format as string,
    maxTokens: typeof row.max_tokens === "string" ? parseInt(row.max_tokens, 10) : (row.max_tokens as number) || 0,
    temperature: typeof row.temperature === "string" ? parseFloat(row.temperature) : (row.temperature as number) || 0,
    tags: parseJson<string[]>(row.tags, []),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    version: row.version as number,
    subAgentId: row.sub_agent_id as string,
    isCurrentVersion: toBool(row.is_current_version),
  };
}

export async function createSubAgent(input: CreateSubAgentInput): Promise<void> {
  const db = getDB();
  let subAgentId = input.subAgentId;
  let version = 1;

  if (subAgentId) {
    const maxRow = db
      .prepare("SELECT MAX(version) as max_v FROM sub_agents WHERE sub_agent_id = ?")
      .get(subAgentId) as { max_v: number | null };
    if (maxRow.max_v !== null) {
      version = maxRow.max_v + 1;
      db.prepare(
        "UPDATE sub_agents SET is_current_version = 0 WHERE sub_agent_id = ? AND is_current_version = 1"
      ).run(subAgentId);
    }
  } else {
    subAgentId = genId("subagent");
  }

  const now = input.createdAt || new Date().toISOString();
  db.prepare(
    `INSERT INTO sub_agents (id, sub_agent_id, name, description, category, type, model, instructions, tools, handoff_conditions, input_schema, output_format, max_tokens, temperature, tags, version, is_current_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(
    input.id,
    subAgentId,
    input.name,
    input.description || "",
    input.category || "",
    input.type,
    input.model || "",
    input.instructions,
    JSON.stringify(input.tools || []),
    input.handoffConditions || "",
    JSON.stringify(input.inputSchema || {}),
    input.outputFormat || "",
    input.maxTokens || 0,
    input.temperature || 0,
    JSON.stringify(input.tags || []),
    version,
    now,
    now
  );

  const doc = makeDocument([input.name, input.description, input.category, input.type, input.instructions?.substring(0, 500), ...(input.tags || [])]);
  saveEmbedding(input.id, "sub_agents", doc);
}

export async function getSubAgent(id: string): Promise<SubAgentMetadata | null> {
  const row = getDB()
    .prepare("SELECT * FROM sub_agents WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToSubAgentMetadata(row) : null;
}

export async function getAllSubAgents(): Promise<GetResult> {
  const rows = getDB()
    .prepare("SELECT * FROM sub_agents ORDER BY sub_agent_id, version")
    .all() as Record<string, unknown>[];
  return {
    ids: rows.map((r) => r.id as string),
    documents: rows.map((r) => makeDocument([r.name as string, r.description as string])),
    metadatas: rows.map(rowToSubAgentMetadata) as unknown as Record<string, unknown>[],
  };
}

export async function getCurrentSubAgents(): Promise<GetResult> {
  const rows = getDB()
    .prepare("SELECT * FROM sub_agents WHERE is_current_version = 1 ORDER BY updated_at DESC")
    .all() as Record<string, unknown>[];
  return {
    ids: rows.map((r) => r.id as string),
    documents: rows.map((r) => makeDocument([r.name as string, r.description as string])),
    metadatas: rows.map(rowToSubAgentMetadata) as unknown as Record<string, unknown>[],
  };
}

export async function getSubAgentVersions(subAgentId: string): Promise<SubAgentVersion[]> {
  const rows = getDB()
    .prepare("SELECT * FROM sub_agents WHERE sub_agent_id = ? ORDER BY version DESC")
    .all(subAgentId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    version: r.version as number,
    name: r.name as string,
    description: r.description as string,
    category: r.category as string,
    type: r.type as SubAgentVersion["type"],
    instructions: r.instructions as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    isCurrentVersion: toBool(r.is_current_version),
  }));
}

export async function updateSubAgent(
  id: string,
  input: UpdateSubAgentInput & { isCurrentVersion?: boolean }
): Promise<void> {
  const db = getDB();
  const existing = await getSubAgent(id);
  if (!existing) throw new Error("SubAgent not found");

  if (input.isCurrentVersion === true) {
    db.prepare(
      "UPDATE sub_agents SET is_current_version = 0 WHERE sub_agent_id = ? AND is_current_version = 1"
    ).run(existing.subAgentId);
  }

  const updated = {
    name: input.name ?? existing.name,
    description: input.description ?? existing.description ?? "",
    category: input.category ?? existing.category ?? "",
    type: input.type ?? existing.type,
    model: input.model ?? existing.model ?? "",
    instructions: input.instructions ?? existing.instructions,
    tools: JSON.stringify(input.tools ?? existing.tools ?? []),
    handoffConditions: input.handoffConditions ?? existing.handoffConditions ?? "",
    inputSchema: JSON.stringify(input.inputSchema ?? existing.inputSchema ?? {}),
    outputFormat: input.outputFormat ?? existing.outputFormat ?? "",
    maxTokens: input.maxTokens ?? existing.maxTokens ?? 0,
    temperature: input.temperature ?? existing.temperature ?? 0,
    tags: JSON.stringify(input.tags ?? existing.tags ?? []),
    isCurrentVersion: input.isCurrentVersion !== undefined ? (input.isCurrentVersion ? 1 : 0) : (existing.isCurrentVersion ? 1 : 0),
    updatedAt: new Date().toISOString(),
  };

  db.prepare(
    `UPDATE sub_agents SET name=?, description=?, category=?, type=?, model=?, instructions=?, tools=?, handoff_conditions=?, input_schema=?, output_format=?, max_tokens=?, temperature=?, tags=?, is_current_version=?, updated_at=? WHERE id=?`
  ).run(
    updated.name, updated.description, updated.category, updated.type, updated.model,
    updated.instructions, updated.tools, updated.handoffConditions, updated.inputSchema,
    updated.outputFormat, updated.maxTokens, updated.temperature, updated.tags,
    updated.isCurrentVersion, updated.updatedAt, id
  );

  const doc = makeDocument([updated.name, updated.description, updated.category, updated.type, updated.instructions?.substring(0, 500)]);
  saveEmbedding(id, "sub_agents", doc);
}

export async function setSubAgentCurrentVersion(subAgentId: string, versionId: string): Promise<void> {
  const db = getDB();
  db.prepare("UPDATE sub_agents SET is_current_version = 0 WHERE sub_agent_id = ?").run(subAgentId);
  db.prepare("UPDATE sub_agents SET is_current_version = 1 WHERE id = ?").run(versionId);
}

export async function deleteSubAgent(id: string): Promise<void> {
  getDB().prepare("DELETE FROM sub_agents WHERE id = ?").run(id);
  deleteEmbedding(id, "sub_agents");
}

export async function deleteSubAgentAllVersions(subAgentId: string): Promise<void> {
  const rows = getDB()
    .prepare("SELECT id FROM sub_agents WHERE sub_agent_id = ?")
    .all(subAgentId) as Array<{ id: string }>;
  await deleteSubAgents(rows.map((r) => r.id));
}

export async function deleteSubAgents(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  getDB().prepare(`DELETE FROM sub_agents WHERE id IN (${placeholders})`).run(...ids);
  ids.forEach((id) => deleteEmbedding(id, "sub_agents"));
}

export async function searchSubAgents(options: QueryOptions): Promise<QueryResult> {
  const nResults = options.nResults || 10;
  const queryText = options.queryTexts[0] || "";
  const hits = await vecSearch("sub_agents", queryText, nResults);
  if (!hits.length) return { ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] };

  const ids = hits.map((h) => h.id);
  const rows = getDB()
    .prepare(`SELECT * FROM sub_agents WHERE id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as Record<string, unknown>[];

  const rowMap = new Map(rows.map((r) => [r.id as string, r]));
  const orderedRows = ids.map((id) => rowMap.get(id)).filter(Boolean) as Record<string, unknown>[];

  return {
    ids: [orderedRows.map((r) => r.id as string)],
    documents: [orderedRows.map((r) => makeDocument([r.name as string, r.description as string]))],
    metadatas: [orderedRows.map(rowToSubAgentMetadata) as unknown as Record<string, unknown>[]],
    distances: [hits.map((h) => h.distance)],
  };
}

export async function getSubAgentsCount(): Promise<number> {
  const row = getDB().prepare("SELECT COUNT(*) as cnt FROM sub_agents").get() as { cnt: number };
  return row.cnt;
}

// ==================== Agent Teams ====================

function rowToAgentTeamMetadata(row: Record<string, unknown>): AgentTeamMetadata {
  return {
    name: row.name as string,
    description: row.description as string,
    category: row.category as string,
    displayMode: row.display_mode as AgentTeamMetadata["displayMode"],
    leadInstructions: row.lead_instructions as string,
    leadModel: row.lead_model as string,
    delegateMode: toBool(row.delegate_mode),
    requirePlanApproval: toBool(row.require_plan_approval),
    teammates: row.teammates as string, // 保持 JSON 字符串（与原实现一致）
    taskTemplate: row.task_template as string,
    qualityGates: row.quality_gates as string,
    maxTeammates: typeof row.max_teammates === "string" ? parseInt(row.max_teammates, 10) : (row.max_teammates as number) || 5,
    tags: parseJson<string[]>(row.tags, []),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    version: row.version as number,
    teamId: row.team_id as string,
    isCurrentVersion: toBool(row.is_current_version),
  };
}

export async function createAgentTeam(input: CreateAgentTeamInput): Promise<void> {
  const db = getDB();
  let teamId = input.teamId;
  let version = 1;

  if (teamId) {
    const maxRow = db
      .prepare("SELECT MAX(version) as max_v FROM agent_teams WHERE team_id = ?")
      .get(teamId) as { max_v: number | null };
    if (maxRow.max_v !== null) {
      version = maxRow.max_v + 1;
      db.prepare(
        "UPDATE agent_teams SET is_current_version = 0 WHERE team_id = ? AND is_current_version = 1"
      ).run(teamId);
    }
  } else {
    teamId = genId("team");
  }

  const now = input.createdAt || new Date().toISOString();
  const teammatesStr = typeof input.teammates === "string"
    ? input.teammates
    : JSON.stringify(input.teammates);

  db.prepare(
    `INSERT INTO agent_teams (id, team_id, name, description, category, display_mode, lead_instructions, lead_model, delegate_mode, require_plan_approval, teammates, task_template, quality_gates, max_teammates, tags, version, is_current_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(
    input.id,
    teamId,
    input.name,
    input.description || "",
    input.category || "",
    input.displayMode || "auto",
    input.leadInstructions,
    input.leadModel || "",
    input.delegateMode ? 1 : 0,
    input.requirePlanApproval ? 1 : 0,
    teammatesStr,
    input.taskTemplate || "",
    input.qualityGates || "",
    input.maxTeammates || 5,
    JSON.stringify(input.tags || []),
    version,
    now,
    now
  );

  const teammates: TeammateDef[] = typeof input.teammates === "string"
    ? JSON.parse(input.teammates)
    : input.teammates;
  const doc = makeDocument([
    input.name,
    input.description,
    input.category,
    input.leadInstructions?.substring(0, 500),
    ...teammates.map((t) => `${t.role} ${t.description || ""} ${t.spawnPrompt.substring(0, 200)}`),
    ...(input.tags || []),
  ]);
  saveEmbedding(input.id, "agent_teams", doc);
}

export async function getAgentTeam(id: string): Promise<AgentTeamMetadata | null> {
  const row = getDB()
    .prepare("SELECT * FROM agent_teams WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToAgentTeamMetadata(row) : null;
}

export async function getAllAgentTeams(): Promise<GetResult> {
  const rows = getDB()
    .prepare("SELECT * FROM agent_teams ORDER BY team_id, version")
    .all() as Record<string, unknown>[];
  return {
    ids: rows.map((r) => r.id as string),
    documents: rows.map((r) => makeDocument([r.name as string, r.description as string])),
    metadatas: rows.map(rowToAgentTeamMetadata) as unknown as Record<string, unknown>[],
  };
}

export async function getCurrentAgentTeams(): Promise<GetResult> {
  const rows = getDB()
    .prepare("SELECT * FROM agent_teams WHERE is_current_version = 1 ORDER BY updated_at DESC")
    .all() as Record<string, unknown>[];
  return {
    ids: rows.map((r) => r.id as string),
    documents: rows.map((r) => makeDocument([r.name as string, r.description as string])),
    metadatas: rows.map(rowToAgentTeamMetadata) as unknown as Record<string, unknown>[],
  };
}

export async function getAgentTeamVersions(teamId: string): Promise<AgentTeamVersion[]> {
  const rows = getDB()
    .prepare("SELECT * FROM agent_teams WHERE team_id = ? ORDER BY version DESC")
    .all(teamId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    version: r.version as number,
    name: r.name as string,
    description: r.description as string,
    category: r.category as string,
    displayMode: r.display_mode as AgentTeamVersion["displayMode"],
    leadInstructions: r.lead_instructions as string,
    teammates: parseJson<TeammateDef[]>(r.teammates, []),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    isCurrentVersion: toBool(r.is_current_version),
  }));
}

export async function updateAgentTeam(
  id: string,
  input: UpdateAgentTeamInput & { isCurrentVersion?: boolean }
): Promise<void> {
  const db = getDB();
  const existing = await getAgentTeam(id);
  if (!existing) throw new Error("Agent Team not found");

  if (input.isCurrentVersion === true) {
    db.prepare(
      "UPDATE agent_teams SET is_current_version = 0 WHERE team_id = ? AND is_current_version = 1"
    ).run(existing.teamId);
  }

  const teammatesStr = input.teammates
    ? (typeof input.teammates === "string" ? input.teammates : JSON.stringify(input.teammates))
    : existing.teammates;

  const updated = {
    name: input.name ?? existing.name,
    description: input.description ?? existing.description ?? "",
    category: input.category ?? existing.category ?? "",
    displayMode: input.displayMode ?? existing.displayMode ?? "auto",
    leadInstructions: input.leadInstructions ?? existing.leadInstructions,
    leadModel: input.leadModel ?? existing.leadModel ?? "",
    delegateMode: (input.delegateMode !== undefined ? input.delegateMode : existing.delegateMode) ? 1 : 0,
    requirePlanApproval: (input.requirePlanApproval !== undefined ? input.requirePlanApproval : existing.requirePlanApproval) ? 1 : 0,
    teammates: teammatesStr,
    taskTemplate: input.taskTemplate ?? existing.taskTemplate ?? "",
    qualityGates: input.qualityGates ?? existing.qualityGates ?? "",
    maxTeammates: input.maxTeammates ?? existing.maxTeammates ?? 5,
    tags: JSON.stringify(input.tags ?? existing.tags ?? []),
    isCurrentVersion: input.isCurrentVersion !== undefined ? (input.isCurrentVersion ? 1 : 0) : (existing.isCurrentVersion ? 1 : 0),
    updatedAt: new Date().toISOString(),
  };

  db.prepare(
    `UPDATE agent_teams SET name=?, description=?, category=?, display_mode=?, lead_instructions=?, lead_model=?, delegate_mode=?, require_plan_approval=?, teammates=?, task_template=?, quality_gates=?, max_teammates=?, tags=?, is_current_version=?, updated_at=? WHERE id=?`
  ).run(
    updated.name, updated.description, updated.category, updated.displayMode,
    updated.leadInstructions, updated.leadModel, updated.delegateMode, updated.requirePlanApproval,
    updated.teammates, updated.taskTemplate, updated.qualityGates, updated.maxTeammates,
    updated.tags, updated.isCurrentVersion, updated.updatedAt, id
  );

  let teammatesArr: TeammateDef[] = [];
  try {
    teammatesArr = typeof updated.teammates === "string" ? JSON.parse(updated.teammates) : updated.teammates;
  } catch { /* ignore */ }

  const doc = makeDocument([
    updated.name,
    updated.description,
    updated.category,
    updated.leadInstructions?.substring(0, 500),
    ...teammatesArr.map((t: TeammateDef) => `${t.role} ${t.description || ""}`),
  ]);
  saveEmbedding(id, "agent_teams", doc);
}

export async function setAgentTeamCurrentVersion(teamId: string, versionId: string): Promise<void> {
  const db = getDB();
  db.prepare("UPDATE agent_teams SET is_current_version = 0 WHERE team_id = ?").run(teamId);
  db.prepare("UPDATE agent_teams SET is_current_version = 1 WHERE id = ?").run(versionId);
}

export async function deleteAgentTeam(id: string): Promise<void> {
  getDB().prepare("DELETE FROM agent_teams WHERE id = ?").run(id);
  deleteEmbedding(id, "agent_teams");
}

export async function deleteAgentTeamAllVersions(teamId: string): Promise<void> {
  const rows = getDB()
    .prepare("SELECT id FROM agent_teams WHERE team_id = ?")
    .all(teamId) as Array<{ id: string }>;
  await deleteAgentTeams(rows.map((r) => r.id));
}

export async function deleteAgentTeams(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  getDB().prepare(`DELETE FROM agent_teams WHERE id IN (${placeholders})`).run(...ids);
  ids.forEach((id) => deleteEmbedding(id, "agent_teams"));
}

export async function searchAgentTeams(options: QueryOptions): Promise<QueryResult> {
  const nResults = options.nResults || 10;
  const queryText = options.queryTexts[0] || "";
  const hits = await vecSearch("agent_teams", queryText, nResults);
  if (!hits.length) return { ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] };

  const ids = hits.map((h) => h.id);
  const rows = getDB()
    .prepare(`SELECT * FROM agent_teams WHERE id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as Record<string, unknown>[];

  const rowMap = new Map(rows.map((r) => [r.id as string, r]));
  const orderedRows = ids.map((id) => rowMap.get(id)).filter(Boolean) as Record<string, unknown>[];

  return {
    ids: [orderedRows.map((r) => r.id as string)],
    documents: [orderedRows.map((r) => makeDocument([r.name as string, r.description as string]))],
    metadatas: [orderedRows.map(rowToAgentTeamMetadata) as unknown as Record<string, unknown>[]],
    distances: [hits.map((h) => h.distance)],
  };
}

export async function getAgentTeamsCount(): Promise<number> {
  const row = getDB().prepare("SELECT COUNT(*) as cnt FROM agent_teams").get() as { cnt: number };
  return row.cnt;
}

// ==================== Library CRUD ====================

function rowToLibraryItem(r: Record<string, unknown>): LibraryItem {
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) || undefined,
    icon: (r.icon as string) || "📁",
    color: (r.color as string) || "#6366f1",
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    parentId: (r.parent_id as string) || undefined,
    shareToken: (r.share_token as string) || undefined,
    shareEnabled: toBool(r.share_enabled),
  };
}

export async function createLibrary(input: CreateLibraryInput): Promise<LibraryItem> {
  const db = getDB();
  const now = new Date().toISOString();
  const id = input.id || genId("lib");
  db.prepare(
    `INSERT INTO libraries (id, name, description, icon, color, created_at, updated_at, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.name,
    input.description || "",
    input.icon || "📁",
    input.color || "#6366f1",
    now,
    now,
    input.parentId || null
  );
  return rowToLibraryItem(db.prepare("SELECT * FROM libraries WHERE id = ?").get(id) as Record<string, unknown>);
}

export async function getLibrary(id: string): Promise<LibraryItem | null> {
  const row = getDB().prepare("SELECT * FROM libraries WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToLibraryItem(row) : null;
}

export async function getAllLibraries(): Promise<LibraryItem[]> {
  const rows = getDB().prepare("SELECT * FROM libraries ORDER BY created_at ASC").all() as Record<string, unknown>[];
  return rows.map(rowToLibraryItem);
}

export async function updateLibrary(id: string, input: UpdateLibraryInput): Promise<void> {
  const db = getDB();
  const existing = await getLibrary(id);
  if (!existing) throw new Error("Library not found");
  const updated = {
    name: input.name ?? existing.name,
    description: input.description ?? existing.description ?? "",
    icon: input.icon ?? existing.icon,
    color: input.color ?? existing.color,
    updatedAt: new Date().toISOString(),
    parentId: input.parentId !== undefined ? input.parentId : (existing.parentId ?? null),
    shareEnabled: input.shareEnabled !== undefined ? (input.shareEnabled ? 1 : 0) : (existing.shareEnabled ? 1 : 0),
  };
  db.prepare(
    `UPDATE libraries SET name=?, description=?, icon=?, color=?, updated_at=?, parent_id=?, share_enabled=? WHERE id=?`
  ).run(updated.name, updated.description, updated.icon, updated.color, updated.updatedAt, updated.parentId, updated.shareEnabled, id);
}

export async function deleteLibrary(id: string): Promise<void> {
  const db = getDB();
  // 将该库下的所有 prompts 和 skills 的 library_id 置为 NULL
  db.prepare("UPDATE prompts SET library_id = NULL WHERE library_id = ?").run(id);
  db.prepare("UPDATE agent_skills SET library_id = NULL WHERE library_id = ?").run(id);
  db.prepare("DELETE FROM libraries WHERE id = ?").run(id);
}

export async function movePromptToLibrary(promptId: string, libraryId: string | null): Promise<void> {
  getDB().prepare("UPDATE prompts SET library_id = ? WHERE prompt_id = ?").run(libraryId, promptId);
}

export async function moveSkillToLibrary(skillId: string, libraryId: string | null): Promise<void> {
  getDB().prepare("UPDATE agent_skills SET library_id = ? WHERE skill_id = ?").run(libraryId, skillId);
}

// ==================== 兼容性导出（供 seedDefaultData 等调用）====================

/** @deprecated 仅为兼容旧代码，SQLite 无需显式 ensure collection */
export async function ensurePromptsCollection(): Promise<void> { /* no-op */ }
export async function ensureAgentSkillsCollection(): Promise<void> { /* no-op */ }
export async function ensureSubAgentsCollection(): Promise<void> { /* no-op */ }
export async function ensureAgentTeamsCollection(): Promise<void> { /* no-op */ }
export async function ensureSitesCollection(): Promise<void> { /* no-op */ }
export async function ensureComponentsCollection(): Promise<void> { /* no-op */ }
