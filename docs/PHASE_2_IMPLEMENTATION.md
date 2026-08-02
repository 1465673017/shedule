# 第 2 阶段实施记录：教师端规范化

状态：实施中。

## 本轮已完成

- SQLite migration v2 新增 `schedule_change_requests`，包含
  `PENDING`、`APPROVED`、`REJECTED`、`CANCELLED` 状态、审批信息和草稿课程引用。
- `TeacherScheduleService` 只允许当前教师查询自己的 `PUBLISHED` / `COMPLETED` 课程，
  提供课表、课程详情和已发布变更查询。
- `TeacherConflictService` 以纯函数结果返回人数上限、1 对 1、试听唯一和教师时间重叠冲突；
  冲突包含 `code`、`message` 和 `conflictingSessionIds`。
- `AttendanceService` 提供考勤、实际课时和结课事务命令，并使统计缓存失效；
  已完成课程拒绝继续修改。
- `ScheduleChangeService` 允许教师对自己的已发布课程提交调课申请；审批生成新的
  `DRAFT` 课表版本和课程，不覆盖原发布课程。
- 主进程 IPC 从数据库强制取得 `currentTeacherId`，渲染进程不能指定其他教师，
  服务层再次校验教师归属和课程状态。
- 第一阶段兼容快照同步会在同一事务中保留调课申请、草稿版本和草稿课程，
  避免旧界面自动保存清除第二阶段数据。

## 自动化覆盖

- 当前教师课表隔离与草稿不可见。
- 教师改名后历史课程仍按稳定 ID 关联。
- 四类教师端冲突及可解释冲突对象。
- 考勤、实际课时、结课、参与者校验和完成态写保护。
- 调课申请审批生成草稿且不覆盖发布课程。
- 兼容快照同步后调课申请和草稿仍存在。

验证命令：

```text
npm test
npm run test:electron
```

## 下一批接线

- 将课表渲染从 `this.erpData` 遍历逐步切换到 `teacher.getSchedule()`。
- 让拖拽和课程表单统一消费 `TeacherConflictService` 的冲突对象。
- 将现有考勤弹窗的写操作切换到 `AttendanceService` IPC 命令，并同步兼容缓存。
- 增加教师端调课申请入口、申请列表和取消操作。
- 排课管理工作区建立后接入审批、驳回和草稿编辑界面。

第二阶段只有在上述界面接线完成，并再次通过教师端人工回归清单后才能标记验收完成。
