#!/usr/bin/env bash
# verify-build-output.sh
# 用途：CLAUDE.md 规则 28 的可执行版——验证构建产物是否真包含源码改动
#
# 用法：
#   ./scripts/verify-build-output.sh <源码相对路径> <搜索字符串> [<dist 产物路径>]
#
# 示例：
#   ./scripts/verify-build-output.sh content/bili.js "biliSite.init()" dist/content/bundled/bili.bundle.js
#
# 退出码：
#   0 = 通过（mtime 新 + grep 命中）
#   1 = mtime 未更新（缓存吞改动）
#   2 = grep 未命中（产物不含新代码）
#   3 = 参数/文件不存在

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "用法: $0 <源码路径> <搜索字符串> [<dist 产物路径>]" >&2
  exit 3
fi

SRC="$1"
NEEDLE="$2"
DIST="${3:-}"

if [ ! -f "$SRC" ]; then
  echo "[verify] FAIL 源码不存在: $SRC" >&2
  exit 3
fi

# 自动推断 dist 产物路径
if [ -z "$DIST" ]; then
  case "$SRC" in
    content/bili.js)         DIST="dist/content/bundled/bili.bundle.js" ;;
    content/douyin.js)       DIST="dist/content/bundled/douyin.bundle.js" ;;
    content/4hu.js)          DIST="dist/content/bundled/4hu.bundle.js" ;;
    content/porn.js)         DIST="dist/content/porn.js" ;;
    content/core/*)          DIST="dist/content/bundled/bili.bundle.js" ;;  # core 被多 bundle 引入，至少校验一个
    content/common/*)        DIST="dist/content/common-bundle.js" ;;
    content/utils/*)         DIST="dist/content/core-bundle.js" ;;
    background.js)           DIST="dist/background.js" ;;
    popup.js|popup.html)     DIST="dist/$SRC" ;;
    *)                       DIST="dist/$SRC" ;;
  esac
fi

if [ ! -f "$DIST" ]; then
  echo "[verify] FAIL dist 产物不存在: $DIST（请先 npm run build）" >&2
  exit 3
fi

SRC_MTIME=$(stat -c '%Y' "$SRC")
DIST_MTIME=$(stat -c '%Y' "$DIST")

echo "[verify] src=$SRC mtime=$SRC_MTIME"
echo "[verify] dist=$DIST mtime=$DIST_MTIME"

if [ "$SRC_MTIME" -gt "$DIST_MTIME" ]; then
  echo "[verify] FAIL 源码 mtime 新于产物 → 缓存吞改动" >&2
  echo "[verify] 修复: rm -f node_modules/.cache/build-cache.json && FULL_BUILD=true npm run build" >&2
  exit 1
fi

# 命中策略：先尝试字面 grep；未命中则把字符串转 \uXXXX 形式再 grep
# 原因：esbuild 默认把非 ASCII 字符转成 \uXXXX 字面量，字面 grep 会假阴性
if grep -qF "$NEEDLE" "$DIST"; then
  echo "[verify] PASS grep 命中（字面）: $NEEDLE"
  exit 0
fi

# 转 \uXXXX 形式重试（仅当字符串含非 ASCII 时才必要）
ESCAPED=$(python3 -c "import sys; s=sys.argv[1]; print(''.join(c if ord(c)<128 else '\\\\u'+format(ord(c),'04X') for c in s))" "$NEEDLE" 2>/dev/null || true)
if [ -n "$ESCAPED" ] && [ "$ESCAPED" != "$NEEDLE" ] && grep -qF "$ESCAPED" "$DIST"; then
  echo "[verify] PASS grep 命中（unicode 转义）: $ESCAPED"
  exit 0
fi

echo "[verify] FAIL 产物不含: $NEEDLE" >&2
echo "[verify] 也尝试了 unicode 转义: ${ESCAPED:-<未生成>}" >&2
echo "[verify] 可能根因: bundle 入口未 import 此源文件 / 构建未跑 / 字符串被压缩/删除" >&2
exit 2
