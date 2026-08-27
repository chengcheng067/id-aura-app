-- 《长夏》SQLite DDL（与 src/core/types/entities.ts 同构）
-- 约定：时间一律 TEXT 存储 UTC ISO 8601 字符串；金额为元整数 REAL/INTEGER。

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  client_name TEXT NOT NULL DEFAULT '',
  contract_amount INTEGER,
  signed_at TEXT,
  planned_start_at TEXT NOT NULL,
  planned_end_at TEXT NOT NULL,
  cover_color TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  order_index INTEGER NOT NULL CHECK (order_index BETWEEN 1 AND 9),
  name TEXT NOT NULL,
  ratio_percent REAL NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  owner_id TEXT,
  visible INTEGER NOT NULL DEFAULT 1,
  resource_path TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stages_project ON stages(project_id, order_index);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  stage_id TEXT NOT NULL REFERENCES stages(id),
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  assignee_id TEXT,
  due_date TEXT,
  order_index INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_stage ON tasks(stage_id, done);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  contact TEXT,
  avatar_color TEXT NOT NULL DEFAULT '#3D6B5B',
  active INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

-- append-only
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  member_id TEXT,
  action TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assignments_task ON assignments(task_id);

-- append-only
CREATE TABLE IF NOT EXISTS stage_logs (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  old_start_at TEXT,
  new_start_at TEXT,
  old_end_at TEXT,
  new_end_at TEXT,
  reason TEXT,
  operator_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_stage ON stage_logs(stage_id);
CREATE INDEX IF NOT EXISTS idx_logs_project ON stage_logs(project_id);

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  file_name TEXT,
  raw_text_digest TEXT NOT NULL,
  parsed_result_json TEXT NOT NULL,
  confirmed_payload_json TEXT,
  created_by_manual INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
