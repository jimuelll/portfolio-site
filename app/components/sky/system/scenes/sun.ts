/*
 * The sun: there's no landing, so this is as near as anything has come. Parker Solar Probe, inside the corona at the end of
 * 2024, flying with its shield to the fire. The sun is brought much closer than the probe ever got, or it would be a mere
 * disc. Below, an active region: granules boiling, sunspots, spicules like burning grass, and plasma running along the
 * magnetic loops that stand over the spots, which is what the loops really are. Now and then a loop lets go. Tap the probe
 * and it folds its panels in behind the shield, as it does when the heat comes up.
 */

import { AmbientLight, Group, type MeshBasicMaterial, Scene, Vector3 } from "three";
import { hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import { VoxelSet } from "../voxels";
import { cells, flows, skyDome, sunlight, type Flow, type Place } from "./kit";

/** How sharply the surface curves away. Vast, but close enough to the camera that its limb still shows. */
const RADIUS = 2200;
const LANE: Rgb = [112, 28, 8], BODY: Rgb = [222, 84, 16], TOP: Rgb = [255, 158, 44], HOT: Rgb = [255, 216, 128];
const UMBRA: Rgb = [24, 8, 6], PENUMBRA: Rgb = [116, 44, 14];

const SPOTS = [
  { x: -96, z: -150, r: 22 }, { x: 62, z: -226, r: 27 }, { x: 22, z: -96, r: 11 }, { x: -22, z: -278, r: 14 }, { x: 176, z: -130, r: 15 }, { x: -210, z: -240, r: 18 },
];
/** Which spots are joined by loops, and how high those stand. */
const LOOPS: [number, number, number][] = [[0, 1, 118], [0, 2, 52], [2, 4, 84], [0, 3, 96], [1, 4, 92], [5, 0, 76], [3, 1, 58]];

const height = (x: number, z: number) => -(x * x + (z + 40) * (z + 40)) / (2 * RADIUS);

function surfaceColour(x: number, z: number): Rgb {
  const c = cells(x, z, 8.5, 142);
  // Hot gas rising in the middle of each cell, cooled and sinking in the dark lanes between.
  const rise = smoothstep(0, 0.34, c.edge) * (0.72 + hash(c.i, c.j, 143) * 0.28);
  const wide = cells(x, z, 90, 144);
  let k = rise * (0.72 + smoothstep(0, 0.2, wide.edge) * 0.28) * (0.82 + noise(x * 0.03, z * 0.03, 145) * 0.3);
  let colour = k < 0.5 ? mix(LANE, BODY, k * 2) : k < 0.85 ? mix(BODY, TOP, (k - 0.5) / 0.35) : mix(TOP, HOT, (k - 0.85) / 0.15);
  // A spot: a dark centre where the field holds the heat down, and a fringe of filaments combed outward from it.
  for (const s of SPOTS) {
    const d = Math.hypot(x - s.x, z - s.z), r = d / s.r;
    if (r > 1.5) continue;
    const combed = noise(Math.atan2(z - s.z, x - s.x) * 15, 2, 146);
    const penumbra = mix(PENUMBRA, BODY, combed * 0.8);
    colour = mix(colour, penumbra, smoothstep(1.28 + combed * 0.2, 1, r));
    colour = mix(colour, UMBRA, smoothstep(0.62, 0.42, r));
  }
  // Limb darkening: at a slant you see only the higher, cooler gas.
  k = 1 - Math.min(0.62, ((x * x + (z + 40) * (z + 40)) / (620 * 620)) * 0.62);
  return [colour[0] * k, colour[1] * k, colour[2] * k];
}

/** The photosphere, its cells set boiling in the shader, since the colour of a hundred thousand cubes can't be redone each frame. */
function surface(coarse: boolean) {
  const set = new VoxelSet();
  const near = coarse ? 2 : 1.4, mid = coarse ? 4 : 3, far = 7;
  const lay = (x: number, z: number, s: number) => {
    const h = height(x, z);
    set.column(x, z, h, h - 12, s, surfaceColour(x, z), 0.03);
  };
  for (let x = -170; x < 170; x += near) for (let z = -300; z < 10; z += near) lay(x, z, near);
  for (let x = -420; x < 420; x += mid) {
    for (let z = -470; z < 60; z += mid) {
      if (!(Math.abs(x) < 170 && z > -300 && z < 10)) lay(x, z, mid);
    }
  }
  for (let x = -840; x < 840; x += far) {
    for (let z = -720; z < -470; z += far) lay(x, z, far);
  }
  const mesh = set.mesh("glow");
  const material = mesh.material as MeshBasicMaterial;
  const time = { value: 0 };
  material.fog = false;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime;\nvarying float vBoil;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vec3 at = instanceMatrix[3].xyz;
      float boil = sin(at.x * 0.73 + uTime * 0.31 + sin(at.z * 0.41 + uTime * 0.13) * 2.6) * sin(at.z * 0.67 - uTime * 0.27 + sin(at.x * 0.37 - uTime * 0.11) * 2.6);
      vBoil = 0.9 + boil * 0.2 + 0.05 * sin(at.x * 0.06 + at.z * 0.05 + uTime * 0.09);`,
    );
    shader.fragmentShader = `varying float vBoil;\n${shader.fragmentShader}`.replace("#include <opaque_fragment>", "outgoingLight *= vBoil;\n#include <opaque_fragment>");
  };
  return { mesh, time };
}

/** Plasma, following the field from one foot to the other: each strand a parabola, since that's what a flow can draw. */
function loops(coarse: boolean) {
  const list: Flow[] = [];
  const scale = coarse ? 0.55 : 1;
  LOOPS.forEach(([from, to, tall], l) => {
    const a = SPOTS[from], b = SPOTS[to];
    const strands = 11 + Math.floor(hash(l, 1, 147) * 6);
    for (let s = 0; s < strands; s++) {
      // Each strand a little off its neighbours, lower ones hotter: the field's lines are nested like the ribs of a tunnel.
      const r = (i: number) => hash(l * 40 + s, i, 148);
      const spread = (s / strands - 0.5) * 2;
      const ax = a.x + spread * a.r * 0.5 + (r(1) - 0.5) * 3, az = a.z + (r(2) - 0.5) * a.r * 0.8;
      const bx = b.x + spread * b.r * 0.5 + (r(3) - 0.5) * 3, bz = b.z + (r(4) - 0.5) * b.r * 0.8;
      const ay = height(ax, az), by = height(bx, bz);
      const high = tall * (0.62 + (1 - Math.abs(spread)) * 0.38 + (r(5) - 0.5) * 0.14);
      const tone = r(6);
      const n = Math.round((120 + r(7) * 90) * scale);
      const rate = 0.05 + r(8) * 0.05;
      for (let i = 0; i < n; i++) {
        list.push({
          start: [ax, ay, az], drift: [bx - ax, by - ay + high * 4, bz - az], curve: [0, -high * 4, 0], size: 1 + hash(l * 40 + s, i, 149) * 1.5,
          colour: mix(mix([255, 232, 170], [255, 150, 56], tone), [255, 92, 42], hash(l * 40 + s, i, 150) * 0.5), alpha: 0.72, rate, phase: hash(l * 40 + s, i, 151), wobble: 0.45,
        });
      }
    }
  });
  // An eruption: the top of the tallest loop lets go every so often, a billow climbing straight out and thinning as it goes.
  const r = (i: number, s: number) => hash(i, s, 152);
  const top = SPOTS[1];
  for (let i = 0; i < 1500 * scale; i++) {
    const out = r(i, 1) * 6.283, wide = 50 + r(i, 2) * 210, up = 130 + r(i, 3) * 300;
    list.push({
      start: [top.x - 40 + (r(i, 4) - 0.5) * 70, 50 + r(i, 5) * 50, top.z + 20], drift: [Math.cos(out) * wide + 50, up, Math.sin(out) * wide * 0.5], size: 1.4 + r(i, 6) * 3.4, colour: mix([255, 236, 190], [255, 96, 44], r(i, 7)),
      alpha: 0.7, fade: 1.2, rate: 1 / 46, phase: 0.2 + r(i, 8) * 0.025, window: 0.26,
    });
  }
  return flows(list);
}

/** What stands out above the surface and is never in one place: spicules, the corona's streamers, and the wind. */
function spicules(coarse: boolean) {
  const list: Flow[] = [];
  const scale = coarse ? 0.5 : 1;
  const r = (i: number, s: number) => hash(i, s, 153);
  for (let i = 0; i < 5200 * scale; i++) {
    const x = (r(i, 1) - 0.5) * 460, z = 10 - r(i, 2) * 440, tall = 4 + r(i, 3) * 15;
    list.push({
      start: [x, height(x, z), z], drift: [(r(i, 4) - 0.5) * 4, tall * 4, (r(i, 5) - 0.5) * 4], curve: [0, -tall * 4, 0], size: 0.7 + r(i, 6) * 1.1, colour: mix([255, 186, 90], [255, 82, 30], r(i, 7)),
      alpha: 0.72, fade: 0.1, rate: 0.09 + r(i, 8) * 0.14, phase: r(i, 9),
    });
  }
  // The corona over the limb: pale, huge, and climbing outward too slowly to catch it at.
  for (let i = 0; i < 700 * scale; i++) {
    const lobe = Math.floor(r(i, 11) * 7), x = (hash(lobe, 1, 154) - 0.5) * 1100 + (r(i, 12) + r(i, 13) - 1) * 150;
    list.push({
      start: [x, -70, -560 + r(i, 14) * 60], drift: [x * 0.22, 300 + r(i, 15) * 340, -40], size: 16 + r(i, 16) * 36, colour: mix([255, 226, 186], [255, 160, 96], r(i, 17)), alpha: 0.075, fade: 1.3,
      rate: 0.008 + r(i, 18) * 0.014, phase: r(i, 19), wobble: 5,
    });
  }
  return flows(list);
}

/** The solar wind: going by the probe at speed, and straight out. These are the ones to lose first on a slow device. */
function wind(coarse: boolean) {
  const list: Flow[] = [];
  const r = (i: number, s: number) => hash(i, s, 155);
  for (let i = 0; i < (coarse ? 800 : 1800); i++) {
    const x = (r(i, 1) - 0.5) * 170 + 8, z = 72 - r(i, 2) * 190;
    list.push({
      start: [x, height(x, z) - 2, z], drift: [(r(i, 3) - 0.5) * 8, 110 + r(i, 4) * 80, 0], size: 0.16 + r(i, 5) * 0.26, colour: mix([255, 232, 196], [255, 186, 130], r(i, 6)), alpha: 0.62, fade: 0.8,
      rate: 0.22 + r(i, 7) * 0.32, phase: r(i, 8),
    });
  }
  return flows(list);
}

/** Parker: the white carbon shield, flat to the sun, the dark bus behind it on struts, the small slanted panels, and the antennae. */
function probe() {
  const white: Rgb = [246, 242, 234], dark: Rgb = [56, 54, 62], gold: Rgb = [226, 170, 76], metal: Rgb = [158, 158, 168], cell: Rgb = [30, 42, 96];
  const body = new Group();
  const set = new VoxelSet();
  const s = 0.22;
  // A hexagon, with its sun side burnt almost to a glow and its back in the shade it was built to make.
  for (let a = -18; a <= 18; a++) {
    for (let b = -18; b <= 18; b++) {
      const x = a * s, z = b * s;
      if (Math.max(Math.abs(z), Math.abs(z) * 0.5 + Math.abs(x) * 0.866) > 3.7) continue;
      set.box(x, -0.2, z, s, 0.2, s, [255, 226, 176]);
      set.box(x, 0, z, s, 0.2, s, mix(white, [188, 186, 184], noise(a * 0.4, b * 0.4, 156) * 0.5));
    }
  }
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) set.box(x, 0.8, z, 0.13, 1.5, 0.13, metal);
  set.fill(-1.45, 1.5, -1.45, 1.45, 3.1, 1.45, (x, y, z) => (Math.round(x * 3 + y * 2 + z) % 5 === 0 ? [186, 132, 56] : gold), 0.2, 0.08);
  set.fill(-0.95, 3.1, -0.95, 0.95, 3.5, 0.95, dark, 0.18, 0.06);
  // The boom that keeps the magnetometers away from the rest of it, and four thin aerials that stick out past the shield.
  set.box(0, 5.5, 0, 0.1, 4.2, 0.1, metal);
  for (const y of [5, 6.4, 7.5]) set.box(0, y, 0, 0.3, 0.14, 0.3, white);
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) set.box(x * 3.6, 0.12, z * 3.6, x ? 3 : 0.07, 0.07, z ? 3 : 0.07, [226, 214, 200]);
  body.add(set.mesh("lit"));
  const wings = [-1, 1].map((side) => {
    const wing = new Group();
    const panel = new VoxelSet();
    panel.box((side * 0.7) / 2, 0, 0, 0.7, 0.1, 0.1, metal);
    for (let a = 0; a < 8; a++) for (let b = -3; b <= 3; b++) panel.box(side * (0.8 + a * 0.26), 0, b * 0.28, 0.25, 0.08, 0.26, (a + b) % 4 === 0 ? [62, 78, 150] : cell);
    wing.add(panel.mesh("lit"));
    wing.position.set(side * 1.45, 2.4, 0);
    body.add(wing);
    return { wing, side };
  });
  return { body, wings };
}

export const corona: Place = {
  id: "sun",
  name: "the corona",
  world: "the sun",
  coords: "parker solar probe · december 2024",
  build(coarse) {
    const scene = new Scene();
    // Light from below, the only direction there is. Nothing here can throw a shadow on the sun.
    const sun = sunlight(0xffc486, 3.6, new Vector3(10, -120, 24), 40, coarse);
    sun.castShadow = false;
    scene.add(sun, new AmbientLight(0xffd2aa, 3.6));
    scene.add(skyDome([8, 5, 10], [40, 18, 18], [150, 66, 26], new Vector3(0, -1, 0), [150, 66, 26], 2));

    const fire = surface(coarse);
    const arcs = loops(coarse);
    const flecks = spicules(coarse);
    const stream = wind(coarse);
    scene.add(fire.mesh, flecks.mesh, arcs.mesh, stream.mesh);

    const { body, wings } = probe();
    scene.add(body);
    const spot = new Vector3();
    let pokedAt = -100;

    return {
      scene,
      eye: new Vector3(-18, 46, 92),
      at: new Vector3(4, 38, -40),
      fov: 42,
      lens: { center: 0.36, band: 0.3, blur: 5 },
      cell: 0.72,
      pullback: 0.72,
      ground: height,
      sun,
      actor: spot,
      actorSize: 6,
      update(t) {
        fire.time.value = t;
        arcs.tick(t);
        flecks.tick(t);
        stream.tick(t);
        // At this speed there's nothing to steer by, so it drifts a touch and shudders a little in the wind.
        spot.set(3 + Math.sin(t * 0.09) * 2.6, 32 + Math.sin(t * 0.13) * 0.9, 22 + Math.cos(t * 0.07) * 1.6);
        body.position.copy(spot);
        body.scale.setScalar(1.35);
        body.rotation.set(0.46 + Math.sin(t * 0.21) * 0.012, 0.5 + t * 0.016, -0.14 + Math.sin(t * 0.17) * 0.012);
        const since = t - pokedAt;
        const tucked = smoothstep(0, 1.6, since) * (1 - smoothstep(5.6, 7.4, since));
        for (const { wing, side } of wings) wing.rotation.z = side * (0.42 - tucked * 1.52);
      },
      poke(t) {
        pokedAt = t;
        return "692,000 km/h · 1,400°c on the shield · 30°c behind it";
      },
      thin(share) {
        const { geometry } = stream.mesh;
        geometry.setDrawRange(0, Math.round(geometry.getAttribute("position").count * share));
      },
    };
  },
};
