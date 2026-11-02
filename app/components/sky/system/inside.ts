/*
 * Inside the places the wormholes go (destinations.ts), which is somewhere nobody has been: theoretical views, built and
 * printed the way the solar system's landing scenes are. You float along a path through the scene while you look about,
 * and the Cosmos canvas above it carries the labels and the readout.
 */

import { PerspectiveCamera, Vector3, type DirectionalLight, type Scene } from "three";
import { clamp } from "../engine";
import { AsciiPass, type Lens } from "./ascii";
import { insideAndromeda, insideMilkyWay } from "./scenes/inside-galaxies";
import { insideOrion } from "./scenes/inside-orion";
import { insidePillars } from "./scenes/inside-pillars";
import { release } from "./voxels";

/** Something in the scene to scan. */
export interface Spot { name: string; fact: string; at: Vector3 }

export interface Interior {
  scene: Scene;
  fov: number;
  lens: Lens;
  cell?: number;
  /** Where you are at time t, and where you're facing. */
  path(t: number, eye: Vector3, ahead: Vector3): void;
  spots: Spot[];
  /** The light that casts its one shadow, set once, if the scene has one. */
  sun?: DirectionalLight;
  update(t: number): void;
  /** Keep this share of whatever moves, on a device that can't keep up. */
  thin(share: number): void;
}

const INTERIORS: Record<string, (coarse: boolean) => Interior> = {
  andromeda: insideAndromeda,
  milkyway: insideMilkyWay,
  pillars: insidePillars,
  orion: insideOrion,
};

/** How long the picture takes to sharpen after you've plunged in, and how coarse its grid starts. */
const SETTLE_SECONDS = 1.5;
const COARSEST = 6;
const UP = new Vector3(0, 1, 0);

export class InsideView {
  readonly canvas = document.createElement("canvas");
  private pass: AsciiPass;
  private inside: Interior;
  private camera: PerspectiveCamera;
  private time = 0;
  private rest = 0;
  private w = 1;
  private h = 1;
  private yaw = 0;
  private pitch = 0;
  private look = { x: 0, y: 0 };
  private lastFrame = 0;
  /** The warp building (0 → 1), and the rush out of here once it's caught (0 → 1). */
  private charge = 0;
  private rush = 0;
  private lost: () => void;
  private eye = new Vector3();
  private ahead = new Vector3();
  private seen = new Vector3();
  private facing = new Vector3();

  constructor(id: string, opts: { family: string; coarse: boolean; w: number; h: number; onLost: () => void }) {
    this.lost = opts.onLost;
    this.canvas.className = "system-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    this.pass = new AsciiPass(this.canvas, opts.family);
    this.pass.fade = 0;
    this.pass.mul = COARSEST;
    this.inside = INTERIORS[id](opts.coarse);
    this.pass.setCell(this.inside.cell ?? 1);
    this.camera = new PerspectiveCamera(this.inside.fov, 1, 0.5, 2000);
    this.canvas.addEventListener("webglcontextlost", this.onLost);
    this.resize(opts.w, opts.h);
    this.pass.renderer.shadowMap.needsUpdate = true;
    document.body.append(this.canvas);
  }

  private onLost = () => this.lost();

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.pass.resize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** A drag: looking round from wherever you've drifted to. */
  drag(dx: number, dy: number) {
    this.yaw -= dx * 0.004;
    this.pitch = clamp(this.pitch - dy * 0.004, -1.25, 1.25);
  }

  step(dt: number, look: { x: number; y: number }, charge: number, rush: number) {
    this.time += dt;
    this.rest += dt;
    this.look = look;
    this.charge = charge;
    this.rush = rush;
    const k = clamp(this.rest / SETTLE_SECONDS, 0, 1);
    this.pass.fade = Math.min(1, k * 2.5);
    // Coming in the grid sharpens; going out it coarsens again, the same thing backwards.
    this.pass.mul = 1 + Math.round(Math.max(1 - k, rush) * (COARSEST - 1));
    this.inside.update(this.time);
    const now = performance.now();
    if (this.lastFrame && this.pass.watch(now - this.lastFrame)) {
      if (this.pass.level === 2) this.inside.thin(0.5);
      if (this.pass.level === 3 && this.inside.sun) this.inside.sun.castShadow = false;
    }
    this.lastFrame = now;
  }

  private aim() {
    this.inside.path(this.time, this.eye, this.ahead);
    this.camera.position.copy(this.eye);
    // The warp building pulls the view in; once it catches, the view flings wide and you're thrown forward.
    const fov = this.inside.fov - this.charge * 7 + this.rush * this.rush * 52;
    if (fov !== this.camera.fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.facing.subVectors(this.ahead, this.eye).normalize();
    this.facing.applyAxisAngle(UP, this.yaw + this.look.x * -0.05);
    const right = new Vector3().crossVectors(this.facing, UP).normalize();
    this.facing.applyAxisAngle(right, this.pitch + this.look.y * -0.035);
    this.camera.position.addScaledVector(this.facing, this.rush ** 2.2 * 700);
    this.camera.lookAt(this.seen.copy(this.camera.position).add(this.facing));
    this.camera.updateMatrixWorld();
  }

  draw() {
    try {
      this.aim();
      this.pass.render(this.inside.scene, this.camera, this.inside.lens);
    } catch {
      this.lost();
    }
  }

  /** The things to scan, with where they are on screen right now. Anything behind you is left out. */
  spots() {
    const out: { spot: Spot; x: number; y: number }[] = [];
    for (const spot of this.inside.spots) {
      const p = this.spotAt(spot);
      if (p) out.push({ spot, ...p });
    }
    return out;
  }

  spotAt(spot: Spot) {
    this.seen.copy(spot.at).sub(this.eye);
    if (this.seen.dot(this.facing) <= 0) return null;
    const v = this.seen.copy(spot.at).project(this.camera);
    const x = (v.x + 1) * 0.5 * this.w, y = (1 - v.y) * 0.5 * this.h;
    return x < 0 || y < 0 || x > this.w || y > this.h ? null : { x, y };
  }

  destroy() {
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    release(this.inside.scene);
    this.pass.destroy();
    this.canvas.remove();
  }
}
