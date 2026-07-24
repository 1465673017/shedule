#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
PRODUCT_NAME="$(node -p "require('$ROOT_DIR/package.json').build.productName")"

make_green_zip() {
  local arch="$1"
  local matches=("$DIST_DIR"/*-"$arch".zip)
  local source_zip=""
  for candidate in "${matches[@]}"; do
    [[ -f "$candidate" ]] || continue
    [[ "$candidate" == *"便携版"* || "$candidate" == *"绿色压缩包版"* ]] && continue
    source_zip="$candidate"
    break
  done
  if [[ -z "$source_zip" ]]; then
    echo "找不到 $arch 的 electron-builder ZIP 产物" >&2
    exit 1
  fi
  local output="$DIST_DIR/${PRODUCT_NAME}（绿色压缩包版-${VERSION}）-${arch}.zip"
  cp "$source_zip" "$output"
  echo "已生成：$output"
}

make_portable_zip() {
  local arch="$1"
  local app_dir="$2"
  local source_app="$app_dir/$PRODUCT_NAME.app"
  local stage_dir="$DIST_DIR/.portable-$arch"
  local package_dir="$stage_dir/${PRODUCT_NAME}（便携版）"
  local output="$DIST_DIR/${PRODUCT_NAME}（便携版-${VERSION}）-${arch}.zip"

  if [[ ! -d "$source_app" ]]; then
    echo "找不到 $arch 应用包：$source_app" >&2
    exit 1
  fi
  local embedded_bridge="$source_app/Contents/Resources/app.asar.unpacked/build/python-dist/course-sync-bridge"
  if [[ ! -x "$embedded_bridge" ]]; then
    echo "$arch 应用包缺少可执行的同步桥：$embedded_bridge" >&2
    exit 1
  fi
  local bridge_archs
  bridge_archs="$(lipo -archs "$embedded_bridge")"
  if [[ "$bridge_archs" != *"x86_64"* || "$bridge_archs" != *"arm64"* ]]; then
    echo "$arch 应用包内同步桥架构不完整：$bridge_archs" >&2
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

make_green_zip "x64"
make_green_zip "arm64"
make_portable_zip "x64" "$DIST_DIR/mac"
make_portable_zip "arm64" "$DIST_DIR/mac-arm64"
