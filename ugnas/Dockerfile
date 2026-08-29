# =====================================================================
# ID Plan · UGOS PRO Docker 应用镜像（多阶段）
# 阶段1：node 构建前端 dist；阶段2：nginx 托管静态资源 + 运行时注入配置
# =====================================================================

# ---------- 构建阶段 ----------
FROM node:20-alpine AS build
WORKDIR /app

# 依赖优先缓存。lockfile 不含 electron/electron-builder（桌面打包专用），
# 与 package.json 不同步，npm ci 会报 EUSAGE；因此这里直接 npm install
# （宽松解析、不要求 lock 严格同步），并用 ELECTRON_SKIP_BINARY_DOWNLOAD=1
# 跳过 electron 二进制下载（镜像不需要桌面运行时）。
# 注意：不设置全局 ignore-scripts，避免误伤 tailwind 等依赖各自的 postinstall。
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# 源码 + 构建（构建期 .env 仅作兜底；运行时以 env-config.js 覆盖）
COPY . .
# 不写 || 兜底：若构建失败要立刻报错，避免静默产出空目录。
# Vite 的 outDir 是 build-dist（见 vite.config.ts），运行时从该目录拷出。
RUN npm run build

# ---------- 运行阶段 ----------
FROM nginx:1.27-alpine
LABEL maintainer="chengcheng"

# 静态资源：Vite 构建产物（outDir=build-dist，见 vite.config.ts）
COPY --from=build /app/build-dist /usr/share/nginx/html

# nginx 配置（SPA 回退 + /env-config.js 运行时注入 + /api 反向代理占位）
# 注意：context 是仓库根，Dockerfile 在 ugnas/ 下，故引用 ugnas/nginx/... 与 ugnas/scripts/...
COPY ugnas/nginx/nginx.conf /etc/nginx/conf.d/default.conf
# 运行时配置模板（entrypoint 渲染）
COPY ugnas/nginx/env-config.template.js /etc/nginx/templates/env-config.template.js
COPY ugnas/scripts/entrypoint.sh /docker-entrypoint.d/99-idplan-env.sh
RUN chmod +x /docker-entrypoint.d/99-idplan-env.sh

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
