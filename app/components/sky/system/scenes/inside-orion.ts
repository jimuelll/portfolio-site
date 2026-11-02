/*
 * Inside the Orion Nebula, as it might look from in there: a theoretical view. The four Trapezium stars have blown a
 * hollow in the cloud, and you drift round inside it, with walls of glowing gas on every side, a dark bay of dust cutting
 * across them, and young stars still wrapped in discs of the stuff planets are made from.
 */

import { AmbientLight, FogExp2, Scene, Vector3 } from "three";
import { hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import type { Interior, Spot } from "../inside";
import { VoxelSet } from "../voxels";
import { flows, skyDome, type Flow } from "./kit";
import { stars } from "./moon";

const CORE: Rgb = [214, 250, 232], GREEN: Rgb = [104, 210, 180], ROSE: Rgb = [236, 110, 146], RED: Rgb = [176, 46, 70], DUST: Rgb = [28, 16, 22];
const TRAPEZIUM = new Vector3(0, 95, -70);
/** Where the dust of the dark bay lies, as seen from the middle. */
const BAY = new Vector3(-0.72, 0.18, -0.67).normalize();

/** Round the inside of a sphere: points spread evenly, each pushed in and out by the lie of the gas. */
function walls(coarse: boolean) {
  const set = new VoxelSet();
  const n = coarse ? 11000 : 24000;
  const size = coarse ? 13 : 9;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2, c = Math.sqrt(1 - y * y), a = i * golden;
    const dx = Math.cos(a) * c, dz = Math.sin(a) * c;
    const big = noise(dx * 1.8 + 3, y * 1.8 + dz * 1.8, 511), small = noise(dx * 5 + dz * 3, y * 5, 512);
    const r = 300 * (0.86 + big * 0.5 + small * 0.1);
    const bay = dx * BAY.x + y * BAY.y + dz * BAY.z;
    // Hottest nearest the stars that are lighting it, red at the far reaches.
    const toStars = (dx * TRAPEZIUM.x + y * TRAPEZIUM.y + dz * TRAPEZIUM.z) / TRAPEZIUM.length();
    const heat = smoothstep(-0.6, 0.95, toStars + (small - 0.5) * 0.5);
    let col = heat > 0.5 ? mix(GREEN, CORE, (heat - 0.5) * 2) : mix(RED, mix(ROSE, GREEN, heat * 1.6), heat * 2);
    // Mostly in deep shade: only the ridges facing the stars burn bright, so they don't drown out the stars themselves.
    const ridge = smoothstep(0.42, 0.78, small * 0.6 + big * 0.5);
    col = mix([12, 10, 18], col, 0.12 + ridge * 0.62);
    // The lane of dust across the near wall, dark where there's no light on it.
    col = mix(col, DUST, smoothstep(0.78, 0.94, bay + (big - 0.5) * 0.2));
    set.add(dx * r, y * r, dz * r, col, size * (0.8 + small * 0.7), 0.12);
  }
  return set.mesh("glow");
}

/** A young star in the dark disc it's still gathering, the disc's outer edge lit: a proplyd. */
function proplyds() {
  const set = new VoxelSet();
  const spots: Vector3[] = [];
  const list: Flow[] = [];
  for (let i = 0; i < 7; i++) {
    const a = hash(i, 1, 513) * Math.PI * 2, h = (hash(i, 2, 513) - 0.5) * 120;
    const at = new Vector3(Math.cos(a) * (120 + hash(i, 3, 513) * 70), h, Math.sin(a) * (120 + hash(i, 3, 513) * 70));
    spots.push(at);
    const R = 7 + hash(i, 4, 513) * 5;
    for (let u = -R; u <= R; u += 1.4) {
      for (let v = -R; v <= R; v += 1.4) {
        const d = Math.hypot(u, v);
        if (d > R || d < 1.8) continue;
        const col = mix([26, 18, 22], [224, 150, 124], smoothstep(0.72, 1, d / R));
        set.add(at.x + u, at.y + v * 0.35, at.z + v * 0.9, col, 1.5, 0.1);
      }
    }
    list.push({ start: [at.x, at.y, at.z], drift: [0, 0, 0], size: 7, colour: [255, 226, 180], alpha: 1.7, rate: 0, phase: 0.2, twinkle: 0.8 });
    // Its gas blown back, away from the Trapezium, in a little tail.
    const away = at.clone().sub(TRAPEZIUM).normalize().multiplyScalar(44);
    for (let k = 0; k < 16; k++) {
      list.push({ start: [at.x, at.y, at.z], drift: [away.x, away.y, away.z], size: 3 + hash(i, k, 514) * 3, colour: [130, 226, 196], alpha: 0.5, fade: 1, rate: 0.05, phase: k / 16, wobble: 2 });
    }
  }
  return { mesh: set.mesh("glow"), spots, list };
}

export function insideOrion(coarse: boolean): Interior {
  const scene = new Scene();
  scene.fog = new FogExp2(0x2c1626, 0.0007);
  scene.add(skyDome([18, 10, 22], [30, 14, 28], [30, 12, 24], TRAPEZIUM, [150, 240, 214], 5));
  scene.add(new AmbientLight(0xffffff, 0.7));
  scene.add(walls(coarse));
  const disc = proplyds();
  scene.add(disc.mesh);

  const sky = stars(coarse ? 500 : 1000);
  scene.add(sky.mesh);

  const r = (i: number, seed: number) => hash(i, seed, 515);
  const gas: Flow[] = [...disc.list];
  // The four stars, each blazing, and a haze of light round them.
  const four = [[-13, 6, -6], [12, 9, 3], [-5, -11, 8], [15, -8, -9]];
  for (const [x, y, z] of four) {
    gas.push({ start: [TRAPEZIUM.x + x, TRAPEZIUM.y + y, TRAPEZIUM.z + z], drift: [0, 0, 0], size: 12, colour: [240, 248, 255], alpha: 2.4, rate: 0, phase: 0.2, twinkle: 0.4 });
  }
  gas.push({ start: [TRAPEZIUM.x, TRAPEZIUM.y, TRAPEZIUM.z], drift: [0, 0, 0], size: 150, colour: [120, 230, 200], alpha: 0.1, rate: 0, phase: 0.2 });
  for (let i = 0; i < (coarse ? 250 : 520); i++) {
    const a = r(i, 1) * Math.PI * 2, far = 40 + r(i, 2) * 230, y = (r(i, 3) - 0.5) * 360;
    const hot = smoothstep(260, 40, Math.hypot(Math.cos(a) * far - TRAPEZIUM.x, y - TRAPEZIUM.y, Math.sin(a) * far - TRAPEZIUM.z));
    gas.push({
      start: [Math.cos(a) * far, y, Math.sin(a) * far], drift: [(r(i, 4) - 0.5) * 34, (r(i, 5) - 0.5) * 34, (r(i, 6) - 0.5) * 34],
      size: 18 + r(i, 7) * 40, colour: mix(ROSE, GREEN, hot), alpha: 0.005 + r(i, 8) * 0.008, rate: 0.01, phase: r(i, 9), wobble: 6,
    });
  }
  const moving = flows(gas);
  scene.add(moving.mesh);

  const spots: Spot[] = [
    { name: "the trapezium", fact: "four young stars lighting up the whole nebula", at: TRAPEZIUM },
    { name: "a proplyd", fact: "a young star in a disc that could still make planets", at: disc.spots[0] },
    { name: "a proplyd", fact: "the Trapezium's light is stripping this disc away", at: disc.spots[3] },
    { name: "the dark bay", fact: "a lane of cold dust, right across the nebula's face", at: BAY.clone().multiplyScalar(290) },
    { name: "the walls", fact: "hydrogen and oxygen, glowing in the stars' light", at: new Vector3(0.62, -0.25, -0.74).multiplyScalar(320) },
  ];

  return {
    scene,
    fov: 68,
    lens: { center: 0.5, band: 0.95, blur: 1 },
    cell: 0.8,
    spots,
    // A slow, wide circle round the hollow, always turning to keep the stars in view.
    path(t, eye, ahead) {
      const a = t * 0.024 + 1.2;
      eye.set(Math.cos(a) * 92, -30 + Math.sin(t * 0.03) * 34, Math.sin(a) * 92 + 40);
      ahead.set(TRAPEZIUM.x + Math.sin(t * 0.02) * 40, TRAPEZIUM.y - 50, TRAPEZIUM.z);
    },
    update(t) {
      moving.tick(t);
      sky.tick(t);
    },
    thin() {
      // One draw of points and one set of cubes that never move: there's nothing here worth thinning out mid-flight.
    },
  };
}
