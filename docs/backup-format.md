# 备份包格式规范 v1（backup-format.md）

> 备份 = 单个 JSON 文件（UTF-8），人可读、diff 友好。导入侧用 zod 全量校验后才落库，
> 结构不符直接拒绝并提示（不允许半套写入——Dexie 事务保证原子性）。

## 顶层结构

```jsonc
{
  "meta": {
    "app": "changxia",          // 常量，校验必为 changxia
    "schemaVersion": 1,         // 当前唯一版本
    "exportedAt": "2026-09-01T08:00:00.000Z"
  },
  "data": {
    "projects":  [ /* Project[] */ ],
    "stages":    [ /* Stage[] */ ],
    "tasks":     [ /* Task[] */ ],
    "members":   [ /* Member[] */ ],
    "assignments":[ /* AssignmentLog[] */ ],   // append-only 流水
    "logs":      [ /* StageLog[] */ ],         // append-only 流水
    "contracts": [ /* ContractRecord[] */ ],
    "settings":  [ /* Setting[] */ ]
  }
}
```

## 校验规则（zod schema 与 backup.service.ts 一一对应）

1. `meta.app === 'changxia'`，`meta.schemaVersion === 1`；
2. 八张表必须存在且为数组（允许空数组）；元素逐条按实体 schema 校验；
3. 所有实体必有 `revision:number ≥0` 与 `updatedAt: ISO string`；
4. 时间字段一律 ISO string 或 YYYY-MM-DD；禁止 Date 对象序列化产物；
5. 外键仅做「存在性弱校验」：project/stage/task 的 id 彼此可解析（孤儿行允许出现于流水表——append-only 保真原则优先）；
6. 导入 = 清库重建（单事务）：先 `clear()` 八表再 `bulkPut`，任一步失败整体回滚；
7. 低置信度解析快照中的空值字段保持 null —— 备份忠实记录，不做二次猜测。

## 往返不变式（roundtrip 不变式，tests/backup.roundtrip.spec.ts 断言）

导出 → 清库 → 导入 → 再导出，两次 BackupPackage 的 `data` 深比较相等（JSON.stringify 规范化后逐表 diff 为空）。
`meta.exportedAt` 允许不同。

## 人可读性约定

- 数组顺序不承诺稳定，diff 前先按 id 排序；
- 缩进 2 空格导出，方便 git 管理；
- 文件名建议：`id-plan-backup-YYYYMMDD-HHmm.json`（改名 ID Plan 后；文件内容校验仍走 `meta.app === 'changxia'`，与文件名解耦）。

## Member 字段说明（v0.2 增量）

- `members[]` 新增 `roleKind: 'admin' | 'member'`（无密码权限模型）：
  - **旧备份（无该字段）导入时自动归一为 `'member'`**（zod `.default('member')`），导入后每行必有显式 `roleKind`，运行时不会 `undefined`；
  - 新备份含 `roleKind: 'admin'` 的成员 roundtrip 保真；
  - `roleKind` 非法值（如 `'super'`）→ 校验拒绝，不落库。
