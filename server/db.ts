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

/** 执行 DDL（幂等，CREATE TABLE IF NOT EXISTS） */
export function createDb(db: ChangxiaServerDb): void {
  const ddl = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(ddl);
}
