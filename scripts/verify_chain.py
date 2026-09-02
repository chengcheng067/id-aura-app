#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""镜像 tar 全链路校验（NAS 能否装载的决定性检查）。

背景血泪：patch 脚本若只换层内容、不同步 config 的 rootfs.diff_ids / OCI 摘要链，
docker load 会逐层解压重算 sha256 与 config 比对，不一致直接拒载（UPK 装不上的根因）。

三项铁律检查：
  1. 每层 diffID（sha256(未压缩层 tar)）必须等于 config blob 里 rootfs.diff_ids 的对应项
  2. 每个 blob 的文件名必须等于其内容的 sha256
  3. OCI 摘要链：index.json -> manifest blob -> layers 的 digest/size 全部对得上
     + 经典 manifest.json 的 Config / Layers 指向的 blob 必须存在

用法: python qa-scratch/verify_chain.py <tar路径>
退出码: 0 = 全部通过；1 = 有失败
"""
import gzip
import hashlib
import io
import json
import sys
import tarfile

fails = []
oks = []


def check(cond, msg):
    (oks if cond else fails).append(msg)
    print(('  OK   ' if cond else '  FAIL ') + msg)


def sha256(b):
    return hashlib.sha256(b).hexdigest()


def main(path):
    print(f'{"="*72}\n全链路校验: {path}\n{"="*72}')
    with tarfile.open(path) as t:
        classic = json.loads(t.extractfile('manifest.json').read())[0]
        index = json.loads(t.extractfile('index.json').read())
        blobs = {}
        for n in t.getnames():
            if n.startswith('blobs/sha256/') and t.getmember(n).isfile():
                blobs[n.split('/')[-1]] = t.extractfile(n).read()

    print(f'blobs 数: {len(blobs)}   classic Layers 数: {len(classic["Layers"])}')

    # ---- 2. blob 名 == 内容 sha256 ----
    print('\n[检查2] blob 文件名 == 内容 sha256')
    bad = [h[:12] for h, b in blobs.items() if sha256(b) != h]
    check(not bad, f'全部 {len(blobs)} 个 blob 摘要自洽' + (f'（异常: {bad}）' if bad else ''))

    # ---- config / diff_ids ----
    cfg_hash = classic['Config'].rsplit('/', 1)[-1]
    check(cfg_hash in blobs, f'config blob 存在 ({cfg_hash[:12]})')
    cfg = json.loads(blobs[cfg_hash])
    diff_ids = cfg['rootfs']['diff_ids']

    layers = classic['Layers']
    check(
        len(layers) == len(diff_ids),
        f'层数一致: Layers={len(layers)} diff_ids={len(diff_ids)}',
    )

    # ---- 1. 每层 diffID == config 登记 ----
    print('\n[检查1] 每层 diffID（sha256 未压缩层）== config rootfs.diff_ids')
    for i, ref in enumerate(layers):
        h = ref.rsplit('/', 1)[-1]
        if h not in blobs:
            check(False, f'层{i} blob 缺失 {h[:12]}')
            continue
        raw = blobs[h]
        try:
            data = gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw
        except Exception as e:
            check(False, f'层{i} 解压失败 {h[:12]}: {e}')
            continue
        real = 'sha256:' + sha256(data)
        want = diff_ids[i] if i < len(diff_ids) else '<越界>'
        check(real == want, f'层{i:>2} diffID {real[7:19]} vs config {want[7:19]}')

    # ---- 3. OCI 摘要链 ----
    print('\n[检查3] OCI 摘要链 index.json -> manifest -> layers')
    m0 = index['manifests'][0]
    mh = m0['digest'].split(':')[-1]
    check(mh in blobs, f'index 指向的 manifest blob 存在 ({mh[:12]})')
    check(
        mh in blobs and sha256(blobs[mh]) == mh,
        'manifest blob 内容摘要 == 其 digest',
    )
    check(
        mh in blobs and m0.get('size') == len(blobs[mh]),
        f'manifest size 登记一致 ({m0.get("size")})',
    )
    if mh in blobs:
        oci_man = json.loads(blobs[mh])
        check(
            oci_man.get('config', {}).get('digest', '').split(':')[-1] == cfg_hash,
            'OCI config.digest == classic Config 指向的 blob',
        )
        check(
            oci_man.get('config', {}).get('size') == len(blobs[cfg_hash]),
            'OCI config.size 一致',
        )
        oci_layers = oci_man.get('layers', [])
        check(
            len(oci_layers) == len(layers),
            f'OCI layers 数一致 ({len(oci_layers)})',
        )
        for i, L in enumerate(oci_layers):
            lh = L['digest'].split(':')[-1]
            ok_exist = lh in blobs
            ok_size = ok_exist and L.get('size') == len(blobs[lh])
            check(
                ok_exist and ok_size,
                f'OCI 层{i:>2} {lh[:12]} 存在且 size 一致 ({L.get("size")})',
            )

    print(f'\n{"="*72}')
    print(f'通过 {len(oks)} 项，失败 {len(fails)} 项')
    if fails:
        print('\n失败项：')
        for f in fails:
            print('  - ' + f)
        print('\n结论: ❌ 不可打包，修好再 pack（否则 NAS 会拒载）')
        return 1
    print('结论: ✅ 全链路自洽，可以 ugcli pack')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1]))
