#!/bin/sh
# =====================================================================
# ID Plan · 容器启动时渲染运行时配置（绿联移植接口）
# 用容器环境变量覆盖 window.__APP_ENV__，写回 nginx 静态目录。
# 默认：local 数据源（浏览器 IndexedDB），无需后端。
# =====================================================================
set -e

SRC=/etc/nginx/templates/env-config.template.js
OUT=/usr/share/nginx/html/env-config.js

DS_LOCAL="${VITE_DATA_SOURCE:-local}"
API="${VITE_API_BASE_URL:-}"

sed "s|@@VITE_DATA_SOURCE@@|${DS_LOCAL}|g; s|@@VITE_API_BASE_URL@@|${API}|g" "$SRC" > "$OUT"

echo "[idplan-env] runtime env-config written: VITE_DATA_SOURCE=${DS_LOCAL} VITE_API_BASE_URL=${API}"
