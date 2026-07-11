# ERP 重构后续清理任务单

## 背景

当前项目已经完成了 ERP 主模型落地，运行主链路基本切到新架构：

- `CourseTemplate`
- `CourseInstance`
- `StudentCourseRelation`
- `AttendanceRecord`
- `RepeatRule`
- `ExceptionRule`

目前的问题不是“功能没做”，而是“旧兼容代码还残留很多”。这些残留主要表现为：

- 业务逻辑仍然直接遍历 `this.timetable`
- 存在 `if (window.LegacyScheduleAdapter)` 这种双轨分支
- 同一个函数在文件前半段保留旧实现，在后半段又被新实现覆盖
- `LegacyScheduleAdapter` 这个名字已经不能准确反映它的角色

本任务目标是：**彻底剥离旧课表版本模型，统一为 ERP-only 运行方式，同时保持当前 UI、布局、拖拽和交互习惯不变。**

---

## 总体约束

### 允许修改

- 数据结构
- 状态管理
- 排课算法
- 循环逻辑
- 存储方式
- 服务层命名
- 内部投影逻辑

### 禁止修改

- 页面布局
- 用户操作流程
- 拖拽逻辑体验
- 弹窗布局
- 核心交互习惯

### 必须保持不变

- 顶部日期 / 统计 / 设置
- 左侧学生池 / 科目池 / 课程池
- 中间周课表
- 底部点名 / 统计
- 学生拖拽排课方式
- 课程池拖拽排课方式
- 点击课程打开编辑弹窗
- 双击删除课程

---

## 当前代码状态

## 当前进度

### 已完成

1. ERP 主数据模型已经落地并可运行：
   - `CourseTemplate`
   - `CourseInstance`
   - `StudentCourseRelation`
   - `AttendanceRecord`
   - `RepeatRule`
   - `ExceptionRule`

2. 保存主链路已经改到 ERP：
   - `saveData()` 不再把旧版 `timetable` 作为持久化真源
   - 旧版 `version: 3` 持久化语义已经移除
   - `loadData()` 已优先加载 `erpData`

3. `app-core.js` 已做过一轮清理：
   - 清掉了一批旧缓存字段
   - 修复了历史乱码导致的语法问题
   - `getCellVersion / setCellVersion` 现在以 ERP 适配器为主

4. 考勤主链路已基本切到 ERP：
   - 点名绑定 `CourseInstance`
   - 实际上课时长绑定实例
   - `isStudentOngoing / isStudentCompleted` 已改为依赖 ERP 关系和实例，而不是旧 `timetable`

5. 统计主链路已经基本跑在 ERP 上：
   - 统计来源已基本改为 `CourseInstance + Attendance`

6. 测试当前通过：
   - `npm test` 可通过
   - 语法检查可通过

### 已经开始但还没清干净

1. `app-subjects.js`
   - 后面已经补了 ERP-only 的删除实现
   - 但文件前面旧实现正文还在，属于“旧实现仍存在，但已被后定义覆盖”

2. `app-timetable.js`
   - 后面已经补了 ERP-only 的 `removeItemFromCell`
   - 但前面的旧实现正文还在，仍需删除

3. `app-attendance.js`
   - 学生状态判断已经开始从旧 `timetable` 切到 ERP
   - 但仍需继续扫残留遍历

### 目前还没完成的核心清理

1. 删除所有旧 fallback 分支
2. 删除所有同名函数双实现
3. 把课程池、拖拽回收、重复检查彻底改成 ERP-only
4. 把 `LegacyScheduleAdapter` 正式重命名为 ERP 服务语义
5. 用 ERP 领域测试替换旧适配器语义测试

### 已经完成

1. 保存主数据已经基本切到 `erpData`
2. 课表排课主流程已经能通过 ERP 模型运行
3. 考勤主流程已绑定 `CourseInstance`
4. 统计主流程已基本依赖 `CourseInstance + Attendance`
5. 测试当前可通过

### 仍待清理

1. 旧 `timetable` 直接遍历
2. `LegacyScheduleAdapter` 双轨 fallback
3. 旧函数体与新覆盖实现并存
4. “课程池/学生状态/拖拽回收”仍有旧模型思维残留

---

## 推荐执行顺序

1. 先清理 `app-subjects.js` 和 `app-timetable.js`
2. 再清理 `app-attendance.js` 和 `app-courses.js`
3. 再清理 `app-dragdrop.js`
4. 最后清理 `app-core.js` 和 `app-erp.js` 的命名与投影职责
5. 最后补测试并重命名服务层

---

## 任务拆分

## 任务 1：删除旧 fallback 分支

### 目标

删除所有“有适配器走新逻辑，没有适配器走旧逻辑”的双轨代码。

### 涉及文件

- `js/app-subjects.js`
- `js/app-timetable.js`
- `js/app-courses.js`
- `js/app-attendance.js`
- `js/app-dragdrop.js`
- `js/app-core.js`

### 具体要求

删除以下模式：

```js
if (window.LegacyScheduleAdapter) {
  // 新逻辑
} else {
  // 旧逻辑
}
```

以及：

```js
if (!window.LegacyScheduleAdapter) return ...
```

要求改成：

- 默认 ERP-only
- 所有主链路直接调用 ERP 服务
- 不再保留旧 `timetable` 写入逻辑作为兜底

### 验收标准

- 全项目不再存在业务意义上的 fallback 双轨逻辑
- 删除科目、删除学生、删除课位、编辑课程都只走 ERP

---

## 任务 2：移除对 `this.timetable` 的业务级依赖

### 目标

`this.timetable` 只能作为 UI 渲染投影，不能再作为业务真相来源。

### 涉及文件

- `js/app-attendance.js`
- `js/app-courses.js`
- `js/app-dragdrop.js`
- `js/app-core.js`

### 具体要求

把以下旧逻辑替换掉：

- `for (const key in this.timetable)`
- `Object.values(this.timetable)`
- `Object.entries(this.timetable)`

这些逻辑应改为读取：

- `erpData.courseTemplates`
- `erpData.courseInstances`
- `erpData.studentCourseRelations`
- `erpData.attendanceRecords`
- `erpData.repeatRules`
- `erpData.exceptionRules`

### 重点替换点

#### 学生状态判断

不要再通过 `timetable` 判断：

- 是否在读
- 是否结课
- 是否试听占用

改为通过：

- `studentCourseRelations`
- `courseInstances`

#### 课程池计算

不要再扫描 `timetable` 聚合课程池。

改为从以下来源生成课程池：

- 优先 `courseTemplates`
- 必要时结合 `courseInstances`

#### 拖拽回收与重复检测

不要再通过遍历 `timetable` 判断：

- 是否存在重复课程
- 是否需要回收到课程池

改为：

- 基于模板和实例计算
- 明确“模板”和“实例”的职责边界

### 验收标准

- 所有业务判断不再依赖 `this.timetable`
- `this.timetable` 仅用于渲染当前周显示态

---

## 任务 3：清理重复实现，保留单一函数定义

### 目标

解决“前面旧实现 + 后面新实现覆盖”的混乱结构。

### 涉及文件

- `js/app-subjects.js`
- `js/app-timetable.js`

### 具体要求

检查以下情况：

- 同名函数出现两次
- 前面的旧实现已无实际使用价值
- 后面的实现只是用于覆盖旧实现

处理方式：

- 删除旧实现正文
- 只保留最终 ERP 版本
- 确保文件内同名函数只保留一份

### 验收标准

- 文件结构清晰
- 同名函数只有一份正式实现
- 不再依赖“后定义覆盖前定义”的方式修正行为

---

## 任务 4：重构 `LegacyScheduleAdapter` 的职责与命名

### 目标

当前 `LegacyScheduleAdapter` 已不再是迁移层，而是 ERP 主服务层，需要正名。

### 涉及文件

- `js/app-erp.js`
- 所有调用 `window.LegacyScheduleAdapter` 的文件

### 推荐方案

把：

- `window.LegacyScheduleAdapter`

改名为：

- `window.ScheduleErpService`

### 同时调整的方法命名

例如：

- `projectInstancesToTimetable()`

可改为：

- `buildScheduleView()`
- `buildTimetableProjection()`

命名目标：

- ERP 数据是源
- timetable 是视图投影

### 验收标准

- 服务命名能反映真实职责
- 全项目调用一致
- 不再暗示“这只是旧数据兼容层”

---

## 任务 5：整理保存/加载职责

### 目标

彻底确保本地存储只依赖 ERP 数据。

### 涉及文件

- `js/app-core.js`
- `js/app-export.js`

### 具体要求

确保 `saveData()` 与 `loadData()`：

- 只把 `erpData` 作为业务主数据保存
- 不再持久化旧版 `timetable` 结构
- 不再持久化旧版版本缓存字段

允许保留：

- `subjects`
- `students`
- `manualCourses`
- `periods`
- `quickSettingsState`
- `erpData`

不应再保留：

- 旧版 `version` 语义
- 旧版按周版本缓存结构
- 旧版考勤缓存字段

### 验收标准

- 刷新页面后仍正常恢复 ERP 数据
- 本地存储结构清晰，只有一套真源

---

## 任务 6：补 ERP 领域测试，替换旧兼容语义测试

### 目标

测试名称和测试结构要围绕 ERP 领域行为，而不是围绕旧版本课表兼容行为。

### 涉及文件

- `tests/erp-adapter.test.js`

### 建议后续重命名

可重命名为：

- `tests/schedule-erp.test.js`

### 应覆盖的测试行为

1. 创建课程模板
2. 创建课程实例
3. 设置学生课程关系状态
4. 周循环规则生效
5. 删除实例时生成例外规则
6. 删除学生后自动清理关系与考勤
7. 删除科目后实例保留但科目解绑
8. 移动课程后考勤迁移
9. 实际上课时长绑定实例
10. 统计从实例和考勤正确汇总

### 验收标准

- 测试语义清晰
- 不再强调旧版兼容命名
- 关键 ERP 行为有覆盖

---

## 逐文件任务建议

## `js/app-subjects.js`

### 要做

- 删除旧 `deleteSubjectFromPool` 实现
- 删除旧 `deleteStudentFromPool` 实现
- 保留单一 ERP-only 实现

### 验收

- 删除科目只调用 ERP 服务
- 删除学生只调用 ERP 服务

---

## `js/app-timetable.js`

### 要做

- 删除旧版 `removeItemFromCell` 实现
- 保留 ERP-only 版本
- 清理删除课位时对旧 `timetable` 版本模型的直接操作

### 验收

- 删除课位只生成 ERP 侧的实例变更或例外规则

---

## `js/app-attendance.js`

### 要做

- 所有学生状态计算改查 ERP 关系
- 不再通过 `timetable` 推断学生是否仍在课中

### 验收

- 点名、结课、暂停、循环判断都基于 ERP 数据

---

## `js/app-courses.js`

### 要做

- 课程池构建改为基于模板/实例
- 编辑课程时不再扫描旧 `timetable` 寻找匹配项
- 删除课程时不再手动清理旧版本数组

### 验收

- 课程池来源明确
- 编辑/删除课程都只走 ERP 服务

---

## `js/app-dragdrop.js`

### 要做

- 拖拽回收逻辑不再遍历 `this.timetable`
- 改为从 ERP 投影或模板/实例关系中判断

### 验收

- 拖拽体验不变
- 代码不依赖旧周版本数组结构

---

## `js/app-core.js`

### 要做

- 清理残余 `LegacyScheduleAdapter` 判断
- `saveData/loadData` 只保留 ERP 主存储语义
- `timetable` 明确标注为渲染投影缓存

### 验收

- 主数据职责明确
- 不再混用“业务真相”和“渲染投影”

---

## `js/app-erp.js`

### 要做

- 明确其为 ERP 服务层，而非 legacy 迁移层
- 整理服务方法命名
- 把投影方法从“兼容语义”改为“视图语义”

### 验收

- 服务边界清楚
- 命名与角色一致

---

## 最终交付标准

全部任务完成后，项目应满足：

1. 所有业务真相都来自 ERP 数据模型
2. `timetable` 仅为 UI 投影
3. 不再保留旧兼容分支
4. 不再保留同名函数双实现
5. 不再依赖旧缓存数据结构
6. 现有 UI 和交互体验保持不变
7. 测试全部通过

---

## 本地检查命令

修改完成后至少执行：

```bash
npm test
```

如需额外检查残留，可搜索：

```bash
rg "if \(window\.LegacyScheduleAdapter\)|if \(!window\.LegacyScheduleAdapter\)|for \(const key in this\.timetable\)|Object\.values\(this\.timetable\)|Object\.entries\(this\.timetable\)" js
```

目标是让这些残留显著减少，最终仅允许少量“视图投影”用途存在。
