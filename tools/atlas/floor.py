#!/usr/bin/env python3
"""The walkable floor of an Atlas splat place, for the game's physics (src/game/realmData.ts).

  python3 tools/atlas/floor.py <splats.spz|.ply> <id> [--radius 14] [--cell 0.3] [--out src/game/realmData.ts]

Reads the Gaussians, finds which way is up (Atlas cameras are RUB; files may be stored y down), then on a grid
round the capture point: the floor's height in each cell (the lowest dense layer under the eye), the cells where
something stands in the way of a body (dense matter between knee and head height, or no floor seen), and each
cell's distance to the nearest such cell (negative inside it). Also the vault's height for the camera, and a
top-down picture of the result for checking (<out dir>/<id>-floor.png).
"""
import argparse, gzip, json, math, os, re, struct, sys
import numpy as np
from scipy import ndimage


def read_spz(path):
    raw = open(path, 'rb').read()
    if raw[:2] == b'\x1f\x8b':
        raw = gzip.decompress(raw)
    magic, version, n, sh, frac, flags, _ = struct.unpack_from('<IIIBBBB', raw, 0)
    if magic != 0x5053474E:
        raise SystemExit(f'not an spz (magic {magic:#x})')
    o = 16
    if version == 1:
        pos = np.frombuffer(raw, np.float16, n * 3, o).astype(np.float32).reshape(n, 3)
        o += n * 6
    else:
        b = np.frombuffer(raw, np.uint8, n * 9, o).reshape(n, 3, 3).astype(np.int32)
        v = b[..., 0] | (b[..., 1] << 8) | (b[..., 2] << 16)
        v = np.where(v & 0x800000, v - (1 << 24), v)
        pos = (v / float(1 << frac)).astype(np.float32)
        o += n * 9
    alpha = np.frombuffer(raw, np.uint8, n, o).astype(np.float32) / 255.0
    o += n
    col = np.frombuffer(raw, np.uint8, n * 3, o).reshape(n, 3).astype(np.float32)
    o += n * 3
    rgb = np.clip(0.5 + 0.282095 * ((col / 255.0 - 0.5) / 0.15), 0, 1)
    scl = np.frombuffer(raw, np.uint8, n * 3, o).reshape(n, 3).astype(np.float32) / 16.0 - 10.0
    o += n * 3
    print(f'spz v{version}: {n} splats, sh {sh}, frac bits {frac}, flags {flags}')
    return pos, alpha, rgb, np.exp(scl)


def read_ply(path):
    f = open(path, 'rb')
    head = b''
    while not head.endswith(b'end_header\n'):
        head += f.readline()
    h = head.decode()
    n = int(re.search(r'element vertex (\d+)', h).group(1))
    props = re.findall(r'property (\w+) (\w+)', h.split('element vertex')[1].split('element')[0])
    tmap = {'float': 'f4', 'float32': 'f4', 'double': 'f8', 'uchar': 'u1', 'uint8': 'u1', 'int': 'i4', 'short': 'i2', 'ushort': 'u2'}
    dt = np.dtype([(name, '<' + tmap[t]) for t, name in props])
    if 'binary_little_endian' not in h:
        raise SystemExit('only binary little endian ply')
    d = np.frombuffer(f.read(n * dt.itemsize), dt, n)
    pos = np.stack([d['x'], d['y'], d['z']], 1).astype(np.float32)
    alpha = 1 / (1 + np.exp(-d['opacity'].astype(np.float32))) if 'opacity' in d.dtype.names else np.ones(n, np.float32)
    rgb = np.clip(0.5 + 0.282095 * np.stack([d['f_dc_0'], d['f_dc_1'], d['f_dc_2']], 1), 0, 1) if 'f_dc_0' in d.dtype.names else np.full((n, 3), 0.5)
    scl = np.exp(np.stack([d['scale_0'], d['scale_1'], d['scale_2']], 1)) if 'scale_0' in d.dtype.names else np.full((n, 3), 0.02)
    print(f'ply: {n} splats')
    return pos, alpha.astype(np.float32), rgb.astype(np.float32), scl.astype(np.float32)


def floor_grid(pos, ok, R, C):
    """per cell, the lowest dense layer between 3.5 m and 0.4 m under the eye (NaN where none)"""
    nx = nz = int(math.ceil(2 * R / C))
    x0 = z0 = -nx * C / 2
    ix = np.floor((pos[:, 0] - x0) / C).astype(int)
    iz = np.floor((pos[:, 2] - z0) / C).astype(int)
    inside = ok & (ix >= 0) & (ix < nx) & (iz >= 0) & (iz < nz)
    floor = np.full((nz, nx), np.nan, np.float32)
    dens = np.zeros((nz, nx), np.float32)
    sel = inside & (pos[:, 1] < -0.25) & (pos[:, 1] > -3.5)
    cid = iz[sel] * nx + ix[sel]
    yv = pos[sel, 1]
    order = np.lexsort((yv, cid))
    cid, yv = cid[order], yv[order]
    starts = np.searchsorted(cid, np.arange(nx * nz))
    ends = np.searchsorted(cid, np.arange(nx * nz), 'right')
    for c in range(nx * nz):
        s0, e = starts[c], ends[c]
        k = e - s0
        if k < 6:
            continue
        y = yv[s0:e]
        # the 15th lowest percentile of a dense column, so floaters under the floor don't pull it down
        floor.flat[c] = np.percentile(y, 15) if k > 40 else np.median(y[: max(3, k // 3)])
        dens.flat[c] = k
    return nx, nz, x0, z0, ix, iz, inside, floor, dens


def level_rotation(floor, x0, z0, C, fit_r):
    """the rotation that makes the floor round the capture point level (Atlas assumes its first camera level;
    a painted view often looks a little up or down)"""
    nz, nx = floor.shape
    xs = x0 + (np.arange(nx) + 0.5) * C
    zs = z0 + (np.arange(nz) + 0.5) * C
    X, Z = np.meshgrid(xs, zs)
    m = ~np.isnan(floor) & (np.hypot(X, Z) < fit_r)
    if m.sum() < 30:
        return np.array([0, 0, 0, 1.0]), 0.0
    for _ in range(3):
        A = np.c_[X[m], Z[m], np.ones(m.sum())]
        coef = np.linalg.lstsq(A, floor[m], rcond=None)[0]
        r = floor - (coef[0] * X + coef[1] * Z + coef[2])
        sd = np.nanstd(r[m])
        m = m & (np.abs(r) < max(2 * sd, 0.05))
    n = np.array([-coef[0], 1.0, -coef[1]])
    n /= np.linalg.norm(n)
    up = np.array([0, 1.0, 0])
    axis = np.cross(n, up)
    sa = np.linalg.norm(axis)
    ang = math.atan2(sa, float(n @ up))
    if sa < 1e-9:
        return np.array([0, 0, 0, 1.0]), 0.0
    axis /= sa
    q = np.r_[axis * math.sin(ang / 2), math.cos(ang / 2)]
    return q, math.degrees(ang)


def rotate(q, v):
    x, y, z, w = q
    u = np.array([x, y, z])
    t = 2 * np.cross(u, v)
    return v + w * t + np.cross(u, t)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file')
    ap.add_argument('id')
    ap.add_argument('--radius', type=float, default=14)
    ap.add_argument('--cell', type=float, default=0.3)
    ap.add_argument('--flip', choices=['auto', 'yes', 'no'], default='auto')
    ap.add_argument('--out', default='src/game/realmData.ts')
    ap.add_argument('--png', default='')
    a = ap.parse_args()
    pos, alpha, rgb, scl = (read_ply if a.file.endswith('.ply') else read_spz)(a.file)
    big = scl.max(1)
    ok = (alpha > 0.2) & (big < 0.6)
    print(f'solid, small enough: {ok.sum()} of {len(ok)}; bounds {pos.min(0).round(1)} .. {pos.max(0).round(1)}')

    # which way is up: near the capture point the floor is the densest flat layer, a metre or two below the eye
    near = ok & (np.hypot(pos[:, 0], pos[:, 2]) < 5)
    ys = pos[near, 1]
    hist, edges = np.histogram(ys, bins=np.arange(-4, 4.01, 0.1))
    lo = hist[edges[:-1] < -0.6].max(initial=0)
    hi = hist[edges[1:] > 0.6].max(initial=0)
    flip = (hi > lo) if a.flip == 'auto' else a.flip == 'yes'
    print(f'densest layer below {lo}, above {hi}: {"stored y down, flipping (180 about x)" if flip else "y up as is"}')
    if flip:
        pos = pos * np.array([1, -1, -1], np.float32)

    R, C = a.radius, a.cell
    nx, nz, x0, z0, ix, iz, inside, floor, dens = floor_grid(pos, ok, R, C)
    q, ang = level_rotation(floor, x0, z0, C, 7.0)
    print(f'floor tilted {ang:.2f} degrees from level: levelling (quaternion {np.round(q, 5).tolist()})')
    if ang > 0.2:
        pos = rotate(q, pos.astype(np.float64)).astype(np.float32)
        nx, nz, x0, z0, ix, iz, inside, floor, dens = floor_grid(pos, ok, R, C)
    else:
        q = np.array([0, 0, 0, 1.0])
    seen = ~np.isnan(floor)
    print(f'cells with a floor: {seen.sum()} of {nx * nz}')
    # the floor near the capture point
    cx, cz = nx // 2, nz // 2
    core = floor[cz - 3:cz + 4, cx - 3:cx + 4]
    f0 = float(np.nanmedian(core)) if np.isfinite(core).any() else float(np.nanmedian(floor))
    print(f'floor under the capture point: {f0:.2f} m below the eye')
    # smooth: a median over 5x5, holes filled from their neighbours (a few cells at most)
    med = ndimage.generic_filter(floor, np.nanmedian, size=5, mode='constant', cval=np.nan)
    floor_s = np.where(seen, med, np.nan)
    idx = ndimage.distance_transform_edt(~seen, return_distances=False, return_indices=True)
    floor_f = floor_s[idx[0], idx[1]]
    hole = ndimage.distance_transform_edt(~seen) * C
    # a cliff or a step too high to walk: more than 0.6 m from the neighbour
    gy, gx = np.gradient(floor_f, C)
    steep = np.hypot(gx, gy) > 1.4

    # what stands in the way: dense matter between knee (0.45 m) and head (1.8 m) above the floor
    hcell = floor_f[np.clip(iz, 0, nz - 1), np.clip(ix, 0, nx - 1)]
    rel = pos[:, 1] - hcell
    body = inside & (rel > 0.45) & (rel < 1.8)
    occ = np.zeros(nx * nz, np.float32)
    np.add.at(occ, (iz[body] * nx + ix[body]), np.minimum(alpha[body], 1))
    occ = occ.reshape(nz, nx)
    # against how thick the floor itself is drawn: a wall or a pillar puts as much matter in a cell's body band
    fl = float(np.median(dens[seen])) if seen.any() else 30.0
    print(f'floor splats per cell {fl:.0f}; body band matter: median {np.median(occ[occ > 0]) if (occ > 0).any() else 0:.1f}')
    blocked = (occ > max(3.0, fl * 0.22)) | (hole > 0.9) | steep
    # lone specks of matter (a floater, a banner's tassel) don't wall off a cell; thin walls stay (no opening)
    thr = max(3.0, fl * 0.22)
    lab_b, nb = ndimage.label(blocked)
    sizes = ndimage.sum(np.ones_like(occ), lab_b, np.arange(1, nb + 1))
    lone = np.isin(lab_b, np.where(sizes < 2)[0] + 1) & (occ < thr * 3)
    blocked = (blocked & ~lone) | (hole > 0.9)
    # only the open floor joined to where you arrive counts; pockets you can't reach are walls
    lab, _ = ndimage.label(~blocked)
    here = lab[cz, cx]
    if here == 0:
        # the arrival cell itself looks blocked: take the nearest open region
        dist, (jz, jx) = ndimage.distance_transform_edt(blocked, return_indices=True)
        here = lab[jz[cz, cx], jx[cz, cx]]
    walk = lab == here
    sdf = (ndimage.distance_transform_edt(walk) - ndimage.distance_transform_edt(~walk)) * C
    print(f'walkable cells: {walk.sum()} ({walk.sum() * C * C:.0f} m2)')

    # the vault: lowest dense matter more than 2.2 m over the floor, near the middle; the camera keeps under it
    rel_all = pos[:, 1] - hcell
    roof = inside & (rel_all > 2.2) & walk[np.clip(iz, 0, nz - 1), np.clip(ix, 0, nx - 1)]
    low = np.full(nx * nz, np.inf, np.float32)
    np.minimum.at(low, iz[roof] * nx + ix[roof], rel_all[roof])
    low = low[np.isfinite(low)]
    ceil = float(np.percentile(low, 25)) if len(low) > 30 else 8.0
    print(f'vault from {ceil:.1f} m over the floor')

    # in game metres: the capture point's floor is y = 0
    H = np.round((floor_f - f0) * 100).astype(int)
    D = np.round(np.clip(sdf, -9.99, 9.99) * 100).astype(int)
    data = {'id': a.id, 'flip': bool(flip), 'level': [round(float(v), 6) for v in q], 'eye': round(-f0, 3), 'x0': round(x0, 3), 'z0': round(z0, 3), 'cell': C, 'nx': nx, 'nz': nz,
            'ceil': round(min(ceil, 12.0), 2), 'h': H.ravel().tolist(), 'd': D.ravel().tolist()}
    write_ts(a.out, a.id, data)
    png = a.png or os.path.join(os.path.dirname(a.file) or '.', f'{a.id}-floor.png')
    picture(png, pos, rgb, alpha, ok, x0, z0, C, nx, nz, walk, floor_f - f0)
    print(f'wrote {a.out} and {png}')


def write_ts(path, rid, data):
    cur = {}
    if os.path.exists(path):
        m = re.search(r'export const REALM_DATA[^=]*=\s*(\{.*\});', open(path).read(), re.S)
        if m:
            cur = json.loads(m.group(1))
    cur[rid] = data
    body = json.dumps(cur, separators=(',', ':'))
    with open(path, 'w') as f:
        f.write('// Written by tools/atlas/floor.py from each 秘境\'s splats: do not edit. Heights and distances in centimetres.\n')
        f.write('// h: the floor per cell (0 = the floor where you arrive); d: distance to the nearest cell you can\'t stand in\n')
        f.write('// (negative inside one). Row by row in z, x0 / z0 the grid\'s corner, relative to the capture point.\n')
        f.write('// flip: the file is stored y down (turn it over first); level: then this turn (x, y, z, w) makes its floor level.\n')
        f.write('export interface RealmGridData { id: string; flip: boolean; level?: number[]; eye: number; x0: number; z0: number; cell: number; nx: number; nz: number; ceil: number; h: number[]; d: number[] }\n')
        f.write(f'export const REALM_DATA: Record<string, RealmGridData> = {body};\n')


def picture(path, pos, rgb, alpha, ok, x0, z0, C, nx, nz, walk, hgt):
    try:
        from PIL import Image
    except Exception:
        return
    S = 4
    img = np.zeros((nz * S, nx * S, 3), np.float32)
    acc = np.zeros((nz * S, nx * S), np.float32)
    px = ((pos[:, 0] - x0) / C * S).astype(int)
    pz = ((pos[:, 2] - z0) / C * S).astype(int)
    m = ok & (px >= 0) & (px < nx * S) & (pz >= 0) & (pz < nz * S)
    np.add.at(img, (pz[m], px[m]), rgb[m] * alpha[m, None])
    np.add.at(acc, (pz[m], px[m]), alpha[m])
    img = img / np.maximum(acc, 1e-6)[..., None]
    wm = np.kron(walk, np.ones((S, S))).astype(bool)
    img[~wm] = img[~wm] * 0.45 + np.array([0.5, 0.05, 0.05]) * 0.55
    c = (nz * S // 2, nx * S // 2)
    img[c[0] - 3:c[0] + 4, c[1] - 3:c[1] + 4] = [1, 1, 0]
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(path)


if __name__ == '__main__':
    main()
