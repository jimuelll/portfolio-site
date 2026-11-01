/*
 * Earth: Mt. Fuji at dusk, at toy scale. A stone path with lanterns runs through moss and cherry trees to a red torii
 * on the shore of the lake, and the mountain stands behind, reflected in the water. A shinkansen goes by now and then.
 * The shiba at the foot of the torii doesn't mind being tapped.
 */

import { Fog, Group, HemisphereLight, InstancedBufferAttribute, type InstancedMesh, Scene, Vector3 } from "three";
import { clamp, hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import { Motes, VoxelSet } from "../voxels";
import { skyDome, sunlight, type Place } from "./kit";

const MOSS: Rgb = [84, 128, 58], MOSS_DARK: Rgb = [52, 92, 54], PETAL_GROUND: Rgb = [236, 196, 200], EARTHY: Rgb = [112, 92, 62];
const STONE: Rgb = [196, 192, 184], STONE_DARK: Rgb = [112, 112, 120];
const VERMILION: Rgb = [232, 58, 34], CAP: Rgb = [38, 30, 34], GOLD: Rgb = [226, 172, 58];
const CHERRY: Rgb = [244, 170, 192], MAPLE: Rgb = [226, 150, 44], PINE: Rgb = [46, 92, 62];
const FUJI_BODY: Rgb = [116, 118, 176], FUJI_LOW: Rgb = [82, 108, 128], SNOW: Rgb = [255, 252, 255];
const HAZE: Rgb = [150, 136, 186];
const WATER: Rgb = [112, 146, 200], WATER_PEACH: Rgb = [244, 178, 168];

/** The lake's shore runs across the view just behind the torii; its far side has the railway. */
const shoreAt = (x: number) => -14 + Math.sin(x * 0.07) * 2.4 + smoothstep(44, 90, Math.abs(x)) * 34;
const FAR_SHORE = -62;
const FUJI_Z = -142, FUJI_H = 56, FUJI_R = 104;
const TORII_Z = -12;
const EYE = new Vector3(-6, 46, 100);

const fujiHeight = (x: number, z: number) => {
  const r = Math.hypot(x, z - FUJI_Z);
  if (r >= FUJI_R) return 0;
  const a = Math.atan2(x, z - FUJI_Z);
  const ridges = 1 + (noise(a * 6 + 4, r * 0.02, 21) - 0.5) * 0.08;
  return Math.min(FUJI_H * 0.97, FUJI_H * (1 - r / FUJI_R) ** 1.38 * ridges);
};

/** Where the path runs: it wanders a little, and straightens as it reaches the torii. */
const pathX = (z: number) => Math.sin(z * 0.075 + 0.6) * 7 * smoothstep(-8, 30, z);

function ground(v: VoxelSet, water: VoxelSet, step: number) {
  const nearStep = step, farStep = step * 2.6;
  for (let x = -96; x < 96; x += nearStep) {
    for (let z = 74; z > shoreAt(x) - 1; z -= nearStep) {
      if (z < shoreAt(x)) continue;
      const bank = smoothstep(46, 90, Math.abs(x)) * 7;
      const rough = 1.2 + noise(x * 0.11, z * 0.11, 22) * 2.4 + bank;
      const h = Math.abs(x - pathX(z)) < 6 ? Math.min(rough, 2) : rough;
      const patch = noise(x * 0.07 + 3, z * 0.07, 23);
      const fleck = hash(Math.round(x), Math.round(z), 24);
      let c = mix(MOSS, MOSS_DARK, noise(x * 0.32, z * 0.32, 25));
      if (patch > 0.6) c = mix(c, PETAL_GROUND, smoothstep(0.6, 0.7, patch) * (0.55 + fleck * 0.45));
      else if (fleck > 0.86) c = mix(c, PETAL_GROUND, 0.75);
      if (z - shoreAt(x) < 2.2) c = EARTHY;
      v.column(x, z, h, -3, nearStep, c, 0.12);
    }
  }
  // The lake and everything past it, in bigger blocks since it's further away.
  for (let x = -190; x < 190; x += farStep) {
    for (let z = shoreAt(x) + 1; z > -262; z -= farStep) {
      if (z >= shoreAt(x) && Math.abs(x) < 96) continue;
      if (z > FAR_SHORE + Math.sin(x * 0.05) * 3 && z < shoreAt(x)) {
        water.box(x, 0, z, farStep, 0.4, farStep, WATER);
        continue;
      }
      const f = fujiHeight(x, z);
      const hills = 2 + noise(x * 0.03, z * 0.03, 26) * 9 * smoothstep(FAR_SHORE, FAR_SHORE - 30, z) + smoothstep(60, 170, Math.abs(x)) * 18 * noise(x * 0.02, z * 0.03, 27);
      const h = Math.max(f, hills);
      const streak = noise(Math.atan2(x, z - FUJI_Z) * 11, 2, 28);
      const snowline = FUJI_H * (0.46 + streak * 0.26);
      let c: Rgb;
      if (f >= hills && f > snowline) c = SNOW;
      else if (f >= hills) c = mix(FUJI_LOW, FUJI_BODY, smoothstep(0, FUJI_H * 0.5, f));
      // The plain goes hazy with distance, so the mountain rises out of it instead of sitting on a green shelf.
      else c = mix(mix(PINE, [76, 100, 92], noise(x * 0.09, z * 0.09, 29)), HAZE, smoothstep(FAR_SHORE - 6, FAR_SHORE - 74, z) * 0.92);
      v.column(x, z, h, -3, farStep, c, 0.06);
    }
  }
}

/** Stone slabs, every other one darker, so the path reads like the stairs it's leading you up. */
function path(v: VoxelSet) {
  for (let z = 74; z > TORII_Z - 2; z -= 1.4) {
    const cx = pathX(z);
    const row = Math.round(z / 1.4);
    v.box(cx, 1.9, z, 8, 2.2, 1.3, row % 2 ? STONE : STONE_DARK);
    v.box(cx - 4.4, 2.2, z, 0.9, 2.8, 1.4, STONE_DARK);
    v.box(cx + 4.4, 2.2, z, 0.9, 2.8, 1.4, STONE_DARK);
  }
}

function lantern(v: VoxelSet, glow: VoxelSet, x: number, z: number, base: number) {
  v.fill(x - 0.9, base, z - 0.9, x + 0.9, base + 0.8, z + 0.9, STONE, 0.6);
  v.fill(x - 0.45, base + 0.8, z - 0.45, x + 0.45, base + 3, z + 0.45, STONE, 0.45);
  v.fill(x - 1.1, base + 3, z - 1.1, x + 1.1, base + 3.5, z + 1.1, STONE_DARK, 0.55);
  glow.box(x, base + 4.2, z, 1, 1, 1, [255, 206, 120]);
  v.fill(x - 1.3, base + 4.8, z - 1.3, x + 1.3, base + 5.3, z + 1.3, STONE_DARK, 0.65);
  v.box(x, base + 5.6, z, 0.5, 0.5, 0.5, STONE);
}

function tree(v: VoxelSet, x: number, z: number, base: number, size: number, leaf: Rgb, seed: number) {
  const trunk: Rgb = [70, 54, 50];
  const h = size * 1.5;
  v.fill(x - 0.5, base, z - 0.5, x + 0.5, base + h, z + 0.5, trunk, 0.5);
  const step = 0.95;
  for (let i = 0; i < 4; i++) {
    const ox = (hash(seed, i, 31) - 0.5) * size * 1.2, oz = (hash(seed, i, 32) - 0.5) * size * 1.2, oy = hash(seed, i, 33) * size * 0.7;
    const r = size * (0.62 + hash(seed, i, 34) * 0.34);
    const R = Math.ceil(r / step);
    for (let a = -R; a <= R; a++) {
      for (let b = -R; b <= R; b++) {
        for (let c = -R; c <= R; c++) {
          const d = Math.hypot(a, b * 1.25, c) * step;
          if (d > r || d < r - step * 1.7) continue;
          // Gaps in the crown, so the sun dapples the ground below.
          if (hash(a + seed, b + i, c) < 0.1) continue;
          const px = x + ox + a * step, py = base + h + oy + b * step, pz = z + oz + c * step;
          v.add(px, py, pz, mix(leaf, [255, 240, 236], hash(a, b, c + seed) * 0.2), step, 0.14);
        }
      }
    }
  }
}

function torii(v: VoxelSet, base: number) {
  const pillar = (x: number) => {
    v.fill(x - 1, base, TORII_Z - 1, x + 1, base + 15, TORII_Z + 1, VERMILION, 1, 0.05);
    v.fill(x - 1.3, base, TORII_Z - 1.3, x + 1.3, base + 1.5, TORII_Z + 1.3, CAP, 0.65, 0.05);
  };
  pillar(-7.5);
  pillar(7.5);
  v.fill(-10, base + 11, TORII_Z - 0.7, 10, base + 12.4, TORII_Z + 0.7, VERMILION, 0.7, 0.05);
  for (let x = -13; x <= 13; x += 0.9) {
    // The top beam lifts at its ends, as they do.
    const lift = (Math.abs(x) / 13) ** 3 * 1.6;
    v.box(x, base + 15.5 + lift, TORII_Z, 1, 1.2, 2, VERMILION);
    v.box(x, base + 16.5 + lift, TORII_Z, 1, 0.9, 2.6, CAP);
  }
  v.fill(-1.2, base + 12.4, TORII_Z - 0.5, 1.2, base + 15, TORII_Z + 0.5, GOLD, 0.6, 0.05);
}

/** A shiba, about as long as a lantern is tall. */
function shiba() {
  const fur: Rgb = [226, 138, 60], cream: Rgb = [250, 232, 204], dark: Rgb = [40, 30, 28];
  const dog = new Group();
  const body = new VoxelSet();
  body.box(0, 1.2, 0, 1.3, 1.2, 2.8, fur);
  body.box(0, 0.95, 0.05, 1.1, 0.8, 2.3, cream);
  for (const [x, z] of [[-0.45, -1], [0.45, -1], [-0.45, 1], [0.45, 1]]) body.box(x, 0.4, z, 0.45, 0.8, 0.45, cream);
  body.box(0, 2.15, 1.45, 1.4, 1.15, 1.25, fur);
  body.box(0, 1.9, 2.2, 0.8, 0.6, 0.6, cream);
  body.box(0, 2.05, 2.55, 0.28, 0.28, 0.22, dark);
  body.box(-0.42, 2.45, 2.1, 0.22, 0.22, 0.12, dark);
  body.box(0.42, 2.45, 2.1, 0.22, 0.22, 0.12, dark);
  body.box(-0.5, 3, 1.3, 0.42, 0.6, 0.35, fur);
  body.box(0.5, 3, 1.3, 0.42, 0.6, 0.35, fur);
  dog.add(body.mesh("lit", { cast: true }));
  const tailSet = new VoxelSet();
  tailSet.box(0, 0.35, 0, 0.5, 0.9, 0.5, fur);
  tailSet.box(0, 0.85, 0.2, 0.5, 0.5, 0.6, cream);
  const tail = tailSet.mesh("lit");
  tail.position.set(0, 1.6, -1.4);
  dog.add(tail);
  return { dog, tail };
}

function train() {
  const set = new VoxelSet();
  const white: Rgb = [244, 246, 250], blue: Rgb = [40, 84, 190], glass: Rgb = [46, 62, 92];
  const length = 72;
  set.box(0, 1.8, 0, length, 2.6, 2.6, white);
  set.box(0, 1, 0, length + 0.2, 0.5, 2.7, blue);
  for (let i = -length / 2 + 2; i < length / 2 - 2; i += 2.4) set.box(i, 2.5, 0, 1.5, 0.7, 2.7, glass);
  for (let i = 1; i <= 6; i++) set.box(length / 2 + i, 1.1 + i * 0.05, 0, 1, 2.6 - i * 0.34, 2.6 - i * 0.25, white);
  for (let i = 1; i <= 6; i++) set.box(-length / 2 - i, 1.1 + i * 0.05, 0, 1, 2.6 - i * 0.34, 2.6 - i * 0.25, white);
  return set.mesh("lit");
}

export const fuji: Place = {
  id: "earth",
  name: "mt. fuji",
  world: "earth",
  coords: "35.36°n 138.73°e",
  build(coarse) {
    const scene = new Scene();
    scene.fog = new Fog(0xd6a8b0, 130, 900);
    const sunFrom = new Vector3(-74, 74, 58);
    const sun = sunlight(0xffe2bc, 3.5, sunFrom, 104, coarse);
    scene.add(sun, new HemisphereLight(0xd2c2ea, 0x5a5044, 1.7));
    scene.add(skyDome([44, 44, 104], [150, 98, 158], [250, 164, 122], new Vector3(-0.8, 0.1, -1), [255, 214, 150], 30));

    const land = new VoxelSet(), water = new VoxelSet(), lit = new VoxelSet(), glow = new VoxelSet();
    ground(land, water, coarse ? 1.5 : 1);
    path(lit);
    torii(lit, 2);
    const base = 2.2;
    for (const z of [-4, 7, 18, 29, 40, 51, 62]) {
      const cx = pathX(z);
      lantern(lit, glow, cx - 7, z, base);
      lantern(lit, glow, cx + 7, z, base);
    }
    // Trees frame the path and the shore, leaving the middle of the view to the torii and the mountain.
    let placed = 0;
    for (let i = 0; i < 90 && placed < (coarse ? 16 : 28); i++) {
      const x = (hash(i, 1, 35) - 0.5) * 186, z = -8 + hash(i, 2, 35) * 44;
      if (Math.abs(x - pathX(z)) < 22 + z * 0.15 || (Math.abs(x) < 30 && z < 8)) continue;
      const roll = hash(i, 3, 35);
      tree(lit, x, z, 2, 3.6 + hash(i, 4, 35) * 2.4, roll < 0.58 ? CHERRY : roll < 0.8 ? MAPLE : PINE, i);
      placed++;
    }
    // Pines along the far shore and the rail line in front of them.
    for (let x = -176; x < 176; x += 9 + hash(Math.round(x), 2, 36) * 7) tree(lit, x, FAR_SHORE - 10 - hash(Math.round(x), 3, 36) * 12, 3, 3.6 + hash(Math.round(x), 4, 36) * 2, PINE, Math.round(x));
    lit.fill(-190, 1, FAR_SHORE - 4, 190, 2.6, FAR_SHORE, [104, 100, 112], 4);

    scene.add(land.mesh("lit", { cast: true, receive: true }), lit.mesh("lit", { cast: true, receive: true }), glow.mesh("glow"));
    const lake = water.mesh("lit", { receive: true });
    scene.add(lake);

    // The water's colours: the mountain and the dusk mirrored in it, kept to shimmer each frame.
    const lakeCount = lake.count;
    const lakeBase = new Float32Array(lakeCount * 3);
    const positions = lake.instanceMatrix.array as Float32Array;
    for (let i = 0; i < lakeCount; i++) {
      const x = positions[i * 16 + 12], z = positions[i * 16 + 14];
      // Where this bit of water would see, straight back along the view: its height up the mountain, and how far across.
      const seen = EYE.z - z, mirror = (EYE.y / seen - EYE.y / (EYE.z - FAR_SHORE)) * (EYE.z - FUJI_Z) * 0.62;
      const across = ((x - EYE.x) * (EYE.z - FUJI_Z)) / seen + EYE.x;
      const r = FUJI_R * (1 - clamp(mirror / FUJI_H, 0, 1) ** (1 / 1.38));
      const inMountain = mirror < FUJI_H && Math.abs(across) < r;
      const sky = smoothstep(0, 60, mirror);
      let c: Rgb = mix(WATER_PEACH, WATER, sky * 0.9);
      if (inMountain) c = mirror > FUJI_H * 0.58 ? mix(SNOW, WATER, 0.2) : mix(FUJI_BODY, WATER, 0.5);
      lakeBase[i * 3] = c[0] / 255;
      lakeBase[i * 3 + 1] = c[1] / 255;
      lakeBase[i * 3 + 2] = c[2] / 255;
    }
    const lakeColours = (lake as InstancedMesh).instanceColor as InstancedBufferAttribute;
    const shimmer = (t: number) => {
      const out = lakeColours.array as Float32Array;
      for (let i = 0; i < lakeCount; i++) {
        const x = positions[i * 16 + 12], z = positions[i * 16 + 14];
        const k = 0.92 + Math.sin(t * 0.9 + x * 0.17 + z * 0.41 + Math.sin(z * 0.2 + t * 0.4) * 2) * 0.12;
        out[i * 3] = lakeBase[i * 3] * k;
        out[i * 3 + 1] = lakeBase[i * 3 + 1] * k;
        out[i * 3 + 2] = lakeBase[i * 3 + 2] * k;
      }
      lakeColours.needsUpdate = true;
    };

    // Clouds about the mountain's shoulder.
    const clouds = new Group();
    for (let c = 0; c < 5; c++) {
      const set = new VoxelSet();
      const cloudy: Rgb = [244, 200, 200];
      for (let i = 0; i < 26; i++) {
        const w = 5 + hash(c, i, 37) * 8;
        set.box((hash(c, i, 38) - 0.5) * 44, (hash(c, i, 39) - 0.5) * 3.5, (hash(c, i, 40) - 0.5) * 18, w * 1.6, 2.4, w, mix(cloudy, [196, 156, 196], hash(c, i, 41) * 0.6));
      }
      const mesh = set.mesh("glow");
      mesh.position.set((c - 2) * 66, 20 + hash(c, 1, 42) * 12, -100 - hash(c, 2, 42) * 30);
      clouds.add(mesh);
    }
    scene.add(clouds);

    const { dog, tail } = shiba();
    const dogAt = new Vector3(3.2, 3, -3);
    dog.position.copy(dogAt);
    dog.rotation.y = -0.5;
    scene.add(dog);
    const shinkansen = train();
    shinkansen.position.set(-400, 3.6, FAR_SHORE - 2);
    scene.add(shinkansen);

    // Petals on the wind, and a burst from under the dog when it's tapped.
    const PETALS = coarse ? 240 : 420;
    const petals = new Motes(PETALS, (i) => mix(CHERRY, [255, 236, 240], hash(i, 1, 43)));
    scene.add(petals.mesh);
    let live = PETALS;
    const BURST = 44;
    let barkAt = -100;

    return {
      scene,
      eye: EYE.clone(),
      at: new Vector3(0, 20, -14),
      fov: 38,
      lens: { center: 0.3, band: 0.2, blur: 11 },
      sun,
      actor: dogAt.clone().setY(dogAt.y + 1.4),
      actorSize: 4,
      update(t) {
        shimmer(t);
        clouds.children.forEach((c, i) => {
          c.position.x = ((((i - 2) * 66 + t * (0.6 + i * 0.1)) + 190) % 380) - 190;
        });
        // A train every half a minute, over in about eight seconds.
        const run = (t % 30) / 8;
        shinkansen.position.x = run < 1 ? -300 + run * 600 : -400;
        const since = t - barkAt;
        const excited = since < 2.4;
        tail.rotation.z = Math.sin(t * (excited ? 26 : 7)) * (excited ? 0.7 : 0.32);
        const hops = since < 1.3 ? Math.abs(Math.sin(since * 7.2)) * 1.9 * (1 - since / 1.3) : 0;
        dog.position.y = dogAt.y + hops;
        dog.rotation.y = -0.5 + (excited ? Math.sin(since * 9) * 0.25 : Math.sin(t * 0.3) * 0.08);
        for (let i = 0; i < live; i++) {
          if (i < BURST && since < 3) {
            const a = hash(i, 5, 43) * Math.PI * 2, up = 6 + hash(i, 6, 43) * 7, out = 2 + hash(i, 7, 43) * 6;
            petals.place(i, dogAt.x + Math.cos(a) * out * since, dogAt.y + 1 + up * since - 4.5 * since * since, dogAt.z + Math.sin(a) * out * since, 0.36);
            continue;
          }
          const speed = 1.3 + hash(i, 2, 43) * 1.2;
          const h = 44, wide = 170, deep = 84;
          const y = h - ((t * speed + hash(i, 3, 43) * h) % h);
          const sway = Math.sin(t * 0.9 + i) * 1.5;
          const x = ((hash(i, 4, 43) * wide + t * 2.4 + sway + wide * 8) % wide) - wide / 2;
          petals.place(i, x, Math.max(1, y), (hash(i, 8, 43) * deep) - 12 + Math.cos(t * 0.7 + i) * 1.2, 0.26);
        }
        petals.commit();
      },
      poke(t) {
        barkAt = t;
        return "wan!";
      },
      thin(share) {
        live = Math.max(BURST, Math.round(PETALS * share));
        petals.mesh.count = live;
      },
    };
  },
};
