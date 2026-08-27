# ID Plan · 室内设计项目节点管理系统

> 离线优先 Web 应用 —— 把合同变成一张看得懂的阶段时间轴。

## 技术栈

- **前端**：Vite 5 + React 18 + TypeScript 5 + Tailwind CSS 3 + Zustand + Dexie (IndexedDB)
- **合同解析**：自研纯函数库（正则锚点 + 多格式日期 + 工期换算），pdfjs-dist / mammoth 仅作文本抽取
- **测试**：Vitest + fake-indexeddb（11+ 增量 spec，含备份 roundtrip 键序不变式 / 多人参与收口 / 降级边界 / 打印数据组装）
- **服务端预留**：Fastify + better-sqlite3（NAS Docker 化用，`VITE_DATA_SOURCE=remote` 一键切换）

## 快速开始

```bash
npm install          # 或 pnpm install
npm run dev          # http://localhost:5173
```

```bash
npm run build        # 类型检查 + 产物构建（dist/）
npm test             # vitest 全量单测（解析器/切分/工作日/备份往返）
npm run typecheck    # 仅 TS 检查
```

## 数据源切换（本地 / NAS 远端）

复制 `.env.example` 为 `.env.local`：

```bash
# 本地 IndexedDB（默认，零网络依赖）
VITE_DATA_SOURCE=local

# 远端 REST（先启动 server/）
# VITE_DATA_SOURCE=remote
# VITE_API_BASE_URL=http://192.168.1.10:7788/api
```

切换是**进程启动时**定型——改完需重启 `npm run dev`，不支持运行中热切换。

### 启动预留服务端

```bash
npm run dev:server   # tsx watch server/ → http://localhost:7788/api
# 或前后端一起：
npm run dev:all
```

> better-sqlite3 为原生模块（optionalDependencies），Windows 编译失败不影响前端；
> server 属预留实现，路由契约见 [docs/api-contract.md](docs/api-contract.md)。

## 备份与恢复

顶栏「保存备份 / 加载备份」两个独立入口（仅管理员可见，v0.3 变更 D 拆分自原「备份」下拉）：

- **保存备份**：点击即导出 JSON 备份包 `id-plan-backup-*.json`（格式规范见 [docs/backup-format.md](docs/backup-format.md)），无二次确认。
- **加载备份**：选择备份包 → zod 全量校验通过 → 二次确认（整体替换且不可撤销）→ 清库重建；校验失败则拒绝且不落库。

## v0.3 增量说明

- **任务多人参与**：`Task.assigneeIds`（参与人全集，写入默认 `[]`）+ 保留 `assigneeId`（主负责人，自动同步为 `assigneeIds[0] ?? null`）。所有权限/可见性判断统一走 `taskAssigneeIds()` 收口——旧数据（仅 assigneeId）回落为单值，行为与 v0.2 一致；任何参与人均可勾选完成；指派集合变化写一条集合级 Change 流水（memberId=null）。**schemaVersion 保持 1，不加索引、不 bump version**：taskSchema `assigneeIds` 用 `z.array(z.string()).default([])` 归一，旧备份导入零门槛，roundtrip 键序不变式（三处键序同步）由 `backup.roundtrip.spec.ts` 保证。
- **管理员降级**：成员管理区管理员行新增「取消管理员」；唯一 active 管理员时按钮 disabled + 确认回调双保险拒绝；允许降级自己（store upsert → useRoleGuard 重算 → 徽标消失 + 自动跳转 `/my-tasks`）。
- **液态玻璃 UI（v0.3 变更 B）**：tailwind.config 旧 token 名直接重映射为暗色液态玻璃值（组件 className 零改动全站换肤）；`global.css` 新增 glass-strong/medium/light、iridescent-border、glow-aura*、menuFadeIn 与暗色基线；硬编码 hex 收敛到 `timelineColors.ts`（头像色为受控例外）。**亮色主题不做**。
- **日程表打印视图**：项目详情（管理员）→「日程表」→ 新窗口 `/project/:id/schedule-print`（页内 isAdmin 守卫）；内容 = 页头 + 时间轴摘要 + 阶段分组任务表 + 页脚；支持打印 / 导出 PDF（打印对话框另存为，零依赖）/ 导出 PNG（html2canvas 动态 import）；`@media print` 强制浅色 A4、section 不跨页。

## 身份与权限（无密码信任模型）

- **管理员（admin，设计师本人）**：首次使用引导确立（或成员管理区「设为管理员」提权）；可见全部项目/成员/金额/备份，可指派与编辑；管理员可被「取消管理员」降级（系统至少保留一名 active 管理员）。
- **成员（member）**：顶栏「点击进入」→ 输入姓名匹配（不是下拉，不暴露名单）；只看到自己参与任务（含多人任务）与所属项目的最小上下文，可勾选自己参与的条目；看不到其他成员名单、项目全貌与敏感字段（客户/地址/金额）。
- **首次引导**：系统无管理员时自动弹「你是管理员（设计师本人）吗？」，填姓名创建/匹配管理员；无管理员时普通成员选「我不是管理员」→ 提示联系管理员，不进入。
- **切换/退出**：顶栏身份入口可随时切换身份或退出（支持同机换人）。

> **边界声明（无密码信任模型）**：产品逻辑上成员看不到他人，但全部数据在浏览器本地（IndexedDB），懂技术的人可经 DevTools 读取或篡改 localStorage/IndexedDB；本版不做对抗性加密，NAS Docker 化后由登录鉴权替代（架构接口已预留）。

## 目录速览

```
src/
├── core/
│   ├── contract-parser/    # 合同解析纯函数库（可单测、零 IO）
│   ├── file-extractors/    # PDF/DOCX/TXT 文本抽取（扫描件→手动兜底）
│   ├── repositories/       # 接口契约 + local(Dexie)/remote(REST) 双适配器
│   ├── services/           # 建档编排 / 改期闸门 / 备份导入导出
│   └── template/           # 九阶段模板加载 + 占比切分算法（纯函数）
├── components/timeline/    # 自研 SVG 时间轴（拖拽改期/今日线/缩放）
├── pages/                  # 首页 / 项目详情 / 我的任务
└── store/                  # Zustand 镜像 stores
templates/nine-stages.default.json   # 九阶段模板唯一来源
tests/fixtures/contracts/            # 20 组合同样本 + ground truth
server/                              # Fastify + SQLite 预留服务
```

## 工程纪律（要点）

1. 业务代码只经 `useRepos()` 取数，禁止直接 import dexie/fetch；
2. 时间一律 UTC ISO string 入库，展示层才转本地；
3. `stage_logs` / `assignments` append-only，接口不暴露 update/delete；
4. 九阶段默认值只存在于 `templates/nine-stages.default.json`；
5. 截止日后移必须填延期原因（弹窗硬闸门）并完整留痕；
6. 写操作反馈只用瞬时 Toast（≤2s），绝不全屏 loading 圈。
