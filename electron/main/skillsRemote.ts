/**
 * 从公开 GitHub 仓库发现并安装 Agent Skills（本地优先，不上传 OSS、不使用平台 token）。
 * 协议对齐 `npx skills add owner/repo`。
 */
import { listZipRelEntries, importZipSubsetToPackageDir } from "./skillPackages";
import type { SkillPackageImportResult } from "./skillPackages";
import {
  createAgentSkill,
  findCurrentAgentSkillByName,
  getAgentSkill,
  getCurrentAgentSkillBySkillId,
  setAgentSkillPackageIndex,
  setAgentSkillSource,
  updateAgentSkill,
} from "./sqlitedb";

const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 45_000;

export class RemoteSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemoteSourceError";
  }
}

export type DuplicateStrategy = "skip" | "overwrite" | "copy";

export interface ResolvedRemoteSource {
  host: "github";
  owner: string;
  repo: string;
  ref: string | null;
  subpath: string | null;
  skillHint: string | null;
  display: string;
  cliEquivalent: string;
}

export interface DiscoveredRemoteSkill {
  rootPath: string;
  name: string;
  description: string;
  skillMd: string;
  fileCount: number;
}

export interface RemotePreviewResult {
  source: ResolvedRemoteSource;
  commitSha: string | null;
  defaultBranch: string | null;
  skills: DiscoveredRemoteSkill[];
  cliEquivalent: string;
}

export interface RemoteInstallResultItem {
  status: "created" | "updated" | "skipped" | "failed";
  name: string;
  rootPath: string;
  id?: string;
  error?: string;
  cliEquivalent?: string;
}

function stripAtSkill(raw: string): { base: string; skillHint: string | null } {
  const at = raw.lastIndexOf("@");
  if (at <= 0) return { base: raw, skillHint: null };
  const maybeSkill = raw.slice(at + 1).trim();
  const before = raw.slice(0, at).trim();
  if (!maybeSkill || maybeSkill.includes("/") || maybeSkill.includes(":")) {
    return { base: raw, skillHint: null };
  }
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(before)) {
    return { base: before, skillHint: maybeSkill };
  }
  return { base: raw, skillHint: null };
}

function buildCli(
  owner: string,
  repo: string,
  skillHint: string | null,
  subpath: string | null,
): string {
  if (subpath) {
    const pathSkill = subpath.split("/").filter(Boolean).pop() ?? null;
    const skill = skillHint || pathSkill;
    if (skill) {
      return `npx skills add ${owner}/${repo} --skill ${JSON.stringify(skill)}`;
    }
  }
  if (skillHint) {
    return `npx skills add ${owner}/${repo}@${skillHint}`;
  }
  return `npx skills add ${owner}/${repo}`;
}

export function resolveRemoteSource(input: string): ResolvedRemoteSource {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    throw new RemoteSourceError("请输入 owner/repo 或 GitHub URL");
  }

  const { base, skillHint: atSkill } = stripAtSkill(trimmed);

  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(base)) {
    const [owner, repoRaw] = base.split("/");
    const repo = repoRaw.replace(/\.git$/i, "");
    return {
      host: "github",
      owner,
      repo,
      ref: null,
      subpath: null,
      skillHint: atSkill,
      display: `${owner}/${repo}`,
      cliEquivalent: buildCli(owner, repo, atSkill, null),
    };
  }

  let url: URL;
  try {
    url = new URL(base.startsWith("http") ? base : `https://${base}`);
  } catch {
    throw new RemoteSourceError(
      "无法解析来源。请使用 owner/repo 或 https://github.com/owner/repo",
    );
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "github.com") {
    throw new RemoteSourceError(`暂仅支持 GitHub 公共仓库（收到：${host}）`);
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new RemoteSourceError("GitHub URL 需包含 owner/repo");
  }

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  let ref: string | null = null;
  let subpath: string | null = null;

  if (parts[2] === "tree" || parts[2] === "blob") {
    if (parts.length >= 4) {
      ref = decodeURIComponent(parts[3]);
      if (parts.length > 4) {
        subpath = parts
          .slice(4)
          .map((p) => decodeURIComponent(p))
          .join("/");
        if (parts[2] === "blob" && subpath.toLowerCase().endsWith(".md")) {
          const segs = subpath.split("/");
          segs.pop();
          subpath = segs.join("/") || null;
        }
      }
    }
  }

  return {
    host: "github",
    owner,
    repo,
    ref,
    subpath,
    skillHint: atSkill,
    display: `${owner}/${repo}`,
    cliEquivalent: buildCli(owner, repo, atSkill, subpath),
  };
}

function matchSkillName(
  candidate: { name: string; rootPath: string },
  hint: string,
): boolean {
  const h = hint.trim().toLowerCase();
  if (!h) return true;
  if (candidate.name.toLowerCase() === h) return true;
  const folder = candidate.rootPath.split("/").filter(Boolean).pop() ?? "";
  if (folder.toLowerCase() === h) return true;
  if (candidate.rootPath.toLowerCase() === h) return true;
  if (candidate.rootPath.toLowerCase().endsWith(`/${h}`)) return true;
  return false;
}

export function parseSkillFrontmatter(md: string): {
  name: string | null;
  description: string | null;
  body: string;
} {
  const text = (md ?? "").replace(/^\uFEFF/, "");
  if (!text.startsWith("---")) {
    return { name: null, description: null, body: text };
  }
  const end = text.indexOf("\n---", 3);
  if (end < 0) {
    return { name: null, description: null, body: text };
  }
  const fm = text.slice(3, end).replace(/^\r?\n/, "");
  const body = text.slice(end + 4).replace(/^\r?\n/, "");

  let name: string | null = null;
  let description: string | null = null;

  for (const line of fm.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key === "name" && val) name = val;
    if (key === "description" && val) description = val;
  }

  return { name, description, body };
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "PromptMan-SkillsRemote/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  // 仅当用户本机显式设置时才带 token，默认不读私库（避免 confused deputy）
  if (process.env.SKILLS_REMOTE_USE_GITHUB_TOKEN === "1") {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new RemoteSourceError("拉取仓库超时，请稍后重试或指定更小的仓库");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function assertRepoIsPublic(owner: string, repo: string): Promise<{
  defaultBranch: string;
  commitSha: string | null;
}> {
  const res = await fetchWithTimeout(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { headers: githubHeaders() },
  );
  if (res.status === 404) {
    throw new RemoteSourceError(`仓库不存在或未公开：${owner}/${repo}`);
  }
  if (res.status === 403 || res.status === 429) {
    throw new RemoteSourceError(
      "GitHub API 限流。可在本机设置 GITHUB_TOKEN，并导出 SKILLS_REMOTE_USE_GITHUB_TOKEN=1 后重试公开仓库",
    );
  }
  if (!res.ok) {
    throw new RemoteSourceError(`无法读取仓库信息（HTTP ${res.status}）`);
  }
  const data = (await res.json()) as { default_branch?: string; private?: boolean };
  if (data.private) {
    throw new RemoteSourceError("暂不支持私有仓库");
  }
  const defaultBranch = data.default_branch?.trim() || "main";
  let commitSha: string | null = null;
  try {
    const refRes = await fetchWithTimeout(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(defaultBranch)}`,
      { headers: githubHeaders() },
    );
    if (refRes.ok) {
      const commit = (await refRes.json()) as { sha?: string };
      commitSha = commit.sha ?? null;
    }
  } catch {
    // ignore
  }
  return { defaultBranch, commitSha };
}

async function fetchGithubArchive(source: ResolvedRemoteSource): Promise<{
  buffer: Buffer;
  commitSha: string | null;
  defaultBranch: string | null;
  resolvedRef: string;
}> {
  const meta = await assertRepoIsPublic(source.owner, source.repo);
  const resolvedRef = source.ref?.trim() || meta.defaultBranch;
  let commitSha = meta.commitSha;

  if (source.ref?.trim()) {
    try {
      const refRes = await fetchWithTimeout(
        `https://api.github.com/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/commits/${encodeURIComponent(resolvedRef)}`,
        { headers: githubHeaders() },
      );
      if (refRes.ok) {
        const commit = (await refRes.json()) as { sha?: string };
        commitSha = commit.sha ?? null;
      }
    } catch {
      // ignore
    }
  }

  const apiZipUrl = `https://api.github.com/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/zipball/${encodeURIComponent(resolvedRef)}`;
  let res = await fetchWithTimeout(apiZipUrl, { headers: githubHeaders() });

  if (!res.ok) {
    const codeload = `https://codeload.github.com/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/zip/refs/heads/${encodeURIComponent(resolvedRef)}`;
    res = await fetchWithTimeout(codeload, {
      headers: { "User-Agent": "PromptMan-SkillsRemote/1.0" },
    });
  }
  if (!res.ok) {
    const tagUrl = `https://codeload.github.com/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}/zip/refs/tags/${encodeURIComponent(resolvedRef)}`;
    res = await fetchWithTimeout(tagUrl, {
      headers: { "User-Agent": "PromptMan-SkillsRemote/1.0" },
    });
  }
  if (!res.ok) {
    if (res.status === 404) {
      throw new RemoteSourceError(`无法下载 ${source.display}@${resolvedRef}（不存在或未公开）`);
    }
    throw new RemoteSourceError(`下载仓库失败（HTTP ${res.status}）`);
  }

  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_ZIP_BYTES) {
    throw new RemoteSourceError(`仓库压缩包过大（>${MAX_ZIP_BYTES / 1024 / 1024}MB）`);
  }
  const ab = await res.arrayBuffer();
  if (ab.byteLength > MAX_ZIP_BYTES) {
    throw new RemoteSourceError(`仓库压缩包过大（>${MAX_ZIP_BYTES / 1024 / 1024}MB）`);
  }
  if (!commitSha) {
    const cd = res.headers.get("content-disposition") || "";
    const m = cd.match(/filename=.+?-([0-9a-f]{7,40})\.zip/i);
    if (m) commitSha = m[1];
  }

  return {
    buffer: Buffer.from(ab),
    commitSha,
    defaultBranch: meta.defaultBranch,
    resolvedRef,
  };
}

function underSubpath(relPath: string, subpath: string | null): boolean {
  if (!subpath) return true;
  const prefix = subpath.replace(/\/+$/, "");
  return relPath === prefix || relPath.startsWith(`${prefix}/`);
}

export function discoverSkillsInArchive(
  buffer: Buffer,
  opts?: { subpath?: string | null; skillHint?: string | null },
): DiscoveredRemoteSkill[] {
  const entries = listZipRelEntries(buffer);
  const subpath = opts?.subpath ?? null;
  const skillHint = opts?.skillHint ?? null;

  const skillMdEntries = entries.filter((e) => {
    if (e.isDir || !underSubpath(e.relPath, subpath)) return false;
    const base = e.relPath.split("/").pop()?.toLowerCase() ?? "";
    return base === "skill.md";
  });

  if (skillMdEntries.length === 0) {
    throw new RemoteSourceError(
      subpath
        ? `在路径「${subpath}」下未找到 SKILL.md`
        : "仓库中未找到 SKILL.md（不符合 Agent Skills 规范）",
    );
  }

  let picked = skillMdEntries;
  if (subpath) {
    const exact = skillMdEntries.filter(
      (e) => e.relPath.replace(/\/skill\.md$/i, "") === subpath.replace(/\/+$/, ""),
    );
    if (exact.length === 1) picked = exact;
  }

  const discovered: DiscoveredRemoteSkill[] = [];
  for (const entry of picked) {
    const segs = entry.relPath.split("/");
    segs.pop();
    const rootPath = segs.join("/");
    let text = "";
    try {
      text = entry.read().toString("utf8").replace(/^\uFEFF/, "");
    } catch {
      continue;
    }
    const fm = parseSkillFrontmatter(text);
    const folderName = rootPath.split("/").filter(Boolean).pop() || "skill";
    const name = (fm.name || folderName).trim();
    const fileCount = entries.filter(
      (e) =>
        !e.isDir &&
        (rootPath === ""
          ? true
          : e.relPath === rootPath || e.relPath.startsWith(`${rootPath}/`)),
    ).length;
    discovered.push({
      rootPath,
      name,
      description: (fm.description || "").trim(),
      skillMd: text,
      fileCount,
    });
  }

  let filtered = discovered;
  if (skillHint) {
    filtered = discovered.filter((d) =>
      matchSkillName({ name: d.name, rootPath: d.rootPath }, skillHint),
    );
    if (filtered.length === 0) {
      const available = discovered.map((d) => d.name).join(", ");
      throw new RemoteSourceError(
        `未找到 skill「${skillHint}」。可用：${available || "（无）"}`,
      );
    }
  }

  filtered.sort((a, b) => a.name.localeCompare(b.name));
  return filtered;
}

export async function previewRemoteSkills(input: string): Promise<RemotePreviewResult> {
  const source = resolveRemoteSource(input);
  const archive = await fetchGithubArchive(source);
  const skills = discoverSkillsInArchive(archive.buffer, {
    subpath: source.subpath,
    skillHint: source.skillHint,
  });
  return {
    source,
    commitSha: archive.commitSha,
    defaultBranch: archive.defaultBranch,
    skills,
    cliEquivalent: source.cliEquivalent,
  };
}

function persistImport(skillId: string, result: SkillPackageImportResult): void {
  setAgentSkillPackageIndex(skillId, {
    packageDir: result.packageDir,
    fileTree: result.fileTree,
    fileCount: result.fileCount,
    packageSize: result.packageSize,
  });
}

export async function installRemoteSkills(params: {
  source: string;
  rootPaths?: string[] | null;
  strategy?: DuplicateStrategy;
  libraryId?: string | null;
}): Promise<{ results: RemoteInstallResultItem[]; cliEquivalent: string; commitSha: string | null }> {
  const source = resolveRemoteSource(params.source);
  const archive = await fetchGithubArchive(source);
  const all = discoverSkillsInArchive(archive.buffer, {
    subpath: source.subpath,
    skillHint: source.skillHint,
  });
  const selected =
    params.rootPaths && params.rootPaths.length > 0
      ? all.filter((s) => params.rootPaths!.includes(s.rootPath))
      : all;
  if (selected.length === 0) {
    throw new RemoteSourceError("未选择任何 skill");
  }

  const strategy: DuplicateStrategy = params.strategy || "skip";
  const results: RemoteInstallResultItem[] = [];

  for (const skill of selected) {
    const cliEquivalent = `npx skills add ${source.display} --skill ${JSON.stringify(skill.name)}`;
    try {
      const existing = findCurrentAgentSkillByName(skill.name);
      if (existing && strategy === "skip") {
        results.push({
          status: "skipped",
          name: skill.name,
          rootPath: skill.rootPath,
          id: existing.skillId,
          cliEquivalent,
        });
        continue;
      }

      let skillGroupId: string;
      if (existing && strategy === "overwrite") {
        await updateAgentSkill(existing.id, {
          description: skill.description,
          template: skill.skillMd,
          libraryId: params.libraryId ?? existing.libraryId ?? null,
        });
        skillGroupId = existing.skillId;
        const imported = importZipSubsetToPackageDir(
          skillGroupId,
          archive.buffer,
          skill.rootPath,
        );
        persistImport(skillGroupId, imported);
        const current = await getCurrentAgentSkillBySkillId(skillGroupId);
        if (current && imported.skillMd.trim()) {
          await updateAgentSkill(current.id, { template: imported.skillMd });
        }
        results.push({
          status: "updated",
          name: skill.name,
          rootPath: skill.rootPath,
          id: skillGroupId,
          cliEquivalent,
        });
      } else {
        const suffix = existing && strategy === "copy" ? `-${Date.now().toString(36)}` : "";
        const rowId = `skill-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        await createAgentSkill({
          id: rowId,
          name: `${skill.name}${suffix}`,
          description: skill.description,
          category: "",
          libraryId: params.libraryId ?? null,
          template: skill.skillMd,
        });
        const row = await getAgentSkill(rowId);
        if (!row) throw new RemoteSourceError("创建技能后未能读取记录");
        skillGroupId = row.skillId;
        const imported = importZipSubsetToPackageDir(
          skillGroupId,
          archive.buffer,
          skill.rootPath,
        );
        persistImport(skillGroupId, imported);
        results.push({
          status: "created",
          name: row.name,
          rootPath: skill.rootPath,
          id: skillGroupId,
          cliEquivalent,
        });
      }

      setAgentSkillSource(skillGroupId, {
        sourceType: "github",
        sourceRef: source.display,
        sourceSkill: skill.name,
        sourceCommit: archive.commitSha,
      });
    } catch (e) {
      results.push({
        status: "failed",
        name: skill.name,
        rootPath: skill.rootPath,
        error: e instanceof Error ? e.message : String(e),
        cliEquivalent,
      });
    }
  }

  return {
    results,
    cliEquivalent: source.cliEquivalent,
    commitSha: archive.commitSha,
  };
}
