#!/usr/bin/env python3
"""Make an Atlas .spz lighter for the web: drop the faint splats and, if asked, the view-dependent colour (SH).

  python3 tools/atlas/slim.py in.spz out.spz [--alpha 0.05] [--sh 0] [--far 80]

SPZ (nianticlabs/spz): gzip of a 16-byte header (magic NGSP, version, count, sh degree, fractional bits, flags,
reserved) then per-splat arrays: positions (3 x 24-bit fixed point), alpha, colour, scale, rotation (3 bytes in
v2, 4 in v3), SH. The arrays are cut with the same mask and written back in the same version.
"""
import argparse, gzip, struct
import numpy as np

SH_DIM = {0: 0, 1: 3, 2: 8, 3: 15}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--alpha', type=float, default=0.05)
    ap.add_argument('--sh', type=int, default=-1, help='keep SH up to this degree (-1: as is)')
    ap.add_argument('--far', type=float, default=0, help='drop splats farther than this from the origin (0: keep all)')
    a = ap.parse_args()
    raw = open(a.src, 'rb').read()
    if raw[:2] == b'\x1f\x8b':
        raw = gzip.decompress(raw)
    magic, ver, n, sh, frac, flags, res = struct.unpack_from('<IIIBBBB', raw, 0)
    assert magic == 0x5053474E, 'not spz'
    assert ver in (2, 3), f'spz version {ver}'
    rot_b = 3 if ver == 2 else 4
    sizes = [('pos', 9), ('alpha', 1), ('col', 3), ('scale', 3), ('rot', rot_b), ('sh', SH_DIM[sh] * 3)]
    o, arr = 16, {}
    for k, b in sizes:
        arr[k] = np.frombuffer(raw, np.uint8, n * b, o).reshape(n, b) if b else np.zeros((n, 0), np.uint8)
        o += n * b
    if o != len(raw):
        print(f'note: {len(raw) - o} bytes after the arrays (kept out)')
    keep = arr['alpha'][:, 0] >= int(a.alpha * 255)
    if a.far > 0:
        p = arr['pos'].reshape(n, 3, 3).astype(np.int32)
        v = p[..., 0] | (p[..., 1] << 8) | (p[..., 2] << 16)
        v = np.where(v & 0x800000, v - (1 << 24), v) / float(1 << frac)
        keep &= np.linalg.norm(v, axis=1) < a.far
    nsh = sh if a.sh < 0 else min(sh, a.sh)
    out = [struct.pack('<IIIBBBB', magic, ver, int(keep.sum()), nsh, frac, flags, res)]
    for k, b in sizes:
        x = arr[k][keep]
        if k == 'sh':
            x = x.reshape(len(x), SH_DIM[sh], 3)[:, :SH_DIM[nsh]].reshape(len(x), -1) if SH_DIM[sh] else x
        out.append(np.ascontiguousarray(x).tobytes())
    data = gzip.compress(b''.join(out), 9)
    open(a.dst, 'wb').write(data)
    print(f'{n} -> {int(keep.sum())} splats, sh {sh} -> {nsh}, {len(open(a.src, "rb").read()) / 1e6:.1f} MB -> {len(data) / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
