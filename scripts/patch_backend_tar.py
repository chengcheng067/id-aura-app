#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
ID Plan · 后端镜像 tar 就地修补（完整版）
========================================
把 <repo>/changxia/server/routes/projects.routes.ts（含新增 DELETE /api/projects/:id）
写进后端镜像的 app/server 层（层 7，含 routes/*.ts 的 layer），并同步更新：
  - 经典 docker-save manifest.json（ugcli 实际读取的）
  - OCI index.json + OCI manifest blob

输出为同格式的「经典 docker save」tar（manifest.json 指向 blobs/sha256/<hash>）。
backend 容器用 `tsx server/index.ts` 跑 TS 源码，因此只需替换 .ts 源文件即可生效，
无需编译。

用法：python scripts/patch_backend_tar.py <in.tar> <out.tar> <server_dir>
其中 server_dir 是 <repo>/changxia/server，内含 routes/projects.routes.ts。
"""
import gzip
import hashlib
import io
import json
import os
import sys
import tarfile


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def server_layer_tar(server_dir: str) -> bytes:
    """把整个 server/ -> 未压缩 tar，条目根为 app/server。
    仅覆盖 app/server 下所有源文件（.ts/.sql），保留层内目录结构。
    返回未压缩字节：diffID = sha256(未压缩 tar)，层 blob = gzip(未压缩 tar)。"""
    buf = io.BytesIO()
    root = "app/server"
    with tarfile.open(fileobj=buf, mode="w", format=tarfile.PAX_FORMAT) as tf:
        tf.addfile(pax_info(root, 0, 0o755, True), io.BytesIO(b""))
        for dirpath, dirnames, filenames in os.walk(server_dir):
            rel_dir = os.path.relpath(dirpath, server_dir).replace("\\", "/")
            arc_dir = root if rel_dir == "." else f"{root}/{rel_dir}"
            if arc_dir != root:
                tf.addfile(pax_info(arc_dir, 0, 0o755, True), io.BytesIO(b""))
            for fn in sorted(filenames):
                fp = os.path.join(dirpath, fn)
                rel = os.path.relpath(fp, server_dir).replace("\\", "/")
                arc = f"{root}/{rel}"
                data = open(fp, "rb").read()
                tf.addfile(pax_info(arc, len(data), 0o644, False), io.BytesIO(data))
    return buf.getvalue()


def pax_info(name, size, mode=0o644, dirtype=False):
    info = tarfile.TarInfo(name)
    info.mode = mode
    if dirtype:
        info.type = tarfile.DIRTYPE
        info.size = 0
    else:
        info.size = size
    return info


def main():
    in_tar = sys.argv[1]
    out_tar = sys.argv[2]
    server_dir = os.path.abspath(sys.argv[3])
    if not os.path.isdir(server_dir):
        print("!! server 目录不存在:", server_dir)
        sys.exit(1)

    with tarfile.open(in_tar, "r") as t:
        classic = json.loads(t.extractfile("manifest.json").read())
        index = json.loads(t.extractfile("index.json").read())
        oci_manifest_digest = index["manifests"][0]["digest"].split(":")[-1]
        oci_manifest = json.loads(t.extractfile(f"blobs/sha256/{oci_manifest_digest}").read())
        blobs = {}
        for n in t.getnames():
            if n.startswith("blobs/sha256/"):
                blobs[n.split("/")[-1]] = t.extractfile(n).read()

    def get_layer(ref):
        d = ref.split("/")[-1].replace("sha256:", "sha256/")
        return blobs[d]

    # 定位 server 层（含 app/server/routes/projects.routes.ts）
    server_layer_index = None
    for i, ref in enumerate(classic[0]["Layers"]):
        try:
            raw = gzip.decompress(get_layer(ref))
        except Exception:
            continue
        lt = tarfile.open(fileobj=io.BytesIO(raw), mode="r:")
        names = lt.getnames()
        if "app/server/routes/projects.routes.ts" in names:
            server_layer_index = i
            print(">> 命中 server 层:", ref, "files=", len(names))
            break
    if server_layer_index is None:
        print("!! 未找到 server 层")
        sys.exit(1)
    old_digest_sha = classic[0]["Layers"][server_layer_index].split("/")[-1]
    print(">> 旧 server 层:", old_digest_sha[:16], "index", server_layer_index)

    # 重建该层：用本地 server/ 整体覆盖（后端跑 tsx，直接替换所有 .ts 源）
    # 关键：diffID = sha256(未压缩层 tar)。docker load 会逐层解压重算 diffID，
    # 与 config blob 的 rootfs.diff_ids 比对，不一致直接拒载（NAS 安装失败的根因）。
    new_tar = server_layer_tar(server_dir)
    new_diff_id = sha256(new_tar)
    new_gz = gzip.compress(new_tar, mtime=0)
    new_sha = sha256(new_gz)
    blobs[new_sha] = new_gz
    print(">> 新 server 层 digest sha256:", new_sha[:16], "size", len(new_gz))
    print(">> 新 server 层 diffID:", "sha256:" + new_diff_id[:16])

    # 更新 classic manifest
    classic[0]["Layers"][server_layer_index] = f"blobs/sha256/{new_sha}"

    # 同步更新 config blob 的 rootfs.diff_ids
    cfg_path = classic[0]["Config"]
    cfg_sha_old = cfg_path.split("/")[-1]
    cfg = json.loads(blobs[cfg_sha_old])
    assert len(cfg["rootfs"]["diff_ids"]) == len(classic[0]["Layers"]), "diff_ids 与层数不一致"
    cfg["rootfs"]["diff_ids"][server_layer_index] = "sha256:" + new_diff_id
    cfg_bytes = json.dumps(cfg, separators=(",", ":")).encode()
    cfg_sha = sha256(cfg_bytes)
    blobs[cfg_sha] = cfg_bytes
    blobs.pop(cfg_sha_old, None)
    classic[0]["Config"] = f"blobs/sha256/{cfg_sha}"
    print(">> 新 config blob:", cfg_sha[:16], "(diff_ids 已同步)")

    # 更新 OCI manifest blob 对应层
    oci_manifest["layers"][server_layer_index]["digest"] = "sha256:" + new_sha
    oci_manifest["layers"][server_layer_index]["size"] = len(new_gz)
    oci_manifest["config"]["digest"] = "sha256:" + cfg_sha
    oci_manifest["config"]["size"] = len(cfg_bytes)
    oci_manifest_bytes = json.dumps(oci_manifest, separators=(",", ":")).encode()
    oci_manifest_new_sha = sha256(oci_manifest_bytes)
    blobs[oci_manifest_new_sha] = oci_manifest_bytes
    blobs.pop(oci_manifest_digest, None)
    index["manifests"][0]["digest"] = "sha256:" + oci_manifest_new_sha
    index["manifests"][0]["size"] = len(oci_manifest_bytes)
    index_bytes = json.dumps(index, separators=(",", ":")).encode()

    def w(name, data):
        info = tarfile.TarInfo(name)
        info.size = len(data)
        info.mode = 0o644
        out.addfile(info, io.BytesIO(data))

    with tarfile.open(out_tar, "w", format=tarfile.PAX_FORMAT) as out:
        w("manifest.json", json.dumps(classic, separators=(",", ":")).encode())
        w("index.json", index_bytes)
        w("oci-layout", b'{"imageLayoutVersion":"1.0.0"}')
        for sha, data in blobs.items():
            w(f"blobs/sha256/{sha}", data)
    print(">> 输出:", out_tar, os.path.getsize(out_tar), "bytes")


if __name__ == "__main__":
    main()
