// 运行时配置模板：entrypoint 用环境变量渲染后写到 /usr/share/nginx/html/env-config.js
// 该文件在浏览器加载 index.html 前执行，覆盖 window.__APP_ENV__，
// 实现「不重建镜像即可在 local / remote 数据源间切换」的绿联移植接口。
// 默认值见下方 @@VITE_DATA_SOURCE@@ / @@VITE_API_BASE_URL@@ 占位符。
window.__APP_ENV__ = {
  VITE_DATA_SOURCE: '@@VITE_DATA_SOURCE@@',
  VITE_API_BASE_URL: '@@VITE_API_BASE_URL@@'
};
