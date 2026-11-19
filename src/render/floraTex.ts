// The flora's painted textures (render/Flora.tsx): one leaf atlas of eight 512 px cells, each a cluster seen on a
// card (broadleaf, maple, ginkgo, peach blossom, pine needles from above, a fir spray, willow strands, bamboo
// leaves), drawn leaf by leaf with their veins and twigs so the cards read as foliage, not as green paper; the bark;
// bamboo culm; the grass blade and the wildflower petals.
import * as THREE from 'three';

let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const R = (a: number, b: number) => a + (b - a) * rnd();
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
export const CELL = 512;
/** which cell of the atlas (column, row) */
export const CELLS = { broad: [0, 0], maple: [1, 0], ginkgo: [2, 0], blossom: [3, 0], pine: [0, 1], fir: [1, 1], willow: [2, 1], bamboo: [3, 1] } as const;
export type CellName = keyof typeof CELLS;

type G = CanvasRenderingContext2D;
/** an ovate leaf from its stalk at (x, y) pointing along ang: lighter along the midrib, darker toward the edge */
function leaf(g: G, x: number, y: number, len: number, wid: number, ang: number, h: number, s: number, l: number, tipSharp = 0.3) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  const gr = g.createLinearGradient(0, -wid, 0, wid);
  gr.addColorStop(0, hsl(h, s, l - 7));
  gr.addColorStop(0.5, hsl(h + 4, s - 5, l + 8));
  gr.addColorStop(1, hsl(h, s, l - 9));
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(len * 0.25, -wid * 1.05, len * (0.75 - tipSharp * 0.2), -wid * 0.75, len, 0);
  g.bezierCurveTo(len * (0.75 - tipSharp * 0.2), wid * 0.75, len * 0.25, wid * 1.05, 0, 0);
  g.fill();
  // the midrib and a few veins
  g.strokeStyle = hsl(h + 8, s - 15, l + 16, 0.55);
  g.lineWidth = Math.max(0.8, len * 0.02);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(len * 0.95, 0);
  g.stroke();
  g.lineWidth = Math.max(0.5, len * 0.008);
  g.strokeStyle = hsl(h + 8, s - 15, l + 12, 0.35);
  for (let k = 1; k < 5; k++) {
    const t = k / 5.5;
    g.beginPath();
    g.moveTo(len * t, 0);
    g.lineTo(len * (t + 0.14), -wid * 0.62 * Math.sin(Math.PI * (t + 0.07)));
    g.moveTo(len * t, 0);
    g.lineTo(len * (t + 0.14), wid * 0.62 * Math.sin(Math.PI * (t + 0.07)));
    g.stroke();
  }
  g.restore();
}
/** a twig from (x, y) toward ang, bending a little; returns points along it */
let clipO: [number, number] | null = null;
function twig(g: G, x: number, y: number, len: number, ang: number, w: number, col: string, bend = 0.3) {
  const pts: [number, number, number][] = [];
  let a = ang, px = x, py = y;
  const n = 8;
  g.strokeStyle = col;
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    a += (rnd() - 0.5) * bend;
    const nx = px + Math.cos(a) * (len / n), ny = py + Math.sin(a) * (len / n);
    // twigs stay inside the cell's round (a twig cut off at a card's edge gives the card away)
    if (clipO && Math.hypot(nx - clipO[0] - CELL / 2, ny - clipO[1] - CELL / 2) > CELL * 0.46) break;
    g.lineWidth = w * (1 - (i / n) * 0.7);
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(nx, ny);
    g.stroke();
    px = nx;
    py = ny;
    pts.push([px, py, a]);
  }
  return pts;
}
/** keep a leaf inside the cell's round: fewer near the rim, so a card has no edge */
const inside = (x: number, y: number, ox: number, oy: number, r = 0.47) => Math.hypot(x - ox - CELL / 2, y - oy - CELL / 2) < CELL * r * (0.82 + rnd() * 0.18);

function broad(g: G, ox: number, oy: number, opt: { h: number; s: number; l: number; len: [number, number]; wid: number; n: number; sharp?: number }) {
  // twigs from the bottom middle (the side a card turns toward its branch), leaves along them
  const bx = ox + CELL / 2, by = oy + CELL * 0.96;
  for (let k = 0; k < 7; k++) {
    const pts = twig(g, bx + R(-30, 30), by, R(CELL * 0.55, CELL * 0.85), -Math.PI / 2 + R(-1.0, 1.0), R(3, 6), hsl(25, 30, 22));
    for (let i = 1; i < pts.length; i++) {
      const [x, y, a] = pts[i];
      for (const side of [-1, 1]) {
        if (rnd() < 0.15) continue;
        const la = a + side * R(0.5, 1.2);
        const L = R(opt.len[0], opt.len[1]) * (0.75 + i / pts.length * 0.35);
        const lx = x + Math.cos(la) * 4, ly = y + Math.sin(la) * 4;
        if (!inside(lx + Math.cos(la) * L * 0.5, ly + Math.sin(la) * L * 0.5, ox, oy)) continue;
        leaf(g, lx, ly, L, L * opt.wid, la, opt.h + R(-8, 8), opt.s + R(-8, 8), opt.l + R(-7, 7), opt.sharp);
      }
    }
  }
  // loose leaves filling the gaps
  for (let k = 0; k < opt.n; k++) {
    const a = R(0, Math.PI * 2), r = Math.sqrt(rnd()) * CELL * 0.4;
    const x = ox + CELL / 2 + Math.cos(a) * r, y = oy + CELL / 2 + Math.sin(a) * r;
    const L = R(opt.len[0], opt.len[1]);
    leaf(g, x, y, L, L * opt.wid, a + R(-0.6, 0.6), opt.h + R(-8, 8), opt.s + R(-8, 8), opt.l + R(-9, 6), opt.sharp);
  }
}
/** a palmate maple leaf: five pointed lobes */
function mapleLeaf(g: G, x: number, y: number, r: number, ang: number, h: number, s: number, l: number) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = hsl(h, s, l);
  g.beginPath();
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    // lobes at 0, ±72°, ±144° (the stalk at 180°)
    const lobe = Math.pow(Math.abs(Math.cos((t * 5) / 2)), 1.3);
    const rr = r * (0.5 + 0.5 * lobe) * (Math.abs(Math.cos(t / 2)) > 0.1 ? 1 : 0.5);
    const px = Math.cos(t) * rr, py = Math.sin(t) * rr;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = hsl(h + 6, s - 12, l + 14, 0.5);
  g.lineWidth = 1;
  for (let k = -2; k <= 2; k++) {
    const a = (k * 2 * Math.PI) / 5;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
    g.stroke();
  }
  g.restore();
}
function maple(g: G, ox: number, oy: number) {
  const bx = ox + CELL / 2, by = oy + CELL * 0.96;
  for (let k = 0; k < 6; k++) {
    const pts = twig(g, bx + R(-30, 30), by, R(CELL * 0.5, CELL * 0.8), -Math.PI / 2 + R(-1.1, 1.1), R(2.5, 5), hsl(15, 35, 24));
    for (let i = 1; i < pts.length; i += 1) {
      const [x, y, a] = pts[i];
      if (rnd() < 0.3) continue;
      const la = a + R(-1.2, 1.2), r = R(26, 40);
      const lx = x + Math.cos(la) * r * 1.2, ly = y + Math.sin(la) * r * 1.2;
      if (!inside(lx, ly, ox, oy)) continue;
      g.strokeStyle = hsl(20, 30, 30);
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(lx, ly);
      g.stroke();
      mapleLeaf(g, lx, ly, r, la, 100 + R(-10, 10), 48 + R(-8, 8), 33 + R(-7, 7));
    }
  }
  for (let k = 0; k < 40; k++) {
    const a = R(0, Math.PI * 2), rr = Math.sqrt(rnd()) * CELL * 0.4;
    mapleLeaf(g, ox + CELL / 2 + Math.cos(a) * rr, oy + CELL / 2 + Math.sin(a) * rr, R(24, 36), R(0, 6.28), 100 + R(-10, 10), 48 + R(-8, 8), 30 + R(-8, 6));
  }
}
/** ginkgo: fans on short spurs, in bunches */
function ginkgo(g: G, ox: number, oy: number) {
  const fan = (x: number, y: number, r: number, ang: number, l: number) => {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.fillStyle = hsl(80 + R(-6, 6), 50, l);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(-0.75) * r, Math.sin(-0.75) * r);
    g.quadraticCurveTo(r * 1.15, -r * 0.25, r * 1.02, -r * 0.03);
    g.lineTo(r * 0.82, 0); // the notch
    g.lineTo(r * 1.02, r * 0.03);
    g.quadraticCurveTo(r * 1.15, r * 0.25, Math.cos(0.75) * r, Math.sin(0.75) * r);
    g.closePath();
    g.fill();
    g.strokeStyle = hsl(70, 40, l + 12, 0.35);
    g.lineWidth = 0.7;
    for (let k = -4; k <= 4; k++) {
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(k * 0.17) * r, Math.sin(k * 0.17) * r);
      g.stroke();
    }
    g.restore();
  };
  const bx = ox + CELL / 2, by = oy + CELL * 0.96;
  for (let k = 0; k < 40; k++) {
    const a = R(0, 6.28), rr = Math.sqrt(rnd()) * CELL * 0.38;
    fan(ox + CELL / 2 + Math.cos(a) * rr, oy + CELL / 2 + Math.sin(a) * rr, R(22, 32), R(0, 6.28), 36 + R(-8, 6));
  }
  for (let k = 0; k < 10; k++) {
    const pts = twig(g, bx + R(-30, 30), by, R(CELL * 0.5, CELL * 0.85), -Math.PI / 2 + R(-0.9, 0.9), R(3, 5), hsl(28, 25, 26), 0.25);
    for (let i = 1; i < pts.length; i++) {
      const [x, y] = pts[i];
      if (!inside(x, y, ox, oy)) continue;
      // a spur with four to six fans
      const n = 4 + Math.floor(rnd() * 3);
      for (let j = 0; j < n; j++) {
        const a = -Math.PI / 2 + R(-1.6, 1.6);
        fan(x, y, R(24, 34), a, 38 + R(-7, 7));
      }
    }
  }
}
/** peach blossom: dark twigs dense with five-petalled pink and white flowers, a few young leaves */
function blossom(g: G, ox: number, oy: number) {
  const bx = ox + CELL / 2, by = oy + CELL * 0.96;
  const flower = (x: number, y: number, r: number) => {
    const h = 340 + R(-8, 12), l = R(78, 92), s = R(45, 75);
    const a0 = R(0, 6.28);
    for (let k = 0; k < 5; k++) {
      const a = a0 + (k * 2 * Math.PI) / 5;
      g.fillStyle = hsl(h, s, l);
      g.beginPath();
      g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55, r * 0.42, a, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = hsl(345, 70, 55);
    g.beginPath();
    g.arc(x, y, r * 0.28, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hsl(50, 90, 70);
    for (let k = 0; k < 6; k++) {
      const a = R(0, 6.28);
      g.fillRect(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, 1.6, 1.6);
    }
  };
  for (let k = 0; k < 9; k++) {
    const pts = twig(g, bx + R(-30, 30), by, R(CELL * 0.5, CELL * 0.85), -Math.PI / 2 + R(-1.0, 1.0), R(3, 6), hsl(15, 30, 16), 0.3);
    for (let i = 0; i < pts.length; i++) {
      const [x, y, a] = pts[i];
      for (let j = 0; j < 3; j++) {
        const fx = x + R(-14, 14), fy = y + R(-14, 14);
        if (!inside(fx, fy, ox, oy)) continue;
        if (rnd() < 0.15) leaf(g, x, y, R(26, 36), 12, a + R(-1.4, 1.4), 95, 50, 42);
        else flower(fx, fy, R(9, 14));
      }
    }
  }
  for (let k = 0; k < 70; k++) {
    const a = R(0, 6.28), rr = Math.sqrt(rnd()) * CELL * 0.36;
    flower(ox + CELL / 2 + Math.cos(a) * rr, oy + CELL / 2 + Math.sin(a) * rr, R(9, 13));
  }
}
/** pine needles seen from above: tufts of fine needles radiating, packed into a pad */
function pine(g: G, ox: number, oy: number) {
  const tuft = (x: number, y: number, len: number) => {
    const n = 34;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + R(-0.1, 0.1), L = len * R(0.6, 1);
      g.strokeStyle = hsl(112 + R(-10, 10), 40 + R(-8, 8), 27 + R(-5, 12));
      g.lineWidth = R(1.1, 2);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + R(-3, 3), y + Math.sin(a) * L * 0.5 + R(-3, 3), x + Math.cos(a) * L, y + Math.sin(a) * L);
      g.stroke();
    }
  };
  // twigs under the needles
  for (let k = 0; k < 6; k++) twig(g, ox + CELL / 2, oy + CELL / 2, R(CELL * 0.3, CELL * 0.42), R(0, 6.28), R(3, 5), hsl(20, 30, 20), 0.4);
  for (let k = 0; k < 120; k++) {
    const a = R(0, 6.28), r = Math.pow(rnd(), 0.6) * CELL * 0.4;
    tuft(ox + CELL / 2 + Math.cos(a) * r, oy + CELL / 2 + Math.sin(a) * r, R(36, 60) * (1 - r / (CELL * 0.6)));
  }
}
/** a fir branchlet from the side: a twig drooping from the top-left, combed with short needles both sides */
function fir(g: G, ox: number, oy: number) {
  const comb = (pts: [number, number, number][], L: number) => {
    for (const [x, y, a] of pts)
      for (let k = 0; k < 6; k++) {
        const t = k / 6;
        for (const s of [-1, 1]) {
          const na = a + s * (0.9 + R(-0.2, 0.2)) + 0.3; // swept forward and down a little
          const px = x + Math.cos(a) * t * 8, py = y + Math.sin(a) * t * 8;
          g.strokeStyle = hsl(140 + R(-10, 8), 32 + R(-6, 6), 27 + R(-4, 10));
          g.lineWidth = R(1.4, 2.4);
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(px + Math.cos(na) * L * R(0.7, 1), py + Math.sin(na) * L * R(0.7, 1));
          g.stroke();
        }
      }
  };
  for (let k = 0; k < 4; k++) {
    const main = twig(g, ox + CELL * 0.5 + R(-40, 40), oy + CELL * 0.08, CELL * R(0.7, 0.85), Math.PI / 2 + R(-0.5, 0.5), 5, hsl(20, 30, 22), 0.15);
    comb(main, 30);
    for (let i = 1; i < main.length - 1; i += 2) {
      const [x, y, a] = main[i];
      for (const s of [-1, 1]) {
        const side = twig(g, x, y, R(80, 150), a + s * R(0.6, 1.0), 2.5, hsl(20, 30, 24), 0.2);
        comb(side, 22);
      }
    }
  }
}
/** willow: strands hanging from the top edge, narrow leaves all down them */
function willow(g: G, ox: number, oy: number) {
  for (let k = 0; k < 26; k++) {
    let x = ox + R(20, CELL - 20), y = oy + 2;
    const sway = R(-0.15, 0.15);
    const len = R(CELL * 0.6, CELL * 0.97);
    g.strokeStyle = hsl(60, 30, 30);
    g.lineWidth = 1.5;
    const pts: [number, number][] = [];
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i < 24; i++) {
      x += Math.sin(i * 0.3 + k) * 1.2 + sway * 4;
      y += len / 24;
      g.lineTo(x, y);
      pts.push([x, y]);
    }
    g.stroke();
    for (const [px, py] of pts)
      for (const s of [-1, 1]) {
        if (rnd() < 0.2) continue;
        leaf(g, px, py, R(24, 38), 4.5, Math.PI / 2 + s * R(0.25, 0.6), 78 + R(-8, 8), 50 + R(-8, 8), 42 + R(-8, 8), 0.6);
      }
  }
}
/** bamboo: sprays of long lanceolate leaves from little nodes, fanned and drooping */
function bamboo(g: G, ox: number, oy: number) {
  const bx = ox + CELL / 2, by = oy + CELL * 0.96;
  for (let k = 0; k < 30; k++) {
    const a = R(0, 6.28), rr = Math.sqrt(rnd()) * CELL * 0.33;
    const x = ox + CELL / 2 + Math.cos(a) * rr, y = oy + CELL / 2 + Math.sin(a) * rr;
    leaf(g, x, y, R(70, 110), 8.5, R(0, 6.28), 92 + R(-10, 8), 45 + R(-8, 8), 34 + R(-8, 8), 0.7);
  }
  for (let k = 0; k < 11; k++) {
    const pts = twig(g, bx + R(-40, 40), by, R(CELL * 0.45, CELL * 0.8), -Math.PI / 2 + R(-1.2, 1.2), 2.5, hsl(70, 35, 30), 0.12);
    for (let i = 2; i < pts.length; i += 2) {
      const [x, y, a] = pts[i];
      const n = 3 + Math.floor(rnd() * 3);
      for (let j = 0; j < n; j++) {
        const la = a + R(-1.3, 1.3) + 0.25;
        const L = R(70, 115);
        if (!inside(x + Math.cos(la) * L * 0.5, y + Math.sin(la) * L * 0.5, ox, oy)) continue;
        leaf(g, x, y, L, 8.5, la, 92 + R(-10, 8), 45 + R(-8, 8), 38 + R(-8, 8), 0.7);
      }
    }
  }
}

let atlas: THREE.CanvasTexture | null = null;
/** the leaf atlas: 4 x 2 cells of 512 px */
export function leafAtlas() {
  if (atlas) return atlas;
  seed = 7;
  const c = document.createElement('canvas');
  c.width = CELL * 4;
  c.height = CELL * 2;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  const at = (n: CellName) => [CELLS[n][0] * CELL, CELLS[n][1] * CELL] as const;
  const clip = (n: CellName, f: (ox: number, oy: number) => void) => {
    const [ox, oy] = at(n);
    clipO = n === 'willow' || n === 'fir' ? null : [ox, oy];
    g.save();
    g.beginPath();
    g.rect(ox + 1, oy + 1, CELL - 2, CELL - 2);
    g.clip();
    f(ox, oy);
    g.restore();
  };
  clip('broad', (ox, oy) => broad(g, ox, oy, { h: 100, s: 45, l: 32, len: [44, 70], wid: 0.42, n: 90 }));
  clip('maple', (ox, oy) => maple(g, ox, oy));
  clip('ginkgo', (ox, oy) => ginkgo(g, ox, oy));
  clip('blossom', (ox, oy) => blossom(g, ox, oy));
  clip('pine', (ox, oy) => pine(g, ox, oy));
  clip('fir', (ox, oy) => fir(g, ox, oy));
  clip('willow', (ox, oy) => willow(g, ox, oy));
  clip('bamboo', (ox, oy) => bamboo(g, ox, oy));
  atlas = new THREE.CanvasTexture(c);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 8;
  atlas.generateMipmaps = true;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  return atlas;
}
/** the UV rectangle of a cell (v up, as three reads the canvas) */
export function cellUV(n: CellName): [number, number, number, number] {
  const [cx, cy] = CELLS[n];
  return [cx / 4, 1 - (cy + 1) / 2, (cx + 1) / 4, 1 - cy / 2];
}

/** bark: deep vertical fissures between ridges, tiling round and up a trunk */
export function barkTex() {
  seed = 11;
  const W = 256, H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  // light, so the material's colour sets the tone (a mid-grey texture times a mid-brown colour is near black)
  g.fillStyle = '#e2dbd2';
  g.fillRect(0, 0, W, H);
  // blotches
  for (let k = 0; k < 300; k++) {
    g.fillStyle = `rgba(${R(140, 230)},${R(130, 220)},${R(120, 205)},${R(0.1, 0.25)})`;
    g.beginPath();
    g.ellipse(R(0, W), R(0, H), R(6, 30), R(15, 60), 0, 0, Math.PI * 2);
    g.fill();
  }
  // fissures: wavy dark lines up the trunk (drawn wrapped so it tiles round)
  for (let k = 0; k < 26; k++) {
    let x = R(0, W);
    g.strokeStyle = `rgba(60,48,38,${R(0.45, 0.8)})`;
    g.lineWidth = R(2, 6);
    g.beginPath();
    for (let y = -10; y <= H + 10; y += 12) {
      x += R(-4, 4);
      if (y === -10) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    // its light ridge beside
    g.strokeStyle = `rgba(255,250,240,${R(0.15, 0.3)})`;
    g.lineWidth = R(1, 2.5);
    g.stroke();
  }
  // cross cracks
  for (let k = 0; k < 120; k++) {
    g.strokeStyle = `rgba(70,56,44,${R(0.2, 0.5)})`;
    g.lineWidth = R(1, 2);
    const x = R(0, W), y = R(0, H);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + R(-12, 12), y + R(-3, 3));
    g.stroke();
  }
  // wrap the edges so it tiles
  const img = g.getImageData(0, 0, W, H);
  const out = g.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, j = (y * W + ((x + W / 2) % W)) * 4;
      const t = Math.min(1, Math.abs(x - W / 2) / (W / 2));
      const k = Math.max(0, (t - 0.75) / 0.25);
      for (let ch = 0; ch < 4; ch++) out.data[i + ch] = img.data[i + ch] * (1 - k) + img.data[j + ch] * k;
    }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
/** bamboo culm: green with fine vertical streaks (the nodes are drawn by vertex colour) */
export function culmTex() {
  seed = 13;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e8eedd';
  g.fillRect(0, 0, 64, 256);
  for (let k = 0; k < 40; k++) {
    g.fillStyle = `rgba(${R(120, 200)},${R(150, 220)},${R(90, 160)},0.25)`;
    g.fillRect(R(0, 64), 0, R(1, 3), 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
