# =====================================================================
# ID Plan · UGOS PRO Docker 应用镜像（多阶段）
# 阶段1：node 构建前端 dist；阶段2：nginx 托管静态资源 + 运行时注入配置
# =====================================================================

# ---------- 构建阶段 ----------
FROM node:20-alpine AS build
WORKDIR /app

# 依赖优先缓存
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# 源码 + 构建（构建期 .env 仅作兜底；运行时以 env-config.js 覆盖）
COPY . .
# 本地构建不经过 Docker 时，dist 由宿主机 vite build 产出；这里也支持容器内构建
RUN npm run build || (echo "container build skipped, using host dist" && exit 0)

# ---------- 运行阶段 ----------
FROM nginx:1.27-alpine
LABEL maintainer="chengcheng"

# 静态资源：Vite 构建产物（优先用宿主构建的 dist，避免容器内网络/依赖差异）
COPY --from=build /app/dist /usr/share/nginx/html

# nginx 配置（SPA 回退 + /env-config.js 运行时注入 + /api 反向代理占位）
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
# 运行时配置模板（entrypoint 渲染）
COPY nginx/env-config.template.js /etc/nginx/templates/env-config.template.js
COPY scripts/entrypoint.sh /docker-entrypoint.d/99-idplan-env.sh
RUN chmod +x /docker-entrypoint.d/99-idplan-env.sh

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
