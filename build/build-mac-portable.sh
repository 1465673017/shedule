#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"

make_portable_zip() {
  local arch="$1"
  local app_dir="$2"
  local source_app="$app_dir/A大橙子课时统计.app"
  local stage_dir="$DIST_DIR/.portable-$arch"
  local package_dir="$stage_dir/A大橙子课时统计（便携版）"
  local output="$DIST_DIR/A大橙子课时统计（便携版-$VERSION）-$arch.zip"

  if [[ ! -d "$source_app" ]]; then
    echo "找不到 $arch 应用包：$source_app" >&2
    exit 1
  fi

  rm -rf "$stage_dir"
  mkdir -p "$package_dir/data"
  cp -R "$source_app" "$package_dir/"
  touch "$package_dir/.kebiao-portable"
  ditto -c -k --sequesterRsrc --keepParent "$package_dir" "$output"
  rm -rf "$stage_dir"
  echo "已生成：$output"
}

make_portable_zip "x64" "$DIST_DIR/mac"
make_portable_zip "arm64" "$DIST_DIR/mac-arm64"
