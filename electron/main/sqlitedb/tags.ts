/**
 * 标签定义表 CRUD，及 prompts / agent_skills 中 tags JSON（存 tag id）的规范化与展示名解析
 */
import { getDB } from "./db";

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

export interface TagDefinitionRow {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export function getOrCreateTagByName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("标签名称不能为空");
  const db = getDB();
  const existing = db
    .prepare("SELECT id FROM tag_definitions WHERE name = ? COLLATE NOCASE")
    .get(trimmed) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = genId("tag_def");
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO tag_definitions (id, name, color, created_at) VALUES (?, ?, '', ?)"
  ).run(id, trimmed, now);
  return id;
}

/**
 * 将前端提交的字符串数组规范为 tag id 列表（可为已有 id，或按名称创建）
 */
export function normalizeTagsForSave(raw: string[] | undefined): string[] {
  if (!raw?.length) return [];
  const db = getDB();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const t = item.trim();
    if (!t) continue;
    const byId = db.prepare("SELECT id FROM tag_definitions WHERE id = ?").get(t) as
      | { id: string }
      | undefined;
    if (byId) {
      if (!seen.has(byId.id)) {
        seen.add(byId.id);
        out.push(byId.id);
      }
      continue;
    }
    const id = getOrCreateTagByName(t);
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function resolveTagIdsToNames(ids: string[]): string[] {
  if (!ids.length) return [];
  const db = getDB();
  return ids.map((id) => {
    const row = db.prepare("SELECT name FROM tag_definitions WHERE id = ?").get(id) as
      | { name: string }
      | undefined;
    return row?.name ?? id;
  });
}

export function getAllTagDefinitions(): TagDefinitionRow[] {
  const rows = getDB()
    .prepare("SELECT id, name, color, created_at FROM tag_definitions ORDER BY name COLLATE NOCASE")
    .all() as Array<{ id: string; name: string; color: string; created_at: string }>;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color || "",
    createdAt: r.created_at,
  }));
}

export function createTagDefinition(name: string, color?: string): TagDefinitionRow {
  const id = getOrCreateTagByName(name);
  if (color !== undefined && color !== "") {
    getDB().prepare("UPDATE tag_definitions SET color = ? WHERE id = ?").run(color, id);
  }
  const row = getDB()
    .prepare("SELECT id, name, color, created_at FROM tag_definitions WHERE id = ?")
    .get(id) as { id: string; name: string; color: string; created_at: string };
  return {
    id: row.id,
    name: row.name,
    color: row.color || "",
    createdAt: row.created_at,
  };
}

export function updateTagDefinition(
  id: string,
  input: { name?: string; color?: string }
): void {
  const db = getDB();
  const cur = db.prepare("SELECT id FROM tag_definitions WHERE id = ?").get(id) as { id: string } | undefined;
  if (!cur) throw new Error("标签不存在");
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new Error("标签名称不能为空");
    db.prepare("UPDATE tag_definitions SET name = ? WHERE id = ?").run(trimmed, id);
  }
  if (input.color !== undefined) {
    db.prepare("UPDATE tag_definitions SET color = ? WHERE id = ?").run(input.color, id);
  }
}

function stripTagIdFromJsonRows(table: "prompts" | "agent_skills", tagId: string): void {
  const db = getDB();
  const rows = db.prepare(`SELECT id, tags FROM ${table}`).all() as Array<{ id: string; tags: string }>;
  for (const row of rows) {
    const arr = parseJson<string[]>(row.tags, []);
    if (!arr.includes(tagId)) continue;
    const next = arr.filter((t) => t !== tagId);
    db.prepare(`UPDATE ${table} SET tags = ? WHERE id = ?`).run(JSON.stringify(next), row.id);
  }
}

export function deleteTagDefinition(id: string): void {
  const db = getDB();
  const cur = db.prepare("SELECT id FROM tag_definitions WHERE id = ?").get(id) as { id: string } | undefined;
  if (!cur) return;
  db.prepare("DELETE FROM tag_definitions WHERE id = ?").run(id);
  stripTagIdFromJsonRows("prompts", id);
  stripTagIdFromJsonRows("agent_skills", id);
}

/**
 * 将历史数据（tags 存中文名等）迁移为 tag_definitions + JSON 存 id
 */
export function migrateLegacyTagsToDefinitions(): void {
  const db = getDB();

  const migrateArray = (arr: string[]): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of arr) {
      if (typeof item !== "string") continue;
      const t = item.trim();
      if (!t) continue;
      const byId = db.prepare("SELECT id FROM tag_definitions WHERE id = ?").get(t) as { id: string } | undefined;
      let id: string;
      if (byId) {
        id = byId.id;
      } else {
        id = getOrCreateTagByName(t);
      }
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  };

  const tables = ["prompts", "agent_skills"] as const;
  for (const table of tables) {
    const rows = db.prepare(`SELECT id, tags FROM ${table}`).all() as Array<{ id: string; tags: string }>;
    for (const row of rows) {
      const arr = parseJson<string[]>(row.tags, []);
      const next = migrateArray(arr);
      const ser = JSON.stringify(next);
      if (ser !== row.tags) {
        db.prepare(`UPDATE ${table} SET tags = ? WHERE id = ?`).run(ser, row.id);
      }
    }
  }
}
