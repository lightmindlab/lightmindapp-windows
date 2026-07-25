#!/usr/bin/env bash
# 用 rcedit-x64.exe（64 位）修改 LightMind.exe 的图标和版本信息
# 绕过 electron-builder 默认调用的 rcedit-ia32.exe（沙箱内核不支持 32 位 ELF）
set -euo pipefail

WINE=/usr/lib/wine/wine64
RCEDIT=/root/.cache/electron-builder/winCodeSign/winCodeSign-2.6.0/rcedit-x64.exe
EXE="$1"
ICO="$2"

export WINEPREFIX=/root/.wine64
export WINEDEBUG=-all

# 将路径转换为 wine 可识别的 Z:\ 开头格式
to_wine_path() {
  echo "Z:$(echo "$1" | sed 's|/|\\|g')"
}

EXE_W=$(to_wine_path "$EXE")
ICO_W=$(to_wine_path "$ICO")

echo "[rcedit] 目标: $EXE"
echo "[rcedit] 图标: $ICO"

"$WINE" "$RCEDIT" "$EXE_W" \
  --set-version-string FileDescription "LightMind" \
  --set-version-string ProductName "LightMind" \
  --set-version-string CompanyName "lightmindlab" \
  --set-version-string LegalCopyright "Copyright (c) 2026 lightmindlab" \
  --set-version-string OriginalFilename "LightMind.exe" \
  --set-version-string InternalName "LightMind" \
  --set-version-string FileVersion "1.0.0" \
  --set-version-string ProductVersion "1.0.0" \
  --set-file-version "1.0.0.0" \
  --set-product-version "1.0.0.0" \
  --set-icon "$ICO_W" 2>&1

echo "[rcedit] 完成"
