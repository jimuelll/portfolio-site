/*
 * Mars: Gale Crater at sunset. Rover tracks lead through rust dunes to Curiosity, with the layers of Mt. Sharp behind
 * it, a dust devil wandering past, and the sunset that surprised everyone by being blue. Tap the rover and it stops
 * for a selfie, as it has done all these years.
 */

import { Fog, Group, HemisphereLight, type MeshBasicMaterial, Scene, Vector3 } from "three";
import { clamp, hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import { Motes, VoxelSet } from "../voxels";
import { skyDome, sloped, sunlight, type Place } from "./kit";

const RUST: Rgb = [206, 104, 56], RUST_DARK: Rgb = [148, 70, 44], BUTTER: Rgb = [228, 158, 98], BASALT: Rgb = [66, 50, 50], TRACK: Rgb = [112, 60, 44];
const STRATA: Rgb[] = [[214, 120, 80], [244, 178, 124], [170, 98, 78], [255, 204, 150], [198, 118, 92], [236, 154, 106]];
const MILLIS_PER_SOL = 88775244;
const LANDED = Date.UTC(2012, 7, 6, 5, 17);

const SHARP_Z = -205, SHARP_H = 46;
/** The route the rover drives, as x for a given z: from the near foreground up to the middle of the view. */
const route = (z: number) => Math.sin(z * 0.042 + 0.8) * 15;

function height(x: number, z: number) {
  // Long dunes on a slant, with ripples on them.
  const along = x * 0.34 + z * 0.94;
  const dune = Math.abs(Math.sin(along * 0.052 + noise(x * 0.012, z * 0.012, 81) * 3)) * 4.8;
  return 2.4 + dune + noise(x * 0.06, z * 0.06, 82) * 3 + Math.sin(along * 0.9) * 0.14;
}

function sharp(x: number, z: number) {
  const r = Math.hypot((x + 50) * 0.8, z - SHARP_Z) / 130;
  if (r >= 1) return 0;
  // Steps, since it's built of layers that wore back at different rates.
  const rough = noise(x * 0.03, z * 0.03, 83);
  const raw = SHARP_H * (1 - r) ** 0.9 * (0.72 + rough * 0.5);
  return Math.round(raw / 3.2) * 3.2;
}

function ground(v: VoxelSet, step: number) {
  for (let x = -150; x < 150; x += step) {
    for (let z = 84; z > -38; z -= step) {
      const h = height(x, z);
      const crest = smoothstep(4.2, 7.2, h - 2.4);
      let c = sloped(mix(mix(RUST, RUST_DARK, noise(x * 0.14, z * 0.14, 84) * 0.6), BUTTER, crest * 0.75), height, x, z, 0.3);
      // Two wheel tracks along the route.
      const off = Math.abs(Math.abs(x - route(z)) - 3.1);
      if (off < 0.8 && z > 3) c = mix(c, TRACK, 0.85 * (Math.round(z * 1.4) % 2 ? 1 : 0.65));
      if (hash(Math.round(x), Math.round(z), 85) > 0.988) c = BASALT;
      v.column(x, z, h, -4, step, c, 0.05);
    }
  }
  const far = step * 2.8;
  for (let x = -320; x < 320; x += far) {
    for (let z = -38; z > -330; z -= far) {
      const s = sharp(x, z);
      const h = Math.max(s, height(x, z) + smoothstep(-200, -330, z) * 14 * noise(x * 0.01, 3, 86));
      const c = s > 4 ? STRATA[Math.abs(Math.round(s / 3.2)) % STRATA.length] : sloped(mix(mix(RUST, RUST_DARK, noise(x * 0.05, z * 0.05, 87) * 0.6), BUTTER, smoothstep(4.2, 7.2, height(x, z) - 2.4) * 0.6), height, x, z, 0.3);
      v.column(x, z, h, -4, far, c, 0.05);
    }
  }
}

function boulders(v: VoxelSet) {
  for (let i = 0; i < 80; i++) {
    const x = (hash(i, 1, 88) - 0.5) * 280, z = hash(i, 2, 88) * 118 - 36;
    if (Math.abs(x - route(z)) < 9) continue;
    const s = 0.7 + hash(i, 3, 88) ** 2 * 3.4;
    v.fill(x - s, height(x, z) - 0.4, z - s * 0.8, x + s, height(x, z) + s * 0.9, z + s * 0.8, mix(BASALT, RUST_DARK, hash(i, 4, 88) * 0.7), 0.75, 0.16);
  }
}

/** Curiosity: six wheels, a white body, the slanted power unit at the back, an arm, and a mast with its head. */
function rover() {
  const white: Rgb = [232, 226, 216], gold: Rgb = [214, 164, 76], metal: Rgb = [136, 134, 138], wheel: Rgb = [56, 54, 58];
  const body = new Group();
  const hull = new VoxelSet();
  hull.fill(-2.6, 2.3, -3.6, 2.6, 4.2, 3.4, (x, y, z) => (y > 3.7 && Math.abs(x) < 2 && z > -2 ? gold : white), 0.55, 0.05);
  hull.box(0, 4.45, -3.9, 4.2, 1.8, 1.2, [58, 58, 66]);
  for (let k = 0; k < 4; k++) hull.box(-2.2 + k * 1.46, 4.6, -4.9, 0.42, 2.4, 0.4, metal);
  // Rocker arms and the wheels they carry.
  const wheels: { x: number; z: number }[] = [];
  for (const side of [-1, 1]) {
    hull.box(side * 3.5, 2.4, 0, 0.45, 0.45, 7.6, metal);
    for (const z of [-3.4, 0, 3.4]) {
      wheels.push({ x: side * 3.8, z });
      hull.box(side * 3.5, 1.6, z, 0.45, 1.6, 0.45, metal);
    }
  }
  body.add(hull.mesh("lit", { cast: true }));
  const spinners: ReturnType<VoxelSet["mesh"]>[] = [];
  for (const w of wheels) {
    const set = new VoxelSet();
    set.box(0, 0, 0, 1.15, 1.75, 1.75, wheel);
    set.box(0.1, 0.6, 0, 1.2, 0.3, 0.3, metal);
    set.box(0.1, -0.6, 0, 1.2, 0.3, 0.3, metal);
    const mesh = set.mesh("lit", { cast: true });
    mesh.position.set(w.x, 0.95, w.z);
    body.add(mesh);
    spinners.push(mesh);
  }
  const armSet = new VoxelSet();
  armSet.box(1.5, 3, 4.3, 0.4, 0.4, 2.4, metal);
  armSet.box(1.5, 2.1, 5.5, 0.9, 1.2, 0.9, [150, 148, 150]);
  body.add(armSet.mesh("lit", { cast: true }));
  const mast = new Group();
  const pole = new VoxelSet();
  pole.box(0, 2.2, 0, 0.5, 4.4, 0.5, white);
  mast.add(pole.mesh("lit", { cast: true }));
  const headSet = new VoxelSet();
  headSet.box(0, 0, 0, 1.9, 1.05, 1, white);
  headSet.box(-0.5, 0.05, 0.55, 0.42, 0.42, 0.2, [24, 26, 40]);
  headSet.box(0.5, 0.05, 0.55, 0.42, 0.42, 0.2, [24, 26, 40]);
  const head = headSet.mesh("lit", { cast: true });
  head.position.y = 4.7;
  mast.add(head);
  mast.position.set(-1.4, 4.2, 2.2);
  body.add(mast);
  return { body, mast, spinners };
}

/** A single boxy little moon. */
function phobos() {
  const set = new VoxelSet();
  set.ball(0, 0, 0, 5, 1.1, (x, y, z) => mix([104, 92, 90], [70, 62, 64], noise(x * 3 + 2, y * 3 + z * 3, 89)), 0.1, 0.72);
  return set.mesh("glow");
}

export const galeCrater: Place = {
  id: "mars",
  name: "gale crater",
  world: "mars",
  coords: "4.59°s 137.44°e",
  build(coarse) {
    const scene = new Scene();
    scene.fog = new Fog(0xc89872, 120, 620);
    const sunDir = new Vector3(70, 13, -150);
    const sun = sunlight(0xffe8d0, 3.5, new Vector3(-92, 58, 46), 110, coarse);
    scene.add(sun, new HemisphereLight(0xc8d0e0, 0x804a30, 1.5));
    // Tan overhead, and the dust scatters blue round the low sun: the opposite of home.
    scene.add(skyDome([104, 72, 70], [176, 124, 96], [206, 160, 128], sunDir, [150, 196, 250], 34));
    const disc = new VoxelSet();
    disc.ball(0, 0, 0, 3, 1.5, () => [244, 250, 255], 0.01);
    const sunDisc = disc.mesh("glow");
    sunDisc.position.copy(sunDir).normalize().multiplyScalar(620);
    (sunDisc.material as MeshBasicMaterial).fog = false;
    scene.add(sunDisc);

    const land = new VoxelSet(), rocks = new VoxelSet();
    ground(land, coarse ? 1.5 : 1);
    boulders(rocks);
    scene.add(land.mesh("lit", { cast: true, receive: true }), rocks.mesh("lit", { cast: true, receive: true }));

    const { body, mast, spinners } = rover();
    scene.add(body);
    const moon = phobos();
    (moon.material as MeshBasicMaterial).fog = false;
    scene.add(moon);
    const spot = new Vector3();
    let selfieAt = -100;
    let driven = 0;

    const GRAINS = coarse ? 130 : 240;
    const grains = new Motes(GRAINS, (i) => mix(RUST, BUTTER, hash(i, 1, 90)));
    scene.add(grains.mesh);
    let live = GRAINS;

    return {
      scene,
      eye: new Vector3(-14, 34, 92),
      at: new Vector3(0, 16, -10),
      fov: 36,
      lens: { center: 0.32, band: 0.2, blur: 10 },
      sun,
      movingShadows: true,
      actor: spot,
      actorSize: 6,
      update(t, dt) {
        const since = t - selfieAt;
        const posing = since < 5;
        if (!posing) driven += dt;
        // Out along its tracks and back, as slowly as the real one.
        const swing = (driven % 180) / 90;
        const k = swing < 1 ? swing : 2 - swing;
        const z = 30 - k * 36;
        const x = route(z);
        const y = height(x, z) - 0.25;
        spot.set(x, y + 3, z);
        body.position.set(x, y, z);
        const ahead = route(z - 1) - x;
        const face = Math.atan2(ahead, -1) + (swing < 1 ? 0 : Math.PI);
        body.rotation.y = face;
        body.rotation.x = clamp((height(x, z - 3) - height(x, z + 3)) * 0.05, -0.16, 0.16);
        if (!posing) spinners.forEach((w) => { w.rotation.x -= dt * 0.8 * (swing < 1 ? 1 : -1); });
        // The mast looks about as it goes; asked for a selfie it turns round to the camera.
        const aim = posing ? -face + 0.1 : Math.sin(t * 0.35) * 0.9 + Math.sin(t * 0.13) * 0.5;
        mast.rotation.y += (aim - mast.rotation.y) * (1 - Math.exp(-dt * 2.6));

        // A dust devil out on the plain, wandering.
        const wx = Math.sin(t * 0.021) * 62 + 24, wz = -6 + Math.cos(t * 0.03) * 16;
        const devil = Math.floor(live * 0.58);
        for (let i = 0; i < live; i++) {
          if (i < devil) {
            const h = ((t * (3 + hash(i, 2, 90) * 3) + hash(i, 3, 90) * 40) % 40);
            const r = 0.7 + h * 0.16 + hash(i, 4, 90) * 0.8;
            const a = t * 3.2 + hash(i, 5, 90) * 6.28 + h * 0.2;
            grains.place(i, wx + Math.cos(a) * r + Math.sin(h * 0.1 + t * 0.3) * h * 0.06, height(wx, wz) + h, wz + Math.sin(a) * r, 0.5);
          } else {
            const wide = 200;
            const gx = ((hash(i, 6, 90) * wide + t * (3 + hash(i, 7, 90) * 5)) % wide) - wide / 2;
            const gz = hash(i, 8, 90) * 100 - 24;
            grains.place(i, gx, height(gx, gz) + 0.5 + hash(i, 9, 90) * 2.4 + Math.sin(t + i) * 0.3, gz, 0.26);
          }
        }
        grains.commit();

        // Phobos goes over every minute or so, the wrong way, as it does.
        const run = (t % 70) / 70;
        moon.position.set(-420 + run * 840, 250 + Math.sin(run * Math.PI) * 70, -640);
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
        grains.mesh.count = live;
      },
    };
  },
};
