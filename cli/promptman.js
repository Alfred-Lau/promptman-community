#!/usr/bin/env node
'use strict';

/**
 * promptman —— PromptMan 桌面版只读 CLI(本地 Prompt / Skill 库读取)
 *
 * 通过 PromptMan 桌面应用的本地 HTTP API(http://127.0.0.1:38472,由
 * electron/main/extensionServer.ts 提供)访问本机提示词与 Agent Skills,
 * 只读,不直连数据库。AI agent(Claude Code / Codex / 脚本)可直接调用。
 *
 * 用法:
 *   promptman health                      桌面应用是否运行(未运行默认尝试拉起并等待)
 *   promptman prompts list [--limit N]    当前提示词列表(默认 20 条)
 *   promptman prompts get <id>            单条提示词(含正文)
 *   promptman prompts search <query>      语义搜索提示词(默认 10 条)
 *   promptman prompts versions <id>       指定提示词的版本历史(<id> 为 promptId/版本组 id)
 *   promptman skills list|get|search|versions ...   同上,资源为 Agent Skills
 *
 * 选项:
 *   --json       机器可读:原样输出 API 的 JSON 响应
 *   --no-launch  app 未运行时跳过自动拉起,直接报错退出
 *   --limit N    仅 list 生效,默认 20
 *   环境变量 PROMPTMAN_API_URL 可覆盖 API 地址(默认 http://127.0.0.1:38472,本地开发/测试用)
 *
 * 鉴权:自动读取 ~/.promptman/cli-token 并附加 `Authorization: Bearer <token>`。
 *       token 由桌面版首次启动时生成(0600 权限);缺失时请先启动一次 PromptMan 桌面版。
 *
 * 退出码:0 成功 / 1 其他错误 / 3 app 未运行且拉起失败或超时 / 4 CLI token 缺失 / 5 API 401
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_API_URL = 'http://127.0.0.1:38472';
const LAUNCH_WAIT_MS = 15000; // 拉起后轮询 health 的最长等待
const LAUNCH_POLL_MS = 500;
const REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_LIST_LIMIT = 20;
const SEARCH_LIMIT = 10;

const API_BASE = (process.env.PROMPTMAN_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
const TOKEN_PATH = path.join(os.homedir(), '.promptman', 'cli-token');

// ---------------------------------------------------------------- 基础工具

class UsageError extends Error {}

function err(msg) {
  process.stderr.write(`promptman: ${msg}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readCliToken() {
  try {
    const token = fs.readFileSync(TOKEN_PATH, 'utf8').trim();
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** stdout 输出且确保结尾换行(供管道/机器读取) */
function emit(text) {
  const out = text.endsWith('\n') ? text : text + '\n';
  process.stdout.write(out);
}

// ---------------------------------------------------------------- HTTP 请求

/**
 * GET 本地 API。网络层错误(连接拒绝/超时等)通过 netError 返回,由调用方
 * 决定是否尝试拉起桌面应用;HTTP 状态码始终透传。
 */
function apiRequest(pathname, query) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(API_BASE + pathname);
    } catch (e) {
      resolve({ status: 0, text: '', netError: e });
      return;
    }
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      resolve({ status: 0, text: '', netError: new Error(`不支持的协议: ${url.protocol}(仅支持 http/https)`) });
      return;
    }
    const mod = url.protocol === 'https:' ? https : http;
    const headers = { Accept: 'application/json' };
    const token = readCliToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const req = mod.request(
      url,
      { method: 'GET', headers, timeout: REQUEST_TIMEOUT_MS },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode || 0, text: Buffer.concat(chunks).toString('utf8'), netError: null })
        );
      }
    );
    req.on('timeout', () => req.destroy(new Error('请求超时')));
    req.on('error', (e) => resolve({ status: 0, text: '', netError: e }));
    req.end();
  });
}

// ---------------------------------------------------------------- 拉起与轮询

function launchApp() {
  if (process.platform === 'darwin') {
    try {
      const child = spawn('open', ['-a', 'PromptMan'], { stdio: 'ignore', detached: true });
      child.on('error', () => {});
      child.unref();
    } catch {
      /* 忽略 */
    }
    return true;
  }
  return false; // 非 macOS 不支持自动拉起
}

async function waitForApp(ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const r = await apiRequest('/api/health');
    if (!r.netError && r.status === 200) return true;
    await sleep(LAUNCH_POLL_MS);
  }
  return false;
}

/**
 * app 未响应时的恢复:打印提示 → 尝试拉起(macOS open -a PromptMan)→ 轮询
 * health 最多 15s。返回 true 表示 app 已就绪;false 表示失败(调用方退出码 3)。
 */
async function recoverApp(cfg) {
  if (cfg.noLaunch) {
    err('PromptMan 桌面版未运行(已指定 --no-launch,跳过拉起),请先启动桌面版再重试');
    return false;
  }
  if (!launchApp()) {
    err('PromptMan 桌面版未运行,且当前平台不支持自动拉起,请手动启动后重试');
    return false;
  }
  process.stderr.write('promptman: PromptMan 桌面版未运行,正在尝试拉起并等待就绪…\n');
  if (await waitForApp(LAUNCH_WAIT_MS)) return true;
  err(`PromptMan 桌面版拉起后 ${Math.round(LAUNCH_WAIT_MS / 1000)}s 内仍未就绪`);
  return false;
}

/** 统一处理服务端错误响应(非 200) */
function emitServerError(r) {
  const body = tryParse(r.text);
  const msg =
    body && typeof body.error === 'string' ? body.error : r.text ? r.text.slice(0, 300) : '无响应内容';
  err(`API 返回 ${r.status}: ${msg}`);
}

// ---------------------------------------------------------------- 子命令

async function cmdHealth(cfg) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await apiRequest('/api/health');
    if (r.netError) {
      if (attempt === 0 && (await recoverApp(cfg))) continue;
      return 3; // app 未运行(拉起失败/超时/已跳过拉起)
    }
    if (r.status === 401) {
      err('鉴权失败(401):请重启一次 PromptMan 桌面版后重试');
      return 5;
    }
    if (r.status !== 200) {
      emitServerError(r);
      return 1;
    }
    const body = tryParse(r.text);
    const version = body && typeof body.version === 'string' ? body.version : '?';
    if (cfg.json) {
      emit(r.text);
    } else {
      emit(`PromptMan 桌面版: 运行中 (v${version})`);
    }
    return 0;
  }
  return 3;
}

// ---- 人类可读打印(字段以 extensionServer / sqlitedb 实际响应为准)----

function fmtTags(meta) {
  return Array.isArray(meta.tags) && meta.tags.length ? meta.tags.join(', ') : '-';
}

function humanList(kind, body, withDistance) {
  const data = body && typeof body.data === 'object' && body.data ? body.data : {};
  const ids = Array.isArray(data.ids) ? data.ids : [];
  const metadatas = Array.isArray(data.metadatas) ? data.metadatas : [];
  const distances = Array.isArray(data.distances) ? data.distances : [];
  const label = kind === 'prompts' ? '提示词' : '技能';
  if (ids.length === 0) {
    emit(`${label}: (空)`);
    return;
  }
  emit(`${label} (${ids.length}):`);
  metadatas.forEach((m, i) => {
    const meta = m && typeof m === 'object' ? m : {};
    const title =
      kind === 'prompts' ? meta.title || '(无标题)' : meta.name || '(未命名)';
    const lib = typeof meta.libraryId === 'string' && meta.libraryId ? meta.libraryId : '默认';
    const tags = fmtTags(meta);
    const distance =
      withDistance && distances[i] !== undefined ? `  相似度:${Number(distances[i]).toFixed(4)}` : '';
    const desc = kind === 'skills' && meta.description ? `  ${meta.description}` : '';
    emit(`  ${i + 1}. ${title}${desc}  [id: ${ids[i]}]  [库: ${lib}]  [标签: ${tags}]${distance}`);
  });
}

function humanGet(kind, body, requestedId) {
  const m = body && typeof body.data === 'object' && body.data ? body.data : {};
  if (kind === 'prompts') {
    emit(`标题: ${m.title || ''}`);
    emit(`id: ${requestedId || m.promptId || ''}  promptId: ${m.promptId || ''}  v${m.version ?? '?'}${m.isCurrentVersion ? '  [当前]' : ''}`);
    emit(`库: ${m.libraryId || '默认'}  分类: ${m.category || '-'}  更新: ${m.updatedAt || m.createdAt || '-'}`);
    emit(`标签: ${fmtTags(m)}`);
    if (m.description) emit(`描述: ${m.description}`);
    if (m.changeNotes) emit(`变更说明: ${m.changeNotes}`);
    emit('--- 正文 ---');
    emit(`${m.content || '(空)'}`);
  } else {
    emit(`名称: ${m.name || ''}`);
    emit(`id: ${requestedId || m.skillId || ''}  skillId: ${m.skillId || ''}  v${m.version ?? '?'}${m.isCurrentVersion ? '  [当前]' : ''}`);
    emit(`库: ${m.libraryId || '默认'}  分类: ${m.category || '-'}  更新: ${m.updatedAt || m.createdAt || '-'}`);
    emit(`标签: ${fmtTags(m)}${Array.isArray(m.platforms) && m.platforms.length ? `  平台: ${m.platforms.join(', ')}` : ''}`);
    if (m.description) emit(`描述: ${m.description}`);
    if (m.changeNotes) emit(`变更说明: ${m.changeNotes}`);
    emit('--- SKILL.md / template ---');
    emit(`${m.template || '(空)'}`);
  }
}

function humanVersions(kind, body) {
  const list = Array.isArray(body && body.data) ? body.data : [];
  const label = kind === 'prompts' ? '提示词' : '技能';
  if (list.length === 0) {
    emit(`${label}版本: (空)`);
    return;
  }
  emit(`${label}版本 (${list.length}):`);
  list.forEach((v, i) => {
    const title = kind === 'prompts' ? v.title || '' : v.name || '';
    const notes = v.changeNotes ? `  说明: ${v.changeNotes}` : '';
    emit(`  ${i + 1}. v${v.version}${v.isCurrentVersion ? '  [当前]' : ''}  ${title}  id: ${v.id}  更新: ${v.updatedAt || v.createdAt || '-'}${notes}`);
  });
}

function humanResult(kind, sub, body, requestedId) {
  if (sub === 'list' || sub === 'search') humanList(kind, body, sub === 'search');
  else if (sub === 'get') humanGet(kind, body, requestedId);
  else humanVersions(kind, body);
}

// ---- 资源子命令(prompts / skills 同构)----

async function cmdEntity(cfg) {
  const { group, sub, args } = cfg;
  const isPrompts = group === 'prompts';
  const apiRoot = isPrompts ? '/api/prompts' : '/api/skills';

  let pathname;
  let query;
  let requestedId;
  switch (sub) {
    case 'list':
      pathname = `${apiRoot}/current`;
      query = { limit: cfg.limit };
      break;
    case 'search': {
      const q = args.join(' ').trim();
      if (!q) throw new UsageError(`用法: promptman ${group} search <query>`);
      pathname = `${apiRoot}/search`;
      query = { q, limit: SEARCH_LIMIT };
      break;
    }
    case 'get': {
      const id = (args[0] || '').trim();
      if (!id) throw new UsageError(`用法: promptman ${group} get <id>`);
      requestedId = id;
      pathname = `${apiRoot}/${encodeURIComponent(id)}`;
      break;
    }
    case 'versions': {
      const id = (args[0] || '').trim();
      if (!id) throw new UsageError(`用法: promptman ${group} versions <id>`);
      pathname = `${apiRoot}/versions/${encodeURIComponent(id)}`;
      break;
    }
    default:
      throw new UsageError(`未知子命令: ${group} ${sub || ''}\n\n${USAGE}`);
  }

  const token = readCliToken();
  if (!token) {
    err(`CLI token 不存在(${TOKEN_PATH}):请先启动一次 PromptMan 桌面版生成 CLI token,再运行本命令`);
    return 4;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await apiRequest(pathname, query);
    if (r.netError) {
      if (attempt === 0 && (await recoverApp(cfg))) continue;
      return 3;
    }
    if (r.status === 401) {
      err('鉴权失败(401):本机 CLI token 与桌面版不匹配,请重启一次 PromptMan 桌面版后重试');
      return 5;
    }
    if (r.status !== 200) {
      emitServerError(r);
      return 1;
    }
    if (cfg.json) {
      emit(r.text);
      return 0;
    }
    humanResult(group, sub, tryParse(r.text), requestedId);
    return 0;
  }
  return 3;
}

// ---------------------------------------------------------------- 参数解析

const USAGE = `promptman —— PromptMan 桌面版只读 CLI

用法:
  promptman health [--no-launch] [--json]
  promptman prompts list [--limit N] [--json]
  promptman prompts get <id> [--json]
  promptman prompts search <query> [--json]
  promptman prompts versions <id> [--json]
  promptman skills list|get|search|versions ...  (与 prompts 同构)

选项:
  --json       机器可读输出(原样输出 API JSON)
  --no-launch  app 未运行时跳过自动拉起,直接报错
  --limit N    仅 list 生效,默认 ${DEFAULT_LIST_LIMIT}
  PROMPTMAN_API_URL 环境变量可覆盖 API 地址(默认 ${DEFAULT_API_URL})

退出码: 0 成功 | 1 其他错误 | 3 app 未运行(拉起失败/超时) | 4 CLI token 缺失 | 5 API 401
`;

function parseArgs(argv) {
  const cfg = {
    group: null,
    sub: null,
    args: [],
    json: false,
    noLaunch: false,
    limit: DEFAULT_LIST_LIMIT,
    help: false,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') cfg.json = true;
    else if (a === '--no-launch') cfg.noLaunch = true;
    else if (a === '--help' || a === '-h') cfg.help = true;
    else if (a === '--limit') {
      const v = argv[++i];
      if (v === undefined || !/^\d+$/.test(v)) throw new UsageError('--limit 需要一个数字参数');
      cfg.limit = Math.min(Math.max(parseInt(v, 10), 1), 500);
    } else if (a.startsWith('--limit=')) {
      const v = a.slice('--limit='.length);
      if (!/^\d+$/.test(v)) throw new UsageError('--limit 需要一个数字参数');
      cfg.limit = Math.min(Math.max(parseInt(v, 10), 1), 500);
    } else if (a.startsWith('-') && a !== '-') {
      throw new UsageError(`未知参数: ${a}`);
    } else {
      positional.push(a);
    }
  }
  if (cfg.help || positional.length === 0) {
    cfg.help = true;
    return cfg;
  }
  cfg.group = positional[0];
  cfg.sub = positional[1] || null;
  cfg.args = positional.slice(2);
  return cfg;
}

// ---------------------------------------------------------------- 入口

async function main() {
  let cfg;
  try {
    cfg = parseArgs(process.argv.slice(2));
  } catch (e) {
    if (e instanceof UsageError) {
      err(e.message);
      process.exitCode = 1;
      return;
    }
    throw e;
  }

  if (cfg.help) {
    process.stdout.write(USAGE);
    return; // 无参数/--help → 帮助,退出码 0
  }

  let code = 1;
  try {
    if (cfg.group === 'health') {
      code = await cmdHealth(cfg);
    } else if (cfg.group === 'prompts' || cfg.group === 'skills') {
      if (!cfg.sub) throw new UsageError(`用法: promptman ${cfg.group} <list|get|search|versions> …\n\n${USAGE}`);
      code = await cmdEntity(cfg);
    } else {
      throw new UsageError(`未知命令: ${cfg.group}\n\n${USAGE}`);
    }
  } catch (e) {
    if (e instanceof UsageError) {
      err(e.message);
      code = 1;
    } else {
      err(`意外错误: ${e && e.stack ? e.stack : String(e)}`);
      code = 1;
    }
  }
  process.exitCode = code;
}

main();
