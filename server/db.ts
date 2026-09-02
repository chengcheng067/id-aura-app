/**
 * better-sqlite3 初始化：WAL 模式 + DDL 执行。
 * schema 与 src/core/types/entities.ts 同构（见 schema.sql）。
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type ChangxiaServerDb = Database.Database;

/** 打开（不建表） */
export function openDb(filePath = process.env.CHANGXIA_DB ?? join(__dirname, 'changxia.db')): ChangxiaServerDb {
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * v2 列迁移：老库（v1 表结构）已存在时，CREATE TABLE IF NOT EXISTS 不会补列，
 * 会导致导入/写入报 "table X has no column named Y"。
 * 这里对已存在的表做幂等 ALTER TABLE ADD COLUMN，让老库自动升级到 v2，
 * 避免 NAS 升级场景必须删库重建（数据不可丢）。
 */
const V2_COLUMN_MIGRATIONS: ReadonlyArray<{ table: string; column: string; ddl: string }> = [
  { table: 'projects', column: 'stage_preset_key', ddl: 'ALTER TABLE projects ADD COLUMN stage_preset_key TEXT' },
  {
    table: 'projects',
    column: 'stage_template_version',
    ddl: 'ALTER TABLE projects ADD COLUMN stage_template_version INTEGER NOT NULL DEFAULT 0',
  },
  {
    table: 'projects',
    column: 'schedule_basis',
    ddl: "ALTER TABLE projects ADD COLUMN schedule_basis TEXT NOT NULL DEFAULT 'calendar'",
  },
  { table: 'stages', column: 'template_key', ddl: 'ALTER TABLE stages ADD COLUMN template_key TEXT' },
  { table: 'stages', column: 'color_index', ddl: 'ALTER TABLE stages ADD COLUMN color_index INTEGER' },
  {
    table: 'tasks',
    column: 'assignee_ids',
    ddl: "ALTER TABLE tasks ADD COLUMN assignee_ids TEXT NOT NULL DEFAULT '[]'",
  },
  {
    table: 'members',
    column: 'role_kind',
    ddl: "ALTER TABLE members ADD COLUMN role_kind TEXT NOT NULL DEFAULT 'member'",
  },
  {
    table: 'members',
    column: 'password_hash',
    ddl: 'ALTER TABLE members ADD COLUMN password_hash TEXT',
  },
];

function migrateV2Columns(db: ChangxiaServerDb): void {
  for (const m of V2_COLUMN_MIGRATIONS) {
    const cols = db.prepare(`PRAGMA table_info(${m.table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === m.column)) {
      db.exec(m.ddl);
    }
  }
}

/** 执行 DDL（幂等，CREATE TABLE IF NOT EXISTS + 老库 v2 列迁移） */
export function createDb(db: ChangxiaServerDb): void {
  const ddl = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(ddl);
  migrateV2Columns(db);
}
