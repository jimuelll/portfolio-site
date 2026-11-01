/* What every place on the map needs: what a place is, and its sky and sun. */

import { BackSide, DirectionalLight, Mesh, ShaderMaterial, SphereGeometry, Vector3, type Scene } from "three";
import type { Rgb } from "../../engine";
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
  /** The scene's sun, whose shadows do so much of the look. */
  sun: DirectionalLight;
  /** True if something big moves, so its shadow has to keep up. */
  movingShadows?: boolean;
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
