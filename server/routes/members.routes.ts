/**
 * Members 路由（对齐 api-contract.md）。
 */

import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';

interface MemberRow {
  id: string;
  name: string;
  role: string;
  contact: string | null;
  avatar_color: string;
  active: number;
  /** v0.2 角色种类：'admin' | 'member' */
  role_kind: string;
  revision: number;
  updated_at: string;
}

function rowToMember(r: MemberRow): Record<string, unknown> {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    contact: r.contact,
    avatarColor: r.avatar_color,
    active: Boolean(r.active),
    // 与前端 memberSchema 一致：非法/缺失一律归一 'member'，保证导入后运行时不为 undefined
    roleKind: r.role_kind === 'admin' ? 'admin' : 'member',
    revision: r.revision,
    updatedAt: r.updated_at,
  };
}

const nowIso = (): string => new Date().toISOString();

export function registerMemberRoutes(app: FastifyInstance, db: Database.Database): void {
  // GET /members?includeInactive=1
  app.get('/api/members', async (req) => {
    const { includeInactive } = req.query as { includeInactive?: string };
    let rows = db.prepare('SELECT * FROM members').all() as MemberRow[];
    if (includeInactive !== '1') rows = rows.filter((r) => r.active === 1);
    return rows.map(rowToMember);
  });

  // GET /members/:id
  app.get('/api/members/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as MemberRow | undefined;
    if (!row) {
      void reply.status(404);
      return { error: { code: 'not_found', userMessage: '成员不存在' } };
    }
    return rowToMember(row);
  });

  // POST /members
  app.post('/api/members', async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    const name = String(b.name ?? '').trim();
    if (!name) {
      void reply.status(400);
      return { error: { code: 'validation', userMessage: '成员姓名不能为空' } };
    }
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO members (id, name, role, contact, avatar_color, active, role_kind, revision, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, 1, ?)`,
    ).run(
      id,
      name,
      String(b.role ?? ''),
      (b.contact as string | null) ?? null,
      String(b.avatarColor ?? '#3D6B5B'),
      b.roleKind === 'admin' ? 'admin' : 'member',
      nowIso(),
    );
    const row = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as MemberRow;
    return rowToMember(row);
  });

  // PATCH /members/:id
  app.patch('/api/members/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as MemberRow | undefined;
    if (!existing) {
      void reply.status(404);
      return { error: { code: 'not_found', userMessage: '成员不存在' } };
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const merged: MemberRow = {
      ...existing,
      name: b.name !== undefined ? String(b.name) : existing.name,
      role: b.role !== undefined ? String(b.role) : existing.role,
      contact: b.contact !== undefined ? (b.contact as string | null) : existing.contact,
      avatar_color: b.avatarColor !== undefined ? String(b.avatarColor) : existing.avatar_color,
      active: b.active !== undefined ? (b.active ? 1 : 0) : existing.active,
      role_kind: b.roleKind !== undefined ? String(b.roleKind) : existing.role_kind,
      revision: existing.revision + 1,
      updated_at: nowIso(),
    };
    db.prepare(
      'UPDATE members SET name=?, role=?, contact=?, avatar_color=?, active=?, role_kind=?, revision=?, updated_at=? WHERE id=?',
    ).run(
      merged.name,
      merged.role,
      merged.contact,
      merged.avatar_color,
      merged.active,
      merged.role_kind,
      merged.revision,
      merged.updated_at,
      id,
    );
    return rowToMember(merged);
  });
}
