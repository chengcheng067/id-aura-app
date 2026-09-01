#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
ID Plan · 全平台新 Logo 生成脚本
================================
输入：C:/Users/Administrator/Desktop/id plan logo.png (4000x3000 RGBA)
输出：@ public/logo.png（应用内 + favicon 复用）
      @ electron/icon.png 与 electron/icon.ico（多尺寸）
      @ ugnas/upk/build_dir/rootfs/icon.png
      @ ugnas/upk/rootfs_common/icon.png

源图说明：蓝色 P 位于浅色圆角方块（squircle）中央，四周有淡蓝光晕描边。
本脚本把它裁切到正方形、去掉外围留白，输出干净的应用图标。
"""
import io
import os
import sys
from PIL import Image, ImageDraw

SRC = r"C:/Users/Administrator/Desktop/id plan logo.png"
ROOT = r"C:/Users/Administrator/WorkBuddy/2026-08-27-15-18-25/changxia"


def load_icon_square(size: int) -> Image.Image:
    """加载源图 → 裁切中央方形 → 缩放到 size（保持平滑、保留 alpha）。"""
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    # 取正方形：以图像中心为基准，取短边
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    box = im.crop((left, top, left + side, top + side))
    # 裁掉外围留白：找非透明/非近白像素的包围盒（P 主体）
    box = trim_to_content(box)
    box = box.resize((size, size), Image.LANCZOS)
    return box


def trim_to_content(im: Image.Image, tolerance: int = 12) -> Image.Image:
    """去掉四周近白/近透明留白，聚焦到蓝色 P 主体。"""
    alpha = im.getchannel("A")
    rgb = im.convert("RGB")
    px = rgb.load()
    a = alpha.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(0, h, 2):  # 步长 2 提速，够用
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            # 非透明 && (明显是蓝色 P 或深色)——排除白底
            if a[x, y] > tolerance and not (r > 235 and g > 235 and b > 235):
                if x < minx: minx = x
                if y < miny: miny = y
                if x > maxx: maxx = x
                if y > maxy: maxy = y
    if maxx <= minx or maxy <= miny:
        return im
    # 加一点内边距，避免 P 贴边
    pad = max(2, int(min(w, h) * 0.01))
    minx = max(0, minx - pad); miny = max(0, miny - pad)
    maxx = min(w - 1, maxx + pad); maxy = min(h - 1, maxy + pad)
    return im.crop((minx, miny, maxx, maxy))


def save_png(im: Image.Image, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "PNG")
    print(f"  wrote {path} ({im.size[0]}x{im.size[1]})")


def save_ico(im256: Image.Image, path: str, sizes=(256, 128, 64, 48, 32, 16)) -> None:
    # sizes 需为 (w,h) 元组列表；append_images 为各尺寸的 Image
    im256.save(path, "ICO", sizes=[(s, s) for s in sizes],
               append_images=[im256.resize((s, s), Image.LANCZOS) for s in sizes[1:]])
    print(f"  wrote {path}")


def main() -> None:
    print(">>> 生成应用内 logo + favicon (512)")
    logo = load_icon_square(512)
    save_png(logo, os.path.join(ROOT, "public", "logo.png"))

    print(">>> 生成 Electron 图标 (256 + ICO)")
    icon256 = load_icon_square(256)
    save_png(icon256, os.path.join(ROOT, "electron", "icon.png"))
    save_ico(load_icon_square(256), os.path.join(ROOT, "electron", "icon.ico"))

    print(">>> 生成 UPK rootfs 图标 (256)")
    upk_icon = load_icon_square(256)
    save_png(upk_icon, os.path.join(ROOT, "ugnas", "upk", "build_dir", "rootfs", "icon.png"))
    save_png(upk_icon, os.path.join(ROOT, "ugnas", "upk", "rootfs_common", "icon.png"))

    print(">>> 完成")


if __name__ == "__main__":
    main()
