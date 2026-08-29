/**
 * Tasks 路由：组合过滤 CRUD + bulk（对齐 api-contract.md）。
 */

import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';

interface TaskRow {
  id: string;
  project_id: string;
  stage_id: string;
  title: string;
  done: number;
  assignee_id: string | null;
  /** v0.3 参与人全集，JSON 数组串（SQLite 无数组类型） */
  assignee_ids: string;
  due_date: string | null;
  order_index: number;
  revision: number;
  updated_at: string;
}

/** 反序列化：脏数据/空值一律回落 []，绝不因坏数据让整个查询 500 */
function parseAssigneeIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** 序列化：非数组一律回落 '[]' */
function serializeAssigneeIds(ids: unknown): string {
  if (!Array.isArray(ids)) return '[]';
  return JSON.stringify(ids.filter((x): x is string => typeof x === 'string'));
}

function rowToTask(r: TaskRow): Record<string, unknown> {
  return {
    id: r.id,
    projectId: r.project_id,
    stageId: r.stage_id,
    title: r.title,
    done: Boolean(r.done),
    assigneeId: r.assignee_id,
    assigneeIds: parseAssigneeIds(r.assignee_ids),
    dueDate: r.due_date,
    orderIndex: r.order_index,
    revision: r.revision,
    updatedAt: r.updated_at,
  };
}

const nowIso = (): string => new Date().toISOString();

export function registerTaskRoutes(app: FastifyInstance, db: Database.Database): void {
  // GET /tasks?projectId=&stageId=&assigneeId=&done=
  app.get('/api/tasks', async (req) => {
    const q = req.query as {
      projectId?: string;
      stageId?: string;
      assigneeId?: string;
      done?: string;
    };
    let rows = db.prepare('SELECT * FROM tasks').all() as TaskRow[];
    if (q.projectId) rows = rows.filter((r) => r.project_id === q.projectId);
    if (q.stageId) rows = rows.filter((r) => r.stage_id === q.stageId);
    if (q.assigneeId) rows = rows.filter((r) => r.assignee_id === q.assigneeId);
    if (q.done === 'true' || q.done === 'false') {
      const wantDone = q.done === 'true';
      rows = rows.filter((r) => Boolean(r.done) === wantDone);
    }
    return rows.map(rowToTask);
  });

  // POST /tasks/bulk
  app.post('/api/tasks/bulk', async (req) => {
    const { rows } = req.body as { rows: Array<Record<string, unknown>> };
    const insert = db.prepare(
      `INSERT INTO tasks
        (id, project_id, stage_id, title, done, assignee_id, assignee_ids, due_date, order_index, revision, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const tx = db.transaction((list: Array<Record<string, unknown>>) => {
      for (const t of list) {
        const ids = serializeAssigneeIds(t.assigneeIds);
        const idsArr = parseAssigneeIds(ids);
        insert.run(
          String(t.id),
          String(t.projectId),
          String(t.stageId),
          String(t.title),
          t.done ? 1 : 0,
          // 主负责人兼容语义：与前端一致，assigneeId = assigneeIds[0] ?? null
          (t.assigneeId as string | null) ?? idsArr[0] ?? null,
          ids,
          (t.dueDate as string | null) ?? null,
          Number(t.orderIndex ?? 1),
          Number(t.revision ?? 1),
          String(t.updatedAt ?? nowIso()),
        );
      }
    });
    tx(rows ?? []);
    return { ok: true, count: rows?.length ?? 0 };
  });

  // POST /tasks
  app.post('/api/tasks', async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    const title = String(b.title ?? '').trim();
    if (!title) {
      void reply.status(400);
      return { error: { code: 'validation', userMessage: '任务标题不能为空' } };
    }
    const id = crypto.randomUUID();
    const maxRow = db
      .prepare('SELECT MAX(order_index) AS m FROM tasks WHERE stage_id = ?')
      .get(String(b.stageId)) as { m: number | null };
    const ids = serializeAssigneeIds(b.assigneeIds);
    const idsArr = parseAssigneeIds(ids);
    db.prepare(
      `INSERT INTO tasks
        (id, project_id, stage_id, title, done, assignee_id, assignee_ids, due_date, order_index, revision, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 1, ?)`,
    ).run(
      id,
      String(b.projectId),
      String(b.stageId),
      title,
      (b.assigneeId as string | null) ?? idsArr[0] ?? null,
      ids,
      (b.dueDate as string | null) ?? null,
      (maxRow.m ?? 0) + 1,
      nowIso(),
    );
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow;
    return rowToTask(row);
  });

  // PATCH /tasks/:id
  app.patch('/api/tasks/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
    if (!existing) {
      void reply.status(404);
      return { error: { code: 'not_found', userMessage: '任务不存在' } };
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    // 参与人全集变更时，主负责人同步为 assigneeIds[0]（与前端 UI 保存语义一致）
    const nextIds = b.assigneeIds !== undefined ? serializeAssigneeIds(b.assigneeIds) : existing.assignee_ids;
    const nextAssigneeId =
      b.assigneeId !== undefined
        ? (b.assigneeId as string | null)
        : b.assigneeIds !== undefined
          ? parseAssigneeIds(nextIds)[0] ?? null
          : existing.assignee_id;
    const merged: TaskRow = {
      ...existing,
      title: b.title !== undefined ? String(b.title) : existing.title,
      done: b.done !== undefined ? (b.done ? 1 : 0) : existing.done,
      assignee_id: nextAssigneeId,
      assignee_ids: nextIds,
      due_date: b.dueDate !== undefined ? (b.dueDate as string | null) : existing.due_date,
      order_index: b.orderIndex !== undefined ? Number(b.orderIndex) : existing.order_index,
      revision: existing.revision + 1,
      updated_at: nowIso(),
    };
    db.prepare(
      `UPDATE tasks SET title=?, done=?, assignee_id=?, assignee_ids=?, due_date=?, order_index=?,
        revision=?, updated_at=? WHERE id=?`,
    ).run(
      merged.title,
      merged.done,
      merged.assignee_id,
      merged.assignee_ids,
      merged.due_date,
      merged.order_index,
      merged.revision,
      merged.updated_at,
      id,
    );
    return rowToTask(merged);
  });

  // DELETE /tasks/:id
  app.delete('/api/tasks/:id', async (req) => {
    const { id } = req.params as { id: string };
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return { ok: true };
  });
}
