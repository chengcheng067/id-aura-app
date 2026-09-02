# ID Plan · 室内设计项目节点管理系统

> 把合同变成一张看得懂的阶段时间轴 —— **离线优先**的室内设计项目管理工具。

ID Plan 是给室内设计师（个人 / 工作室）用的项目排程工具。把合同的金额、项目类型、阶段节点、参与成员整理成一张清爽的时间轴，用看板、日历、甘特图三种视角随时掌握项目进度。

**运行环境**：浏览器（Windows / Mac / 手机）即开即用，也支持 **Windows 桌面版** 与 **绿联 NAS 一键部署**（团队共享数据）。

---

## ✨ 功能亮点

| 能力 | 说明 |
|------|------|
| **合同一键建档** | 粘贴合同文字，自动解析金额 / 项目类型 / 阶段，生成项目时间轴 |
| **看板 · 日历 · 甘特图** | 项目进度三视角：四列看板（待启动/设计中/深化中/施工中）、月历视图、可拖拽改期的甘特时间轴 |
| **阶段自定义** | 建筑 / 室内 / 景观设计多类项目模板，阶段占比、时长、参与成员灵活配置 |
| **任务多人协同** | 任务可指派多个成员，任何参与人都可勾选完成，进度实时同步 |
| **角色权限** | 管理员（设计师本人）看全貌；普通成员只看自己相关的项目与任务 |
| **密码登录** | 管理员可为每个成员单独设/清密码，有密码成员需验证后才可进入 |
| **休息制度** | 大休/小休、单休/双休可配置，排期自动跳过休息日，竣工日期准确 |
| **打印 / 导出** | 日程表 A4 打印视图、导出 PNG 高清图，发给甲方也专业 |
| **双主题** | 亮 / 暗 / 跟随系统三态，Soft UI 磨砂玻璃质感 |
| **备份恢复** | 一键导出/导入 JSON 备份，数据格式全量校验，迁移无压力 |

---

## 🚀 安装方式（三选一）

### 方式一：Windows 桌面版（推荐个人使用）

下载 Windows 安装包，双击即装，桌面 + 开始菜单生成「ID Plan」快捷方式。数据存在**本机**。

- 📄 **详细步骤**：[docs/install/windows-install.md](docs/install/windows-install.md)
- 💿 **下载**：见下方「📦 下载地址」的 `IDPlan-0.3.0-Setup.exe`

> 无代码签名证书，Windows SmartScreen 可能提示「未知发布者」→ 点**更多信息** → **仍要运行**。

### 方式二：绿联 NAS 部署（推荐团队共享）

团队的数据集中存在 **NAS** 上，所有人自动看到同一份，不用手动导 JSON。**只需要一台绿联 NAS（UGOS Pro 系统）+ 一个浏览器**，不需要装任何 Docker 工具。有两种装法：

- 📦 **UPK 应用包**（推荐，最省事）：一个包内含前后端，应用中心手动安装。👉 [docs/install/upk-install-tutorial.md](docs/install/upk-install-tutorial.md)
- ⚙️ **Docker compose**（手动配容器）：👉 [docs/install/nas-deploy-tutorial.md](docs/install/nas-deploy-tutorial.md) · 配置文件 [docs/install/idplan-nas-compose.yml](docs/install/idplan-nas-compose.yml)

部署完成后浏览器访问 `http://<NAS的IP>:28080`。

### 方式三：Docker（通用 / 自建服务器）

项目是 **前端 + 后端** 分离架构，两个镜像可从 ghcr 拉取：

```bash
# 前端（nginx 托管页面 + /api 反代）
ghcr.io/chengcheng067/idplan:0.3.0
# 后端（Fastify + SQLite，团队共享数据层）
ghcr.io/chengcheng067/idplan-backend:0.3.0
```

用 [docs/install/idplan-nas-compose.yml](docs/install/idplan-nas-compose.yml) 一键编排，或按需修改升级。

---

## 📦 下载地址

### 最新发布（v0.3.0 · 构建号 .0018）

| 平台 | 文件 | 用途 |
|------|------|------|
| **Windows** | `IDPlan-0.3.0-Setup.exe` | 桌面安装，个人使用 |
| **绿联 NAS (amd64)** | `amd64_com.chengcheng.idplan_0.3.0.0018.upk` | UGOS Pro 手动导入 |
| **Docker 镜像 (.tar)** | `idplan-amd64.tar` / `idplan-backend-amd64.tar` | 离线导入 / 自建 |

> 🤖 所有发布产物（exe / upk / tar / compose）都挂在 GitHub **Releases** 页：
> 👉 **https://github.com/chengcheng067/id-aura-app/releases**

按你的架构选择：绝大多数 Intel 系 NAS 用 **amd64**；arm64 仅 Apple Silicon / 部分 ARM 机型。

---

## 🖥️ 技术栈（开发者）

- **前端**：Vite 5 + React 18 + TypeScript 5 + Tailwind CSS 3 + Zustand + Dexie (IndexedDB)
- **合同解析**：自研纯函数库（正则锚点 + 多格式日期 + 工期换算），pdfjs-dist / mammoth 仅作文本抽取
- **服务端**：Fastify + SQLite（NAS Docker 化用，`VITE_DATA_SOURCE=remote` 一键切换）
- **测试**：Vitest + fake-indexeddb（424 项全量单测）

### 本地开发

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 全量单测
npm run build        # 类型检查 + 构建
```

> 数据源切换：`.env.local` 里 `VITE_DATA_SOURCE=local`（本地 IndexedDB，默认）或 `remote`（NAS 后端，多端同步）。切换是进程启动时定型，改完需重启。

---

## 📖 文档

- 🪟 **Windows 版安装**：[docs/install/windows-install.md](docs/install/windows-install.md)
- 📦 **绿联 NAS · UPK 应用包**：[docs/install/upk-install-tutorial.md](docs/install/upk-install-tutorial.md)
- ⚙️ **绿联 NAS · Docker compose**：[docs/install/nas-deploy-tutorial.md](docs/install/nas-deploy-tutorial.md) · [idplan-nas-compose.yml](docs/install/idplan-nas-compose.yml)
- 🗂️ **备份格式**：[docs/backup-format.md](docs/backup-format.md)
- 🤖 **发布产物**：见 GitHub [Releases](https://github.com/chengcheng067/id-aura-app/releases)

---

## 📌 工程纪律（要点）

1. 业务代码只经 `useRepos()` 取数，禁止直接 import dexie/fetch；
2. 时间一律 UTC ISO string 入库，展示层才转本地；
3. `stage_logs` / `assignments` append-only，接口不暴露 update/delete；
4. 九阶段默认值只存在于 `templates/nine-stages.default.json`；
5. 截止日后移必须填延期原因（弹窗硬闸门）并完整留痕；
6. 写操作反馈只用瞬时 Toast（≤2s），绝不全屏 loading 圈。

---

© 2026 ChengCheng · [GitHub](https://github.com/chengcheng067)
