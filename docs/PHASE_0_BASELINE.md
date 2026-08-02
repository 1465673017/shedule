# 第 0 阶段基线记录

- 基线提交：`90fd2b94d0bb15eccacf6ab2e4f26951c7d361f9`
- 基线标签：`desktop-teacher-v1.2.4`
- 扩展分支：`feature/scheduler-workspace`
- 基线测试：2026-08-02 在 Windows / Node.js 环境执行 `npm test`，5 组测试全部通过
- 回退安装包：`dist-1.3-fixed/A大橙子课时统计（定制版-1.3.0）-便携版.exe`（构建目录由 `.gitignore` 排除，不随 Git 标签重复提交）
- 编码：`.editorconfig` 规定 UTF-8；`package.json`、README、源码提示和测试文件已按 UTF-8 读取检查
- 运行态验证：`npm run test:electron` 通过；使用 npmmirror 下载 Electron 43.1.1 后，`npm run build` 成功生成 Windows x64 便携包

阶段完成后的统一门禁命令为 `npm run teacher:regression`，`npm test` 调用同一门禁。
