# 课时统计

## 本地运行

需要 Node.js 18 或更高版本：

```bash
npm ci
npm start
```

## 数据备份与回归

“导出数据”中的“创建完整备份”会生成一个 `.oragshedule-backup` 文件，包含课表、考勤、常规设置、年级和工资设置。恢复入口接受该完整备份以及 SQLite 数据库文件，不提供 JSON 备份导入或导出。

教师端回归门禁：

```bash
npm run teacher:regression
```

数据格式和人工回归步骤见 `docs/DATA_FORMAT_V1.md` 与 `docs/TEACHER_REGRESSION_CHECKLIST.md`。

## SQLite 数据层

桌面应用首次启动时会先归档完整 localStorage JSON，再迁移到用户数据目录中的 `schedule.sqlite`。迁移完成后 SQLite 是启动数据源，localStorage 仅作为兼容缓存；转换或校验失败时会继续使用原缓存。

数据库结构以 `sqlite-schema-preview.html` 为基础，正式字段、关系和状态规则见 `docs/SQLITE_SCHEMA_V1.md`。数据层测试：

```bash
npm run scheduler:data:test
```

## macOS 打包

macOS 产物必须在 macOS（本机或 GitHub Actions）上构建：

```bash
npm ci
npm run build:mac
```

Apple Silicon 使用 `arm64` 产物，Intel Mac 使用 `x64` 产物。构建会生成：

- **绿色压缩包版 ZIP**：解压后直接运行，用户数据保存在 macOS 标准应用数据目录。
- **便携版 ZIP**：应用和 `data` 文件夹放在同一个目录中，课表及设置随整个文件夹移动。请勿只移动其中的 `.app`。
- **DMG**：保留现有的磁盘映像分发方式。

当前 CI 构建未签名，首次打开时可能需要在“系统设置 → 隐私与安全性”中确认允许运行。正式分发需要配置 Apple Developer ID 签名及公证。

## macOS 界面截图

在 GitHub Actions 中手动运行 **macOS UI Screenshots** 工作流。工作流会在真实 macOS runner 上启动 Electron，遍历默认、暗色和浅绿色主题，并截取主界面、设置标签页、统计视图及所有弹窗。完成后从该次运行的 Artifacts 下载 `macos-ui-screenshots-*`。

Artifact 内包含按主题分类的 PNG 文件以及记录全部截图名称的 `manifest.json`。也可以在 macOS 本机运行：

```bash
npm ci
npm run screenshots:macos
```
