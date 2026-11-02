/*
 * The map: the sun and its planets as a voxel orrery. The order and colours are true, and the planets keep to Kepler's
 * third law. The distances are squeezed and the worlds swollen, or there'd be nothing to see or tap.
 */

import { AmbientLight, BufferGeometry, Float32BufferAttribute, Group, PerspectiveCamera, PointLight, Points, PointsMaterial, Scene, Vector3, type Object3D } from "three";
import { clamp, ease, hash, isLand, mix, noise, type Rgb } from "../engine";
import type { Lens } from "./ascii";
import { VoxelSet, release } from "./voxels";

export interface World { id: string; name: string; orbit: number; size: number; year: number; spin: number; tilt: number; lands: string; approach?: string; around?: string; incline?: number; paint: (x: number, y: number, z: number) => Rgb; voxel: number }
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
  { id: "mercury", name: "mercury", orbit: 11, size: 1.15, year: 0.24, spin: 0.1, tilt: 0, voxel: 0.2, lands: "mercury", paint: (x, y, z) => mix([170, 160, 150], [96, 90, 86], noise(x * 4 + 2, y * 4 + z * 3, 8)) },
  { id: "venus", name: "venus", orbit: 15, size: 1.7, year: 0.62, spin: -0.08, tilt: 0.05, voxel: 0.24, lands: "venus", paint: bands([238, 208, 150], [204, 152, 96], 5, 9) },
  { id: "earth", name: "earth", orbit: 20, size: 1.9, year: 1, spin: 0.35, tilt: 0.41, voxel: 0.2, lands: "earth", paint: paintEarth },
  { id: "mars", name: "mars", orbit: 26, size: 1.45, year: 1.88, spin: 0.34, tilt: 0.44, voxel: 0.2, lands: "mars", paint: paintMars },
  { id: "jupiter", name: "jupiter", orbit: 40, size: 4.4, year: 11.9, spin: 0.8, tilt: 0.05, voxel: 0.34, lands: "jupiter", approach: "dive →", paint: (x, y, z) => {
    const { lon, lat } = lonLat(x, y, z);
    if (Math.hypot(lon - 0.8, (lat + 0.36) * 1.9) < 0.3) return [204, 84, 56];
    return bands([232, 208, 172], [168, 112, 76], 11, 10)(x, y, z);
  } },
  { id: "saturn", name: "saturn", orbit: 52, size: 3.6, year: 29.4, spin: 0.7, tilt: 0.47, voxel: 0.3, lands: "saturn", approach: "dive →", paint: bands([236, 214, 164], [186, 158, 110], 8, 11) },
  { id: "uranus", name: "uranus", orbit: 62, size: 2.5, year: 84, spin: -0.4, tilt: 1.7, voxel: 0.26, lands: "uranus", approach: "go on →", paint: bands([176, 228, 232], [136, 204, 214], 3, 12) },
  { id: "neptune", name: "neptune", orbit: 71, size: 2.4, year: 165, spin: 0.45, tilt: 0.49, voxel: 0.26, lands: "neptune", approach: "dive →", paint: bands([70, 112, 226], [38, 70, 176], 5, 13) },
];
const MOON: World = { id: "moon", name: "the moon", orbit: 3.4, size: 0.62, year: 0.08, spin: 0.2, tilt: 0.1, voxel: 0.16, lands: "moon", around: "earth", paint: paintMoon };
// Half tar, half ice, and the one big moon out of the plane of the rings, 15° off it.
const paintIapetus = (x: number, y: number, z: number): Rgb => (x + noise(y * 3 + 2, z * 3, 16) * 0.5 - 0.25 > 0 ? mix([66, 46, 34], [104, 76, 54], noise(y * 4, z * 4, 17)) : mix([232, 234, 238], [176, 174, 170], noise(y * 4 + 3, z * 4, 18)));
const IAPETUS: World = { id: "iapetus", name: "iapetus", orbit: 11.5, size: 0.62, year: 0.217, spin: 0.1, tilt: 0, voxel: 0.16, lands: "iapetus", around: "saturn", incline: 0.27, paint: paintIapetus };
// Stands in for the belt on the map, somewhere for a finger to land among all that gravel.
const BELT: World = { id: "belt", name: "the belt", orbit: 32.8, size: 0.8, year: 4.84, spin: 0.3, tilt: 0.2, voxel: 0.17, lands: "belt", paint: (x, y, z) => mix([168, 154, 134], [96, 88, 78], noise(x * 3 + 3, y * 3 + z * 3, 19)) };
// Patched together from pieces, and a good deal of it cliff.
const MIRANDA: World = { id: "miranda", name: "miranda", orbit: 6, size: 0.5, year: 0.06, spin: 0.1, tilt: 0, voxel: 0.14, lands: "miranda", around: "uranus", paint: (x, y, z) => mix([200, 204, 208], [92, 92, 100], noise(x * 5 + y * 2, z * 5, 20) > 0.5 ? 0.85 : 0.1) };
const SUN: World = { id: "sun", name: "the sun", orbit: 0, size: 6, year: 1, spin: 0.05, tilt: 0.12, voxel: 0.5, lands: "sun", approach: "nice try →", paint: () => [255, 200, 90] };

/** How much slower than real time the worlds go round: Earth's year in a minute. */
const YEAR_SECONDS = 60;
/** Field of view, and how far out the camera starts on arrival. */
const FOV = 35;
const ARRIVE_FROM = 2.6;
const ARRIVE_SECONDS = 3;
export const MAP_LENS: Lens = { center: 0.5, band: 0.3, blur: 5 };

function voxelBall(world: World, look: "lit" | "glow" = "lit") {
  const set = new VoxelSet();
  set.ball(0, 0, 0, world.size / world.voxel, world.voxel, world.paint);
  return set.mesh(look);
}

export class Orrery {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 1500);
  readonly worlds = [SUN, ...WORLDS.slice(0, 3), MOON, WORLDS[3], BELT, ...WORLDS.slice(4, 6), IAPETUS, WORLDS[6], MIRANDA, WORLDS[7]];
  private nodes = new Map<string, Object3D>();
  private pivots: { world: World; node: Group; phase: number; around?: Object3D }[] = [];
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
  private time = 0;
  private dragging = false;
  private spot = new Vector3();
  /** Probes showing the projects: how many, how far they sit from the sun. */
  private probesOn = false;
  private probeR = 32;

  constructor(reduced: boolean, projects: number) {
    this.arrival = reduced ? ARRIVE_SECONDS : 0;
    this.scene.add(new AmbientLight(0xffffff, 0.62), new PointLight(0xfff2dc, 3.1, 0, 0));
    this.scene.add(this.starfield());
    this.sunBall = this.makeSun();
    this.scene.add(this.sunBall, this.orbitRings(), this.belt);
    this.fillBelt();
    this.nodes.set("sun", this.sunBall);
    for (const world of this.worlds) {
      if (world === SUN) continue;
      const node = new Group();
      const axis = new Group();
      axis.rotation.z = world.tilt;
      axis.add(voxelBall(world));
      if (world.id === "saturn") axis.add(this.rings(world));
      node.add(axis);
      node.userData.ball = axis.children[0];
      this.scene.add(node);
      this.nodes.set(world.id, node);
      this.pivots.push({ world, node, phase: hash(world.orbit * 10, 3, 41) * Math.PI * 2, around: world.around ? this.nodes.get(world.around) : undefined });
    }
    this.scene.add(this.probes);
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
    set.ball(0, 0, 0, SUN.size / SUN.voxel, SUN.voxel, (x, y, z) => mix([255, 226, 120], [240, 112, 34], clamp(noise(x * 3 + 8, y * 3 + z * 3, 14) * 1.5 - 0.2, 0, 1)), 0.05);
    group.add(set.mesh("glow"));
    group.rotation.z = SUN.tilt;
    return group;
  }

  private starfield() {
    const positions: number[] = [];
    const colours: number[] = [];
    for (let i = 0; i < 1400; i++) {
      const u = hash(i, 1, 51) * 2 - 1, a = hash(i, 2, 51) * Math.PI * 2, s = Math.sqrt(1 - u * u);
      positions.push(Math.cos(a) * s * 700, u * 700, Math.sin(a) * s * 700);
      const b = 0.4 + hash(i, 3, 51) * 0.6;
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
    for (const world of WORLDS) {
      const n = Math.round(world.orbit * 5.4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        set.box(Math.cos(a) * world.orbit, 0, Math.sin(a) * world.orbit, 0.34, 0.34, 0.34, [74, 84, 112]);
      }
    }
    return set.mesh("glow");
  }

  private fillBelt() {
    const set = new VoxelSet();
    for (let i = 0; i < 900; i++) {
      const a = hash(i, 1, 61) * Math.PI * 2, r = 30 + hash(i, 2, 61) * 5.5, s = 0.12 + hash(i, 3, 61) ** 2 * 0.3;
      set.add(Math.cos(a) * r, (hash(i, 4, 61) - 0.5) * 1.6, Math.sin(a) * r, [142, 128, 112], s, 0.2);
    }
    this.belt.add(set.mesh("lit"));
  }

  private rings(world: World) {
    const set = new VoxelSet();
    const step = 0.26;
    for (let x = -world.size * 2.4; x <= world.size * 2.4; x += step) {
      for (let z = -world.size * 2.4; z <= world.size * 2.4; z += step) {
        const r = Math.hypot(x, z) / world.size;
        // The Cassini Division is the one dark gap anyone knows.
        if (r < 1.3 || r > 2.3 || (r > 1.88 && r < 1.96)) continue;
        set.add(x, 0, z, mix([224, 204, 160], [150, 128, 96], noise(r * 14, 2, 15)), step * 0.92, 0.12);
      }
    }
    return set.mesh("lit");
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** How far back the camera sits so the planets fit; a narrow screen crops the outer ones rather than shrink them all. */
  private distance() {
    const fit = 158 / (this.camera.aspect * 2 * Math.tan((FOV * Math.PI) / 360));
    return Math.min(fit, 196) * this.zoom;
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

  zoomBy(factor: number) {
    this.zoom = clamp(this.zoom * factor, 0.22, 1.5);
  }

  showProbes(on: boolean) {
    this.probesOn = on;
    this.probes.visible = on;
    if (on) this.zoom = 1;
  }

  update(t: number, dt: number) {
    this.time = t;
    this.arrival = Math.min(ARRIVE_SECONDS, this.arrival + dt);
    if (!this.dragging) {
      this.az += this.spin.az * dt + dt * 0.012;
      this.el = clamp(this.el + this.spin.el * dt, 0.08, 1.4);
      this.spin.az *= Math.exp(-2.6 * dt);
      this.spin.el *= Math.exp(-2.6 * dt);
    }
    this.sunBall.rotation.y = t * SUN.spin;
    this.belt.rotation.y = t * 0.012;
    for (const { world, node, phase, around } of this.pivots) {
      const a = phase + (t / YEAR_SECONDS / world.year) * Math.PI * 2;
      node.position.set(Math.cos(a) * world.orbit, Math.sin(a) * world.orbit * (world.incline ?? 0), Math.sin(a) * world.orbit);
      if (around) node.position.add(around.position);
      (node.userData.ball as Object3D).rotation.y = t * world.spin;
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
    let best: World | null = null;
    let score = Infinity;
    for (const world of this.worlds) {
      const f = this.fix(world);
      if (f.depth > 1) continue;
      const d = Math.hypot(f.x - x, f.y - y);
      if (d > Math.max(slop, f.r + 4)) continue;
      const s = d / Math.max(f.r, 8);
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
    return this.time / YEAR_SECONDS;
  }

  destroy() {
    release(this.scene);
  }
}
