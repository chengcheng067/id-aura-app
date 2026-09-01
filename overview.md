# 本次修复与评估总览

## 完成项

1. **手动建档日期校验误报**
   - 文件：`src/components/contract-wizard/ManualFallbackForm.tsx`
   - 改动：用 `toIsoDate` 规范化并校验起止日期，错误提示改为「开始日/竣工日格式不正确」「竣工日不能早于开始日」等具体文案。
   - 结论：你截图里看到的旧版「请检查日期是否有效」在当前源码已不存在，属于旧 build。本次改动进一步加固了日期解析的鲁棒性。

2. **iPad / 移动端搜索框不折叠**
   - 文件：`src/components/layout/TopBar.tsx`
   - 改动：搜索框在 `xl`(≥1280px) 以上显示完整 480px 输入框；以下折叠为搜索图标，点击展开内联输入框；快捷键 ⌘K/Ctrl+K/Alt+K 在窄屏自动展开移动端搜索。

3. **身份输入姓名时卡死 / 掉输入法**
   - 文件：`src/components/layout/IdentityDialog.tsx`
   - 改动：为姓名输入增加 `onCompositionStart/End` 组合事件，输入法组合过程中不立即更新受控 state，避免 React 覆盖 IME 导致卡死；Enter 提交时跳过 IME 组合状态。

4. **首页响应式布局（手机端修复的一部分）**
   - 文件：`src/pages/HomePage.tsx`
   - 改动：统计概览卡改为 `grid-cols-1 / sm:grid-cols-2 / lg:grid-cols-4`；四列看板改为 `grid-cols-1 / lg:grid-cols-4`，移除移动端横向滚动。

5. **Docker 数据保存位置说明**
   - 文件：`ugnas/docker-compose.yaml`、`ugnas/upk/rootfs_common/docker-compose.yaml`
   - 改动：补充清晰注释，说明容器内路径 `/data/changxia.db`、Docker 卷 `idplan-data`、绿联 NAS 宿主机大致路径及备份方法。

## 验证

- `npm run typecheck`：通过
- `npm test`：392 tests passed / 24 test files passed

## 仍需用户决策

- 是否继续「完全重构手机端 UI」的 A～D 阶段（见 `tmp/mobile-assessment/MOBILE-UI-RECONSTRUCTION.md`）？
- Docker 数据路径是否要从「Docker 具名卷」改为「bind mount 到指定共享文件夹」？
