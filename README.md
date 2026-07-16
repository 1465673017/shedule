# 课时统计

## 本地运行

需要 Node.js 18 或更高版本：

```bash
npm ci
npm start
```

## macOS 打包

DMG 必须在 macOS（本机或 GitHub Actions）上构建：

```bash
npm ci
npm run build:mac
```

Apple Silicon 使用 `arm64` 产物，Intel Mac 使用 `x64` 产物。当前构建未签名，首次打开时可能需要在“系统设置 → 隐私与安全性”中确认允许运行。正式分发需要配置 Apple Developer ID 签名及公证。
