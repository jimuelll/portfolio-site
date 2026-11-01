/*
 * Saturn itself: no ground, so you hang over the ammonia clouds at 42° north, with the rings standing up out of the haze
 * in one vast arch across the southern sky, which is exactly where they'd be. The bands of cloud slide past each other at
 * their different speeds, storms flicker from inside, and the rings throw their shadow on the far clouds toward the
 * equator. Now and then a spark comes down the sky: Cassini, which ended here on 15 September 2017, on purpose, and kept
 * sending until the air tore it apart. Tap it.
 */

import { AmbientLight, DirectionalLight, Fog, Group, type MeshBasicMaterial, Scene, Vector3 } from "three";
import { hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import { Motes, VoxelSet } from "../voxels";
import { stars } from "./moon";
import { flows, skyDome, type Flow, type Place } from "./kit";

/** The rings, in Saturn radii: the C ring, the B ring, the Cassini Division, the A ring and the Encke Gap, then the thin F ring. */
export const C_FROM = 1.24, B_FROM = 1.53, B_TO = 1.95, A_FROM = 2.03, ENCKE = 2.214, A_TO = 2.27, F_RING = 2.33;

const inRange = (a: number, b: number, r: number) => r >= a && r <= b;

/** What each part of the rings is made of at a radius: how bright, and how much of it there is to see through. */
export function ringAt(r: number, x: number, z: number): { c: Rgb; fill: number } | null {
  const fine = noise(r * 26, 2, 172);
  if (inRange(C_FROM, B_FROM, r)) return { c: mix([92, 84, 74], [136, 124, 108], fine), fill: 0.34 + fine * 0.3 };
  if (inRange(B_FROM, B_TO, r)) return { c: mix([212, 192, 158], [250, 236, 206], fine), fill: 1 };
  if (inRange(B_TO, A_FROM, r)) return { c: [58, 54, 52], fill: 0.1 };
  if (inRange(A_FROM, A_TO, r)) {
    if (Math.abs(r - ENCKE) < 0.012) return null;
    return { c: mix([168, 154, 130], [212, 196, 166], fine), fill: 0.92 };
  }
  // The F ring: a thread, braided by the two small moons either side of it.
  const braid = Math.sin(Math.atan2(z, x) * 11) * 0.008;
  if (Math.abs(r - F_RING - braid) < 0.009) return { c: [226, 214, 196], fill: 0.8 };
  return null;
}

/** Cassini: the gold bus, the big white dish, the long magnetometer boom, and its one radar antenna. */
export function cassini() {
  const body = new Group();
  const set = new VoxelSet();
  const gold: Rgb = [230, 176, 80], white: Rgb = [240, 240, 236], metal: Rgb = [150, 150, 158], dark: Rgb = [44, 42, 48];
  const s = 0.14;
  set.fill(-0.62, -2.2, -0.62, 0.62, 0.6, 0.62, (x, y, z) => (Math.round(x * 4 + y * 3 + z * 2) % 5 === 0 ? [184, 134, 58] : gold), s, 0.08);
  set.fill(-0.86, -0.6, -0.86, 0.86, -0.1, 0.86, dark, s, 0.05);
  for (const a of [0, 2.1, 4.2]) set.box(Math.cos(a) * 1.1, -1.8, Math.sin(a) * 1.1, 0.44, 1.5, 0.44, a ? dark : white);
  for (let a = -12; a <= 12; a++) {
    for (let b = -12; b <= 12; b++) {
      const d2 = a * a + b * b;
      if (d2 <= 144) set.box(a * s, 1.1 - d2 * 0.0026, b * s, s, 0.1, s, d2 > 130 ? metal : white);
    }
  }
  for (let k = 0; k < 42; k++) set.box(-0.8 - k * 0.18, -0.9, 0, 0.18, 0.05, 0.05, k % 10 ? metal : white);
  body.add(set.mesh("lit"));
  return body;
}

/** Saturn's radius in the sky's own scale. The clouds are drawn far larger than this would make them, or they'd be a smooth floor. */
const R = 560;
const LATITUDE = (42 * Math.PI) / 180;
const CENTRE = new Vector3(0, -R, 0);
/** Saturn's axis as it stands from here: tipped toward the north horizon, behind you. */
const NORTH = new Vector3(0, Math.sin(LATITUDE), Math.cos(LATITUDE));
/** Off to the west and on the north side of the ring plane, so it's the rings' lit face you're looking at. */
const SUNWARD = new Vector3(-0.8, 0.5, 0).normalize();

/** The clouds wrap round this width, so the bands can slide for ever; the seam is lost in the haze. */
const WRAP = 700;
const BAND = 92;
const bandOf = (z: number) => Math.floor((z + 2000) / BAND);
const ZONE: Rgb = [208, 188, 146], ZONE_LOW: Rgb = [158, 130, 92], BELT: Rgb = [156, 116, 76], BELT_LOW: Rgb = [92, 64, 44];
const HAZE = 0xd8c096;

/** Noise measured round a circle in x, so a row of cloud meets itself where it wraps. */
const round = (x: number, z: number, wide: number, seed: number) => {
  const a = (x / (WRAP * 2)) * Math.PI * 2;
  return noise(Math.cos(a) * wide + z * 0.03 + 50, Math.sin(a) * wide + z * 0.03 + 50, seed);
};

/** Where convection punches through: a few white-topped towers. */
const STORMS: [number, number, number][] = [[-170, -56, 56], [120, -176, 74], [330, -30, 46], [-420, -250, 70], [40, 24, 30]];

function cloudHeight(x: number, z: number) {
  const billow = round(x, z, 9, 180) * 11 + round(x, z * 3, 28, 181) * 4 + round(x, z * 5, 70, 182) * 1.3;
  let storm = 0;
  for (const [sx, sz, r] of STORMS) {
    const dx = Math.abs(x - sx), d = Math.hypot(Math.min(dx, WRAP * 2 - dx), z - sz) / r;
    if (d < 1) storm = Math.max(storm, (1 - d * d) ** 1.2 * r * 0.44 * (0.75 + round(x, z * 2, 40, 183) * 0.5));
  }
  return billow + storm;
}

function cloudColour(x: number, z: number, h: number): Rgb {
  const belt = bandOf(z) % 2 === 1;
  const n = round(x, z * 2, 22, 184);
  const c = belt ? mix(BELT_LOW, BELT, smoothstep(4, 13, h) * 0.8 + n * 0.2) : mix(ZONE_LOW, ZONE, smoothstep(4, 12, h) * 0.8 + n * 0.2);
  // The tops of the storms are fresh ammonia ice, whiter than anything round them, and the west side catches the sun.
  const side = (cloudHeight(x - 3, z) - cloudHeight(x + 3, z)) * 0.05;
  const top = mix(c, [226, 222, 212], smoothstep(16, 28, h));
  const k = Math.max(0.55, Math.min(1.25, 1 + side));
  return [top[0] * k, top[1] * k, top[2] * k];
}

/** The deck, its colours fixed; the bands slide in the shader, and the rings' shadow stays put in the sky as they go under it. */
function clouds(coarse: boolean) {
  const set = new VoxelSet();
  const lay = (x: number, z: number, s: number, deep: number) => {
    const h = cloudHeight(x, z);
    set.column(x, z, h, h - deep, s, cloudColour(x, z, h), 0.03);
  };
  const near = coarse ? 3 : 2.1, mid = coarse ? 6 : 4.4, far = 11;
  for (let z = -60; z < 74; z += near) for (let x = -WRAP; x < WRAP; x += near) lay(x, z, near, 10);
  for (let z = -300; z < -60; z += mid) for (let x = -WRAP; x < WRAP; x += mid) lay(x, z, mid, 12);
  for (let z = -900; z < -300; z += far) for (let x = -WRAP; x < WRAP; x += far) lay(x, z, far, 16);
  const mesh = set.mesh("glow");
  const material = mesh.material as MeshBasicMaterial;
  const time = { value: 0 };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uTime: time, uSun: { value: SUNWARD }, uNorth: { value: NORTH } });
    shader.vertexShader = `uniform float uTime;\nuniform vec3 uSun, uNorth;\nvarying float vLit;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vec3 at = instanceMatrix[3].xyz;
      // Each band has its own wind, and the near ones show it.
      float band = floor((at.z + 2000.0) / ${BAND.toFixed(1)});
      float wind = 2.4 + 2.2 * sin(band * 2.4);
      float slid = mod(at.x + uTime * wind + ${WRAP.toFixed(1)}, ${(WRAP * 2).toFixed(1)}) - ${WRAP.toFixed(1)};
      transformed.x += (slid - at.x) / instanceMatrix[0][0];
      // Follow the sun's ray up from this cloud: if it crosses the ring plane in the rings, this cloud is in their shadow.
      vec3 p = vec3(slid, at.y + ${R.toFixed(1)}, at.z);
      float along = -dot(p, uNorth) / dot(uSun, uNorth);
      float hit = length(p + uSun * along) / ${R.toFixed(1)};
      float shade = along > 0.0 ? smoothstep(${C_FROM.toFixed(2)}, ${B_FROM.toFixed(2)}, hit) * (1.0 - smoothstep(${(B_TO - 0.01).toFixed(2)}, ${(B_TO + 0.01).toFixed(2)}, hit)) + 0.8 * smoothstep(${(A_FROM - 0.01).toFixed(2)}, ${(A_FROM + 0.01).toFixed(2)}, hit) * (1.0 - smoothstep(${(A_TO - 0.01).toFixed(2)}, ${(A_TO + 0.01).toFixed(2)}, hit)) : 0.0;
      vLit = 1.0 - shade * 0.58;`,
    );
    shader.fragmentShader = `varying float vLit;\n${shader.fragmentShader}`.replace("#include <opaque_fragment>", "outgoingLight *= vLit;\n#include <opaque_fragment>");
  };
  return { mesh, time };
}

/** The arch, at its true place for this latitude. */
function rings(coarse: boolean) {
  const group = new Group();
  group.position.copy(CENTRE);
  group.rotation.x = Math.PI / 2 - LATITUDE;
  group.updateMatrixWorld();
  const local = group.worldToLocal(SUNWARD.clone().add(CENTRE));
  const set = new VoxelSet();
  const step = coarse ? 8 : 5;
  const outer = R * (F_RING + 0.03);
  const out = new Vector3();
  for (let x = -outer; x <= outer; x += step) {
    for (let z = -outer; z <= outer; z += step) {
      const r = Math.hypot(x, z) / R;
      if (r < C_FROM) continue;
      out.set(x, 0, z).applyMatrix4(group.matrixWorld);
      // Nothing of it below the horizon is ever seen.
      if (out.y < -60) continue;
      const part = ringAt(r, x, z);
      if (!part || hash(Math.round(x), Math.round(z), 185) > part.fill) continue;
      const t = x * local.x + z * local.z;
      const inShadow = t < 0 && Math.hypot(x - local.x * t, local.y * t, z - local.z * t) < R * 0.98;
      // Paler toward the horizon, seen through more and more of the haze.
      const elevation = out.y / Math.hypot(out.x, out.y, out.z);
      const c = mix(inShadow ? mix(part.c, [14, 14, 22], 0.9) : mix(part.c, [0, 0, 0], 0.2), [168, 148, 114], (1 - smoothstep(0, 0.3, elevation)) * 0.6);
      set.add(x, 0, z, c, step, 0.04);
    }
  }
  const mesh = set.mesh("glow");
  const material = mesh.material as MeshBasicMaterial;
  const time = { value: 0 };
  material.fog = false;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime;\nvarying float vLit;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vec3 at = instanceMatrix[3].xyz;
      // Bright clumps sheared out as they go round, each radius at its own Kepler speed.
      float r = length(at.xz) / ${R.toFixed(1)};
      float a = atan(at.z, at.x);
      float speed = 0.16 / (r * sqrt(r));
      vLit = 1.0 + 0.1 * sin(a * 9.0 - uTime * speed + r * 40.0) + 0.07 * sin(a * 23.0 - uTime * speed * 1.4 + r * 90.0);`,
    );
    shader.fragmentShader = `varying float vLit;\n${shader.fragmentShader}`.replace("#include <opaque_fragment>", "outgoingLight *= vLit;\n#include <opaque_fragment>");
  };
  group.add(mesh);
  return { group, time };
}

function weather(coarse: boolean) {
  const list: Flow[] = [];
  const scale = coarse ? 0.5 : 1;
  const r = (i: number, s: number) => hash(i, s, 186);
  // Wisps of high ammonia cirrus, on the jet: the fastest thing you can see here.
  for (let i = 0; i < 1500 * scale; i++) {
    const z = 60 - r(i, 1) * 340, y = 32 + r(i, 2) * 26;
    list.push({
      start: [-420, y, z], drift: [840, 2, 0], size: 0.7 + r(i, 3) * 1.7, colour: mix([255, 246, 224], [226, 204, 166], r(i, 4)), alpha: 0.28, fade: 0.1,
      rate: 0.02 + r(i, 5) * 0.03, phase: r(i, 6), wobble: 2,
    });
  }
  // Veils of haze low over the deck.
  for (let i = 0; i < 90 * scale; i++) {
    const z = 40 - r(i, 11) * 520;
    list.push({
      start: [-500, 16 + r(i, 12) * 24, z], drift: [1000, 0, 0], size: 30 + r(i, 13) * 40, colour: [240, 214, 170], alpha: 0.014, fade: 0.1, rate: 0.008 + r(i, 14) * 0.01, phase: r(i, 15), wobble: 6,
    });
  }
  // Lightning, far stronger than Earth's, lighting a storm from the inside for an instant.
  STORMS.forEach(([x, z, size], k) => {
    const period = 7 + hash(k, 1, 187) * 13;
    for (let i = 0; i < 44; i++) {
      const o = r(k * 60 + i, 21) * 6.283, far = r(k * 60 + i, 22) * size * 0.6;
      list.push({
        start: [x + Math.cos(o) * far, 12 + r(k * 60 + i, 23) * size * 0.34, z + Math.sin(o) * far], drift: [0, 0, 0], size: 2 + r(k * 60 + i, 24) * 5, colour: [206, 220, 255], alpha: 0.4,
        rate: 1 / period, phase: hash(k, 2, 187), window: 0.012,
      });
    }
  });
  // The moons of the ring plane, strung along it above the arch.
  const tip = new Vector3(1, 0, 0);
  for (const [a, far, size] of [[-2.05, 3.05, 2.4], [-1.2, 3.1, 2.8], [-1.72, 2.82, 2]]) {
    const p = new Vector3(Math.cos(a) * far * R, 0, Math.sin(a) * far * R).applyAxisAngle(tip, Math.PI / 2 - LATITUDE).add(CENTRE);
    list.push({ start: [p.x, p.y, p.z], drift: [0, 0, 0], size, colour: [230, 232, 236], alpha: 1.3, rate: 0, phase: 0.2, twinkle: 0.3 });
  }
  return flows(list);
}

export const cloudTops: Place = {
  id: "saturn",
  name: "the cloud tops",
  world: "saturn",
  coords: "42°n · above the ammonia",
  build(coarse) {
    const scene = new Scene();
    scene.fog = new Fog(HAZE, 150, 860);
    // Only Cassini takes the light: the clouds and the rings have theirs worked out already.
    const sun = new DirectionalLight(0xfff0dc, 3);
    sun.position.copy(SUNWARD).multiplyScalar(300);
    scene.add(sun, new AmbientLight(0xd8c096, 0.7));
    scene.add(skyDome([8, 10, 28], [66, 84, 112], [216, 192, 150], SUNWARD, [255, 246, 222], 40));

    const sky = stars(coarse ? 700 : 1500);
    const arch = rings(coarse);
    const deck = clouds(coarse);
    const air = weather(coarse);
    scene.add(sky.mesh, arch.group, deck.mesh, air.mesh);

    const probe = cassini();
    scene.add(probe);
    const TRAIL = coarse ? 70 : 150;
    const trail = new Motes(TRAIL, (i) => mix([255, 244, 214], [255, 96, 34], Math.min(1, (i / TRAIL) * 1.5)));
    scene.add(trail.mesh);
    let live = TRAIL;
    const spot = new Vector3();
    const past = new Vector3();
    let calledAt = -100;
    /** A slow fall down the sky from high on the right. Its last seconds are the bright ones. */
    const FALL = 42;
    const place = (k: number, into: Vector3) => into.set(120 - k * 165, 128 - k * k * 104, -130 - k * 30);

    return {
      scene,
      eye: new Vector3(-6, 42, 68),
      at: new Vector3(4, 62, -24),
      fov: 62,
      lens: { center: 0.42, band: 0.34, blur: 5 },
      cell: 0.72,
      pullback: 0.6,
      ground: cloudHeight,
      sun,
      actor: spot,
      actorSize: 7,
      update(t) {
        sky.tick(t);
        air.tick(t);
        deck.time.value = t;
        arch.time.value = t;
        const k = (t % FALL) / FALL;
        place(k, spot);
        probe.position.copy(spot);
        probe.rotation.set(0.9 + t * 0.02, t * 0.05, -0.5);
        // Burning only once it's deep enough for the air to bite, and gone before it reaches the clouds.
        const burn = smoothstep(0.5, 0.96, k);
        probe.visible = k < 0.975;
        const called = smoothstep(0, 0.5, t - calledAt) * (1 - smoothstep(4, 6, t - calledAt));
        for (let i = 0; i < live; i++) {
          const f = i / TRAIL;
          place(Math.max(0, k - f * 0.05 * (0.3 + burn * 1.3)), past);
          const size = (1 - f) * (0.1 + burn * 1.9 + called * 0.4);
          trail.place(i, past.x + (hash(i, 1, 188) - 0.5) * f * 2.4, past.y + (hash(i, 2, 188) - 0.5) * f * 2.4, past.z, k > 0.985 ? 0.001 : size);
        }
        trail.commit();
      },
      poke(t) {
        calledAt = t;
        return "cassini · 15 september 2017 · sending to the end";
      },
      thin(share) {
        live = Math.round(TRAIL * share);
        trail.mesh.count = live;
      },
    };
  },
};
