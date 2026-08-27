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
  due_date: string | null;
  order_index: number;
  revision: number;
  updated_at: string;
}

function rowToTask(r: TaskRow): Record<string, unknown> {
  return {
    id: r.id,
    projectId: r.project_id,
    stageId: r.stage_id,
    title: r.title,
    done: Boolean(r.done),
    assigneeId: r.assignee_id,
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
        (id, project_id, stage_id, title, done, assignee_id, due_date, order_index, revision, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const tx = db.transaction((list: Array<Record<string, unknown>>) => {
      for (const t of list) {
        insert.run(
          String(t.id),
          String(t.projectId),
          String(t.stageId),
          String(t.title),
          t.done ? 1 : 0,
          (t.assigneeId as string | null) ?? null,
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
    db.prepare(
      `INSERT INTO tasks
        (id, project_id, stage_id, title, done, assignee_id, due_date, order_index, revision, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, 1, ?)`,
    ).run(
      id,
      String(b.projectId),
      String(b.stageId),
      title,
      (b.assigneeId as string | null) ?? null,
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
    const merged: TaskRow = {
      ...existing,
      title: b.title !== undefined ? String(b.title) : existing.title,
      done: b.done !== undefined ? (b.done ? 1 : 0) : existing.done,
      assignee_id: b.assigneeId !== undefined ? (b.assigneeId as string | null) : existing.assignee_id,
      due_date: b.dueDate !== undefined ? (b.dueDate as string | null) : existing.due_date,
      order_index: b.orderIndex !== undefined ? Number(b.orderIndex) : existing.order_index,
      revision: existing.revision + 1,
      updated_at: nowIso(),
    };
    db.prepare(
      `UPDATE tasks SET title=?, done=?, assignee_id=?, due_date=?, order_index=?,
        revision=?, updated_at=? WHERE id=?`,
    ).run(
      merged.title,
      merged.done,
      merged.assignee_id,
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
