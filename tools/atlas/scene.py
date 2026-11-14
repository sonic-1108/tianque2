#!/usr/bin/env python3
"""Atlas scene pipeline: a walkable 3D Gaussian splat place from one text prompt.

Runs inside GitHub Actions (worldlabs.yml, action=scene) with the repo secret WORLDLABS_API_KEY in $KEY.
The key is only ever sent as a request header; nothing here prints it.

  stage t2i    text to image with metric depth, several samples: out/t2i.json, out/t2i-<k>.png
  stage world  from the chosen sample (prev/t2i.json, SPEC.pick): rings of new views around the capture point
               (atlasGenerate with depth, three rounds), then posedImages2Splats: out/scene.json, out/v-*.png, out/splats.*
  stage mesh   splats2Mesh on the splats of prev/scene.json: out/mesh.*

Cameras are RUB (x right, y up, looking along -z), camera to world, quaternions XYZW, metres.
"""
import json, math, os, sys, time, uuid, urllib.request, urllib.error

API = os.environ.get('API', 'https://api.atlas.worldlabs.ai/api/v2')
KEY = os.environ.get('KEY', '')
OUT = os.environ.get('OUT', 'out')
PREV = os.environ.get('PREV', 'prev')
SPEC = json.loads(os.environ.get('SPEC') or '{}')
os.makedirs(OUT, exist_ok=True)


def log(*a):
    print(*a, flush=True)


def die(msg):
    log('FAILED: ' + msg)
    sys.exit(1)


def save(name, obj):
    with open(os.path.join(OUT, name), 'w') as f:
        json.dump(obj, f, indent=1)


def req(method, path, body=None, timeout=180):
    url = f'{API}/{path}'
    h = {'WLT-Api-Key': KEY}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        h['Content-Type'] = 'application/json'
    if method == 'POST' and path.startswith('tasks:'):
        h['Idempotency-Key'] = str(uuid.uuid4())
    for attempt in range(5):
        r = urllib.request.Request(url, data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(r, timeout=timeout) as f:
                txt = f.read()
                return f.status, (json.loads(txt) if txt else None)
        except urllib.error.HTTPError as e:
            txt = e.read().decode(errors='replace')
            if e.code >= 500 and attempt < 4:
                time.sleep(5 * (attempt + 1))
                continue
            try:
                return e.code, json.loads(txt)
            except Exception:
                return e.code, {'raw': txt[:3000]}
        except Exception as e:  # network hiccup
            if attempt < 4:
                time.sleep(5 * (attempt + 1))
                continue
            return 0, {'raw': repr(e)}


def submit(task, body, tag):
    save(f'{tag}-request.json', body)
    code, op = req('POST', f'tasks:{task}', body)
    return code, op


def wait(op, tag, task):
    oid = op['id']
    log(f'{tag}: {task} operation {oid}')
    t0 = time.time()
    last = -60
    while not op.get('done'):
        time.sleep(8)
        code, o = req('GET', f'operations/{oid}')
        if code == 200 and isinstance(o, dict):
            op = o
        el = time.time() - t0
        if el - last >= 60:
            last = el
            log(f'  {tag} {int(el)} s {json.dumps(op.get("metadata"))[:220]}')
        if el > 3 * 3600:
            die(f'{tag} not done in 3 h (operation {oid})')
    save(f'{tag}.json', op)
    if op.get('error'):
        die(f'{tag} failed: {json.dumps(op["error"])[:2000]}')
    log(f'{tag}: done in {int(time.time() - t0)} s')
    return op['response']


def run(task, bodies, tag):
    """Submit the first body the API accepts (later ones are fallbacks for schema doubts), then wait."""
    last = None
    for i, body in enumerate(bodies):
        code, op = submit(task, body, tag if i == 0 else f'{tag}-alt{i}')
        if code < 300 and isinstance(op, dict) and op.get('id'):
            return wait(op, tag, task)
        last = (code, op)
        log(f'{tag}: {task} refused ({code}): {json.dumps(op)[:1500]}')
        if code not in (400, 422):
            break
    save(f'{tag}-error.json', {'code': last[0], 'body': last[1]})
    die(f'{task} submit failed')


SNIFF = [(b'\x89PNG', '.png'), (b'\x76\x2f\x31\x01', '.exr'), (b'\xff\xd8', '.jpg'), (b'ply', '.ply'), (b'\x1f\x8b', '.spz'),
         (b'NGSP', '.spz'), (b'glTF', '.glb'), (b'PK', '.zip'), (b'RIFF', '.webp')]


def fetch(asset, name):
    aid = asset.get('assetId')
    url = None
    if aid:
        code, r = req('POST', f'assets/{aid}:createReadUrl', {})
        if code < 300 and isinstance(r, dict):
            url = r.get('url') or r.get('readUrl') or r.get('signedUrl')
    url = url or asset.get('url')
    if not url:
        log(f'  no url for {name}')
        return None
    tmp = os.path.join(OUT, name + '.part')
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=900) as f, open(tmp, 'wb') as w:
                while True:
                    b = f.read(1 << 20)
                    if not b:
                        break
                    w.write(b)
            break
        except Exception as e:
            log(f'  retry {name}: {e!r}')
            time.sleep(5)
    with open(tmp, 'rb') as f:
        head = f.read(8)
    ext = next((e for m, e in SNIFF if head.startswith(m)), os.path.splitext(url.split('?')[0])[1] or '.bin')
    path = os.path.join(OUT, name + ext)
    os.replace(tmp, path)
    log(f'  {os.path.basename(path)} {os.path.getsize(path)} bytes')
    return os.path.basename(path)


# ---- camera maths (XYZW quaternions) ----
def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return [aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz]


def qrot(q, v):
    x, y, z, w = q
    vx, vy, vz = v
    tx, ty, tz = 2 * (y * vz - z * vy), 2 * (z * vx - x * vz), 2 * (x * vy - y * vx)
    return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)]


def ypq(yaw, pitch):
    a, b = math.radians(yaw) / 2, math.radians(pitch) / 2
    return qmul([0, math.sin(a), 0, math.cos(a)], [math.sin(b), 0, 0, math.cos(b)])


def fwd(yaw):
    r = math.radians(yaw)
    return [-math.sin(r), 0.0, -math.cos(r)]


class Rig:
    """Cameras placed relative to the first frame's camera, at a size atlasGenerate makes (1280x720 by default),
    with the first frame's field of view and square pixels."""

    def __init__(self, cam0, size=(1280, 720)):
        ex = cam0['extrinsics']
        cs = ex.get('coordinateSystem', 'rub')
        if cs != 'rub':
            log(f'warning: first camera is {cs}, treating it as rub')
        self.p0, self.q0 = ex['position'], ex['quaternion']
        k0 = cam0['intrinsics']
        w, h = size
        f = (k0['fx'] / k0['width'] * w + k0['fy'] / k0['height'] * h) / 2
        self.K = {'fx': f, 'fy': f, 'cx': w / 2, 'cy': h / 2, 'width': w, 'height': h}

    def cam(self, pos, yaw, pitch):
        p = qrot(self.q0, pos)
        return {'extrinsics': {'position': [self.p0[i] + p[i] for i in range(3)], 'quaternion': qmul(self.q0, ypq(yaw, pitch)),
                               'coordinateSystem': 'rub'},
                'intrinsics': dict(self.K)}


def view(yaw, pitch=0.0, d=0.35, base=(0.0, 0.0, 0.0), y=0.0):
    f = fwd(yaw)
    return {'pos': [base[0] + f[0] * d, base[1] + y, base[2] + f[2] * d], 'yaw': yaw, 'pitch': pitch}


def clean_cam(c, cs=True):
    ex = {'position': c['extrinsics']['position'], 'quaternion': c['extrinsics']['quaternion']}
    if cs:
        ex['coordinateSystem'] = c['extrinsics'].get('coordinateSystem', 'rub')
    return {'extrinsics': ex, 'intrinsics': {k: c['intrinsics'][k] for k in ('fx', 'fy', 'cx', 'cy', 'width', 'height')}}


def depth_variants(d):
    """The depth object as the API returned it, in the shapes the docs show for inputs."""
    ref = lambda k: {'assetId': d[k]['assetId']}
    if d.get('depthAsset'):
        a = {'depthAsset': ref('depthAsset')}
        b = dict(a, confidenceAsset=ref('confidenceAsset')) if d.get('confidenceAsset') else a
        return [a, b]
    a = {'logDepthAsset': ref('logDepthAsset'), 'zMin': d['zMin'], 'zMax': d['zMax']}
    b = dict(a, confidenceAsset=ref('confidenceAsset')) if d.get('confidenceAsset') else a
    return [a, b, {'depthAsset': ref('logDepthAsset')}]


def rescale(cam, w=1280, h=720):
    k = cam['intrinsics']
    sx, sy = w / k['width'], h / k['height']
    return {'extrinsics': cam['extrinsics'], 'intrinsics': {'fx': k['fx'] * sx, 'fy': k['fy'] * sy, 'cx': k['cx'] * sx, 'cy': k['cy'] * sy,
                                                           'width': w, 'height': h}}


def posed(frames, variant, cs=True, size=None):
    if size:
        frames = [dict(f, camera=rescale(f['camera'], *size)) for f in frames]
    return [{'imageAsset': {'assetId': f['imageAsset']['assetId']}, 'depth': (lambda v: v[min(variant, len(v) - 1)])(depth_variants(f['depth'])),
             'camera': clean_cam(f['camera'], cs)} for f in frames]


def stage_t2i():
    body = {'prompt': SPEC['prompt'], 'aspectRatio': SPEC.get('aspect', '16:9'), 'returnDepth': True,
            'numSamples': int(SPEC.get('samples', 4))}
    if SPEC.get('seed') is not None:
        body['seed'] = int(SPEC['seed'])
    res = run('atlasTextToImage', [body], 't2i')
    for k, f in enumerate(res['frames']):
        fetch(f['imageAsset'], f't2i-{k}')
    log('promptUsed: ' + (res.get('promptUsed') or '')[:1200])


def gen_round(rig, ctx, views, prompt, tag):
    cams = [rig.cam(v['pos'], v['yaw'], v['pitch']) for v in views]
    bodies = []
    for variant, cs, size in ((0, True, None), (0, False, None), (1, True, None), (2, True, None), (0, True, (1280, 720))):
        bodies.append({'contextFrames': posed(ctx, variant, cs, size), 'targetCameras': [clean_cam(c, cs) for c in cams],
                       'prompt': prompt, 'enhancePrompt': False, 'returnDepth': True})
    res = run('atlasGenerate', bodies, tag)
    frames = res['frames']
    if len(frames) != len(views):
        log(f'warning: asked {len(views)} views, got {len(frames)}')
    for f, v in zip(frames, views):
        f['_view'] = v
    return frames


def stage_world():
    with open(os.path.join(PREV, 't2i.json')) as f:
        t2i = json.load(f)['response']
    pick = int(SPEC.get('pick', 0))
    f0 = t2i['frames'][pick]
    f0['_view'] = {'pos': [0, 0, 0], 'yaw': 0, 'pitch': 0}
    prompt = SPEC.get('prompt') or (t2i.get('promptsUsed') or [None] * 8)[pick] or t2i.get('promptUsed')
    rig = Rig(f0['camera'])
    log(f'first camera: {json.dumps(f0["camera"])}')
    # round 1: the first view again at the generation size (the original is larger), the front half, a look down, a step in
    r1 = [view(0, 0, 0.0), view(35), view(-35), view(70), view(-70), view(0, -40), view(0, 0, 2.0)]
    allf = gen_round(rig, [f0], r1, prompt, 'gen1')
    # round 2: the back, a ring looking down, the vault overhead
    r2 = [view(105), view(-105), view(140), view(-140), view(180)]
    r2 += [view(a, -45) for a in (60, 120, 180, -120, -60)]
    r2 += [view(a, 35) for a in (0, 90, 180, -90)] + [view(0, 70, 0.2), view(180, 70, 0.2)]
    allf += gen_round(rig, allf[:7], r2, prompt, 'gen2')
    # round 3: four standpoints a few metres out, so the place holds up as you walk in it
    ring = [f for f in allf if f['_view']['pitch'] == 0][:11]
    r3 = []
    R = float(SPEC.get('walk', 3.0))
    # standpoints: a ring of four at R, or the spec's own (x, z) list (a corridor walks along its length)
    stands = SPEC.get('stands') or [[fwd(o)[0] * R, fwd(o)[2] * R] for o in (0, 90, -90, 180)]
    for sx, sz in stands:
        out = math.degrees(math.atan2(-sx, -sz)) if math.hypot(sx, sz) > 1e-6 else 0.0
        for dy in (0, 70, -70, 180):
            r3.append(view(out + dy, -12, 0.0, (sx, 0.0, sz)))
    allf += gen_round(rig, ring, r3, prompt, 'gen3')
    # keep every view for review
    scene = {'prompt': prompt, 'frames': []}
    for i, f in enumerate(allf):
        name = fetch(f['imageAsset'], f'v-{i:02d}')
        scene['frames'].append({'image': name, 'view': f['_view'], 'camera': f['camera'],
                                'imageAsset': f['imageAsset'].get('assetId'),
                                'depth': {k: (v.get('assetId') if isinstance(v, dict) else v) for k, v in f['depth'].items()}})
    save('scene.json', scene)
    # splats from every posed view
    bodies = []
    for variant, cs in ((0, True), (0, False), (1, True), (2, True)):
        bodies.append({'posedFrames': posed(allf, variant, cs), 'prompt': prompt, 'enhancePrompt': False})
    res = run('posedImages2Splats', bodies, 'splats')
    scene['splatsResponse'] = res
    n = 0
    for path, a in assets(res):
        n += 1
        scene.setdefault('splatFiles', []).append({'path': path, 'file': fetch(a, 'splats' if n == 1 else f'splats-{n}'), 'assetId': a['assetId']})
    save('scene.json', scene)


def assets(obj, path=''):
    if isinstance(obj, dict):
        if 'assetId' in obj:
            yield path, obj
            return
        for k, v in obj.items():
            yield from assets(v, f'{path}.{k}' if path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from assets(v, f'{path}[{i}]')


def stage_mesh():
    with open(os.path.join(PREV, 'scene.json')) as f:
        scene = json.load(f)
    sp = scene['splatFiles'][0]['assetId']
    body = SPEC.get('body') or {'splatsAsset': {'assetId': sp}}
    res = run('splats2Mesh', [body], 'mesh')
    n = 0
    for path, a in assets(res):
        n += 1
        fetch(a, 'mesh' if n == 1 else f'mesh-{n}')


if __name__ == '__main__':
    if not KEY:
        die('WORLDLABS_API_KEY is not set')
    st = SPEC.get('stage', 't2i')
    {'t2i': stage_t2i, 'world': stage_world, 'mesh': stage_mesh}[st]()
