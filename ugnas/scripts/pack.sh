#!/usr/bin/env bash
# =====================================================================
# ID Plan · UGOS Pro 打包自动化脚本（需在 Linux / Git Bash 环境运行）
# 前提：
#   - 已安装 ugcli（https://developer.ugnas.com/doc/tools/ugcli.html）
#   - 已安装 docker 且可构建镜像
#   - 已申请绿联开发者授权（本机 NAS）
# 用法：
#   ./pack.sh            # 默认：build dist → 导镜像 → ugcli pack --build <下次构建号>
#   ./pack.sh --build 2  # 指定构建号
# =====================================================================
set -euo pipefail

BUILD_NO="${1:-}"
VERSION=$(node -p "require('../package.json').version" 2>/dev/null || echo "0.1.0")
APP_ID="com.chengcheng.idplan"

# 允许从 ugnas/ 或仓库根两种位置运行
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

echo "==> [1/5] 构建前端 dist"
npm run build

echo "==> [2/5] 构建 Docker 镜像（amd64 / arm64）"
docker build -f ugnas/Dockerfile -t docker.io/chengcheng/idplan:${VERSION}-amd64 --platform linux/amd64 .
docker build -f ugnas/Dockerfile -t docker.io/chengcheng/idplan:${VERSION}-arm64 --platform linux/arm64 .

echo "==> [3/5] 导出镜像 tar"
mkdir -p ugnas/rootfs_amd64/images ugnas/rootfs_arm64/images
docker save -o ugnas/rootfs_amd64/images/idplan-${VERSION}-amd64.tar docker.io/chengcheng/idplan:${VERSION}-amd64
docker save -o ugnas/rootfs_arm64/images/idplan-${VERSION}-arm64.tar docker.io/chengcheng/idplan:${VERSION}-arm64

echo "==> [4/5] 组装应用项目（project.yaml + compose + 图标）"
# 注：ugcli create 生成的骨架已含 rootfs 目录；此处仅确保 compose/icon 就位
if [ ! -d ugnas/rootfs_common ]; then mkdir -p ugnas/rootfs_common; fi
cp ugnas/docker-compose.yaml ugnas/rootfs_common/docker-compose.yaml
cp ugnas/project.yaml ./

echo "==> [5/5] ugcli 打包"
if [ -n "${BUILD_NO}" ]; then
  (cd ugnas && ugcli pack --arch all --build "${BUILD_NO}")
else
  (cd ugnas && ugcli pack --arch all)
fi

echo "==> 完成！upk 位于 ugnas/build_dir/pkgs/upk/"
