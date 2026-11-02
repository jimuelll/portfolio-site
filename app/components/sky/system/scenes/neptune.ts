/*
 * Neptune: the blue of methane, and the fastest winds anywhere, 2,000 km/h, on the least sunlight. Long white streaks of cirrus
 * fly high over the deck, each with its shadow keeping pace on the clouds below, just as Voyager 2 saw them in 1989. A dark spot
 * the size of Earth goes by with a bright cloud riding on it. Thin ringlets stand overhead, clumped into arcs nobody has fully
 * explained, and Triton is a pale pink dot going round the wrong way. Voyager's the speck; it's been the only visitor.
 */

import { AmbientLight, DirectionalLight, Group, Scene, Vector3 } from "three";
import { hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import { VoxelSet } from "../voxels";
import { stars } from "./moon";
import { cloudDeck, thinRings, wrapped } from "./giants";
import { flows, skyDome, type Flow, type Place } from "./kit";

const R = 1200;
const WRAP = 520;
const LATITUDE = 0.98;
const DEEP: Rgb = [20, 62, 170], BLUE: Rgb = [46, 104, 226], PALE: Rgb = [108, 170, 244];

/** Voyager, either of them, for the two worlds only it has seen: the big white dish, the ten-sided bus, and its long booms. */
export function voyager() {
  const body = new Group();
  const set = new VoxelSet();
  const white: Rgb = [240, 240, 234], gold: Rgb = [226, 176, 88], metal: Rgb = [150, 152, 160], dark: Rgb = [40, 40, 46];
  for (let a = -11; a <= 11; a++) {
    for (let b = -11; b <= 11; b++) {
      const d2 = a * a + b * b;
      if (d2 <= 121) set.box(a * 0.16, 1.5 - d2 * 0.003 + (121 - d2) * -0.002, b * 0.16, 0.16, 0.08, 0.16, d2 > 110 ? metal : white);
    }
  }
  set.fill(-0.8, 0, -0.8, 0.8, 0.9, 0.8, (x, _y, z) => (Math.round((x + z) * 4) % 3 ? gold : dark), 0.14, 0.05);
  set.box(0, 0.9, 0, 0.2, 0.7, 0.2, metal);
  // The science boom with its cameras, the RTGs on theirs, and the magnetometer's very long thin one.
  for (let k = 0; k < 16; k++) set.box(0.9 + k * 0.16, 0.4, 0, 0.16, 0.06, 0.06, metal);
  set.fill(3.1, 0.1, -0.3, 3.8, 0.7, 0.3, [226, 226, 220], 0.12, 0.04);
  for (let k = 0; k < 16; k++) set.box(-0.9 - k * 0.16, 0.2, 0, 0.16, 0.06, 0.06, metal);
  set.fill(-3.4, 0, -0.26, -2.4, 0.44, 0.26, dark, 0.12, 0.04);
  for (let k = 0; k < 60; k++) set.box(0, 0.5, 0.9 + k * 0.13, 0.04, 0.04, 0.13, [204, 204, 210]);
  body.add(set.mesh("lit"));
  return body;
}

/** The cirrus, laid out by hand rather than from noise, which breaks up at this thinness: lanes along the wind, a couple of tapered wisps to a lane, gathered into bands. */
const LANE = 3.4;
function streak(x: number, z: number) {
  const lane = Math.floor(z / LANE);
  if (noise(z * 0.022 + 7, 3, 320) < 0.5) return 0;
  const across = Math.abs(z / LANE - lane - 0.5) * 2;
  let k = 0;
  for (let n = 0; n < 2; n++) {
    if (hash(lane, n, 321) > 0.5) continue;
    const away = Math.abs(x - (hash(lane, n, 322) * 2 - 1) * WRAP), dx = Math.min(away, WRAP * 2 - away) / (40 + hash(lane, n, 323) * 150);
    if (dx < 1) k = Math.max(k, (1 - dx * dx) * (across < 0.34 + (1 - dx) * 0.3 ? 1 : 0));
  }
  return k;
}

export const neptuneTops: Place = {
  id: "neptune",
  name: "the methane tops",
  world: "neptune",
  coords: "2,000 km/h · 4.5 billion km out",
  build(coarse) {
    const scene = new Scene();
    const sun = new DirectionalLight(0xf0f4ff, 1.5);
    sun.position.set(-90, 70, 90);
    scene.add(sun, new AmbientLight(0x6c9ae8, 1.2));
    const sunward = new Vector3(-0.8, 0.18, -0.56);
    scene.add(skyDome([4, 8, 30], [14, 42, 120], [76, 136, 226], sunward, [204, 226, 255], 90));

    const sky = stars(coarse ? 900 : 1900);
    scene.add(sky.mesh);

    const SPOT_X = 90, SPOT_Z = -92;
    const lowRows = [
      { fromZ: -130, toZ: 66, step: coarse ? 3.6 : 2.5, halfX: WRAP },
      { fromZ: -520, toZ: -130, step: coarse ? 7.5 : 5.2, halfX: WRAP },
    ];
    const deck = cloudDeck({
      R, wrap: WRAP, lift: 0, rows: lowRows,
      wind: "26.0",
      rise: (x, z) => wrapped(x, z, WRAP, 11, 322) * 6 + wrapped(x, z * 2, WRAP, 30, 323) * 2,
      paint: (x, z) => {
        const band = 0.5 + 0.5 * Math.sin(z * 0.034 + wrapped(x, z, WRAP, 4, 324) * 3.4);
        let c = mix(DEEP, BLUE, band * 0.75 + wrapped(x, z * 2, WRAP, 22, 325) * 0.25);
        // The dark spot, an oval hole down into the deeper blue, and the bright cloud that rides its southern edge.
        const dx = Math.min(Math.abs(x - SPOT_X), WRAP * 2 - Math.abs(x - SPOT_X));
        const d = Math.hypot(dx / 100, (z - SPOT_Z) / 34);
        if (d < 1.3) c = mix(c, [8, 26, 96], smoothstep(1.2, 0.8, d));
        if (d > 0.9 && d < 1.3 && z > SPOT_Z) c = mix(c, [240, 246, 255], smoothstep(0.1, 0.5, wrapped(x, z, WRAP, 40, 326)) * smoothstep(1.3, 1.05, d));
        return c;
      },
    });
    // The cirrus, going faster than the deck, and on the deck under it, keeping pace, its shadow. It's the one thing here that
    // shows you how high they are.
    const OFFSET = 26;
    const rowsHigh = [
      { fromZ: -130, toZ: 66, step: coarse ? 2.2 : 1.5, halfX: WRAP },
      { fromZ: -520, toZ: -130, step: coarse ? 5 : 3.4, halfX: WRAP },
    ];
    const cirrus = cloudDeck({
      R, wrap: WRAP, lift: 24, rows: rowsHigh, wind: "44.0",
      rise: () => 0,
      paint: (x, z) => {
        const k = streak(x, z);
        return k > 0.12 ? mix([110, 164, 236], [226, 238, 252], k) : null;
      },
    });
    const shadows = cloudDeck({
      R, wrap: WRAP, lift: 9.5, rows: rowsHigh, wind: "44.0",
      rise: () => 0,
      paint: (x, z) => (streak(x - OFFSET, z - 6) > 0.12 ? [10, 34, 110] : null),
    });
    scene.add(deck.mesh, shadows.mesh, cirrus.mesh);

    const rings = thinRings([
      { radius: 1.71, size: 7, colour: [120, 150, 200], alpha: 0.4 },
      { radius: 2.15, size: 8, colour: [150, 176, 214], alpha: 0.5 },
      { radius: 2.55, size: 9, colour: [190, 210, 236], alpha: 0.6, clumps: 9 },
    ], R * 0.62, LATITUDE, coarse);
    scene.add(rings.mesh);

    const list: Flow[] = [];
    const r = (i: number, s: number) => hash(i, s, 327);
    // The sun, here only the brightest star; Triton, pink; and ice glinting as it falls away out of the haze.
    list.push({ start: [sunward.x * 800, sunward.y * 800, sunward.z * 800], drift: [0, 0, 0], size: 12, colour: [255, 255, 250], alpha: 1.5, rate: 0, phase: 0.2 });
    for (let i = 0; i < 10; i++) list.push({ start: [sunward.x * 800, sunward.y * 800, sunward.z * 800], drift: [0, 0, 0], size: 26 + i * 16, colour: [190, 216, 255], alpha: 0.09, rate: 0, phase: 0.2 });
    list.push({ start: [330, 196, -780], drift: [0, 0, 0], size: 9, colour: [250, 216, 214], alpha: 1.3, rate: 0, phase: 0.2 });
    for (let i = 0; i < (coarse ? 260 : 620); i++) {
      const x = (r(i, 1) - 0.5) * 260, z = 36 - r(i, 2) * 150;
      list.push({ start: [x - 40, 44 + r(i, 3) * 26, z], drift: [110, -48, 0], size: 0.16 + r(i, 4) * 0.22, colour: mix(PALE, [240, 248, 255], r(i, 5)), alpha: 0.62, fade: 0.5, rate: 0.26 + r(i, 6) * 0.4, phase: r(i, 7), twinkle: 2.4 });
    }
    const glints = flows(list);
    scene.add(glints.mesh);

    const probe = voyager();
    probe.scale.setScalar(0.85);
    scene.add(probe);
    const spot = new Vector3();
    let calledAt = -100;

    return {
      scene,
      eye: new Vector3(-6, 72, 44),
      at: new Vector3(8, 40, -80),
      fov: 46,
      lens: { center: 0.44, band: 0.4, blur: 4 },
      cell: 0.72,
      pullback: 0.5,
      ground: (x, z) => -(x * x + z * z) / (2 * R),
      sun,
      actor: spot,
      actorSize: 5,
      update(t, dt) {
        sky.tick(t);
        deck.time.value = cirrus.time.value = shadows.time.value = t;
        rings.tick(t);
        glints.tick(t);
        spot.set(-22 + Math.sin(t * 0.04) * 11, 57 + Math.sin(t * 0.07) * 2, -30);
        probe.position.copy(spot);
        // Dish homeward when it's called: 4 hours for the answer to get there, and it doesn't wait.
        const homing = t - calledAt < 8;
        const k = 1 - Math.exp(-dt * 1.6);
        probe.rotation.x += ((homing ? 1.15 : 0.5 + Math.sin(t * 0.08) * 0.2) - probe.rotation.x) * k;
        probe.rotation.y += ((homing ? 2.6 : 0.6 + Math.sin(t * 0.05) * 0.4) - probe.rotation.y) * k;
      },
      poke(t) {
        calledAt = t;
        return "voyager 2 · 1989 · nobody's been back";
      },
      thin(share) {
        const { geometry } = glints.mesh;
        geometry.setDrawRange(0, Math.round(geometry.getAttribute("position").count * share));
      },
    };
  },
};
