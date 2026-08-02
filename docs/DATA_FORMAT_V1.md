# 本地数据格式 v1

## 存储键

| localStorage 键 | 内容 | 是否进入完整备份 |
|---|---|---|
| `timetableData` | 科目、学员、课程、周期/例外、考勤、节次和快捷设置 | 是 |
| `timetableDataBackup` | 应用自动保存的上一份主数据 | 是 |
| `timetableDataBackupAt` | 自动备份时间戳（毫秒） | 是 |
| `timetableSettings` | 界面、阶段、统计及主题设置 | 是 |
| `timetableGrades` | 年级与颜色 | 是 |
| `timetableSalarySettings` | 基本工资与星级设置 | 是 |

`timetableData` 根对象从 v1 起必须包含：

```json
{
  "schemaVersion": 1,
  "appVersion": "1.2.4",
  "exportedAt": "2026-08-02T10:00:00.000Z"
}
```

读取规则：无 `schemaVersion` 的历史数据按 v0 读取并在下次保存时升级为 v1；v1 直接读取；高于当前支持版本的数据拒绝读取，并尝试应用内的上一份有效备份。禁止静默降级未知版本。

数据层内部快照的 `type` 固定为 `class-schedule-full-backup`，包含上述全部存储键，仅用于首次迁移与 SQLite 同步。用户备份使用 `.oragshedule-backup`，其本质是包含业务表、迁移元数据和内部快照的 SQLite 数据库；恢复入口不接受 JSON 文件，且恢复操作不会修改原备份文件。
