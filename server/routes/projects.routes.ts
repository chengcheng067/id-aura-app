/**
 * Projects 路由（对齐 docs/api-contract.md）。
 */

import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';

interface ProjectRow {
  id: string;
  name: string;
  type: string;
  address: string;
  client_name: string;
  contract_amount: number | null;
  signed_at: string | null;
  planned_start_at: string;
  planned_end_at: string;
  cover_color: string | null;
  status: string;
  revision: number;
  updated_at: string;
}

/** snake_case 行 → 前端 camelCase 实体 */
export function rowToProject(r: ProjectRow): Record<string, unknown> {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    address: r.address,
    clientName: r.client_name,
    contractAmount: r.contract_amount,
    signedAt: r.signed_at,
    plannedStartAt: r.planned_start_at,
    plannedEndAt: r.planned_end_at,
    coverColor: r.cover_color,
    status: r.status,
    revision: r.revision,
    updatedAt: r.updated_at,
  };
}

const nowIso = (): string => new Date().toISOString();

export function registerProjectRoutes(app: FastifyInstance, db: Database.Database): void {
  // GET /projects?status=&keyword=
  app.get('/api/projects', async (req) => {
    const { status, keyword } = req.query as { status?: string; keyword?: string };
    let rows = db.prepare('SELECT * FROM projects').all() as ProjectRow[];
    if (status && status !== 'all') rows = rows.filter((r) => r.status === status);
    if (keyword) {
      const kw = keyword.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(kw) ||
          r.client_name.toLowerCase().includes(kw) ||
          r.address.toLowerCase().includes(kw),
      );
    }
    return rows.map(rowToProject);
  });

  // GET /projects/:id
  app.get('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
    if (!row) {
      void reply.status(404);
      return { error: { code: 'not_found', userMessage: '项目不存在' } };
    }
    return rowToProject(row);
  });

  // POST /projects
  app.post('/api/projects', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const id = (body.id as string) ?? crypto.randomUUID();
    const name = String(body.name ?? '').trim();
    if (!name) {
      void reply.status(400);
      return { error: { code: 'validation', userMessage: '项目名称不能为空' } };
    }
    db.prepare(
      `INSERT INTO projects
        (id, name, type, address, client_name, contract_amount, signed_at,
         planned_start_at, planned_end_at, cover_color, status, revision, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?)`,
    ).run(
      id,
      name,
      String(body.type ?? 'dining'),
      String(body.address ?? ''),
      String(body.clientName ?? ''),
      body.contractAmount == null ? null : Number(body.contractAmount),
      (body.signedAt as string | null) ?? null,
      String(body.plannedStartAt),
      String(body.plannedEndAt),
      (body.coverColor as string | null) ?? null,
      nowIso(),
    );
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow;
    return rowToProject(row);
  });

  // PATCH /projects/:id
  app.patch('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
    if (!existing) {
      void reply.status(404);
      return { error: { code: 'not_found', userMessage: '项目不存在' } };
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const merged: ProjectRow = {
      ...existing,
      name: b.name !== undefined ? String(b.name) : existing.name,
      type: b.type !== undefined ? String(b.type) : existing.type,
      address: b.address !== undefined ? String(b.address) : existing.address,
      client_name: b.clientName !== undefined ? String(b.clientName) : existing.client_name,
      contract_amount:
        b.contractAmount !== undefined ? (b.contractAmount as number | null) : existing.contract_amount,
      signed_at: b.signedAt !== undefined ? (b.signedAt as string | null) : existing.signed_at,
      cover_color: b.coverColor !== undefined ? (b.coverColor as string | null) : existing.cover_color,
      status: b.status !== undefined ? String(b.status) : existing.status,
      revision: existing.revision + 1,
      updated_at: nowIso(),
    };
    db.prepare(
      `UPDATE projects SET name=?, type=?, address=?, client_name=?, contract_amount=?,
        signed_at=?, cover_color=?, status=?, revision=?, updated_at=? WHERE id=?`,
    ).run(
      merged.name,
      merged.type,
      merged.address,
      merged.client_name,
      merged.contract_amount,
      merged.signed_at,
      merged.cover_color,
      merged.status,
      merged.revision,
      merged.updated_at,
      id,
    );
    return rowToProject(merged);
  });

  // POST /projects/:id/archive
  app.post('/api/projects/:id/archive', async (req) => {
    const { id } = req.params as { id: string };
    const { archived } = req.body as { archived: boolean };
    db.prepare(
      "UPDATE projects SET status=?, revision=revision+1, updated_at=? WHERE id=?",
    ).run(archived ? 'archived' : 'active', nowIso(), id);
    return { ok: true };
  });
}
