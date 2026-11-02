/*
 * The map: the sun and its planets as a voxel orrery. The order and colours are true, and the planets keep to Kepler's
 * laws, on their true ellipses, tilts and periods. The distances are squeezed and the worlds swollen, or there'd be
 * nothing to see or tap.
 */

import { AmbientLight, BufferGeometry, Float32BufferAttribute, Group, type InstancedMesh, PerspectiveCamera, PointLight, Points, PointsMaterial, Scene, Vector3, type Object3D } from "three";
import { clamp, ease, hash, isLand, mix, noise, type Rgb } from "../engine";
import type { Lens } from "./ascii";
import { flows, type Flow } from "./scenes/kit";
import { Motes, VoxelSet, release } from "./voxels";

export interface World { id: string; name: string; orbit: number; size: number; year: number; spin: number; tilt: number; lands: string; approach?: string; around?: string; incline?: number; ecc?: number; peri?: number; paint: (x: number, y: number, z: number) => Rgb; voxel: number }
export interface Fix { x: number; y: number; r: number; depth: number }

const lonLat = (x: number, y: number, z: number) => ({ lon: Math.atan2(x, z), lat: Math.asin(clamp(y, -1, 1)) });
const SEA: Rgb = [46, 104, 196], LAND_GREEN: Rgb = [84, 150, 84], LAND_DRY: Rgb = [190, 164, 104], ICE: Rgb = [236, 242, 250];

/** Painted by each cube's direction from the world's centre, so coastlines and bands wrap properly. */
export const paintEarth = (x: number, y: number, z: number): Rgb => {
  const { lon, lat } = lonLat(x, y, z);
  if (Math.abs(lat) > 1.25) return ICE;
  if (!isLand(lon, lat)) return SEA;
  return Math.abs(lat) < 0.5 && noise(lon * 3, lat * 3, 5) > 0.45 ? LAND_DRY : LAND_GREEN;
};
const paintMoon = (x: number, y: number, z: number): Rgb => mix([190, 192, 196], [104, 106, 116], noise(x * 3 + 4, y * 3 + z * 2, 6) > 0.56 ? 0.85 : 0.1);
const paintMars = (x: number, y: number, z: number): Rgb => {
  if (Math.abs(y) > 0.86) return ICE;
  return mix([206, 92, 52], [116, 58, 44], noise(x * 2.4 + 2, y * 3 + z * 2.4, 7) > 0.56 ? 0.8 : 0.08);
};
const bands = (a: Rgb, b: Rgb, freq: number, seed: number) => (x: number, y: number, z: number): Rgb => mix(a, b, noise(y * freq + noise(x, z, seed) * 0.5, seed, seed));

const WORLDS: World[] = [
  { id: "mercury", name: "mercury", orbit: 11, size: 1.15, year: 0.24, spin: 0.1, tilt: 0, voxel: 0.2, lands: "mercury", ecc: 0.206, incline: 0.123, peri: 1.34, paint: (x, y, z) => mix([170, 160, 150], [96, 90, 86], noise(x * 4 + 2, y * 4 + z * 3, 8)) },
  { id: "venus", name: "venus", orbit: 15, size: 1.7, year: 0.62, spin: -0.08, tilt: 0.05, voxel: 0.24, lands: "venus", ecc: 0.007, incline: 0.059, peri: 2.29, paint: bands([238, 208, 150], [204, 152, 96], 5, 9) },
  { id: "earth", name: "earth", orbit: 20, size: 1.9, year: 1, spin: 0.35, tilt: 0.41, voxel: 0.2, lands: "earth", ecc: 0.017, peri: 1.8, paint: paintEarth },
  { id: "mars", name: "mars", orbit: 26, size: 1.45, year: 1.88, spin: 0.34, tilt: 0.44, voxel: 0.2, lands: "mars", ecc: 0.093, incline: 0.032, peri: 5.86, paint: paintMars },
  { id: "jupiter", name: "jupiter", orbit: 50, size: 4.4, year: 11.9, spin: 0.8, tilt: 0.05, voxel: 0.34, lands: "jupiter", ecc: 0.048, incline: 0.023, peri: 0.25, approach: "dive →", paint: (x, y, z) => {
    const { lon, lat } = lonLat(x, y, z);
    if (Math.hypot(lon - 0.8, (lat + 0.36) * 1.9) < 0.3) return [204, 84, 56];
    return bands([232, 208, 172], [168, 112, 76], 11, 10)(x, y, z);
  } },
  { id: "saturn", name: "saturn", orbit: 81, size: 3.6, year: 29.4, spin: 0.7, tilt: 0.47, voxel: 0.3, lands: "saturn", ecc: 0.054, incline: 0.043, peri: 1.61, approach: "dive →", paint: bands([236, 214, 164], [186, 158, 110], 8, 11) },
  { id: "uranus", name: "uranus", orbit: 110, size: 2.5, year: 84, spin: -0.4, tilt: 1.7, voxel: 0.26, lands: "uranus", ecc: 0.047, incline: 0.013, peri: 3.0, approach: "go on →", paint: bands([176, 228, 232], [136, 204, 214], 3, 12) },
  { id: "neptune", name: "neptune", orbit: 126, size: 2.4, year: 165, spin: 0.45, tilt: 0.49, voxel: 0.26, lands: "neptune", ecc: 0.009, incline: 0.031, peri: 0.84, approach: "dive →", paint: bands([70, 112, 226], [38, 70, 176], 5, 13) },
];
const MOON: World = { id: "moon", name: "the moon", orbit: 3.4, size: 0.62, year: 0.08, spin: 0.2, tilt: 0.1, voxel: 0.16, lands: "moon", around: "earth", paint: paintMoon };
// Half tar, half ice, and the one big moon out of the plane of the rings, 15° off it.
const paintIapetus = (x: number, y: number, z: number): Rgb => (x + noise(y * 3 + 2, z * 3, 16) * 0.5 - 0.25 > 0 ? mix([66, 46, 34], [104, 76, 54], noise(y * 4, z * 4, 17)) : mix([232, 234, 238], [176, 174, 170], noise(y * 4 + 3, z * 4, 18)));
const IAPETUS: World = { id: "iapetus", name: "iapetus", orbit: 11.5, size: 0.62, year: 0.217, spin: 0.1, tilt: 0, voxel: 0.16, lands: "iapetus", around: "saturn", incline: 0.27, paint: paintIapetus };
// Stands in for the belt on the map, somewhere for a finger to land among all that gravel.
const BELT: World = { id: "belt", name: "the belt", orbit: 32.8, size: 0.8, year: 4.84, spin: 0.3, tilt: 0.2, voxel: 0.17, lands: "belt", paint: (x, y, z) => mix([168, 154, 134], [96, 88, 78], noise(x * 3 + 3, y * 3 + z * 3, 19)) };
// Patched together from pieces, and a good deal of it cliff.
const MIRANDA: World = { id: "miranda", name: "miranda", orbit: 6, size: 0.5, year: 0.06, spin: 0.1, tilt: 0, voxel: 0.14, lands: "miranda", around: "uranus", paint: (x, y, z) => mix([200, 204, 208], [92, 92, 100], noise(x * 5 + y * 2, z * 5, 20) > 0.5 ? 0.85 : 0.1) };
/** Encke's comet, which has the shortest period of any: a real year count, on an orbit squeezed like the rest. */
const COMET = { orbit: 25, ecc: 0.65, year: 3.3, incline: 0.2, peri: 2.6 };
/** Jupiter's big four, with Io, Europa and Ganymede in the 1:2:4 they really keep. Nothing to land on, so not worlds. */
const GALILEANS = [
  { orbit: 6.2, year: 0.06, size: 2.2, tone: [226, 196, 92] as Rgb },
  { orbit: 7.4, year: 0.12, size: 2, tone: [232, 226, 208] as Rgb },
  { orbit: 9.2, year: 0.24, size: 2.8, tone: [158, 142, 124] as Rgb },
  { orbit: 11.2, year: 0.56, size: 2.6, tone: [104, 92, 84] as Rgb },
];
/** Moving parts of the tail. */
const TAIL = 46;
const SUN: World = { id: "sun", name: "the sun", orbit: 0, size: 6, year: 1, spin: 0.05, tilt: 0.12, voxel: 0.5, lands: "sun", approach: "nice try →", paint: () => [255, 200, 90] };

/** How much slower than real time the worlds go round: Earth's year in a minute. */
const YEAR_SECONDS = 60;
/** Field of view, and how far out the camera starts on arrival. */
const FOV = 35;
const ARRIVE_FROM = 2.6;
const ARRIVE_SECONDS = 3;
/** How fast the worlds go round, against the usual, while one is in focus. */
const CALM_PACE = 0.1;
const TAU = Math.PI * 2;
/** An orbit line away from its planet, and right behind it. */
const ORBIT_DIM: Rgb = [46, 54, 76], ORBIT_LIT: Rgb = [186, 208, 248];
/** Where the belt's gaps fall across its width, at the resonances with Jupiter: 3:1, 5:2, 7:3 and 2:1. */
const KIRKWOOD = [0.2, 0.5, 0.62, 0.9];
export const MAP_LENS: Lens = { center: 0.5, band: 0.3, blur: 5 };

/** Kepler's equation, from the time round the orbit to the angle that places a world on its ellipse. */
function eccentric(mean: number, ecc: number) {
  let e = mean;
  for (let i = 0; i < 5; i++) e -= (e - ecc * Math.sin(e) - mean) / (1 - ecc * Math.cos(e));
  return e;
}

/** Where a body is on its ellipse, with the sun at one focus. */
function onEllipse(out: Vector3, o: { orbit: number; ecc?: number; peri?: number; incline?: number }, angle: number) {
  const ecc = o.ecc ?? 0, peri = o.peri ?? 0;
  const x = o.orbit * (Math.cos(angle) - ecc), z = o.orbit * Math.sqrt(1 - ecc * ecc) * Math.sin(angle);
  const c = Math.cos(peri), s = Math.sin(peri);
  const rz = x * s + z * c;
  return out.set(x * c - z * s, rz * (o.incline ?? 0), rz);
}

function voxelBall(world: World, look: "lit" | "glow" = "lit") {
  const set = new VoxelSet();
  set.ball(0, 0, 0, world.size / world.voxel, world.voxel, world.paint);
  return set.mesh(look);
}

export class Orrery {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 3000);
  readonly worlds = [SUN, ...WORLDS.slice(0, 3), MOON, WORLDS[3], BELT, ...WORLDS.slice(4, 6), IAPETUS, WORLDS[6], MIRANDA, WORLDS[7]];
  private nodes = new Map<string, Object3D>();
  private pivots: { world: World; node: Group; phase: number; angle: number; around?: Object3D }[] = [];
  /** The orbit lines' dots, each by whose orbit and how far round it, relit every frame so a trail follows each planet. */
  private dots: { mesh: InstancedMesh | null; at: { pivot: number; angle: number }[] } = { mesh: null, at: [] };
  private moons: { node: Group; orbit: number; year: number; phase: number }[] = [];
  private corona: ReturnType<typeof flows>;
  private comet = new Group();
  private tail = new Motes(TAIL, (i) => mix([214, 236, 255], [90, 130, 190], i / TAIL));
  private ring: { mesh: InstancedMesh; base: Float32Array; tilt: number; size: number; node: Group; shadedAt: number } | null = null;
  private belt = new Group();
  private sunBall: Object3D;
  private probes = new Group();
  private w = 1;
  private h = 1;
  private az = -0.6;
  private el = 0.5;
  private spin = { az: 0, el: 0 };
  private zoom = 1;
  private arrival = 0;
  /** The map's own clock, which runs slow while you're choosing a world, so it holds still enough to be clicked. */
  private clock = 0;
  private pace = 1;
  private calmed = false;
  /** Where the camera looks: the sun, until you zoom in on something else. */
  private center = new Vector3();
  private dragging = false;
  private spot = new Vector3();
  /** Probes showing the projects: how many, how far they sit from the sun. */
  private probesOn = false;
  private probeR = 32;

  constructor(reduced: boolean, projects: number) {
    this.arrival = reduced ? ARRIVE_SECONDS : 0;
    this.scene.add(new AmbientLight(0xffffff, 0.3), new PointLight(0xfff2dc, 3.5, 0, 0));
    this.scene.add(this.starfield());
    this.sunBall = this.makeSun();
    this.corona = flows(this.sunFlows());
    this.scene.add(this.sunBall, this.corona.mesh, this.belt, this.comet, this.tail.mesh);
    this.fillBelt();
    const head = new VoxelSet();
    head.ball(0, 0, 0, 2.2, 0.16, () => [232, 244, 255]);
    this.comet.add(head.mesh("glow"));
    this.nodes.set("sun", this.sunBall);
    for (const world of this.worlds) {
      if (world === SUN) continue;
      const node = new Group();
      const axis = new Group();
      axis.rotation.z = world.tilt;
      axis.add(voxelBall(world));
      if (world.id === "saturn") axis.add(this.rings(world, node));
      if (world.id === "uranus") axis.add(this.thinRings(world));
      if (world.id === "earth") {
        const clouds = this.clouds(world);
        axis.add(clouds);
        node.userData.clouds = clouds;
      }
      if (world.id === "jupiter") {
        for (const moon of GALILEANS) {
          const set = new VoxelSet();
          set.ball(0, 0, 0, moon.size, 0.14, () => moon.tone);
          const body = new Group();
          body.add(set.mesh("lit"));
          node.add(body);
          this.moons.push({ node: body, orbit: moon.orbit, year: moon.year, phase: hash(moon.orbit, 2, 42) * Math.PI * 2 });
        }
      }
      node.add(axis);
      node.userData.ball = axis.children[0];
      this.scene.add(node);
      this.nodes.set(world.id, node);
      this.pivots.push({ world, node, phase: hash(world.orbit * 10, 3, 41) * Math.PI * 2, angle: 0, around: world.around ? this.nodes.get(world.around) : undefined });
    }
    this.scene.add(this.orbitRings(), this.probes);
    for (let i = 0; i < projects; i++) {
      const set = new VoxelSet();
      set.box(0, 0, 0, 0.7, 0.7, 0.7, [159, 196, 255]);
      set.box(-0.9, 0, 0, 1, 0.08, 0.5, [226, 236, 255]);
      set.box(0.9, 0, 0, 1, 0.08, 0.5, [226, 236, 255]);
      this.probes.add(set.mesh("glow"));
    }
    this.probes.visible = false;
  }

  private makeSun() {
    const group = new Group();
    const set = new VoxelSet();
    set.ball(0, 0, 0, SUN.size / SUN.voxel, SUN.voxel, (x, y, z) => mix([255, 236, 150], [226, 88, 26], clamp(noise(x * 5 + 8, y * 5 + z * 5, 14) * 1.9 - 0.45, 0, 1)), 0.05);
    group.add(set.mesh("glow"));
    group.rotation.z = SUN.tilt;
    return group;
  }

  /** The corona streaming off the sun, with a few prominences looping up and falling back. */
  private sunFlows() {
    const list: Flow[] = [];
    for (let i = 0; i < 620; i++) {
      const u = hash(i, 1, 52) * 2 - 1, a = hash(i, 2, 52) * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const out: [number, number, number] = [Math.cos(a) * s, u, Math.sin(a) * s];
      const r = SUN.size * 0.98;
      const loop = i % 12 === 0;
      const reach = loop ? 7 : 1.6 + hash(i, 3, 52) * 3.4;
      list.push({
        start: [out[0] * r, out[1] * r, out[2] * r],
        drift: [out[0] * reach, out[1] * reach, out[2] * reach],
        curve: loop ? [-out[0] * reach * 0.95, -out[1] * reach * 0.95, -out[2] * reach * 0.95] : undefined,
        size: loop ? 0.42 : 0.26 + hash(i, 4, 52) * 0.3,
        colour: mix([255, 214, 120], [255, 112, 44], hash(i, 5, 52)),
        alpha: 0.55,
        fade: 1.3,
        rate: 0.12 + hash(i, 6, 52) * 0.2,
        phase: hash(i, 7, 52),
        wobble: 0.3,
      });
    }
    return list;
  }

  private starfield() {
    const positions: number[] = [];
    const colours: number[] = [];
    for (let i = 0; i < 3000; i++) {
      // Past the first stars, the rest crowd into the Milky Way: a band round the sky, tilted 60° to the planets as it truly is.
      const band = i >= 1100;
      const spread = (hash(i, 5, 51) + hash(i, 6, 51) + hash(i, 7, 51) - 1.5) * 0.16;
      const u = band ? spread : hash(i, 1, 51) * 2 - 1, a = hash(i, 2, 51) * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const x = Math.cos(a) * s, y = u, z = Math.sin(a) * s;
      const tilt = band ? 1.05 : 0, c = Math.cos(tilt), n = Math.sin(tilt);
      positions.push(x * 1400, (y * c - z * n) * 1400, (y * n + z * c) * 1400);
      const b = band ? 0.2 + hash(i, 3, 51) ** 2 * 0.62 : 0.4 + hash(i, 3, 51) * 0.6;
      colours.push(b, b * 0.96, b * (0.86 + hash(i, 4, 51) * 0.3));
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
    const points = new Points(geometry, new PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true }));
    points.frustumCulled = false;
    return points;
  }

  private orbitRings() {
    const set = new VoxelSet();
    const p = new Vector3();
    this.pivots.forEach((pivot, index) => {
      if (pivot.world.around || pivot.world === BELT) return;
      const n = Math.round(pivot.world.orbit * 5.4);
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2;
        onEllipse(p, pivot.world, angle);
        set.box(p.x, p.y, p.z, 0.34, 0.34, 0.34, ORBIT_DIM);
        this.dots.at.push({ pivot: index, angle });
      }
    });
    const mesh = set.mesh("glow");
    this.dots.mesh = mesh;
    return mesh;
  }

  private fillBelt() {
    const set = new VoxelSet();
    for (let i = 0; i < 1100; i++) {
      const a = hash(i, 1, 61) * Math.PI * 2, k = hash(i, 2, 61), s = 0.12 + hash(i, 3, 61) ** 2 * 0.3;
      // The Kirkwood gaps, swept clear where a rock's year would keep time with Jupiter's.
      if (KIRKWOOD.some((gap) => Math.abs(k - gap) < 0.022)) continue;
      // Stony toward the sun, darker and carbon-rich further out.
      const tone = mix(mix([176, 150, 118], [92, 84, 80], k), [150, 132, 110], hash(i, 5, 61) * 0.5);
      set.add(Math.cos(a) * (30 + k * 5.5), (hash(i, 4, 61) - 0.5) * 1.6, Math.sin(a) * (30 + k * 5.5), tone, s, 0.2);
    }
    this.belt.add(set.mesh("lit"));
  }

  /** Earth's weather, on a shell of its own that turns a little faster than the ground. */
  private clouds(world: World) {
    const set = new VoxelSet();
    const r = (world.size * 1.07) / world.voxel, R = Math.ceil(r);
    for (let i = -R; i <= R; i++) {
      for (let j = -R; j <= R; j++) {
        for (let k = -R; k <= R; k++) {
          const d = Math.hypot(i, j, k);
          if (d > r || d < r - 1) continue;
          if (noise((i / d) * 3.4 + 9, (j / d) * 5 + (k / d) * 3.4, 21) < 0.57) continue;
          set.add(i * world.voxel, j * world.voxel, k * world.voxel, [246, 248, 252], world.voxel, 0.03);
        }
      }
    }
    return set.mesh("lit");
  }

  /** Uranus has rings too, thin and dark, standing up on its tipped axis. */
  private thinRings(world: World) {
    const set = new VoxelSet();
    for (const [radius, tone] of [[1.62, 96], [1.74, 84], [2.0, 138]]) {
      const n = Math.round(radius * world.size * 13);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, r = radius * world.size;
        set.box(Math.cos(a) * r, 0, Math.sin(a) * r, 0.1, 0.1, 0.1, [tone, tone + 8, tone + 18]);
      }
    }
    return set.mesh("glow");
  }

  private rings(world: World, node: Group) {
    const set = new VoxelSet();
    const step = 0.26;
    for (let x = -world.size * 2.4; x <= world.size * 2.4; x += step) {
      for (let z = -world.size * 2.4; z <= world.size * 2.4; z += step) {
        const r = Math.hypot(x, z) / world.size;
        // In their true proportions: the faint C ring, the bright B, the Cassini Division, the A with Encke's thin gap in it.
        if (r < 1.24 || r > 2.27 || (r > 1.95 && r < 2.03) || (r > 2.2 && r < 2.22)) continue;
        const grain = mix([232, 212, 168], [152, 130, 98], noise(r * 22, 2, 15));
        const brightness = r < 1.53 ? 0.42 : r < 1.95 ? 1 : 0.76;
        set.add(x, 0, z, [grain[0] * brightness, grain[1] * brightness, grain[2] * brightness], step * 0.92, 0.12);
      }
    }
    const mesh = set.mesh("lit");
    this.ring = { mesh, base: Float32Array.from(mesh.instanceColor!.array), tilt: world.tilt, size: world.size, node, shadedAt: -Infinity };
    return mesh;
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** How far back the camera sits so the planets fit; a narrow screen crops the outer ones rather than shrink them all. */
  private distance() {
    const fit = 280 / (this.camera.aspect * 2 * Math.tan((FOV * Math.PI) / 360));
    return Math.min(fit, 347) * this.zoom;
  }

  drag(dx: number, dy: number) {
    this.dragging = true;
    this.az -= dx * 0.005;
    this.el = clamp(this.el + dy * 0.004, 0.08, 1.4);
    this.spin = { az: -dx * 0.28, el: dy * 0.22 };
  }

  release() {
    this.dragging = false;
  }

  /** Scales the view about the point on the plane under (x, y), which so stays under it. All the way out is back on the sun. */
  zoomBy(factor: number, x: number, y: number) {
    const zoom = clamp(this.zoom * factor, 0.22, 1.5);
    const at = this.planeAt(x, y);
    if (at) this.center.sub(at).multiplyScalar(zoom / this.zoom).add(at);
    this.zoom = zoom;
    this.center.clampLength(0, 204 * Math.max(0, 1 - zoom));
  }

  /** The point of the orbital plane seen at (x, y), if there is one that near. */
  private planeAt(x: number, y: number) {
    const ray = new Vector3((x / this.w) * 2 - 1, 1 - (y / this.h) * 2, 0.5).unproject(this.camera).sub(this.camera.position);
    if (ray.y >= 0) return null;
    const at = ray.multiplyScalar(-this.camera.position.y / ray.y).add(this.camera.position);
    return at.length() < 283 ? at : null;
  }

  /** Stops the coasting from the last drag. */
  grip() {
    this.spin = { az: 0, el: 0 };
  }

  calm(on: boolean) {
    this.calmed = on;
  }

  showProbes(on: boolean) {
    this.probesOn = on;
    this.probes.visible = on;
    if (on) {
      this.zoom = 1;
      this.center.set(0, 0, 0);
    }
  }

  /** Saturn's shadow across its rings. It moves too slowly to need doing every frame. */
  private shadeRings() {
    const ring = this.ring!;
    const away = ring.node.position.clone().normalize();
    const c = Math.cos(ring.tilt), s = Math.sin(ring.tilt);
    const m = ring.mesh.instanceMatrix.array, colours = ring.mesh.instanceColor!.array;
    for (let i = 0; i < ring.mesh.count; i++) {
      const lx = m[i * 16 + 12], lz = m[i * 16 + 14];
      const wx = lx * c, wy = lx * s;
      const along = wx * away.x + wy * away.y + lz * away.z;
      const shade = along > 0 && lx * lx + lz * lz - along * along < ring.size * ring.size ? 0.16 : 1;
      for (let k = 0; k < 3; k++) colours[i * 3 + k] = ring.base[i * 3 + k] * shade;
    }
    ring.mesh.instanceColor!.needsUpdate = true;
  }

  /** Every planet's line bright just behind it, fading away round the orbit. */
  private lightOrbits() {
    const mesh = this.dots.mesh;
    if (!mesh) return;
    const colours = mesh.instanceColor!.array;
    this.dots.at.forEach(({ pivot, angle }, i) => {
      const behind = ((this.pivots[pivot].angle - angle) % TAU + TAU) % TAU;
      const trail = Math.exp(-behind * 2.4);
      for (let k = 0; k < 3; k++) colours[i * 3 + k] = (ORBIT_DIM[k] + (ORBIT_LIT[k] - ORBIT_DIM[k]) * trail) / 255;
    });
    mesh.instanceColor!.needsUpdate = true;
  }

  private moveComet(t: number) {
    const angle = eccentric(hash(7, 3, 41) * TAU + (t / YEAR_SECONDS / COMET.year) * TAU, COMET.ecc);
    onEllipse(this.comet.position, COMET, angle);
    const from = this.comet.position.length();
    // A tail only grows near the sun, and points straight away from it whichever way the comet is going.
    const long = clamp(170 / from - 2.2, 0, 13);
    const dir = this.comet.position.clone().normalize();
    for (let i = 0; i < TAIL; i++) {
      const k = i / TAIL, spread = k * long * 0.08;
      this.tail.place(i, this.comet.position.x + dir.x * k * long + (hash(i, 1, 43) - 0.5) * spread, this.comet.position.y + dir.y * k * long + (hash(i, 2, 43) - 0.5) * spread, this.comet.position.z + dir.z * k * long + (hash(i, 3, 43) - 0.5) * spread, long > 0.1 ? 0.26 * (1 - k * 0.7) : 0.001);
    }
    this.tail.commit();
  }

  update(dt: number) {
    this.pace += ((this.calmed ? CALM_PACE : 1) - this.pace) * (1 - Math.exp(-6 * dt));
    this.clock += dt * this.pace;
    const t = this.clock;
    this.arrival = Math.min(ARRIVE_SECONDS, this.arrival + dt);
    if (!this.dragging) {
      this.az += this.spin.az * dt + dt * 0.012 * this.pace;
      this.el = clamp(this.el + this.spin.el * dt, 0.08, 1.4);
      this.spin.az *= Math.exp(-2.6 * dt);
      this.spin.el *= Math.exp(-2.6 * dt);
    }
    this.sunBall.rotation.y = t * SUN.spin;
    this.belt.rotation.y = t * 0.012;
    for (const pivot of this.pivots) {
      const { world, node, phase, around } = pivot;
      pivot.angle = eccentric(phase + (t / YEAR_SECONDS / world.year) * TAU, world.ecc ?? 0);
      onEllipse(node.position, world, pivot.angle);
      if (around) node.position.add(around.position);
      (node.userData.ball as Object3D).rotation.y = t * world.spin;
      (node.userData.clouds as Object3D | undefined)?.rotation.set(0, t * world.spin * 1.3, 0);
    }
    for (const moon of this.moons) {
      const a = moon.phase + (t / YEAR_SECONDS / moon.year) * TAU;
      moon.node.position.set(Math.cos(a) * moon.orbit, 0, Math.sin(a) * moon.orbit);
    }
    this.lightOrbits();
    this.corona.tick(t);
    this.moveComet(t);
    if (this.ring && Math.abs(t - this.ring.shadedAt) > 4) {
      this.ring.shadedAt = t;
      this.shadeRings();
    }
    // Sat where a narrow screen can still see them.
    const view = this.distance() * Math.tan((FOV * Math.PI) / 360) * this.camera.aspect;
    this.probeR = Math.min(32, view * 0.72);
    this.probes.children.forEach((probe, i) => {
      const a = t * 0.04 + (i / this.probes.children.length) * Math.PI * 2 - this.az + 0.6;
      probe.position.set(Math.cos(a) * this.probeR, 2, Math.sin(a) * this.probeR);
      probe.rotation.y = t * 0.3 + i;
    });
    this.scene.updateMatrixWorld();
  }

  /** dive: 0 sits out on the map; 1 is right up against that world. */
  aim(dive: number, world: World | null) {
    const k = ease(dive);
    const out = 1 + (ARRIVE_FROM - 1) * (1 - ease(this.arrival / ARRIVE_SECONDS));
    const far = this.distance() * out;
    const near = world ? world.size * 2.4 : far;
    const r = far + (near - far) * k;
    const target = this.spot.set(0, 0, 0);
    if (world) this.nodes.get(world.id)?.getWorldPosition(target).multiplyScalar(k);
    target.addScaledVector(this.center, world ? 1 - k : 1);
    const c = Math.cos(this.el);
    this.camera.position.set(target.x + Math.sin(this.az) * c * r, target.y + Math.sin(this.el) * r, target.z + Math.cos(this.az) * c * r);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
  }

  private project(p: Vector3, size: number): Fix {
    const depth = this.camera.position.distanceTo(p);
    const v = this.spot.copy(p).project(this.camera);
    return { x: (v.x + 1) * 0.5 * this.w, y: (1 - v.y) * 0.5 * this.h, r: (size / depth) * (this.h / 2 / Math.tan((FOV * Math.PI) / 360)), depth: v.z };
  }

  /** Where a world is on screen right now. */
  fix(world: World) {
    const p = new Vector3();
    this.nodes.get(world.id)?.getWorldPosition(p);
    return this.project(p, world.size);
  }

  /** The world under a point, forgiving enough for a fingertip on the smallest of them. */
  worldAt(x: number, y: number, slop: number) {
    const fixes = this.worlds.map((world) => ({ world, f: this.fix(world) }));
    let best: World | null = null;
    let score = Infinity;
    for (const { world, f } of fixes) {
      if (f.depth > 1) continue;
      const d = Math.hypot(f.x - x, f.y - y);
      if (d > Math.max(slop, f.r + 4)) continue;
      // Nothing can be picked through what's wholly in front of it.
      if (fixes.some((o) => o.f.depth < f.depth && Math.hypot(o.f.x - f.x, o.f.y - f.y) + f.r < o.f.r)) continue;
      // Whichever edge is nearest, and on top of two at once, the smaller: the big one has room elsewhere.
      const s = Math.max(0, d - f.r) + f.r * 0.001;
      if (s < score) { score = s; best = world; }
    }
    return best;
  }

  /** The probes' places on screen, for their labels. */
  probeFixes() {
    return this.probes.children.map((probe) => {
      const p = new Vector3();
      probe.getWorldPosition(p);
      return this.project(p, 1);
    });
  }

  years() {
    return this.clock / YEAR_SECONDS;
  }

  destroy() {
    release(this.scene);
  }
}
