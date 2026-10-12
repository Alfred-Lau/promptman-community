/**
 * SQLite 数据库单例管理
 * 负责初始化 better-sqlite3 实例、加载 sqlite-vec 扩展、执行建表 DDL
 */
import Database from "better-sqlite3";
import { app } from "electron";
import { join } from "path";
import { mkdirSync } from "fs";
import { SCHEMA_SQL } from "./schema";
import { migrateLegacyTagsToDefinitions } from "./tags";
import { getDataRoot } from "../dataPaths";

let dbInstance: Database.Database | null = null;

/**
 * 获取数据库文件路径
 */
function getDBPath(): string {
  const root = getDataRoot();
  mkdirSync(root, { recursive: true });
  return join(root, "promptman.db");
}

/**
 * 加载 sqlite-vec 扩展
 * 开发环境直接从 node_modules 加载；打包后从 resources 目录加载
 */
function loadSqliteVec(db: Database.Database): void {
  try {
    const isDev = process.env.NODE_ENV === 'development'
    
    if (isDev) {
      // 开发环境：直接 require，路径正常
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqliteVec = require("sqlite-vec");
      sqliteVec.load(db);
    } else {
      // 生产环境：sqlite-vec 的 .dylib 在 app.asar.unpacked 里
      // 需要手动构造 unpacked 路径来绕过 asar 限制
      const appPath = app.getAppPath()
      const unpackedBase = appPath.endsWith('.asar')
        ? join(process.resourcesPath, 'app.asar.unpacked')
        : appPath

      // 找到平台对应的 sqlite-vec native 包
      const platform = process.platform
      const arch = process.arch
      let vecPkgName = ''
      if (platform === 'darwin' && arch === 'x64') vecPkgName = 'sqlite-vec-darwin-x64'
      else if (platform === 'darwin' && arch === 'arm64') vecPkgName = 'sqlite-vec-darwin-arm64'
      else if (platform === 'win32' && arch === 'x64') vecPkgName = 'sqlite-vec-win32-x64'
      else if (platform === 'linux' && arch === 'x64') vecPkgName = 'sqlite-vec-linux-x64'

      if (!vecPkgName) {
        throw new Error(`Unsupported platform: ${platform}-${arch}`)
      }

      // 尝试从 unpacked 的 sqlite-vec-{platform}-{arch} 包直接加载扩展
      const extDir = join(unpackedBase, 'node_modules', vecPkgName)
      // vec0 扩展文件可能是 .dylib 或 .so 或 .dll
      const extFile = platform === 'win32' ? 'vec0.dll'
        : platform === 'darwin' ? 'vec0.dylib'
        : 'vec0.so'
      const extPath = join(extDir, extFile)

      db.loadExtension(extPath)
    }

    console.log("[SQLiteDB] sqlite-vec extension loaded successfully");
  } catch (err) {
    // sqlite-vec 加载失败不影响基础 CRUD，只影响语义搜索
    // 降级为全文搜索
    console.warn("[SQLiteDB] sqlite-vec extension failed to load, semantic search will use fallback:", err);
  }
}

/**
 * 初始化数据库：建表、加索引（幂等）
 */
export function initDB(): void {
  if (dbInstance) return;

  const dbPath = getDBPath();
  console.log("[SQLiteDB] Opening database at:", dbPath);

  dbInstance = new Database(dbPath);

  // 性能优化配置
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("synchronous = NORMAL");
  dbInstance.pragma("foreign_keys = ON");
  dbInstance.pragma("cache_size = -32000"); // 32MB cache

  // 加载向量搜索扩展
  loadSqliteVec(dbInstance);

  // 幂等建表
  dbInstance.exec(SCHEMA_SQL);

  // 迁移：为已有表添加 cloud_id 列（SQLite ALTER TABLE 不支持 IF NOT EXISTS，用 try-catch）
  try {
    dbInstance.exec("ALTER TABLE prompts ADD COLUMN cloud_id TEXT");
    console.log("[SQLiteDB] Migration: added cloud_id to prompts");
  } catch {
    // 列已存在，忽略
  }

  // 回填：id 以 p_ 开头的 prompt 是从云端同步来的，cloud_id = id
  // 注意：不能用 LIKE 'p_%'——SQLite 的 LIKE 里 `_` 是单字符通配符，
  // 会把本地新建的 prompt-<ts>-<rand> 一并匹配上，导致本地数据被当成云端托管。
  // 用 substr 做精确前缀判断。
  dbInstance.exec(
    "UPDATE prompts SET cloud_id = id WHERE substr(id, 1, 2) = 'p_' AND cloud_id IS NULL"
  );

  // 修复：早期版本的 LIKE 'p_%' 回填给本地 prompt（prompt-<ts>-<rand>）错误地写入了
  // cloud_id，导致这些行被当成云端托管（UI 不再提供"上传到云端"，推送时会去更新
  // 一个不存在的云端记录）。合法的 cloud_id 一定是 p_ 前缀，其余一律清空。
  dbInstance.exec(
    "UPDATE prompts SET cloud_id = NULL WHERE cloud_id IS NOT NULL AND substr(cloud_id, 1, 2) <> 'p_'"
  );

  // 迁移：为 prompts 和 agent_skills 添加 library_id 列
  try {
    dbInstance.exec("ALTER TABLE prompts ADD COLUMN library_id TEXT");
    console.log("[SQLiteDB] Migration: added library_id to prompts");
  } catch {
    // 列已存在，忽略
  }
  try {
    dbInstance.exec("ALTER TABLE agent_skills ADD COLUMN library_id TEXT");
    console.log("[SQLiteDB] Migration: added library_id to agent_skills");
  } catch {
    // 列已存在，忽略
  }

  // v2 migrations: is_starred, uses, last_used_at, accent, is_public
  for (const col of [
    { table: 'prompts', name: 'is_starred', sql: 'INTEGER NOT NULL DEFAULT 0' },
    { table: 'prompts', name: 'uses', sql: 'INTEGER NOT NULL DEFAULT 0' },
    { table: 'prompts', name: 'last_used_at', sql: 'TEXT' },
    { table: 'prompts', name: 'accent', sql: "TEXT NOT NULL DEFAULT '#f59e0b'" },
    { table: 'prompts', name: 'is_public', sql: 'INTEGER NOT NULL DEFAULT 0' },
    { table: 'agent_skills', name: 'is_starred', sql: 'INTEGER NOT NULL DEFAULT 0' },
    { table: 'agent_skills', name: 'uses', sql: 'INTEGER NOT NULL DEFAULT 0' },
    { table: 'agent_skills', name: 'last_used_at', sql: 'TEXT' },
    { table: 'agent_skills', name: 'accent', sql: "TEXT NOT NULL DEFAULT '#6ee7f7'" },
    { table: 'agent_skills', name: 'is_public', sql: 'INTEGER NOT NULL DEFAULT 0' },
    { table: 'libraries', name: 'parent_id', sql: 'TEXT' },
    { table: 'libraries', name: 'share_token', sql: 'TEXT' },
    { table: 'libraries', name: 'share_enabled', sql: 'INTEGER NOT NULL DEFAULT 0' },
    // v3 migrations: 云端 Skill 对齐字段 + 多文件技能包索引
    { table: 'agent_skills', name: 'platforms', sql: "TEXT NOT NULL DEFAULT '[]'" },
    { table: 'agent_skills', name: 'is_active', sql: 'INTEGER NOT NULL DEFAULT 1' },
    { table: 'agent_skills', name: 'version_label', sql: "TEXT NOT NULL DEFAULT 'v1.0'" },
    { table: 'agent_skills', name: 'cloud_id', sql: 'TEXT' },
    { table: 'agent_skills', name: 'package_dir', sql: 'TEXT' },
    { table: 'agent_skills', name: 'file_tree', sql: "TEXT NOT NULL DEFAULT '[]'" },
    { table: 'agent_skills', name: 'file_count', sql: 'INTEGER NOT NULL DEFAULT 0' },
    { table: 'agent_skills', name: 'package_size', sql: 'INTEGER NOT NULL DEFAULT 0' },
    // v4 migration: 外部目录同步来源（fs-scan）——源 SKILL.md 绝对路径，供编辑/删除写回磁盘与反查
    { table: 'agent_skills', name: 'source_path', sql: 'TEXT' },
    { table: 'agent_skills', name: 'source_type', sql: "TEXT NOT NULL DEFAULT ''" },
    { table: 'agent_skills', name: 'source_ref', sql: "TEXT NOT NULL DEFAULT ''" },
    { table: 'agent_skills', name: 'source_skill', sql: "TEXT NOT NULL DEFAULT ''" },
    { table: 'agent_skills', name: 'source_commit', sql: "TEXT NOT NULL DEFAULT ''" },
  ]) {
    try {
      dbInstance.exec(`ALTER TABLE ${col.table} ADD COLUMN ${col.name} ${col.sql}`);
    } catch {
      // column already exists
    }
  }

  // 回填：id 以 sk_ 开头的 skill 是从云端同步来的，cloud_id = id
  // 注意：不能用 LIKE 'sk_%'——SQLite 的 LIKE 里 `_` 是单字符通配符，
  // 会把本地新建的 skill-<ts>-<rand> 一并匹配上。用 substr 做精确前缀判断。
  try {
    dbInstance.exec(
      "UPDATE agent_skills SET cloud_id = id WHERE substr(id, 1, 3) = 'sk_' AND cloud_id IS NULL"
    );
  } catch {
    // 列尚不存在（理论上不会发生，上面刚加过），忽略
  }

  try {
    migrateLegacyTagsToDefinitions();
  } catch (e) {
    console.warn("[SQLiteDB] tag_definitions migration:", e);
  }

  console.log("[SQLiteDB] Database initialized successfully");
}

/**
 * 获取数据库实例（单例）
 */
export function getDB(): Database.Database {
  if (!dbInstance) {
    throw new Error("数据库未初始化，请先调用 initDB()");
  }
  return dbInstance;
}

/**
 * 关闭数据库连接
 */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    console.log("[SQLiteDB] Database closed");
  }
}

/**
 * 检查 sqlite-vec 是否可用（用于判断是否可做向量搜索）
 */
export function isVecAvailable(): boolean {
  if (!dbInstance) return false;
  try {
    dbInstance.prepare("SELECT vec_version()").get();
    return true;
  } catch {
    return false;
  }
}
