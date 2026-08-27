/// <reference types="vite/client" />

/**
 * 环境变量类型声明（.env / .env.local）。
 * 切换数据源属于进程启动时的冷切换，不支持运行中热切换（架构决策）。
 */
interface ImportMetaEnv {
  /** local | remote，非法值回落 local */
  readonly VITE_DATA_SOURCE?: string;
  /** remote 模式的 API 前缀，如 http://192.168.1.10:7788/api */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
