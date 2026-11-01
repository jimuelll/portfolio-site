/*
 * Mars: Gale Crater at sunset, from low among the dunes. Dark basalt sand climbs in rippled ridges around Curiosity, with
 * the banded layers of Mt. Sharp behind it and the small white sun going down in the blue glow that surprised everyone.
 * The wind never stops: sand streams off every crest, veils of dust cross the plain, and a dust devil wanders by. Tap the
 * rover and it stops for a selfie, as it has done all these years.
 */

import { Fog, Group, HemisphereLight, type MeshBasicMaterial, Scene, Vector3 } from "three";
import { clamp, hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import { Motes, VoxelSet } from "../voxels";
import { flows, skyDome, sloped, sunlight, type Flow, type Place } from "./kit";

const RUST: Rgb = [176, 100, 66], RUST_DARK: Rgb = [132, 72, 52], BUTTER: Rgb = [204, 146, 100], BASALT: Rgb = [76, 58, 58], BASALT_LIT: Rgb = [116, 80, 70], TRACK: Rgb = [58, 42, 42];
const STRATA: Rgb[] = [[176, 104, 78], [214, 158, 118], [138, 84, 72], [226, 178, 138], [160, 100, 84], [198, 136, 100], [120, 76, 70], [188, 126, 94]];
const MILLIS_PER_SOL = 88775244;
const LANDED = Date.UTC(2012, 7, 6, 5, 17);

const SHARP_Z = -240, SHARP_H = 62;
const SUN_AT = new Vector3(86, 14, -150);
/** The rover's route, as x for a given z. */
const route = (z: number) => Math.sin(z * 0.05 + 0.5) * 9 + 3;

const along = (x: number, z: number) => x * 0.42 + z * 0.91;

function height(x: number, z: number) {
  // Long dunes on a slant, sharp on their crests, with fine ripples running across them.
  const warp = noise(x * 0.014, z * 0.014, 81) * 4;
  const wave = Math.abs(Math.sin(along(x, z) * 0.058 + warp));
  // Lower along the rover's way, since it has to get through.
  const dune = (1 - wave) ** 1.4 * 4.6 * smoothstep(0.34, 0.62, noise(x * 0.018 + 9, z * 0.018, 82) + 0.1) * (0.25 + 0.75 * smoothstep(4, 14, Math.abs(x - route(z))));
  const ripple = Math.sin(along(x, z) * 2.3 + noise(x * 0.2, z * 0.2, 83) * 3) * 0.075;
  return 1.8 + dune + noise(x * 0.05, z * 0.05, 84) * 2.2 + ripple;
}

/** How far up a dune this is, 0 to 1, for shading crests and placing the sand that blows off them. */
const crest = (x: number, z: number) => smoothstep(3.2, 5.6, height(x, z) - noise(x * 0.05, z * 0.05, 84) * 2.2);

function groundColour(x: number, z: number): Rgb {
  // Dark sand heaped in the dunes, paler rust on the flats, and cracked plates of bedrock showing through.
  const duneness = smoothstep(2, 3.6, height(x, z) - noise(x * 0.05, z * 0.05, 84) * 2.2);
  const flats = mix(mix(RUST, RUST_DARK, noise(x * 0.13, z * 0.13, 85)), BUTTER, noise(x * 0.4, z * 0.4, 86) * 0.14);
  const sand = mix(BASALT, BASALT_LIT, noise(along(x, z) * 1.15, x * 0.08, 87));
  let c = mix(flats, sand, duneness);
  const plate = noise(x * 0.19 + 7, z * 0.19, 88);
  if (duneness < 0.2 && plate > 0.7) c = mix(BUTTER, [168, 112, 80], Math.abs(Math.sin(x * 1.3 + z * 0.9)) * 0.7);
  if (hash(Math.round(x * 3), Math.round(z * 3), 89) > 0.994) c = [60, 46, 46];
  // Two wheel tracks along the rover's route, each cleated.
  const off = Math.abs(Math.abs(x - route(z)) - 2.7);
  if (off < 0.5 && z > 10 && z < 60) c = mix(c, TRACK, 0.72 * (Math.round(z * 2.5) % 2 ? 1 : 0.5));
  return c;
}

function sharp(x: number, z: number) {
  const r = Math.hypot((x + 40) * 0.72, z - SHARP_Z) / 170;
  if (r >= 1) return 0;
  const rough = noise(x * 0.022, z * 0.022, 90) * 0.55 + noise(x * 0.08, z * 0.08, 91) * 0.1;
  const raw = SHARP_H * (1 - r) ** 0.82 * (0.68 + rough);
  // Terraces, since it's built of layers that wore back at different rates.
  return Math.round(raw / 2.2) * 2.2;
}

function ground(v: VoxelSet, coarse: boolean) {
  const fine = coarse ? 0.7 : 0.42, mid = coarse ? 1.5 : 1.1, far = 3.2;
  for (let x = -54; x < 54; x += fine) {
    for (let z = 4; z < 68; z += fine) {
      const h = height(x, z);
      v.column(x, z, h, h - 5, fine, sloped(groundColour(x, z), height, x, z, 0.3), 0.04);
    }
  }
  for (let x = -160; x < 160; x += mid) {
    for (let z = -80; z < 90; z += mid) {
      if (Math.abs(x) < 54 && z >= 4 && z < 68) continue;
      const h = height(x, z);
      v.column(x, z, h, h - 7, mid, sloped(groundColour(x, z), height, x, z, 0.32), 0.06);
    }
  }
  for (let x = -480; x < 480; x += far) {
    for (let z = -420; z < -80; z += far) {
      const s = sharp(x, z);
      const rim = smoothstep(-280, -420, z) * 34 * (0.5 + noise(x * 0.012, 3, 92));
      const low = height(x, z) * 0.8 + rim;
      const h = Math.max(s, low);
      // Each terrace its own colour, the bands wandering a little as real ones do.
      const band = Math.floor((s + noise(x * 0.03, z * 0.03, 93) * 2.4) / 2.2);
      const c = s >= low && s > 3 ? STRATA[Math.abs(band) % STRATA.length] : sloped(mix(mix(RUST, RUST_DARK, noise(x * 0.05, z * 0.05, 94)), BASALT_LIT, smoothstep(3, 5, height(x, z)) * 0.5), height, x, z, 0.25);
      v.column(x, z, h, -8, far, c, 0.05);
    }
  }
}

/** A weathered rock: layered, half buried, its cubes small. */
function rock(v: VoxelSet, x: number, z: number, r: number) {
  const s = 0.26, R = Math.ceil(r / s), base = height(x, z) - r * 0.3;
  const tone = hash(Math.round(x), Math.round(z), 95);
  for (let a = -R; a <= R; a++) {
    for (let b = 0; b <= R; b++) {
      for (let c = -R; c <= R; c++) {
        const d = Math.hypot(a, b * 1.5, c) * s;
        if (d > r * (0.8 + noise(a * 0.45 + x, c * 0.45 + z, 96) * 0.42) || d < r - s * 2.6) continue;
        const layer = Math.floor(b / 2) % 2 ? 0.28 : 0;
        v.add(x + a * s, base + b * s, z + c * s, mix(mix(tone > 0.5 ? BASALT : [132, 84, 66], [176, 112, 78], layer), [226, 150, 100], b / R > 0.75 ? 0.3 : 0), s, 0.14);
      }
    }
  }
}

function strewn(v: VoxelSet, coarse: boolean) {
  for (let i = 0; i < (coarse ? 1500 : 4400); i++) {
    const x = (hash(i, 1, 97) - 0.5) * 118, z = 66 - hash(i, 2, 97) * 72;
    const s = 0.09 + hash(i, 3, 97) ** 3 * 0.4;
    v.box(x, height(x, z) + s / 2, z, s * (0.7 + hash(i, 4, 97)), s, s, mix([78, 56, 52], [176, 110, 76], hash(i, 5, 97)));
  }
  for (let i = 0; i < 44; i++) {
    const x = (hash(i, 1, 98) - 0.5) * 150, z = 62 - hash(i, 2, 98) * 90;
    if (Math.abs(x - route(z)) < 7) continue;
    rock(v, x, z, 0.6 + hash(i, 3, 98) ** 2 * 2.6);
  }
}

/** Curiosity: six cleated wheels on rockers, a white body, the power unit, dish, robot arm, and a mast with its head. */
function rover() {
  const white: Rgb = [236, 230, 218], metal: Rgb = [146, 144, 148], dark: Rgb = [46, 44, 50], wheelTone: Rgb = [92, 90, 96], gold: Rgb = [224, 170, 82];
  const body = new Group();
  const hull = new VoxelSet();
  const panel = (x: number, y: number, z: number): Rgb => {
    const seam = Math.round(x * 3) % 7 === 0 || Math.round(z * 3) % 9 === 0;
    return y > 3.95 && Math.abs(x) < 2.1 && z > -2.4 ? (seam ? [150, 110, 56] : gold) : seam ? [182, 178, 170] : white;
  };
  hull.fill(-2.6, 2.3, -3.6, 2.6, 4.2, 3.4, panel, 0.26, 0.04);
  // The power unit, slanted off the back, with its fins, and a pale deck of boxes.
  hull.box(0, 4.3, -4.1, 3.8, 1.5, 1.1, [50, 50, 58]);
  for (let k = 0; k < 9; k++) hull.box(-1.7 + k * 0.425, 4.5, -4.8, 0.14, 2.3, 0.5, metal);
  hull.fill(-2.1, 4.2, -2.2, -0.6, 4.8, -0.4, white, 0.2, 0.05);
  hull.fill(0.5, 4.2, -1, 2.2, 4.6, 1.4, [186, 182, 176], 0.2, 0.05);
  // The dish, on a stalk near the back.
  hull.box(1.6, 5, -2.3, 0.14, 0.9, 0.14, metal);
  for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) if (a * a + b * b < 17) hull.box(1.6 + a * 0.15, 5.5 + (a + b) * 0.05, -2.3 + b * 0.15, 0.15, 0.08, 0.15, [240, 240, 244]);
  // Rockers and bogies.
  const wheels: { x: number; z: number }[] = [];
  for (const side of [-1, 1]) {
    for (let z = -3.4; z <= 3.4; z += 0.3) hull.box(side * 3.5, 2.5 - Math.abs(z) * 0.14, z, 0.34, 0.34, 0.32, metal);
    for (const z of [-3.4, 0, 3.4]) {
      wheels.push({ x: side * 3.85, z });
      hull.box(side * 3.5, 1.5, z, 0.34, 1.6, 0.34, metal);
    }
  }
  body.add(hull.mesh("lit", { cast: true, receive: true }));
  const spinners: ReturnType<VoxelSet["mesh"]>[] = [];
  for (const w of wheels) {
    const set = new VoxelSet();
    const s = 0.19, R = 5;
    for (let a = -R; a <= R; a++) {
      for (let b = -R; b <= R; b++) {
        const d = Math.hypot(a, b);
        if (d > R + 0.3) continue;
        const tread = d > R - 1.2;
        const cleat = tread && Math.floor((Math.atan2(b, a) + 3.15) * 2.6) % 2 === 0;
        set.box(0, a * s, b * s, tread ? 1.05 : 0.5, s, s, tread ? (cleat ? [122, 120, 128] : wheelTone) : d < 1.5 ? metal : dark);
      }
    }
    const mesh = set.mesh("lit", { cast: true, receive: true });
    mesh.position.set(w.x, 0.98, w.z);
    body.add(mesh);
    spinners.push(mesh);
  }
  // The arm, folded across the front, with its turret of tools.
  const armSet = new VoxelSet();
  for (let k = 0; k < 16; k++) armSet.box(-2 + k * 0.24, 3.1 + Math.sin(k * 0.22) * 0.4, 3.75, 0.24, 0.24, 0.24, k % 4 ? metal : white);
  armSet.fill(1.7, 2.1, 3.4, 2.5, 3, 4.3, [156, 154, 156], 0.18, 0.08);
  armSet.box(2.1, 1.85, 3.85, 0.12, 0.5, 0.12, dark);
  body.add(armSet.mesh("lit", { cast: true }));
  const mast = new Group();
  const pole = new VoxelSet();
  pole.fill(-0.2, 0, -0.2, 0.2, 4.2, 0.2, white, 0.2, 0.04);
  mast.add(pole.mesh("lit", { cast: true }));
  const headSet = new VoxelSet();
  headSet.fill(-0.95, -0.5, -0.45, 0.95, 0.5, 0.45, white, 0.18, 0.04);
  for (const x of [-0.56, 0.56]) headSet.box(x, 0.05, 0.5, 0.42, 0.42, 0.16, [22, 24, 40]);
  headSet.box(0, 0.28, 0.5, 0.28, 0.2, 0.14, [44, 48, 72]);
  const head = headSet.mesh("lit", { cast: true });
  head.position.y = 4.7;
  mast.add(head);
  mast.position.set(-1.4, 4.2, 2.3);
  body.add(mast);
  return { body, mast, spinners };
}

function phobos() {
  const set = new VoxelSet();
  set.ball(0, 0, 0, 7, 0.8, (x, y, z) => mix([120, 104, 100], [68, 58, 60], noise(x * 3 + 2, y * 3 + z * 3, 99)), 0.1, 0.72);
  const mesh = set.mesh("glow");
  (mesh.material as MeshBasicMaterial).fog = false;
  return mesh;
}

/** Everything the wind carries that doesn't have to be placed by hand. */
function blowing(coarse: boolean) {
  const list: Flow[] = [];
  const scale = coarse ? 0.5 : 1;
  const r = (i: number, s: number) => hash(i, s, 100);
  // Sand streaming off the crests, downwind, in thin bright sheets.
  let made = 0;
  for (let i = 0; i < 30000 && made < 3000 * scale; i++) {
    const x = (r(i, 1) - 0.5) * 150, z = 66 - r(i, 2) * 120;
    if (crest(x, z) < 0.4 || r(i, 3) > crest(x, z)) continue;
    const reach = 5 + r(i, 4) * 13;
    list.push({
      start: [x, height(x, z) + 0.1, z], drift: [reach, 0.5 + r(i, 5) * 1.6, -reach * 0.2], curve: [0, -1.2, 0],
      size: 0.1 + r(i, 6) * 0.18, colour: mix([232, 168, 112], [255, 216, 170], r(i, 7)), alpha: 0.72, fade: 1,
      rate: 0.34 + r(i, 8) * 0.5, phase: r(i, 9), wobble: 0.3,
    });
    made++;
  }
  // Grains skittering low across the flats.
  for (let i = 0; i < 1100 * scale; i++) {
    const x = (r(i, 11) - 0.5) * 130, z = 66 - r(i, 12) * 58, y = height(x, z) + 0.12 + r(i, 13) * 0.5;
    list.push({
      start: [x - 12, y, z], drift: [24, 0.2, -4], size: 0.07 + r(i, 14) * 0.12, colour: [226, 156, 104], alpha: 0.6, fade: 0.8,
      rate: 0.3 + r(i, 15) * 0.5, phase: r(i, 16), wobble: 0.5,
    });
  }
  // Wide soft veils of dust crossing the plain, at the rate of a slow breath.
  for (let i = 0; i < 90 * scale; i++) {
    const z = 50 - r(i, 21) * 130;
    list.push({
      start: [-170, 2 + r(i, 22) * 8, z], drift: [340, 2, -30], size: 8 + r(i, 23) * 16, colour: mix([214, 142, 96], [242, 190, 140], r(i, 24)), alpha: 0.075, fade: 0.2,
      rate: 0.022 + r(i, 25) * 0.03, phase: r(i, 26), wobble: 3,
    });
  }
  // The sun's glare, and Earth: a bright evening star, as it has really been photographed from here.
  for (let i = 0; i < 16; i++) list.push({ start: [SUN_AT.x * 4, SUN_AT.y * 4, SUN_AT.z * 4], drift: [0, 0, 0], size: 4 + (i / 16) ** 2 * 34, colour: mix([255, 255, 255], [130, 190, 255], i / 16), alpha: 0.3 * (1 - i / 17), rate: 0, phase: 0.2, twinkle: 0.1 });
  list.push({ start: [-260, 210, -640], drift: [0, 0, 0], size: 6, colour: [176, 212, 255], alpha: 1.4, rate: 0, phase: 0.2, twinkle: 0.6 });
  return flows(list);
}

export const galeCrater: Place = {
  id: "mars",
  name: "gale crater",
  world: "mars",
  coords: "4.59°s 137.44°e",
  build(coarse) {
    const scene = new Scene();
    scene.fog = new Fog(0xb49c98, 110, 820);
    const sun = sunlight(0xf4ecf0, 3.3, new Vector3(120, 58, 52), 96, coarse);
    scene.add(sun, new HemisphereLight(0xd4d8ec, 0x9a5a38, 1.9));
    // Tan overhead, and the dust scatters blue round the low sun: the opposite of home.
    scene.add(skyDome([62, 54, 74], [128, 104, 116], [188, 156, 146], SUN_AT, [176, 214, 255], 58));

    const land = new VoxelSet();
    ground(land, coarse);
    strewn(land, coarse);
    scene.add(land.mesh("lit", { cast: true, receive: true }));

    const { body, mast, spinners } = rover();
    scene.add(body);
    const moon = phobos();
    scene.add(moon);
    const air = blowing(coarse);
    scene.add(air.mesh);

    const spot = new Vector3();
    let selfieAt = -100;
    let driven = 0;

    // The dust devil: a leaning, twisting column, thick at its foot.
    const GRAINS = coarse ? 260 : 520;
    const devil = new Motes(GRAINS, (i) => mix([200, 128, 84], [246, 196, 148], hash(i, 1, 101)));
    scene.add(devil.mesh);
    let live = GRAINS;

    return {
      scene,
      eye: new Vector3(-20, 14, 76),
      at: new Vector3(4, 13, -6),
      fov: 38,
      lens: { center: 0.32, band: 0.2, blur: 9 },
      cell: 0.72,
      pullback: 0.6,
      ground: height,
      sun,
      movingShadows: true,
      shadowEvery: 20,
      actor: spot,
      actorSize: 6,
      update(t, dt) {
        air.tick(t);
        const since = t - selfieAt;
        const posing = since < 5;
        if (!posing) driven += dt;
        // Out along its tracks and back, as slowly as the real one.
        const swing = (driven % 200) / 100;
        const k = swing < 1 ? swing : 2 - swing;
        const z = 16 + k * 22;
        const x = route(z);
        const y = height(x, z) - 0.2;
        spot.set(x, y + 3, z);
        body.position.set(x, y, z);
        const ahead = route(z + 1) - x;
        const face = Math.atan2(ahead, 1) + (swing < 1 ? 0 : Math.PI);
        body.rotation.y = face;
        body.rotation.x = clamp((height(x, z - 3) - height(x, z + 3)) * 0.06, -0.18, 0.18);
        body.rotation.z = clamp((height(x - 3, z) - height(x + 3, z)) * 0.05, -0.14, 0.14);
        if (!posing) spinners.forEach((w) => { w.rotation.x += dt * 0.7 * (swing < 1 ? 1 : -1); });
        // The mast looks about as it goes; asked for a selfie it turns round to the camera.
        const aim = posing ? -face + 0.25 : Math.sin(t * 0.33) * 1 + Math.sin(t * 0.13) * 0.5;
        mast.rotation.y += (aim - mast.rotation.y) * (1 - Math.exp(-dt * 2.6));

        const wx = 34 + Math.sin(t * 0.024) * 52, wz = -2 + Math.cos(t * 0.033) * 14, wg = height(wx, wz);
        for (let i = 0; i < live; i++) {
          const h = (t * (3.4 + hash(i, 2, 101) * 3) + hash(i, 3, 101) * 46) % 46;
          const f = h / 46;
          const radius = 0.7 + f * 6.5 + hash(i, 4, 101) * (0.5 + f * 1.4);
          const a = t * (3.4 - f * 1.7) + hash(i, 5, 101) * 6.28 + h * 0.22;
          devil.place(i, wx + Math.cos(a) * radius + f * f * 10 + Math.sin(h * 0.12 + t * 0.4) * f * 2, wg + h, wz + Math.sin(a) * radius, f > 0.92 ? 0.001 : 0.3 + (1 - f) * 0.24);
        }
        devil.commit();

        // Phobos goes over every minute or so, the wrong way, as it does.
        const run = (t % 70) / 70;
        moon.position.set(-430 + run * 860, 230 + Math.sin(run * Math.PI) * 80, -640);
        moon.rotation.y = t * 0.2;
      },
      poke(t) {
        selfieAt = t;
        const sols = Math.floor((Date.now() - LANDED) / MILLIS_PER_SOL);
        return `sol ${sols.toLocaleString("en-US")} · selfie sent to earth`;
      },
      flash(t) {
        const since = t - selfieAt - 1.5;
        return since < 0 || since > 0.5 ? 0 : (1 - since / 0.5) * 0.8;
      },
      thin(share) {
        live = Math.round(GRAINS * share);
        devil.mesh.count = live;
      },
    };
  },
};
