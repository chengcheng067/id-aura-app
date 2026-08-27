/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Vite 配置。
 *
 * - pdfjs worker：在 src/core/file-extractors/pdf.extractor.ts 内以
 *   `import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` 方式注入，
 *   无需额外的 worker 插件；如遇兼容问题可退化为 legacy build。
 * - vitest：测试运行在 node 环境（fake-indexeddb 补齐 IndexedDB），
 *   设置文件 tests/setup.ts 只负责挂载 fake-indexeddb。
 */
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    // mammoth / pdfjs 体量大且为按需动态加载，放宽分包警告阈值
    chunkSizeWarningLimit: 1600,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    setupFiles: ['./tests/setup.ts'],
    globals: false,
    // 稳定单 worker：本机默认 forks 多 worker 并行时偶发静默崩溃（无输出退出码 1），
    // 单线程串行可复现全绿（9 spec / 106 用例）；fake-indexeddb 为 node_modules 级单例，
    // 各 spec 内已通过「清库重建」自隔离，串行无状态污染。
    pool: 'threads',
    poolOptions: {
      threads: { singleThread: true },
    },
  },
});
