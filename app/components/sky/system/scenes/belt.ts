/*
 * The asteroid belt, as it is and not as in the films: mostly nothing. The next rock of any size is a long way off, and you could
 * fly through without seeing one. So this is a single one up close: 243 Ida, thirty-odd kilometres of cratered rubble, turning
 * every four and a half hours, the first asteroid found to have its own moon, when Galileo went by in 1993. Dactyl's the speck
 * going round it. A little gravel hangs about, the sun is small and hard, and Jupiter's a bright star. Tap Dactyl.
 */

import { AmbientLight, Group, Scene, Vector3 } from "three";
import { hash, mix, noise, type Rgb } from "../../engine";
import { Motes, VoxelSet } from "../voxels";
import { stars } from "./moon";
import { flows, sunlight, type Flow, type Place } from "./kit";

const LONG = 60, WIDE = 25, TALL = 21;
const ROCK: Rgb = [146, 132, 112], ROCK_DARK: Rgb = [84, 76, 68], ROCK_PALE: Rgb = [186, 172, 150];
const SUNWARD = new Vector3(-0.74, 0.46, 0.5).normalize();

/** Where the bowls have been knocked out of it, as a direction and a size, in the asteroid's squashed space. */
const CRATERS: { d: Vector3; r: number }[] = [];
for (let i = 0; i < 46; i++) {
  const u = hash(i, 1, 340) * 2 - 1, a = hash(i, 2, 340) * Math.PI * 2, s = Math.sqrt(1 - u * u);
  CRATERS.push({ d: new Vector3(Math.cos(a) * s, u, Math.sin(a) * s), r: 0.06 + hash(i, 3, 340) ** 2.6 * 0.3 });
}

/** The shape: a long potato with a waist, lumps on it, and every crater bitten out. True if a point's in the rock. */
function solid(x: number, y: number, z: number) {
  // Pinched in the middle, as two pieces come to rest against each other would be.
  const waist = 1 - Math.exp(-((x / 12) ** 2)) * 0.2;
  const nx = x / LONG, ny = y / (TALL * waist), nz = z / (WIDE * waist);
  const d = Math.hypot(nx, ny, nz) || 1;
  // Most of the box is plainly rock or plainly nothing, and needn't hear about the craters.
  if (d > 1.24) return false;
  if (d < 0.45) return true;
  const ux = nx / d, uy = ny / d, uz = nz / d;
  let shape = 0.82 + noise(ux * 2.6 + uz * 1.4 + 4, uy * 2.6 + uz * 1.2 + 4, 341) * 0.32 + noise(ux * 8 + uz * 6, uy * 8, 342) * 0.05;
  for (const { d: c, r } of CRATERS) {
    const ax = ux - c.x, ay = uy - c.y, az = uz - c.z, near = ax * ax + ay * ay + az * az, reach = r * 1.35;
    if (near >= reach * reach) continue;
    const off = Math.sqrt(near) / r;
    if (off < 1) shape -= (1 - off * off) * r * 0.85;
    else shape += (1 - (off - 1) / 0.35) * r * 0.08;
  }
  return d < shape;
}

/** How far into a crater's bowl a point on the surface is, 0 outside any, for the pale fresh rock on its slopes. */
function bowlAt(x: number, y: number, z: number) {
  const nx = x / LONG, ny = y / TALL, nz = z / WIDE, d = Math.hypot(nx, ny, nz) || 1;
  let bowl = 0;
  for (const { d: c, r } of CRATERS) bowl = Math.max(bowl, 1 - Math.hypot(nx / d - c.x, ny / d - c.y, nz / d - c.z) / r);
  return bowl;
}

function ida(coarse: boolean) {
  const set = new VoxelSet();
  const s = coarse ? 1.5 : 1;
  // Each cube asked once and the answer kept, since every one of them is also asked about by its six neighbours.
  const nx = Math.ceil((LONG * 1.2) / s), ny = Math.ceil((TALL * 1.2) / s), nz = Math.ceil((WIDE * 1.2) / s);
  const sx = nx * 2 + 3, sy = ny * 2 + 3, sz = nz * 2 + 3;
  const rock = new Uint8Array(sx * sy * sz);
  const at = (i: number, j: number, k: number) => (i + nx + 1) + (j + ny + 1) * sx + (k + nz + 1) * sx * sy;
  for (let i = -nx; i <= nx; i++) for (let j = -ny; j <= ny; j++) for (let k = -nz; k <= nz; k++) if (solid(i * s, j * s, k * s)) rock[at(i, j, k)] = 1;
  for (let i = -nx; i <= nx; i++) {
    for (let j = -ny; j <= ny; j++) {
      for (let k = -nz; k <= nz; k++) {
        const here = at(i, j, k);
        // Only the skin of it: anything with rock on all six sides nobody will ever see.
        if (!rock[here] || (rock[here + 1] && rock[here - 1] && rock[here + sx] && rock[here - sx] && rock[here + sx * sy] && rock[here - sx * sy])) continue;
        const x = i * s, y = j * s, z = k * s;
        const bowl = bowlAt(x, y, z);
        const tone = noise(x * 0.09 + 5, y * 0.09 + z * 0.09, 343);
        const c = mix(mix(ROCK_DARK, ROCK, tone * 1.3), ROCK_PALE, bowl > 0 && bowl < 0.3 ? 0.5 : hash(i, j, k + 344) > 0.97 ? 0.8 : 0);
        set.add(x, y, z, c, s, 0.08);
      }
    }
  }
  return set.mesh("lit", { cast: true, receive: true });
}

/** Boulders resting on it that the next knock will send off again. */
function boulders(coarse: boolean) {
  const set = new VoxelSet();
  let placed = 0;
  for (let i = 0; i < 2600 && placed < (coarse ? 90 : 210); i++) {
    const u = hash(i, 1, 345) * 2 - 1, a = hash(i, 2, 345) * Math.PI * 2, c = Math.sqrt(1 - u * u);
    const dir = new Vector3(Math.cos(a) * c * LONG, u * TALL, Math.sin(a) * c * WIDE);
    let k = 1.3;
    while (k > 0.3 && !solid(dir.x * k, dir.y * k, dir.z * k)) k -= 0.02;
    if (k <= 0.3) continue;
    const b = 0.5 + hash(i, 3, 345) ** 3 * 2.4;
    set.box(dir.x * k, dir.y * k, dir.z * k, b * (0.7 + hash(i, 4, 345)), b, b * (0.7 + hash(i, 5, 345)), mix(ROCK_DARK, ROCK_PALE, hash(i, 6, 345)));
    placed++;
  }
  return set.mesh("lit", { cast: true, receive: true });
}

export const ida243: Place = {
  id: "belt",
  name: "243 ida",
  world: "the asteroid belt",
  coords: "2.86 au · and nothing else for ages",
  build(coarse) {
    const scene = new Scene();
    const sun = sunlight(0xfff4e4, 4, SUNWARD.clone().multiplyScalar(170), 90, coarse);
    sun.shadow.normalBias = 1.6;
    scene.add(sun, new AmbientLight(0x7a86a4, 0.62));

    const sky = stars(coarse ? 1700 : 3400);
    scene.add(sky.mesh);

    const rock = new Group();
    rock.add(ida(coarse), boulders(coarse));
    rock.rotation.z = 0.32;
    scene.add(rock);

    const moonSet = new VoxelSet();
    moonSet.ball(0, 0, 0, 3.4 / 0.5, 0.5, (x, y, z) => mix(ROCK_DARK, ROCK, noise(x * 3 + 2, y * 3 + z * 3, 346)), 0.08, 0.86);
    const dactyl = moonSet.mesh("lit", { cast: true });
    scene.add(dactyl);

    const list: Flow[] = [];
    const r = (i: number, s: number) => hash(i, s, 347);
    // Everything else out here: Jupiter and Mars, a very long way off, the faint band of dust in the plane, and specks of other rocks.
    list.push({ start: [320, 172, -760], drift: [0, 0, 0], size: 8, colour: [255, 240, 214], alpha: 1.5, rate: 0, phase: 0.2, twinkle: 0.2 });
    list.push({ start: [-410, -90, -720], drift: [0, 0, 0], size: 5, colour: [255, 170, 130], alpha: 1.3, rate: 0, phase: 0.2, twinkle: 0.2 });
    for (let i = 0; i < (coarse ? 260 : 620); i++) {
      const a = (r(i, 1) - 0.5) * 2.4;
      list.push({ start: [Math.sin(a) * 800, (r(i, 2) + r(i, 3) - 1) * 170 + a * 90, -Math.cos(a) * 800], drift: [0, 0, 0], size: 22 + r(i, 4) * 40, colour: [226, 206, 170], alpha: 0.018, rate: 0, phase: 0.2 });
    }
    for (let i = 0; i < 34; i++) {
      const a = (r(i, 5) - 0.5) * 2.2;
      list.push({ start: [Math.sin(a) * 720, (r(i, 6) - 0.5) * 240 + a * 90, -Math.cos(a) * 720], drift: [(r(i, 7) - 0.5) * 8, 0, 0], size: 1.6 + r(i, 8) * 1.8, colour: [218, 206, 186], alpha: 0.95, rate: 0.004, phase: r(i, 9), twinkle: 2.6 });
    }
    const far = flows(list);
    scene.add(far.mesh);

    // Gravel, knocked up by something long ago and still not altogether down: there's barely enough gravity to ask.
    const GRAVEL = coarse ? 200 : 460;
    const gravel = new Motes(GRAVEL, (i) => mix(ROCK_DARK, ROCK_PALE, hash(i, 1, 348)), "lit");
    scene.add(gravel.mesh);
    let live = GRAVEL;

    const spot = new Vector3();
    let calledAt = -100;

    return {
      scene,
      eye: new Vector3(-20, 22, 172),
      at: new Vector3(4, -2, 0),
      fov: 42,
      lens: { center: 0.5, band: 0.42, blur: 4 },
      cell: 0.72,
      pullback: 0.8,
      ground: () => -1000,
      sun,
      movingShadows: true,
      shadowEvery: 14,
      actor: spot,
      actorSize: 5,
      update(t) {
        far.tick(t);
        sky.tick(t);
        rock.rotation.y = t * 0.06;
        const a = t * 0.075 + 2.2;
        spot.set(Math.cos(a) * 92, Math.sin(a * 0.7) * 22 + 12, Math.sin(a) * 62);
        dactyl.position.copy(spot);
        dactyl.rotation.y = t * 0.3;
        const since = t - calledAt;
        // A nudge: it wobbles, faintly, and nothing else out here will ever know.
        dactyl.rotation.x = since < 3 ? Math.sin(since * 7) * (1 - since / 3) * 0.5 : 0;
        for (let i = 0; i < live; i++) {
          const g = hash(i, 2, 348) * 6.283 + t * (0.02 + hash(i, 3, 348) * 0.03), far2 = 66 + hash(i, 4, 348) * 40;
          gravel.place(i, Math.cos(g) * far2, (hash(i, 5, 348) - 0.5) * 56 + Math.sin(g * 2 + i) * 3, Math.sin(g) * far2 * 0.68, 0.14 + hash(i, 6, 348) ** 3 * 0.8);
        }
        gravel.commit();
      },
      poke(t) {
        calledAt = t;
        return "dactyl · the first moon ever found round an asteroid";
      },
      thin(share) {
        live = Math.round(GRAVEL * share);
        gravel.mesh.count = live;
      },
    };
  },
};
