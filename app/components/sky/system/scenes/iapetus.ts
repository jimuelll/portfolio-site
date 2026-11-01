/*
 * Iapetus, and Saturn from it: the one big moon whose orbit is tilted, so the one place the rings look open rather than a line.
 * (The moons closer in all circle in the ring plane.) Saturn hangs swollen in the black, its shadow lying across the far
 * side of the rings, and the rings' shadow across its face. Each ring goes round at its own speed, the inner ones fastest.
 * Underfoot is the strangest moon there is: half of it dark as tar, half bright ice, with a great ridge running round its
 * waist like the seam on a walnut. Cassini came by once, in 2007. Tap it and it turns its dish toward home.
 */

import { AmbientLight, Euler, Group, type InstancedMesh, type MeshBasicMaterial, Quaternion, Scene, Vector3 } from "three";
import { hash, mix, noise, smoothstep, type Rgb } from "../../engine";
import { VoxelSet } from "../voxels";
import { stars } from "./moon";
import { craterFile, flows, sloped, sunlight, type Flow, type Place } from "./kit";
import { A_TO, B_FROM, C_FROM, F_RING, cassini, ringAt } from "./saturn";

const TAR: Rgb = [58, 40, 30], TAR_LIT: Rgb = [92, 66, 48], ICE: Rgb = [196, 200, 206], ICE_DIRTY: Rgb = [132, 130, 128];
/** From over the left shoulder: Saturn is a little past full, so its shadow falls on the far side of the rings. */
const SUNWARD = new Vector3(-0.6, 0.2, 0.78).normalize();
const SATURN_AT = new Vector3(60, 372, -950);
const R = 128;
/** Open as far as they ever get from here, about 15° to the eye once you allow for looking up at them, and rolled onto a slant. */
const TILT = new Euler(0.64, 0.12, -0.34);

const CRATERS: number[][] = [];
for (let i = 0; i < 80; i++) CRATERS.push([(hash(i, 1, 160) - 0.5) * 340, 62 - hash(i, 2, 160) * 300, 1 + hash(i, 3, 160) ** 2.2 * 12]);
const cratersNear = craterFile(CRATERS);

/** The ridge's line across the view. It wanders, as it does, and it never quite closes up. */
const ridgeDistance = (x: number, z: number) => Math.abs(z + 150 - x * 0.2 - Math.sin(x * 0.012) * 18);

function height(x: number, z: number) {
  let h = 4 + noise(x * 0.025, z * 0.025, 161) * 4 + noise(x * 0.12, z * 0.12, 162) * 0.8 + noise(x * 0.6, z * 0.6, 163) * 0.14;
  const near = cratersNear(x, z);
  if (near) for (const [cx, cz, r] of near) {
    const d = Math.hypot(x - cx, z - cz) / r;
    if (d < 1) h -= (1 - d * d) * r * 0.32;
    else if (d < 1.5) h += (1 - (d - 1) / 0.5) ** 2 * r * 0.1;
  }
  const d = ridgeDistance(x, z) / 42;
  if (d < 2.2) {
    const tall = 25 * (0.6 + noise(x * 0.016, 4, 164) * 0.8);
    const raw = tall * Math.exp(-d * d) * (0.82 + noise(x * 0.09, z * 0.09, 165) * 0.36);
    h += Math.round(raw / 1.6) * 1.6;
  }
  // A small world: the horizon comes up close.
  return h - x * x * 0.00016;
}

/** How much of the dark side this is. The border is sharp-edged and spattered, not a blend. */
const tarOn = (x: number, z: number) => smoothstep(0.42, 0.58, 0.5 - x * 0.0052 + (noise(x * 0.035, z * 0.035, 166) - 0.5) * 0.6 + (noise(x * 0.2, z * 0.2, 167) - 0.5) * 0.14);

function groundColour(x: number, z: number): Rgb {
  const tar = tarOn(x, z);
  const dark = mix(TAR, TAR_LIT, noise(x * 0.14, z * 0.14, 168));
  const bright = mix(ICE, ICE_DIRTY, noise(x * 0.11, z * 0.11, 169) * 0.8);
  // Ice clings to the slopes that look away from the sun, even on the dark side, since it boils off anywhere warmer.
  const shaded = smoothstep(0.5, 1.8, height(x, z - 1) - height(x, z + 1));
  const c = mix(bright, mix(dark, ICE_DIRTY, shaded * 0.8), tar);
  return mix(c, [34, 26, 24], hash(Math.round(x * 3), Math.round(z * 3), 170) ** 6 * 0.8);
}

function ground(v: VoxelSet, coarse: boolean) {
  const fine = coarse ? 0.76 : 0.48, mid = coarse ? 1.7 : 1.25, far = 4;
  for (let x = -54; x < 54; x += fine) {
    for (let z = -24; z < 52; z += fine) {
      const h = height(x, z);
      v.column(x, z, h, h - 5, fine, sloped(groundColour(x, z), height, x, z, 0.12), 0.07);
    }
  }
  for (let x = -180; x < 180; x += mid) {
    for (let z = -210; z < 70; z += mid) {
      if (Math.abs(x) < 54 && z > -24 && z < 52) continue;
      const h = height(x, z);
      v.column(x, z, h, h - 9, mid, sloped(groundColour(x, z), height, x, z, 0.12), 0.07);
    }
  }
  for (let x = -560; x < 560; x += far) {
    for (let z = -520; z < -210; z += far) {
      const h = height(x, z);
      v.column(x, z, h, h - 14, far, sloped(groundColour(x, z), height, x, z, 0.08), 0.05);
    }
  }
}

function debris(v: VoxelSet, coarse: boolean) {
  for (let i = 0; i < (coarse ? 1300 : 3800); i++) {
    const x = (hash(i, 1, 171) - 0.5) * 112, z = 50 - hash(i, 2, 171) * 72;
    const s = 0.1 + hash(i, 3, 171) ** 3 * 0.44;
    v.box(x, height(x, z) + s / 2, z, s * (0.7 + hash(i, 4, 171)), s, s, tarOn(x, z) > 0.5 ? mix(TAR, [116, 92, 76], hash(i, 5, 171)) : mix(ICE, ICE_DIRTY, hash(i, 5, 171)));
  }
}

/** Saturn's clouds by latitude, with a pale storm, and the six-sided jet stream round its north pole. */
function paintSaturn(x: number, y: number, z: number): Rgb {
  const lat = Math.asin(Math.max(-1, Math.min(1, y))), lon = Math.atan2(x, z);
  const wave = noise(lon * 3 + 9, lat * 4, 173) * 0.05;
  const band = noise((lat + wave) * 15, 3, 174), thin = noise((lat + wave) * 46, 5, 175);
  let c = mix(mix([206, 168, 112], [244, 220, 170], band), [176, 138, 92], thin * 0.3);
  if (Math.abs(lat + 0.62) < 0.1) c = mix(c, [254, 244, 222], smoothstep(0.42, 0.1, Math.hypot((lon - 0.9) * 0.34, (lat + 0.62) * 2.2)));
  const pole = Math.PI / 2 - lat;
  const hex = 0.46 * (Math.cos(Math.PI / 6) / Math.cos((((lon % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3)) - Math.PI / 6));
  if (y > 0 && pole < hex) c = mix([132, 136, 138], [92, 104, 124], smoothstep(hex, 0, pole));
  return c;
}

/** Saturn and its rings: fixed colours, and light and shadow worked out in the shader so the planet can turn underneath them. */
function saturn(coarse: boolean) {
  const group = new Group();
  group.position.copy(SATURN_AT);
  group.rotation.copy(TILT);
  const tilt = new Quaternion().setFromEuler(TILT);
  const north = new Vector3(0, 1, 0).applyQuaternion(tilt);
  const local = SUNWARD.clone().applyQuaternion(tilt.clone().invert());
  const time = { value: 0 };

  const voxel = coarse ? 3.6 : 2.7;
  const globeSet = new VoxelSet();
  globeSet.ball(0, 0, 0, R / voxel, voxel, paintSaturn, 0.02, 0.9);
  const globe = globeSet.mesh("glow");
  const lit = (mesh: InstancedMesh, ring: boolean) => {
    const material = mesh.material as MeshBasicMaterial;
    material.fog = false;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, { uSun: { value: SUNWARD }, uNorth: { value: north }, uTime: time });
      shader.vertexShader = `uniform vec3 uSun, uNorth;\nuniform float uTime;\nvarying float vLit;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec3 at = instanceMatrix[3].xyz;
        ${ring ? `
        // Bright clumps sheared out as they go round, each radius at its own Kepler speed.
        float r = length(at.xz) / ${R.toFixed(1)};
        float a = atan(at.z, at.x);
        float speed = 0.16 / (r * sqrt(r));
        vLit = 1.0 + 0.1 * sin(a * 7.0 - uTime * speed + r * 40.0) + 0.07 * sin(a * 17.0 - uTime * speed * 1.4 + r * 90.0);
        ` : `
        // Day and night, and the rings' shadow: follow each cube toward the sun to see if it crosses the ring plane in the rings.
        vec3 world = mat3(modelMatrix) * at;
        vec3 facing = normalize(world);
        float day = 0.05 + 0.95 * smoothstep(-0.06, 0.3, dot(facing, uSun));
        float along = -dot(world, uNorth) / dot(uSun, uNorth);
        float hit = length(world + uSun * along) / ${R.toFixed(1)};
        float shade = along > 0.0 ? smoothstep(${(C_FROM - 0.02).toFixed(2)}, ${B_FROM.toFixed(2)}, hit) * (1.0 - smoothstep(${(A_TO - 0.02).toFixed(2)}, ${(A_TO + 0.02).toFixed(2)}, hit)) : 0.0;
        vLit = day * (1.0 - shade * 0.62);
        `}`,
      );
      shader.fragmentShader = `varying float vLit;\n${shader.fragmentShader}`.replace("#include <opaque_fragment>", "outgoingLight *= vLit;\n#include <opaque_fragment>");
    };
  };
  lit(globe, false);
  group.add(globe);

  const ringSet = new VoxelSet();
  const step = coarse ? 3 : 2.1;
  const outer = R * (F_RING + 0.03);
  for (let x = -outer; x <= outer; x += step) {
    for (let z = -outer; z <= outer; z += step) {
      const r = Math.hypot(x, z) / R;
      if (r < C_FROM) continue;
      const part = ringAt(r, x, z);
      if (!part || hash(Math.round(x * 3), Math.round(z * 3), 176) > part.fill) continue;
      // The planet's shadow, straight back from the sun: it blots out everything behind it, with a clean edge.
      const t = x * local.x + z * local.z;
      const off = Math.hypot(x - local.x * t, local.y * t, z - local.z * t);
      const inShadow = t < 0 && off < R * 0.98;
      ringSet.add(x, 0, z, inShadow ? mix(part.c, [8, 8, 12], 0.93) : part.c, step, 0.05);
    }
  }
  const rings = ringSet.mesh("glow");
  lit(rings, true);
  group.add(rings);
  return { group, globe, time };
}

/** Far things in the sky: Titan, a dull orange dot, small moons, and the dark grit Iapetus has been sweeping up for ever. */
function around(coarse: boolean) {
  const list: Flow[] = [];
  const r = (i: number, s: number) => hash(i, s, 177);
  const moons: [number, number, number, number, Rgb][] = [[-266, 196, -930, 7, [234, 172, 96]], [-100, 228, -950, 2.6, [220, 222, 226]], [326, 400, -920, 3, [228, 228, 232]], [408, 276, -880, 2.2, [210, 212, 216]]];
  for (const [x, y, z, size, colour] of moons) list.push({ start: [x, y, z], drift: [0, 0, 0], size, colour, alpha: 1.2, rate: 0, phase: 0.2, twinkle: 0.2 });
  // Dust off Phoebe, far out: it spirals in and lands on this side only, which is how the dark half got dark.
  for (let i = 0; i < (coarse ? 450 : 1000); i++) {
    const x = (r(i, 1) - 0.5) * 240, z = 54 - r(i, 2) * 210, fall = 22 + r(i, 3) * 30;
    list.push({
      start: [x + 12, height(x, z) + fall, z - 6], drift: [-12, -fall, 6], size: 0.1 + r(i, 4) * 0.14, colour: mix([186, 150, 118], [116, 90, 70], r(i, 5)), alpha: 0.62, fade: 0.1,
      rate: 0.02 + r(i, 6) * 0.03, phase: r(i, 7),
    });
  }
  // Ice flashing off the bright slopes where the sun has just got to it, and the long slow slides off the ridge.
  for (let i = 0; i < (coarse ? 280 : 620); i++) {
    const x = 20 + r(i, 11) * 170, z = -146 + x * 0.2 + (r(i, 12) - 0.5) * 42;
    list.push({
      start: [x, height(x, z) + 0.4, z], drift: [(r(i, 13) - 0.5) * 8, 8 + r(i, 14) * 10, 7 + r(i, 15) * 14], curve: [0, -7, 0], size: 0.4 + r(i, 16) * 0.6, colour: [236, 244, 255],
      alpha: 0.7, fade: 0.8, rate: 0.03 + r(i, 17) * 0.05, phase: r(i, 18), wobble: 0.5,
    });
  }
  return flows(list);
}

export const iapetus: Place = {
  id: "iapetus",
  name: "the equatorial ridge",
  world: "iapetus",
  coords: "3.56 million km from saturn",
  build(coarse) {
    const scene = new Scene();
    const sun = sunlight(0xfff2e0, 3, SUNWARD.clone().multiplyScalar(340), 170, coarse);
    // The light off Saturn itself, warm and from above: all that the night side and the shadows get.
    scene.add(sun, new AmbientLight(0xc8b49a, 0.42));

    const land = new VoxelSet();
    ground(land, coarse);
    debris(land, coarse);
    scene.add(land.mesh("lit", { cast: true, receive: true }));

    const sky = stars(coarse ? 1500 : 3200);
    const planet = saturn(coarse);
    const specks = around(coarse);
    scene.add(sky.mesh, planet.group, specks.mesh);

    const probe = cassini();
    scene.add(probe);
    const spot = new Vector3();
    let calledAt = -100;

    return {
      scene,
      eye: new Vector3(10, 20, 66),
      at: new Vector3(6, 41, -30),
      fov: 44,
      lens: { center: 0.4, band: 0.32, blur: 5 },
      cell: 0.72,
      pullback: 0.72,
      ground: height,
      sun,
      actor: spot,
      actorSize: 5,
      update(t, dt) {
        sky.tick(t);
        specks.tick(t);
        planet.time.value = t;
        // Saturn's day is ten and a half hours, the shortest of the lot, so it's the one thing here you might see move.
        planet.globe.rotation.y = t * 0.014;
        spot.set(-36 + Math.sin(t * 0.031) * 10, 52 + Math.sin(t * 0.043) * 4, -30);
        probe.position.copy(spot);
        const since = t - calledAt;
        const calling = since < 8;
        // Tumbling gently on its wheels, until called: then its dish comes round to the small blue dot that's listening.
        const home = calling ? 1 : 0;
        const k = 1 - Math.exp(-dt * 1.6);
        probe.rotation.x += ((home ? 1.15 : 0.5 + Math.sin(t * 0.09) * 0.28) - probe.rotation.x) * k;
        probe.rotation.z += ((home ? -0.8 : -0.4 + Math.sin(t * 0.07) * 0.3) - probe.rotation.z) * k;
        probe.rotation.y = t * 0.05;
      },
      poke(t) {
        calledAt = t;
        return "cassini · passed 1,227 km over this moon in 2007";
      },
      thin(share) {
        const { geometry } = specks.mesh;
        geometry.setDrawRange(0, Math.round(geometry.getAttribute("position").count * share));
      },
    };
  },
};
