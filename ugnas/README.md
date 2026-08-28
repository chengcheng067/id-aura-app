# ID Plan · 绿联 UGOS Pro 应用（Docker）

> ID Plan 移植为 UGOS PRO 原生应用的 **Docker 形态** 脚手架。
> 本目录包含：Docker 化部署骨架 + 可运行时切换数据源的移植接口，以及绿联 `ugcli` 打包配置。

---

## 1. 当前方案（先 Docker，后期再移植）

UGOS Pro 应用分两类：

| 形态 | 后端 | 适用 |
|---|---|---|
| **原生应用** | 仅 Go / C++ 等编译型语言 | 轻量单进程 |
| **Docker 应用** | 任意（镜像内自带运行时） | **本方案**，ID Plan 目前走这条 |

ID Plan 是纯前端 SPA（React + Vite + Dexie 离线存储、无后端），因此 Docker 镜像只需做一件事：**用 nginx 托管 `dist/` 静态产物** + 运行时注入数据源配置。

> 后期如需上原生应用：把 nginx 换成一个 Go 静态服务器壳（或心跳服务顶端口），`start_cmd: bin/idplan_serv --port=28080`，`is_docker_app: false`。前端零改动，接口已预留。

---

## 2. 目录结构

```
ugnas/
├── Dockerfile                 # 多阶段：node 构建 dist → nginx 托管 + 注入配置
├── project.yaml               # UGOS 应用配置（ugcli pack 使用）
├── docker-compose.yaml        # UGOS Docker 编排（rootfs_common 用）
├── .dockerignore              # 构建上下文忽略
├── nginx/
│   ├── nginx.conf             # SPA 回退 + /env-config.js + /api 代理占位
│   └── env-config.template.js # 运行时配置模板（entrypoint 渲染）
└── scripts/
    ├── entrypoint.sh          # 容器启动：渲染 window.__APP_ENV__ 写回 env-config.js
    └── pack.sh                # 一键打包：build dist → 导镜像 → ugcli pack
```

---

## 3. 绿联移植接口（运行时数据源切换）

**核心机制**：数据源配置从「构建期写死」改为「运行时注入」。

- 前端读取顺序：`window.__APP_ENV__`（健康检查/容器注入）→ `import.meta.env`（构建期兜底）。
- 运行时由容器内 `entrypoint.sh` 用环境变量渲染 `env-config.js`，nginx 以 `no-store` 提供，浏览器加载 index.html 前执行。

对应源码改动：
- `src/config/env.ts`：`readEnvConfig` 加 `runtime?` 参数，`appEnv` 优先读 `window.__APP_ENV__`。
- `index.html`：构建期占位 `window.__APP_ENV__ = { VITE_DATA_SOURCE: 'local', VITE_API_BASE_URL: '' }`。

**效果**：不重建镜像，仅改容器环境变量即可在 `local`（浏览器离线）/`remote`（NAS 后端 API 多端同步）间切换。

```bash
# 容器环境变量（docker-compose 或 UGOS 应用中心应用配置里填）
VITE_DATA_SOURCE=local    # local 或 remote
VITE_API_BASE_URL=        # remote 时必填，如 http://<nas-ip>:28080/api
```

> 数据层已具备 `createRepositories({ dataSource, apiBaseUrl })` 的 local(Dexie)/remote(REST) 双适配器，`apiBaseUrl` 即上述 `VITE_API_BASE_URL`，天然承接收口。

---

## 4. 本地 Docker 自测（需 Docker）

```bash
cd changxia/ugnas

# 1. 构建镜像
docker build -f Dockerfile -t idplan:local .

# 2. 本地起容器（数据源默认 local）
docker run --rm -p 28080:80 \
  -e VITE_DATA_SOURCE=local \
  idplan:local

# 3. 浏览器打开 http://localhost:28080
#    验证：控制台 window.__APP_ENV__ 应为 {VITE_DATA_SOURCE:"local",VITE_API_BASE_URL:""}
```

> 本机若无 Docker，可直接 `npm run build` 后 `npm run preview` 验证前端（env-config 注入已在 index.html 内置，逻辑一致）。

---

## 5. 绿联 UGOS Pro 打包上架

> 需先完成：申请开发者授权（序列号 + MAC + 管理员用户名 邮件联系绿联）；本机安装 `ugcli`。

### 5.1 构建产物 + 导镜像（pack.sh 已封装）
```bash
cd changxia && bash ugnas/scripts/pack.sh --build 1
```

### 5.2 手动步骤（等价）
```bash
# 1) 构建前端 + 镜像
cd changxia
npm run build
docker build -f ugnas/Dockerfile -t docker.io/chengcheng/idplan:0.1.0-amd64 --platform linux/amd64 .
docker build -f ugnas/Dockerfile -t docker.io/chengcheng/idplan:0.1.0-arm64 --platform linux/arm64 .

# 2) 导出 tar（放 rootfs_<arch>/images/）
docker save -o ugnas/rootfs_amd64/images/idplan-0.1.0-amd64.tar docker.io/chengcheng/idplan:0.1.0-amd64
docker save -o ugnas/rootfs_arm64/images/idplan-0.1.0-arm64.tar docker.io/chengcheng/idplan:0.1.0-arm64

# 3) ugcli 建项目（生成骨架 + project.yaml + rootfs 目录）
ugcli create com.chengcheng.idplan

# 4) 把 ugnas/project.yaml、docker-compose.yaml、图标就位
cp ugnas/project.yaml ./project.yaml
cp ugnas/docker-compose.yaml ./rootfs_common/docker-compose.yaml
# 图标：256×256 PNG <100KB，浅底+描边，套官方圆角模板 → rootfs_common/icon.png

# 5) 打包
ugcli pack --arch all --build 1
# 产物：build_dir/pkgs/upk/{amd64|arm64}_com.chengcheng.idplan_0.1.0.0001.upk
```

### 5.3 装机测试
1. NAS → 应用中心 → 手动安装 → 选 upk。
2. 需已完成开发者授权（授权文件 `ugdev.sig` 上传管理员个人文件夹；≥1.16.0.0000 在应用中心触发整机授权）。

---

## 6. project.yaml 关键字段说明

| 字段 | 值 | 说明 |
|---|---|---|
| `app_id` | `com.chengcheng.idplan` | 上架后不可改 |
| `version` | `0.1.0` | `ugcli pack --build N` 后最终 `0.1.0.N` |
| `is_docker_app` | `true` | 当前 Docker 形态 |
| `depend_docker_version` | `1.7.0.0000` | 依赖 Docker 套件最低版 |
| `port` | `28080` | 容器对外监听端口 |
| `open_type` | `inner` | 桌面内独立窗口 |
| `supports` | `[pc]` | 桌面端为主 |
| `parameters` | 见文件 | 数据源 / API 地址，用户可改（注入 compose） |

---

## 7. 后期移植路线（预留）

- **原生应用**：`is_docker_app: false`，后端改用 Go 静态服务器（托管 dist + SPA 回退 + /api 代理），`start_cmd: bin/idplan_serv --port=28080`。前端与数据层接口无需改动。
- **多端同步**：数据源切到 `remote`，后端按 `docs/api-contract.md` 实现 REST API，数据落 NAS；`proxy_path: api` 或 `VITE_API_BASE_URL` 直连。`IRepositoryBundle` 的 remote 适配器已就绪。
- **备份互通**：`IAdminRepository.fullExport()/replaceAllImport()` 已定义，对应 `/api/backup` 端点。

> 详见交付报告 `deliverables/gstack/ugos-pro-migration-research-2026-08-28.md`（平台整体调研 + 三条路线对比）。
