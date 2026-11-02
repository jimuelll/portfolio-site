/*
 * Inside two spiral galaxies, as they might look from in there: theoretical views. Andromeda from within one of its arms,
 * star clouds and dust all round and the warm core far ahead; the Milky Way from about where we really are, its band
 * wrapped round you, a little yellow star close by, and all of it recognisably the night sky from home, only nearer.
 */

import { AmbientLight, FogExp2, Scene, Vector3 } from "three";
import { hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import type { Interior, Spot } from "../inside";
import { VoxelSet } from "../voxels";
import { flows, skyDome, type Flow } from "./kit";

const r = (i: number, seed: number) => hash(i, seed, 521);
const BLUE: Rgb = [170, 198, 255], WARM: Rgb = [255, 222, 176], WHITE: Rgb = [236, 238, 246], PINK: Rgb = [240, 118, 170];

/** Stars thick along a plane through you, thin above and below it, brightest toward its centre. */
function plane(list: Flow[], count: number, tilt: number, toward: Vector3, seed: number, young: number) {
  for (let i = 0; i < count; i++) {
    const a = r(i, seed) * Math.PI * 2;
    const lift = (r(i, seed + 1) + r(i, seed + 2) + r(i, seed + 3) - 1.5) * 0.3 * (0.4 + r(i, seed + 4));
    const far = 560 + r(i, seed + 5) * 330;
    const x = Math.cos(a) * Math.cos(lift), y = Math.sin(lift), z = Math.sin(a) * Math.cos(lift);
    const cy = Math.cos(tilt), sy = Math.sin(tilt);
    const px = x * cy - y * sy, py = x * sy + y * cy;
    const near = Math.max(0, px * toward.x + py * toward.y + z * toward.z);
    // Toward the centre it's old and warm; along the arms, young and blue.
    const kind = r(i, seed + 6);
    const bright = r(i, seed + 7) ** 4;
    const colour = kind < young * (1 - near) ? BLUE : near > 0.6 && kind > 0.3 ? WARM : mix(WHITE, WARM, r(i, seed + 8) * 0.5);
    list.push({ start: [px * far, py * far, z * far], drift: [0, 0, 0], size: 2.2 + bright * 7 + near * 1.6, colour, alpha: 0.34 + bright * 0.66 + near * 0.3, rate: 0, phase: 0.2, twinkle: r(i, seed + 9) * 1.4 });
  }
}

/** The soft glow of millions of stars too faint to see one by one, in a broad band. */
function haze(list: Flow[], count: number, tilt: number, toward: Vector3, seed: number, colour: Rgb, core: Rgb) {
  for (let i = 0; i < count; i++) {
    const a = r(i, seed) * Math.PI * 2, lift = (r(i, seed + 1) + r(i, seed + 2) - 1) * 0.24;
    const x = Math.cos(a), y = Math.sin(lift), z = Math.sin(a);
    const cy = Math.cos(tilt), sy = Math.sin(tilt);
    const px = x * cy - y * sy, py = x * sy + y * cy;
    const near = Math.max(0, px * toward.x + py * toward.y + z * toward.z) ** 2;
    list.push({ start: [px * 820, py * 820, z * 820], drift: [0, 0, 0], size: 42 + r(i, seed + 3) * 60, colour: mix(colour, core, near), alpha: 0.004 + near * 0.01, rate: 0, phase: 0.2 });
  }
}

/** Dark clouds of dust against all that light: real cubes, so they hide what's behind them. */
function dust(tilt: number, toward: Vector3, count: number, size: number, seed: number) {
  const set = new VoxelSet();
  for (let i = 0; i < count; i++) {
    const a = r(i, seed) * Math.PI * 2;
    const lift = (r(i, seed + 1) - 0.5) * 0.3;
    const wisp = noise(Math.cos(a) * 2.4 + seed, lift * 9 + Math.sin(a) * 2.4, 522);
    if (wisp < 0.52) continue;
    const far = 380 + r(i, seed + 2) * 260;
    const x = Math.cos(a), y = Math.sin(lift) * 0.8, z = Math.sin(a);
    const cy = Math.cos(tilt), sy = Math.sin(tilt);
    const px = x * cy - y * sy, py = x * sy + y * cy;
    const near = Math.max(0, px * toward.x + py * toward.y + z * toward.z);
    const lit = smoothstep(0.86, 0.5, wisp);
    set.add(px * far, py * far, z * far, mix([10, 7, 10], [56, 34, 30], lit * (0.4 + near * 0.6)), size * (0.8 + r(i, seed + 3)), 0.15);
  }
  return set.mesh("glow");
}

/** A knot of a few hundred stars, seen from nearby. */
function cluster(list: Flow[], at: Vector3, count: number, spread: number, colour: Rgb, seed: number) {
  for (let i = 0; i < count; i++) {
    const a = r(i, seed) * Math.PI * 2, u = r(i, seed + 1) * 2 - 1, d = spread * r(i, seed + 2) ** 2.2, c = Math.sqrt(1 - u * u);
    const bright = r(i, seed + 3) ** 3;
    list.push({ start: [at.x + Math.cos(a) * c * d, at.y + u * d, at.z + Math.sin(a) * c * d], drift: [0, 0, 0], size: 2.5 + bright * 6, colour, alpha: 0.6 + bright * 0.8, rate: 0, phase: 0.2, twinkle: 1 });
  }
}

/** A pink cloud of glowing gas. */
function nebula(list: Flow[], at: Vector3, count: number, spread: number, colour: Rgb, seed: number) {
  for (let i = 0; i < count; i++) {
    const a = r(i, seed) * Math.PI * 2, u = r(i, seed + 1) * 2 - 1, d = spread * r(i, seed + 2), c = Math.sqrt(1 - u * u);
    list.push({ start: [at.x + Math.cos(a) * c * d, at.y + u * d * 0.6, at.z + Math.sin(a) * c * d], drift: [(r(i, seed + 3) - 0.5) * 8, 0, 0], size: 12 + r(i, seed + 4) * 26, colour: mix(colour, WHITE, r(i, seed + 5) * 0.25), alpha: 0.03 + r(i, seed + 6) * 0.04, rate: 0.008, phase: r(i, seed + 7), wobble: 3 });
  }
}

export function insideAndromeda(coarse: boolean): Interior {
  const scene = new Scene();
  const toward = new Vector3(0.14, 0.03, -1).normalize();
  const tilt = 0.26;
  scene.fog = new FogExp2(0x08060e, 0.0003);
  scene.add(skyDome([5, 6, 14], [8, 9, 20], [12, 10, 20], toward, [150, 106, 74], 7));
  scene.add(new AmbientLight(0xffffff, 0.7));
  scene.add(dust(tilt, toward, coarse ? 7000 : 15000, coarse ? 15 : 10, 30));

  const list: Flow[] = [];
  plane(list, coarse ? 4000 : 9000, tilt, toward, 1, 0.7);
  haze(list, coarse ? 500 : 1100, tilt, toward, 20, [90, 110, 190], [255, 196, 130]);
  // The core: old, warm stars by the billion, a long way ahead.
  const core = toward.clone().multiplyScalar(800);
  list.push({ start: [core.x, core.y, core.z], drift: [0, 0, 0], size: 150, colour: [255, 200, 140], alpha: 0.16, rate: 0, phase: 0.2 });
  list.push({ start: [core.x, core.y, core.z], drift: [0, 0, 0], size: 80, colour: [255, 240, 210], alpha: 0.8, rate: 0, phase: 0.2 });
  const blues = new Vector3(-260, 74, -330);
  cluster(list, blues, coarse ? 180 : 380, 62, BLUE, 40);
  const pink = new Vector3(230, -40, -300);
  nebula(list, pink, coarse ? 70 : 150, 70, PINK, 50);
  cluster(list, pink, 40, 40, BLUE, 60);
  const moving = flows(list);
  scene.add(moving.mesh);

  const spots: Spot[] = [
    { name: "andromeda's core", fact: "a black hole of about 100 million suns, at its heart", at: core },
    { name: "a blue star cluster", fact: "young, hot and short-lived: its arms are full of them", at: blues },
    { name: "a star nursery", fact: "pink hydrogen, glowing round its newest stars", at: pink },
    { name: "toward home", fact: "2.5 million light years that way, and closing", at: new Vector3(-0.72, 0.42, 0.55).multiplyScalar(700) },
  ];
  return {
    scene,
    fov: 64,
    lens: { center: 0.5, band: 0.95, blur: 1.4 },
    cell: 0.8,
    spots,
    path(t, eye, ahead) {
      eye.set(Math.sin(t * 0.03) * 34, Math.sin(t * 0.02) * 16, Math.sin(t * 0.016) * 60);
      ahead.set(eye.x + Math.sin(t * 0.012) * 90 + 40, eye.y + 12, eye.z - 300);
    },
    update(t) {
      moving.tick(t);
    },
    thin() {
      // The stars don't move and cost one draw; there's nothing here worth thinning out mid-flight.
    },
  };
}

export function insideMilkyWay(coarse: boolean): Interior {
  const scene = new Scene();
  // The way to the galaxy's centre, about where it lies in the sky from the sun.
  const toward = new Vector3(-0.5, -0.16, -0.85).normalize();
  const tilt = -0.32;
  scene.fog = new FogExp2(0x06070e, 0.0003);
  scene.add(skyDome([4, 5, 12], [6, 7, 16], [8, 8, 16], toward, [118, 92, 70], 8));
  scene.add(new AmbientLight(0xffffff, 0.7));
  // The Great Rift: the long dark lane you can see splitting the band from any dark hillside.
  scene.add(dust(tilt, toward, coarse ? 8000 : 18000, coarse ? 14 : 9, 70));

  const list: Flow[] = [];
  plane(list, coarse ? 4500 : 10000, tilt, toward, 80, 0.45);
  haze(list, coarse ? 600 : 1300, tilt, toward, 100, [110, 124, 170], [255, 214, 160]);
  // And stars all over: the nearby ones, in every direction, the ones with names.
  for (let i = 0; i < (coarse ? 500 : 1100); i++) {
    const a = r(i, 110) * Math.PI * 2, u = r(i, 111) * 2 - 1, c = Math.sqrt(1 - u * u), bright = r(i, 112) ** 3;
    list.push({ start: [Math.cos(a) * c * 800, u * 800, Math.sin(a) * c * 800], drift: [0, 0, 0], size: 2.4 + bright * 7, colour: mix(WHITE, r(i, 113) > 0.6 ? WARM : BLUE, 0.6), alpha: 0.4 + bright * 0.6, rate: 0, phase: 0.2, twinkle: 1.2 });
  }
  const sol = new Vector3(46, 8, -130);
  list.push({ start: [sol.x, sol.y, sol.z], drift: [0, 0, 0], size: 7, colour: [255, 236, 170], alpha: 2.4, rate: 0, phase: 0.2, twinkle: 0.2 });
  list.push({ start: [sol.x, sol.y, sol.z], drift: [0, 0, 0], size: 26, colour: [255, 214, 130], alpha: 0.4, rate: 0, phase: 0.2 });
  const centre = toward.clone().multiplyScalar(810);
  list.push({ start: [centre.x, centre.y, centre.z], drift: [0, 0, 0], size: 120, colour: [255, 208, 150], alpha: 0.14, rate: 0, phase: 0.2 });
  const orion = new Vector3(320, 50, -180);
  nebula(list, orion, coarse ? 70 : 150, 58, PINK, 120);
  cluster(list, orion, 30, 28, BLUE, 130);
  const pleiades = new Vector3(-180, 170, 230);
  cluster(list, pleiades, coarse ? 60 : 120, 26, BLUE, 140);
  const moving = flows(list);
  scene.add(moving.mesh);

  const spots: Spot[] = [
    { name: "you are here", fact: "the sun: one star of a few hundred billion", at: sol },
    { name: "galactic centre", fact: "26,000 light years off, hidden behind the dust", at: centre },
    { name: "the orion nebula", fact: "our nearest big nursery: you can go there, too", at: orion },
    { name: "the pleiades", fact: "the seven sisters: young stars, seen from all over Earth", at: pleiades },
    { name: "the great rift", fact: "dust, not a gap: it blocks the stars behind it", at: toward.clone().multiplyScalar(520).add(new Vector3(0.3, 0.02, -0.1).multiplyScalar(150)) },
  ];
  return {
    scene,
    fov: 64,
    lens: { center: 0.5, band: 0.95, blur: 1.4 },
    cell: 0.8,
    spots,
    path(t, eye, ahead) {
      eye.set(Math.sin(t * 0.025) * 26, Math.sin(t * 0.018) * 12, Math.cos(t * 0.02) * 26);
      ahead.set(sol.x * 0.6 + Math.sin(t * 0.014) * 80, sol.y + 6, sol.z);
    },
    update(t) {
      moving.tick(t);
    },
    thin() {
      // The stars don't move and cost one draw; there's nothing here worth thinning out mid-flight.
    },
  };
}
