/**
 * 前端密码服务（v0.6 密码系统 · local 模式）。
 *
 * 设计原则：
 *   - 仅存哈希，绝不落明文。哈希格式统一为 `saltHex:hashHex`（salt 随机 16B + PBKDF2-SHA256 输出 32B）。
 *   - 本地模式（Dexie）：用 Web Crypto `crypto.subtle` 做 PBKDF2-SHA256，浏览器原生无依赖。
 *   - remote 模式不经过本文件：密码由服务端 `crypto.scrypt` 比对（见 server/routes/members.routes.ts
 *     的 POST /api/members/verify），前端只发明文拿 200/401，密码绝不下发客户端。
 *   - 本文件与远端 verify 端点保持「同协议不同算法」——本地 PBKDF2、远端 scrypt，二者互不串用，
 *     由 `VITE_DATA_SOURCE` 分流（appEnv.dataSource）。
 *
 * 算法参数（固定，勿改——改了会导致既有哈希无法校验）：
 *   iterations = 210_000（OWASP 2023 推荐 PBKDF2-SHA256 ≥ 210k），
 *   keyLength = 256 bit（派生 32B → hex 64 字符），digest = SHA-256，salt = 16B crypto.getRandomValues。
 *   存储格式 `saltHex(32字符):hashHex(64字符)`。
 */

import { appEnv } from '../config/env';

const ITERATIONS = 210_000;
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;

/** TextEncoder 复用（不创建多份） */
const encoder = new TextEncoder();

/** 统一错误（业务无关，仅密码校验失败/服务不可用） */
export class PasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PasswordError';
  }
}

/** 当前是否运行在 remote 模式（密码校验应走后端 verify 端点） */
export const isRemotePasswordMode = (): boolean => appEnv.dataSource === 'remote';

/** 生成加密安全随机 salt（hex） */
function randomSaltHex(): string {
  const bytes = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Web Crypto PBKDF2-SHA256 派生 */
async function deriveKey(password: string, saltHex: string): Promise<string> {
  const salt = new Uint8Array(saltHex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH_BITS,
  );
  const hashBytes = new Uint8Array(bits);
  return Array.from(hashBytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 明文密码 → `saltHex:hashHex`（新密码 / 重置密码时调用） */
export async function hashPassword(plain: string): Promise<string> {
  const saltHex = randomSaltHex();
  const hashHex = await deriveKey(plain, saltHex);
  return `${saltHex}:${hashHex}`;
}

/** 校验明文密码是否匹配某 passwordHash（null/空 → 视为未设密码，恒 false） */
export async function verifyPassword(plain: string, passwordHash: string | null | undefined): Promise<boolean> {
  if (!plain || !passwordHash) return false;
  const idx = passwordHash.indexOf(':');
  if (idx <= 0) return false;
  const saltHex = passwordHash.slice(0, idx);
  const expectedHex = passwordHash.slice(idx + 1);
  try {
    const actualHex = await deriveKey(plain, saltHex);
    // 恒时比较（避免时序侧信道）
    return timingSafeEqualHex(expectHexToBytes(actualHex), expectHexToBytes(expectedHex));
  } catch {
    return false;
  }
}

/** hex → Uint8Array（非法 hex 抛错由调用方捕获） */
function expectHexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []);
}

/** 恒时比较两个字节数组（长度不同立即 false，否则逐位异或累计） */
function timingSafeEqualHex(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}
