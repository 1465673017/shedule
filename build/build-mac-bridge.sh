#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

python3 -m PyInstaller \
  --noconfirm \
  --clean \
  --onefile \
  --target-arch universal2 \
  --name course-sync-bridge \
  --distpath build/python-dist \
  --workpath build/python-work \
  --specpath build/python-spec \
  main.py

BRIDGE="$ROOT_DIR/build/python-dist/course-sync-bridge"
ARCHS="$(lipo -archs "$BRIDGE")"
if [[ "$ARCHS" != *"x86_64"* || "$ARCHS" != *"arm64"* ]]; then
  echo "同步桥不是 universal2（实际架构：$ARCHS）" >&2
  exit 1
fi
chmod +x "$BRIDGE"
echo "macOS 同步桥架构验证通过：$ARCHS"

SMOKE_DIR="$(mktemp -d)"
trap 'rm -rf "$SMOKE_DIR"' EXIT
SMOKE_OUTPUT="$(
  printf '%s\n' '{"action":"logout"}' |
    COURSE_SYNC_DATA_DIR="$SMOKE_DIR" "$BRIDGE" --bridge
)"
if [[ "$SMOKE_OUTPUT" != COURSE_SYNC:* ]]; then
  echo "同步桥启动检查失败：$SMOKE_OUTPUT" >&2
  exit 1
fi
echo "macOS 同步桥启动检查通过"
