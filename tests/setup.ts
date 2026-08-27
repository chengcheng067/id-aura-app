/**
 * Vitest 环境配置：node 环境 + fake-indexeddb 全局注入。
 *
 * 注意：必须在本文件顶层（setupFiles 执行期）就完成补丁——
 * Dexie 在 ES 模块加载时即捕获 indexedDB 引用，等到用例的
 * beforeAll 再挂载就来不及了。vitest 保证 setupFiles 先于
 * 测试文件及其依赖图执行，此处顶层 import 即可达标。
 */

import { indexedDB as fakeIndexedDB, IDBKeyRange as FakeIDBKeyRange } from 'fake-indexeddb';

const g = globalThis as unknown as Record<string, unknown>;
if (g.indexedDB === undefined) {
  g.indexedDB = fakeIndexedDB;
}
if (g.IDBKeyRange === undefined) {
  g.IDBKeyRange = FakeIDBKeyRange;
}

/** 兼容保留：补丁已在模块加载时生效，此函数仅作幂等确认。 */
export async function installFakeIndexedDB(): Promise<void> {
  const gNow = globalThis as unknown as Record<string, unknown>;
  if (gNow.indexedDB === undefined) {
    gNow.indexedDB = fakeIndexedDB;
  }
  if (gNow.IDBKeyRange === undefined) {
    gNow.IDBKeyRange = FakeIDBKeyRange;
  }
}
