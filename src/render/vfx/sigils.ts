// Each house's own circle under its casts (KitFX.sigil, KitAuras zones): drawn once in white on a canvas and tinted.
// 剑客 swords, 枪王 spearheads, 拳师 taiji, 符师 bagua, 琴师 strings and notes, 御兽师 claws, 毒宗 butterfly and drops,
// 弓手 a target, 双刀客 crossed crescents, 气宗 clouds, 机关师 gears; the old seven theirs.
import * as THREE from 'three';

export type SigilStyle =
  | 'bagua' | 'sword' | 'spear' | 'taiji' | 'qin' | 'beast' | 'poison' | 'target' | 'twin' | 'cloud' | 'gear'
  | 'crack' | 'star' | 'lotus' | 'moon' | 'seal' | 'coin' | 'leaf';

const N = 256, R = 122;
type C = CanvasRenderingContext2D;
const ring = (x: C, r: number, w: number) => {
  x.lineWidth = w;
  x.beginPath();
  x.arc(0, 0, r, 0, Math.PI * 2);
  x.stroke();
};
const ticks = (x: C, n: number, r0: number, r1: number, w = 2) => {
  x.lineWidth = w;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    x.beginPath();
    x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    x.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    x.stroke();
  }
};
const around = (x: C, n: number, fn: (k: number) => void, off = 0) => {
  for (let k = 0; k < n; k++) {
    x.save();
    x.rotate((k / n) * Math.PI * 2 + off);
    fn(k);
    x.restore();
  }
};
const glowCore = (x: C, r: number) => {
  const g = x.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.beginPath();
  x.arc(0, 0, r, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#fff';
};
const text = (x: C, s: string, size: number, y = 0) => {
  x.font = `700 ${size}px "Noto Serif SC", serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(s, 0, y);
};

const DRAW: Record<SigilStyle, (x: C) => void> = {
  bagua(x) {
    ring(x, R, 5);
    ring(x, 104, 2.5);
    ticks(x, 48, 104, 110);
    x.lineWidth = 3;
    x.beginPath();
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      x[k ? 'lineTo' : 'moveTo'](Math.cos(a) * 92, Math.sin(a) * 92);
    }
    x.stroke();
    around(x, 8, (k) => {
      for (let b = 0; b < 3; b++) {
        const y = -70 + b * 9;
        if ((k >> b) & 1) {
          x.fillRect(-14, y, 11, 4);
          x.fillRect(3, y, 11, 4);
        } else x.fillRect(-14, y, 28, 4);
      }
    });
    ring(x, 40, 2);
    glowCore(x, 40);
  },
  sword(x) {
    ring(x, R, 3);
    ring(x, 60, 1.5);
    // eight blades pointing out, each a long thin diamond with a guard
    around(x, 8, () => {
      x.beginPath();
      x.moveTo(0, -118);
      x.lineTo(4, -62);
      x.lineTo(0, -54);
      x.lineTo(-4, -62);
      x.closePath();
      x.fill();
      x.fillRect(-9, -54, 18, 3);
      x.fillRect(-1.5, -54, 3, 12);
    });
    around(x, 8, () => x.fillRect(-0.8, -112, 1.6, 40), Math.PI / 8);
    glowCore(x, 30);
  },
  spear(x) {
    ring(x, R, 6);
    ring(x, 96, 2);
    around(x, 4, () => {
      x.beginPath();
      x.moveTo(0, -124);
      x.lineTo(16, -84);
      x.lineTo(0, -92);
      x.lineTo(-16, -84);
      x.closePath();
      x.fill();
      x.fillRect(-2, -92, 4, 46);
      x.beginPath();
      x.arc(0, -78, 7, 0, Math.PI * 2);
      x.fill();
    });
    ticks(x, 24, 96, 106, 3);
    ring(x, 34, 3);
    glowCore(x, 34);
  },
  taiji(x) {
    ring(x, R, 4);
    ring(x, 70, 3);
    // the taiji: half filled, the two small fish eyes
    x.beginPath();
    x.arc(0, 0, 62, -Math.PI / 2, Math.PI / 2);
    x.arc(0, 31, 31, Math.PI / 2, -Math.PI / 2, true);
    x.arc(0, -31, 31, Math.PI / 2, -Math.PI / 2);
    x.fill();
    x.globalCompositeOperation = 'destination-out';
    x.beginPath();
    x.arc(0, -31, 9, 0, Math.PI * 2);
    x.fill();
    x.globalCompositeOperation = 'source-over';
    x.beginPath();
    x.arc(0, 31, 9, 0, Math.PI * 2);
    x.fill();
    around(x, 8, () => {
      x.beginPath();
      x.arc(0, -96, 8, 0, Math.PI * 2);
      x.fill();
    });
  },
  qin(x) {
    // five strings, each a ring that ripples
    for (let s = 0; s < 5; s++) {
      x.lineWidth = s === 0 ? 4 : 1.8;
      x.beginPath();
      const r0 = 122 - s * 18;
      for (let k = 0; k <= 120; k++) {
        const a = (k / 120) * Math.PI * 2, r = r0 + Math.sin(a * (6 + s)) * (s ? 4 : 0);
        x[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      x.stroke();
    }
    // notes drawn by hand: a head, a stem, a flag (eighth notes paired every other)
    around(x, 6, (k) => {
      x.save();
      x.translate(0, -44);
      x.rotate(0.3);
      x.beginPath();
      x.ellipse(-5, 8, 7, 5, -0.4, 0, Math.PI * 2);
      x.fill();
      x.fillRect(1, -16, 2.5, 24);
      if (k % 2) {
        x.beginPath();
        x.ellipse(15, 4, 7, 5, -0.4, 0, Math.PI * 2);
        x.fill();
        x.fillRect(21, -20, 2.5, 24);
        x.fillRect(1, -18, 23, 4);
      } else {
        x.beginPath();
        x.moveTo(3.5, -16);
        x.quadraticCurveTo(14, -8, 10, 2);
        x.lineWidth = 2.5;
        x.stroke();
      }
      x.restore();
    });
    glowCore(x, 26);
  },
  beast(x) {
    ring(x, R, 4);
    // five sets of three claw rakes round the rim
    around(x, 5, () => {
      for (let c = -1; c <= 1; c++) {
        x.lineWidth = 5 - Math.abs(c);
        x.beginPath();
        x.moveTo(c * 12 - 6, -114);
        x.quadraticCurveTo(c * 10, -96, c * 12 + 8, -72);
        x.stroke();
      }
    });
    // a paw in the middle
    x.beginPath();
    x.ellipse(0, 10, 22, 18, 0, 0, Math.PI * 2);
    x.fill();
    for (const [px, py] of [[-24, -16], [-9, -30], [9, -30], [24, -16]]) {
      x.beginPath();
      x.ellipse(px, py, 8, 10, 0, 0, Math.PI * 2);
      x.fill();
    }
  },
  poison(x) {
    // a scalloped rim, falling drops, a butterfly
    x.lineWidth = 3;
    x.beginPath();
    for (let k = 0; k < 16; k++) {
      const a0 = (k / 16) * Math.PI * 2, a1 = ((k + 1) / 16) * Math.PI * 2;
      x.arc(Math.cos((a0 + a1) / 2) * 112, Math.sin((a0 + a1) / 2) * 112, 22, a0 + Math.PI * 0.75, a1 + Math.PI * 0.25 + Math.PI);
    }
    x.stroke();
    around(x, 8, () => {
      x.beginPath();
      x.moveTo(0, -96);
      x.quadraticCurveTo(8, -80, 0, -74);
      x.quadraticCurveTo(-8, -80, 0, -96);
      x.fill();
    });
    for (const s of [-1, 1]) {
      x.beginPath();
      x.ellipse(s * 22, -14, 22, 30, s * 0.5, 0, Math.PI * 2);
      x.fill();
      x.beginPath();
      x.ellipse(s * 16, 22, 14, 18, -s * 0.4, 0, Math.PI * 2);
      x.fill();
    }
    x.globalCompositeOperation = 'destination-out';
    for (const s of [-1, 1]) {
      x.beginPath();
      x.arc(s * 24, -14, 7, 0, Math.PI * 2);
      x.fill();
    }
    x.globalCompositeOperation = 'source-over';
  },
  target(x) {
    ring(x, R, 4);
    ring(x, 84, 3);
    ring(x, 46, 3);
    ring(x, 12, 6);
    x.lineWidth = 2;
    for (const a of [0, Math.PI / 2]) {
      x.save();
      x.rotate(a);
      x.beginPath();
      x.moveTo(-126, 0);
      x.lineTo(-56, 0);
      x.moveTo(56, 0);
      x.lineTo(126, 0);
      x.stroke();
      x.restore();
    }
    around(x, 12, () => {
      x.beginPath();
      x.moveTo(-5, -100);
      x.lineTo(0, -92);
      x.lineTo(5, -100);
      x.stroke();
    }, Math.PI / 12);
  },
  twin(x) {
    ring(x, R, 3);
    // two crescent blades crossing in an X, and a ring of short blades
    x.lineCap = 'round';
    for (const s of [-1, 1]) {
      x.save();
      x.rotate(s * 0.78);
      for (const [w, r] of [[12, 70], [4, 84]] as const) {
        x.lineWidth = w;
        x.beginPath();
        x.arc(0, 40, r, -Math.PI * 0.82, -Math.PI * 0.18);
        x.stroke();
      }
      x.restore();
    }
    around(x, 12, () => {
      x.beginPath();
      x.moveTo(0, -118);
      x.lineTo(5, -104);
      x.lineTo(-5, -104);
      x.closePath();
      x.fill();
    });
    glowCore(x, 28);
  },
  cloud(x) {
    ring(x, R, 2);
    // three arms of a swirl, and curls of cloud along the rim
    for (let k = 0; k < 3; k++) {
      x.lineWidth = 4;
      x.beginPath();
      for (let t = 0; t <= 60; t++) {
        const a = (k / 3) * Math.PI * 2 + t * 0.07, r = 8 + t * 1.6;
        x[t ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      x.stroke();
    }
    around(x, 8, () => {
      x.lineWidth = 3;
      x.beginPath();
      x.arc(0, -108, 10, Math.PI * 0.2, Math.PI * 1.9);
      x.stroke();
      x.beginPath();
      x.arc(14, -110, 7, Math.PI, Math.PI * 2.6);
      x.stroke();
    });
  },
  gear(x) {
    // a toothed wheel, a smaller one inside, spokes
    x.beginPath();
    for (let k = 0; k < 24; k++) {
      const a0 = (k / 24) * Math.PI * 2, a1 = a0 + (Math.PI * 2) / 48;
      x.lineTo(Math.cos(a0) * 124, Math.sin(a0) * 124);
      x.lineTo(Math.cos(a1) * 124, Math.sin(a1) * 124);
      x.lineTo(Math.cos(a1) * 108, Math.sin(a1) * 108);
      x.lineTo(Math.cos(a1 + (Math.PI * 2) / 48) * 108, Math.sin(a1 + (Math.PI * 2) / 48) * 108);
    }
    x.closePath();
    x.lineWidth = 4;
    x.stroke();
    ring(x, 96, 2);
    ticks(x, 6, 30, 96, 6);
    x.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      x.lineTo(Math.cos(a) * 34, Math.sin(a) * 34);
      x.lineTo(Math.cos(a + 0.31) * 24, Math.sin(a + 0.31) * 24);
    }
    x.closePath();
    x.fill();
  },
  crack(x) {
    ring(x, R, 6);
    // jagged cracks running out from a smashed middle
    x.lineWidth = 4;
    for (let k = 0; k < 9; k++) {
      let a = (k / 9) * Math.PI * 2, r = 14;
      x.beginPath();
      x.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      while (r < 118) {
        r += 14 + ((k * 7 + r) % 9);
        a += ((((k * 13 + r) | 0) % 7) - 3) * 0.05;
        x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      x.stroke();
    }
    glowCore(x, 36);
  },
  star(x) {
    ring(x, R, 3);
    // a shuriken: eight points, and small stars thrown round it
    x.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, r = k % 2 ? 26 : 84;
      x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    x.closePath();
    x.lineWidth = 3;
    x.stroke();
    around(x, 8, () => {
      x.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, r = k % 2 ? 3 : 9;
        x.lineTo(Math.cos(a) * r, -106 + Math.sin(a) * r);
      }
      x.fill();
    }, Math.PI / 8);
    glowCore(x, 22);
  },
  lotus(x) {
    ring(x, R, 3);
    // two rows of lotus petals
    for (const [n, r0, len, w] of [[8, 34, 70, 22], [8, 30, 46, 14]] as const)
      around(x, n, () => {
        x.lineWidth = 3;
        x.beginPath();
        x.ellipse(0, -(r0 + len / 2), w, len / 2, 0, 0, Math.PI * 2);
        x.stroke();
      }, n === 8 && len === 46 ? Math.PI / 8 : 0);
    glowCore(x, 30);
  },
  moon(x) {
    // a broken rim and a crescent moon, scattered points
    x.lineWidth = 4;
    for (let k = 0; k < 12; k++) {
      x.beginPath();
      x.arc(0, 0, R, (k / 12) * Math.PI * 2, (k / 12) * Math.PI * 2 + 0.34);
      x.stroke();
    }
    x.beginPath();
    x.arc(0, 0, 70, 0, Math.PI * 2);
    x.fill();
    x.globalCompositeOperation = 'destination-out';
    x.beginPath();
    x.arc(26, -16, 66, 0, Math.PI * 2);
    x.fill();
    x.globalCompositeOperation = 'source-over';
    around(x, 7, () => x.fillRect(-2, -100, 4, 4), 0.3);
  },
  seal(x) {
    ring(x, R, 5);
    ring(x, 112, 1.5);
    x.lineWidth = 6;
    x.strokeRect(-66, -66, 132, 132);
    x.lineWidth = 2;
    x.strokeRect(-56, -56, 112, 112);
    text(x, '敕', 78, 4);
    around(x, 4, () => {
      x.beginPath();
      x.moveTo(0, -112);
      x.lineTo(10, -88);
      x.lineTo(-10, -88);
      x.closePath();
      x.fill();
    }, Math.PI / 4);
  },
  coin(x) {
    ring(x, R, 8);
    ring(x, 104, 2);
    x.lineWidth = 6;
    x.strokeRect(-30, -30, 60, 60);
    around(x, 4, (k) => text(x, '乾坤通宝'[k], 34, -66));
  },
  leaf(x) {
    ring(x, R, 3);
    // a ring of leaves on a winding vine
    x.lineWidth = 2.5;
    x.beginPath();
    for (let k = 0; k <= 160; k++) {
      const a = (k / 160) * Math.PI * 2, r = 96 + Math.sin(a * 8) * 8;
      x[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    x.stroke();
    around(x, 8, () => {
      x.beginPath();
      x.moveTo(0, -60);
      x.quadraticCurveTo(18, -76, 0, -100);
      x.quadraticCurveTo(-18, -76, 0, -60);
      x.fill();
    });
    glowCore(x, 34);
  },
};

const cache = new Map<string, THREE.Texture>();
export function sigilOf(style: SigilStyle = 'bagua') {
  let t = cache.get(style);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d')!;
  x.translate(N / 2, N / 2);
  x.strokeStyle = '#fff';
  x.fillStyle = '#fff';
  (DRAW[style] ?? DRAW.bagua)(x);
  t = new THREE.CanvasTexture(c);
  cache.set(style, t);
  return t;
}
