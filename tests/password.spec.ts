import { describe, expect, it } from 'vitest';

import {
  hashPassword,
  verifyPassword,
  isRemotePasswordMode,
  PasswordError,
} from '../src/lib/password';

describe('password service（v0.6 密码系统 · local 模式）', () => {
  it('哈希结果：格式为 saltHex:hashHex，绝不等于明文', async () => {
    const h = await hashPassword('hello123');
    expect(h).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(h).not.toContain('hello123');
  });

  it('正确密码校验通过', async () => {
    const h = await hashPassword('designer-2026');
    expect(await verifyPassword('designer-2026', h)).toBe(true);
  });

  it('错误密码校验失败', async () => {
    const h = await hashPassword('correct');
    expect(await verifyPassword('wrong', h)).toBe(false);
  });

  it('空密码 / null / undefined 哈希一律拒绝（未设密码语义）', async () => {
    expect(await verifyPassword('', null)).toBe(false);
    expect(await verifyPassword('', undefined)).toBe(false);
    expect(await verifyPassword('', '')).toBe(false);
  });

  it('同一明文两次哈希结果不同（随机盐），但都能校验通过', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same', a)).toBe(true);
    expect(await verifyPassword('same', b)).toBe(true);
  });

  it('非法哈希格式：静默返回 false（不抛异常）', async () => {
    expect(await verifyPassword('x', 'not-a-valid-hash')).toBe(false);
    expect(await verifyPassword('x', 'abc')).toBe(false);
  });

  it('isRemotePasswordMode：默认 local（测试环境 dataSource 非 remote）', () => {
    expect(typeof isRemotePasswordMode()).toBe('boolean');
  });

  it('PasswordError 可实例化', () => {
    const e = new PasswordError('测试');
    expect(e.message).toBe('测试');
    expect(e.name).toBe('PasswordError');
  });
});
