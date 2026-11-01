/*
 * Mercury: Prokofiev crater at the north pole, from up on its rim. The sun never climbs far here, only rolls round the
 * horizon, swollen to three times the size we know it (and more again, so it reads). Its light rakes the rim and never once
 * gets down into the bowl, where some of the coldest ground in the inner solar system keeps a floor of water ice, on a planet
 * whose noon would melt lead. Nobody has landed on Mercury, so the rover is a guess, sheltering under the ceramic cloth
 * that got MESSENGER through. Tap it and it lights up the ice.
 */

import { AmbientLight, Group, type MeshBasicMaterial, Scene, SpotLight, Vector3 } from "three";
import { hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import { VoxelSet } from "../voxels";
import { stars } from "./moon";
import { craterFile, flows, sloped, sunlight, type Flow, type Place } from "./kit";

const ROCK: Rgb = [150, 138, 124], ROCK_DARK: Rgb = [88, 80, 76], HOLLOW: Rgb = [206, 212, 216], ICE: Rgb = [206, 232, 255], ICE_DUSTY: Rgb = [138, 158, 186];
/** Barely over the horizon: the pole's sun at its highest. */
const SUN = new Vector3(-26, 26, -330);
const DISC = 46;

const BOWL_Z = -92, BOWL_R = 70, DEPTH = 30;
const bowl = (x: number, z: number) => Math.hypot(x, z - BOWL_Z) / BOWL_R;

const CRATERS: number[][] = [];
for (let i = 0; i < 90; i++) {
  const x = (hash(i, 1, 110) - 0.5) * 340, z = 60 - hash(i, 2, 110) * 300;
  CRATERS.push([x, z, 1 + hash(i, 3, 110) ** 2.4 * 8]);
}

const cratersNear = craterFile(CRATERS);

function height(x: number, z: number) {
  let h = 14 + noise(x * 0.03, z * 0.03, 111) * 2.2 + noise(x * 0.14, z * 0.14, 112) * 0.6 + noise(x * 0.6, z * 0.6, 113) * 0.14;
  const near = cratersNear(x, z);
  if (near) for (const [cx, cz, r] of near) {
    const d = Math.hypot(x - cx, z - cz) / r;
    if (d < 1) h -= (1 - d * d) * r * 0.26;
    else if (d < 1.5) h += (1 - (d - 1) / 0.5) ** 2 * r * 0.08;
  }
  const d = bowl(x, z);
  if (d < 1) {
    // Slumped terraces down the wall, then a floor filled nearly flat.
    const wall = smoothstep(0.42, 1, d);
    const raw = wall * DEPTH;
    const stepped = raw + (Math.round(raw / 5) * 5 - raw) * smoothstep(0.5, 0.62, d) * 0.7;
    return h * 0.25 + 10.5 - DEPTH + stepped + 5;
  }
  // The outside of the rim falls so gently that the low sun can still reach it.
  return h + 5 * Math.max(0, 1 - (d - 1) / 1.3) ** 2;
}

/** Where ice lies: most of the floor, patchy toward the wall, and dusted over in places. */
const iceOn = (x: number, z: number) => {
  const d = bowl(x, z);
  return smoothstep(0.62, 0.42, d + (noise(x * 0.07, z * 0.07, 114) - 0.5) * 0.24);
};

function groundColour(x: number, z: number): Rgb {
  const ice = iceOn(x, z);
  if (ice > 0.02) return mix(mix(ROCK_DARK, ICE_DUSTY, 0.4), mix(ICE, ICE_DUSTY, noise(x * 0.24, z * 0.24, 115)), ice);
  const c = mix(mix(ROCK, ROCK_DARK, noise(x * 0.09 + 4, z * 0.09, 116)), [62, 56, 56], hash(Math.round(x * 3), Math.round(z * 3), 117) ** 5 * 0.8);
  // Hollows: bright, blue-white pits found nowhere else, where something in the rock is boiling away.
  return noise(x * 0.11 + 8, z * 0.11, 118) > 0.76 ? mix(c, HOLLOW, 0.75) : c;
}

function ground(v: VoxelSet, coarse: boolean) {
  const fine = coarse ? 0.8 : 0.5, mid = coarse ? 1.7 : 1.3, far = 4;
  for (let x = -50; x < 50; x += fine) {
    for (let z = -70; z < 24; z += fine) {
      const h = height(x, z);
      v.column(x, z, h, h - 8, fine, sloped(groundColour(x, z), height, x, z, 0.2), 0.07);
    }
  }
  for (let x = -190; x < 190; x += mid) {
    for (let z = -220; z < 60; z += mid) {
      if (Math.abs(x) < 50 && z > -70 && z < 24) continue;
      const h = height(x, z);
      v.column(x, z, h, h - 14, mid, sloped(groundColour(x, z), height, x, z, 0.2), 0.07);
    }
  }
  for (let x = -560; x < 560; x += far) {
    for (let z = -560; z < -220; z += far) {
      const h = height(x, z);
      v.column(x, z, h, h - 14, far, sloped(mix(ROCK, ROCK_DARK, noise(x * 0.03, z * 0.03, 119)), height, x, z, 0.12), 0.06);
    }
  }
}

/** Six wheels, a low white body, a mast with a lamp, and the sunshade held always toward the sun. */
function rover() {
  const white: Rgb = [226, 224, 216], dark: Rgb = [44, 44, 52], metal: Rgb = [140, 140, 148], cloth: Rgb = [244, 240, 226];
  const body = new Group();
  const hull = new VoxelSet();
  hull.fill(-1.2, 0.7, -1.7, 1.2, 1.6, 1.7, white, 0.2, 0.04);
  for (const side of [-1, 1]) {
    for (const z of [-1.4, 0, 1.4]) hull.fill(side * 1.5 - 0.22, 0, z - 0.42, side * 1.5 + 0.22, 0.84, z + 0.42, dark, 0.14, 0.06);
    hull.box(side * 1.28, 0.85, 0, 0.14, 0.14, 3, metal);
  }
  body.add(hull.mesh("lit", { cast: true }));

  const shade = new Group();
  const shadeSet = new VoxelSet();
  shadeSet.box(0, 2.3, 0, 0.14, 1.6, 0.14, metal);
  for (let a = -9; a <= 9; a++) {
    for (let b = -7; b <= 7; b++) shadeSet.box(a * 0.2, 3.2 + b * 0.17, -1 - b * 0.08, 0.2, 0.2, 0.1, (a + b) % 6 === 0 ? [206, 200, 184] : cloth);
  }
  shade.add(shadeSet.mesh("lit", { cast: true }));
  body.add(shade);

  const mast = new Group();
  const mastSet = new VoxelSet();
  mastSet.box(0, 0.8, 0, 0.14, 1.6, 0.14, metal);
  mastSet.box(0, 1.65, 0, 0.56, 0.3, 0.3, white);
  mastSet.box(0, 1.65, -0.2, 0.3, 0.2, 0.12, [255, 250, 226]);
  mast.add(mastSet.mesh("lit", { cast: true }));
  mast.position.set(0.7, 1.6, 1.2);
  body.add(mast);
  return { body, shade, mast };
}

/** The sun: a boiling disc, too big for the sky it's in, with nothing in the way of its corona. */
function theSun() {
  const toward = SUN.clone().normalize();
  const at = toward.clone().multiplyScalar(820);
  const out = toward.clone().negate();
  const across = new Vector3(0, 1, 0).cross(toward).normalize();
  const up = toward.clone().cross(across).normalize();
  const set = new VoxelSet();
  set.ball(0, 0, 0, DISC / 3.2, 3.2, (x, y, z) => {
    const facing = Math.max(0, x * out.x + y * out.y + z * out.z);
    return mix(mix([255, 236, 190], [255, 196, 118], noise(x * 4 + 3, y * 4 + z * 4, 120)), [255, 134, 52], (1 - facing) ** 2.4);
  }, 0.03);
  const disc = set.mesh("glow");
  disc.position.copy(at);
  (disc.material as MeshBasicMaterial).fog = false;

  const list: Flow[] = [];
  const r = (i: number, s: number) => hash(i, s, 121);
  const place = (a: number, far: number): [number, number, number] => [
    at.x + (across.x * Math.cos(a) + up.x * Math.sin(a)) * far,
    at.y + (across.y * Math.cos(a) + up.y * Math.sin(a)) * far,
    at.z + (across.z * Math.cos(a) + up.z * Math.sin(a)) * far,
  ];
  // Long pale streamers in a few favoured directions, as in an eclipse, except that here there's no sky to hide them.
  for (let i = 0; i < 2200; i++) {
    const lobe = Math.floor(r(i, 1) * 6), a = hash(lobe, 2, 121) * 6.283 + (r(i, 2) + r(i, 3) - 1) * 0.5;
    const from = place(a, DISC * 0.96), to = place(a, DISC * (1.5 + r(i, 4) ** 2 * 3.4));
    list.push({
      start: from, drift: [to[0] - from[0], to[1] - from[1], to[2] - from[2]], size: 2.4 + r(i, 5) * 5, colour: mix([255, 232, 196], [255, 176, 112], r(i, 6)), alpha: 0.5, fade: 1.3,
      rate: 0.012 + r(i, 7) * 0.03, phase: r(i, 8), wobble: 2,
    });
  }
  // Loops standing on the limb, their plasma running along the magnetic field from one foot to the other.
  for (let l = 0; l < 7; l++) {
    const a = hash(l, 3, 121) * 6.283, span = 0.09 + hash(l, 4, 121) * 0.16, tall = 5 + hash(l, 5, 121) * 15;
    const from = place(a - span, DISC * 0.98), to = place(a + span, DISC * 0.98);
    const lift = place(a, 1);
    const ux = lift[0] - at.x, uy = lift[1] - at.y, uz = lift[2] - at.z;
    for (let i = 0; i < 90; i++) {
      list.push({
        start: from, drift: [to[0] - from[0] + ux * tall * 4, to[1] - from[1] + uy * tall * 4, to[2] - from[2] + uz * tall * 4], curve: [-ux * tall * 4, -uy * tall * 4, -uz * tall * 4],
        size: 1.8 + r(l * 100 + i, 9) * 1.6, colour: mix([255, 216, 150], [255, 96, 52], r(l * 100 + i, 10)), alpha: 0.9, rate: 0.05 + r(l * 100 + i, 11) * 0.03, phase: r(l * 100 + i, 12), wobble: 0.5,
      });
    }
  }
  // Glare: the air doesn't make it, the lens does.
  for (let i = 0; i < 14; i++) list.push({ start: [at.x, at.y, at.z], drift: [0, 0, 0], size: 100 + (i / 14) ** 2 * 460, colour: mix([255, 226, 180], [255, 130, 60], i / 14), alpha: 0.13 * (1 - i / 15), rate: 0, phase: 0.2 });
  return { disc, glow: flows(list) };
}

function bright(coarse: boolean) {
  const list: Flow[] = [];
  const r = (i: number, s: number) => hash(i, s, 122);
  // The little that's in the bowl to catch the eye: frost, glinting by the light of the stars and the lit rim far above.
  for (let i = 0; i < (coarse ? 260 : 620); i++) {
    const a = r(i, 1) * 6.283, d = Math.sqrt(r(i, 2)) * 0.5, x = Math.cos(a) * d * BOWL_R, z = BOWL_Z + Math.sin(a) * d * BOWL_R;
    list.push({ start: [x, height(x, z) + 0.4, z], drift: [0, 0, 0], size: 0.25 + r(i, 3) * 0.5, colour: [186, 222, 255], alpha: 0.3 + r(i, 4) * 0.6, rate: 0, phase: r(i, 5), twinkle: 2.8 });
  }
  // Grains knocked loose by micrometeorites, thrown up in slow arcs. With no air, nothing stops it, and nothing slows them.
  for (let site = 0; site < 7; site++) {
    const a = hash(site, 6, 122) * 6.283, d = 1.12 + hash(site, 7, 122) * 0.6;
    const x = Math.cos(a) * d * BOWL_R, z = BOWL_Z + Math.sin(a) * d * BOWL_R, g = height(x, z);
    const period = 9 + hash(site, 8, 122) * 14;
    for (let i = 0; i < 26; i++) {
      const o = r(site * 40 + i, 9) * 6.283, reach = 1 + r(site * 40 + i, 10) * 5, up = 2 + r(site * 40 + i, 11) * 6;
      list.push({
        start: [x, g + 0.2, z], drift: [Math.cos(o) * reach, up * 4, Math.sin(o) * reach], curve: [0, -up * 4, 0], size: 0.22 + r(site * 40 + i, 12) * 0.24, colour: i < 4 ? [255, 244, 214] : [206, 196, 182],
        alpha: 0.95, fade: 0.2, rate: 1 / period, phase: hash(site, 9, 122), window: 0.14,
      });
    }
  }
  return flows(list);
}

/** Sodium, knocked off the ground by sunlight and the wind off the sun: the thin yellow breath Mercury has instead of air. */
function breath(coarse: boolean) {
  const list: Flow[] = [];
  const r = (i: number, s: number) => hash(i, s, 123);
  for (let i = 0; i < (coarse ? 450 : 1000); i++) {
    const x = (r(i, 1) - 0.5) * 240, z = 20 - r(i, 2) * 240;
    if (bowl(x, z) < 1) continue;
    list.push({
      start: [x, height(x, z) + 0.2, z], drift: [(r(i, 3) - 0.5) * 3 + 2, 7 + r(i, 4) * 13, 4 + r(i, 5) * 4], size: 0.16 + r(i, 6) * 0.2, colour: mix([255, 220, 130], [255, 186, 92], r(i, 7)),
      alpha: 0.5, fade: 0.8, rate: 0.03 + r(i, 8) * 0.06, phase: r(i, 9), wobble: 0.4,
    });
  }
  return flows(list);
}

export const prokofiev: Place = {
  id: "mercury",
  name: "prokofiev crater",
  world: "mercury",
  coords: "85.8°n · the north pole",
  build(coarse) {
    const scene = new Scene();
    // Strong, since flat ground takes so little of a light this low; the faces it hits square all look away from the camera.
    const sun = sunlight(0xfff4e2, 19, SUN, 175, coarse);
    scene.add(sun, new AmbientLight(0x7c94c8, 0.62));

    const land = new VoxelSet();
    ground(land, coarse);
    scene.add(land.mesh("lit", { cast: true, receive: true }));

    const sky = stars(coarse ? 1100 : 2400);
    // Home and its neighbour, the two brightest stars out here: never far from the sun, seen from the inside of their orbits.
    const planets = flows([
      { start: [-300, 134, -780], drift: [0, 0, 0], size: 5, colour: [255, 246, 226], alpha: 1.4, rate: 0, phase: 0.2, twinkle: 0.4 },
      { start: [214, 112, -800], drift: [0, 0, 0], size: 4, colour: [150, 196, 255], alpha: 1.4, rate: 0, phase: 0.2, twinkle: 0.4 },
    ]);
    const star = theSun();
    const specks = bright(coarse);
    const air = breath(coarse);
    scene.add(sky.mesh, planets.mesh, star.disc, star.glow.mesh, specks.mesh, air.mesh);

    const { body, shade, mast } = rover();
    scene.add(body);
    // There's no air to show a beam, only the pool of light where it lands.
    const lamp = new SpotLight(0xe6f2ff, 0, 0, 0.17, 1, 0);
    lamp.target.position.set(4, 0, BOWL_Z + 12);
    scene.add(lamp, lamp.target);

    const spot = new Vector3();
    let lookedAt = -100;
    let driven = 0;

    return {
      scene,
      eye: new Vector3(13, 41, 15),
      at: new Vector3(-2, 21, -74),
      fov: 46,
      lens: { center: 0.48, band: 0.3, blur: 5 },
      cell: 0.72,
      pullback: 0.5,
      ground: height,
      sun,
      movingShadows: true,
      shadowEvery: 20,
      actor: spot,
      actorSize: 3.5,
      update(t, dt) {
        sky.tick(t);
        planets.tick(t);
        star.glow.tick(t);
        specks.tick(t);
        air.tick(t);
        star.disc.rotation.y = t * 0.01;

        const since = t - lookedAt;
        const looking = since < 9;
        if (!looking) driven += dt;
        // Back and forth along the rim, on the lit side of the line where the shadow starts.
        const a = 0.12 + Math.sin(driven * 0.018) * 0.2;
        const round = BOWL_R * 1.02;
        const x = Math.sin(a) * round, z = BOWL_Z + Math.cos(a) * round, y = height(x, z);
        body.position.set(x, y - 0.1, z);
        spot.set(x, y + 1.6, z);
        const face = a + Math.PI / 2 + (Math.cos(driven * 0.018) > 0 ? 0 : Math.PI);
        body.rotation.y = face;
        shade.rotation.y = -face;
        // It looks about as it goes, and down into the bowl when asked.
        const aim = looking ? -face + Math.PI - a * 0.6 : Math.sin(t * 0.3) * 0.9 + Math.sin(t * 0.11) * 0.5;
        mast.rotation.y += (aim - mast.rotation.y) * (1 - Math.exp(-dt * 2.2));
        lamp.position.set(x, y + 4, z);
        lamp.intensity = 2.6 * smoothstep(0.5, 1.2, since) * (1 - smoothstep(7.6, 9, since));
      },
      poke(t) {
        lookedAt = t;
        return "water ice · the sun has never reached it";
      },
      thin(share) {
        const { geometry } = air.mesh;
        geometry.setDrawRange(0, Math.round(geometry.getAttribute("position").count * share));
      },
    };
  },
};
