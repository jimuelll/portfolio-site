/*
 * Jupiter: high over the Great Red Spot, a storm wider than Earth that has been turning since at least the 1830s. The bands part
 * and go round it. Now and then the small black shadow of Io slides across the clouds, as it does every day and a half, with Io
 * itself hanging over the limb. Juno is below you on its long loop, turning on its three wings like a slow windmill. Tap it.
 */

import { AmbientLight, DirectionalLight, Group, type MeshBasicMaterial, Scene, Vector3 } from "three";
import { hash, mix, noise, type Rgb } from "../../engine";
import { Motes, VoxelSet } from "../voxels";
import { stars } from "./moon";
import { cloudDeck } from "./giants";
import { flows, type Flow, type Place } from "./kit";

const R = 1400;
const SPOT = new Vector3(-10, 0, -170);
const SPOT_X = 128, SPOT_Z = 76;
const EYE = new Vector3(-6, 262, 58);

const surface = (x: number, z: number) => -(x * x + z * z) / (2 * R);

function ball(r: number, voxel: number, paint: (x: number, y: number, z: number) => Rgb) {
  const set = new VoxelSet();
  set.ball(0, 0, 0, r / voxel, voxel, paint, 0.03);
  const mesh = set.mesh("glow");
  (mesh.material as MeshBasicMaterial).fog = false;
  return mesh;
}

/** Juno: a stubby armoured drum, and three long solar wings, because it's the furthest out anything has gone on sunlight. */
function juno() {
  const body = new Group();
  const set = new VoxelSet();
  const s = 0.5;
  for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) for (let y = -2; y <= 2; y++) if (Math.hypot(a, b) < 6.2) set.box(a * s, y * s, b * s, s, s, s, y === 2 ? [206, 206, 200] : (a + b + y) % 3 ? [214, 160, 66] : [160, 116, 50]);
  for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) if (a * a + b * b <= 25) set.box(a * s, 1.7 - (a * a + b * b) * 0.02, b * s, s, 0.2, s, [244, 244, 238]);
  for (let w = 0; w < 3; w++) {
    const a = (w / 3) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
    for (let k = 0; k < 34; k++) {
      for (let j = -4; j <= 4; j++) {
        const along = 3.4 + k * 0.5;
        // The last stretch of one is the boom with the magnetometers on it.
        if (w === 0 && k > 26 && Math.abs(j) > 1) continue;
        set.box(cx * along - cz * j * 0.5, 0, cz * along + cx * j * 0.5, 0.52, 0.12, 0.52, w === 0 && k > 26 ? [200, 200, 206] : k % 7 === 0 ? [176, 180, 200] : mix([24, 40, 110], [46, 72, 164], hash(k, j + w * 20, 310)));
      }
    }
  }
  body.add(set.mesh("lit"));
  return body;
}

export const greatRedSpot: Place = {
  id: "jupiter",
  name: "the great red spot",
  world: "jupiter",
  coords: "22°s · wider than earth",
  build(coarse) {
    const scene = new Scene();
    const sun = new DirectionalLight(0xfff1dc, 3.4);
    sun.position.set(-120, 120, 90);
    scene.add(sun, new AmbientLight(0xd8b08c, 0.9));

    const sky = stars(coarse ? 1100 : 2400);
    // Tipped down, since from this high up the whole of the sky you can see is below level.
    sky.mesh.rotation.x = -0.72;
    scene.add(sky.mesh);

    const deck = cloudDeck({
      R, wrap: 900, lift: 0,
      rows: [
        { fromZ: -360, toZ: 70, step: coarse ? 4.4 : 3, halfX: 340 },
        { fromZ: -900, toZ: 240, step: coarse ? 9 : 6.5, halfX: 900, hole: [340, -360, 70] },
      ],
      rise: (x, z) => {
        const r = Math.hypot((x - SPOT.x) / SPOT_X, (z - SPOT.z) / SPOT_Z);
        return noise(x * 0.05, z * 0.09, 311) * 5 + noise(x * 0.18, z * 0.3, 312) * 1.6 + (r < 1 ? (1 - r * r) * 12 : 0);
      },
      // The colour's all in the shader, since it's the colour that moves. This is just the grain.
      paint: (x, z) => {
        const g = 196 + noise(x * 0.3, z * 0.4, 313) * 59;
        return [g, g, g];
      },
      shade: `
      vec2 q = (p.xz - vec2(${SPOT.x.toFixed(1)}, ${SPOT.z.toFixed(1)})) / vec2(${SPOT_X.toFixed(1)}, ${SPOT_Z.toFixed(1)});
      float r = length(q);
      float a = atan(q.y, q.x);
      // The bands, pushed aside around the storm the way a stream goes round a rock.
      float push = exp(-max(0.0, r - 1.0) * 1.5);
      float lat = p.z + q.y * ${SPOT_Z.toFixed(1)} * push * 0.85;
      float jet = 0.09 * sin(lat * 0.031) + 0.05;
      float wave = sin(p.x * 0.018 + uTime * jet + sin(lat * 0.05) * 2.4) * 7.0 + sin(p.x * 0.052 - uTime * jet * 1.7 + lat * 0.08) * 3.0;
      float b = lat + wave;
      float banding = 0.5 + 0.5 * sin(b * 0.03) * cos(b * 0.011 + 1.0);
      float fine = 0.5 + 0.5 * sin(b * 0.17 + sin(p.x * 0.03) * 1.4);
      vec3 c = mix(vec3(0.58, 0.36, 0.25), vec3(0.95, 0.87, 0.72), banding);
      c = mix(c, c * vec3(0.8, 0.72, 0.66), fine * 0.45);
      // The storm: red-orange arms winding in, turning as one, slowly, with a calm in the middle and a pale collar round it.
      float arms = 0.5 + 0.5 * sin(a * 2.0 + log(r + 0.08) * 11.0 + uTime * 0.11) * sin(a * 5.0 + r * 9.0 + uTime * 0.07);
      vec3 storm = mix(vec3(0.72, 0.28, 0.17), vec3(0.88, 0.47, 0.31), arms);
      storm = mix(vec3(0.84, 0.42, 0.28), storm, smoothstep(0.04, 0.38, r));
      c = mix(c, vec3(0.92, 0.82, 0.68), smoothstep(1.2, 1.06, r) * smoothstep(0.9, 1.06, r) * 0.8);
      c = mix(c, storm, smoothstep(1.02, 0.86, r));
      // Io's shadow: small, round, black, and in no hurry.
      float run = mod(uTime * 5.0, 1500.0) - 700.0;
      c *= smoothstep(9.0, 14.0, length(p.xz - vec2(run, -120.0 + run * 0.06)));
      // The limb darkens, and goes a little hazy.
      float out_ = length(p.xz - vec2(${EYE.x.toFixed(1)}, ${EYE.z.toFixed(1)})) / 900.0;
      c *= 1.0 - smoothstep(0.35, 1.0, out_) * 0.72;
      vTint = c;`,
    });
    scene.add(deck.mesh);

    // Io and Europa, over the limb.
    const io = ball(13, 1.1, (x, y, z) => {
      const n = noise(x * 3.5 + 2, y * 3.5 + z * 2.4, 314);
      return n > 0.72 ? [70, 36, 24] : n > 0.5 ? [232, 150, 60] : [244, 220, 110];
    });
    io.position.set(-240, -6, -760);
    const europa = ball(9, 0.9, (x, y, z) => (noise(x * 6 + y * 3, z * 6, 315) > 0.66 ? [176, 120, 92] : [232, 226, 216]));
    europa.position.set(232, 58, -840);
    scene.add(io, europa);

    // Lightning down in the belts, and the white wisps that go round the storm's rim.
    const list: Flow[] = [];
    const r = (i: number, s: number) => hash(i, s, 316);
    for (let k = 0; k < 24; k++) {
      const x = (r(k, 1) - 0.5) * 640, z = -30 - r(k, 2) * 420, period = 4 + r(k, 3) * 9;
      for (let i = 0; i < 14; i++) list.push({ start: [x + (r(k * 20 + i, 4) - 0.5) * 18, surface(x, z) + 8, z + (r(k * 20 + i, 5) - 0.5) * 14], drift: [0, 0, 0], size: 2 + r(k * 20 + i, 6) * 4, colour: [216, 226, 255], alpha: 0.55, rate: 1 / period, phase: r(k, 7), window: 0.025 });
    }
    const flashes = flows(list);
    scene.add(flashes.mesh);
    const WISPS = coarse ? 170 : 380;
    const wisps = new Motes(WISPS, (i) => mix([255, 240, 220], [255, 190, 150], hash(i, 1, 317)));
    scene.add(wisps.mesh);
    let live = WISPS;

    const probe = juno();
    scene.add(probe);
    const spot = new Vector3();
    let calledAt = -100, spin = 0, previous = 0;

    return {
      scene,
      eye: EYE,
      at: new Vector3(-4, 62, -190),
      fov: 50,
      lens: { center: 0.42, band: 0.42, blur: 4 },
      cell: 0.72,
      pullback: 0.5,
      ground: surface,
      sun,
      actor: spot,
      actorSize: 9,
      update(t) {
        const step = Math.min(0.1, Math.max(0, t - previous));
        previous = t;
        sky.tick(t);
        deck.time.value = t;
        flashes.tick(t);
        io.rotation.y = t * 0.03;
        europa.rotation.y = -t * 0.02;
        // Twice a minute, in real life. A nudge and it's briefly showing off.
        const since = t - calledAt;
        spin += step * (0.21 + (since < 5 ? (1 - since / 5) * 1.5 : 0));
        spot.set(10 + Math.sin(t * 0.03) * 14, 184 + Math.sin(t * 0.05) * 4, -34 + Math.cos(t * 0.04) * 8);
        probe.position.copy(spot);
        probe.rotation.set(0.62, spin, -0.3);
        for (let i = 0; i < live; i++) {
          // Round the storm, the far side of its rim moving at its own speed, in loose bright threads.
          const ring = 0.9 + hash(i, 2, 317) * 0.45, a = hash(i, 3, 317) * 6.283 + t * 0.07 / ring;
          const x = SPOT.x + Math.cos(a) * ring * SPOT_X, z = SPOT.z + Math.sin(a) * ring * SPOT_Z;
          wisps.place(i, x, surface(x, z) + 15 + hash(i, 4, 317) * 6, z, 0.6 + hash(i, 5, 317) * 0.8, 0.3);
        }
        wisps.commit();
      },
      poke(t) {
        calledAt = t;
        return "juno · three wings, turning twice a minute";
      },
      thin(share) {
        live = Math.round(WISPS * share);
        wisps.mesh.count = live;
      },
    };
  },
};
