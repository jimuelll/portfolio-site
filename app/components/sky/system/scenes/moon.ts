/*
 * The Moon: Tranquility Base. Bootprints lead through grey dust to the lunar module and its flag, under a black sky
 * with Earth hanging in it. There's no air, so the shadows are hard and black. The astronaut hops about, and will
 * stop and wave if you tap them.
 */

import { AmbientLight, BufferGeometry, Float32BufferAttribute, Group, Points, PointsMaterial, Scene, Vector3 } from "three";
import { clamp, hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import { Motes, VoxelSet } from "../voxels";
import { paintEarth } from "../orrery";
import { sloped, sunlight, type Place } from "./kit";

const DUST: Rgb = [182, 178, 172], DUST_DARK: Rgb = [108, 108, 114], PRINT: Rgb = [40, 40, 46];
const FOIL: Rgb = [232, 176, 58], FOIL_DARK: Rgb = [176, 116, 40], SILVER: Rgb = [204, 208, 214], SHADE: Rgb = [70, 72, 80], GLASS: Rgb = [24, 28, 44];

const CRATERS = [
  [-44, 26, 15], [40, 40, 12], [-22, -36, 18], [52, -14, 14], [-62, -18, 11], [16, 58, 8], [-14, 44, 6], [72, 22, 9], [26, -50, 11], [-74, 34, 9], [-38, -4, 6], [34, 8, 5],
];

/** Height of the dust: gentle rolls, the bowls and rims of craters, and the world curving away toward the horizon. */
function height(x: number, z: number) {
  let h = 3 + noise(x * 0.05, z * 0.05, 71) * 3.4 + noise(x * 0.2, z * 0.2, 72) * 0.8;
  for (const [cx, cz, r] of CRATERS) {
    const d = Math.hypot(x - cx, z - cz) / r;
    if (d < 1) h -= (1 - d * d) * r * 0.32;
    else if (d < 1.45) h += (1 - (d - 1) / 0.45) * r * 0.075;
  }
  return h - smoothstep(-70, -260, z) * 30 - (x * x) * 0.00012;
}

/** The line of bootprints: from the near foreground to the foot of the ladder. */
const walk = (z: number) => Math.sin(z * 0.07) * 8 * smoothstep(0, 40, z) + 2;

function ground(v: VoxelSet, step: number) {
  for (let x = -130; x < 130; x += step) {
    for (let z = 80; z > -44; z -= step) {
      const h = height(x, z);
      let c = sloped(mix(DUST, DUST_DARK, noise(x * 0.11 + 4, z * 0.11, 73)), height, x, z, 0.3);
      // Pairs of prints, one each side of the line, with a stride between them.
      const row = Math.round(z / 3.2);
      const side = row % 2 ? -1.2 : 1.2;
      if (z > 5 && z < 80 && Math.abs(x - walk(row * 3.2) - side) < 1 && Math.abs(z - row * 3.2) < 1.1) c = PRINT;
      v.column(x, z, h, -30, step, c, 0.06);
    }
  }
  for (let x = -260; x < 260; x += step * 3) {
    for (let z = -44; z > -300; z -= step * 3) v.column(x, z, height(x, z), -60, step * 3, mix(DUST, DUST_DARK, noise(x * 0.04, z * 0.04, 74)), 0.05);
  }
}

/** The lunar module: a gold foil base on splayed legs, and the silver cabin on top. */
function lander(v: VoxelSet) {
  const g = height(0, 0) + 0.2;
  const base = g + 5.5;
  const foil = (x: number, y: number, z: number): Rgb => mix(FOIL, FOIL_DARK, noise(x * 1.6 + y, z * 1.6, 75) > 0.55 ? 0.9 : 0);
  // An octagon of foil: a box with its corners stepped off.
  for (let a = -7; a <= 7; a++) {
    for (let b = -7; b <= 7; b++) {
      if (Math.abs(a) + Math.abs(b) > 10.5) continue;
      for (let y = 0; y < 5; y++) {
        if (Math.abs(a) < 7 && Math.abs(b) < 7 && Math.abs(a) + Math.abs(b) < 10 && y > 0 && y < 4) continue;
        v.add(a, base + y, b, foil(a, y, b), 1, 0.12);
      }
    }
  }
  v.fill(-1.8, base - 2.2, -1.8, 1.8, base, 1.8, SHADE, 0.9);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    for (let k = 0; k <= 12; k++) {
      const f = k / 12;
      v.box(dx * (4.8 + f * 5.2), base + 1 - f * (base + 1 - g), dz * (4.8 + f * 5.2), 0.6, 0.8, 0.6, SILVER);
    }
    v.fill(dx * 10 - 1.3, g - 0.1, dz * 10 - 1.3, dx * 10 + 1.3, g + 0.4, dz * 10 + 1.3, FOIL_DARK, 0.65, 0.04);
  }
  // The ladder, down the front leg.
  for (let k = 0; k < 6; k++) v.box(0, base - k * 0.95, 8.1 + k * 0.4, 2, 0.28, 0.28, SILVER);
  const cabin = base + 5;
  for (let a = -5; a <= 5; a++) {
    for (let b = -5; b <= 4; b++) {
      for (let y = 0; y < 7; y++) {
        if (Math.abs(a) < 5 && b > -5 && b < 4 && y > 0 && y < 6) continue;
        const panel = Math.abs(a) + Math.abs(b) > 7.5;
        v.add(a, cabin + y, b, panel ? SHADE : mix(SILVER, [160, 164, 172], hash(a, b, y) > 0.8 ? 0.8 : 0), 1, 0.05);
      }
    }
  }
  // Two triangular windows looking out over the ladder.
  for (const x of [-3, 3]) {
    v.box(x, cabin + 4.6, 4.6, 2.2, 1.6, 0.4, GLASS);
    v.box(x, cabin + 3.5, 4.6, 1.2, 0.8, 0.4, GLASS);
  }
  v.fill(-1.5, cabin + 1, 4.2, 1.5, cabin + 2.8, 4.8, FOIL, 0.6);
  // Dish and antennae.
  v.fill(5, cabin + 6, -2, 5.6, cabin + 9, -1.4, SILVER, 0.6);
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (a * a + b * b < 6) v.box(5.3 + a * 0.5, cabin + 9.3 + (a * a + b * b) * 0.06, -1.7 + b * 0.5, 0.5, 0.2, 0.5, [236, 238, 244]);
  v.fill(-3, cabin + 7, 0, -2.6, cabin + 11, 0.4, SILVER, 0.4);
}

function flag(v: VoxelSet, x: number, z: number) {
  const g = height(x, z);
  v.fill(x - 0.2, g, z - 0.2, x + 0.2, g + 11, z + 0.2, [226, 228, 232], 0.4, 0.02);
  v.fill(x, g + 10.6, z - 0.1, x + 6.4, g + 10.9, z + 0.1, [226, 228, 232], 0.3, 0.02);
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 10; j++) {
      const canton = i < 7 && j > 4;
      const c: Rgb = canton ? (((i + j) & 1) && hash(i, j, 76) > 0.3 ? [240, 240, 250] : [44, 60, 140]) : j % 2 ? [226, 54, 50] : [244, 240, 236];
      v.box(x + 0.25 + i * 0.4, g + 6.6 + j * 0.4, z + Math.sin(i * 0.8) * 0.2, 0.42, 0.42, 0.3, c);
    }
  }
}

/** A small round astronaut, with an arm that can wave. */
function astronaut() {
  const suit: Rgb = [244, 244, 240], gold: Rgb = [232, 172, 60];
  const body = new Group();
  const set = new VoxelSet();
  set.box(0, 1.9, 0, 1.5, 1.6, 1, suit);
  set.box(0, 2.1, -0.75, 1.4, 1.5, 0.6, [188, 190, 196]);
  set.box(-0.42, 0.5, 0, 0.55, 1.1, 0.7, suit);
  set.box(0.42, 0.5, 0, 0.55, 1.1, 0.7, suit);
  set.box(0, 3.25, 0.05, 1.3, 1.15, 1.2, suit);
  set.box(0, 3.25, 0.62, 0.95, 0.72, 0.2, gold);
  set.box(-1, 2, 0, 0.45, 1.3, 0.5, suit);
  body.add(set.mesh("lit", { cast: true }));
  const armSet = new VoxelSet();
  armSet.box(0, 0.65, 0, 0.45, 1.5, 0.5, suit);
  const arm = armSet.mesh("lit", { cast: true });
  arm.position.set(1, 2.5, 0);
  arm.rotation.z = Math.PI - 0.2;
  body.add(arm);
  return { body, arm };
}

function starsAbove(n: number) {
  const positions: number[] = [];
  const colours: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (hash(i, 1, 77) - 0.5) * 2.6, u = hash(i, 2, 77) * 0.8;
    const c = Math.sqrt(1 - u * u);
    positions.push(Math.sin(a) * c * 800, u * 800, -Math.cos(a) * c * 800);
    const b = 0.5 + hash(i, 3, 77) * 0.5;
    colours.push(b, b, b);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  const points = new Points(geometry, new PointsMaterial({ size: 1.2, sizeAttenuation: false, vertexColors: true }));
  points.frustumCulled = false;
  return points;
}

export const moonBase: Place = {
  id: "moon",
  name: "tranquility base",
  world: "the moon",
  coords: "0.67°n 23.47°e · july 1969",
  build(coarse) {
    const scene = new Scene();
    const sun = sunlight(0xfff8ee, 4.1, new Vector3(-84, 38, 40), 118, coarse);
    scene.add(sun, new AmbientLight(0x8a93a8, 0.22), starsAbove(500));
    const land = new VoxelSet(), props = new VoxelSet();
    ground(land, coarse ? 1.5 : 1);
    lander(props);
    flag(props, -15, 11);
    // Some boulders, thrown out by old impacts.
    for (let i = 0; i < 70; i++) {
      const x = (hash(i, 1, 78) - 0.5) * 230, z = hash(i, 2, 78) * 120 - 42;
      if (Math.hypot(x, z) < 18 || Math.abs(x - walk(z)) < 5) continue;
      const s = 0.8 + hash(i, 3, 78) ** 2 * 3;
      props.fill(x - s, height(x, z) - 0.3, z - s, x + s, height(x, z) + s, z + s, DUST_DARK, 0.8, 0.14);
    }
    scene.add(land.mesh("lit", { cast: true, receive: true }), props.mesh("lit", { cast: true, receive: true }));

    // Earth, with the real coastlines, half lit as it would be from here.
    const earthSet = new VoxelSet();
    earthSet.ball(0, 0, 0, 13, 1.25, paintEarth, 0.03);
    const earth = earthSet.mesh("lit");
    earth.position.set(-112, 46, -150);
    earth.rotation.z = 0.41;
    scene.add(earth);

    const { body, arm } = astronaut();
    scene.add(body);
    const spot = new Vector3();
    let waveAt = -100;
    let walked = 0;
    const DUSTS = coarse ? 60 : 120;
    const puffs = new Motes(DUSTS, (i) => mix(DUST, [226, 224, 220], hash(i, 1, 79)), "lit");
    scene.add(puffs.mesh);
    let live = DUSTS;

    return {
      scene,
      eye: new Vector3(14, 36, 82),
      at: new Vector3(0, 19, 0),
      fov: 40,
      lens: { center: 0.38, band: 0.24, blur: 9 },
      sun,
      movingShadows: true,
      actor: spot,
      actorSize: 4,
      update(t, dt) {
        earth.rotation.y = t * 0.05;
        const since = t - waveAt;
        const waving = since < 4;
        if (!waving) walked += dt;
        // Round and round the flag and the lander's foot, in long low-gravity hops.
        const a = walked * 0.12;
        const x = 24 + Math.cos(a) * 8, z = 6 + Math.sin(a) * 7;
        const hop = Math.abs(Math.sin(walked * 1.5));
        spot.set(x, clamp(height(x, z), -5, 20) + (waving ? 0 : hop * 2.1) + 0.2, z);
        body.position.copy(spot);
        body.rotation.y = waving ? 0.1 : -a;
        arm.rotation.z = waving ? Math.PI - 0.5 + Math.sin(since * 7) * 0.42 : Math.PI - 0.15 + hop * 0.2;
        // A little dust thrown up at each landing, and it falls slowly.
        for (let i = 0; i < live; i++) {
          const beat = (walked * 1.5) / Math.PI + hash(i, 3, 79);
          const age = ((beat % 1) + 1) % 1;
          const px = x + Math.cos(hash(i, 4, 79) * 6.28) * (0.8 + age * 3), pz = z + Math.sin(hash(i, 4, 79) * 6.28) * (0.8 + age * 3);
          const g = clamp(height(x, z), -5, 20);
          puffs.place(i, px, g + Math.sin(age * Math.PI) * 1.6 * hash(i, 5, 79), pz, age > 0.95 || waving ? 0.001 : 0.28);
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
