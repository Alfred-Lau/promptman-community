/**
 * SQLite Schema 定义
 * 包含所有实体的建表 SQL 和索引
 */

export const SCHEMA_SQL = `
-- ==================== 向量 embeddings 表（所有实体共用）====================
CREATE TABLE IF NOT EXISTS embeddings (
  id         TEXT NOT NULL,
  collection TEXT NOT NULL,
  vec        BLOB NOT NULL,
  PRIMARY KEY (id, collection)
);
CREATE INDEX IF NOT EXISTS idx_embeddings_collection ON embeddings(collection);

-- ==================== prompts 表 ====================
CREATE TABLE IF NOT EXISTS prompts (
  id                 TEXT PRIMARY KEY,
  prompt_id          TEXT NOT NULL,
  title              TEXT NOT NULL,
  content            TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  category           TEXT NOT NULL DEFAULT '',
  tags               TEXT NOT NULL DEFAULT '[]',
  change_notes       TEXT NOT NULL DEFAULT '',
  version            INTEGER NOT NULL DEFAULT 1,
  is_current_version INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  cloud_id           TEXT,
  is_starred          INTEGER NOT NULL DEFAULT 0,
  uses                INTEGER NOT NULL DEFAULT 0,
  last_used_at        TEXT,
  accent              TEXT NOT NULL DEFAULT '#f59e0b',
  is_public           INTEGER NOT NULL DEFAULT 0,
  -- 结构化指导字段（prompt-as-code 模板规范：何时用/怎么用/避坑），JSON string[]
  use_when            TEXT NOT NULL DEFAULT '[]',
  guidance            TEXT NOT NULL DEFAULT '[]',
  pitfalls            TEXT NOT NULL DEFAULT '[]',
  -- 代表性模型输出案例（与模型对比测试联动），JSON PromptExampleOutput[]
  example_outputs     TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_prompts_prompt_id     ON prompts(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompts_current       ON prompts(prompt_id, is_current_version);

-- ==================== agent_skills 表 ====================
CREATE TABLE IF NOT EXISTS agent_skills (
  id                 TEXT PRIMARY KEY,
  skill_id           TEXT NOT NULL,
  name               TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  category           TEXT NOT NULL DEFAULT '',
  template           TEXT NOT NULL DEFAULT '',
  parameters         TEXT NOT NULL DEFAULT '{}',
  examples           TEXT NOT NULL DEFAULT '[]',
  tags               TEXT NOT NULL DEFAULT '[]',
  version            INTEGER NOT NULL DEFAULT 1,
  is_current_version INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  is_starred          INTEGER NOT NULL DEFAULT 0,
  uses                INTEGER NOT NULL DEFAULT 0,
  last_used_at        TEXT,
  accent              TEXT NOT NULL DEFAULT '#6ee7f7',
  is_public           INTEGER NOT NULL DEFAULT 0,
  -- 云端对齐字段（/api/skills）
  platforms           TEXT NOT NULL DEFAULT '[]',      -- JSON string[]，兼容平台
  is_active           INTEGER NOT NULL DEFAULT 1,
  version_label       TEXT NOT NULL DEFAULT 'v1.0',    -- 云端自由文本版本号（与本地整数 version 无关）
  cloud_id            TEXT,
  -- 外部目录同步来源（fs-scan）：源 SKILL.md 的绝对路径，用于编辑/删除写回磁盘与反查
  source_path         TEXT,
  -- 多文件技能包（真实文件落在 <dataRoot>/skill-packages/<skill_id>/，此处只存索引）
  package_dir         TEXT,
  file_tree           TEXT NOT NULL DEFAULT '[]',      -- JSON SkillFileNode[]
  file_count          INTEGER NOT NULL DEFAULT 0,
  package_size        INTEGER NOT NULL DEFAULT 0,
  -- 远程安装溯源（本地记录，无云依赖）
  source_type         TEXT NOT NULL DEFAULT '',
  source_ref          TEXT NOT NULL DEFAULT '',
  source_skill        TEXT NOT NULL DEFAULT '',
  source_commit       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_agent_skills_skill_id ON agent_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_current  ON agent_skills(skill_id, is_current_version);

-- ==================== sub_agents 表 ====================
CREATE TABLE IF NOT EXISTS sub_agents (
  id                  TEXT PRIMARY KEY,
  sub_agent_id        TEXT NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  category            TEXT NOT NULL DEFAULT '',
  type                TEXT NOT NULL DEFAULT 'generalPurpose',
  model               TEXT NOT NULL DEFAULT '',
  instructions        TEXT NOT NULL DEFAULT '',
  tools               TEXT NOT NULL DEFAULT '[]',
  handoff_conditions  TEXT NOT NULL DEFAULT '',
  input_schema        TEXT NOT NULL DEFAULT '{}',
  output_format       TEXT NOT NULL DEFAULT '',
  max_tokens          INTEGER NOT NULL DEFAULT 0,
  temperature         REAL NOT NULL DEFAULT 0,
  tags                TEXT NOT NULL DEFAULT '[]',
  version             INTEGER NOT NULL DEFAULT 1,
  is_current_version  INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sub_agents_sub_agent_id ON sub_agents(sub_agent_id);
CREATE INDEX IF NOT EXISTS idx_sub_agents_current      ON sub_agents(sub_agent_id, is_current_version);

-- ==================== agent_teams 表 ====================
CREATE TABLE IF NOT EXISTS agent_teams (
  id                   TEXT PRIMARY KEY,
  team_id              TEXT NOT NULL,
  name                 TEXT NOT NULL,
  description          TEXT NOT NULL DEFAULT '',
  category             TEXT NOT NULL DEFAULT '',
  display_mode         TEXT NOT NULL DEFAULT 'auto',
  lead_instructions    TEXT NOT NULL DEFAULT '',
  lead_model           TEXT NOT NULL DEFAULT '',
  delegate_mode        INTEGER NOT NULL DEFAULT 0,
  require_plan_approval INTEGER NOT NULL DEFAULT 0,
  teammates            TEXT NOT NULL DEFAULT '[]',
  task_template        TEXT NOT NULL DEFAULT '',
  quality_gates        TEXT NOT NULL DEFAULT '',
  max_teammates        INTEGER NOT NULL DEFAULT 5,
  tags                 TEXT NOT NULL DEFAULT '[]',
  version              INTEGER NOT NULL DEFAULT 1,
  is_current_version   INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_teams_team_id ON agent_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_agent_teams_current ON agent_teams(team_id, is_current_version);

-- ==================== sites 表 ====================
CREATE TABLE IF NOT EXISTS sites (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL DEFAULT '',
  preview_url TEXT NOT NULL DEFAULT '',
  thumbnail   TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT '[]',
  tags        TEXT NOT NULL DEFAULT '[]',
  framework   TEXT NOT NULL DEFAULT '',
  added_at    TEXT NOT NULL,
  featured    INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'approved'
);

-- ==================== components 表 ====================
CREATE TABLE IF NOT EXISTS components (
  id           TEXT PRIMARY KEY,
  site_id      TEXT NOT NULL,
  site_name    TEXT NOT NULL DEFAULT '',
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT '',
  code_example TEXT NOT NULL DEFAULT '',
  doc_url      TEXT NOT NULL DEFAULT '',
  tags         TEXT NOT NULL DEFAULT '[]',
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_components_site_id ON components(site_id);

-- ==================== 标签定义（prompts / agent_skills 的 tags JSON 存 id）====================
CREATE TABLE IF NOT EXISTS tag_definitions (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  dimension  TEXT NOT NULL DEFAULT '',
  color      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tag_definitions_name ON tag_definitions(name);

-- ==================== libraries 表 ====================
CREATE TABLE IF NOT EXISTS libraries (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT '📁',
  color       TEXT NOT NULL DEFAULT '#6366f1',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  parent_id           TEXT,
  share_token         TEXT,
  share_enabled       INTEGER NOT NULL DEFAULT 0
);
`;
