#!/usr/bin/env bash
# =====================================================================
# ID Plan · 绿联 UPK 本地打包脚本（amd64 调试版）
#
# 用途：本机没有 Docker，镜像 tar 由 GitHub Actions 导出并挂在
#       Release upk-images-0.3.0 上。本脚本负责：
#         [1/4] 下载 amd64 的前端 + 后端镜像 tar
#         [2/4] 放进 rootfs_amd64/images/
#         [3/4] ugcli check 校验
#         [4/4] ugcli pack --arch amd64 生成 .upk
#
# 用法：bash scripts/pack-amd64.sh [build号]
#       build 号默认 1，重复打包时必须递增（绿联要求同一版本号下递增）。
# =====================================================================
set -euo pipefail

# UPK 项目根：changxia/ugnas/upk/（含 project.yaml + rootfs_*/）
cd "$(dirname "$0")/../upk"

BUILD="${1:-1}"
VERSION="0.3.0"
RELEASE_TAG="upk-images-${VERSION}"
REPO="chengcheng067/id-aura-app"
API="https://api.github.com/repos/${REPO}"
GH_TOKEN="${GH_TOKEN:-}"
UGCLI="$(cd "$(dirname "$0")/../../.." && pwd)/tools/ugcli.exe"

# 通过 Release API 动态解析资产 ID，再走 API 通道下载（实测比
# browser_download_url 快几十倍：~1.3MB/s vs ~20KB/s）
asset_url() {
  local name="$1"
  if [ -n "$GH_TOKEN" ]; then
    curl -s --max-time 40 -H "Authorization: Bearer ${GH_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      "${API}/releases/tags/${RELEASE_TAG}" \
      | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);const a=(j.assets||[]).find(x=>x.name===process.argv[1]);console.log(a?a.id:"")}catch(e){console.log("")}})' "$name"
  else
    echo ""
  fi
}

echo "==> 版本 ${VERSION}，构建号 ${BUILD}"

# 经典 docker-save 格式的体积特征（压缩层）：
#   前端 ~20MB、后端 ~170MB。若远超此值说明导出了 OCI 未压缩格式，直接报错。
EXPECTED_MAX_FRONT_MB=60
EXPECTED_MAX_BACK_MB=400

download() {
  local name="$1" dest="$2" max_mb="$3"
  if [ -s "$dest" ]; then
    echo "    已存在，跳过下载：$dest"
  else
    local id url
    id=$(asset_url "$name")
    if [ -n "$id" ]; then
      echo "    走 API 通道下载（资产 ${id}）：${name}"
      url="${API}/releases/assets/${id}"
      AUTH=(-H "Authorization: Bearer ${GH_TOKEN}")
    else
      echo "    走直链下载：${name}"
      url="https://github.com/${REPO}/releases/download/${RELEASE_TAG}/${name}"
      AUTH=()
    fi
    # TLS 在本机不稳定，用断点续传 + 多次重试拉完整
    local expect i cur
    expect=$(curl -sI "${AUTH[@]}" -H "Accept: application/octet-stream" "$url" \
      | tr -d '\r' | awk 'tolower($1)=="content-length:"{print $2}' | tail -1)
    for i in 1 2 3 4 5 6 7 8; do
      cur=$(stat -c%s "$dest" 2>/dev/null || echo 0)
      if [ -n "$expect" ] && [ "$cur" -ge "$expect" ]; then break; fi
      curl -fL -C - --retry 2 --connect-timeout 20 "${AUTH[@]}" \
        -H "Accept: application/octet-stream" -o "$dest" "$url" || true
    done
  fi
  local mb
  mb=$(( $(stat -c%s "$dest" 2>/dev/null || stat -f%z "$dest") / 1048576 ))
  echo "    大小 ${mb}MB"
  if [ "$mb" -gt "$max_mb" ]; then
    echo "    ✗ ${name} 体积 ${mb}MB 超过预期上限 ${max_mb}MB —— 疑似 OCI 未压缩格式，"
    echo "      请检查 upk-images 工作流是否用的 --output type=docker。"
    exit 1
  fi
}

echo "[1/4] 下载 amd64 镜像 tar"
mkdir -p cache
download "idplan-amd64-upk.tar"          cache/idplan-amd64-upk.tar          "$EXPECTED_MAX_FRONT_MB"
download "idplan-backend-amd64-upk.tar"  cache/idplan-backend-amd64-upk.tar  "$EXPECTED_MAX_BACK_MB"

echo "[2/4] 放入 rootfs_amd64/images/"
mkdir -p rootfs_amd64/images
cp cache/idplan-amd64-upk.tar         rootfs_amd64/images/
cp cache/idplan-backend-amd64-upk.tar rootfs_amd64/images/
ls -lh rootfs_amd64/images/

echo "[3/4] ugcli check"
"$UGCLI" check

echo "[4/4] ugcli pack --arch amd64 --build ${BUILD}"
"$UGCLI" pack --arch amd64 --build "${BUILD}"

echo ""
echo "=== 完成 ==="
find build_dir -name "*.upk" -exec ls -lh {} \;
