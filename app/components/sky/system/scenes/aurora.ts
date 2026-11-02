/*
 * Low Earth orbit, 408 km up, where the station flies: the night side sliding by below and the aurora standing on the limb,
 * green at its foot where the oxygen is thick, fading to red at the top where it's thin. Everyone who has been up here says
 * the same thing about it, and they mostly say it out on the truss, as this one is. It's on the way round Earth's places, from
 * Fushimi. Tap the astronaut and they'll wave.
 */

import { AdditiveBlending, AmbientLight, BackSide, DirectionalLight, HemisphereLight, Mesh, type MeshBasicMaterial, Scene, ShaderMaterial, SphereGeometry, Vector3 } from "three";
import { hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import { VoxelSet } from "../voxels";
import { astronaut, stars } from "./moon";
import { flows, type Flow, type Place } from "./kit";

/** Earth's radius in scene units, which puts the station 64 up and the horizon where it truly is, 20° below level. */
const R = 1000;
const ALTITUDE = 64;
/** The ground wraps round this length, from beyond the horizon to behind the camera. */
const FROM_Z = -420, TO_Z = 60;
/** Five times the real 7.66 km/s, or you'd take it for a photograph. */
const SPEED = 6;
const SUNWARD = new Vector3(0.86, -0.12, -0.5).normalize();

/** The surface curving away below the station. The parabola is true to within a few units as far as the horizon. */
const surface = (x: number, z: number) => -(x * x + z * z) / (2 * R);

/** Noise measured round a circle in z, so the two ends of the strip meet where it wraps. */
function round(x: number, z: number, fx: number, wide: number, seed: number) {
  const a = ((z - FROM_Z) / (TO_Z - FROM_Z)) * Math.PI * 2;
  return noise(x * fx + Math.cos(a) * wide + 40, Math.sin(a) * wide + x * fx * 0.4 + 40, seed);
}
const isLand = (x: number, z: number) => round(x, z, 0.012, 7, 190) > 0.5;
const cloudOver = (x: number, z: number) => smoothstep(0.54, 0.72, round(x, z, 0.022, 14, 191) * 0.7 + round(x, z, 0.07, 34, 192) * 0.3);

/** Cities: only ever on land, and gathered into a few crowded regions, with sea and wilderness dark between them. */
const CITIES: { x: number; z: number; r: number }[] = [];
for (let i = 0; i < 700 && CITIES.length < 120; i++) {
  const x = (hash(i, 1, 193) - 0.5) * 800, z = FROM_Z + hash(i, 2, 193) * (TO_Z - FROM_Z);
  if (isLand(x, z) && round(x, z, 0.02, 11, 194) > 0.5) CITIES.push({ x, z, r: 4 + hash(i, 3, 193) ** 3.4 * 30 });
}

function nightColour(x: number, z: number): Rgb {
  let c: Rgb = isLand(x, z) ? [11, 13, 13] : [3, 6, 15];
  // The glow a big city puts on the ground around it, which is what makes a pool of it rather than a scatter.
  let glow = 0;
  for (const city of CITIES) {
    const dx = Math.abs(x - city.x);
    if (dx > city.r * 1.5) continue;
    const away = Math.abs(z - city.z), dz = Math.min(away, TO_Z - FROM_Z - away);
    glow = Math.max(glow, smoothstep(city.r * 1.5, 0, Math.hypot(dx, dz)) ** 2 * Math.min(1, city.r / 14));
  }
  c = mix(c, [196, 116, 48], glow * 0.8);
  // Moonlit cloud, which dims the lights under it.
  return mix(c, [34, 42, 58], cloudOver(x, z) * 0.86);
}

/** The lights themselves: far smaller than the ground's cubes, crowded at each centre and thinning outward, a few white-hot in the middle. */
function cityLights(set: VoxelSet, lift: number, coarse: boolean) {
  CITIES.forEach((city, k) => {
    const count = Math.round(Math.min(620, 18 + city.r * city.r * 1.5) * (coarse ? 0.5 : 1));
    for (let i = 0; i < count; i++) {
      const a = hash(k, i, 195) * Math.PI * 2, out = hash(k, i, 196) ** 1.9;
      // Spreading along a couple of arms rather than evenly: roads, and the towns on them.
      const arm = 1 + Math.sin(a * 3 + k) * 0.45;
      const x = city.x + Math.cos(a) * out * city.r * arm;
      const z = FROM_Z + ((((city.z + Math.sin(a) * out * city.r * arm - FROM_Z) % (TO_Z - FROM_Z)) + (TO_Z - FROM_Z)) % (TO_Z - FROM_Z));
      if (!isLand(x, z) || cloudOver(x, z) > 0.6) continue;
      const hot = (1 - out) ** 2 * Math.min(1, city.r / 12);
      const s = 0.7 + hot * 0.8 + hash(k, i, 197) * 0.3;
      set.box(x, surface(x, z) + lift, z, s, s, s, mix([226, 138, 62], [255, 240, 204], hot));
    }
  });
}

/** The night side as one strip, its cubes slid along the curve in the shader, so the whole world goes by for the price of one number. */
function nightSide(coarse: boolean) {
  const set = new VoxelSet();
  const step = coarse ? 3.6 : 2.4;
  for (let x = -420; x < 420; x += step) {
    for (let z = FROM_Z; z < TO_Z; z += step) {
      if (x * x + z * z > 450 * 450) continue;
      set.box(x, surface(x, z), z, step, step, step, nightColour(x, z));
    }
  }
  cityLights(set, step * 0.5 + 0.2, coarse);
  const mesh = set.mesh("glow");
  const time = { value: 0 };
  (mesh.material as MeshBasicMaterial).onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vec3 at = instanceMatrix[3].xyz;
      float z = mod(at.z - (${FROM_Z.toFixed(1)}) + uTime * ${SPEED.toFixed(1)}, ${(TO_Z - FROM_Z).toFixed(1)}) + (${FROM_Z.toFixed(1)});
      // Whatever height it had over the ground it keeps, which is how the lights stay on top.
      float y = at.y + (at.z * at.z - z * z) / ${(2 * R).toFixed(1)};
      transformed.y += (y - at.y) / instanceMatrix[1][1];
      transformed.z += (z - at.z) / instanceMatrix[2][2];`,
    );
  };
  return { mesh, time };
}

/** The thin bright edge of the air, blue on the night side and going to orange where the sun is about to come up. */
function limb() {
  const mesh = new Mesh(
    new SphereGeometry(R + 9, 128, 64),
    new ShaderMaterial({
      transparent: true, depthWrite: false, blending: AdditiveBlending, side: BackSide,
      uniforms: { uSun: { value: SUNWARD } },
      vertexShader: "varying vec3 vN; varying vec3 vV; void main() { vN = normalize(position); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition); gl_Position = projectionMatrix * mv; }",
      fragmentShader: `
        varying vec3 vN; varying vec3 vV;
        uniform vec3 uSun;
        void main() {
          float edge = pow(1.0 - abs(dot(vN, vV)), 9.0);
          float dawn = smoothstep(0.4, 0.98, dot(vN, uSun));
          vec3 c = mix(vec3(0.16, 0.42, 0.95) * 0.4, mix(vec3(1.0, 0.42, 0.12), vec3(1.0, 0.92, 0.72), dawn * dawn), dawn);
          gl_FragColor = vec4(c * edge * (1.2 + dawn * 3.0), 1.0);
        }`,
    }),
  );
  mesh.position.y = -R;
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * One curtain: soft grains stacked along a wandering line. It's light in thin air, so it has no edge anywhere: it swells out
 * of the dark at the foot, is brightest a little way up, and each stretch of it gives out at its own height.
 */
function curtain(line: (x: number) => number, fromX: number, toX: number, seed: number, tall: number, coarse: boolean) {
  const list: Flow[] = [];
  const r = (i: number, s: number) => hash(i, s, seed);
  const gap = coarse ? 3.4 : 2.1;
  let ray = 0;
  for (let x = fromX; x < toX; x += gap, ray++) {
    const fold = noise(x * 0.018, seed, 196);
    const z = line(x);
    const base = surface(x, z) + 11 + fold * 12;
    // Broad swells and narrower peaks together, so the top is a skyline of tall and short and never a hedge.
    const reach = noise(x * 0.012, seed + 1, 197) * 0.8 + noise(x * 0.055, seed + 3, 197) ** 2 * 0.9;
    const height = tall * (0.22 + reach * 1.05);
    const bright = smoothstep(0.26, 0.62, noise(x * 0.016 + 9, seed + 2, 198));
    const grains = coarse ? 10 : 18;
    for (let g = 0; g < grains; g++) {
      const up = r(ray * 40 + g, 1) ** 1.25;
      const colour = up < 0.55 ? mix([74, 232, 140], [58, 206, 138], up / 0.55) : mix([58, 206, 138], [186, 58, 120], (up - 0.55) / 0.45);
      const swell = smoothstep(0, 0.32, up) * (1 - smoothstep(0.42, 1, up)) ** 0.8;
      list.push({
        start: [x + (r(ray * 40 + g, 2) - 0.5) * gap * 2.6, base + up * height, z + (r(ray * 40 + g, 3) - 0.5) * 5], drift: [0, 3, 0], size: 6 + up * 7 + r(ray * 40 + g, 4) * 3, colour,
        alpha: (0.016 + bright * 0.07) * swell, rate: 0.04, phase: r(ray * 40 + g, 5), twinkle: 0.9, wobble: 2.2,
      });
    }
  }
  return flows(list);
}

/** Storms far below, each just a flash inside its cloud, and the odd meteor going in beneath you. */
function belowUs(coarse: boolean) {
  const list: Flow[] = [];
  const r = (i: number, s: number) => hash(i, s, 199);
  for (let k = 0; k < (coarse ? 14 : 30); k++) {
    const x = (r(k, 1) - 0.5) * 460, z = -40 - r(k, 2) * 250, period = 3 + r(k, 3) * 9;
    for (let i = 0; i < 16; i++) {
      list.push({ start: [x + (r(k * 30 + i, 4) - 0.5) * 12, surface(x, z) + 2, z + (r(k * 30 + i, 5) - 0.5) * 8], drift: [0, 0, 0], size: 1 + r(k * 30 + i, 6) * 2.6, colour: [214, 226, 255], alpha: 0.6, rate: 1 / period, phase: r(k, 7), window: 0.03 });
    }
  }
  for (let m = 0; m < 3; m++) {
    const x = -160 + m * 170, z = -210 - m * 26, period = 13 + m * 7;
    for (let j = 0; j < 22; j++) {
      list.push({ start: [x, surface(x, z) + 24, z], drift: [34, -20, 8], size: 0.9 * (1 - j / 26), colour: mix([236, 255, 226], [120, 236, 170], j / 22), alpha: 1.1 * (1 - j / 22), rate: 1 / period, phase: m * 0.31 - j * 0.0009, window: 0.07 });
    }
  }
  return flows(list);
}

/** The part of the station in view: the end of the truss with a foot restraint on it, and one solar wing running off out of frame. */
function station() {
  const set = new VoxelSet();
  const metal: Rgb = [206, 210, 220], dim: Rgb = [112, 118, 134], gold: Rgb = [226, 176, 92];
  const along = (k: number) => [-9 + k * 0.54, 56.6 - k * 0.12, -21 - k * 0.2] as const;
  for (let k = 0; k < 96; k++) {
    const [x, y, z] = along(k);
    // Four longerons, with a brace every few bays.
    for (const [a, b] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) set.box(x, y + b, z + a, 0.6, 0.26, 0.26, k % 12 < 2 ? gold : metal);
    if (k % 12 === 0) for (let s = -9; s <= 9; s++) { set.box(x, y + s * 0.122, z + 1.1, 0.24, 0.16, 0.24, dim); set.box(x, y + s * 0.122, z - 1.1, 0.24, 0.16, 0.24, dim); set.box(x, y - 1.1, z + s * 0.122, 0.24, 0.24, 0.16, dim); }
  }
  // The wing: a thousand little dark cells, facing away from a sun that isn't up yet.
  const [wx, wy, wz] = along(52);
  for (let a = 0; a < 72; a++) {
    for (let b = -12; b <= 12; b++) {
      const seam = a % 6 === 0 || b === 0;
      set.box(wx + a * 0.72, wy - 2.4 - a * 0.16 + b * 0.04, wz - 3 + b * 0.62 - a * 0.1, 0.7, 0.08, 0.6, seam ? [170, 150, 96] : mix([18, 30, 72], [30, 48, 110], hash(a, b, 200)));
    }
  }
  // The foot restraint they're plugged into.
  const [fx, fy, fz] = along(26);
  set.box(fx, fy + 1.7, fz, 1.7, 0.16, 1, [226, 226, 214]);
  set.box(fx, fy + 1.4, fz, 0.2, 0.6, 0.2, metal);
  return { mesh: set.mesh("lit"), stand: new Vector3(fx, fy + 1.8, fz) };
}

export const aurora: Place = {
  id: "aurora",
  name: "aurora",
  world: "earth",
  coords: "408 km up",
  build(coarse) {
    const scene = new Scene();
    // Only the station takes the light: that green from over the limb, and a hard warm edge from the sun about to come up,
    // catching what faces it and leaving the rest a silhouette.
    const sun = new DirectionalLight(0xffdcb4, 5.5);
    sun.position.copy(SUNWARD).setY(0.5).multiplyScalar(100);
    scene.add(sun, new HemisphereLight(0x8cf0b4, 0x24304a, 2.4), new AmbientLight(0x6c7ea0, 1.6));

    const sky = stars(coarse ? 1500 : 3200);
    // Tipped down, since most of the sky to see from up here is below level.
    sky.mesh.rotation.x = -0.36;
    const ground = nightSide(coarse);
    const air = limb();
    const flickers = belowUs(coarse);
    const curtains = [
      curtain((x) => -292 + (x * x) / 1900 + Math.sin(x * 0.012) * 26, -340, 340, 201, 60, coarse),
      curtain((x) => -252 + (x * x) / 2400 + Math.sin(x * 0.017 + 2) * 18, -300, 210, 202, 40, coarse),
      curtain((x) => -322 + (x * x) / 1500 + Math.sin(x * 0.009 + 4) * 30, -120, 380, 203, 74, coarse),
    ];
    scene.add(sky.mesh, ground.mesh, air, flickers.mesh, ...curtains.map((c) => c.mesh));

    const iss = station();
    scene.add(iss.mesh);
    const { body, arm } = astronaut();
    body.position.copy(iss.stand);
    body.scale.setScalar(1.1);
    // Their helmet lamps, the one thing out here that's on purpose.
    const lamps = new VoxelSet();
    lamps.box(-0.42, 3.42, 0.56, 0.2, 0.14, 0.1, [255, 248, 224]);
    lamps.box(0.42, 3.42, 0.56, 0.2, 0.14, 0.1, [255, 248, 224]);
    body.add(lamps.mesh("glow"));
    scene.add(body);
    const spot = iss.stand.clone();
    spot.y += 1.8;
    let wavedAt = -100;

    return {
      scene,
      eye: new Vector3(-4, ALTITUDE + 2, 8),
      at: new Vector3(5, 43, -64),
      fov: 42,
      lens: { center: 0.5, band: 0.4, blur: 3 },
      cell: 0.72,
      pullback: 0.3,
      ground: surface,
      sun,
      actor: spot,
      actorSize: 3,
      update(t) {
        sky.tick(t);
        ground.time.value = t;
        flickers.tick(t);
        // The curtains drifting and folding, each at its own pace, slowly enough to look like weather.
        curtains.forEach((c, i) => {
          c.tick(t);
          c.mesh.position.x = Math.sin(t * (0.05 + i * 0.016) + i * 2) * 22;
          c.mesh.position.z = Math.cos(t * (0.04 + i * 0.012) + i) * 10;
        });
        const since = t - wavedAt;
        const waving = since < 4.5;
        body.rotation.y = waving ? 0.5 : 2.5 + Math.sin(t * 0.08) * 0.35;
        body.rotation.z = Math.sin(t * 0.21) * 0.03;
        arm.rotation.z = waving ? Math.PI - 0.55 + Math.sin(since * 4.4) * 0.42 : Math.PI - 0.2 + Math.sin(t * 0.3) * 0.05;
      },
      poke(t) {
        wavedAt = t;
        return "16 sunsets a day · and then this";
      },
      thin(share) {
        const { geometry } = flickers.mesh;
        geometry.setDrawRange(0, Math.round(geometry.getAttribute("position").count * share));
      },
    };
  },
};
