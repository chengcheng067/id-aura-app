"""探明候选镜像 tar 的 dist 层内容，判定它含哪些版本的功能特征。

用法: python qa-scratch/inspect_tar.py <tar路径> [...]

注意：dist 层内路径带 usr/share/nginx/html/ 前缀，不能用 startswith('assets/') 判定。
"""
import gzip
import io
import sys
import tarfile

# 各版本引入的独特特征（用于在 minified bundle 里识别版本）
MARKS = {
    '.0011 IME修复': ['isComposing', 'compositionstart'],
    '.0012 日志系统': ['ID_PLAN_LOG', 'unhandledrejection'],
    '.0013 设置面板': ['清空日志', '页面加载完成'],
    '.0014 IME探针': ['idplan.imeProbe', 'compositionupdate'],
}


def inspect(path):
    print(f'\n{"="*72}')
    print(f'文件: {path}')
    found = False
    with tarfile.open(path) as outer:
        for m in outer.getmembers():
            if not m.isfile():
                continue
            raw = outer.extractfile(m).read()
            data = gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw
            try:
                inner = tarfile.open(fileobj=io.BytesIO(data))
            except Exception:
                continue
            names = inner.getnames()
            bundles = [
                n for n in names
                if 'assets/index-' in n and n.endswith('.js')
            ]
            if not bundles:
                inner.close()
                continue
            has_50x = any('50x.html' in n for n in names)
            tag = 'nginx base层(跳过)' if has_50x else '★ dist 层'
            print(f'  [{tag}] {m.name[:40]}  成员{len(names)}个')
            if has_50x:
                inner.close()
                continue
            for n in bundles:
                code = inner.extractfile(n).read().decode('utf-8', 'replace')
                print(f'    bundle: {n.split("/")[-1]}  ({len(code)} 字符)')
                for label, keys in MARKS.items():
                    hit = [k for k in keys if k in code]
                    flag = 'YES' if len(hit) == len(keys) else ('部分' if hit else 'NO ')
                    print(f'      {label:<16} {flag}  {hit}')
                found = True
            inner.close()
    if not found:
        print('  !! 未找到 dist 层')


if __name__ == '__main__':
    for p in sys.argv[1:]:
        try:
            inspect(p)
        except Exception as e:
            print(f'{p}: 读取失败 {e}')
