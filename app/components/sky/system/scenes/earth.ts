/*
 * Earth: Fushimi Inari in Kyoto on a windy autumn afternoon, from the foot of the stairs, looking up. Stone steps with
 * lanterns climb a meadow of tens of thousands of bending blades to a vermilion torii and a small copper-roofed shrine,
 * under maples and ginkgos that are losing their leaves to the wind. Foxes are Inari's messengers: two in stone guard
 * the gate, and a live one sits at its foot. It doesn't mind being tapped.
 */

import { Fog, Group, HemisphereLight, type InstancedMesh, type MeshBasicMaterial, MeshDepthMaterial, type MeshLambertMaterial, RGBADepthPacking, Scene, Vector3 } from "three";
import { clamp, hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import { Motes, VoxelSet } from "../voxels";
import { skyDome, sloped, sunlight, type Place } from "./kit";

const MOSS: Rgb = [106, 104, 54], MOSS_DARK: Rgb = [62, 62, 40], GRAVEL: Rgb = [164, 154, 136];
/** Every leaf that has turned: maple reds, orange, ginkgo gold. */
const FALLEN: Rgb[] = [[214, 58, 34], [232, 112, 38], [236, 172, 52], [170, 52, 36], [222, 142, 44]];
const fallen = (a: number, b: number, seed: number) => FALLEN[Math.floor(hash(a, b, seed) * FALLEN.length)];
const STONE: Rgb = [206, 202, 192], STONE_DARK: Rgb = [104, 104, 112], STONE_MID: Rgb = [156, 154, 150];
const VERMILION: Rgb = [236, 56, 30], CAP: Rgb = [34, 28, 32], GOLD: Rgb = [236, 182, 62];
const GINKGO: Rgb = [232, 176, 48], GINKGO_DEEP: Rgb = [190, 128, 36], CEDAR: Rgb = [58, 100, 62], BARK: Rgb = [176, 170, 158];
const COPPER: Rgb = [118, 172, 136], COPPER_DARK: Rgb = [74, 122, 100], WOOD: Rgb = [104, 66, 42], PLASTER: Rgb = [226, 218, 200];

/** The stairs run down toward +z, from the shrine's yard to the foot of the hill. */
const STAIR_TOP = 6, STAIR_FOOT = 58, YARD = 15.6, RISE = 0.3;
const stairHeight = (z: number) => YARD - clamp(z - STAIR_TOP, 0, STAIR_FOOT - STAIR_TOP) * RISE;

function height(x: number, z: number) {
  const away = smoothstep(6, 18, Math.abs(x));
  const yard = z < STAIR_TOP + 2 && z > -28 && Math.abs(x) < 17 ? 1 - smoothstep(13, 17, Math.abs(x)) : 0;
  const bumps = (noise(x * 0.09, z * 0.09, 22) * 3.4 + noise(x * 0.3, z * 0.3, 23) * 0.8) * away * (1 - yard);
  return stairHeight(z) - 0.5 + bumps + smoothstep(-28, -80, z) * 16;
}

function groundColour(x: number, z: number): Rgb {
  const fleck = hash(Math.round(x * 2), Math.round(z * 2), 24);
  if (z < STAIR_TOP + 1 && z > -27 && Math.abs(x) < 14) return mix(mix(GRAVEL, [118, 110, 96], Math.sin(z * 2.1 + Math.sin(x * 0.2)) * 0.5 + 0.5), [96, 90, 80], fleck * 0.34);
  let c = mix(MOSS, MOSS_DARK, noise(x * 0.34, z * 0.34, 25));
  // Leaves lie in drifts where the wind has left them, thinning out one by one, and thickest under the trees.
  const drift = noise(x * 0.09 + 3, z * 0.09, 26) + smoothstep(-8, -40, z) * 0.2 + smoothstep(-14, -40, x) * 0.2;
  if (hash(Math.round(x * 2), Math.round(z * 2), 30) < smoothstep(0.42, 0.72, drift + (noise(x * 0.5, z * 0.5, 31) - 0.5) * 0.14)) c = mix(fallen(Math.round(x * 2), Math.round(z * 2), 32), c, fleck * 0.3);
  return c;
}

function ground(v: VoxelSet, coarse: boolean) {
  const fine = coarse ? 0.75 : 0.5, far = coarse ? 1.8 : 1.3;
  const inFine = (x: number, z: number) => Math.abs(x) < 34 && z > -26 && z < 46;
  for (let x = -34; x < 34; x += fine) {
    for (let z = -26; z < 46; z += fine) {
      if (Math.abs(x) < 4.4 && z > STAIR_TOP && z < STAIR_FOOT) continue;
      const h = height(x, z);
      v.column(x, z, h, h - 5, fine, sloped(groundColour(x, z), height, x, z, 0.14), 0.1);
    }
  }
  for (let x = -96; x < 96; x += far) {
    for (let z = -96; z < 90; z += far) {
      if (inFine(x, z)) continue;
      const h = height(x, z);
      v.column(x, z, h, h - 7, far, sloped(groundColour(x, z), height, x, z, 0.14), 0.1);
    }
  }
}

/** Worn stones with dark joints, in two tones of step, with moss creeping in from the kerbs. */
function stairs(v: VoxelSet) {
  const unit = 0.33;
  for (let z = STAIR_TOP; z < STAIR_FOOT; z += 1) {
    const y = stairHeight(z);
    const base = Math.round(z) % 2 ? STONE : STONE_DARK;
    for (let x = -3.85; x <= 3.85; x += unit) {
      for (let k = 0; k < 3; k++) {
        const ix = Math.round(x * 3), stone = Math.floor((ix + (k + Math.round(z)) * 2) / 5);
        const joint = (ix + (k + Math.round(z)) * 2) % 5 === 0;
        let c = mix(base, STONE_MID, hash(stone, Math.round(z), 27) * 0.42);
        if (joint) c = mix(c, [44, 44, 48], 0.6);
        const edge = (4 - Math.abs(x)) / 4;
        if (hash(ix, k + Math.round(z) * 4, 28) > 0.3 + edge * 1.5) c = mix(c, MOSS, 0.85);
        // Leaves caught on the steps, more of them against the kerbs.
        if (hash(ix, k + Math.round(z) * 4, 33) > 0.9 + edge * 0.07) c = fallen(ix, k + Math.round(z) * 4, 34);
        v.box(x, y - 0.3 + (hash(stone, Math.round(z), 38) - 0.5) * 0.07, z + k * unit + 0.17, unit, 0.6, unit, c);
      }
    }
    v.box(0, y - 2, z + 0.92, 8, 2.8, 0.16, [40, 40, 44]);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const c = mix(STONE_DARK, STONE_MID, hash(z, side * 3 + k, 39));
        v.box(side * 4.3, y + 0.15 + (hash(z, side, 40) - 0.5) * 0.2, z + k * unit + 0.17, 0.7, 1.2, unit, hash(z, k + side, 41) > 0.72 ? mix(c, MOSS, 0.75) : c);
      }
    }
  }
}

const weathered = (x: number, y: number, z: number): Rgb => {
  const lichen = noise(x * 2.2, y * 1.6 + z * 2.2, 42);
  return lichen > 0.66 ? mix(STONE, MOSS, 0.7) : mix(STONE, STONE_DARK, lichen * 0.72);
};

function lantern(v: VoxelSet, glow: VoxelSet, x: number, y: number, z: number) {
  const s = 0.2;
  v.fill(x - 1, y, z - 1, x + 1, y + 0.4, z + 1, weathered, s, 0.1);
  v.fill(x - 0.65, y + 0.4, z - 0.65, x + 0.65, y + 0.7, z + 0.65, weathered, s, 0.1);
  v.fill(x - 0.28, y + 0.7, z - 0.28, x + 0.28, y + 2.4, z + 0.28, weathered, s, 0.1);
  v.fill(x - 0.8, y + 2.4, z - 0.8, x + 0.8, y + 2.7, z + 0.8, weathered, s, 0.1);
  for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) v.fill(x + a - 0.1, y + 2.7, z + b - 0.1, x + a + 0.1, y + 3.6, z + b + 0.1, weathered, s, 0.1);
  glow.box(x, y + 3.15, z, 0.72, 0.8, 0.72, [255, 214, 120]);
  for (let k = 0; k < 4; k++) {
    const w = 1.3 - k * 0.34;
    v.fill(x - w, y + 3.6 + k * 0.22, z - w, x + w, y + 3.82 + k * 0.22, z + w, weathered, s, 0.12);
  }
  v.fill(x - 0.15, y + 4.5, z - 0.15, x + 0.15, y + 4.9, z + 0.15, weathered, s, 0.1);
}

/** Old paint: streaked along the grain, worn dark near the ground. */
const lacquer = (x: number, y: number, z: number): Rgb => {
  const grain = noise(x * 5 + z * 5, y * 0.5, 44);
  return mix(VERMILION, [150, 32, 24], grain * grain * 0.9 + (noise(x, y * 2, 45) > 0.7 ? 0.2 : 0));
};

function torii(v: VoxelSet, strips: VoxelSet, y: number, z: number) {
  const s = 0.25;
  for (const side of [-1, 1]) {
    const x = side * 5.6;
    v.fill(x - 0.65, y + 1.6, z - 0.65, x + 0.65, y + 12.6, z + 0.65, lacquer, s, 0.04);
    v.fill(x - 0.8, y, z - 0.8, x + 0.8, y + 1.6, z + 0.8, CAP, s, 0.08);
    v.fill(x - 1.1, y, z - 1.1, x + 1.1, y + 0.4, z + 1.1, STONE_MID, s, 0.1);
  }
  v.fill(-7.4, y + 9.6, z - 0.4, 7.4, y + 10.5, z + 0.4, lacquer, s, 0.04);
  v.fill(-0.8, y + 10.5, z - 0.3, 0.8, y + 12.4, z + 0.3, CAP, s, 0.04);
  v.fill(-0.55, y + 10.75, z + 0.25, 0.55, y + 12.15, z + 0.4, GOLD, 0.15, 0.1);
  for (let x = -9.4; x <= 9.4; x += s) {
    // The top beam lifts at its ends, as they do.
    const lift = (Math.abs(x) / 9.4) ** 3 * 1.3;
    for (let k = -3; k <= 3; k++) {
      v.box(x, y + 12.8 + lift, z + k * s, s, 0.72, s, lacquer(x, y + 12.8, z + k * s));
      if (Math.abs(k) < 3) v.box(x, y + 13.32 + lift, z + k * s, s, 0.34, s, mix(CAP, [70, 66, 66], hash(Math.round(x * 4), k, 46) * 0.5));
    }
  }
  // The straw rope under the beam, sagging, with its zigzag paper strips.
  for (let x = -4.8; x <= 4.8; x += 0.2) {
    const sag = (1 - (x / 4.8) ** 2) * 0.55;
    const twist = Math.round(x * 5) % 3 === 0;
    v.box(x, y + 9.1 - sag, z + 0.45, 0.2, 0.34, 0.34, twist ? [176, 150, 92] : [222, 200, 140]);
  }
  for (const x of [-3, -1, 1, 3]) {
    const sag = (1 - (x / 4.8) ** 2) * 0.55;
    for (let k = 0; k < 4; k++) strips.box(x + (k % 2 ? 0.2 : 0), y + 8.65 - sag - k * 0.3, z + 0.52, 0.32, 0.28, 0.08, [250, 248, 240]);
  }
}

/** A stone fox on its plinth, with the red bib they're always given. */
function guardian(v: VoxelSet, x: number, y: number, z: number) {
  const s = 0.35;
  v.fill(x - 1.3, y, z - 1.3, x + 1.3, y + 1.6, z + 1.3, STONE_MID, s);
  v.fill(x - 0.6, y + 1.6, z - 0.9, x + 0.6, y + 3.2, z + 0.7, STONE, s);
  v.fill(x - 0.5, y + 3.2, z + 0.1, x + 0.5, y + 4.2, z + 1, STONE, s);
  v.box(x - 0.34, y + 4.5, z + 0.5, 0.26, 0.6, 0.26, STONE);
  v.box(x + 0.34, y + 4.5, z + 0.5, 0.26, 0.6, 0.26, STONE);
  v.fill(x - 0.65, y + 2.5, z + 0.5, x + 0.65, y + 3.1, z + 0.85, VERMILION, 0.3, 0.03);
}

function shrine(v: VoxelSet, glow: VoxelSet, y: number) {
  const cz = -16, s = 0.25;
  const plank = (x: number, h: number, z: number): Rgb => mix(WOOD, [62, 38, 28], noise(x * 6 + z * 6, h * 0.4, 47));
  v.fill(-9.5, y, cz - 7, 9.5, y + 1.5, cz + 7, weathered, 0.5, 0.1);
  for (let k = 0; k < 3; k++) v.fill(-4, y + k * 0.5, cz + 7 + (2 - k), 4, y + k * 0.5 + 0.5, cz + 8 + (2 - k), weathered, 0.33, 0.1);
  const floor = y + 1.5;
  v.fill(-7.6, floor, cz - 5, 7.6, floor + 0.5, cz + 5.4, plank, s, 0.08);
  const wall = (x: number, h: number, z: number, along: number) => {
    const frame = Math.abs(along) % 3.5 < 0.3 || h > 5.2 || h < 1;
    const c: Rgb = frame ? plank(x, h, z) : mix(PLASTER, [190, 176, 150], noise(x * 1.1 + z * 1.1, h * 1.4, 48) * 0.6);
    v.box(x, floor + h, z, s, s, s, c);
  };
  for (let a = -7; a <= 7; a += s) {
    for (let h = 0.6; h < 6; h += s) {
      wall(a, h, cz - 4.5, a);
      if (Math.abs(a) > 3) wall(a, h, cz + 4.5, a);
      if (Math.abs(a) < 4.6) { wall(-7, h, cz + a, a); wall(7, h, cz + a, a); }
    }
  }
  for (const side of [-1, 1]) {
    for (const z of [cz - 4.5, cz + 4.5]) v.fill(side * 7.2 - 0.35, floor, z - 0.35, side * 7.2 + 0.35, floor + 6.2, z + 0.35, lacquer, s, 0.04);
    v.fill(side * 3.2 - 0.3, floor, cz + 4.3, side * 3.2 + 0.3, floor + 6.2, cz + 4.9, lacquer, s, 0.04);
    // A railing along the veranda.
    v.fill(side * 7.4 - 0.1, floor + 1.2, cz - 4.5, side * 7.4 + 0.1, floor + 1.4, cz + 4.5, lacquer, 0.2, 0.04);
    glow.box(side * 3.2, floor + 4.6, cz + 5.3, 0.8, 1.1, 0.8, [255, 196, 96]);
    v.box(side * 3.2, floor + 5.25, cz + 5.3, 1, 0.2, 1, CAP);
  }
  v.box(0, floor + 3, cz + 3.2, 6, 5.5, 0.4, [24, 20, 24]);
  // A cloth across the doorway, the offering box, and the gold bell on its rope.
  for (let x = -2.9; x <= 2.9; x += s) v.box(x, floor + 5 - (Math.round(x * 4) % 8 === 0 ? 0.2 : 0), cz + 3.5, s, 1 - (Math.floor((x + 3) / 1.5) % 2 ? 0 : 0.08), 0.1, Math.floor((x + 3) / 1.5) % 2 ? [242, 238, 226] : VERMILION);
  v.fill(-2, floor + 0.5, cz + 4.6, 2, floor + 1.9, cz + 6, plank, s, 0.08);
  for (let x = -1.8; x <= 1.8; x += 0.4) v.box(x, floor + 1.95, cz + 5.3, 0.14, 0.1, 1.3, [38, 26, 22]);
  v.box(0, floor + 4.1, cz + 5, 0.16, 2.8, 0.16, PLASTER);
  v.fill(-0.35, floor + 5.5, cz + 4.65, 0.35, floor + 6.1, cz + 5.35, GOLD, 0.2, 0.1);
  const eave = floor + 6;
  // Rafters under the eaves, then the copper roof in rows of tiles, gone green in streaks.
  for (let x = -10; x <= 10; x += 0.8) {
    for (const front of [-1, 1]) v.box(x, eave - 0.1, cz + front * 6.6, 0.3, 0.3, 3.4, [44, 30, 26]);
  }
  v.box(0, eave - 0.3, cz + 5, 15.5, 0.6, 0.4, lacquer(0, 0, 0));
  const rows = 26;
  for (let k = 0; k <= rows; k++) {
    const f = k / rows;
    const depth = 8.4 - f * 8;
    const ry = eave + (f ** 1.35) * 6.9;
    for (const front of [-1, 1]) {
      for (let x = -10.2; x <= 10.2; x += 0.34) {
        const lift = (Math.abs(x) / 10.2) ** 4 * 0.7 * (1 - f);
        const ix = Math.round(x * 3);
        const seam = (ix + k) % 6 === 0;
        const streak = noise(x * 0.9, f * 3, 49);
        let c = mix(COPPER, COPPER_DARK, streak);
        if (k % 2) c = mix(c, [168, 208, 178], hash(ix, k * front, 29) * 0.34);
        if (seam) c = mix(c, [44, 76, 66], 0.65);
        v.box(x, ry + lift, cz + front * depth, 0.34, 0.3, 0.42, c);
      }
    }
  }
  v.box(0, eave + 7.05, cz, 21, 0.55, 0.8, CAP);
  for (const side of [-1, 1]) {
    v.box(side * 10.4, eave + 7.6, cz, 0.6, 1.1, 0.6, CAP);
    v.box(side * 10.4, eave + 8.2, cz, 0.9, 0.2, 0.2, GOLD);
  }
}

/** A round trunk of small cubes, tapering, in streaks of bark. */
function trunk(v: VoxelSet, x: number, z: number, base: number, tall: number, r: number, tone: Rgb) {
  const step = 0.5;
  for (let h = -1; h < tall; h += step) {
    const radius = r * (1 - (h / tall) * 0.45) * (h < 1.2 ? 1.35 - h * 0.25 : 1);
    const n = Math.max(6, Math.round((radius * 6.3) / step));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const px = x + Math.cos(a) * radius, pz = z + Math.sin(a) * radius;
      const c = mix(tone, [64, 54, 48], noise(a * 2.4, h * 0.22, 58) ** 2 * 1.3);
      v.add(px, base + h, pz, c, step * 1.05, 0.14);
    }
  }
}

/** A crown: thousands of small leaves in lumps, lit on top and deep below, with air between them. */
function crown(v: VoxelSet, cx: number, cy: number, cz: number, size: number, leaf: Rgb, deep: Rgb, seed: number, leaves: number, cone: boolean) {
  const lumps = cone ? 9 : 10;
  for (let l = 0; l < lumps; l++) {
    const lift = cone ? (l / lumps) * size * 2.4 : hash(seed, l, 60) * size * 0.8;
    const spread = cone ? size * (1 - l / lumps) * 0.95 : size * 0.85;
    const a = hash(seed, l, 61) * Math.PI * 2;
    const ox = Math.cos(a) * spread * (cone ? 0.35 : hash(seed, l, 62)), oz = Math.sin(a) * spread * (cone ? 0.35 : hash(seed, l, 62));
    const r = cone ? size * (1.02 - (l / lumps) * 0.8) : size * (0.42 + hash(seed, l, 63) * 0.26);
    const flat = cone ? 0.42 : 0.72;
    for (let i = 0; i < leaves; i++) {
      const u = hash(seed + l, i, 64) * 2 - 1, t = hash(seed + l, i, 65) * Math.PI * 2, sq = Math.sqrt(1 - u * u);
      const depth = 0.72 + hash(seed + l, i, 66) * 0.34;
      const px = cx + ox + Math.cos(t) * sq * r * depth, py = cy + lift + u * r * flat * depth, pz = cz + oz + Math.sin(t) * sq * r * depth;
      // Light from above, and each leaf a little its own.
      const lit = clamp((u + 1) * 0.5 + (hash(seed + l, i, 67) - 0.5) * 0.55, 0, 1);
      const c = mix(mix(deep, leaf, lit), [255, 236, 160], hash(seed + l, i, 68) > 0.965 ? 0.55 : 0);
      const size2 = 0.34 + hash(seed + l, i, 69) * 0.34;
      v.box(px, py, pz, size2, size2 * 0.72, size2, c);
    }
  }
}

function broadleaf(v: VoxelSet, foliage: VoxelSet, x: number, z: number, size: number, seed: number, leaves: number) {
  const base = height(x, z);
  const tall = size * 1.5;
  trunk(v, x, z, base, tall + size * 0.3, 0.6, BARK);
  for (let b = 0; b < 4; b++) {
    const a = hash(seed, b, 70) * Math.PI * 2;
    for (let k = 0; k < 8; k++) v.add(x + Math.cos(a) * k * 0.5, base + tall * 0.72 + k * 0.42, z + Math.sin(a) * k * 0.5, BARK, 0.4, 0.14);
  }
  // Maples gone red, ginkgos gone gold, and some caught between.
  const turn = hash(seed, 9, 70);
  const leaf: Rgb = turn < 0.42 ? [232, 62, 36] : turn < 0.72 ? GINKGO : [232, 112, 36];
  const deep: Rgb = turn < 0.42 ? [156, 36, 32] : turn < 0.72 ? GINKGO_DEEP : [150, 58, 28];
  crown(foliage, x, base + tall + size * 0.2, z, size, leaf, deep, seed, leaves, false);
}

function cedar(v: VoxelSet, foliage: VoxelSet, x: number, z: number, size: number, seed: number, leaves: number, tall: number) {
  const base = height(x, z);
  trunk(v, x, z, base, tall + size, 0.55, [146, 112, 88]);
  crown(foliage, x, base + tall, z, size, CEDAR, [28, 56, 44], seed, leaves, true);
}

/** A mossy rock half sunk in the ground. */
function rock(v: VoxelSet, x: number, z: number, r: number) {
  const base = height(x, z) - r * 0.3;
  const s = 0.3, R = Math.ceil(r / s);
  for (let a = -R; a <= R; a++) {
    for (let b = 0; b <= R; b++) {
      for (let c = -R; c <= R; c++) {
        const d = Math.hypot(a, b * 1.4, c) * s;
        if (d > r * (0.82 + noise(a * 0.5 + x, c * 0.5 + z, 71) * 0.36) || d < r - s * 2.4) continue;
        const px = x + a * s, py = base + b * s, pz = z + c * s;
        const top = b / R + (noise(px * 1.4, pz * 1.4, 72) - 0.5) * 0.7;
        v.add(px, py, pz, top > 0.55 ? MOSS : mix(STONE_MID, STONE_DARK, noise(px, py * 2, 73)), s, 0.12);
      }
    }
  }
}

/** A low bush of small leaves, in a colour of its own. */
function shrub(v: VoxelSet, x: number, z: number, r: number, tone: Rgb, seed: number, n: number) {
  const base = height(x, z);
  for (let i = 0; i < n; i++) {
    const a = hash(seed, i, 74) * Math.PI * 2, u = hash(seed, i, 75), rad = Math.sqrt(1 - u * u) * r * (0.5 + hash(seed, i, 76) * 0.55);
    const c = mix(mix(tone, [34, 60, 40], (1 - u) * 0.75), [255, 250, 220], hash(seed, i, 77) > 0.96 ? 0.4 : 0);
    v.box(x + Math.cos(a) * rad, base + u * r * 0.85, z + Math.sin(a) * rad, 0.26, 0.22, 0.26, c);
  }
}

/**
 * Wind, in the vertex shader, so a hundred thousand moving things cost one number a frame. Gusts roll across the whole
 * scene, and each instance also flutters on its own and catches the light as it turns. Shadows move with it.
 */
function windy(mesh: InstancedMesh, wind: { value: number }, opts: { sway: number; flutter: number; shimmer: number; rooted: boolean; branch?: number }) {
  const motion = `
    vec2 root = instanceMatrix[3].xz + instanceMatrix[3].y * 0.3;
    float seed = fract(sin(dot(root, vec2(12.9898, 78.233))) * 43758.5453) * 6.2832;
    float gust = sin(uWind * 1.5 - root.x * 0.13 + root.y * 0.07) * 0.5 + 0.5;
    gust = gust * gust * (0.6 + 0.4 * sin(uWind * 0.37 + root.y * 0.05));
    float hold = ${opts.rooted ? "position.y + 0.5" : "1.0"};
    float flick = sin(uWind * (2.2 + fract(seed) * 1.8) + seed);
    vec3 moved = vec3(${opts.sway.toFixed(3)} * gust + ${opts.flutter.toFixed(3)} * flick, ${opts.rooted ? "0.0" : `${opts.flutter.toFixed(3)} * 0.6 * cos(uWind * 2.7 + seed)`}, ${opts.flutter.toFixed(3)} * 0.7 * sin(uWind * 1.9 + seed * 1.7)) * hold;
    // Neighbouring leaves share a branch and swing together, big enough to read at the size of a glyph.
    float limb = fract(sin(dot(floor(root / 3.2), vec2(41.3, 17.9))) * 43758.5453) * 6.2832;
    moved += ${(opts.branch ?? 0).toFixed(3)} * vec3(sin(uWind * 1.35 + limb), 0.45 * sin(uWind * 1.75 + limb * 2.0), 0.6 * cos(uWind * 1.1 + limb));
    transformed += moved / vec3(instanceMatrix[0][0], instanceMatrix[1][1], instanceMatrix[2][2]);`;
  const material = mesh.material as MeshLambertMaterial;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = `uniform float uWind;\nvarying float vShimmer;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>${motion}
      vShimmer = 1.0 + ${opts.shimmer.toFixed(3)} * (flick * 0.6 + gust * 0.9 - 0.35);`,
    );
    shader.fragmentShader = `varying float vShimmer;\n${shader.fragmentShader}`.replace("#include <opaque_fragment>", "outgoingLight *= vShimmer;\n#include <opaque_fragment>");
  };
  if (mesh.castShadow) {
    const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
    depth.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = wind;
      shader.vertexShader = `uniform float uWind;\n${shader.vertexShader}`.replace("#include <begin_vertex>", `#include <begin_vertex>${motion}`);
    };
    mesh.customDepthMaterial = depth;
  }
}

/** Tones of a meadow, picked per blade, so the ground reads as thousands of plants rather than a colour. */
const BLADES: Rgb[] = [[92, 96, 48], [146, 128, 58], [176, 146, 62], [122, 110, 52], [196, 160, 74], [168, 112, 52]];

/**
 * The meadow: a thin box per blade, densest near the camera. They lean in the wind in the vertex shader, so all those
 * blades cost one number a frame. They take the trees' shadows but don't cast their own.
 */
function meadow(coarse: boolean) {
  const set = new VoxelSet();
  const flowers = new VoxelSet();
  // Autumn's own: red spider lilies, and pampas plumes standing over the grass.
  const plant = (x: number, z: number, density: number) => {
    const ix = Math.round(x * 8), iz = Math.round(z * 8);
    if (hash(ix, iz, 50) > density) return;
    if (Math.abs(x) < 4.9 && z > STAIR_TOP - 1 && z < STAIR_FOOT) return;
    if (z < STAIR_TOP + 1 && z > -27 && Math.abs(x) < 14) return;
    const px = x + (hash(ix, iz, 51) - 0.5) * 0.3, pz = z + (hash(ix, iz, 52) - 0.5) * 0.3;
    const base = height(px, pz);
    const clump = noise(px * 0.16, pz * 0.16, 53);
    const tall = 0.5 + hash(ix, iz, 54) * 0.8 + clump * 0.8;
    // Patches lean toward one tone, and each blade strays from it.
    const tone = Math.floor(clamp(clump * 1.5 + (hash(ix, iz, 55) - 0.5) * 0.9 - 0.1, 0, 0.999) * BLADES.length);
    const c = sloped(BLADES[tone], height, px, pz, 0.14);
    const w = 0.13 + hash(ix, iz, 56) * 0.07;
    set.box(px, base + tall / 2, pz, w, tall, w, c);
    const bloom = hash(ix, iz, 57);
    if (bloom < 0.006) flowers.box(px, base + tall + 0.08, pz, 0.26, 0.22, 0.26, [228, 42, 34]);
    else if (bloom < 0.02 && clump > 0.5) {
      set.box(px, base + tall + 0.7, pz, w, 1.5, w, [176, 150, 84]);
      for (let k = 0; k < 4; k++) flowers.box(px + k * 0.06, base + tall + 1.5 + k * 0.28, pz, 0.24 - k * 0.03, 0.3, 0.24 - k * 0.03, [240, 226, 192]);
    }
  };
  const near = coarse ? 0.38 : 0.27, mid = coarse ? 0.62 : 0.44;
  for (let x = -32; x < 32; x += near) for (let z = 8; z < 66; z += near) plant(x, z, 0.92);
  for (let x = -60; x < 60; x += mid) {
    for (let z = -44; z < 66; z += mid) {
      if (Math.abs(x) < 32 && z >= 8) continue;
      plant(x, z, 0.85);
    }
  }
  return { blades: set.mesh("lit", { receive: true }), flowers: flowers.mesh("lit", { receive: true }) };
}

function fox() {
  const fur: Rgb = [240, 136, 44], cream: Rgb = [252, 236, 210], dark: Rgb = [38, 28, 26];
  const body = new Group();
  const set = new VoxelSet();
  set.box(0, 1.25, -0.15, 1, 1, 2.4, fur);
  set.box(0, 1, 0.1, 0.8, 0.6, 1.9, cream);
  for (const [x, z] of [[-0.32, -1.05], [0.32, -1.05], [-0.32, 0.8], [0.32, 0.8]]) set.box(x, 0.4, z, 0.3, 0.8, 0.3, dark);
  set.box(0, 2.1, 1.15, 1.15, 0.9, 1, fur);
  set.box(0, 1.85, 1.85, 0.5, 0.42, 0.7, cream);
  set.box(0, 1.95, 2.25, 0.2, 0.2, 0.16, dark);
  set.box(-0.34, 2.28, 1.68, 0.16, 0.16, 0.1, dark);
  set.box(0.34, 2.28, 1.68, 0.16, 0.16, 0.1, dark);
  for (const side of [-1, 1]) {
    set.box(side * 0.4, 2.8, 1, 0.32, 0.55, 0.26, fur);
    set.box(side * 0.4, 3.12, 1, 0.2, 0.16, 0.2, dark);
  }
  body.add(set.mesh("lit", { cast: true }));
  const tailSet = new VoxelSet();
  tailSet.box(0, 0.35, -0.4, 0.75, 0.75, 1, fur);
  tailSet.box(0, 0.75, -1.1, 0.8, 0.9, 0.9, fur);
  tailSet.box(0, 1.25, -1.5, 0.55, 0.65, 0.6, cream);
  const tail = tailSet.mesh("lit", { cast: true });
  tail.position.set(0, 1.25, -1.25);
  body.add(tail);
  return { body, tail };
}

export const fushimi: Place = {
  id: "earth",
  name: "fushimi inari",
  world: "kyoto, earth",
  coords: "34.97°n 135.77°e",
  build(coarse) {
    const scene = new Scene();
    scene.fog = new Fog(0xe2b68c, 90, 520);
    const sun = sunlight(0xffdca8, 3.8, new Vector3(-84, 50, 44), 80, coarse);
    scene.add(sun, new HemisphereLight(0xdcd8dc, 0x54442c, 1.35));
    scene.add(skyDome([88, 118, 176], [204, 174, 158], [250, 198, 134], new Vector3(-0.7, 0.14, -1), [255, 220, 156], 20));

    const land = new VoxelSet(), lit = new VoxelSet(), glow = new VoxelSet();
    ground(land, coarse);
    stairs(lit);
    for (let z = 14; z < STAIR_FOOT; z += 8) {
      const y = stairHeight(z) - 0.2;
      lantern(lit, glow, -6.2, y, z);
      lantern(lit, glow, 6.2, y, z);
    }
    const paper = new VoxelSet();
    torii(lit, paper, YARD - 0.3, 3);
    guardian(lit, -8.6, YARD - 0.5, 6.5);
    guardian(lit, 8.6, YARD - 0.5, 6.5);
    shrine(lit, glow, YARD - 0.5);
    // Reds and golds on the left and behind, darker cedars to the right, and tall ones along the ridge; the stairs stay clear.
    const foliage = new VoxelSet();
    const perLump = coarse ? 46 : 110;
    let placed = 0;
    for (let i = 0; i < 200 && placed < (coarse ? 11 : 16); i++) {
      const x = (hash(i, 1, 36) - 0.5) * 124, z = -64 + hash(i, 2, 36) * 90;
      if (x > -30 && z > -34 && x < 24) continue;
      if (x >= 24 && z > 4) continue;
      if (x > 12) cedar(lit, foliage, x, z, 5.5 + hash(i, 4, 36) * 3, i, perLump, 6);
      else broadleaf(lit, foliage, x, z, 6.5 + hash(i, 4, 36) * 3.5, i, perLump);
      placed++;
    }
    const trunks = new VoxelSet();
    for (let i = 0; i < 10; i++) cedar(trunks, foliage, -30 + i * 6.6 + hash(i, 1, 37) * 2.4, -34 - hash(i, 2, 37) * 9, 6 + hash(i, 3, 37) * 2, 100 + i, Math.round(perLump * 0.8), 22 + hash(i, 4, 37) * 8);
    // What the ground is full of: rocks, and bushes turning with everything else.
    for (let i = 0; i < 46; i++) {
      const x = (hash(i, 1, 78) - 0.5) * 84, z = -6 + hash(i, 2, 78) * 56;
      if (Math.abs(x) < 7 || (Math.abs(x) < 15 && z < 8)) continue;
      rock(lit, x, z, 0.8 + hash(i, 3, 78) ** 2 * 1.9);
    }
    const bushes = coarse ? 60 : 110;
    for (let i = 0; i < 90; i++) {
      const x = (hash(i, 1, 79) - 0.5) * 96, z = -14 + hash(i, 2, 79) * 66;
      if (Math.abs(x) < 8.4 || (Math.abs(x) < 15 && z < 8)) continue;
      const roll = hash(i, 3, 79);
      shrub(lit, x, z, 1 + hash(i, 4, 79) * 1.5, roll < 0.34 ? [198, 58, 38] : roll < 0.6 ? [216, 126, 44] : [118, 110, 54], i, bushes);
    }
    // Far ridges in the haze, so the sky has something to stand behind it.
    const ridge = new VoxelSet();
    for (let row = 0; row < 3; row++) {
      for (let x = -420; x < 420; x += 5) {
        const h = 26 + row * 16 + noise(x * 0.012, row * 3, 80) * 42 + noise(x * 0.11, row, 81) * 5;
        ridge.box(x, h / 2 - 10, -170 - row * 70, 5, h + 20, 8, mix(mix([128, 92, 66], [84, 96, 74], noise(x * 0.04, row, 82)), [132, 118, 128], row / 2));
      }
    }
    scene.add(ridge.mesh("lit"));

    scene.add(land.mesh("lit", { receive: true }), lit.mesh("lit", { cast: true, receive: true }), trunks.mesh("lit", { cast: true, receive: true }));
    const wind = { value: 0 };
    const { blades, flowers } = meadow(coarse);
    windy(blades, wind, { sway: 0.82, flutter: 0.14, shimmer: 0.26, rooted: true });
    windy(flowers, wind, { sway: 1.1, flutter: 0.16, shimmer: 0, rooted: false });
    const canopy = foliage.mesh("lit", { cast: true, receive: true });
    windy(canopy, wind, { sway: 1.7, flutter: 0.34, shimmer: 0.34, rooted: false, branch: 0.95 });
    const strips = paper.mesh("glow");
    windy(strips, wind, { sway: 0.26, flutter: 0.13, shimmer: 0, rooted: false });
    scene.add(blades, flowers, canopy, strips);
    const lights = glow.mesh("glow");
    scene.add(lights);

    const { body, tail } = fox();
    const foxAt = new Vector3(1.9, YARD, 8);
    body.position.copy(foxAt);
    body.rotation.y = 0.45;
    scene.add(body);

    // Leaves torn off and carried across, some skittering along the ground, a burst when the fox jumps, and the
    // shrine's incense blown flat.
    const LEAVES = coarse ? 300 : 640, SMOKE = 26, BURST = 34;
    const leaves = new Motes(LEAVES, (i) => fallen(i, 1, 43));
    const smoke = new Motes(SMOKE, () => [214, 214, 222]);
    scene.add(leaves.mesh, smoke.mesh);
    let live = LEAVES;
    let tapAt = -100;
    const actor = foxAt.clone();
    actor.y += 1.4;

    return {
      scene,
      eye: new Vector3(11, 12, 58),
      at: new Vector3(1, 21, 0),
      fov: 36,
      lens: { center: 0.36, band: 0.2, blur: 12 },
      cell: 0.72,
      pullback: 0.72,
      sun,
      movingShadows: true,
      actor,
      actorSize: 3.4,
      update(t) {
        wind.value = t;
        (lights.material as MeshBasicMaterial).color.setScalar(0.86 + Math.sin(t * 3.1) * 0.07 + Math.sin(t * 7.3) * 0.05);
        const since = t - tapAt;
        const excited = since < 2.4;
        tail.rotation.y = 0.3 + Math.sin(t * (excited ? 18 : 3.2)) * (excited ? 0.6 : 0.26);
        const hop = since < 1.2 ? Math.abs(Math.sin(since * 7.8)) * 1.5 * (1 - since / 1.2) : 0;
        body.position.y = foxAt.y + hop;
        body.rotation.y = 0.45 + (excited ? Math.sin(since * 8) * 0.25 : Math.sin(t * 0.23) * 0.1);
        for (let i = 0; i < live; i++) {
          if (i < BURST && since < 2.6) {
            const a = hash(i, 5, 43) * Math.PI * 2, up = 5 + hash(i, 6, 43) * 6, out = 1.5 + hash(i, 7, 43) * 5;
            leaves.place(i, foxAt.x + Math.cos(a) * out * since, foxAt.y + 1 + up * since - 4 * since * since, foxAt.z + Math.sin(a) * out * since, 0.3);
            continue;
          }
          // All blown the same way, surging together with the gusts. The nearest stay far enough from the camera not to
          // become big squares.
          const wide = 150, deep = 90, h = 36;
          const speed = 6 + hash(i, 2, 43) * 6;
          const z = hash(i, 8, 43) * deep - 50 + Math.cos(t * 0.7 + i) * 1.3;
          const x = ((hash(i, 4, 43) * wide + t * speed + Math.sin(t * 0.75 + z * 0.03) * 6 + Math.sin(t * 1.7 + i) * 1.2) % wide) - wide / 2;
          // Each one turns as it goes, flat, then edge-on.
          const turn = 0.05 + Math.abs(Math.sin(t * (2 + hash(i, 6, 43) * 3) + i)) * 0.22;
          if (i > live * 0.86) {
            leaves.place(i, x, height(x, z) + 0.25 + Math.abs(Math.sin(t * 2.6 + i)) * 0.7, z, 0.34, turn * 1.3);
            continue;
          }
          const fall = (t * (1.5 + hash(i, 3, 43) * 1.7) + hash(i, 7, 43) * h) % h;
          leaves.place(i, x, height(x, z) + h - fall + Math.sin(t * 2.1 + i) * 0.7, z, 0.4, turn * 1.5);
        }
        leaves.commit();
        for (let i = 0; i < SMOKE; i++) {
          const k = ((t * 0.16 + i / SMOKE) % 1);
          smoke.place(i, k * k * 13 + Math.sin(k * 11 + t * 1.3) * (0.1 + k * 0.7), YARD + 2.5 + k * 5, -9 + Math.cos(k * 7) * 0.5, k > 0.9 ? 0.001 : 0.26);
        }
        smoke.commit();
      },
      poke(t) {
        tapAt = t;
        return "kon kon!";
      },
      thin(share) {
        live = Math.max(BURST, Math.round(LEAVES * share));
        leaves.mesh.count = live;
      },
    };
  },
};
