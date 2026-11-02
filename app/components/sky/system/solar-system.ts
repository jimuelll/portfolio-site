/*
 * The solar system: where the five-second hold arrives (cosmos.ts). A map you can turn and zoom, and on it a few
 * places you can land, each a small voxel scene that plays by itself like a live wallpaper.
 *
 * This is only the picture and what it knows. The Cosmos canvas stays on top, transparent, drawing the readout and the
 * labels this hands it and passing pointers down. This file and everything it imports is one lazy chunk (load.ts), so
 * nobody pays for three.js until they've held the toggle.
 */

import { PerspectiveCamera, Vector3 } from "three";
import { clamp, ease, smoothstep } from "../engine";
import { AsciiPass } from "./ascii";
import { MAP_LENS, Orrery, type World } from "./orrery";
import type { Diorama, Place } from "./scenes/kit";
import { fushimi } from "./scenes/earth";
import { moonBase } from "./scenes/moon";
import { aurora } from "./scenes/aurora";
import { ida243 } from "./scenes/belt";
import { greatRedSpot } from "./scenes/jupiter";
import { veronaRupes } from "./scenes/miranda";
import { galeCrater } from "./scenes/mars";
import { neptuneTops } from "./scenes/neptune";
import { paleHaze } from "./scenes/uranus";
import { prokofiev } from "./scenes/mercury";
import { iapetus } from "./scenes/iapetus";
import { cloudTops } from "./scenes/saturn";
import { corona } from "./scenes/sun";
import { navka } from "./scenes/venus";
import { PLACE_IDS, markPlace, placesCount } from "../secrets";
import { release } from "./voxels";

export interface Note { text: string; at: number }
/** Something the Cosmos canvas should write on the picture. A world's name; or the one in focus, which can be tapped. */
export interface Tag { text: string; x: number; y: number; cx: number; cy: number; r: number; sub?: string; run?: () => void; focus: () => void }

const PLACES: Record<string, Place> = { sun: corona, mercury: prokofiev, venus: navka, earth: fushimi, moon: moonBase, mars: galeCrater, saturn: cloudTops, iapetus, jupiter: greatRedSpot, uranus: paleHaze, neptune: neptuneTops, belt: ida243, miranda: veronaRupes };
/** Earth has more than one place worth the trip, so its places go round from one to the next. */
const ROUND: Place[] = [fushimi, aurora];
/** The dive between the map and a place. The view cuts halfway, at its coarsest. */
const DIVE_SECONDS = 1.7;
const COARSEST = 7;
/** The map's glyphs against the usual: a bit finer, since each world is only a few across. */
const MAP_CELL = 0.8;
/** How far a drag can turn the view in a place, before it eases back. */
const YAW_LIMIT = 0.36;
const PITCH_LIMIT = 0.13;
/** A fingertip's reach, in px, so the smallest worlds and creatures can still be hit. */
const TOUCH = 28;
/** A mouse is more exact, and has a whole map to cross without setting everything off. */
const HOVER = 18;
const NOTE_SECONDS = 5;
/** How high over the ground a place's camera has to stay, and how far around it that's checked. */
const CAMERA_HEIGHT = 4.5;
const CLEARANCE = [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]];

type Dive = { t: number; to: Place | null; world: World | null; cut: boolean };

export class SolarSystem {
  readonly canvas = document.createElement("canvas");
  private pass: AsciiPass;
  private map: Orrery;
  private here: { place: Place; view: Diorama } | null = null;
  private camera = new PerspectiveCamera(30, 1, 0.5, 1800);
  private dive: Dive | null = null;
  /** The world the camera dives at or rises from, held after the cut for the way back out. */
  private diveWorld: World | null = null;
  private focus: World | null = null;
  private note: Note | null = null;
  private time = 0;
  private w = 1;
  private h = 1;
  private frames = 0;
  private lastFrame = 0;
  private lookAround = { yaw: 0, pitch: 0, dragging: false };
  private look = { x: 0, y: 0 };
  private rest = 0;
  private lost: () => void;
  private reduced: boolean;
  private coarse: boolean;

  constructor(opts: { family: string; reduced: boolean; coarse: boolean; w: number; h: number; projects: number; onLost: () => void }) {
    this.reduced = opts.reduced;
    this.coarse = opts.coarse;
    this.lost = opts.onLost;
    this.canvas.className = "system-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    this.pass = new AsciiPass(this.canvas, opts.family);
    this.pass.fade = opts.reduced ? 1 : 0;
    this.map = new Orrery(opts.reduced, opts.projects);
    this.canvas.addEventListener("webglcontextlost", this.onLost);
    this.resize(opts.w, opts.h);
    this.pass.setCell(MAP_CELL);
    document.body.append(this.canvas);
  }

  private onLost = () => this.lost();

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.pass.resize(w, h);
    this.map.resize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ── what the pointer does ─────────────────────

  drag(dx: number, dy: number) {
    if (this.dive) return;
    if (!this.here) return this.map.drag(dx, dy);
    this.lookAround.dragging = true;
    this.lookAround.yaw = clamp(this.lookAround.yaw - dx * 0.0032, -YAW_LIMIT, YAW_LIMIT);
    this.lookAround.pitch = clamp(this.lookAround.pitch + dy * 0.0022, -PITCH_LIMIT, PITCH_LIMIT);
  }

  release() {
    this.map.release();
    this.lookAround.dragging = false;
  }

  /** Toward the point given, so whichever world you're zooming at stays in view. */
  zoom(factor: number, x: number, y: number) {
    if (!this.here && !this.dive) this.map.zoomBy(factor, x, y);
  }

  /** A finger or button coming down: a map still coasting from the last drag stops under it. */
  press() {
    if (!this.here && !this.dive) this.map.grip();
  }

  hover(x: number, y: number) {
    if (this.here || this.dive) return false;
    this.focus = this.map.worldAt(x, y, HOVER);
    return this.focus !== null;
  }

  /** The mouse is over a label: that keeps the focus, unless a world is right there under the mouse too. */
  hoverOver(x: number, y: number) {
    if (this.here || this.dive) return;
    this.focus = this.map.worldAt(x, y, 0) ?? this.focus;
  }

  /** A tap: the map tries to land, a place sees if you've touched its creature. */
  tap(x: number, y: number, touch = false) {
    if (this.dive) return;
    if (this.here) {
      const { view } = this.here;
      const p = this.fixOf(view.actor);
      const r = (view.actorSize / this.camera.position.distanceTo(view.actor)) * (this.h / 2 / Math.tan((this.camera.fov * Math.PI) / 360));
      if (Math.hypot(p.x - x, p.y - y) <= Math.max(TOUCH, r)) this.say(view.poke(this.time));
      return;
    }
    // A mouse has already said which by hovering. A finger hasn't, so its first tap only picks, and a slip costs nothing.
    const world = touch ? this.map.worldAt(x, y, TOUCH) : this.focus;
    if (!world || (touch && world !== this.focus)) this.focus = world;
    else this.choose(world);
  }

  /** Arrow keys walk the worlds, Enter goes to the one in focus. True if the key meant something here. */
  key(code: string) {
    if (this.here || this.dive) return false;
    if (code === "ArrowRight" || code === "ArrowLeft" || code === "ArrowUp" || code === "ArrowDown") {
      const list = this.map.worlds;
      const i = this.focus ? list.indexOf(this.focus) : -1;
      const step = code === "ArrowRight" || code === "ArrowDown" ? 1 : -1;
      this.focus = list[(i + step + list.length) % list.length];
      return true;
    }
    if (code === "Enter" && this.focus) {
      this.choose(this.focus);
      return true;
    }
    return false;
  }

  private choose(world: World) {
    this.focus = world;
    this.land(PLACES[world.lands], world);
  }

  private say(text: string) {
    this.note = { text, at: this.time };
  }

  // ── going places ──────────────────────────────

  private land(place: Place, world: World) {
    this.note = null;
    if (this.reduced) return this.cutTo(place, world);
    this.dive = { t: 0, to: place, world, cut: false };
    this.diveWorld = world;
  }

  /** On to the next place in the round, if this place is in one. */
  next() {
    if (!this.hasNext()) return;
    const at = ROUND.indexOf(this.here!.place);
    this.note = null;
    const to = ROUND[(at + 1) % ROUND.length];
    if (this.reduced) return this.cutTo(to, this.diveWorld);
    this.dive = { t: 0, to, world: this.diveWorld, cut: false };
  }

  /** Whether "next place" belongs on screen. */
  hasNext() {
    return this.here !== null && !this.dive && ROUND.includes(this.here.place);
  }

  /** Back up to the map. False if you're already there. */
  back() {
    if (!this.here || this.dive) return false;
    this.note = null;
    if (this.reduced) {
      this.cutTo(null, this.diveWorld);
      this.diveWorld = null;
      return true;
    }
    this.dive = { t: 0, to: null, world: this.diveWorld, cut: false };
    return true;
  }

  private cutTo(place: Place | null, world: World | null) {
    if (this.here) {
      release(this.here.view.scene);
      this.here = null;
    }
    this.lookAround.yaw = this.lookAround.pitch = 0;
    this.rest = 0;
    this.diveWorld = world;
    if (!place) {
      this.pass.setCell(MAP_CELL);
      return;
    }
    markPlace(place.id);
    const view = place.build(this.coarse);
    this.here = { place, view };
    this.pass.setCell(view.cell ?? 1);
    if (this.pass.level >= 2) view.thin(0.5);
    if (this.pass.level >= 3) view.sun.castShadow = false;
    this.pass.renderer.shadowMap.needsUpdate = true;
    this.camera.fov = view.fov;
    this.camera.updateProjectionMatrix();
    view.update(this.reduced ? 18 : this.time, 0);
  }

  // ── every frame ───────────────────────────────

  step(dt: number, look: { x: number; y: number }) {
    this.time += dt;
    this.look = look;
    const t = this.time;
    if (this.pass.fade < 1 && !this.dive) this.pass.fade = Math.min(1, this.pass.fade + dt / 1.4);
    if (this.dive) this.stepDive(dt);
    if (this.here) {
      this.rest += dt;
      this.here.view.update(t, dt);
      if (!this.lookAround.dragging) {
        const k = Math.exp(-1.5 * dt);
        this.lookAround.yaw *= k;
        this.lookAround.pitch *= k;
      }
    } else {
      this.map.calm(this.focus !== null);
      this.map.update(dt);
    }
    const now = performance.now();
    if (this.lastFrame && this.pass.watch(now - this.lastFrame)) {
      if (this.pass.level === 2) this.here?.view.thin(0.5);
      if (this.pass.level === 3 && this.here) this.here.view.sun.castShadow = false;
    }
    this.lastFrame = now;
    if (this.here?.view.movingShadows && ++this.frames % (this.here.view.shadowEvery ?? 5) === 0) this.pass.renderer.shadowMap.needsUpdate = true;
  }

  private stepDive(dt: number) {
    const d = this.dive!;
    d.t = Math.min(1, d.t + dt / DIVE_SECONDS);
    // The grid swells in whole steps, so it reads as a change of resolution rather than a zoom.
    const swell = Math.sin(d.t * Math.PI) ** 2;
    this.pass.mul = 1 + Math.round(swell * (COARSEST - 1));
    this.pass.fade = 1 - smoothstep(0.4, 0.5, d.t) * (1 - smoothstep(0.5, 0.62, d.t));
    if (!d.cut && d.t >= 0.5) {
      d.cut = true;
      this.cutTo(d.to, d.world);
    }
    if (d.t >= 1) {
      this.dive = null;
      if (!d.to) this.diveWorld = null;
      this.pass.mul = 1;
      this.pass.fade = 1;
    }
  }

  /** How far the map camera has gone in toward the world it's diving at. */
  private mapDive() {
    const d = this.dive;
    if (!d) return 0;
    return d.to ? Math.min(1, d.t * 2) : 1 - Math.max(0, (d.t - 0.5) * 2);
  }

  private aimAtPlace(view: Diorama) {
    const { yaw, pitch } = this.lookAround;
    const t = this.reduced ? 0 : this.time;
    const offset = new Vector3().subVectors(view.eye, view.at);
    // A narrow screen stands further back, so the whole of the landmark still fits across it.
    const narrow = this.camera.aspect < 1 ? 1 + (1 - this.camera.aspect) * 1.05 * (view.pullback ?? 1) : 1;
    // Settling in: a touch too close, drawing back as the grid sharpens.
    const settle = this.reduced ? 1 : 1.16 - 0.16 * ease(clamp(this.rest / 2.4, 0, 1));
    offset.multiplyScalar(narrow / settle);
    offset.applyAxisAngle(UP, yaw + this.look.x * 0.04 + Math.sin(t * 0.06) * 0.018);
    const right = new Vector3(offset.z, 0, -offset.x).normalize();
    offset.applyAxisAngle(right, pitch + this.look.y * 0.016 + Math.sin(t * 0.043) * 0.006);
    this.camera.position.copy(view.at).add(offset);
    // However it's swung, it stays above the ground: the highest point just around it, since the ground is in steps.
    const { x, z } = this.camera.position;
    let floor = -Infinity;
    for (const [dx, dz] of CLEARANCE) floor = Math.max(floor, view.ground(x + dx, z + dz));
    this.camera.position.y = Math.max(this.camera.position.y, floor + CAMERA_HEIGHT);
    this.camera.lookAt(view.at);
    this.camera.updateMatrixWorld();
  }

  draw() {
    try {
      if (this.here) {
        const { view } = this.here;
        this.aimAtPlace(view);
        this.pass.flash = view.flash?.(this.time) ?? 0;
        this.pass.render(view.scene, this.camera, view.lens);
      } else {
        this.map.update(0);
        this.map.aim(this.mapDive(), this.diveWorld);
        this.pass.flash = 0;
        this.pass.render(this.map.scene, this.map.camera, MAP_LENS);
      }
    } catch {
      this.lost();
    }
  }

  // ── what the Cosmos canvas writes on top ──────

  private fixOf(p: Vector3) {
    const v = p.clone().project(this.camera);
    return { x: (v.x + 1) * 0.5 * this.w, y: (1 - v.y) * 0.5 * this.h, z: v.z };
  }

  tags(): Tag[] {
    if (this.here || this.dive) return [];
    const tags: Tag[] = [];
    for (const world of this.map.worlds) {
      const f = this.map.fix(world);
      if (f.depth > 1) continue;
      const tag = { text: world.name, x: f.x, y: f.y + f.r + 12, cx: f.x, cy: f.y, r: f.r, focus: () => { this.focus = world; } };
      if (world === this.focus) {
        tags.unshift({ ...tag, sub: world.approach ?? "land →", run: () => this.choose(world) });
        continue;
      }
      // A moon's name would sit on its planet's until you've come in closer.
      if (world.around && f.r < 7) continue;
      tags.push(tag);
    }
    return tags;
  }

  probes() {
    return this.map.probeFixes();
  }

  showProbes(on: boolean) {
    this.map.showProbes(on);
  }

  /** What the readout says: where you are, and what you can do. */
  readout() {
    if (this.here) {
      const { place } = this.here;
      return { lines: [`${place.name} · ${place.world}`, place.coords], hint: this.w < 640 ? "drag to look ↯" : "drag to look around ↯" };
    }
    const years = this.map.years();
    return { lines: [`sol · 8 planets · ${placesCount()}/${PLACE_IDS.length} places`, `${years.toFixed(1)} earth ${years < 1.05 && years > 0.95 ? "year" : "years"} out here`], hint: this.coarse ? "drag · pinch · tap a world twice ↯" : this.w < 640 ? "drag · scroll · click a world ↯" : "drag to turn · scroll to zoom · click a world ↯" };
  }

  /** Whether "back to orbit" belongs on screen. */
  landed() {
    return this.here !== null && !this.dive;
  }

  /** The line a tap has just earned, with how faded it is by now. */
  saying() {
    if (!this.note) return null;
    const age = this.time - this.note.at;
    const alpha = this.reduced ? 1 : smoothstep(0, 0.3, age) * (1 - smoothstep(NOTE_SECONDS - 0.8, NOTE_SECONDS, age));
    if (alpha <= 0 && age > 1) {
      this.note = null;
      return null;
    }
    return { text: this.note.text, alpha };
  }

  leave() {
    this.canvas.classList.add("out");
  }

  destroy() {
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    if (this.here) release(this.here.view.scene);
    this.here = null;
    this.map.destroy();
    this.pass.destroy();
    this.canvas.remove();
  }
}

const UP = new Vector3(0, 1, 0);
