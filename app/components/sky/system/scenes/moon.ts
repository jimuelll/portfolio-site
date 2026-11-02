/*
 * The Moon: Tranquility Base, from low on the ground, with most of the view given to the sky. A great comet hangs over
 * the lunar module, its two tails streaming away from the sun, while meteors cross behind it and Earth turns with its
 * clouds. There's no air, so the shadows are hard and black, and the only things moving down here are the astronaut, who
 * will stop and wave if you tap them, and the dust they kick up.
 */

import { AdditiveBlending, AmbientLight, type InstancedMesh, Mesh, type MeshBasicMaterial, Scene, ShaderMaterial, SphereGeometry, Group, Vector3 } from "three";
import { hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import { Motes, VoxelSet } from "../voxels";
import { paintEarth } from "../orrery";
import { flows, sloped, sunlight, type Flow, type Place } from "./kit";

const DUST: Rgb = [196, 190, 182], DUST_DARK: Rgb = [112, 110, 112], PRINT: Rgb = [46, 46, 50];
const FOIL: Rgb = [244, 186, 62], FOIL_DEEP: Rgb = [186, 118, 36], FOIL_DARK: Rgb = [92, 58, 28];
const SILVER: Rgb = [214, 218, 224], SHADE: Rgb = [84, 86, 96], GLASS: Rgb = [20, 24, 40], SUIT: Rgb = [202, 202, 196];
const SUN = new Vector3(-240, 74, 84);

const CRATERS: number[][] = [
  [-44, 22, 15], [46, 26, 11], [-24, -30, 17], [54, -18, 14], [-66, -14, 12], [30, 8, 4], [-34, 6, 5], [76, 16, 9], [24, -46, 11], [-78, 26, 9],
];
for (let i = 0; i < 70; i++) CRATERS.push([(hash(i, 1, 70) - 0.5) * 190, 44 - hash(i, 2, 70) * 150, 0.8 + hash(i, 3, 70) ** 2.2 * 5]);

/** The craters filed by area, so a point on the ground only ever looks at the few that can reach it. */
const AREA = 16;
const areaKey = (ix: number, iz: number) => (ix + 2048) * 4096 + iz + 2048;
const AREAS = new Map<number, number[][]>();
for (const crater of CRATERS) {
  const [cx, cz, r] = crater, reach = r * 1.5;
  for (let ix = Math.floor((cx - reach) / AREA); ix <= Math.floor((cx + reach) / AREA); ix++) {
    for (let iz = Math.floor((cz - reach) / AREA); iz <= Math.floor((cz + reach) / AREA); iz++) {
      const key = areaKey(ix, iz);
      const list = AREAS.get(key);
      if (list) list.push(crater);
      else AREAS.set(key, [crater]);
    }
  }
}

/** The ground: gentle rolls, bowls with raised rims, small stones, and the world curving away toward the horizon. */
function height(x: number, z: number) {
  let h = 3 + noise(x * 0.04, z * 0.04, 71) * 3 + noise(x * 0.17, z * 0.17, 72) * 0.7 + noise(x * 0.7, z * 0.7, 73) * 0.16;
  const near = AREAS.get(areaKey(Math.floor(x / AREA), Math.floor(z / AREA)));
  if (near) for (const [cx, cz, r] of near) {
    const d = Math.hypot(x - cx, z - cz) / r;
    if (d < 1) h -= (1 - d * d) * r * 0.32;
    else if (d < 1.5) h += (1 - (d - 1) / 0.5) ** 2 * r * 0.1;
  }
  return h - smoothstep(-60, -300, z) * 34 - x * x * 0.00011;
}

/** The line of bootprints, from the near ground to the foot of the ladder. */
const walk = (z: number) => Math.sin(z * 0.08) * 5 * smoothstep(2, 34, z) + 1.5;

function dustColour(x: number, z: number): Rgb {
  // Pale rays thrown out by old impacts, darker soil between, and every grain a little its own.
  const ray = noise(Math.atan2(z + 30, x + 24) * 7, 3, 74) * smoothstep(90, 16, Math.hypot(x + 24, z + 30));
  const base = mix(mix(DUST, DUST_DARK, noise(x * 0.09 + 4, z * 0.09, 75)), [224, 220, 212], ray * 0.55);
  const row = Math.round(z / 2.6);
  const side = row % 2 ? -0.8 : 0.8;
  if (z > 7 && z < 44 && Math.abs(x - walk(row * 2.6) - side) < 0.42 && Math.abs(z - row * 2.6) < 0.7) return mix(PRINT, base, Math.abs(Math.round(z * 4) % 2) * 0.32);
  return mix(base, [62, 62, 66], hash(Math.round(x * 3), Math.round(z * 3), 76) ** 5 * 0.8);
}

function ground(v: VoxelSet, coarse: boolean) {
  const fine = coarse ? 0.72 : 0.46, mid = coarse ? 1.5 : 1.15, far = 4;
  for (let x = -58; x < 58; x += fine) {
    for (let z = -32; z < 40; z += fine) {
      const h = height(x, z);
      v.column(x, z, h, h - 5, fine, sloped(dustColour(x, z), height, x, z, 0.2), 0.08);
    }
  }
  for (let x = -170; x < 170; x += mid) {
    for (let z = -110; z < 66; z += mid) {
      if (Math.abs(x) < 58 && z > -32 && z < 40) continue;
      const h = height(x, z);
      v.column(x, z, h, h - 8, mid, sloped(dustColour(x, z), height, x, z, 0.2), 0.08);
    }
  }
  for (let x = -520; x < 520; x += far) {
    for (let z = -390; z < -110; z += far) {
      const h = height(x, z);
      v.column(x, z, h, h - 14, far, sloped(mix(DUST, DUST_DARK, noise(x * 0.03, z * 0.03, 77)), height, x, z, 0.1), 0.06);
    }
  }
}

function debris(v: VoxelSet, coarse: boolean) {
  for (let i = 0; i < (coarse ? 1400 : 4200); i++) {
    const x = (hash(i, 1, 78) - 0.5) * 130, z = 40 - hash(i, 2, 78) * 74;
    if (Math.hypot(x, z) < 12) continue;
    const s = 0.1 + hash(i, 3, 78) ** 3 * 0.42;
    v.box(x, height(x, z) + s / 2, z, s * (0.7 + hash(i, 4, 78)), s, s, mix([146, 142, 138], [62, 60, 62], hash(i, 5, 78)));
  }
  // Boulders thrown clear of the craters, lit on one side.
  for (let i = 0; i < 26; i++) {
    const x = (hash(i, 1, 79) - 0.5) * 118, z = 30 - hash(i, 2, 79) * 60;
    if (Math.hypot(x, z) < 19 || Math.abs(x - walk(z)) < 5) continue;
    const r = 0.7 + hash(i, 3, 79) ** 2 * 2.4, s = 0.26, R = Math.ceil(r / s), base = height(x, z) - r * 0.25;
    for (let a = -R; a <= R; a++) {
      for (let b = 0; b <= R; b++) {
        for (let c = -R; c <= R; c++) {
          const d = Math.hypot(a, b * 1.25, c) * s;
          if (d > r * (0.8 + noise(a * 0.5 + x, c * 0.5 + b, 80) * 0.42) || d < r - s * 2.6) continue;
          v.add(x + a * s, base + b * s, z + c * s, mix([164, 160, 154], [78, 76, 80], noise(a * 0.4 + x, b * 0.5 + c * 0.4, 81)), s, 0.14);
        }
      }
    }
  }
}

/** Crinkled foil: gold with deep creases, each scrap catching the sun its own way. */
const crinkled = (x: number, y: number, z: number): Rgb => {
  const crease = noise(x * 1.9 + z * 1.3, y * 2.3, 82), glint = hash(Math.round(x * 3), Math.round(y * 3 + z * 3), 83);
  return glint > 0.93 ? [255, 234, 160] : crease > 0.66 ? FOIL_DARK : crease > 0.42 ? FOIL_DEEP : FOIL;
};
const quilted = (x: number, y: number, z: number): Rgb => {
  const seam = (Math.round(x * 2.4) + Math.round(y * 2.4) * 3 + Math.round(z * 2.4)) % 7 === 0;
  return seam ? SHADE : mix(SILVER, [168, 172, 184], noise(x * 0.8 + z * 0.8, y * 0.9, 84) * 0.8);
};

/** The lunar module: a gold foil descent stage on splayed legs, and the faceted silver cabin on top. */
function lander(v: VoxelSet) {
  const g = height(0, 0) + 0.2, base = g + 5.2, s = 0.34;
  // An octagon of foil, with the engine bell under it.
  for (let x = -7; x <= 7; x += s) {
    for (let z = -7; z <= 7; z += s) {
      if (Math.abs(x) + Math.abs(z) > 10.6) continue;
      const rim = Math.abs(x) > 6.6 || Math.abs(z) > 6.6 || Math.abs(x) + Math.abs(z) > 10.1;
      for (let y = 0; y < 4.6; y += s) if (rim || y === 0 || y + s >= 4.6) v.add(x, base + y, z, crinkled(x, y, z), s, 0.1);
    }
  }
  v.fill(-1.7, base - 2, -1.7, 1.7, base, 1.7, [34, 34, 40], 0.34, 0.1);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    // Each leg: a main strut, two braces, and a round pad resting on the dust.
    for (let k = 0; k <= 22; k++) {
      const f = k / 22;
      const px = dx * (4.6 + f * 5.6), py = base + 1.2 - f * (base + 1.2 - g - 0.3), pz = dz * (4.6 + f * 5.6);
      v.box(px, py, pz, 0.36, 0.42, 0.36, k % 5 ? FOIL_DEEP : SILVER);
      v.box(px - dx * f * 2.2, base - 0.1 - f * 2.6, pz, 0.14, 0.14, 0.14, SILVER);
      v.box(px, base - 0.1 - f * 2.6, pz - dz * f * 2.2, 0.14, 0.14, 0.14, SILVER);
    }
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (a * a + b * b < 11) v.box(dx * 10.3 + a * 0.32, g + 0.24, dz * 10.3 + b * 0.32, 0.32, 0.2, 0.32, mix(FOIL, SILVER, hash(a, b, 85) * 0.7));
  }
  // The ladder down the front leg, and the porch.
  v.fill(-1.5, base + 4.4, 6.9, 1.5, base + 4.8, 8.3, SILVER, 0.22, 0.05);
  for (let k = 0; k < 8; k++) {
    const f = k / 7;
    v.box(0, base + 4.1 - f * 5, 7.4 + f * 2.5, 1.5, 0.12, 0.12, SILVER);
    for (const side of [-0.8, 0.8]) v.box(side, base + 4.1 - f * 5, 7.4 + f * 2.5, 0.14, 0.6, 0.14, SHADE);
  }
  // The cabin: an irregular silver shape with a black plate on one side.
  const cabin = base + 4.8;
  v.fill(-5.2, cabin, -4.4, 5.2, cabin + 6.4, 3.6, quilted, 0.3, 0.05);
  v.fill(-3.6, cabin + 0.4, 3.6, 3.6, cabin + 5.4, 5, quilted, 0.3, 0.05);
  v.fill(-5.8, cabin + 0.4, -3, -5.1, cabin + 5.2, 2.6, [46, 46, 54], 0.3, 0.1);
  v.fill(5.1, cabin + 0.4, -3, 5.8, cabin + 5.2, 2.6, [64, 64, 72], 0.3, 0.1);
  v.fill(-3.4, cabin + 6.4, -3.2, 3.4, cabin + 7.4, 2.4, quilted, 0.3, 0.05);
  v.fill(-1.6, cabin + 7.4, -1.6, 1.6, cabin + 8, 1.6, FOIL_DEEP, 0.26, 0.1);
  // Two angled windows over the hatch, the hatch itself, thruster clusters.
  for (const side of [-1, 1]) {
    for (let a = 0; a < 7; a++) for (let b = 0; b <= a; b++) v.box(side * (1.2 + b * 0.28), cabin + 3.1 + (7 - a) * 0.28, 5.05, 0.28, 0.28, 0.2, GLASS);
    for (const z of [-3.4, 2.6]) {
      v.box(side * 6.2, cabin + 5.4, z, 0.9, 0.9, 0.9, SHADE);
      v.box(side * 6.9, cabin + 5.4, z, 0.5, 0.36, 0.36, [34, 34, 40]);
      v.box(side * 6.2, cabin + 6.1, z, 0.36, 0.5, 0.36, [34, 34, 40]);
    }
  }
  v.fill(-1.2, cabin + 0.6, 5, 1.2, cabin + 2.8, 5.2, SHADE, 0.2, 0.1);
  // The big dish on its boom, and the thin aerials.
  v.fill(5.4, cabin + 6.4, 0.6, 5.7, cabin + 9.4, 0.9, SILVER, 0.24, 0.05);
  for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) if (a * a + b * b < 37) v.box(5.5 + a * 0.26, cabin + 9.5 + (a * a + b * b) * 0.016, 0.8 + b * 0.26, 0.26, 0.12, 0.26, mix([240, 242, 246], [196, 198, 208], hash(a, b, 86)));
  v.box(-3.4, cabin + 9.6, 0, 0.1, 4.4, 0.1, SILVER);
  v.box(-1.2, cabin + 9, -2.2, 0.08, 3, 0.08, SILVER);
}

function flag(v: VoxelSet, x: number, z: number) {
  const g = height(x, z);
  v.fill(x - 0.12, g, z - 0.12, x + 0.12, g + 11, z + 0.12, [226, 228, 232], 0.24, 0.02);
  v.fill(x, g + 10.7, z - 0.07, x + 6.2, g + 10.9, z + 0.07, [226, 228, 232], 0.2, 0.02);
  const s = 0.22;
  for (let i = 0; i < 28; i++) {
    for (let j = 0; j < 18; j++) {
      const stripe = Math.floor((j / 18) * 13);
      const canton = i < 12 && j >= 8;
      const star = canton && (i + j) % 3 === 0 && i % 2 === 0;
      const c: Rgb = canton ? (star ? [244, 244, 252] : [40, 56, 136]) : stripe % 2 ? [244, 240, 234] : [216, 44, 46];
      v.box(x + 0.2 + i * s, g + 6.6 + j * s, z + Math.sin(i * 0.42) * 0.16, s, s, 0.16, c);
    }
  }
}

/** What they left behind: the laser reflector, the seismometer, and the TV camera on its tripod. */
function experiments(v: VoxelSet) {
  const rx = -29, rz = 12, rg = height(rx, rz);
  for (const [a, b] of [[-2, -1.4], [2, -1.4], [-2, 1.4], [2, 1.4]]) v.box(rx + a, rg + 0.5, rz + b, 0.14, 1, 0.14, SILVER);
  for (let a = 0; a < 18; a++) {
    for (let b = 0; b < 12; b++) {
      v.box(rx - 2.3 + a * 0.27, rg + 1.2 + b * 0.16, rz + 1.1 - b * 0.16, 0.25, 0.1, 0.22, (a + b) % 2 ? [186, 196, 214] : [116, 128, 160]);
    }
  }
  const sx = -21, sz = 20, sg = height(sx, sz);
  v.fill(sx - 1.1, sg, sz - 1.1, sx + 1.1, sg + 1.5, sz + 1.1, crinkled, 0.2, 0.08);
  for (const side of [-1, 1]) for (let a = 0; a < 13; a++) for (let b = 0; b < 5; b++) v.box(sx + side * (1.4 + a * 0.22), sg + 1.15, sz - 0.5 + b * 0.22, 0.2, 0.06, 0.2, (a + b) % 2 ? [36, 48, 90] : [24, 32, 66]);
  v.fill(sx - 0.34, sg + 1.5, sz - 0.34, sx + 0.34, sg + 3, sz + 0.34, SILVER, 0.2, 0.04);
  const cx = 28, cz = 24, cg = height(cx, cz);
  for (const [a, b] of [[-0.9, -0.5], [0.9, -0.5], [0, 1]]) for (let k = 0; k < 9; k++) v.box(cx + (a * (8 - k)) / 8, cg + k * 0.3, cz + (b * (8 - k)) / 8, 0.08, 0.3, 0.08, SILVER);
  v.fill(cx - 0.4, cg + 2.7, cz - 0.6, cx + 0.4, cg + 3.3, cz + 0.6, [52, 52, 60], 0.15, 0.05);
}

export function astronaut() {
  const body = new Group();
  const set = new VoxelSet();
  const gold: Rgb = [246, 190, 76], grey: Rgb = [188, 190, 196], blue: Rgb = [80, 112, 196], red: Rgb = [210, 56, 50];
  set.fill(-0.68, 1.15, -0.42, 0.68, 2.6, 0.42, (_x, y) => (y < 1.5 ? grey : SUIT), 0.14, 0.06);
  set.fill(-0.62, 1.3, -1.02, 0.62, 2.85, -0.42, (_x, y) => (y > 2.45 ? [150, 152, 158] : [222, 224, 226]), 0.14, 0.06);
  for (const side of [-1, 1]) {
    set.fill(side * 0.4 - 0.25, 0.32, -0.3, side * 0.4 + 0.25, 1.2, 0.3, SUIT, 0.14, 0.05);
    set.fill(side * 0.4 - 0.29, 0, -0.34, side * 0.4 + 0.29, 0.32, 0.46, [64, 64, 72], 0.14, 0.05);
    set.box(side * 0.4, 0.75, 0.32, 0.5, 0.08, 0.04, grey);
  }
  set.box(-0.34, 2.15, 0.45, 0.42, 0.26, 0.08, blue);
  set.box(0.34, 2.2, 0.45, 0.34, 0.14, 0.08, red);
  set.fill(-0.6, 2.6, -0.5, 0.6, 3.66, 0.56, SUIT, 0.12, 0.04);
  set.fill(-0.44, 2.82, 0.5, 0.44, 3.46, 0.62, gold, 0.1, 0.1);
  set.box(-0.16, 3.32, 0.64, 0.2, 0.08, 0.02, [255, 244, 200]);
  set.fill(-1.02, 1.55, -0.26, -0.68, 2.55, 0.26, SUIT, 0.12, 0.05);
  body.add(set.mesh("lit"));
  const armSet = new VoxelSet();
  armSet.fill(-0.17, 0, -0.24, 0.17, 1.15, 0.24, SUIT, 0.12, 0.05);
  armSet.fill(-0.2, 1.15, -0.26, 0.2, 1.45, 0.26, [226, 226, 216], 0.12, 0.05);
  const arm = armSet.mesh("lit");
  arm.position.set(0.86, 2.5, 0);
  arm.rotation.z = Math.PI - 0.2;
  body.add(arm);
  return { body, arm };
}

/** The sky behind everything: thousands of stars, with the Milky Way a thicker band across it. */
export function stars(n: number) {
  const list: Flow[] = [];
  for (let i = 0; i < n; i++) {
    const inBand = i % 3 === 0;
    const a = (hash(i, 1, 87) - 0.5) * 2.9;
    const elevation = inBand ? 0.2 + (a + 1.45) * 0.34 + (hash(i, 6, 87) - 0.5) * 0.2 : hash(i, 2, 87) ** 0.8 * 1.15 - 0.02;
    const c = Math.cos(elevation), bright = hash(i, 3, 87) ** 3;
    const tint: Rgb = hash(i, 4, 87) > 0.86 ? [255, 214, 170] : hash(i, 4, 87) < 0.2 ? [176, 204, 255] : [232, 234, 244];
    list.push({
      start: [Math.sin(a) * c * 900 + 20, Math.sin(elevation) * 900, -Math.cos(a) * c * 900],
      drift: [0, 0, 0], size: 2 + bright * 5, colour: tint, alpha: 0.28 + bright * 0.72, rate: 0, phase: 0.2, twinkle: hash(i, 5, 87) * 2,
    });
  }
  return flows(list);
}

/** The comet: a small bright point in soft haze, a narrow blue tail of gas, a broad curving gold one of dust, and meteors. */
function comet(coarse: boolean) {
  const head = new Vector3(-48, 112, -300);
  // Away from the sun, which is low on the left.
  const along = new Vector3(0.95, 0.31, -0.06).normalize();
  const across = new Vector3(-0.31, 0.95, 0).normalize();
  const list: Flow[] = [];
  const scale = coarse ? 0.55 : 1;
  const r = (i: number, s: number) => hash(i, s, 88);
  const gas = 2400 * scale, grit = 2600 * scale;
  for (let i = 0; i < gas; i++) {
    const reach = 300 + r(i, 1) * 180, width = (r(i, 2) - 0.5) * 20, deep = (r(i, 3) - 0.5) * 8;
    list.push({
      start: [head.x + (r(i, 4) - 0.5) * 2.5, head.y + (r(i, 5) - 0.5) * 2.5, head.z],
      drift: [along.x * reach + across.x * width, along.y * reach + across.y * width, along.z * reach + deep],
      size: 1.4 + r(i, 6) * 1.7, colour: mix([120, 180, 255], [206, 236, 255], r(i, 7)), alpha: 0.85, fade: 1,
      rate: 0.022 + r(i, 8) * 0.03, phase: r(i, 9), wobble: 1.8,
    });
  }
  for (let i = 0; i < grit; i++) {
    // A soft veil rather than grains: wide faint puffs that overlap, gathered toward the middle and fanning out with
    // distance, bending back along the comet's path the way a dust tail does.
    const reach = 40 + r(i, 11) ** 0.8 * 390;
    const side = (r(i, 12) + r(i, 19) - 1) * (10 + reach * 0.3);
    list.push({
      start: [head.x + (r(i, 13) - 0.5) * 3, head.y + (r(i, 14) - 0.5) * 3, head.z],
      drift: [along.x * reach + across.x * side, along.y * reach + across.y * side, along.z * reach],
      curve: [across.x * -reach * 0.3, across.y * -reach * 0.3, 0],
      size: 4 + r(i, 15) * 8, colour: mix([255, 206, 136], [255, 238, 208], r(i, 16)), alpha: 0.085, fade: 1.1,
      rate: 0.012 + r(i, 17) * 0.016, phase: r(i, 18), wobble: 2,
    });
  }
  // The coma: no edge anywhere, only haze thinning with distance from a tiny bright point, drawn out toward the tail,
  // and faintly green as real ones often are.
  const haze = 1100 * scale;
  for (let i = 0; i < haze; i++) {
    const out = r(i, 21) ** 2.1, angle = r(i, 22) * Math.PI * 2;
    const reach = 3 + out * 24;
    const back = Math.max(0, Math.cos(angle)) * out * 22;
    const x = Math.cos(angle) * reach + along.x * back, y = Math.sin(angle) * reach * 0.82 + along.y * back;
    list.push({
      start: [head.x + x, head.y + y, head.z + 1], drift: [0, 0, 0], size: 1 + r(i, 23) * 1.5,
      colour: mix([250, 252, 244], [150, 226, 206], Math.min(1, out * 1.5)), alpha: 0.44 * (1 - out) ** 2.2, rate: 0, phase: 0, twinkle: 0.2,
    });
  }
  for (let i = 0; i < 9; i++) list.push({ start: [head.x, head.y, head.z + 1.5], drift: [0, 0, 0], size: 4 + i * 2.2, colour: [226, 244, 232], alpha: 0.075, rate: 0, phase: 0 });
  list.push({ start: [head.x, head.y, head.z + 2], drift: [0, 0, 0], size: 2.6, colour: [255, 255, 250], alpha: 1.1, rate: 0, phase: 0 });
  // Meteors, each a head and a burning trail, far apart in time. They're apart from the comet, which drifts.
  const streaks: Flow[] = [];
  const showers: [number, number, number, number, number, number, number][] = [
    [-260, 240, 120, 70, 11, 0, 0.16], [40, 300, 200, 90, 17, 0.4, 0.12], [-380, 170, -120, 90, 23, 0.72, 0.14], [260, 230, -160, 120, 29, 0.2, 0.1],
  ];
  showers.forEach(([x, y, dx, dy, period, offset, window], m) => {
    for (let j = 0; j < 46; j++) {
      streaks.push({
        start: [x, y, -320], drift: [dx * 2, -dy * 2, 0], size: 3.4 * (1 - j / 52), colour: mix([255, 250, 236], [255, 138, 62], j / 46), alpha: 1.2 * (1 - j / 46) ** 1.3, fade: 0.5,
        rate: 1 / period, phase: offset + m * 0.003 - j * 0.0011, window,
      });
    }
  });
  return { body: flows(list), streaks: flows(streaks), along };
}

/** Earth: real coastlines, a separate layer of clouds drifting over them, night on one side, and a thin blue edge. */
function earth(coarse: boolean) {
  const group = new Group();
  const sunward = new Vector3(-0.42, 0.24, 0.87).normalize();
  const voxel = coarse ? 1.5 : 1.1, R = 26;
  const surface = new VoxelSet(), cover = new VoxelSet();
  surface.ball(0, 0, 0, R / voxel, voxel, paintEarth, 0.04);
  const count = coarse ? 1100 : 2500;
  for (let i = 0; i < count; i++) {
    const u = hash(i, 1, 89) * 2 - 1, a = hash(i, 2, 89) * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const nx = Math.cos(a) * s, nz = Math.sin(a) * s;
    if (noise(nx * 3.1 + 9, u * 4.2 + nz * 2.6, 90) < 0.5) continue;
    cover.box(nx * (R + 0.9), u * (R + 0.9), nz * (R + 0.9), voxel * 1.15, 0.5, voxel * 1.15, [246, 248, 252]);
  }
  const shade = (mesh: InstancedMesh) => {
    (mesh.material as MeshBasicMaterial).fog = false;
    (mesh.material as MeshBasicMaterial).onBeforeCompile = (shader) => {
      shader.uniforms.uSunward = { value: sunward };
      shader.vertexShader = `uniform vec3 uSunward;\nvarying float vDay;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec3 facing = normalize(mat3(modelMatrix) * instanceMatrix[3].xyz);
        vDay = 0.035 + 0.965 * smoothstep(-0.12, 0.42, dot(facing, uSunward));`,
      );
      shader.fragmentShader = `varying float vDay;\n${shader.fragmentShader}`.replace("#include <opaque_fragment>", "outgoingLight *= vDay;\n#include <opaque_fragment>");
    };
  };
  const land = surface.mesh("glow"), clouds = cover.mesh("glow");
  shade(land);
  shade(clouds);
  const atmosphere = new Mesh(
    new SphereGeometry(R + 3.4, 40, 28),
    new ShaderMaterial({
      transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
      uniforms: { uSunward: { value: sunward } },
      vertexShader: "varying vec3 vN; varying vec3 vV; varying vec3 vW; void main() { vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); vW = normalize(mat3(modelMatrix) * position); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "varying vec3 vN; varying vec3 vV; varying vec3 vW; uniform vec3 uSunward; void main() { float rim = pow(1.0 - max(0.0, dot(vN, vV)), 2.4); float day = smoothstep(-0.2, 0.5, dot(vW, uSunward)); gl_FragColor = vec4(vec3(0.3, 0.6, 1.0) * rim * day * 1.25, 1.0); }",
    }),
  );
  group.add(land, clouds, atmosphere);
  group.position.set(-262, 150, -340);
  land.rotation.z = clouds.rotation.z = 0.41;
  land.rotation.y = 1.9;
  return { group, land, clouds };
}

export const moonBase: Place = {
  id: "moon",
  name: "tranquility base",
  world: "the moon",
  coords: "0.67°n 23.47°e · july 1969",
  build(coarse) {
    const scene = new Scene();
    const sun = sunlight(0xfff6e8, 4.3, SUN, 135, coarse);
    scene.add(sun, new AmbientLight(0x7c88a6, 0.32));

    const land = new VoxelSet(), props = new VoxelSet();
    ground(land, coarse);
    debris(land, coarse);
    lander(props);
    flag(props, -15, 11);
    experiments(props);
    scene.add(land.mesh("lit", { cast: true, receive: true }), props.mesh("lit", { cast: true, receive: true }));

    const sky = stars(coarse ? 1300 : 2800);
    const tail = comet(coarse);
    const world = earth(coarse);
    scene.add(sky.mesh, world.group, tail.body.mesh, tail.streaks.mesh);

    const { body, arm } = astronaut();
    scene.add(body);
    // Their shadow is drawn by hand, so the sun's shadows only ever have to be worked out once.
    const shadowSet = new VoxelSet();
    shadowSet.box(2.6, 0, 0, 5.2, 0.02, 0.9, [7, 7, 9]);
    const shadow = shadowSet.mesh("glow");
    scene.add(shadow);

    const spot = new Vector3();
    let waveAt = -100;
    let walked = 0;
    const DUSTS = coarse ? 70 : 150;
    const puffs = new Motes(DUSTS, (i) => mix(DUST, [232, 228, 222], hash(i, 1, 91)), "lit");
    scene.add(puffs.mesh);
    let live = DUSTS;

    return {
      scene,
      eye: new Vector3(20, 15, 64),
      at: new Vector3(3, 22, -10),
      fov: 40,
      lens: { center: 0.33, band: 0.22, blur: 7 },
      cell: 0.72,
      pullback: 0.66,
      ground: height,
      sun,
      actor: spot,
      actorSize: 3,
      update(t, dt) {
        sky.tick(t);
        tail.body.tick(t);
        tail.streaks.tick(t);
        // The whole comet glides, head first, too slowly to notice except by looking away and back.
        tail.body.mesh.position.copy(tail.along).multiplyScalar(-70 * Math.sin(t * 0.013));
        world.land.rotation.y = 1.9 + t * 0.022;
        world.clouds.rotation.y = 1.9 + t * 0.034;
        const since = t - waveAt;
        const waving = since < 4;
        if (!waving) walked += dt;
        // Round in slow low-gravity bounds, on the sunny ground beside the lander.
        const a = walked * 0.11;
        const x = 18 + Math.cos(a) * 7, z = 24 + Math.sin(a) * 6;
        const bound = Math.abs(Math.sin(walked * 1.25));
        const g = height(x, z);
        spot.set(x, g + (waving ? 0 : bound * 1.9) + 0.1, z);
        body.position.copy(spot);
        body.rotation.y = waving ? -0.55 : -a;
        arm.rotation.z = waving ? Math.PI - 0.55 + Math.sin(since * 6.4) * 0.46 : Math.PI - 0.15 + bound * 0.2;
        shadow.position.set(x + (spot.y - g) * 1.6, g + 0.08, z);
        // Dust lifted at each landing hangs and falls back slowly: there's no air to carry it away.
        for (let i = 0; i < live; i++) {
          const beat = (walked * 1.25) / Math.PI + hash(i, 3, 91);
          const age = ((beat % 1) + 1) % 1;
          const o = hash(i, 4, 91) * 6.28, far = 0.6 + age * (1.4 + hash(i, 6, 91) * 2.4);
          puffs.place(i, x + Math.cos(o) * far, g + Math.sin(age * Math.PI) * (0.8 + hash(i, 5, 91) * 1.8), z + Math.sin(o) * far, age > 0.96 || waving ? 0.001 : 0.13 + hash(i, 7, 91) * 0.14);
        }
        puffs.commit();
      },
      poke(t) {
        waveAt = t;
        return "wish you were here";
      },
      thin(share) {
        live = Math.round(DUSTS * share);
        puffs.mesh.count = live;
      },
    };
  },
};
