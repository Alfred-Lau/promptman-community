/**
 * 多文件技能包
 *
 * 把 ZIP / 本地文件夹导入到 <dataRoot>/skill-packages/<skillId>/，落成真实文件，
 * DB 只保存 file_tree 索引。这样「导出到文件夹」「安装到 Agent」就退化成一次目录拷贝。
 *
 * 过滤规则与限额移植自 prompthub-website 的 app/lib/skill-zip.ts；
 * ZIP 解析用 Node 内置 zlib 实现（无需 jszip），只支持 stored/deflate 两种方法，
 * 对技能包这种场景足够。
 */
import { inflateRawSync } from "zlib";
import { join, resolve, sep, dirname } from "path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  renameSync,
  readdirSync,
  lstatSync,
  copyFileSync,
} from "fs";
import { getDataRoot } from "./dataPaths";
import type { SkillFileNode } from "./sqlitedb/types";

// ==================== 限额与过滤规则（与网站保持一致）====================

const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 2000;
const MAX_TEXT_FILE_BYTES = 200 * 1024;

const SKIP_DIR_SEGMENTS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "__pycache__",
  ".next",
  "dist",
  "build",
  ".turbo",
  ".cache",
]);

const TEXT_EXTENSIONS = new Set([
  ".md", ".mdx", ".txt", ".json", ".yml", ".yaml", ".toml",
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".kt", ".swift",
  ".css", ".scss", ".less", ".html", ".htm", ".xml", ".svg",
  ".sh", ".bash", ".zsh", ".env", ".example",
  ".gitignore", ".dockerignore", ".editorconfig",
  ".csv", ".sql", ".graphql", ".prisma",
  ".vue", ".svelte", ".astro", ".php",
  ".c", ".h", ".cpp", ".hpp", ".cs",
  ".ini", ".cfg", ".conf", ".lock",
]);

const PACKAGE_ROOT_DIRNAME = "skill-packages";

export interface SkillPackageImportResult {
  packageDir: string;
  fileTree: SkillFileNode[];
  fileCount: number;
  packageSize: number;
  /** 从包内 SKILL.md（或 README.md 兜底）提取的正文 */
  skillMd: string;
  /** 被跳过的条目数（不安全路径 / 忽略目录 / 符号链接 / 超限） */
  skipped: number;
}

// ==================== 路径工具 ====================

/** skillId 直接参与路径拼接，先做白名单过滤 */
function sanitizeSkillId(skillId: string): string {
  const safe = String(skillId).replace(/[^A-Za-z0-9._-]/g, "_");
  if (!safe || safe === "." || safe === "..") {
    throw new Error(`非法的 skillId: ${skillId}`);
  }
  return safe;
}

export function getSkillPackageRoot(): string {
  return join(getDataRoot(), PACKAGE_ROOT_DIRNAME);
}

/** 存进 agent_skills.package_dir 的目录名（相对 skill-packages 根目录） */
export function getSkillPackageDirName(skillId: string): string {
  return sanitizeSkillId(skillId);
}

/** 技能包目录的绝对路径；create=true 时确保目录存在 */
export function getSkillPackageDir(skillId: string, create = false): string {
  const dir = join(getSkillPackageRoot(), sanitizeSkillId(skillId));
  if (create) mkdirSync(dir, { recursive: true });
  return dir;
}

export function hasSkillPackage(skillId: string): boolean {
  try {
    const dir = getSkillPackageDir(skillId);
    return existsSync(dir) && readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

function normalizeEntryPath(raw: string): string {
  return raw.replace(/\\/g, "/").replace(/^\.?\//, "").replace(/\/+$/, "");
}

/**
 * 在归一化之前先判定原始条目名是否可疑（zip-slip 防护第零道）。
 * normalizeEntryPath 会把 `/abs.txt` 变成 `abs.txt`、把 `..` 留在中间，
 * 这类条目虽然最终不会逃出目录，但会污染 stripSingleRoot 的判断，直接丢弃更干净。
 */
function isRawEntryUnsafe(raw: string): boolean {
  const p = raw.replace(/\\/g, "/");
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) return true;
  return p.split("/").some((s) => s === "..");
}

/** 拒绝 `..`、绝对路径、盘符前缀等可以逃出包目录的相对路径（zip-slip 防护第一道） */
function isSafeRelPath(path: string): boolean {
  if (!path) return false;
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) return false;
  const segments = path.split("/");
  return segments.every((s) => s !== "" && s !== "." && s !== "..");
}

/** 解析后再校验一次，确保最终落点在包目录内（zip-slip 防护第二道） */
function resolveInside(baseDir: string, relPath: string): string | null {
  const base = resolve(baseDir);
  const target = resolve(base, relPath);
  if (target !== base && !target.startsWith(base + sep)) return null;
  return target;
}

function shouldSkipPath(path: string): boolean {
  const segments = path.split("/").filter(Boolean);
  return segments.some((s) => SKIP_DIR_SEGMENTS.has(s) || s === ".DS_Store");
}

function baseName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function isTextPath(path: string): boolean {
  const name = baseName(path).toLowerCase();
  if (
    name === "skill.md" ||
    name === "readme" ||
    name === "license" ||
    name === "makefile" ||
    name === "dockerfile"
  ) {
    return true;
  }
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  return TEXT_EXTENSIONS.has(name.slice(dot));
}

function looksBinary(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 800));
  if (sample.length === 0) return false;
  let suspicious = 0;
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    if (b === 0) return true;
    if (b < 7 || (b > 14 && b < 32)) suspicious++;
  }
  return suspicious / sample.length > 0.3;
}

/** 去掉 ZIP / 文件夹内唯一的顶层目录前缀（skill-name/src/... → src/...） */
function stripSingleRoot(paths: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const nonEmpty = paths.filter(Boolean);
  if (nonEmpty.length === 0) return map;

  const roots = new Set(nonEmpty.map((p) => p.split("/")[0]).filter(Boolean));
  const singleRoot = roots.size === 1 ? [...roots][0] : null;
  const strip =
    !!singleRoot &&
    nonEmpty.every((p) => p === singleRoot || p.startsWith(`${singleRoot}/`));

  for (const p of nonEmpty) {
    if (strip && p === singleRoot) continue;
    const next =
      strip && p.startsWith(`${singleRoot}/`) ? p.slice(singleRoot!.length + 1) : p;
    if (next) map.set(p, next);
  }
  return map;
}

// ==================== 极简 ZIP 解析（zlib，无外部依赖）====================

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

interface ZipEntry {
  name: string;
  isDir: boolean;
  isSymlink: boolean;
  uncompressedSize: number;
  read(): Buffer;
}

/** 从尾部反向查找 End Of Central Directory 记录 */
function findEocdOffset(buf: Buffer): number {
  const maxCommentLen = 0xffff;
  const start = Math.max(0, buf.length - maxCommentLen - 22);
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  }
  return -1;
}

/**
 * 读取 ZIP 的中央目录，返回条目列表（内容惰性解压）
 * 只支持 method 0 (stored) 与 8 (deflate)
 */
function readZipEntries(buf: Buffer): ZipEntry[] {
  const eocd = findEocdOffset(buf);
  if (eocd < 0) throw new Error("无效的 ZIP 文件（未找到中央目录）");

  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (cdOffset >= buf.length) throw new Error("无效的 ZIP 文件（中央目录偏移越界）");

  const entries: ZipEntry[] = [];
  let p = cdOffset;

  // 按签名顺序遍历，不依赖 EOCD 里的条目数（避免 zip64 里 0xFFFF 的干扰）
  while (p + 46 <= buf.length && buf.readUInt32LE(p) === SIG_CENTRAL) {
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const externalAttrs = buf.readUInt32LE(p + 38);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);

    const unixMode = (externalAttrs >>> 16) & 0xffff;
    const isSymlink = (unixMode & 0xf000) === 0xa000;
    const isDir = name.endsWith("/");

    entries.push({
      name,
      isDir,
      isSymlink,
      uncompressedSize,
      read(): Buffer {
        if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== SIG_LOCAL) {
          throw new Error(`ZIP 条目本地头损坏: ${name}`);
        }
        const lfNameLen = buf.readUInt16LE(localOffset + 26);
        const lfExtraLen = buf.readUInt16LE(localOffset + 28);
        const dataStart = localOffset + 30 + lfNameLen + lfExtraLen;
        const dataEnd = dataStart + compressedSize;
        if (dataEnd > buf.length) throw new Error(`ZIP 条目数据越界: ${name}`);
        const raw = buf.subarray(dataStart, dataEnd);
        if (method === 0) return Buffer.from(raw);
        if (method === 8) return inflateRawSync(raw);
        throw new Error(`不支持的 ZIP 压缩方式 ${method}: ${name}`);
      },
    });

    p += 46 + nameLen + extraLen + commentLen;
  }

  if (entries.length === 0) throw new Error("ZIP 内没有可读取的条目");
  return entries;
}

// ==================== 文件树 ====================

/** 扫描包目录生成文件树；目录不存在时返回空树而非抛错 */
export function buildFileTree(skillId: string): SkillFileNode[] {
  const root = getSkillPackageDir(skillId);
  if (!existsSync(root)) return [];

  const nodes: SkillFileNode[] = [];

  const walk = (dirAbs: string, relPrefix: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dirAbs);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name === ".DS_Store") continue;
      const rel = relPrefix ? `${relPrefix}/${name}` : name;
      const abs = join(dirAbs, name);
      let st;
      try {
        st = lstatSync(abs);
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        if (SKIP_DIR_SEGMENTS.has(name)) continue;
        nodes.push({ path: rel, name, size: 0, isDir: true, isText: false });
        walk(abs, rel);
      } else if (st.isFile()) {
        let isText = isTextPath(rel);
        if (isText && st.size > 0) {
          try {
            const head = readFileSync(abs).subarray(0, 800);
            if (looksBinary(head)) isText = false;
          } catch {
            isText = false;
          }
        }
        nodes.push({ path: rel, name, size: st.size, isDir: false, isText });
      }
    }
  };

  walk(root, "");

  nodes.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.path.localeCompare(b.path);
  });
  return nodes;
}

function summarize(fileTree: SkillFileNode[]): { fileCount: number; packageSize: number } {
  const files = fileTree.filter((n) => !n.isDir);
  return {
    fileCount: files.length,
    packageSize: files.reduce((sum, n) => sum + (n.size || 0), 0),
  };
}

/** 从包目录里提取 SKILL.md 正文（README.md 兜底） */
function extractSkillMd(skillId: string, fileTree: SkillFileNode[]): string {
  const dir = getSkillPackageDir(skillId);
  const pick = (matcher: (p: string) => boolean): string => {
    const hit = fileTree.find((n) => !n.isDir && n.isText && matcher(n.path.toLowerCase()));
    if (!hit) return "";
    const abs = resolveInside(dir, hit.path);
    if (!abs || !existsSync(abs)) return "";
    try {
      return readFileSync(abs, "utf8").replace(/^\uFEFF/, "");
    } catch {
      return "";
    }
  };
  return (
    pick((p) => p === "skill.md" || p.endsWith("/skill.md")) ||
    pick((p) => p === "readme.md" || p.endsWith("/readme.md"))
  );
}

// ==================== 导入 ====================

/**
 * 先写临时目录、成功后再替换正式目录，避免失败时留下半个包
 */
function withStagingDir<T>(
  skillId: string,
  fn: (stagingDir: string) => T
): T {
  const finalDir = getSkillPackageDir(skillId);
  const stagingDir = `${finalDir}.importing`;
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });
  try {
    const result = fn(stagingDir);
    rmSync(finalDir, { recursive: true, force: true });
    renameSync(stagingDir, finalDir);
    return result;
  } catch (err) {
    rmSync(stagingDir, { recursive: true, force: true });
    throw err;
  }
}

/**
 * 导入 ZIP 到技能包目录（整包替换语义）
 */
export function importZipToPackageDir(
  skillId: string,
  zipBuffer: Buffer
): SkillPackageImportResult {
  if (zipBuffer.byteLength > MAX_ZIP_BYTES) {
    throw new Error(`ZIP 过大，上限 ${MAX_ZIP_BYTES / 1024 / 1024}MB`);
  }

  const entries = readZipEntries(zipBuffer);

  // 归一化 + 过滤，再去掉唯一顶层目录
  const usable: ZipEntry[] = [];
  let skipped = 0;
  for (const e of entries) {
    if (isRawEntryUnsafe(e.name) || e.isSymlink) {
      skipped++;
      continue;
    }
    const path = normalizeEntryPath(e.name);
    if (!path) continue;
    if (shouldSkipPath(path)) {
      skipped++;
      continue;
    }
    usable.push({ ...e, name: path });
  }

  const pathMap = stripSingleRoot(usable.map((e) => e.name));
  const files = usable.filter((e) => !e.isDir && pathMap.has(e.name));

  if (files.length > MAX_FILES) {
    throw new Error(`ZIP 内文件过多（>${MAX_FILES}）`);
  }

  withStagingDir(skillId, (stagingDir) => {
    // 先建目录条目，保证空目录也被保留
    for (const e of usable) {
      if (!e.isDir) continue;
      const rel = pathMap.get(e.name);
      if (!rel || !isSafeRelPath(rel)) {
        skipped++;
        continue;
      }
      const abs = resolveInside(stagingDir, rel);
      if (!abs) {
        skipped++;
        continue;
      }
      mkdirSync(abs, { recursive: true });
    }

    let written = 0;
    for (const e of files) {
      const rel = pathMap.get(e.name)!;
      if (!isSafeRelPath(rel)) {
        skipped++;
        continue;
      }
      const abs = resolveInside(stagingDir, rel);
      if (!abs) {
        skipped++;
        continue;
      }
      let content: Buffer;
      try {
        content = e.read();
      } catch {
        skipped++;
        continue;
      }
      written += content.byteLength;
      if (written > MAX_ZIP_BYTES) {
        throw new Error(`解压后总体积超过 ${MAX_ZIP_BYTES / 1024 / 1024}MB`);
      }
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content);
    }
  });

  const fileTree = buildFileTree(skillId);
  return {
    packageDir: sanitizeSkillId(skillId),
    fileTree,
    ...summarize(fileTree),
    skillMd: extractSkillMd(skillId, fileTree),
    skipped,
  };
}

/**
 * 导入本地文件夹到技能包目录（整包替换语义）
 */
export function importFolderToPackageDir(
  skillId: string,
  srcDir: string
): SkillPackageImportResult {
  const srcRoot = resolve(srcDir);
  if (!existsSync(srcRoot)) throw new Error(`目录不存在: ${srcDir}`);

  let skipped = 0;
  let fileCount = 0;
  let totalBytes = 0;

  withStagingDir(skillId, (stagingDir) => {
    const walk = (dirAbs: string, relPrefix: string): void => {
      for (const name of readdirSync(dirAbs)) {
        if (name === ".DS_Store") {
          skipped++;
          continue;
        }
        const abs = join(dirAbs, name);
        const rel = relPrefix ? `${relPrefix}/${name}` : name;
        let st;
        try {
          st = lstatSync(abs);
        } catch {
          skipped++;
          continue;
        }
        if (st.isSymbolicLink()) {
          skipped++;
          continue;
        }
        if (st.isDirectory()) {
          if (SKIP_DIR_SEGMENTS.has(name)) {
            skipped++;
            continue;
          }
          const dest = resolveInside(stagingDir, rel);
          if (!dest) {
            skipped++;
            continue;
          }
          mkdirSync(dest, { recursive: true });
          walk(abs, rel);
          continue;
        }
        if (!st.isFile()) {
          skipped++;
          continue;
        }
        fileCount++;
        if (fileCount > MAX_FILES) throw new Error(`文件过多（>${MAX_FILES}）`);
        totalBytes += st.size;
        if (totalBytes > MAX_ZIP_BYTES) {
          throw new Error(`目录总体积超过 ${MAX_ZIP_BYTES / 1024 / 1024}MB`);
        }
        const dest = resolveInside(stagingDir, rel);
        if (!dest) {
          skipped++;
          continue;
        }
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(abs, dest);
      }
    };
    walk(srcRoot, "");
  });

  const fileTree = buildFileTree(skillId);
  return {
    packageDir: sanitizeSkillId(skillId),
    fileTree,
    ...summarize(fileTree),
    skillMd: extractSkillMd(skillId, fileTree),
    skipped,
  };
}

// ==================== 读取 / 拷贝 / 删除 ====================

/**
 * 读取包内单个文本文件（用于预览）；超过 200KB 截断
 */
export function readPackageFile(
  skillId: string,
  relPath: string
): { content: string; truncated: boolean } {
  const dir = getSkillPackageDir(skillId);
  if (isRawEntryUnsafe(relPath)) throw new Error(`非法路径: ${relPath}`);
  const normalized = normalizeEntryPath(relPath);
  if (!isSafeRelPath(normalized)) throw new Error(`非法路径: ${relPath}`);
  const abs = resolveInside(dir, normalized);
  if (!abs) throw new Error(`路径越界: ${relPath}`);
  if (!existsSync(abs)) throw new Error(`文件不存在: ${relPath}`);

  const st = lstatSync(abs);
  if (st.isSymbolicLink() || !st.isFile()) throw new Error(`不是普通文件: ${relPath}`);

  const buf = readFileSync(abs);
  if (looksBinary(buf)) throw new Error("二进制文件不支持预览");
  const truncated = buf.byteLength > MAX_TEXT_FILE_BYTES;
  const slice = truncated ? buf.subarray(0, MAX_TEXT_FILE_BYTES) : buf;
  return { content: slice.toString("utf8").replace(/^\uFEFF/, ""), truncated };
}

/**
 * 把整个技能包目录拷贝到目标目录（目标目录会被创建，同名文件覆盖）
 */
export function copyPackageDirTo(skillId: string, targetDir: string): void {
  const srcRoot = getSkillPackageDir(skillId);
  if (!existsSync(srcRoot)) throw new Error(`技能包目录不存在: ${skillId}`);
  mkdirSync(targetDir, { recursive: true });

  const walk = (src: string, dest: string): void => {
    for (const name of readdirSync(src)) {
      const srcAbs = join(src, name);
      const destAbs = join(dest, name);
      const st = lstatSync(srcAbs);
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        mkdirSync(destAbs, { recursive: true });
        walk(srcAbs, destAbs);
      } else if (st.isFile()) {
        copyFileSync(srcAbs, destAbs);
      }
    }
  };
  walk(srcRoot, targetDir);
}

export function deletePackageDir(skillId: string): void {
  try {
    const dir = getSkillPackageDir(skillId);
    rmSync(dir, { recursive: true, force: true });
    rmSync(`${dir}.importing`, { recursive: true, force: true });
  } catch {
    // 目录不存在或路径非法，忽略
  }
}

export interface ZipRelEntry {
  relPath: string;
  isDir: boolean;
  read(): Buffer;
}

/**
 * 列出 ZIP 内归一化后的相对路径（去掉唯一顶层目录，过滤不安全/忽略路径）
 * 供远程仓库发现 SKILL.md 使用，不落盘。
 */
export function listZipRelEntries(zipBuffer: Buffer): ZipRelEntry[] {
  if (zipBuffer.byteLength > MAX_ZIP_BYTES) {
    throw new Error(`ZIP 过大，上限 ${MAX_ZIP_BYTES / 1024 / 1024}MB`);
  }
  const entries = readZipEntries(zipBuffer);
  const usable: ZipEntry[] = [];
  for (const e of entries) {
    if (isRawEntryUnsafe(e.name) || e.isSymlink) continue;
    const path = normalizeEntryPath(e.name);
    if (!path || shouldSkipPath(path)) continue;
    usable.push({ ...e, name: path });
  }
  const pathMap = stripSingleRoot(usable.map((e) => e.name));
  const out: ZipRelEntry[] = [];
  for (const e of usable) {
    const rel = pathMap.get(e.name);
    if (!rel || !isSafeRelPath(rel)) continue;
    out.push({
      relPath: rel,
      isDir: e.isDir,
      read: () => e.read(),
    });
  }
  return out;
}

function fileBelongsToSkillRoot(relPath: string, rootPath: string): boolean {
  if (!rootPath) return true;
  return relPath === rootPath || relPath.startsWith(`${rootPath}/`);
}

/**
 * 从仓库 ZIP 中抽出单个 skill 目录写入技能包（整包替换）
 */
export function importZipSubsetToPackageDir(
  skillId: string,
  zipBuffer: Buffer,
  rootPath: string,
): SkillPackageImportResult {
  const prefix = String(rootPath || "").replace(/\/+$/, "");
  const entries = listZipRelEntries(zipBuffer).filter((e) =>
    fileBelongsToSkillRoot(e.relPath, prefix),
  );
  if (entries.filter((e) => !e.isDir).length === 0) {
    throw new Error(`skill 目录为空：${prefix || "/"}`);
  }

  let skipped = 0;
  withStagingDir(skillId, (stagingDir) => {
    let written = 0;
    for (const e of entries) {
      const relative = prefix
        ? e.relPath === prefix
          ? ""
          : e.relPath.startsWith(`${prefix}/`)
            ? e.relPath.slice(prefix.length + 1)
            : e.relPath
        : e.relPath;
      if (!relative) {
        if (e.isDir) continue;
        skipped++;
        continue;
      }
      if (!isSafeRelPath(relative)) {
        skipped++;
        continue;
      }
      const abs = resolveInside(stagingDir, relative);
      if (!abs) {
        skipped++;
        continue;
      }
      if (e.isDir) {
        mkdirSync(abs, { recursive: true });
        continue;
      }
      let content: Buffer;
      try {
        content = e.read();
      } catch {
        skipped++;
        continue;
      }
      written += content.byteLength;
      if (written > MAX_ZIP_BYTES) {
        throw new Error(`解压后总体积超过 ${MAX_ZIP_BYTES / 1024 / 1024}MB`);
      }
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content);
    }
  });

  const fileTree = buildFileTree(skillId);
  return {
    packageDir: sanitizeSkillId(skillId),
    fileTree,
    ...summarize(fileTree),
    skillMd: extractSkillMd(skillId, fileTree),
    skipped,
  };
}

/**
 * 写入包内单个文本文件，并返回刷新后的索引
 */
export function writePackageFile(
  skillId: string,
  relPath: string,
  content: string,
): { fileTree: SkillFileNode[]; fileCount: number; packageSize: number } {
  const dir = getSkillPackageDir(skillId, true);
  if (isRawEntryUnsafe(relPath)) throw new Error(`非法路径: ${relPath}`);
  const normalized = normalizeEntryPath(relPath);
  if (!isSafeRelPath(normalized)) throw new Error(`非法路径: ${relPath}`);
  const abs = resolveInside(dir, normalized);
  if (!abs) throw new Error(`路径越界: ${relPath}`);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
  const fileTree = buildFileTree(skillId);
  return { fileTree, ...summarize(fileTree) };
}

/** CRC-32（ZIP stored 条目需要） */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * 把技能包目录打成 stored ZIP（无外部依赖，便于分享 / `npx skills add` 本地包）
 */
export function buildPackageZipBuffer(skillId: string): Buffer {
  const dir = getSkillPackageDir(skillId);
  if (!existsSync(dir)) throw new Error(`技能包目录不存在: ${skillId}`);

  const files: Array<{ path: string; data: Buffer }> = [];
  const walk = (abs: string, relPrefix: string): void => {
    for (const name of readdirSync(abs)) {
      if (name === ".DS_Store") continue;
      const childAbs = join(abs, name);
      const rel = relPrefix ? `${relPrefix}/${name}` : name;
      const st = lstatSync(childAbs);
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        if (SKIP_DIR_SEGMENTS.has(name)) continue;
        walk(childAbs, rel);
      } else if (st.isFile()) {
        files.push({ path: rel, data: readFileSync(childAbs) });
      }
    }
  };
  walk(dir, "");
  if (files.length === 0) throw new Error("技能包为空，无法导出 ZIP");

  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.path, "utf8");
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(SIG_LOCAL, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    localChunks.push(local, nameBuf, file.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(SIG_CENTRAL, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralChunks.push(central, nameBuf);
    offset += local.length + nameBuf.length + file.data.length;
  }

  const centralBuf = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...localChunks, centralBuf, eocd]);
}
