/**
 * ID Plan · Electron 预加载脚本
 * 通过 contextBridge 向渲染进程暴露最小化、安全的能力（当前仅应用信息）。
 */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('idplan', {
  /** 应用标识（供前端识别运行在桌面端） */
  isDesktop: true,
  platform: process.platform,
  version: process.env.npm_package_version || '0.2.0',
});
