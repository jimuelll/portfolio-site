/*
 * Among the Pillars of Creation, as it might look from in there. Nobody has been, and at this scale the gas would be far
 * too thin to see from inside, so this is a theoretical view: clusters of thin dark spires light-years tall, backlit by the
 * glowing gas behind them, their edges burning and wisps streaming off their tips under the young stars above.
 */

import { FogExp2, Scene, Vector3 } from "three";
import { hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import type { Interior, Spot } from "../inside";
import { VoxelSet } from "../voxels";
import { flows, skyDome, type Flow } from "./kit";
import { stars } from "./moon";

const TAU = Math.PI * 2;
/** The dust is cold and nearly black; all the warmth is in the light catching its edges. */
const INK: Rgb = [12, 13, 26], PLUM: Rgb = [48, 38, 62], AMBER: Rgb = [255, 172, 112], FOAM: Rgb = [176, 246, 230];
/** Toward the hot young stars lighting it all: above and beyond the pillars, so they stand against the light. */
const LIGHT = new Vector3(0.16, 0.6, -0.78).normalize();
const FLOOR = -190;

/** The pillars: where each stands, how wide its cluster of spires is, how tall, and how coarsely it's built, being further off. */
const PILLARS = [
  { x: -125, z: -70, r: 66, top: 250, s: 1 },
  { x: 130, z: -110, r: 58, top: 190, s: 1 },
  { x: -340, z: -340, r: 104, top: 370, s: 1.7 },
  { x: 320, z: -400, r: 88, top: 310, s: 1.7 },
  { x: 10, z: -660, r: 70, top: 230, s: 2.2 },
  { x: -320, z: 150, r: 48, top: 150, s: 1.5 },
];

interface Spire { x: number; z: number; r: number; top: number; seed: number }

/** One pillar is a dozen or so spires of different heights, the tallest near the middle, so its top is all points and gaps. */
function spiresOf(p: (typeof PILLARS)[number], i: number) {
  const list: Spire[] = [];
  for (let k = 0; k < 13; k++) {
    const a = hash(i, k, 531) * TAU, out = hash(i, k, 532) ** 0.7 * p.r * 0.78;
    const tall = 1 - (out / p.r) * 0.62 - hash(i, k, 533) * 0.2;
    list.push({ x: p.x + Math.cos(a) * out, z: p.z + Math.sin(a) * out, r: p.r * (0.16 + hash(i, k, 534) * 0.22), top: FLOOR + (p.top - FLOOR) * tall, seed: i * 20 + k });
  }
  return list;
}

/** Where a spire's centre has wandered to by height y: it kinks as it climbs, and leans into the light near the top. */
function spineAt(sp: Spire, y: number) {
  const t = (y - FLOOR) / (sp.top - FLOOR);
  const lean = t * t * 26;
  return {
    x: sp.x + (noise(y * 0.014, sp.seed, 535) - 0.5) * 42 + LIGHT.x * lean,
    z: sp.z + (noise(y * 0.014, sp.seed + 40, 536) - 0.5) * 42 + LIGHT.z * lean,
  };
}

function spires(coarse: boolean, tips: Vector3[]) {
  const set = new VoxelSet();
  const base = coarse ? 6 : 4.2;
  PILLARS.forEach((p, i) => {
    const s = base * p.s;
    for (const sp of spiresOf(p, i)) {
      for (let y = FLOOR; y < sp.top; y += s * 1.5) {
        const t = (y - FLOOR) / (sp.top - FLOOR);
        // Narrowing all the way up, to a point.
        const R = sp.r * (1 - t) ** 0.62 + 0.6;
        const at = spineAt(sp, y);
        const n = Math.max(4, Math.ceil((TAU * R) / s));
        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU;
          const cx = Math.cos(a), cz = Math.sin(a);
          const crag = noise(cx * 2.4 + sp.seed, cz * 2.4 + y * 0.03, 537);
          // Torn away here and there, so the sky shows through near the top.
          if (t > 0.55 && noise(a * 2.2 + sp.seed, y * 0.05, 538) > 1.02 - t * 0.5) continue;
          const rr = R * (0.62 + crag * 0.8);
          const facing = cx * LIGHT.x + cz * LIGHT.z;
          const streak = noise(a * 3 + sp.seed, y * 0.012, 539);
          // The edge against the light burns; higher up, where it's boiling away, it burns brighter and paler.
          const rim = smoothstep(0.3, 0.86, facing + (crag - 0.5) * 0.5) * (0.22 + smoothstep(0.2, 1, t) * 0.78);
          const col = mix(mix(INK, PLUM, streak * streak), mix(AMBER, FOAM, smoothstep(0.55, 1, t)), rim);
          set.box(at.x + cx * rr, y, at.z + cz * rr, s, s * 2.1, s, col);
        }
      }
      const top = spineAt(sp, sp.top);
      tips.push(new Vector3(top.x, sp.top, top.z));
    }
  });
  return set.mesh("glow");
}

export function insidePillars(coarse: boolean): Interior {
  const scene = new Scene();
  scene.fog = new FogExp2(0x0e2c32, 0.0007);
  scene.add(skyDome([5, 14, 24], [10, 38, 46], [22, 52, 54], LIGHT, [104, 92, 84], 5));
  const tips: Vector3[] = [];
  scene.add(spires(coarse, tips));

  const sky = stars(coarse ? 900 : 1800);
  scene.add(sky.mesh);

  const r = (i: number, seed: number) => hash(i, seed, 540);
  const gas: Flow[] = [];
  // The glowing cloud behind it all, in big soft banks, which is what the spires stand against.
  for (let i = 0; i < (coarse ? 260 : 520); i++) {
    const warm = noise(r(i, 1) * 5, r(i, 2) * 5, 541) > 0.5;
    gas.push({
      start: [(r(i, 3) - 0.5) * 1400, FLOOR + r(i, 4) * 640, -560 - r(i, 5) * 300],
      drift: [(r(i, 6) - 0.5) * 30, 8 + r(i, 7) * 14, 0],
      size: 60 + r(i, 8) * 110, colour: warm ? [244, 190, 120] : [86, 214, 196], alpha: 0.005 + r(i, 9) * 0.009, rate: 0.006, phase: r(i, 10), wobble: 6,
    });
  }
  // Thin haze hanging between the pillars.
  for (let i = 0; i < (coarse ? 200 : 420); i++) {
    gas.push({
      start: [(r(i, 11) - 0.5) * 800, FLOOR + r(i, 12) * 460, 160 - r(i, 13) * 620],
      drift: [(r(i, 14) - 0.5) * 30, 10 + r(i, 15) * 20, (r(i, 16) - 0.5) * 30],
      size: 16 + r(i, 17) * 30, colour: [96, 210, 196], alpha: 0.006 + r(i, 18) * 0.01, rate: 0.012, phase: r(i, 19), wobble: 6,
    });
  }
  // Wisps pulled off every tip, streaming up toward the light.
  const each = coarse ? 7 : 14;
  tips.forEach((tip, t) => {
    for (let k = 0; k < each; k++) {
      const n = t * 31 + k;
      gas.push({
        start: [tip.x + (r(n, 20) - 0.5) * 12, tip.y - r(n, 21) * 34, tip.z + (r(n, 22) - 0.5) * 12],
        drift: [LIGHT.x * 70 + (r(n, 23) - 0.5) * 22, LIGHT.y * 70, LIGHT.z * 70 + (r(n, 24) - 0.5) * 22],
        size: 1.6 + r(n, 25) * 3.4, colour: mix(AMBER, FOAM, r(n, 26)), alpha: 0.55 + r(n, 27) * 0.45, fade: 1, rate: 0.05 + r(n, 28) * 0.05, phase: r(n, 29), wobble: 3,
      });
    }
  });
  // The hot young stars doing all this.
  for (let i = 0; i < 7; i++) {
    const spread = new Vector3(LIGHT.x + (r(i, 30) - 0.5) * 0.5, LIGHT.y + (r(i, 31) - 0.5) * 0.3, LIGHT.z + (r(i, 32) - 0.5) * 0.3).normalize().multiplyScalar(830);
    gas.push({ start: [spread.x, spread.y, spread.z], drift: [0, 0, 0], size: 12 + r(i, 33) * 14, colour: [236, 244, 255], alpha: 1.8, rate: 0, phase: 0.2, twinkle: 0.4 });
  }
  // Newborn stars, shining out of the dust just below some of the tips.
  const eggs: Vector3[] = [];
  for (let i = 0; i < tips.length; i += 4) {
    const egg = tips[i].clone().add(new Vector3(r(i, 34) * 6 - 3, -16 - r(i, 35) * 26, r(i, 36) * 6 - 3));
    eggs.push(egg);
    gas.push({ start: [egg.x, egg.y, egg.z], drift: [0, 0, 0], size: 7, colour: [255, 226, 170], alpha: 2, rate: 0, phase: 0.2, twinkle: 1 });
    gas.push({ start: [egg.x, egg.y, egg.z], drift: [0, 0, 0], size: 22, colour: [255, 150, 96], alpha: 0.22, rate: 0, phase: 0.2, twinkle: 0.5 });
  }
  const moving = flows(gas);
  scene.add(moving.mesh);

  // The tips stand in order, thirteen to a pillar, with the tallest not necessarily first.
  const tallest = (i: number) => tips.slice(i * 13, i * 13 + 13).reduce((a, b) => (b.y > a.y ? b : a));
  const spots: Spot[] = [
    { name: "a newborn star", fact: "an \"EGG\": dust shielding a star as it forms", at: eggs[0] },
    { name: "the tallest pillar", fact: "gas and dust about four light-years high", at: tallest(2) },
    { name: "a spire's tip", fact: "the stars' light is boiling this away, slowly", at: tallest(1) },
    { name: "the young stars", fact: "hot enough to carve all of this into shape", at: LIGHT.clone().multiplyScalar(780) },
  ];

  return {
    scene,
    fov: 66,
    lens: { center: 0.5, band: 0.95, blur: 1 },
    cell: 0.72,
    spots,
    // Low down the wide gap between the two near pillars and back, looking up at them.
    path(t, eye, ahead) {
      const along = Math.sin(t * 0.021);
      eye.set(Math.sin(t * 0.033) * 24, -90 + Math.sin(t * 0.026) * 40, 120 - (along * 0.5 + 0.5) * 260);
      ahead.set(eye.x + Math.sin(t * 0.017) * 70, eye.y + 62 + Math.sin(t * 0.03) * 16, eye.z - 150);
    },
    update(t) {
      moving.tick(t);
      sky.tick(t);
    },
    thin() {
      // Everything here is one draw of points and one of cubes that never move: there's nothing worth thinning out mid-flight.
    },
  };
}
