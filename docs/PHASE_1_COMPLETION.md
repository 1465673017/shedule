# 第 1 阶段完成记录

## 交付

- `src/db/migrations.js`：递增 SQLite migration、外键、唯一约束和索引
- `src/db/repositories.js`：Teacher、Session、ScheduleVersion Repository
- `src/db/database.js`：事务迁移、确定性教师映射、快照同步、校验、备份和恢复
- Electron IPC：初始化、保存快照、替换快照、创建和恢复数据库备份
- UI：合并后的完整备份/恢复入口
- `docs/SQLITE_SCHEMA_V1.md`：ER 图、预览表映射和状态规则

## 验收结果

- 教师端仍只读取原有兼容模型，完整回归行为一致
- 首次启动创建默认 Organization、Campus 和确定性 Teacher ID
- 旧数据迁移完成后写入 `migration_completed`，第二次启动不重复迁移
- `DRAFT` 不在教师 Repository 默认查询范围内
- 非法状态转换被拒绝，`COMPLETED` 不可退回
- 迁移失败回滚快照和业务表，原 localStorage 保持不变
- `.oragshedule-backup` 包含 SQLite 数据和内部迁移快照；恢复前自动创建安全副本

验证命令：`npm test`、`npm run test:electron`、`npm run build`。

## 最终验收（2026-08-02）

- 教师端启动时以 SQLite 快照为事实来源，并将快照恢复到 localStorage 兼容缓存；连续写入使用 `cacheUpdatedAt` 恢复更新的缓存，避免异常退出丢失最后一次修改。
- 首次启动会归档旧 localStorage 快照、执行事务迁移并写入 `migration_completed=1`；数据层测试已覆盖关闭数据库、重新打开并再次读取迁移标记和快照。
- 完整快照包含课表、设置、年级、工资设置以及自动保存副本；旧快照缺少工资设置时按默认空设置兼容恢复。
- 教师 Session Repository 只允许查询 `PUBLISHED` 和 `COMPLETED`；即使调用方显式请求 `DRAFT`，真实草稿记录也不会返回。
- 用户备份只提供 `.oragshedule-backup`/SQLite 备份与恢复，不提供旧版 JSON 导入导出；这是确认后的产品范围调整。
- `npm test`、`npm run test:electron` 和 Windows x64 `npm run build` 均已通过。

结论：第 1 阶段“共享数据底座”验收完成。教师端编辑权限与统一领域服务属于下一阶段“教师端规范化”。
