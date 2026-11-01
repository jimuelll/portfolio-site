/*
 * The cosmos: where holding the theme toggle takes you (top-nav.tsx), told in two parts. Each part stands on its
 * own; together they're a trip.
 *
 * Voyage (three seconds, liftoff): the page drops away and you fly. An endless starfield streams out of the point
 * you're heading for. Steer with the pointer, a finger or a tilted phone; hold anywhere to go to warp, where the
 * stars stretch into streaks and blue-shift. Now and then a planet, a ringed giant or a nebula slides past.
 *
 * Arrival (five seconds): you drop out of warp at the solar system (system/solar-system.ts), a voxel map in WebGL
 * printed in glyphs, where you can land on a few worlds. It lies under this canvas, which turns transparent and carries
 * on with the readout, the labels and the pointer.
 *
 * Vista (the fallback, when there's no WebGL or the solar system can't load): you arrive in front of the Milky Way and
 * its nebulae instead. This sky is endless too, made from noise in tiles as you go, so you can drag or fling across it
 * in any direction. Far stars move less than the gas and near ones more, so it has depth, and a tap ignites a newborn
 * star that stays.
 *
 * Out here the nav's "projects" and "about" are answered by the sky (NAV_EVENT). On the voyage, your projects
 * come up ahead as named worlds to fly past, and "about" is a transmission typed out on the ship's log. In the solar
 * system the projects are probes on the map and "about" is the log again. At the vista, the projects are drawn into
 * the sky as new constellations, and your name is traced in stars. Tapping a project or the dossier link asks top-nav
 * (GO_EVENT) to land and open it.
 *
 * Everything else is monospace glyphs on one canvas, like the sky behind the site.
 */

import { coreStack, projects } from "../../lib/portfolio";
import { GO_EVENT, NAV_EVENT, RAMP, clamp, css, ease, hash, lineGlyph, mix, noise, rand, smoothstep, type NavTarget, type Rgb } from "./engine";
import { loadSystem } from "./system/load";
import type { SolarSystem } from "./system/solar-system";

/** "vista" means arrived, whichever sky that turned out to be. */
export type Stage = "voyage" | "vista";

const TAU = Math.PI * 2;
const SPACE: Rgb = [4, 5, 11];
const STAR: Rgb = [214, 224, 240];
const WARM: Rgb = [242, 186, 84];
const COOL: Rgb = [128, 182, 240];
/** What starlight turns at warp: blue ahead, as light is when you rush toward it. */
const BLUESHIFT: Rgb = [150, 196, 255];
const WHITE: Rgb = [255, 244, 232];
const MAGENTA: Rgb = [226, 96, 172];
const VIOLET: Rgb = [140, 112, 240];
const TEAL: Rgb = [70, 196, 204];
const AMBER: Rgb = [240, 168, 92];
/** Planets and gas giants are drawn from these pairs: a body colour and a band colour. */
const WORLDS: [Rgb, Rgb][] = [
  [[214, 160, 112], [150, 96, 70]],
  [[120, 170, 226], [70, 110, 190]],
  [[196, 120, 96], [240, 200, 150]],
  [[150, 210, 190], [80, 150, 150]],
  [[210, 196, 236], [140, 120, 200]],
];

/** Forward speed in depth per second. A star at the back reaches you in 1/speed seconds. */
const CRUISE = 0.16;
const WARP = 1.5;
/** The push you get at liftoff, easing down to a cruise. */
const LIFTOFF = 0.95;
const ARRIVE_SECONDS = 2.4;
/** Matches the canvas's opacity transition in globals.css. */
const FADE_MS = 1000;
/** Vista tiles, in CSS px. The sky is made one tile at a time, a few per frame at most. */
const TILE = 384;
const TILES_PER_FRAME = 3;
const MAX_TILES = 90;
const SKY_FONT = 10;
const MAX_BIRTHS = 40;
const BIRTH_RING = 1.6;
/** A press that moves less than this is a tap (a birth), not a drag. */
const TAP_SLOP = 8;
/** How long an answer takes to put itself away: the log fades, constellations retract, the name scatters. */
const OVERLAY_FADE = 0.6;
/** How long the voyage keeps flying for a solar system that hasn't loaded, before settling for the vista. */
const SYSTEM_WAIT_MS = 4000;
/** How fast the ship's log types, in characters a second. */
const TYPE_RATE = 46;
const ACCENT: Rgb = [159, 196, 255];
const FAINT: Rgb = [146, 154, 184];
/** The about, as the ship's log reads it out. The last line is the way to the full dossier. */
const LOG_LINES = [
  "incoming transmission ···",
  "pilot    jimuel jean untalan",
  "role     software engineer",
  "status   open to internships",
  "base     quezon, ph · utc+8",
  `stack    ${coreStack.join(" · ")}`,
  "open the dossier →",
];
/** A folded log line carries on under its value, past the label column. */
const LOG_INDENT = " ".repeat(9);

interface Mote { x: number; y: number; z: number; tint: Rgb }
/** Something big passing on the voyage: where it is in flight space, how big, and what it looks like. */
interface Wonder { kind: "planet" | "ringed" | "nebula"; x: number; y: number; z: number; size: number; body: Rgb; band: Rgb; seed: number; tilt: number; label?: string; href?: string; dim?: boolean }
/** Something tappable drawn this frame (a project, the dossier link), in screen px. */
interface Hit { x: number; y: number; w: number; h: number; go: string | (() => void) }
/** A project as a constellation at the vista: its stars in sky px, revealed one by one. */
interface Figure { label: string; href: string; dim: boolean; stars: [number, number][] }
/** A star you lit in the vista, in sky px. */
interface Birth { x: number; y: number; age: number; seed: number }
interface Press { id: number; x: number; y: number; moved: boolean; last: number }

const fbm = (x: number, y: number, seed: number) =>
  noise(x, y, seed) * 0.5 + noise(x * 2.1, y * 2.1, seed + 1) * 0.3 + noise(x * 4.3, y * 4.3, seed + 2) * 0.2;

export class Cosmos {
  stage: Stage;
  private canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private ratio = 1;
  private family: string;
  private time = 0;
  private last = 0;
  private raf = 0;
  private reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private coarse = window.matchMedia("(pointer: coarse)").matches;

  private motes: Mote[] = [];
  private speed = LIFTOFF;
  private warp = false;
  /** Where you're heading, -1 to 1 across the screen, eased toward its target; and the bank of the turn. */
  private look = { x: 0, y: 0, tx: 0, ty: 0 };
  private roll = 0;
  private wonders: Wonder[] = [];
  private nextWonder = rand(3, 6);
  private travelled = 0;

  /** When the arrival began (-1: never; the vista was there from the start). */
  private arriveAt = -1;
  /** The solar system, once you've arrived at it (null: at the vista, or not there yet). */
  private system: SolarSystem | null = null;
  /** Arrival has been asked for and the solar system is still on its way: keep flying. */
  private waiting = false;
  private onArrived?: (solarSystem: boolean) => void;
  private touches = new Map<number, { x: number; y: number }>();
  private cam = { x: 0, y: 0, vx: 7, vy: 2 };
  /** The pointer's pull on the parallax, eased, -1 to 1. */
  private lean = { x: 0, y: 0 };
  private tiles = new Map<string, HTMLCanvasElement>();
  private births: Birth[] = [];
  private lit = 0;

  /** Which of the nav's answers is showing, and since when. */
  private overlay: { kind: NavTarget; at: number } | null = null;
  /** When the answer started putting itself away (-1: it isn't). */
  private closing = -1;
  private figures: Figure[] = [];
  /** Your name traced in stars at the vista, in sky px, with the point the caption hangs from. */
  private nameStars: { pts: [number, number][]; x: number; y: number } | null = null;
  private hits: Hit[] = [];

  private press: Press | null = null;
  private pointer = { x: 0, y: 0, active: false };
  private tilt = { x: 0, y: 0, on: false };

  /** On iOS, motion needs asking for, and only from inside a tap: the release of the hold counts. */
  static askTilt() {
    const D = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    D?.requestPermission?.().catch(() => {});
  }

  constructor(stage: Stage = "voyage") {
    this.stage = stage;
    this.family = getComputedStyle(document.body).fontFamily || "monospace";
    this.canvas.className = "cosmos-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    document.body.append(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    this.resize();
    for (let i = 0; i < this.moteCount(); i++) this.motes.push(this.makeMote(rand(0.05, 1)));
    // Arrive somewhere worth seeing: of a few places near the Milky Way, the one with the most nebula in view.
    let best = -1;
    for (let i = 0; i < 24; i++) {
      const x = rand(-6000, 6000), y = rand(-900, 900);
      const f = this.field(x + this.w / 2, y + this.h / 2);
      const score = f.neb + f.milky * 0.3;
      if (score > best) { best = score; this.cam = { x, y, vx: 7, vy: 2 }; }
    }
    this.canvas.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove, { passive: true });
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
    document.documentElement.addEventListener("pointerleave", this.onLeave);
    window.addEventListener("resize", this.resize);
    window.addEventListener("deviceorientation", this.onTilt);
    document.addEventListener("visibilitychange", this.schedule);
    window.addEventListener(NAV_EVENT, this.onNav);
    window.addEventListener("keydown", this.onKey);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    // Fetched by now if the hold came from the toggle; this covers any other way here.
    loadSystem().catch(() => {});
    // Fades in on the next frame (the opacity transition needs a frame at 0 first).
    requestAnimationFrame(() => this.canvas.classList.add("on"));
    this.schedule();
  }

  /** From the voyage: on to the solar system, flying on until it's ready, or to the vista if it can't be had. */
  arrive(onArrived?: (solarSystem: boolean) => void) {
    if (this.stage === "vista" || this.waiting) return;
    this.waiting = true;
    this.onArrived = onArrived;
    const give = window.setTimeout(() => this.settle(null), SYSTEM_WAIT_MS);
    loadSystem().then(
      (mod) => {
        window.clearTimeout(give);
        if (!this.waiting) return;
        try {
          this.settle(new mod.SolarSystem({ family: this.family, reduced: this.reduced, coarse: this.coarse, w: this.w, h: this.h, projects: projects.length, onLost: this.onSystemLost }));
        } catch {
          // No WebGL here, or none to spare.
          this.settle(null);
        }
      },
      () => {
        window.clearTimeout(give);
        this.settle(null);
      },
    );
  }

  /** Drop out of warp, in front of whichever sky this is. */
  private settle(system: SolarSystem | null) {
    if (!this.waiting || this.raf === -1) return system?.destroy();
    this.waiting = false;
    this.stage = "vista";
    this.system = system;
    // Without motion there's no drop out of warp to play: it's simply there.
    this.arriveAt = this.reduced ? -1 : this.time;
    this.warp = false;
    this.speed = WARP * 1.3;
    this.clear();
    // Made now, so the view is all there as it fades in.
    if (!system) this.makeTiles(Infinity);
    if (this.reduced) this.render();
    this.onArrived?.(system !== null);
  }

  /** The graphics context went away mid-flight: the vista takes over, and the trip goes on. */
  private onSystemLost = () => {
    const lost = this.system;
    if (!lost) return;
    this.system = null;
    lost.destroy();
    this.clear();
    this.makeTiles(Infinity);
    if (this.reduced) this.render();
  };

  /** One step back toward home: out of a place to the map. False if there's nothing to step back from. */
  back() {
    const went = this.system?.back() ?? false;
    if (went && this.reduced) this.render();
    return went;
  }

  /** Fades out, then lets go of everything. */
  leave() {
    this.canvas.classList.remove("on");
    this.system?.leave();
    window.setTimeout(() => this.destroy(), this.reduced ? 0 : FADE_MS);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = -1;
    this.canvas.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
    document.documentElement.removeEventListener("pointerleave", this.onLeave);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("deviceorientation", this.onTilt);
    document.removeEventListener("visibilitychange", this.schedule);
    window.removeEventListener(NAV_EVENT, this.onNav);
    window.removeEventListener("keydown", this.onKey);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.waiting = false;
    this.system?.destroy();
    this.system = null;
    this.canvas.remove();
    this.tiles.clear();
  }

  private schedule = () => {
    if (this.raf === -1) return;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (document.hidden) return;
    if (this.reduced) {
      this.render();
      return;
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  };

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.step(dt);
    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };

  private resize = () => {
    this.ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth || window.innerWidth;
    // What the canvas really covers: on phones the window and the viewport units can disagree about the address bar.
    this.h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.w * this.ratio);
    this.canvas.height = Math.round(this.h * this.ratio);
    this.system?.resize(this.w, this.h);
    if (this.reduced) this.render();
  };

  private moteCount() {
    return Math.round(clamp((this.w * this.h) / 2600, 240, 720));
  }

  private makeMote(z: number): Mote {
    const roll = Math.random();
    return { x: rand(-1.6, 1.6), y: rand(-1.6, 1.6), z, tint: roll > 0.92 ? WARM : roll > 0.82 ? COOL : STAR };
  }

  // ── input ──────────────────────────────────────

  private onDown = (e: PointerEvent) => {
    try { this.canvas.setPointerCapture(e.pointerId); } catch {}
    this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, last: performance.now() };
    this.pointer = { x: e.clientX, y: e.clientY, active: true };
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.stage === "voyage") this.warp = true;
    else { this.cam.vx = 0; this.cam.vy = 0; }
    if (this.reduced) this.render();
  };

  private onMove = (e: PointerEvent) => {
    const p = this.press;
    if (this.system) this.moveSystem(e);
    else if (p && p.id === e.pointerId) {
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (!p.moved && Math.hypot(dx, dy) > TAP_SLOP) p.moved = true;
      if (p.moved && this.stage === "vista") {
        // The sky moves with the finger, and remembers how fast, so letting go flings it on.
        const now = performance.now();
        const dt = Math.max(1 / 240, (now - p.last) / 1000);
        this.cam.x -= dx;
        this.cam.y -= dy;
        this.cam.vx = this.cam.vx * 0.6 - (dx / dt) * 0.4;
        this.cam.vy = this.cam.vy * 0.6 - (dy / dt) * 0.4;
        p.last = now;
        if (this.reduced) this.render();
      }
      if (p.moved || this.stage === "vista") { p.x = e.clientX; p.y = e.clientY; }
    }
    // A mouse steers wherever it is; a finger only while it's down.
    if (e.pointerType === "mouse" || (p && p.id === e.pointerId)) this.pointer = { x: e.clientX, y: e.clientY, active: true };
  };

  /** On the solar system: a drag turns it, two fingers zoom it, and a mouse with nothing held looks for a world. */
  private moveSystem(e: PointerEvent) {
    const system = this.system!;
    const p = this.press;
    const touch = this.touches.get(e.pointerId);
    if (touch && this.touches.size === 2) {
      const [a, b] = [...this.touches.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      touch.x = e.clientX;
      touch.y = e.clientY;
      const after = Math.hypot(a.x - b.x, a.y - b.y);
      if (before > 0 && after > 0) system.zoom(before / after);
      if (p) p.moved = true;
    } else if (p && p.id === e.pointerId) {
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (!p.moved && Math.hypot(dx, dy) > TAP_SLOP) p.moved = true;
      if (p.moved) {
        system.drag(dx, dy);
        p.x = e.clientX;
        p.y = e.clientY;
      }
    } else if (e.pointerType === "mouse") {
      this.canvas.style.cursor = system.hover(e.clientX, e.clientY) ? "pointer" : "";
    }
    if (this.reduced) this.render();
  }

  private onWheel = (e: WheelEvent) => {
    if (!this.system) return;
    e.preventDefault();
    this.system.zoom(Math.exp(clamp(e.deltaY, -120, 120) * 0.0016));
    if (this.reduced) this.render();
  };

  private onKey = (e: KeyboardEvent) => {
    const onToggle = e.target instanceof Element && e.target.closest("a, button");
    if (!this.system || (e.key === "Enter" && onToggle) || e.repeat) return;
    if (!this.system.key(e.key)) return;
    e.preventDefault();
    // The toggle keeps its own Enter, so walking the worlds takes the focus off it.
    if (onToggle) (document.activeElement as HTMLElement | null)?.blur();
    if (this.reduced) this.render();
  };

  private onUp = (e: PointerEvent) => {
    const p = this.press;
    if (e.pointerType !== "mouse") this.pointer.active = false;
    this.touches.delete(e.pointerId);
    if (!p || p.id !== e.pointerId) return;
    this.press = null;
    this.warp = false;
    this.system?.release();
    // While an answer is putting itself away, taps wait, so a quick second tap doesn't light a stray star.
    if (p.moved || this.closing >= 0) return;
    const hit = this.hits.find((h) => e.clientX >= h.x && e.clientX <= h.x + h.w && e.clientY >= h.y && e.clientY <= h.y + h.h);
    if (hit) {
      if (typeof hit.go === "string") window.dispatchEvent(new CustomEvent(GO_EVENT, { detail: hit.go }));
      else hit.go();
    // A tap on empty sky puts the answer away; with nothing showing, the solar system takes it, and the vista lights a star.
    } else if (this.overlay && (this.stage === "vista" || this.overlay.kind === "about")) this.close();
    else if (this.system) this.system.tap(e.clientX, e.clientY);
    else if (this.stage === "vista") this.ignite(e.clientX, e.clientY);
    if (this.reduced) this.render();
  };

  /** The nav's "projects" or "about", answered in this part of the trip. Asked again, it's put away. */
  private onNav = (e: Event) => {
    const kind = (e as CustomEvent<NavTarget>).detail;
    if (this.overlay?.kind === kind && this.closing < 0) return this.close();
    this.clear();
    this.overlay = { kind, at: this.time };
    if (this.stage === "voyage" && kind === "projects") this.setCourse();
    if (this.system) {
      // Asked from a place, the answer waits up on the map.
      this.system.back();
      this.system.showProbes(kind === "projects");
    } else {
      if (this.stage === "vista" && kind === "projects") this.chartProjects();
      if (this.stage === "vista" && kind === "about") this.traceName();
    }
    if (this.reduced) this.render();
  };

  /** Puts the answer away gently; without motion, at once. */
  private close() {
    if (!this.overlay || this.closing >= 0) return;
    if (this.reduced) return this.clear();
    this.closing = this.time;
  }

  /** How much of the answer is left as it puts itself away, 1 → 0. */
  private out() {
    return this.closing < 0 ? 1 : 1 - smoothstep(0, OVERLAY_FADE, this.time - this.closing);
  }

  private clear() {
    this.overlay = null;
    this.closing = -1;
    this.figures = [];
    this.nameStars = null;
    this.system?.showProbes(false);
    this.wonders = this.wonders.filter((wd) => !wd.href);
    if (this.reduced) this.render();
  }

  /** Set course: the projects come up ahead one after another, as named worlds to fly past. */
  private setCourse() {
    projects.forEach((pr, i) => {
      const [body, band] = WORLDS[(i * 2 + 1) % WORLDS.length];
      const side = i % 2 ? -1 : 1;
      this.wonders.push({
        kind: i === 0 ? "ringed" : "planet", x: side * rand(0.35, 0.5), y: rand(-0.25, 0.25), z: 1.3 + i * 0.55,
        size: i === 0 ? 0.12 : 0.08, body, band, seed: 7 + i * 31, tilt: rand(-0.4, 0.4),
        label: pr.status === "launched" ? pr.name.toLowerCase() : "░░░░ unannounced", href: `/projects#${pr.slug}`, dim: pr.status !== "launched",
      });
    });
    // Approach at cruise, so there's time to read them.
    this.warp = false;
  }

  /** New constellations: each project's stars, spread across the view in sky px, linked as they're revealed. */
  private chartProjects() {
    const n = projects.length;
    const narrow = this.w < 640;
    this.figures = projects.map((pr, i) => {
      // Phones stack them down the screen; wider screens set them side by side.
      const cx = this.cam.x + (narrow ? this.w / 2 : (this.w * (i + 0.5)) / n);
      const cy = this.cam.y + (narrow ? this.h * (0.18 + (0.5 * (i + 0.5)) / n) : this.h * (0.36 + (i % 2) * 0.14));
      const count = pr.status === "launched" ? 7 : 4;
      const spread = Math.min(this.w / (narrow ? 1.6 : n), 220) * 0.45;
      const stars: [number, number][] = [];
      for (let k = 0; k < count; k++) {
        const a = (k / count) * TAU + hash(i, k, 71) * 1.4;
        const r = spread * (0.35 + hash(i, k, 72) * 0.65);
        stars.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * (narrow ? 0.4 : 0.55)]);
      }
      return { label: pr.status === "launched" ? pr.name.toLowerCase() : "░░░░ unannounced", href: `/projects#${pr.slug}`, dim: pr.status !== "launched", stars };
    });
  }

  /** Your name traced in stars: drawn once on a hidden canvas, then sampled into points across the view. */
  private traceName() {
    const narrow = this.w < 640;
    const lines = narrow ? ["jimuel jean", "untalan"] : ["jimuel jean untalan"];
    const size = Math.min(narrow ? this.w * 0.15 : this.w * 0.075, 110);
    const off = document.createElement("canvas");
    off.width = Math.round(this.w);
    off.height = Math.round(size * 1.15 * lines.length + 20);
    const o = off.getContext("2d")!;
    const serif = getComputedStyle(document.body).getPropertyValue("--serif").trim() || "Georgia, serif";
    o.font = `${size}px ${serif}`;
    o.textAlign = "center";
    o.textBaseline = "top";
    o.fillStyle = "#fff";
    lines.forEach((l, i) => o.fillText(l, off.width / 2, 10 + i * size * 1.15));
    const data = o.getImageData(0, 0, off.width, off.height).data;
    const step = Math.max(5, Math.round(size / 11));
    const top = this.h * (narrow ? 0.26 : 0.3);
    const pts: [number, number][] = [];
    for (let y = 0; y < off.height; y += step) {
      for (let x = 0; x < off.width; x += step) {
        if (data[(y * off.width + x) * 4 + 3] > 140) pts.push([this.cam.x + x + (hash(x, y, 73) - 0.5) * 2, this.cam.y + top + y]);
      }
    }
    this.nameStars = { pts, x: this.cam.x + this.w / 2, y: this.cam.y + top + off.height + 18 };
  }

  private onLeave = () => {
    this.pointer.active = false;
  };

  private onTilt = (e: DeviceOrientationEvent) => {
    if (e.gamma === null || e.beta === null) return;
    // Held at a comfortable reading angle (about 40° from flat), you fly straight; tip it to turn.
    this.tilt = { x: clamp(e.gamma / 35, -1, 1), y: clamp((e.beta - 40) / 35, -1, 1), on: true };
  };

  /** A newborn star where the tap landed, in sky coordinates so it stays put as the sky moves. */
  private ignite(x: number, y: number) {
    this.births.push({ x: x + this.cam.x, y: y + this.cam.y, age: 0, seed: Math.random() * 1000 });
    if (this.births.length > MAX_BIRTHS) this.births.shift();
    this.lit++;
    if (this.reduced) this.render();
  }

  // ── simulation ─────────────────────────────────

  private step(dt: number) {
    this.time += dt;
    // Where to look: the pointer, else the phone's tilt, else drift back to straight ahead.
    const p = this.pointer;
    let tx = 0, ty = 0;
    if (p.active) { tx = (p.x / this.w - 0.5) * 2; ty = (p.y / this.h - 0.5) * 2; }
    else if (this.tilt.on) { tx = this.tilt.x; ty = this.tilt.y; }
    this.look.tx = clamp(tx, -1, 1) * 0.85;
    this.look.ty = clamp(ty, -1, 1) * 0.85;
    this.look.x += (this.look.tx - this.look.x) * dt * 1.8;
    this.look.y += (this.look.ty - this.look.y) * dt * 1.8;
    // Bank into the turn, like anything flying.
    this.roll += (-this.look.x * 0.28 - this.roll) * dt * 1.5;
    this.lean.x += (this.look.tx - this.lean.x) * dt * 2;
    this.lean.y += (this.look.ty - this.lean.y) * dt * 2;

    if (this.stage === "voyage" || this.arriving()) this.stepVoyage(dt);
    if (this.system) this.system.step(dt, this.look);
    else if (this.stage === "vista") this.stepVista(dt);
  }

  private arriving() {
    return this.arriveAt >= 0 && this.time - this.arriveAt < ARRIVE_SECONDS;
  }

  private stepVoyage(dt: number) {
    // Warp comes on hard and lets go gently; arriving, you brake right down.
    const target = this.stage === "vista" ? 0 : this.warp || this.waiting ? WARP : CRUISE;
    this.speed += (target - this.speed) * dt * (this.stage === "vista" ? 2.2 : this.warp ? 1.4 : 0.8);
    this.travelled += this.speed * dt * 0.6;
    const n = this.moteCount();
    for (const m of this.motes) {
      m.z -= this.speed * dt;
      const q = this.project(m.x, m.y, Math.max(m.z, 0.001));
      const gone = q.x < -60 || q.x > this.w + 60 || q.y < -60 || q.y > this.h + 60;
      if (m.z <= 0.015 || (gone && m.z < 0.95)) Object.assign(m, this.makeMote(rand(0.92, 1)));
    }
    while (this.motes.length < n) this.motes.push(this.makeMote(rand(0.05, 1)));
    this.motes.length = n;

    for (let i = this.wonders.length - 1; i >= 0; i--) {
      this.wonders[i].z -= this.speed * dt * 0.7;
      if (this.wonders[i].z < 0.05) this.wonders.splice(i, 1);
    }
    // Wonders come round every so often, sooner at warp since you're covering more ground.
    if (this.stage === "voyage" && (this.nextWonder -= dt * (this.speed / CRUISE)) <= 0 && this.wonders.length < 2) {
      this.nextWonder = rand(9, 16);
      const roll = Math.random();
      const kind = roll < 0.4 ? "planet" : roll < 0.7 ? "ringed" : "nebula";
      const [body, band] = WORLDS[Math.floor(Math.random() * WORLDS.length)];
      // Off to one side, so it slides past rather than straight into you.
      const a = rand(0, TAU), r = rand(0.35, 0.8);
      this.wonders.push({
        kind, x: Math.cos(a) * r, y: Math.sin(a) * r * 0.7, z: 1.3,
        size: kind === "nebula" ? rand(0.3, 0.5) : rand(0.06, 0.13),
        body: kind === "nebula" ? (Math.random() < 0.5 ? MAGENTA : TEAL) : body,
        band: kind === "nebula" ? VIOLET : band,
        seed: Math.floor(Math.random() * 1000), tilt: rand(-0.5, 0.5),
      });
    }
  }

  private stepVista(dt: number) {
    const cam = this.cam;
    if (!this.press) {
      cam.x += cam.vx * dt;
      cam.y += cam.vy * dt;
      // A fling slows back down to the slow drift the sky always has.
      cam.vx += (7 - cam.vx) * dt * 1.2;
      cam.vy += (2 - cam.vy) * dt * 1.2;
    }
    for (const b of this.births) b.age += dt;
    this.makeTiles(TILES_PER_FRAME);
  }

  // ── drawing ────────────────────────────────────

  private put(ch: string, x: number, y: number, color: Rgb, alpha: number) {
    if (alpha < 0.02 || x < -40 || y < -40 || x > this.w + 40 || y > this.h + 40) return;
    this.ctx.globalAlpha = alpha > 1 ? 1 : alpha;
    this.ctx.fillStyle = css(color);
    this.ctx.fillText(ch, x, y);
  }

  private render() {
    const { ctx } = this;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.globalAlpha = 1;
    // Over the solar system this canvas is only the writing on the glass.
    if (this.system) {
      ctx.clearRect(0, 0, this.w, this.h);
      this.system.draw();
    } else {
      ctx.fillStyle = css(SPACE);
      ctx.fillRect(0, 0, this.w, this.h);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Whatever is tappable is collected afresh as it's drawn.
    this.hits = [];
    const since = this.time - this.arriveAt;
    if (this.stage === "voyage" || this.arriving()) this.drawVoyage(this.stage === "vista" ? 1 - smoothstep(0, ARRIVE_SECONDS * 0.6, since) : 1);
    if (this.system) this.drawSystemTags();
    else if (this.stage === "vista") {
      const k = this.arriveAt < 0 ? 1 : smoothstep(ARRIVE_SECONDS * 0.2, ARRIVE_SECONDS, since);
      // Coming out of warp the view settles: a touch too close, easing back.
      const s = 1 + 0.14 * (1 - ease(k));
      ctx.translate(this.w / 2, this.h / 2);
      ctx.scale(s, s);
      ctx.translate(-this.w / 2, -this.h / 2);
      this.drawVista(k);
      ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    }
    if (this.overlay) this.drawOverlay();
    this.drawHud();
    // After the readout, whose dark band on phones would otherwise dim it.
    if (this.system?.landed()) this.drawBackToOrbit();
    ctx.globalAlpha = 1;
  }

  /** The point you're flying toward, on screen. */
  private vanish() {
    return { x: this.w / 2 + this.look.x * this.w * 0.28, y: this.h / 2 + this.look.y * this.h * 0.28 };
  }

  private project(x: number, y: number, z: number) {
    const v = this.vanish();
    const f = Math.max(this.w, this.h) * 0.25;
    const px = x / z, py = y / z;
    const c = Math.cos(this.roll), s = Math.sin(this.roll);
    return { x: v.x + (px * c - py * s) * f, y: v.y + (px * s + py * c) * f };
  }

  private drawVoyage(alpha: number) {
    const { ctx } = this;
    const warpK = smoothstep(CRUISE, WARP, this.speed);
    for (const wd of [...this.wonders].sort((a, b) => b.z - a.z)) this.drawWonder(wd, alpha);
    let font = "";
    for (const m of this.motes) {
      const p = this.project(m.x, m.y, m.z);
      if (p.x < -30 || p.x > this.w + 30 || p.y < -30 || p.y > this.h + 30) continue;
      const near = 1 - m.z;
      const g = m.z > 0.75 ? "." : m.z > 0.5 ? "·" : m.z > 0.28 ? "+" : m.z > 0.12 ? "*" : "✦";
      const size = Math.round(9 + near * near * 8);
      const f = `${size}px ${this.family}`;
      if (f !== font) { ctx.font = f; font = f; }
      const color = mix(m.tint, BLUESHIFT, warpK * 0.75);
      // Stars fade in from the back, so none ever pops into being.
      const a = smoothstep(1, 0.78, m.z) * (0.3 + 0.7 * near) * alpha;
      // Streaks: where the star was a moment ago, further back the faster you go.
      if (this.speed > 0.3) {
        const q = this.project(m.x, m.y, m.z + this.speed * (0.02 + warpK * 0.1));
        const dx = p.x - q.x, dy = p.y - q.y;
        const len = Math.hypot(dx, dy);
        if (len > 6) {
          const lg = lineGlyph(dx, dy);
          const steps = Math.min(16, Math.floor(len / 7));
          for (let i = 1; i <= steps; i++) this.put(lg, p.x - (dx * i) / steps, p.y - (dy * i) / steps, color, a * (1 - i / (steps + 1)) * 0.8);
        }
      }
      this.put(g, p.x, p.y, color, a);
    }
  }

  /**
   * A planet, a ringed giant or a nebula, drawn on a grid whose glyphs grow with it, so a close pass stays cheap.
   * Planets are lit from the upper left, with bands on the giants; nebulae are clouds of noise.
   */
  private drawWonder(wd: Wonder, alpha: number) {
    const c = this.project(wd.x, wd.y, wd.z);
    const f = Math.max(this.w, this.h) * 0.25;
    const r = (wd.size * f) / wd.z;
    const a = smoothstep(1.3, 1.0, wd.z) * smoothstep(0.05, 0.16, wd.z) * alpha * (wd.href ? this.out() : 1);
    if (a < 0.02 || r > Math.max(this.w, this.h) * 1.5) return;
    if (r < 3) { this.ctx.font = `10px ${this.family}`; this.put("·", c.x, c.y, wd.body, a); return; }
    const font = clamp(r / 16, 8, 26);
    const cw = font * 0.62, ch = font * 1.08;
    this.ctx.font = `${font}px ${this.family}`;
    const reach = r * (wd.kind === "ringed" ? 2.3 : wd.kind === "nebula" ? 1.2 : 1.1);
    const x0 = Math.max(-cw, c.x - reach), x1 = Math.min(this.w + cw, c.x + reach);
    const y0 = Math.max(-ch, c.y - reach), y1 = Math.min(this.h + ch, c.y + reach);
    const ring = (front: boolean) => {
      // A ring seen at an angle: glyphs round an ellipse, the far half behind the planet and the near half in front.
      const n = Math.round((r * 4) / cw);
      for (let i = 0; i < n; i++) {
        const t = (i / n) * TAU;
        if ((Math.sin(t) > 0) !== front) continue;
        for (const k of [1.55, 1.8, 2.05]) {
          const ex = Math.cos(t) * r * k, ey = Math.sin(t) * r * k * 0.26;
          const x = c.x + ex * Math.cos(wd.tilt) - ey * Math.sin(wd.tilt), y = c.y + ex * Math.sin(wd.tilt) + ey * Math.cos(wd.tilt);
          if (!front && Math.hypot(x - c.x, y - c.y) < r) continue;
          this.put(k === 1.8 ? "=" : "-", x, y, wd.band, a * (k === 1.8 ? 0.8 : 0.5));
        }
      }
    };
    if (wd.kind === "ringed") ring(false);
    for (let y = Math.floor(y0 / ch) * ch; y <= y1; y += ch) {
      for (let x = Math.floor(x0 / cw) * cw; x <= x1; x += cw) {
        const nx = (x - c.x) / r, ny = (y - c.y) / r;
        const d2 = nx * nx + ny * ny;
        if (wd.kind === "nebula") {
          if (d2 > 1.44) continue;
          const dens = fbm(nx * 2.2 + wd.seed, ny * 2.2, 31) - 0.3 - Math.sqrt(d2) * 0.45;
          if (dens <= 0) continue;
          const col = mix(wd.body, wd.band, noise(nx * 3 + wd.seed, ny * 3, 32));
          this.put(RAMP[clamp(Math.round(dens * 16), 1, 9)], x, y, mix(col, WHITE, smoothstep(0.25, 0.45, dens) * 0.5), a * clamp(dens * 2.4, 0, 0.9));
          continue;
        }
        if (d2 > 1) {
          if (d2 < 1.2) this.put(".", x, y, COOL, a * 0.35 * (1 - (d2 - 1) / 0.2));
          continue;
        }
        const nz = Math.sqrt(1 - d2);
        const lam = nx * -0.6 + ny * -0.45 + nz * 0.66;
        const b = clamp(lam, 0, 1);
        if (b < 0.04) { this.put(".", x, y, wd.body, a * 0.12); continue; }
        const stripe = wd.kind === "ringed" || wd.seed % 2 ? noise(ny * 7 + wd.seed, nx * 0.6, 33) : noise(nx * 4 + wd.seed, ny * 4, 34);
        const col = mix(wd.body, wd.band, smoothstep(0.35, 0.65, stripe));
        this.put(RAMP[clamp(Math.round(b * 9), 1, 9)], x, y, col, a * (0.35 + 0.65 * b));
      }
    }
    if (wd.kind === "ringed") ring(true);
    if (wd.label && wd.href) this.label(wd.label, c.x, Math.min(this.h - 40, c.y + r * (wd.kind === "ringed" ? 0.9 : 1.15) + 16), wd.href, wd.dim ?? false, a);
  }

  /** The names on the map, the one in focus with its way in, and what a tap has just earned. */
  private drawSystemTags() {
    const system = this.system!;
    const quiet = this.overlay ? 0.35 : 1;
    for (const tag of system.tags()) {
      if (tag.run) {
        if (!this.overlay) this.label(tag.text, tag.x, tag.y, tag.run, false, 1, tag.sub);
        continue;
      }
      this.ctx.font = `10px ${this.family}`;
      this.put(tag.text, tag.x, tag.y, FAINT, 0.75 * quiet);
    }
    const narrow = this.w < 640;
    const line = system.saying();
    if (line) {
      const y = this.h - (narrow ? 142 : 64);
      this.ctx.font = `12px ${this.family}`;
      const w = this.ctx.measureText(line.text).width;
      this.ctx.globalAlpha = 0.72 * line.alpha;
      this.ctx.fillStyle = css(SPACE);
      this.ctx.fillRect(this.w / 2 - w / 2 - 12, y - 14, w + 24, 28);
      this.put(line.text, this.w / 2, y, ACCENT, line.alpha);
    }
  }

  /** The way back up, tall enough for a thumb. Phones keep it above the readout, wider screens at the foot of the view. */
  private drawBackToOrbit() {
    const { ctx } = this;
    const text = "← back to orbit";
    const narrow = this.w < 640;
    const x = narrow ? this.w - 76 : this.w / 2, y = this.h - (narrow ? 32 : 28);
    ctx.font = `12px ${this.family}`;
    const w = ctx.measureText(text).width;
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = css(SPACE);
    ctx.fillRect(x - w / 2 - 12, y - 15, w + 24, 30);
    this.put(text, x, y, ACCENT, 0.95);
    this.hits.push({ x: x - w / 2 - 14, y: y - 22, w: w + 28, h: 44, go: () => this.back() });
  }

  /** The projects as probes on the map, each with its name, one after another. */
  private drawProbes(since: number) {
    const out = this.out();
    this.system!.probes().forEach((f, i) => {
      const pr = projects[i];
      if (!pr || f.depth > 1) return;
      const live = pr.status === "launched";
      this.label(live ? pr.name.toLowerCase() : "░░░░ unannounced", f.x, f.y + 16, `/projects#${pr.slug}`, !live, smoothstep(0, 0.5, since - i * 0.35) * out);
    });
  }

  /** A tappable name under something: the name, and a quieter "open →" beneath it. */
  private label(text: string, x: number, y: number, go: Hit["go"], dim: boolean, alpha: number, sub = "open →") {
    const { ctx } = this;
    if (alpha < 0.15) return;
    ctx.font = `12px ${this.family}`;
    const w = ctx.measureText(text).width;
    x = clamp(x, w / 2 + 16, this.w - w / 2 - 16);
    // A dark backing, so the name reads even over the brightest gas.
    ctx.globalAlpha = 0.72 * alpha;
    ctx.fillStyle = css(SPACE);
    ctx.fillRect(x - w / 2 - 8, y - 10, w + 16, 36);
    this.put(text, x, y, dim ? FAINT : ACCENT, alpha);
    ctx.font = `10px ${this.family}`;
    this.put(sub, x, y + 16, FAINT, alpha * 0.8);
    if (this.closing < 0) this.hits.push({ x: x - w / 2 - 10, y: y - 14, w: w + 20, h: 40, go });
  }

  /** What the sky holds at a point (sky px): the Milky Way's band with a dark rift, and nebulae of warped noise. */
  private field(x: number, y: number) {
    // The band runs on a diagonal and wanders a little, with its dust rift wandering inside it.
    const along = x * 0.8 + y * 0.6;
    const across = -x * 0.6 + y * 0.8 + Math.sin(along / 1400) * 260;
    const band = Math.exp(-((across / 560) ** 2));
    const rift = smoothstep(0.5, 0.72, noise(along / 240, across / 110, 81)) * Math.exp(-(((across - 50 * Math.sin(along / 700)) / 130) ** 2));
    const grain = noise(x / 42, y / 42, 82) * 0.6 + noise(x / 11, y / 11, 97) * 0.4;
    const milky = band * (0.3 + 0.7 * grain) * (1 - rift * 0.9);
    // Nebulae: noise pushed around by more noise, so the clouds curl instead of blobbing.
    const wx = x / 760 + noise(x / 1000, y / 1000, 83) * 1.7, wy = y / 760 + noise(x / 1000 + 7, y / 1000, 84) * 1.7;
    const neb = smoothstep(0.53, 0.86, fbm(wx, wy, 85));
    return { milky, neb, hue: noise(x / 1800, y / 1800, 86), grain };
  }

  private nebulaColour(hue: number, x: number, y: number) {
    const fine = noise(x / 120, y / 120, 87);
    return hue < 0.38 ? mix(MAGENTA, VIOLET, fine) : hue < 0.62 ? mix(TEAL, VIOLET, fine * 0.7) : mix(AMBER, MAGENTA, fine);
  }

  /** One tile of the sky, drawn once and kept. Glyphs sit on one grid across all tiles, so tiles meet seamlessly. */
  private makeTile(tx: number, ty: number) {
    const tr = Math.min(window.devicePixelRatio || 1, 1.5);
    const tile = document.createElement("canvas");
    tile.width = tile.height = Math.round(TILE * tr);
    const t = tile.getContext("2d")!;
    t.setTransform(tr, 0, 0, tr, 0, 0);
    t.font = `${SKY_FONT}px ${this.family}`;
    t.textAlign = "center";
    t.textBaseline = "middle";
    const cw = SKY_FONT * 0.62, ch = SKY_FONT * 1.08;
    const ox = tx * TILE, oy = ty * TILE;
    // Cells overlapping the edge are drawn in both tiles, each clipped to its own half.
    for (let iy = Math.floor((oy - ch) / ch); iy * ch <= oy + TILE + ch; iy++) {
      for (let ix = Math.floor((ox - cw) / cw); ix * cw <= ox + TILE + cw; ix++) {
        const x = ix * cw + cw / 2, y = iy * ch + ch / 2;
        const f = this.field(x, y);
        let g = "", col: Rgb = STAR, a = 0;
        // Gas: filaments from finer noise inside each cloud, dithered so the thin parts are wisps, not a wall.
        const d = Math.min(1, f.neb * (0.35 + 1.1 * fbm(x / 90, y / 90, 88)));
        if (f.neb > 0.03 && hash(ix, iy, 98) < d * 2.6) {
          g = RAMP[clamp(Math.round(d * 10), 1, 9)];
          col = mix(this.nebulaColour(f.hue, x, y), WHITE, smoothstep(0.6, 0.95, d) * 0.6);
          a = 0.2 + 0.8 * d;
        } else if (hash(ix, iy, 89) < f.milky * 0.75) {
          // Each star in the band its own brightness, so it reads as grain rather than blocks of one glyph.
          const v = f.milky * (0.45 + hash(ix, iy, 96));
          g = v > 0.95 ? "*" : v > 0.7 ? "+" : v > 0.45 ? "·" : ".";
          col = mix(STAR, WARM, f.grain * 0.45);
          a = 0.12 + 0.5 * Math.min(1, v);
        }
        if (!g) continue;
        t.globalAlpha = a;
        t.fillStyle = css(col);
        t.fillText(g, x - ox, y - oy);
      }
    }
    return tile;
  }

  /** The tiles in view (and a ring round it), made at most `budget` at a time; far-off ones are let go. */
  private makeTiles(budget: number) {
    const { x0, y0, x1, y1 } = this.tileSpan();
    for (let ty = y0; ty <= y1 && budget > 0; ty++) {
      for (let tx = x0; tx <= x1 && budget > 0; tx++) {
        const key = `${tx},${ty}`;
        if (this.tiles.has(key)) continue;
        this.tiles.set(key, this.makeTile(tx, ty));
        budget--;
      }
    }
    if (this.tiles.size > MAX_TILES) {
      for (const key of this.tiles.keys()) {
        const [tx, ty] = key.split(",").map(Number);
        if (tx < x0 - 2 || tx > x1 + 2 || ty < y0 - 2 || ty > y1 + 2) this.tiles.delete(key);
      }
    }
  }

  private tileSpan() {
    // A margin covers the parallax lean and the settle zoom on arrival.
    const m = 120;
    const ox = this.cam.x + this.lean.x * 24, oy = this.cam.y + this.lean.y * 24;
    return {
      x0: Math.floor((ox - m) / TILE), x1: Math.floor((ox + this.w + m) / TILE),
      y0: Math.floor((oy - m) / TILE), y1: Math.floor((oy + this.h + m) / TILE),
    };
  }

  /**
   * The vista in three depths: far stars barely moving, the gas and the Milky Way in tiles, and a few bright
   * near stars sliding past fastest. Leaning the pointer (or the phone) shifts them by different amounts.
   */
  private drawVista(alpha: number) {
    const { ctx, cam, lean, time: t } = this;
    // Far: faint dust of stars, a third as quick as the sky.
    ctx.font = `9px ${this.family}`;
    const fx = cam.x * 0.35 + lean.x * 8, fy = cam.y * 0.35 + lean.y * 8;
    const FAR = 34;
    for (let iy = Math.floor(fy / FAR); iy * FAR <= fy + this.h; iy++) {
      for (let ix = Math.floor(fx / FAR); ix * FAR <= fx + this.w; ix++) {
        const hh = hash(ix, iy, 90);
        if (hh > 0.5) continue;
        const x = ix * FAR + hash(ix, iy, 91) * FAR - fx, y = iy * FAR + hash(ix, iy, 92) * FAR - fy;
        const tw = 0.6 + 0.4 * Math.sin(t * (0.6 + hh * 2) + hh * 40);
        this.put(hh < 0.08 ? "·" : ".", x, y, hh < 0.05 ? COOL : STAR, (0.15 + hh * 0.5) * tw * alpha);
      }
    }
    // The sky itself.
    const sx = cam.x + lean.x * 24, sy = cam.y + lean.y * 24;
    const { x0, y0, x1, y1 } = this.tileSpan();
    ctx.globalAlpha = alpha;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const tile = this.tiles.get(`${tx},${ty}`);
        if (tile) ctx.drawImage(tile, tx * TILE - sx, ty * TILE - sy, TILE, TILE);
      }
    }
    // While the nav's answer is out, the gas dims behind it, so a constellation or a name reads even where the
    // nebula is brightest (a small screen is often all nebula).
    if (this.overlay) {
      ctx.globalAlpha = 0.62 * smoothstep(0, 0.5, t - this.overlay.at) * this.out() * alpha;
      ctx.fillStyle = css(SPACE);
      ctx.fillRect(0, 0, this.w, this.h);
    }
    // Near: a few bright stars, quicker than the sky.
    const nx = cam.x * 1.3 + lean.x * 40, ny = cam.y * 1.3 + lean.y * 40;
    const NEAR = 150;
    for (let iy = Math.floor(ny / NEAR); iy * NEAR <= ny + this.h; iy++) {
      for (let ix = Math.floor(nx / NEAR); ix * NEAR <= nx + this.w; ix++) {
        const hh = hash(ix, iy, 93);
        if (hh > 0.22) continue;
        const x = ix * NEAR + hash(ix, iy, 94) * NEAR - nx, y = iy * NEAR + hash(ix, iy, 95) * NEAR - ny;
        const tw = 0.7 + 0.3 * Math.sin(t * 1.6 + hh * 90);
        ctx.font = `${hh < 0.06 ? 15 : 12}px ${this.family}`;
        this.put(hh < 0.06 ? "✦" : hh < 0.14 ? "*" : "+", x, y, hh < 0.04 ? WARM : hh < 0.1 ? COOL : STAR, (0.5 + hh * 2) * tw * alpha);
      }
    }
    this.drawBirths(sx, sy, alpha);
  }

  /** The stars you lit: a flash, a ring of light blowing out through the gas, and a star that stays and twinkles. */
  private drawBirths(sx: number, sy: number, alpha: number) {
    for (const b of this.births) {
      const x = b.x - sx, y = b.y - sy;
      if (x < -120 || y < -120 || x > this.w + 120 || y > this.h + 120) continue;
      if (b.age < BIRTH_RING) {
        const k = b.age / BIRTH_RING;
        const r = 6 + ease(k) * 90;
        this.ctx.font = `11px ${this.family}`;
        const n = 22;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + b.seed;
          this.put(i % 3 ? "·" : "*", x + Math.cos(a) * r, y + Math.sin(a) * r, mix(WHITE, MAGENTA, k), (1 - k) * 0.9 * alpha);
        }
      }
      // A soft halo of light round it, then the star.
      const settle = smoothstep(0, 0.5, b.age);
      this.ctx.font = `9px ${this.family}`;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + b.seed + this.time * 0.15;
        this.put("·", x + Math.cos(a) * 13, y + Math.sin(a) * 9, WARM, 0.35 * settle * (0.6 + 0.4 * Math.sin(this.time * 2 + i)) * alpha);
      }
      const flash = 1 - smoothstep(0, 0.6, b.age);
      this.ctx.font = `${Math.round(16 + flash * 14)}px ${this.family}`;
      this.put("✦", x, y, mix(WARM, WHITE, 0.4 + flash * 0.6), (0.85 + 0.15 * Math.sin(this.time * 2.4 + b.seed)) * alpha);
    }
  }

  /** The readout, in the same small print as the sky's stats: where you are, and what you can do. */
  private drawHud() {
    const { ctx } = this;
    // Wide screens read it top right, as the sky's stats; phones at the bottom, clear of the nav and its notes.
    const narrow = this.w < 640;
    const x = narrow ? 20 : this.w - (this.w >= 1024 ? this.w * 0.14 : 24);
    ctx.textAlign = narrow ? "left" : "right";
    ctx.font = `11px ${this.family}`;
    let lines: string[], hint: string;
    if (this.system) {
      ({ lines, hint } = this.system.readout());
    } else if (this.stage === "voyage") {
      lines = [`voyage · ${this.travelled.toFixed(2)} ly`, this.speed > CRUISE * 1.6 ? `warp ${(this.speed / CRUISE).toFixed(1)}` : "cruising"];
      hint = this.coarse ? "hold to warp · drag to steer ↯" : "hold to warp · steer with the cursor ↯";
    } else {
      const ra = ((((this.cam.x / 3000) % 24) + 24) % 24).toFixed(1);
      const dec = clamp(-this.cam.y / 90, -90, 90).toFixed(0);
      lines = [`vista · ra ${ra}h · dec ${dec}°`, `${this.lit} ${this.lit === 1 ? "star" : "stars"} born`];
      hint = narrow ? "drag to roam · tap for a star ↯" : "drag to roam · tap to ignite a star ↯";
    }
    const top = narrow ? this.h - 20 - lines.length * 18 : this.w >= 1024 ? 30 : 70;
    // A dark backing so the readout holds over bright gas: a band fading up from the bottom on phones, a soft
    // panel behind it on wider screens.
    if (narrow) {
      const band = ctx.createLinearGradient(0, top - 40, 0, this.h);
      band.addColorStop(0, `rgba(${SPACE.join(",")},0)`);
      band.addColorStop(0.45, `rgba(${SPACE.join(",")},0.82)`);
      band.addColorStop(1, `rgba(${SPACE.join(",")},0.92)`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = band;
      ctx.fillRect(0, top - 40, this.w, this.h - top + 40);
    } else {
      const bw = Math.max(...[...lines, hint].map((l) => ctx.measureText(l).width)) + 28;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = css(SPACE);
      ctx.fillRect(x - bw + 14, top - 16, bw, (lines.length + 1) * 18 + 16);
    }
    // Muted, not faint: at 62% the readout keeps about 6.5:1 against the dark.
    lines.forEach((l, i) => this.put(l, x, top + i * 18, STAR, 0.62));
    this.put(hint, x, top + lines.length * 18 + Math.sin(this.time * 2) * 1.5, [196, 214, 255], 0.75);
    ctx.textAlign = "center";
  }

  /** The nav's answers that live on the screen rather than on a passing world. */
  private drawOverlay() {
    if (this.closing >= 0 && this.out() <= 0) return this.clear();
    const o = this.overlay!;
    const since = this.time - o.at;
    if (o.kind === "about" && (this.stage === "voyage" || this.system)) this.drawLog(since);
    else if (o.kind === "projects" && this.system) this.drawProbes(since);
    else if (o.kind === "projects" && this.stage === "vista") this.drawFigures(since);
    else if (o.kind === "about" && this.stage === "vista") this.drawName(since);
    // Once the last of the course has gone by, the answer is done.
    else if (o.kind === "projects" && this.stage === "voyage" && !this.wonders.some((wd) => wd.href)) this.overlay = null;
  }

  /** The log's lines, any too wide for the panel folded at their separators, under the value column. Measures in the current font. */
  private foldLog(room: number) {
    const { ctx } = this;
    return LOG_LINES.flatMap((line) => {
      if (ctx.measureText(line).width <= room) return [line];
      const rows: string[] = [];
      let row = "";
      for (const part of line.split(" · ")) {
        const longer = row ? `${row} · ${part}` : part;
        if (row && ctx.measureText(longer).width > room) {
          rows.push(row);
          row = LOG_INDENT + part;
        } else row = longer;
      }
      return [...rows, row];
    });
  }

  /** The ship's log: the about typed out line by line in a panel low on the screen, ending in the way to the dossier. */
  private drawLog(since: number) {
    const { ctx } = this;
    const narrow = this.w < 640;
    const lh = 19;
    ctx.font = `${narrow ? 11 : 12}px ${this.family}`;
    const pw = Math.min(this.w - 32, 440);
    const rows = this.foldLog(pw - 28);
    const ph = rows.length * lh + 22;
    const px = narrow ? 16 : this.w >= 1024 ? this.w * 0.14 : 24;
    // On phones the readout is at the bottom, so the log sits above it.
    const py = this.h - ph - (narrow ? 96 : 32);
    const a = smoothstep(0, 0.4, since) * this.out();
    ctx.globalAlpha = 0.86 * a;
    ctx.fillStyle = css(SPACE);
    ctx.fillRect(px, py, pw, ph);
    ctx.globalAlpha = 0.3 * a;
    ctx.strokeStyle = css(ACCENT);
    ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    ctx.textAlign = "left";
    let budget = Math.floor((since - 0.3) * TYPE_RATE);
    rows.forEach((line, i) => {
      if (budget <= 0) return;
      const shown = line.slice(0, budget);
      budget -= line.length;
      const last = i === rows.length - 1;
      const y = py + 20 + i * lh;
      this.put(shown, px + 14, y, i === 0 || last ? ACCENT : STAR, (i === 0 ? 0.6 : 0.85) * a);
      if (last && shown.length === line.length && this.closing < 0) this.hits.push({ x: px + 8, y: y - 12, w: ctx.measureText(line).width + 14, h: 24, go: "/about" });
      // The cursor sits at the end of whatever is being typed.
      if (budget < 0 && Math.floor(this.time * 2) % 2) this.put("█", px + 14 + ctx.measureText(shown).width + 4, y, ACCENT, 0.7 * a);
    });
    ctx.textAlign = "center";
  }

  /** The projects as constellations: stars appear one by one, joined by dotted lines, then the name beneath. */
  private drawFigures(since: number) {
    const sx = this.cam.x + this.lean.x * 24, sy = this.cam.y + this.lean.y * 24;
    const out = this.out();
    this.figures.forEach((f, fi) => {
      const t = since - fi * 0.5;
      if (t <= 0) return;
      // Putting itself away, each figure takes its stars back one by one, in the order it drew them.
      const drawn = Math.min(f.stars.length, Math.floor(t / 0.28) + 1);
      const shown = Math.ceil(drawn * out);
      const col = f.dim ? FAINT : ACCENT;
      this.ctx.font = `9px ${this.family}`;
      for (let k = 1; k < shown; k++) {
        const [ax, ay] = f.stars[k - 1], [bx, by] = f.stars[k];
        const n = Math.max(2, Math.floor(Math.hypot(bx - ax, by - ay) / 9));
        for (let j = 1; j < n; j++) this.put("·", ax + ((bx - ax) * j) / n - sx, ay + ((by - ay) * j) / n - sy, col, 0.45 * out);
      }
      for (let k = 0; k < shown; k++) {
        this.ctx.font = `${k === 0 ? 16 : 12}px ${this.family}`;
        this.put(k === 0 ? "✦" : "*", f.stars[k][0] - sx, f.stars[k][1] - sy, col, 0.9 * out);
      }
      if (drawn === f.stars.length) {
        const by = Math.max(...f.stars.map((st) => st[1])) - sy + 22;
        const cx = f.stars.reduce((m, st) => m + st[0], 0) / f.stars.length - sx;
        this.label(f.label, cx, by, f.href, f.dim, smoothstep(0, 0.5, t - f.stars.length * 0.28) * out);
      }
    });
  }

  /** Your name in the stars, swept in left to right, with a caption and the way to the dossier beneath. */
  private drawName(since: number) {
    const ns = this.nameStars;
    if (!ns) return;
    const sx = this.cam.x + this.lean.x * 24, sy = this.cam.y + this.lean.y * 24;
    const sweep = ns.x - this.w / 2 + since * this.w * 0.6;
    const out = this.out();
    // Putting itself away, the name scatters: each star drifts off its letter and fades back into the sky.
    const scatter = ease(1 - out);
    for (const [x, y] of ns.pts) {
      if (x > sweep) continue;
      const hh = hash(Math.round(x), Math.round(y), 74);
      const tw = 0.7 + 0.3 * Math.sin(this.time * 1.8 + hh * 50);
      const a = hash(Math.round(x), Math.round(y), 75) * TAU;
      const px = x + (x - ns.x) * 0.25 * scatter + Math.cos(a) * 70 * scatter, py = y + Math.sin(a) * 50 * scatter;
      this.ctx.font = `${hh < 0.08 ? 13 : 10}px ${this.family}`;
      this.put(hh < 0.08 ? "✦" : hh < 0.4 ? "·" : ".", px - sx, py - sy, hh < 0.15 ? WARM : WHITE, (hh < 0.4 ? 0.95 : 0.7) * tw * out);
    }
    const a = smoothstep(1.4, 2.2, since) * out;
    if (a <= 0) return;
    this.ctx.font = `12px ${this.family}`;
    this.put("software engineer · open to internships", ns.x - sx, ns.y - sy, STAR, 0.7 * a);
    this.label("open the dossier", ns.x - sx, ns.y - sy + 26, "/about", false, a);
  }
}
