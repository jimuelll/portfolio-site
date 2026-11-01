/* What every place on the map needs: what a place is, and its sky and sun. */

import { AdditiveBlending, BackSide, BufferGeometry, DirectionalLight, Float32BufferAttribute, Mesh, Points, ShaderMaterial, SphereGeometry, Vector3, type Scene, type WebGLRenderer } from "three";
import { hash, type Rgb } from "../../engine";
import type { Lens } from "../ascii";

export interface Diorama {
  scene: Scene;
  /** The resting view: the camera, what it looks at, its field of view, and the lens. */
  eye: Vector3;
  at: Vector3;
  fov: number;
  lens: Lens;
  /** How big the glyphs are against the usual, for a scene with fine detail to hold. */
  cell?: number;
  /** How far back a narrow screen stands (1: enough to fit the width), for a scene that suits a tall crop. */
  pullback?: number;
  /** The height of the ground anywhere, so looking around never takes the camera through it. */
  ground(x: number, z: number): number;
  /** The scene's sun, whose shadows do so much of the look. */
  sun: DirectionalLight;
  /** True if something big moves, so its shadow has to keep up. */
  movingShadows?: boolean;
  /** How many frames apart those shadows are redrawn, for something big that moves slowly. */
  shadowEvery?: number;
  update(t: number, dt: number): void;
  /** The small living thing, and how far from its centre a tap still counts. */
  actor: Vector3;
  actorSize: number;
  /** Tapped: it reacts, and this is what the readout says. */
  poke(t: number): string;
  /** Anything lighting up the whole view: the rover's selfie. */
  flash?(t: number): number;
  /** Keep this share of the moving motes, on a device that can't keep up. */
  thin(share: number): void;
}

export interface Place {
  id: string;
  name: string;
  world: string;
  coords: string;
  build(coarse: boolean): Diorama;
}

const norm = (c: Rgb) => new Vector3(c[0] / 255, c[1] / 255, c[2] / 255);

/** Ground facing the sun is brighter and ground facing away darker. Columns have flat tops, so the shading is put in the colour. */
export function sloped(c: Rgb, height: (x: number, z: number) => number, x: number, z: number, strength: number): Rgb {
  const facing = height(x + 1, z) - height(x - 1, z) + (height(x, z - 1) - height(x, z + 1)) * 0.4;
  const k = 1 + Math.max(-0.55, Math.min(0.55, facing * strength));
  return [c[0] * k, c[1] * k, c[2] * k];
}

/** Which cell of a random mosaic a point falls in: its grid index, its centre, and how near the edge with the next (0 on it). */
export function cells(x: number, z: number, size: number, seed: number) {
  const gx = x / size, gz = z / size, ix = Math.floor(gx), iz = Math.floor(gz);
  let first = Infinity, second = Infinity, i = 0, j = 0, cx = 0, cz = 0;
  for (let a = ix - 1; a <= ix + 1; a++) {
    for (let b = iz - 1; b <= iz + 1; b++) {
      const px = a + hash(a, b, seed), pz = b + hash(a, b, seed + 1), d = Math.hypot(px - gx, pz - gz);
      if (d < first) { second = first; first = d; i = a; j = b; cx = px; cz = pz; }
      else if (d < second) second = d;
    }
  }
  return { i, j, x: cx * size, z: cz * size, edge: second - first, near: first };
}

/** Craters filed by area, so a point on the ground only ever looks at the few that can reach it. Each is [x, z, radius]. */
export function craterFile(craters: number[][]) {
  const AREA = 16;
  const key = (ix: number, iz: number) => (ix + 2048) * 4096 + iz + 2048;
  const areas = new Map<number, number[][]>();
  for (const crater of craters) {
    const [cx, cz, r] = crater, reach = r * 1.5;
    for (let ix = Math.floor((cx - reach) / AREA); ix <= Math.floor((cx + reach) / AREA); ix++) {
      for (let iz = Math.floor((cz - reach) / AREA); iz <= Math.floor((cz + reach) / AREA); iz++) {
        const list = areas.get(key(ix, iz));
        if (list) list.push(crater);
        else areas.set(key(ix, iz), [crater]);
      }
    }
  }
  return (x: number, z: number) => areas.get(key(Math.floor(x / AREA), Math.floor(z / AREA)));
}

/** A sky: three colours from the zenith down to the horizon, and a glow round the sun. */
export function skyDome(top: Rgb, middle: Rgb, horizon: Rgb, glowAt: Vector3, glow: Rgb, reach: number) {
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTop: { value: norm(top) }, uMid: { value: norm(middle) }, uLow: { value: norm(horizon) }, uGlowAt: { value: glowAt.clone().normalize() }, uGlow: { value: norm(glow) }, uReach: { value: reach } },
    vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uTop, uMid, uLow, uGlowAt, uGlow;
      uniform float uReach;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.13, h));
        c = mix(c, uTop, smoothstep(0.1, 0.42, h));
        float g = max(0.0, dot(d, uGlowAt));
        c = mix(c, uGlow, pow(g, uReach) * 0.92);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new Mesh(new SphereGeometry(900, 24, 16), material);
  dome.frustumCulled = false;
  return dome;
}

/**
 * One glowing particle. Over each cycle it travels from `start` by `drift`, bending by `curve`, fading as it goes: a tail,
 * a stream of sand. With a rate of 0 it stays put and glows. `window` is the share of the cycle it's alive for.
 */
export interface Flow {
  start: [number, number, number];
  drift: [number, number, number];
  curve?: [number, number, number];
  /** World units, so it keeps its size against the scene on any screen. */
  size: number;
  colour: Rgb;
  alpha?: number;
  fade?: number;
  rate: number;
  phase: number;
  wobble?: number;
  twinkle?: number;
  window?: number;
}

/** Thousands of flows drawn in one call, worked out entirely in the vertex shader, so they cost one number a frame. */
export function flows(list: Flow[]) {
  const position: number[] = [], drift: number[] = [], curve: number[] = [], colour: number[] = [], motion: number[] = [], look: number[] = [];
  for (const f of list) {
    position.push(...f.start);
    drift.push(...f.drift);
    curve.push(...(f.curve ?? [0, 0, 0]));
    colour.push(f.colour[0] / 255, f.colour[1] / 255, f.colour[2] / 255);
    motion.push(f.size, f.rate, f.phase, f.wobble ?? 0);
    look.push(f.alpha ?? 1, f.fade ?? 0, f.twinkle ?? 0, f.window ?? 1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(position, 3));
  geometry.setAttribute("aDrift", new Float32BufferAttribute(drift, 3));
  geometry.setAttribute("aCurve", new Float32BufferAttribute(curve, 3));
  geometry.setAttribute("aColour", new Float32BufferAttribute(colour, 3));
  geometry.setAttribute("aMotion", new Float32BufferAttribute(motion, 4));
  geometry.setAttribute("aLook", new Float32BufferAttribute(look, 4));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uHeight: { value: 240 } },
    vertexShader: `
      attribute vec3 aDrift, aCurve, aColour;
      attribute vec4 aMotion, aLook;
      uniform float uTime, uHeight;
      varying vec3 vColour;
      void main() {
        float k = fract(uTime * aMotion.y + aMotion.z) / aLook.w;
        float alive = k > 1.0 ? 0.0 : (aMotion.y > 0.0 ? smoothstep(0.0, 0.05, k) : 1.0) * pow(max(0.0, 1.0 - k), aLook.y);
        float seed = aMotion.z * 6.2832;
        vec3 p = position + aDrift * min(k, 1.0) + aCurve * min(k, 1.0) * min(k, 1.0);
        p += aMotion.w * min(k, 1.0) * vec3(sin(uTime * 1.1 + seed * 7.0), sin(uTime * 0.9 + seed * 11.0), cos(uTime * 0.7 + seed * 5.0));
        alive *= 1.0 + aLook.z * 0.3 * sin(uTime * (1.0 + fract(seed)) + position.x * 13.0);
        vColour = aColour * alive * aLook.x;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = alive <= 0.0 ? 0.0 : max(1.2, aMotion.x * projectionMatrix[1][1] * uHeight * 0.5 / -mv.z);
      }`,
    fragmentShader: `
      varying vec3 vColour;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        gl_FragColor = vec4(vColour * (1.0 - d * d), 1.0);
      }`,
  });
  const mesh = new Points(geometry, material);
  mesh.frustumCulled = false;
  // Sizes are in world units, so they need to know how tall the buffer being drawn to is.
  mesh.onBeforeRender = (renderer: WebGLRenderer) => {
    material.uniforms.uHeight.value = renderer.getRenderTarget()?.height ?? 240;
  };
  return { mesh, tick: (t: number) => { material.uniforms.uTime.value = t; } };
}

/** The scene's sun, its shadow box fitted round the diorama. */
export function sunlight(colour: number, intensity: number, from: Vector3, reach: number, coarse: boolean) {
  const sun = new DirectionalLight(colour, intensity);
  sun.position.copy(from);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(coarse ? 1024 : 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -reach;
  sun.shadow.camera.right = sun.shadow.camera.top = reach;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = from.length() + reach * 2.2;
  sun.shadow.bias = -0.0015;
  sun.shadow.normalBias = 0.4;
  return sun;
}
