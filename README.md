# 课时统计

## 本地运行

需要 Node.js 18 或更高版本：

```bash
npm ci
npm start
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
