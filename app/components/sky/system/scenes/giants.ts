/* What the worlds without ground have in common: a deck of cloud curving away below you, and rings standing over it. */

import { type MeshBasicMaterial, Vector3 } from "three";
import { hash, noise, type Rgb } from "../../engine";
import { VoxelSet } from "../voxels";
import { flows, type Flow } from "./kit";

/** Noise measured round a circle in x, so a band of cloud meets itself where it wraps. */
export function wrapped(x: number, z: number, wrap: number, wide: number, seed: number) {
  const a = (x / (wrap * 2)) * Math.PI * 2;
  return noise(Math.cos(a) * wide + z * 0.012 * wide + 50, Math.sin(a) * wide + z * 0.012 * wide + 50, seed);
}

export interface DeckRow { fromZ: number; toZ: number; step: number; halfX: number; hole?: [number, number, number] }

/**
 * A deck of cubes on the curve of a planet of radius R, slid along x in the shader by `wind`, a GLSL float that can read `at`,
 * the cube's own place. `shade`, if given, is GLSL that sets `vTint` from `p`, the slid place, and `uTime`.
 */
export function cloudDeck(opts: {
  R: number; wrap: number; rows: DeckRow[]; wind?: string; shade?: string; lift: number;
  paint: (x: number, z: number) => Rgb | null; rise: (x: number, z: number) => number;
}) {
  const { R, wrap, rows, lift } = opts;
  const set = new VoxelSet();
  for (const { fromZ, toZ, step, halfX, hole } of rows) {
    for (let z = fromZ; z < toZ; z += step) {
      for (let x = -halfX; x < halfX; x += step) {
        if (hole && Math.abs(x) < hole[0] && z >= hole[1] && z < hole[2]) continue;
        const c = opts.paint(x, z);
        if (c) set.box(x, lift + opts.rise(x, z) - (x * x + z * z) / (2 * R) - step, z, step, step * 2, step, c);
      }
    }
  }
  const mesh = set.mesh("glow");
  const time = { value: 0 };
  (mesh.material as MeshBasicMaterial).onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime;\nvarying vec3 vTint;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vec3 at = instanceMatrix[3].xyz;
      float slid = mod(at.x + uTime * (${opts.wind ?? "0.0"}) + ${wrap.toFixed(1)}, ${(wrap * 2).toFixed(1)}) - ${wrap.toFixed(1)};
      transformed.x += (slid - at.x) / instanceMatrix[0][0];
      transformed.y += ((at.x * at.x - slid * slid) / ${(2 * R).toFixed(1)}) / instanceMatrix[1][1];
      vec3 p = vec3(slid, at.y, at.z);
      vTint = vec3(1.0);
      ${opts.shade ?? ""}`,
    );
    shader.fragmentShader = `varying vec3 vTint;\n${shader.fragmentShader}`.replace("#include <opaque_fragment>", "outgoingLight *= vTint;\n#include <opaque_fragment>");
  };
  return { mesh, time };
}

/** Where a point at `radius` planet radii and angle `a` round the ring plane sits, as seen from `latitude`, for a planet of radius R under the camera. */
export function onRingPlane(a: number, radius: number, R: number, latitude: number) {
  return new Vector3(Math.cos(a) * radius * R, 0, Math.sin(a) * radius * R).applyAxisAngle(new Vector3(1, 0, 0), Math.PI / 2 - latitude).add(new Vector3(0, -R, 0));
}

/** Thin rings as lines of light, for the outer planets, whose rings are nothing like Saturn's: dark, narrow, and few. */
export function thinRings(rings: { radius: number; size: number; colour: Rgb; alpha: number; clumps?: number }[], R: number, latitude: number, coarse: boolean) {
  const list: Flow[] = [];
  rings.forEach((ring, n) => {
    const points = Math.round((coarse ? 340 : 720) * (ring.size > 2 ? 1.2 : 1));
    for (let i = 0; i < points; i++) {
      // Only the half overhead: the rest is below the horizon.
      const a = -Math.PI + (i / points) * Math.PI;
      const p = onRingPlane(a, ring.radius, R, latitude);
      if (p.y < -60) continue;
      const clump = ring.clumps && Math.sin(a * ring.clumps + n) > 0.8 ? 2.6 : 1;
      list.push({ start: [p.x, p.y, p.z], drift: [0, 0, 0], size: ring.size, colour: ring.colour, alpha: ring.alpha * clump * (0.7 + hash(i, n, 300) * 0.3), rate: 0, phase: 0.2, twinkle: 0.2 });
    }
  });
  return flows(list);
}
