// The sky over the map through the day and the year: the sun's arc (warm at dawn and dusk), the moon and stars at
// night (the moon full at 中秋), cloud cover that greys the sky, the haze closing in for rain, fog and snow,
// lightning in a storm. It drives the shared season uniforms (ground, grass, leaves, snow lying on roofs) and the
// weather in the air round the camera: rain, snow, spring petals, autumn leaves, summer fireflies.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Sim } from '../game/sim';
import { sunAngles, weatherMix } from '../game/clock';
import { SEASON_U, seasonWeights } from './season';
import { GRASS, SKY } from './Terrain';
import { TQ_DARK } from './characterShading';

const C = (h: string) => new THREE.Color(h);
const FOG = {
  day: C('#c3d3e0'),
  dusk: C('#d9a77e'),
  night: C('#1b2436'),
  rain: C('#8d98a2'),
  storm: C('#5f676f'),
  fog: C('#c8ced3'),
  snow: C('#d3dae2'),
};
const SUN_NOON = C('#fff1d6'), SUN_LOW = C('#ffad66'), MOON = C('#9fb4ff');
const tmp = new THREE.Color(), tmp2 = new THREE.Color();

function starField() {
  const n = 1400;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random(), v = Math.random() * 0.9 + 0.1;
    const th = u * Math.PI * 2, ph = Math.acos(v);
    pos.set([Math.sin(ph) * Math.cos(th) * 3200, Math.cos(ph) * 3200, Math.sin(ph) * Math.sin(th) * 3200], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: '#f4f6ff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = -1;
  return p;
}
function moonDisc() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(64, 64, 20, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,250,232,1)');
  gr.addColorStop(0.45, 'rgba(255,248,225,1)');
  gr.addColorStop(0.5, 'rgba(255,240,210,0.35)');
  gr.addColorStop(1, 'rgba(255,240,210,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  // a few grey seas
  x.fillStyle = 'rgba(190,185,170,0.45)';
  for (const [a, b, r] of [[52, 54, 9], [74, 60, 7], [60, 76, 6]]) {
    x.beginPath();
    x.arc(a, b, r, 0, Math.PI * 2);
    x.fill();
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false }));
  s.scale.setScalar(260);
  s.renderOrder = -1;
  return s;
}

export function Climate({ sim }: { sim: Sim }) {
  const scene = useThree((s) => s.scene);
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const sky = useMemo(() => {
    // the cloud cover: a grey shell inside the sky dome, as thick as the weather is dull
    const cloud = new THREE.Mesh(
      new THREE.SphereGeometry(3000, 24, 12),
      new THREE.MeshBasicMaterial({ color: '#9aa4ad', side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false }),
    );
    cloud.renderOrder = -1;
    return { cloud, stars: starField(), moon: moonDisc() };
  }, []);
  useFrame(() => {
    const c = sim.clock, w = sim.weather;
    const p = sim.player.pos;
    const indoor = sim.indoor >= 0;
    const rain = weatherMix(w, 'rain'), storm = weatherMix(w, 'storm'), fogW = weatherMix(w, 'fog'), snow = weatherMix(w, 'snow'), cloudy = weatherMix(w, 'cloudy');
    const overcast = Math.min(1, cloudy * 0.55 + rain * 0.85 + storm + fogW * 0.7 + snow * 0.8);
    // the sun's (or at night the moon's) place
    const { elev, bearing } = sunAngles(c);
    const up = Math.max(0, elev);
    const dir = new THREE.Vector3(Math.cos(bearing) * Math.cos(up), Math.sin(up), Math.sin(bearing) * Math.cos(up));
    const nightK = 1 - THREE.MathUtils.smoothstep(c.light, 0.02, 0.25);
    const low = 1 - THREE.MathUtils.smoothstep(elev, 0.05, 0.45); // dawn and dusk
    if (SKY.sky) {
      const u = SKY.sky.material.uniforms;
      u.sunPosition.value.set(Math.cos(bearing) * Math.cos(elev), Math.sin(elev), Math.sin(bearing) * Math.cos(elev));
      u.turbidity.value = 6 + overcast * 10;
      u.rayleigh.value = 1.4 - overcast * 0.9 + low * 0.8;
    }
    const flash = w.flash > 0 ? Math.max(0, Math.sin((w.flash / 0.35) * Math.PI * 3)) : 0;
    const L = sun.current;
    if (L) {
      // by night the light is the moon's: from the other side, pale and blue
      const moonDir = new THREE.Vector3(-Math.cos(bearing), 0.75, -Math.sin(bearing)).normalize();
      const d = nightK > 0.5 ? moonDir : dir;
      L.position.set(p[0] + d.x * 80, p[1] + d.y * 80, p[2] + d.z * 80);
      target.position.set(p[0], p[1], p[2]);
      target.updateMatrixWorld();
      tmp.copy(SUN_NOON).lerp(SUN_LOW, low);
      L.color.copy(tmp).lerp(MOON, nightK);
      const day = 2.3 * THREE.MathUtils.smoothstep(c.light, 0, 0.18) * (1 - overcast * 0.72);
      const moon = (c.festival?.name === '中秋' ? 0.55 : 0.38) * (1 - overcast * 0.8);
      L.intensity = (indoor ? Math.max(day, 0.6) : day + moon * nightK) + flash * 3;
    }
    const H = hemi.current;
    if (H) {
      const k = 0.3 + 0.62 * THREE.MathUtils.smoothstep(c.light, 0, 0.3);
      H.intensity = (indoor ? 0.85 : k * (1 - overcast * 0.2)) + flash * 1.5;
      H.color.set('#dfeeff').lerp(tmp2.set('#43557a'), nightK * 0.8);
      H.groundColor.set('#4b5a33').lerp(tmp2.set('#151b14'), nightK * 0.8);
    }
    // the haze: its colour from the hour, closing in with the weather
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      tmp.copy(FOG.day).lerp(FOG.dusk, low * (1 - nightK) * 0.7).lerp(FOG.night, nightK);
      const wsum = rain + storm + fogW + snow;
      if (wsum > 0.01) {
        tmp2.setRGB(0, 0, 0)
          .add(FOG.rain.clone().multiplyScalar(rain))
          .add(FOG.storm.clone().multiplyScalar(storm))
          .add(FOG.fog.clone().multiplyScalar(fogW))
          .add(FOG.snow.clone().multiplyScalar(snow))
          .multiplyScalar(1 / wsum)
          .lerp(FOG.night, nightK * 0.85);
        tmp.lerp(tmp2, Math.min(1, wsum));
      }
      if (flash > 0) tmp.lerp(tmp2.set('#eef2ff'), flash * 0.6);
      fog.color.copy(tmp);
      const near = 240 - rain * 170 - storm * 200 - fogW * 225 - snow * 180 - nightK * 80;
      const far = 1500 - rain * 950 - storm * 1150 - fogW * 1330 - snow * 1050 - nightK * 500;
      fog.near = Math.max(8, near);
      fog.far = Math.max(fog.near + 60, far);
      // inside a room the haze would grey the walls
      if (indoor) {
        fog.near = 400;
        fog.far = 2000;
      }
    }
    // clouds, stars, moon
    const cm = sky.cloud.material as THREE.MeshBasicMaterial;
    cm.opacity = overcast * 0.9;
    cm.color.copy(tmp).lerp(tmp2.set('#9aa4ad'), 0.3);
    sky.cloud.position.set(p[0], 0, p[2]);
    const sm = sky.stars.material as THREE.PointsMaterial;
    sm.opacity = nightK * (1 - overcast) * 0.95;
    sky.stars.position.set(p[0], 0, p[2]);
    const mm = sky.moon.material as THREE.SpriteMaterial;
    mm.opacity = nightK * (1 - overcast * 0.9);
    sky.moon.scale.setScalar(c.festival?.name === '中秋' ? 380 : 250);
    sky.moon.position.set(p[0] - Math.cos(bearing) * 2600, 1500, p[2] - Math.sin(bearing) * 2600);
    // the surfaces: season, snow lying, wet
    seasonWeights(c.season, c.seasonT, SEASON_U.uSeason.value);
    SEASON_U.uSnowCover.value = indoor ? 0 : w.snow;
    SEASON_U.uWet.value = indoor ? 0 : w.wet;
    // rain darkens the blades (the seasons and the snow are in their shader)
    if (GRASS.mat) GRASS.mat.color.setScalar(1 - w.wet * 0.2);
    // characters fade toward the dark at night (lamps and fires still light them)
    TQ_DARK.value = indoor ? 0 : nightK * 0.32;
  });
  return (
    <>
      <primitive object={sky.cloud} />
      <primitive object={sky.stars} />
      <primitive object={sky.moon} />
      <primitive object={target} />
      <hemisphereLight ref={hemi} args={['#dfeeff', '#4b5a33', 0.85]} />
      <directionalLight
        ref={sun}
        target={target}
        intensity={2.2}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-far={200}
        shadow-bias={-0.0005}
      />
      <Precip sim={sim} />
    </>
  );
}

// ---------- what falls and drifts round the camera ----------
const RAIN_N = 2600, SNOW_N = 2400, DRIFT_N = 260, BOX = 34, TOP = 22;
function dotTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
function Precip({ sim }: { sim: Sim }) {
  const cam = useThree((s) => s.camera);
  const st = useMemo(() => {
    const rp = new Float32Array(RAIN_N * 6);
    const rainG = new THREE.BufferGeometry();
    rainG.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    const rain = new THREE.LineSegments(rainG, new THREE.LineBasicMaterial({ color: '#b9c6d2', transparent: true, opacity: 0.55, depthWrite: false }));
    rain.frustumCulled = false;
    const sp = new Float32Array(SNOW_N * 3);
    const snowG = new THREE.BufferGeometry();
    snowG.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const tex = dotTex();
    const snow = new THREE.Points(snowG, new THREE.PointsMaterial({ color: '#ffffff', size: 0.16, map: tex, transparent: true, depthWrite: false, opacity: 0.95 }));
    snow.frustumCulled = false;
    const dp = new Float32Array(DRIFT_N * 3);
    const driftG = new THREE.BufferGeometry();
    driftG.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    const drift = new THREE.Points(driftG, new THREE.PointsMaterial({ color: '#f4a6c0', size: 0.18, map: tex, transparent: true, depthWrite: false }));
    drift.frustumCulled = false;
    // every particle starts somewhere in the box round the camera
    const seed = (a: Float32Array, n: number, stride: number) => {
      for (let i = 0; i < n; i++) {
        a[i * stride] = (Math.random() - 0.5) * BOX * 2;
        a[i * stride + 1] = Math.random() * TOP;
        a[i * stride + 2] = (Math.random() - 0.5) * BOX * 2;
      }
    };
    seed(rp, RAIN_N, 6);
    seed(sp, SNOW_N, 3);
    seed(dp, DRIFT_N, 3);
    const phase = Float32Array.from({ length: Math.max(SNOW_N, DRIFT_N) }, () => Math.random() * 100);
    return { rain, snow, drift, rp, sp, dp, phase, ox: 0, oz: 0 };
  }, []);
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const c = sim.clock, w = sim.weather;
    const indoor = sim.indoor >= 0;
    const rainA = indoor ? 0 : Math.min(1, weatherMix(w, 'rain') * 0.7 + weatherMix(w, 'storm'));
    const snowA = indoor ? 0 : weatherMix(w, 'snow');
    const calm = 1 - Math.min(1, rainA + snowA + weatherMix(w, 'fog'));
    // the season's drift: petals in spring, leaves in autumn, fireflies on a summer night
    const s = SEASON_U.uSeason.value;
    const night = c.night;
    const firefly = !indoor && night && s.y > 0.5 ? calm : 0;
    const petals = !indoor && !night ? s.x * calm : 0;
    const leaves = !indoor && !night ? s.z * calm : 0;
    const driftA = Math.max(firefly, petals, leaves);
    const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
    const wx = Math.cos(w.windA) * w.wind, wz = Math.sin(w.windA) * w.wind;
    // wrap a coordinate back into the box round the camera
    const wrap = (v: number, c0: number) => {
      const d = v - c0;
      return d > BOX ? v - BOX * 2 : d < -BOX ? v + BOX * 2 : v;
    };
    // rain: streaks, slanting with the wind
    st.rain.visible = rainA > 0.02;
    if (st.rain.visible) {
      const n = Math.floor(RAIN_N * rainA);
      const a = st.rp, fall = 24 * dt, len = 0.75;
      for (let i = 0; i < n; i++) {
        const o = i * 6;
        let x = a[o] + wx * 6 * dt, y = a[o + 1] - fall, z = a[o + 2] + wz * 6 * dt;
        if (y < cy - 6) {
          y = cy + TOP * (0.6 + Math.random() * 0.4);
          x = cx + (Math.random() - 0.5) * BOX * 2;
          z = cz + (Math.random() - 0.5) * BOX * 2;
        }
        x = wrap(x, cx);
        z = wrap(z, cz);
        a[o] = x;
        a[o + 1] = y;
        a[o + 2] = z;
        a[o + 3] = x - wx * 0.12;
        a[o + 4] = y + len;
        a[o + 5] = z - wz * 0.12;
      }
      st.rain.geometry.setDrawRange(0, n * 2);
      st.rain.geometry.attributes.position.needsUpdate = true;
      (st.rain.material as THREE.LineBasicMaterial).color.set(night ? '#5d6878' : '#b9c6d2');
    }
    // snow: flakes drifting down, swaying
    st.snow.visible = snowA > 0.02;
    if (st.snow.visible) {
      const n = Math.floor(SNOW_N * snowA);
      const a = st.sp, t = sim.time;
      for (let i = 0; i < n; i++) {
        const o = i * 3, ph = st.phase[i];
        let x = a[o] + (wx * 3 + Math.sin(t * 0.9 + ph) * 0.6) * dt, y = a[o + 1] - (1.3 + (ph % 1) * 0.8) * dt, z = a[o + 2] + (wz * 3 + Math.cos(t * 0.7 + ph) * 0.6) * dt;
        if (y < cy - 6) {
          y = cy + TOP;
          x = cx + (Math.random() - 0.5) * BOX * 2;
          z = cz + (Math.random() - 0.5) * BOX * 2;
        }
        a[o] = wrap(x, cx);
        a[o + 1] = y;
        a[o + 2] = wrap(z, cz);
      }
      st.snow.geometry.setDrawRange(0, n);
      st.snow.geometry.attributes.position.needsUpdate = true;
    }
    // the drift
    st.drift.visible = driftA > 0.05;
    if (st.drift.visible) {
      const m = st.drift.material as THREE.PointsMaterial;
      const ff = firefly > 0.05;
      m.color.set(ff ? '#d9ff7a' : petals > leaves ? '#f6b3c8' : '#d9822b');
      m.size = ff ? 0.12 : 0.2;
      m.blending = ff ? THREE.AdditiveBlending : THREE.NormalBlending;
      m.opacity = ff ? 0.5 + 0.5 * Math.sin(sim.time * 3) : 0.95;
      const n = Math.floor(DRIFT_N * driftA);
      const a = st.dp, t = sim.time;
      for (let i = 0; i < n; i++) {
        const o = i * 3, ph = st.phase[i];
        let x: number, y: number, z: number;
        if (ff) {
          // fireflies wander low over the grass
          x = a[o] + Math.sin(t * 0.7 + ph) * 0.8 * dt;
          y = cy - 3 + 1.2 + Math.sin(t * 0.9 + ph * 2) * 0.8;
          z = a[o + 2] + Math.cos(t * 0.6 + ph) * 0.8 * dt;
        } else {
          x = a[o] + (wx * 2.5 + 0.4 + Math.sin(t * 1.3 + ph) * 0.7) * dt;
          y = a[o + 1] - (0.6 + (ph % 1) * 0.5) * dt;
          z = a[o + 2] + (wz * 2.5 + Math.cos(t * 1.1 + ph) * 0.7) * dt;
          if (y < cy - 4) {
            y = cy + TOP * 0.6;
            x = cx + (Math.random() - 0.5) * BOX * 2;
            z = cz + (Math.random() - 0.5) * BOX * 2;
          }
        }
        a[o] = wrap(x, cx);
        a[o + 1] = y;
        a[o + 2] = wrap(z, cz);
      }
      st.drift.geometry.setDrawRange(0, n);
      st.drift.geometry.attributes.position.needsUpdate = true;
    }
  });
  return (
    <>
      <primitive object={st.rain} />
      <primitive object={st.snow} />
      <primitive object={st.drift} />
    </>
  );
}
