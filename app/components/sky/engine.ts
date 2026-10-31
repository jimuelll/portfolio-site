/*
 * The sky behind the site, drawn entirely in monospace glyphs on one canvas.
 *
 * Night (dark theme): a large cratered moon, shaded with an ASCII density ramp. It rocks gently (libration)
 * and its phase drifts between gibbous and full. The starfield drifts, twinkles, and bends around the cursor
 * like light around a gravitational lens. Clicking empty sky launches a comet that falls under the moon's
 * gravity, so it orbits, slingshots away, or crashes. Now and then a shooting star crosses the sky.
 *
 * Day (light theme): a sun of the same size in the same place, with a boiling surface, sunspots that turn with
 * it, and a flickering corona. Dust motes drift and glint. Clicking erupts a solar flare toward the cursor.
 *
 * Switching theme is an eclipse. Going to night, the moon slides across the sun and the sky darkens as it
 * covers it; at totality the corona flares out and the stars come in. Going to day, the moon goes dark, the
 * corona appears behind it, and the moon slides off to let the light back.
 *
 * Earth (a hidden twilight theme, reached by flicking the theme toggle five times fast): the camera pulls back
 * from the moon or sun to a turning ASCII Earth drawn from a real coastline map, with clouds, city lights on the
 * night side and the moon going round it. Clicking puts a satellite into orbit where you click.
 *
 * Anything on the page marked [data-sky-avoid] dims the sky underneath it so text always stays readable.
 */

export type Scene = "night" | "day" | "earth";
/** detail: the moon's phase by night, the sunspot count by day. Empty when there's no moon or sun on screen. */
export type SkyStats = { scene: Scene; detail: string; comets: number; flares: number; sats: number; launched: number; flared: number };
/** full: the home page sky. quiet: a faint starfield behind interior pages. emblem: a small framed sky. */
export type SkyVariant = "full" | "quiet" | "emblem";
type Rgb = [number, number, number];
type Box = { left: number; top: number; right: number; bottom: number };
type Vec = [number, number, number];

const TAU = Math.PI * 2;
const STEP = 1 / 120;
const MAX_COMETS = 24;
const TRAIL = 150;
const DIM_UNDER_CONTENT = 0.12;
const AVOID = "[data-sky-avoid]";
const INTERACTIVE = "a, button, input, textarea, select, label, [role='button'], [data-sky-ignore]";
const RAMP = " .:-=+*#%@";
/** How long the eclipse takes when the theme changes. The nav keeps its transition class on a little longer. */
export const TURN_SECONDS = 2.8;
/** Set on <html> while an inner page's theme fades over (see top-nav.tsx): the sky switches at once, no eclipse. */
export const SUNRISE_CLASS = "theme-sunrise";
/** Dispatch on window with detail {x, y} in client coordinates to fire a comet (night) or flare (day) from there. */
export const LAUNCH_EVENT = "sky-launch";
/** The home page's CV receiver asks the sky to deliver: `{x, y}` is where it lands, in viewport px. */
export const DELIVER_EVENT = "sky-deliver";
/** How long a delivery takes to reach the receiver; the button reacts on arrival. */
export const DELIVER_SECONDS = 1.6;
const DELIVER_AFTERGLOW = 0.8;
/** How far round the cursor the day's heat shimmer reaches. */
const SHIMMER_R = 150;
const MAX_FLARES = 6;
const FLARE_GROW = 0.45;
const FLARE_LIFE = 1.7;
/** The sun turns once in about two minutes, carrying its spots round. */
const SUN_SPIN = TAU / 130;
const PHASE_PERIOD = 150;
const SPOTS = 3;
/** The zoom between Earth and the moon or sun. */
const ZOOM_SECONDS = 1.8;
const TWILIGHT_BG: Rgb = [14, 22, 46];
const MAX_SATS = 30;
/** One satellite at 1.3 Earth radii goes round in 8 s; further out is slower, by Kepler's third law. */
const SAT_W0 = (TAU / 8) * 1.3 ** 1.5;
/**
 * Where there's land on Earth: a 128 × 64 equirectangular bitmap (north up, from 180°W), one bit per cell,
 * base64. Made by sampling the global-land-mask package.
 */
const LAND = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwD6AAAAAAAAAAAAAAAAA/7//8AAAAAAYAAAAAAABhlz//+ABAAAAAwAAAAAAAur8A//gAAACAf/ACAAAAAP6vwP/wAAABD///14AIf///fnB/4AA/gP///////n////58fw4Af/////////A////yODgAAf/////////gf///4OAIAAPP///////ngAwf/+D8AAAgz//////8DAAAB//+/gAAcZ//////+BwAAAP///8AAHf///////4AAAAB///5gAAf///////8AAAAAP///AAAH///////+AAAAAD//+AAAF+8P/////IAAAAA///AAAB4X//////AAAAAAP//gAAAcBv////+RAAAAAB//4AAAD8Af////lwAAAAAP/8AAAB/mP////4gAAAAAA/yAAAA///////+AAAAAAAXgQAAAf//ff///gAAAAAAA4AAAAP///+P//wAAAAAAAPIgAAD//+/h+fwAAAAAAAB+CAAA///3wPHwAAAAAAAABwAAAP//9wDg+AAAAAAAAAEAAAD///wAYHhAAAAAAAAAnwAAf///AEBQAAAAAAAAAD+AAD///wAgACAAAAAAAAA/8AAAf/4AAKMAAAAAAAAAP/AAAH/8AABnAAAAAAAAAH/8AAB/+AAAJ8AAAAAAAAB//4AAP/AAADADwAAAAAAAf//AAD/wAAAOAeAAAAAAAD//gAAf8AAAAAAgAAAAAAAf/wAAH/AAAAAMgAAAAAAAH/8AAD/7AAAAPsAAAAAAAAf/AAA/4wAAAH/AAAAAAAAH/wAAH+YAAAH/4AAAAAAAB/wAAB/mAAAD//AAAAAAAAf4AAAfwAAAA//4AAAAAAAH8AAAD4AAAAH/+AAAAAAAB/AAAA8AAAAB5/AAAAAAAA/AAAAAAAAAAAHwAAAAAAAPwAAAAAAAAAAA4AgAAAAADwAAAAAAAAAAAAAIAAAAAA4AAAAAAAAAAAAAIAAAAAAcAAAAAAAAAAAAAAAAAAAAHAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAwABmBAAAAAAAAAIAAAAAD/5////+AAAAAAAPAAA//////////8AAAV4//wAA//////////+AAf///8AAP///////////AAD////oDj///////////gAD/////3/////////////D//////////////////////////////////////////w==";
let landBits: Uint8Array | null = null;
function isLand(lon: number, lat: number) {
  if (!landBits) {
    const raw = atob(LAND);
    landBits = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }
  const x = Math.floor((((lon / TAU + 0.5) % 1) + 1) % 1 * 128) % 128;
  const y = Math.min(63, Math.max(0, Math.floor((0.5 - lat / Math.PI) * 64)));
  const i = y * 128 + x;
  return (landBits[i >> 3] >> (7 - (i & 7))) & 1;
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

interface Palette {
  star: Rgb;
  warm: Rgb;
  cool: Rgb;
  /** Moon highlands and maria by night; the sun's mid-tone and deep tone by day. */
  bright: Rgb;
  deep: Rgb;
  orbit: Rgb;
  comet: Rgb;
  /** Light pages are ink on paper: shadow is drawn as dense ink instead of bright glyphs. */
  ink: boolean;
  alpha: number;
}

const DARK: Palette = {
  star: [214, 224, 240],
  warm: [242, 186, 84],
  cool: [128, 182, 240],
  bright: [226, 230, 238],
  deep: [128, 140, 166],
  orbit: [120, 140, 170],
  comet: [255, 240, 214],
  ink: false,
  alpha: 1,
};

const DARK_BG: Rgb = [7, 9, 15];
const MOON_DUSK: Rgb = [92, 122, 186];
/** The sun from limb to core: deep red, orange, gold. */
const SUN_LIMB: Rgb = [150, 44, 34];
const SUN_MID: Rgb = [206, 92, 40];
const SUN_CORE: Rgb = [222, 150, 40];
const EARTH_SEA: Rgb = [84, 156, 228];
const EARTH_DEEP: Rgb = [36, 78, 160];
const EARTH_GREEN: Rgb = [96, 170, 98];
const EARTH_DRY: Rgb = [196, 168, 108];
const EARTH_ICE: Rgb = [226, 236, 248];
const EARTH_CLOUD: Rgb = [240, 244, 252];
const EARTH_ATMO: Rgb = [126, 196, 255];
const EARTH_NIGHT: Rgb = [70, 92, 150];
const EARTH_CITY: Rgb = [255, 206, 122];
const EARTH_SAT: Rgb = [228, 236, 255];
const LIGHT_BG: Rgb = [243, 239, 228];

const LIGHT: Palette = {
  star: [30, 42, 66],
  warm: [196, 74, 40],
  cool: [38, 86, 140],
  bright: [214, 120, 52],
  deep: [74, 36, 30],
  orbit: [150, 128, 104],
  comet: [176, 58, 30],
  ink: true,
  alpha: 0.92,
};

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hash(x: number, y: number, z: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function noise(x: number, y: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const u = smoothstep(0, 1, x - xi), v = smoothstep(0, 1, y - yi);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** A glyph that follows a direction on screen, for comet tails, meteor streaks and rays. */
function lineGlyph(dx: number, dy: number) {
  const d = Math.hypot(dx, dy) || 1;
  if (Math.abs(dy) < 0.38 * d) return "-";
  if (Math.abs(dx) < 0.38 * d) return "|";
  return dx * dy > 0 ? "\\" : "/";
}

/** The share of one disc covered by another of the same radius r, with centres d apart. */
function overlap(d: number, r: number) {
  if (d >= 2 * r) return 0;
  const q = d / (2 * r);
  return (2 * Math.acos(q) - 2 * q * Math.sqrt(1 - q * q)) / Math.PI;
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: Rgb) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const norm = (v: Vec): Vec => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

interface Star { x: number; y: number; z: number; phase: number; speed: number; glyph: string; tint: 0 | 1 | 2 }
interface Comet { x: number; y: number; vx: number; vy: number; age: number; trail: number[]; dying: number }
interface Flash { x: number; y: number; age: number }
/** The CV on its way down to the receiver; how it travels depends on the scene it started in. */
interface Delivery { scene: Scene; start: number; x: number; y: number; bend: number }
interface Meteor { x: number; y: number; vx: number; vy: number; age: number; life: number }
/** A looping prominence from two feet on the sun's surface out toward where the click landed. */
interface Flare { foot: number; reach: number; age: number; struck: boolean; seed: number }
interface Spark { x: number; y: number; vx: number; vy: number; age: number; life: number; glyph: string }
/** A crater on the moon: centre as a unit vector on the sphere, and angular radius. */
interface Crater { c: Vec; r: number }
/** A sunspot: where it sits on the turning surface, how big, and when it formed and fades. */
interface Spot { lon: number; lat: number; size: number; born: number; life: number }
/** A satellite on a tilted circular orbit, seen as an ellipse: rho is its radius, k the squash, tilt the turn. */
interface Sat { rho: number; theta: number; k: number; tilt: number; w: number; seed: number }
interface Ping { x: number; y: number; age: number }
/** A comet passing the sun by day, along a curve: p0 → p2 bent through p1. */
interface DayComet { start: number; dur: number; p0: [number, number]; p1: [number, number]; p2: [number, number] }
/** An astronaut drifting through the sky, tumbling slowly. waveAt is when it was clicked (-1: not yet). */
interface Astro { x: number; y: number; vx: number; vy: number; rot: number; spin: number; waveAt: number; fled: boolean }
/** Where everything sits during the eclipse at a given moment. s is how much daylight there is, 0 to 1. */
interface EclipseState { mx: number; my: number; lit: number; corona: number; bead: number; beadDir: number; s: number }

export class SkyEngine {
  private ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private time = 0;
  private last = 0;
  private acc = 0;
  private raf = 0;
  private frames = 0;
  private visible = true;
  private disposed = false;
  private palette = DARK;
  private scene: Scene = "night";
  private turn: { from: Scene; to: Scene; start: number; dur: number } | null = null;
  private sceneAlpha = 1;
  /** An extra fade, for drawing a whole scene see-through during the zoom. */
  private fade = 1;
  private flares: Flare[] = [];
  private sparks: Spark[] = [];
  private sunFlash = 0;
  private flared = 0;
  private started = false;
  private family = "monospace";
  private stars: Star[] = [];
  private comets: Comet[] = [];
  private flashes: Flash[] = [];
  private delivery: Delivery | null = null;
  /** The day's heat shimmer round the cursor, eased in and out (0 to 1). */
  private shimmer = 0;
  private meteors: Meteor[] = [];
  private nextMeteor = rand(2, 5);
  private launched = 0;
  private boxes: Box[] = [];
  private pointer = { x: -1e4, y: -1e4, active: false, sx: 0, sy: 0, lens: 0 };
  /** The moon by night and the sun by day share one place and one size, so one can eclipse the other. */
  private hero = { x: 0, y: 0, r: 100, gm: 1, font: 12, cw: 7, ch: 12 };
  /** Where the moon's disc is right now: on the hero, except while it slides during an eclipse. */
  private moonAt = { x: 0, y: 0 };
  private craters: Crater[] = [];
  private spots: Spot[] = [];
  /** How close the cursor is to the moon or sun (eased, 0 to 1), and from which side. */
  private hov = 0;
  private hovAngle = 0;
  /** The sun's surface clock: it runs faster while the cursor is near, so the sun boils up. */
  private boil = 0;
  private sats: Sat[] = [];
  private pings: Ping[] = [];
  private dayComet: DayComet | null = null;
  private nextDayComet = rand(4, 9);
  private astro: Astro | null = null;
  private nextAstro = rand(8, 16);
  private overAstro = false;
  private reported = "";
  private reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  private resizeObserver = new ResizeObserver(() => this.resize());
  private intersectionObserver = new IntersectionObserver(([entry]) => {
    this.visible = entry.isIntersecting;
    this.schedule();
  });
  private themeObserver = new MutationObserver(() => this.readTheme());

  constructor(
    private canvas: HTMLCanvasElement,
    private variant: SkyVariant,
    private onStats: (stats: SkyStats) => void,
  ) {
    this.ctx = canvas.getContext("2d")!;
    // Canvas text can't read CSS variables, so take the resolved family from the page.
    this.family = getComputedStyle(canvas).fontFamily || "monospace";
    this.seedSurfaces();
    this.readTheme();
    this.started = true;
    this.resizeObserver.observe(canvas);
    this.intersectionObserver.observe(canvas);
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    this.reduced.addEventListener("change", this.schedule);
    document.addEventListener("visibilitychange", this.schedule);
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("blur", this.onPointerLeave);
    if (variant === "full") window.addEventListener("click", this.onClick);
    if (variant === "emblem") window.addEventListener(LAUNCH_EVENT, this.onLaunch);
    if (variant === "full") window.addEventListener(DELIVER_EVENT, this.onDeliver);
    this.resize();
    this.schedule();
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    this.themeObserver.disconnect();
    this.reduced.removeEventListener("change", this.schedule);
    document.removeEventListener("visibilitychange", this.schedule);
    window.removeEventListener("pointermove", this.onPointerMove);
    document.documentElement.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("blur", this.onPointerLeave);
    window.removeEventListener("click", this.onClick);
    window.removeEventListener(LAUNCH_EVENT, this.onLaunch);
    window.removeEventListener(DELIVER_EVENT, this.onDeliver);
    if (this.overAstro && this.canvas.parentElement) this.canvas.parentElement.style.cursor = "";
  }

  /** The same craters every visit (seeded), and a few sunspots already on the sun. */
  private seedSurfaces() {
    const big = [
      { lon: -0.55, lat: 0.42, r: 0.26 },
      { lon: 0.38, lat: -0.5, r: 0.2 },
      { lon: 0.62, lat: 0.18, r: 0.15 },
    ];
    const list = [...big];
    for (let i = 0; i < 26; i++) {
      list.push({ lon: (hash(i, 1, 77) - 0.5) * 3.4, lat: (hash(i, 2, 77) - 0.5) * 2.4, r: 0.045 + hash(i, 3, 77) ** 2 * 0.13 });
    }
    this.craters = list.map(({ lon, lat, r }) => ({ c: [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)], r }));
    for (let i = 0; i < SPOTS; i++) this.spots.push(this.makeSpot(-rand(5, 40)));
  }

  private makeSpot(born: number): Spot {
    const north = Math.random() < 0.5 ? -1 : 1;
    return { lon: rand(0, TAU), lat: north * rand(0.12, 0.55), size: rand(0.12, 0.2), born, life: rand(45, 90) };
  }

  private readTheme() {
    const theme = document.documentElement.dataset.theme;
    const next: Scene = theme === "light" ? "day" : theme === "twilight" ? "earth" : "night";
    if (next === this.scene) return;
    // Inner pages fade their colours over instead, so the sky switches at once.
    const sunrise = document.documentElement.classList.contains(SUNRISE_CLASS);
    // The first read just picks the scene; later changes play the eclipse.
    if (this.started && !this.reduced.matches && this.raf && !sunrise) {
      const zoom = this.scene === "earth" || next === "earth";
      this.turn = { from: this.scene, to: next, start: this.time, dur: zoom ? ZOOM_SECONDS : TURN_SECONDS };
      this.scene = next;
      this.syncTextColour();
      // Paint the first frame now, before the browser shows the new page background.
      this.render();
      return;
    }
    this.scene = next;
    this.turn = null;
    // Painted right away, so the stars change with the page.
    if (sunrise || this.reduced.matches || !this.raf) this.render();
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const first = this.w === 1;
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.round(this.w * ratio);
    this.canvas.height = Math.round(this.h * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.layoutHero();
    if (first || this.stars.length === 0) this.seedStars();
    else this.topUpStars();
    this.measure();
    this.render();
  }

  private layoutHero() {
    const { w, h } = this;
    const p = this.hero;
    if (this.variant === "emblem") {
      p.r = Math.min(w * 0.26, h * 0.3);
      p.x = w * 0.5;
      p.y = Math.min(h * 0.42, w * 0.42);
    } else if (w >= 1024) {
      p.r = Math.min(w, h) * 0.25;
      p.x = w * 0.71;
      p.y = h * 0.37;
    } else {
      // Phones and tablets: the whole disc as a figure plate under the folio line, a little right of centre so
      // the quote can run up its left side, with the name overlapping its foot. Sized from the window, not the
      // canvas: here the canvas grows with the page, which this size helps set.
      const vh = window.innerHeight;
      p.r = Math.min(w * 0.34, vh * 0.19);
      p.x = w * 0.58;
      p.y = 116 + p.r;
    }
    // The home page places its CV receiver from these, so it sits just under the disc on any screen.
    if (this.variant === "full") {
      const home = this.canvas.parentElement;
      home?.style.setProperty("--hero-x", `${p.x.toFixed(1)}px`);
      home?.style.setProperty("--hero-y", `${p.y.toFixed(1)}px`);
      home?.style.setProperty("--hero-r", `${p.r.toFixed(1)}px`);
    }
    // Small glyphs, so craters, coastlines and sunspots read as detail rather than noise.
    p.font = clamp(p.r / 20, 6, 11);
    p.cw = p.font * 0.62;
    p.ch = p.font * 1.08;
    this.moonAt = { x: p.x, y: p.y };
    // A comet launched a few moon radii out takes several seconds to go round once, at any screen size.
    const r0 = p.r * 2.6;
    const v0 = (TAU * r0) / 7;
    p.gm = v0 * v0 * r0;
  }

  private makeStar(): Star {
    const z = Math.random() ** 1.6;
    const roll = Math.random();
    const glyph = z > 0.93 && roll < 0.35 ? "✦" : z > 0.82 ? (roll < 0.5 ? "+" : "*") : z > 0.5 ? "·" : ".";
    const tint = roll > 0.92 ? 1 : roll > 0.84 ? 2 : 0;
    return { x: Math.random(), y: Math.random(), z, phase: rand(0, TAU), speed: rand(0.6, 2.4), glyph, tint };
  }

  private targetStars() {
    if (this.variant === "emblem") return Math.round(clamp((this.w * this.h) / 2600, 20, 60));
    const density = this.variant === "full" ? 4200 : 6500;
    return Math.round(clamp((this.w * this.h) / density, 90, 460));
  }

  private seedStars() {
    this.stars = Array.from({ length: this.targetStars() }, () => this.makeStar());
  }

  private topUpStars() {
    const n = this.targetStars();
    while (this.stars.length < n) this.stars.push(this.makeStar());
    this.stars.length = n;
  }

  private measure() {
    const origin = this.canvas.getBoundingClientRect();
    this.boxes = Array.from(document.querySelectorAll(AVOID), (el) => el.getBoundingClientRect())
      .filter((b) => b.width > 0 && b.height > 0)
      .map((b) => ({ left: b.left - origin.left - 14, top: b.top - origin.top - 10, right: b.right - origin.left + 14, bottom: b.bottom - origin.top + 10 }));
  }

  private dim(x: number, y: number) {
    for (const b of this.boxes) if (x > b.left && x < b.right && y > b.top && y < b.bottom) return DIM_UNDER_CONTENT;
    return 1;
  }

  private schedule = () => {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.disposed || !this.visible || document.hidden) return;
    if (this.reduced.matches) {
      this.time = 40;
      this.render();
      this.report();
      return;
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  };

  private frame = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 24) {
      this.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === 24) this.acc = 0;
    if (++this.frames % 30 === 0) this.measure();
    this.render();
    this.report();
    this.raf = requestAnimationFrame(this.frame);
  };

  /** The moon's phase angle (sun–moon–viewer) drifts slowly between nearly full and gibbous. */
  private moonPhase() {
    const a = (this.time * TAU) / PHASE_PERIOD;
    const ph = 0.72 + 0.48 * Math.sin(a);
    return { ph, lit: (1 + Math.cos(ph)) / 2, waxing: Math.cos(a) < 0 };
  }

  private sunSpin() {
    return this.time * SUN_SPIN;
  }

  /** How strongly a spot shows: it grows in, holds, and fades away. */
  private spotStrength(s: Spot) {
    const age = this.time - s.born;
    return smoothstep(0, 5, age) * (1 - smoothstep(s.life - 8, s.life, age));
  }

  private spotCentre(s: Spot): Vec {
    const lon = s.lon + this.sunSpin();
    return [Math.cos(s.lat) * Math.sin(lon), Math.sin(s.lat), Math.cos(s.lat) * Math.cos(lon)];
  }

  private report() {
    const hero = this.variant !== "quiet";
    let detail = "";
    if (hero && this.scene === "earth") {
      detail = "earth · twilight";
    } else if (hero && this.scene === "night") {
      const { lit, waxing } = this.moonPhase();
      detail = lit > 0.97 ? `full moon · ${Math.round(lit * 100)}%` : `${waxing ? "waxing" : "waning"} gibbous · ${Math.round(lit * 100)}%`;
    } else if (hero) {
      const n = this.spots.filter((s) => this.spotStrength(s) > 0.3 && this.spotCentre(s)[2] > 0.1).length;
      detail = `${n} ${n === 1 ? "sunspot" : "sunspots"}`;
    }
    const stats: SkyStats = { scene: this.scene, detail, comets: this.comets.length, flares: this.flares.length, sats: this.sats.length, launched: this.launched, flared: this.flared };
    const key = Object.values(stats).join("/");
    if (key === this.reported) return;
    this.reported = key;
    this.onStats(stats);
  }

  private step(dt: number) {
    this.time += dt;
    if (this.turn && this.time - this.turn.start > this.turn.dur) this.turn = null;
    this.boil += dt * (1 + this.hov * 2.5);
    // Spots form, drift round with the sun, and fade; new ones keep the count up.
    for (let i = this.spots.length - 1; i >= 0; i--) if (this.time - this.spots[i].born > this.spots[i].life) this.spots.splice(i, 1);
    if (this.spots.length < SPOTS && Math.random() < dt / 6) this.spots.push(this.makeSpot(this.time));

    this.sunFlash = Math.max(0, this.sunFlash - dt * 1.4);
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i];
      f.age += dt;
      if (!f.struck && f.age >= FLARE_GROW) this.strike(f);
      if (f.age > FLARE_LIFE) this.flares.splice(i, 1);
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.age += dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vx *= Math.exp(-1.8 * dt);
      sp.vy *= Math.exp(-1.8 * dt);
      if (sp.age > sp.life) this.sparks.splice(i, 1);
    }
    const p = this.pointer;
    // The parallax and the lens ease toward the pointer so the sky never jumps.
    const tx = p.active ? (p.x / this.w - 0.5) : 0;
    const ty = p.active ? (p.y / this.h - 0.5) : 0;
    p.sx += (tx - p.sx) * dt * 2.5;
    p.sy += (ty - p.sy) * dt * 2.5;
    p.lens += ((p.active ? 1 : 0) - p.lens) * dt * 4;
    const hazy = p.active && this.variant === "full" && this.scene === "day" && !this.turn;
    this.shimmer += ((hazy ? 1 : 0) - this.shimmer) * dt * 3;
    const hd = Math.hypot(p.x - this.hero.x, p.y - this.hero.y);
    const near = p.active && this.variant === "full" ? 1 - smoothstep(this.hero.r * 0.9, this.hero.r * 2.2, hd) : 0;
    this.hov += (near - this.hov) * dt * 3;
    if (near > 0) this.hovAngle = Math.atan2(p.y - this.hero.y, p.x - this.hero.x);

    for (const s of this.sats) s.theta += s.w * dt;
    for (let i = this.pings.length - 1; i >= 0; i--) if ((this.pings[i].age += dt) > 1) this.pings.splice(i, 1);
    if (this.scene === "day" && this.variant === "full" && !this.dayComet && (this.nextDayComet -= dt) <= 0) this.spawnDayComet();
    if (this.dayComet && this.time - this.dayComet.start > this.dayComet.dur) {
      this.dayComet = null;
      this.nextDayComet = rand(12, 24);
    }
    this.stepAstro(dt);
    if (this.delivery && this.time - this.delivery.start > DELIVER_SECONDS + DELIVER_AFTERGLOW) this.delivery = null;

    const pl = this.hero;
    for (let i = this.comets.length - 1; i >= 0; i--) {
      const c = this.comets[i];
      c.age += dt;
      if (c.dying > 0) {
        c.dying += dt;
        if (c.trail.length) c.trail.splice(0, 2);
        if (c.dying > 1.2 || !c.trail.length) this.comets.splice(i, 1);
        continue;
      }
      if (this.variant !== "quiet") {
        const dx = pl.x - c.x, dy = pl.y - c.y;
        const r2 = dx * dx + dy * dy + 40;
        const inv = pl.gm / (r2 * Math.sqrt(r2));
        c.vx += dx * inv * dt;
        c.vy += dy * inv * dt;
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.trail.push(c.x, c.y);
      if (c.trail.length > TRAIL * 2) c.trail.splice(0, 2);
      const hit = this.variant !== "quiet" && Math.hypot(c.x - pl.x, c.y - pl.y) < pl.r * 0.96;
      const far = c.x < -this.w || c.x > this.w * 2 || c.y < -this.h || c.y > this.h * 2;
      if (hit) this.flashes.push({ x: c.x, y: c.y, age: 0 });
      if (hit || far || c.age > 30) c.dying = 0.0001;
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) if ((this.flashes[i].age += dt) > 1.1) this.flashes.splice(i, 1);

    if (this.scene === "night" && this.variant !== "emblem") this.nextMeteor -= dt;
    if (this.nextMeteor <= 0) {
      this.nextMeteor = rand(4, 11);
      const leftward = Math.random() < 0.5;
      const angle = rand(0.35, 0.65) * (leftward ? -1 : 1);
      const speed = rand(700, 1100);
      this.meteors.push({
        x: rand(this.w * 0.15, this.w * 0.85),
        y: rand(-20, this.h * 0.35),
        vx: Math.sin(angle) * speed,
        vy: Math.cos(angle) * speed * 0.55,
        age: 0,
        life: rand(0.5, 0.9),
      });
    }
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.age += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.age > m.life) this.meteors.splice(i, 1);
    }
  }

  private glyph(ch: string, x: number, y: number, color: Rgb, alpha: number) {
    // By day, the air near the cursor shimmers like heat haze: glyphs there ripple a little.
    if (this.shimmer > 0.01) {
      const dx = x - this.pointer.x, dy = y - this.pointer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < SHIMMER_R * SHIMMER_R) {
        const f = (1 - Math.sqrt(d2) / SHIMMER_R) * this.shimmer;
        x += Math.sin(y * 0.09 + this.time * 9) * 2.6 * f;
        y += Math.sin(x * 0.07 + this.time * 7) * 1.3 * f;
      }
    }
    const a = alpha * (this.turn ? 1 : this.dim(x, y)) * this.palette.alpha * this.sceneAlpha * this.fade;
    if (a < 0.02) return;
    this.ctx.globalAlpha = a > 1 ? 1 : a;
    this.ctx.fillStyle = css(color);
    this.ctx.fillText(ch, x, y);
  }

  private use(palette: Palette, alpha: number) {
    this.palette = palette;
    this.sceneAlpha = alpha;
  }

  render() {
    const { ctx, w, h } = this;
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const hero = this.variant !== "quiet";
    const full = this.variant === "full";
    this.moonAt = { x: this.hero.x, y: this.hero.y };
    if (this.turn) {
      const k = clamp((this.time - this.turn.start) / this.turn.dur, 0, 1);
      if (this.turn.from === "earth" || this.turn.to === "earth") this.drawZoom(k);
      else this.drawEclipse(k);
    } else if (this.scene === "earth") {
      this.use(DARK, 0.75);
      this.drawStars("earth");
      if (hero) this.drawEarthScene();
    } else if (this.scene === "night") {
      this.use(DARK, 1);
      this.drawStars("night");
      if (full) this.drawPlanets();
      if (hero) {
        this.drawMoonGlow(1);
        this.drawMoon(this.moonAt.x, this.moonAt.y, 1, DARK.orbit);
        this.drawImpacts();
      }
      if (full) this.drawWisps();
      if (full) this.drawAstro();
      this.drawMeteors();
      this.drawComets();
    } else {
      if (full) this.drawDaySky(1);
      this.use(LIGHT, 1);
      this.drawStars("day");
      if (full) this.drawSolarWind();
      if (hero) {
        this.drawSun(null, 1);
        this.drawFlares();
      }
      if (full) this.drawDayComet();
      if (full) this.drawAstro();
    }
    if (full && !this.turn) this.drawDelivery();
    ctx.globalAlpha = 1;
    this.sceneAlpha = 1;
  }

  /**
   * The CV coming down to the receiver under the hero, a different way in each sky: a shooting star falls
   * from the moon, a sunbeam reaches down from the sun, or a satellite swings by and drops a pod. All of
   * them land at DELIVER_SECONDS and burst into sparks on the button.
   */
  private drawDelivery() {
    const d = this.delivery;
    if (!d || d.scene !== this.scene) return;
    const t = this.time - d.start;
    const pal = this.palette;
    const pl = this.hero;
    const { ctx } = this;
    ctx.font = `12px ${this.family}`;
    const dx = d.x - pl.x, dy = d.y - pl.y;
    const dist = Math.hypot(dx, dy) || 1;
    // Leave the disc from the point of its edge facing the receiver.
    const sx = pl.x + (dx / dist) * pl.r * 1.02, sy = pl.y + (dy / dist) * pl.r * 1.02;
    const arrive = DELIVER_SECONDS;

    if (d.scene === "night") {
      // A shooting star on a gentle curve, speeding up as it falls.
      const at = (u: number) => {
        const q = 1 - u, cx = (sx + d.x) / 2 - (dy / dist) * dist * 0.18 * d.bend, cy = (sy + d.y) / 2 + (dx / dist) * dist * 0.18 * d.bend;
        return [q * q * sx + 2 * q * u * cx + u * u * d.x, q * q * sy + 2 * q * u * cy + u * u * d.y];
      };
      if (t < arrive) {
        const u = (t / arrive) ** 1.7;
        const [hx, hy] = at(u);
        for (let i = 1; i <= 14; i++) {
          const [tx, ty] = at(Math.max(0, u - i * 0.025));
          const [px, py] = at(Math.max(0, u - (i - 1) * 0.025));
          this.glyph(lineGlyph(px - tx, py - ty), tx, ty, i < 4 ? pal.comet : pal.star, (1 - i / 15) * 0.85);
        }
        this.glyph("*", hx, hy, pal.comet, 1);
      }
    } else if (d.scene === "day") {
      // A sunbeam grows down to the receiver, glows while it holds, then fades.
      const reach = clamp(t / (arrive * 0.75), 0, 1);
      const grow = 1 - (1 - reach) ** 3;
      const fade = t < arrive ? 1 : 1 - clamp((t - arrive) / DELIVER_AFTERGLOW, 0, 1);
      const len = Math.hypot(d.x - sx, d.y - sy) * grow;
      const g = lineGlyph(d.x - sx, d.y - sy);
      for (let s = 0; s <= len; s += 8) {
        const k = s / Math.max(len, 1);
        const x = sx + ((d.x - sx) / Math.max(Math.hypot(d.x - sx, d.y - sy), 1)) * s;
        const y = sy + ((d.y - sy) / Math.max(Math.hypot(d.x - sx, d.y - sy), 1)) * s;
        const shimmer = 0.75 + 0.25 * Math.sin(this.time * 18 - s * 0.08);
        this.glyph(g, x, y, mix(SUN_CORE, pal.warm, k), fade * shimmer * (0.5 + 0.45 * (1 - k * 0.5)));
      }
    } else {
      // A satellite swings in on an arc, lets go of a pod over the receiver, and carries on.
      const hoverY = d.y - 70;
      const drop = arrive * 0.5;
      const ox = pl.x - pl.r * 1.6, oy = pl.y;
      const satAt = (u: number): [number, number] => {
        const q = 1 - u, cx = (ox + d.x) / 2, cy = Math.min(oy, hoverY) - 60;
        return [q * q * ox + 2 * q * u * cx + u * u * d.x, q * q * oy + 2 * q * u * cy + u * u * hoverY];
      };
      const [satX, satY] = t < drop ? satAt(clamp(t / drop, 0, 1)) : [d.x + (t - drop) * 140, hoverY - (t - drop) * 40];
      const away = t < drop ? 1 : 1 - clamp((t - drop) / 1.2, 0, 1);
      this.glyph("-o-", satX, satY, EARTH_SAT, 0.9 * away);
      if (t >= drop && t < arrive) {
        const u = (t - drop) / (arrive - drop);
        const sway = Math.sin(t * 7) * 3;
        const py = hoverY + (d.y - 10 - hoverY) * u;
        this.glyph("^", d.x + sway, py - 12, EARTH_SAT, 0.85);
        this.glyph("[]", d.x + sway * 0.6, py, EARTH_SAT, 1);
      }
    }

    // Caught: a ring of sparks spreads from the receiver, like a comet striking the moon.
    if (t >= arrive) {
      const k = clamp((t - arrive) / DELIVER_AFTERGLOW, 0, 1);
      const r = 6 + k * 34;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + t;
        this.glyph(i % 2 ? "*" : "+", d.x + Math.cos(a) * r, d.y + Math.sin(a) * r * 0.6, pal.warm, (1 - k) * 0.95);
      }
    }
  }

  /**
   * The eclipse at progress k (0 → 1). Going to night, the moon slides in over the sun (k < 0.5), then lights
   * up as the corona fades. Going to day, the moon goes dark with the corona behind it, then slides off.
   */
  private eclipseAt(k: number): EclipseState {
    const R = this.hero.r;
    const dusk = this.turn?.to !== "day";
    // The moon crosses on a shallow diagonal, left to right, as it does across the real sky.
    const dx = 2.4 * R, dy = 0.55 * R;
    let e = 0, lit: number, corona: number;
    // The slide eases gently (a half sine), so the moon is seen gliding rather than snapping into place.
    const glide = (u: number) => (1 - Math.cos(Math.PI * clamp(u, 0, 1))) / 2;
    if (dusk) {
      e = k < 0.55 ? -(1 - glide(k / 0.55)) : 0;
      lit = smoothstep(0.68, 1, k);
      corona = k < 0.55 ? smoothstep(0.38, 0.55, k) : 1 - smoothstep(0.62, 0.92, k);
    } else {
      e = k < 0.45 ? 0 : glide((k - 0.45) / 0.55);
      lit = 1 - smoothstep(0.02, 0.28, k);
      corona = k < 0.45 ? smoothstep(0.1, 0.4, k) : 1 - smoothstep(0.45, 0.62, k);
    }
    const mx = e * dx, my = e * dy;
    const cover = overlap(Math.hypot(mx, my), R);
    // Daylight follows how much of the sun is still showing.
    const s = (dusk ? k < 0.55 : k >= 0.45) ? (1 - cover) ** 0.8 : 0;
    // The diamond ring: one bead of sunlight at the limb, just before totality going in and just after coming out.
    const bead = dusk ? Math.max(0, 1 - Math.abs(k - 0.53) / 0.05) : Math.max(0, 1 - Math.abs(k - 0.47) / 0.05);
    const dir = Math.atan2(dy, dx);
    return { mx, my, lit, corona, bead, beadDir: dusk ? dir : dir + Math.PI, s };
  }

  private drawEclipse(k: number) {
    const { ctx, w, h } = this;
    const st = this.eclipseAt(k);
    const hero = this.variant !== "quiet";
    this.moonAt = { x: this.hero.x + st.mx, y: this.hero.y + st.my };
    // The canvas paints the page background itself while the light changes.
    if (this.variant !== "emblem") {
      ctx.globalAlpha = 1;
      ctx.fillStyle = css(mix(DARK_BG, LIGHT_BG, st.s));
      ctx.fillRect(0, 0, w, h);
    }
    this.use(LIGHT, st.s);
    this.drawStars("day");
    this.use(DARK, 1 - st.s);
    this.drawStars("night");
    if (!hero) return;
    this.use(DARK, 1);
    this.drawCorona(st.corona);
    // The sun is only ever partly hidden while the moon is off-centre, and fully hidden once it's on.
    if (st.mx || st.my) {
      this.use(LIGHT, 1);
      this.drawSun(this.moonAt, clamp(st.s * 1.4, 0, 1));
      this.drawFlares();
    }
    this.use(DARK, 1);
    this.drawMoonGlow(st.lit);
    this.drawMoon(this.moonAt.x, this.moonAt.y, st.lit, mix(DARK.orbit, LIGHT.orbit, st.s));
    this.drawBead(st.bead, st.beadDir);
    this.use(DARK, 1 - st.s);
    this.drawComets();
  }

  /**
   * Page text has one colour, so it can't fade with the sky. It switches at the moment the daylight crosses
   * halfway. This runs inside the theme change, before styles recalculate, so the CSS transition picks it up.
   */
  private syncTextColour() {
    if (this.turn && (this.turn.from === "earth" || this.turn.to === "earth")) {
      document.documentElement.style.setProperty("--text-turn-delay", `${(this.turn.dur * 0.42).toFixed(3)}s`);
      return;
    }
    const dusk = this.turn?.to !== "day";
    let k = 0.5;
    for (let i = 0; i <= 200; i++) {
      const s = this.eclipseAt(i / 200).s;
      if (dusk ? s < 0.5 : s > 0.5) { k = i / 200; break; }
    }
    document.documentElement.style.setProperty("--text-turn-delay", `${Math.max(0, k * TURN_SECONDS - 0.15).toFixed(3)}s`);
  }

  private drawStars(scene: Scene) {
    const { ctx, palette: pal, pointer: p, time: t } = this;
    if (this.sceneAlpha < 0.02) return;
    const quiet = this.variant === "quiet";
    const day = scene === "day";
    const lensR = Math.min(170, Math.max(110, this.w * 0.11));
    const einstein = lensR * 0.32;
    const hero = this.hero;
    let font = "";
    for (const s of this.stars) {
      let x: number, y: number;
      if (day) {
        // By day the same points are dust motes: they rise slowly and sway, rather than streaming past.
        x = ((s.x * this.w + t * (3 + s.z * 6) + Math.sin(t * 0.3 * s.speed + s.phase) * 14) % (this.w + 20)) - 10 - p.sx * s.z * 20;
        y = (((s.y * this.h - t * (2 + s.z * 5)) % this.h) + this.h) % this.h - p.sy * s.z * 14;
      } else {
        // Distant stars barely move; close ones drift and follow the pointer more.
        x = ((s.x * this.w + t * (2 + s.z * 7)) % (this.w + 20)) - 10 - p.sx * s.z * 26;
        y = s.y * this.h - p.sy * s.z * 18;
      }
      let boost = 0;
      if (p.lens > 0.01 && !day && !this.turn && this.variant === "full") {
        const dx = x - p.x, dy = y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < lensR) {
          // Light from behind the lens is pushed out toward a ring, as around a black hole.
          const fall = (1 - smoothstep(lensR * 0.55, lensR, d)) * p.lens;
          const push = ((einstein * einstein) / Math.max(d, 6)) * fall;
          x += (dx / (d || 1)) * push;
          y += (dy / (d || 1)) * push;
          boost = fall * (1 - Math.min(1, Math.abs(d + push - einstein * 1.6) / einstein)) * 0.8;
        }
      }
      if (!quiet && !this.turn) {
        // Nothing shows through the moon or Earth, or in front of the sun.
        const cx = day ? hero.x : this.moonAt.x, cy = day ? hero.y : this.moonAt.y;
        if (Math.hypot(x - cx, y - cy) < hero.r * (day ? 1.15 : scene === "earth" ? 0.95 : 1)) continue;
      } else if (!quiet && !day && Math.hypot(x - this.moonAt.x, y - this.moonAt.y) < hero.r && this.turn && this.turn.to !== "earth" && this.turn.from !== "earth") continue;
      if (day && s.z < 0.4) continue;
      const twinkle = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
      // A mote catches the light now and then.
      const glint = day && twinkle > 0.985 && s.z > 0.7;
      const g = day ? (glint ? "+" : s.z > 0.75 ? "·" : ".") : s.glyph;
      const size = g === "✦" ? 13 : g === "." ? 10 : 11;
      const f = `${size}px ${this.family}`;
      if (f !== font) { ctx.font = f; font = f; }
      const color = day ? (s.tint === 2 ? pal.cool : pal.orbit) : s.tint === 1 ? pal.warm : s.tint === 2 ? pal.cool : pal.star;
      const base = (0.18 + s.z * 0.62) * (quiet ? 0.55 : 1) * (day ? 0.6 : 1);
      this.glyph(g, x, y, glint ? pal.warm : color, base * twinkle + boost + (glint ? 0.4 : 0));
    }
  }

  /** Layered moonlight: scattered dots that thin out with distance, cool at the edge of the glow. */
  private drawMoonGlow(lit: number) {
    if (lit < 0.02) return;
    const pl = this.hero;
    const { cw, ch, r } = pl;
    const cx = this.moonAt.x, cy = this.moonAt.y;
    const reach = r * (1.55 + this.hov * 0.15);
    this.ctx.font = `${pl.font}px ${this.family}`;
    const x0 = Math.floor((cx - reach) / cw) * cw, y0 = Math.floor((cy - reach) / ch) * ch;
    for (let y = y0; y <= cy + reach; y += ch) {
      for (let x = x0; x <= cx + reach; x += cw) {
        const gx = x + cw / 2, gy = y + ch / 2;
        const d = Math.hypot(gx - cx, gy - cy) / r;
        if (d < 1.02 || d > reach / r) continue;
        const ix = Math.round(x / cw), iy = Math.round(y / ch);
        const fall = Math.exp(-(d - 1) * 4.2);
        if (hash(ix, iy, 9) > 0.25 + fall * 0.5) continue;
        const tw = 0.65 + 0.35 * Math.sin(this.time * 0.9 + hash(ix, iy, 10) * TAU);
        const g = fall > 0.6 ? ":" : fall > 0.3 ? "·" : ".";
        this.glyph(g, gx, gy, mix(this.palette.bright, this.palette.cool, clamp((d - 1) * 1.6, 0, 1)), 0.3 * fall * tw * lit * (1 + this.hov * 0.4));
      }
    }
  }

  /**
   * The moon: sunlit from the upper left by its current phase, with dark maria from noise and craters whose
   * walls catch or lose the light. The unlit part keeps a faint earthshine silhouette, so it still hides what's
   * behind it. lit runs 0 → 1 to darken it into a silhouette during an eclipse.
   */
  private drawMoon(cx: number, cy: number, lit: number, shadow: Rgb) {
    const pl = this.hero;
    const pal = this.palette;
    const { cw, ch, r } = pl;
    const { ph } = this.moonPhase();
    const base: Vec = norm([-Math.sin(ph), -0.3 * Math.sin(ph), Math.cos(ph)]);
    // Bring the cursor near and the moon turns its lit side toward it.
    const toward: Vec = norm([Math.cos(this.hovAngle) * 0.85, Math.sin(this.hovAngle) * 0.85, 0.5]);
    const hv = this.hov * 0.85;
    const L = norm([base[0] + (toward[0] - base[0]) * hv, base[1] + (toward[1] - base[1]) * hv, base[2] + (toward[2] - base[2]) * hv]);
    // Libration: the moon rocks a little, side to side and up and down, so its face slowly shifts.
    const lx = 0.3 * Math.sin((this.time * TAU) / 110), ly = 0.1 * Math.sin((this.time * TAU) / 170);
    const cx1 = Math.cos(lx), sx1 = Math.sin(lx), cy1 = Math.cos(ly), sy1 = Math.sin(ly);
    const toSurface = (x: number, y: number, z: number): Vec => {
      const px = x * cx1 + z * sx1, pz0 = -x * sx1 + z * cx1;
      return [px, y * cy1 - pz0 * sy1, y * sy1 + pz0 * cy1];
    };
    const Ls = toSurface(L[0], L[1], L[2]);
    this.ctx.font = `${pl.font}px ${this.family}`;
    // Snap to a global grid so the moon reads as terminal text, not floating glyphs.
    const x0 = Math.floor((cx - r) / cw) * cw, y0 = Math.floor((cy - r) / ch) * ch;
    for (let y = y0; y <= cy + r + ch; y += ch) {
      for (let x = x0; x <= cx + r + cw; x += cw) {
        const gx = x + cw / 2, gy = y + ch / 2;
        const nx = (gx - cx) / r, ny = (gy - cy) / r;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        const rim = smoothstep(0, 0.35, nz);
        const lam = nx * L[0] + ny * L[1] + nz * L[2];
        const light = smoothstep(-0.03, 0.22, lam) * lit;
        if (light < 0.06) {
          this.glyph((Math.round(x / cw) + Math.round(y / ch)) % 2 ? "." : ":", gx, gy, shadow, 0.2 * rim + 0.06);
          continue;
        }
        const [px, py, pz] = toSurface(nx, ny, nz);
        // Maria: a few large dark seas with fairly crisp shores, over bright, slightly mottled highlands.
        const mare = smoothstep(0.44, 0.56, noise(px * 1.5 + 3, py * 1.5 + pz * 0.8, 21) * 0.7 + noise(px * 3.2 + pz * 1.5, py * 3.2, 22) * 0.3);
        const alb = 0.95 - mare * 0.5 + (noise(px * 8 + pz * 4, py * 8, 23) - 0.5) * 0.08;
        // Craters: the wall facing away from the sun is in shadow, the far wall and the outer rim catch light.
        let shade = 0;
        const lt0 = Ls[0] - px * (Ls[0] * px + Ls[1] * py + Ls[2] * pz);
        const lt1 = Ls[1] - py * (Ls[0] * px + Ls[1] * py + Ls[2] * pz);
        const lt2 = Ls[2] - pz * (Ls[0] * px + Ls[1] * py + Ls[2] * pz);
        const ltl = Math.hypot(lt0, lt1, lt2) || 1;
        for (const cr of this.craters) {
          const dot = px * cr.c[0] + py * cr.c[1] + pz * cr.c[2];
          if (dot < Math.cos(cr.r * 1.4)) continue;
          const d = Math.acos(Math.min(1, dot));
          const v0 = px - cr.c[0] * dot, v1 = py - cr.c[1] * dot, v2 = pz - cr.c[2] * dot;
          const vl = Math.hypot(v0, v1, v2) || 1;
          const toward = (v0 * lt0 + v1 * lt1 + v2 * lt2) / (vl * ltl);
          if (d < cr.r) shade += -toward * (d / cr.r) * 0.75 - 0.05;
          else shade += toward * (1 - (d - cr.r) / (cr.r * 0.4)) * 0.4;
        }
        // Shadows are longest near the terminator, where the sun is low.
        // A full moon looks almost flat, so the light falls off gently, not like a ball.
        const low = 1.3 - clamp(lam, 0, 1);
        const b = clamp(light * (alb * (0.48 + 0.32 * Math.sqrt(clamp(lam, 0, 1))) + shade * low), 0, 1);
        if (b < 0.07) {
          this.glyph(".", gx, gy, shadow, 0.22 * rim + 0.08);
          continue;
        }
        const g = RAMP[clamp(Math.round(b * (RAMP.length - 1)), 1, RAMP.length - 1)];
        // Blue-grey in the seas and along the terminator, silver on the highlands, warm where it's brightest.
        let col = mix(pal.deep, pal.bright, clamp(alb * 1.1 - 0.1, 0, 1));
        col = mix(col, MOON_DUSK, (1 - smoothstep(0, 0.4, lam)) * 0.55);
        col = mix(col, pal.comet, smoothstep(0.78, 1, b) * 0.55);
        this.glyph(g, gx, gy, col, 0.3 + 0.7 * b);
      }
    }
  }

  /** Where a comet hit the moon: a ring of sparks that spreads and fades. */
  private drawImpacts() {
    const pal = this.palette;
    const pl = this.hero;
    this.ctx.font = `${pl.font}px ${this.family}`;
    for (const f of this.flashes) {
      const k = f.age / 1.1;
      const r = 6 + k * pl.r * 0.4;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + f.age;
        this.glyph(i % 2 ? "*" : "+", f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.8, pal.warm, (1 - k) * 0.95);
      }
      this.glyph("@", f.x, f.y, pal.comet, (1 - k) * (1 - k));
    }
  }

  private drawMeteors() {
    const pal = this.palette;
    this.ctx.font = `12px ${this.family}`;
    for (const m of this.meteors) {
      const life = 1 - m.age / m.life;
      const g = lineGlyph(m.vx, m.vy);
      const sp = Math.hypot(m.vx, m.vy);
      for (let i = 0; i < 14; i++) {
        const back = i * 9;
        const x = m.x - (m.vx / sp) * back, y = m.y - (m.vy / sp) * back;
        this.glyph(i === 0 ? "*" : g, x, y, i < 3 ? pal.comet : pal.star, life * (1 - i / 14) * 0.9);
      }
    }
  }

  private drawComets() {
    if (this.sceneAlpha < 0.02) return;
    const pal = this.palette;
    this.ctx.font = `12px ${this.family}`;
    for (const c of this.comets) {
      const tr = c.trail;
      const n = tr.length / 2;
      const fade = c.dying > 0 ? 1 - c.dying / 1.2 : 1;
      // Every few points is enough for a tail that reads as a line of glyphs.
      for (let i = n - 1; i >= 1; i -= 4) {
        const x = tr[i * 2], y = tr[i * 2 + 1];
        const px = tr[(i - 1) * 2], py = tr[(i - 1) * 2 + 1];
        const k = i / n;
        const color = mix(pal.cool, pal.comet, k * k);
        this.glyph(k > 0.9 ? "o" : lineGlyph(x - px, y - py), x, y, color, k * 0.9 * fade);
      }
      if (c.dying === 0) this.glyph("@", c.x, c.y, pal.comet, 1);
    }
  }

  /**
   * The sun: a boiling, limb-darkened surface with sunspots that turn with it, and a corona of flickering rays.
   * occ is the moon's disc during an eclipse; anything behind it is left out. rays scales the corona.
   */
  private drawSun(occ: { x: number; y: number } | null, rays: number) {
    const pal = this.palette;
    const pl = this.hero;
    const t = this.time;
    const flash = this.sunFlash;
    const foot = this.flares.length ? this.flares[this.flares.length - 1].foot : 0;
    const { cw, ch, r } = pl;
    const hidden = (x: number, y: number) => occ !== null && Math.hypot(x - occ.x, y - occ.y) < r;
    const spin = this.sunSpin();
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const spots = this.spots.map((s) => ({ c: this.spotCentre(s), size: s.size, k: this.spotStrength(s) })).filter((s) => s.k > 0.02 && s.c[2] > -0.2);
    // By day the sun is drawn bolder: a soft warm body under the glyphs (gold core, vermilion limb), stronger
    // glyphs, longer rays. Kept light so the glyphs stay the texture. The eclipse keeps its original look.
    const bold = !this.turn;
    if (bold) {
      const ctx = this.ctx;
      const body = ctx.createRadialGradient(pl.x - r * 0.25, pl.y - r * 0.25, r * 0.1, pl.x, pl.y, r);
      body.addColorStop(0, "rgba(252, 204, 96, 0.34)");
      body.addColorStop(0.6, "rgba(240, 146, 58, 0.24)");
      body.addColorStop(1, "rgba(206, 78, 40, 0.18)");
      ctx.globalAlpha = this.sceneAlpha * this.fade;
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, r, 0, TAU);
      ctx.fill();
    }
    this.ctx.font = `${pl.font}px ${this.family}`;
    const x0 = Math.floor((pl.x - r) / cw) * cw, y0 = Math.floor((pl.y - r) / ch) * ch;
    for (let y = y0; y <= pl.y + r + ch; y += ch) {
      for (let x = x0; x <= pl.x + r + cw; x += cw) {
        const gx = x + cw / 2, gy = y + ch / 2;
        const nx = (gx - pl.x) / r, ny = (gy - pl.y) / r;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1 || hidden(gx, gy)) continue;
        const nz = Math.sqrt(1 - d2);
        let spot = 0, umbra = 0;
        for (const s of spots) {
          const d = Math.acos(clamp(nx * s.c[0] + ny * s.c[1] + nz * s.c[2], -1, 1));
          spot = Math.max(spot, s.k * (1 - smoothstep(s.size * 0.6, s.size, d)));
          umbra = Math.max(umbra, s.k * (1 - smoothstep(s.size * 0.25, s.size * 0.5, d)));
        }
        if (spot > 0.15) {
          this.glyph(umbra > 0.5 ? "@" : spot > 0.6 ? "%" : "#", gx, gy, mix(pal.warm, pal.deep, 0.35 + 0.65 * Math.max(umbra, spot * 0.6)), 0.95);
          continue;
        }
        // Granules on the turning surface boil as they go; the disc darkens toward its edge.
        const sx = nx * cs + nz * sn, sz = -nx * sn + nz * cs;
        const bt = this.boil;
        const gran = noise(sx * 8 + bt * 0.35, ny * 8 + sz * 3 - bt * 0.25, 5) * 0.6 + noise(sx * 18 - bt * 0.5, ny * 18 + sz * 5, 6) * 0.4;
        const toward = Math.max(0, Math.cos(Math.atan2(ny, nx) - foot)) * Math.sqrt(d2);
        const b = clamp(0.12 + 0.62 * Math.sqrt(nz) + (gran - 0.5) * 0.45 + flash * (0.12 + toward * 0.45), 0, 1);
        const g = RAMP[clamp(Math.round(b * (RAMP.length - 1)), 1, RAMP.length - 1)];
        // Gold at the core, orange through the disc, deep red at the limb; bright granules lean gold.
        const depth = Math.sqrt(nz);
        let col = mix(SUN_LIMB, SUN_MID, smoothstep(0, 0.55, depth));
        col = mix(col, SUN_CORE, smoothstep(0.55, 1, depth) * 0.5 + clamp(gran - 0.6, 0, 1) * 0.5);
        this.glyph(g, gx, gy, col, bold ? 0.55 + 0.45 * b : 0.35 + 0.55 * b);
      }
    }
    if (rays < 0.02) return;
    this.drawSunGlow(occ, rays);
    // A dotted rim, then rays that flicker in and out of length and stretch while the sun flares.
    const rimN = Math.round((TAU * r * 1.08) / (cw * 1.3));
    for (let i = 0; i < rimN; i++) {
      const a = (i / rimN) * TAU;
      const x = pl.x + Math.cos(a) * r * 1.08, y = pl.y + Math.sin(a) * r * 1.08;
      if (!hidden(x, y)) this.glyph("·", x, y, pal.warm, 0.5 * rays);
    }
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + t * 0.03;
      const long = i % 2 === 0;
      // Rays stretch toward a nearby cursor.
      const reachOut = 1 + this.hov * 0.9 * Math.max(0, Math.cos(a - this.hovAngle)) ** 4;
      const len = r * (long ? (bold ? 0.55 : 0.42) : bold ? 0.28 : 0.22) * (0.6 + 0.4 * noise(i * 1.7, this.boil * 0.9, 8)) * (1 + flash * 0.7) * reachOut;
      const g = lineGlyph(Math.cos(a), Math.sin(a));
      for (let q = r * 1.18; q < r * 1.18 + len; q += cw * 1.25) {
        const k = (q - r * 1.18) / len;
        const x = pl.x + Math.cos(a) * q, y = pl.y + Math.sin(a) * q;
        // Rays run gold near the sun into the warm red of the ink further out.
        if (!hidden(x, y)) this.glyph(g, x, y, bold ? mix(SUN_CORE, pal.warm, k) : pal.warm, (1 - k) * (bold ? 0.95 : 0.75) * rays);
      }
    }
  }

  /** The corona at totality: pale streamers all round the hidden sun. */
  private drawCorona(strength: number) {
    if (strength < 0.02) return;
    const pl = this.hero;
    const t = this.time;
    this.ctx.font = `${pl.font}px ${this.family}`;
    const n = 64;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const len = pl.r * (0.25 + 0.95 * noise(a * 2.2, t * 0.4, 31) ** 2);
      const g = lineGlyph(Math.cos(a), Math.sin(a));
      for (let q = pl.r * 1.04; q < pl.r * 1.04 + len; q += pl.cw * 1.2) {
        const k = (q - pl.r * 1.04) / len;
        this.glyph(k < 0.15 ? "*" : k < 0.5 ? g : "·", pl.x + Math.cos(a) * q, pl.y + Math.sin(a) * q, mix(DARK.comet, DARK.warm, k), (1 - k) * 0.85 * strength);
      }
    }
  }

  /** The last (or first) bead of sunlight at the moon's edge: the diamond ring. */
  private drawBead(strength: number, dir: number) {
    if (strength < 0.02) return;
    const pl = this.hero;
    const x = pl.x + Math.cos(dir) * pl.r * 1.02, y = pl.y + Math.sin(dir) * pl.r * 1.02;
    this.ctx.font = `${Math.round(pl.font * 2.4)}px ${this.family}`;
    this.glyph("✦", x, y, DARK.comet, strength);
    this.ctx.font = `${pl.font}px ${this.family}`;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      for (let j = 1; j <= 4; j++) {
        const q = j * pl.cw * 1.6 * (i % 2 ? 0.7 : 1);
        this.glyph(lineGlyph(Math.cos(a), Math.sin(a)), x + Math.cos(a) * q, y + Math.sin(a) * q, DARK.comet, strength * (1 - j / 5));
      }
    }
  }

  /**
   * Day on the home page is a golden afternoon: a pale warm-blue sky high up melting into the paper, and a
   * golden glow round the sun. Soft washes only, so the ink text on top keeps its contrast.
   */
  private drawDaySky(alpha: number) {
    if (alpha < 0.02) return;
    const { ctx, w, h } = this;
    const pl = this.hero;
    ctx.globalAlpha = alpha;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "rgba(206, 222, 232, 0.55)");
    sky.addColorStop(0.55, "rgba(206, 222, 232, 0)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(pl.x, pl.y, pl.r * 0.6, pl.x, pl.y, pl.r * 3.4);
    glow.addColorStop(0, "rgba(248, 196, 104, 0.42)");
    glow.addColorStop(0.35, "rgba(246, 186, 96, 0.16)");
    glow.addColorStop(1, "rgba(246, 186, 96, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  /** The sun's glow: scattered warm dots that thin with distance and shimmer like heat haze. */
  private drawSunGlow(occ: { x: number; y: number } | null, rays: number) {
    const pl = this.hero;
    const { cw, ch, r } = pl;
    const reach = r * 1.75;
    const x0 = Math.floor((pl.x - reach) / cw) * cw, y0 = Math.floor((pl.y - reach) / ch) * ch;
    for (let y = y0; y <= pl.y + reach; y += ch) {
      for (let x = x0; x <= pl.x + reach; x += cw) {
        const ix = Math.round(x / cw), iy = Math.round(y / ch);
        const shimmer = Math.sin(this.boil * 2.6 + iy * 0.9 + hash(ix, iy, 13) * 3) * cw * 0.35;
        const gx = x + cw / 2 + shimmer, gy = y + ch / 2;
        const d = Math.hypot(gx - pl.x, gy - pl.y) / r;
        if (d < 1.03 || d > reach / r) continue;
        if (occ && Math.hypot(gx - occ.x, gy - occ.y) < r) continue;
        const fall = Math.exp(-(d - 1) * 3.4);
        if (hash(ix, iy, 12) > 0.2 + fall * 0.55) continue;
        const g = fall > 0.6 ? ":" : fall > 0.3 ? "·" : ".";
        this.glyph(g, gx, gy, mix(SUN_MID, SUN_CORE, fall), (this.turn ? 0.34 : 0.5) * fall * rays * (1 + this.hov * 0.5));
      }
    }
  }

  /** Night: thin bands of cloud drift across in front of the moon, lit where they pass over it. */
  private drawWisps() {
    const pl = this.hero;
    const { cw, ch, r } = pl;
    const t = this.time;
    this.ctx.font = `${pl.font}px ${this.family}`;
    for (let j = 0; j < 3; j++) {
      const yc = pl.y + (j - 1) * r * 0.62 + r * 0.12 + Math.sin(t * 0.05 + j * 2) * r * 0.08;
      const speed = 5 + j * 3;
      const x0 = Math.floor((pl.x - r * 2.1) / cw) * cw;
      for (let row = -1; row <= 1; row++) {
        const y = Math.round((yc + row * ch) / ch) * ch + ch / 2;
        for (let x = x0; x <= pl.x + r * 2.1; x += cw) {
          const dens = noise((x + t * speed) / (r * 0.42), j * 5.3 + row * 0.6, 51 + j) - Math.abs(row) * 0.16;
          if (dens < 0.55) continue;
          const span = 1 - Math.abs(x - pl.x) / (r * 2.1);
          const over = Math.hypot(x - this.moonAt.x, y - this.moonAt.y) < r ? 1.5 : 0.65;
          const g = dens > 0.74 && row === 0 ? "~" : dens > 0.63 ? "-" : ".";
          this.glyph(g, x + cw / 2, y, mix(this.palette.bright, this.palette.cool, 0.3), ((dens - 0.55) / 0.45) * span * over * 0.55);
        }
      }
    }
  }

  /** Night: two distant planets drift slowly across the sky, a ringed one high up and a small red one low down. */
  private drawPlanets() {
    const { w, h, time: t } = this;
    const list = [
      { x: (((0.08 + t / 260) % 1.16) - 0.08) * w, y: (0.15 + 0.03 * Math.sin(t / 50)) * h, ringed: true },
      { x: (1.08 - ((0.4 + t / 320) % 1.16)) * w, y: (0.86 + 0.02 * Math.sin(t / 40 + 1)) * h, ringed: false },
    ];
    for (const p of list) {
      if (Math.hypot(p.x - this.moonAt.x, p.y - this.moonAt.y) < this.hero.r * 1.1) continue;
      if (p.ringed) {
        this.ctx.font = `11px ${this.family}`;
        this.glyph("●", p.x, p.y, [214, 190, 150], 0.7);
        this.ctx.font = `10px ${this.family}`;
        this.glyph("-", p.x - 9, p.y + 1.5, [196, 206, 222], 0.6);
        this.glyph("-", p.x + 9, p.y - 1.5, [196, 206, 222], 0.6);
      } else {
        this.ctx.font = `8px ${this.family}`;
        this.glyph("●", p.x, p.y, [218, 112, 84], 0.65);
      }
    }
  }

  /** Day: the solar wind, particles streaming out from the sun and curling as it turns. */
  private drawSolarWind() {
    const pl = this.hero;
    const t = this.time;
    this.ctx.font = `${pl.font}px ${this.family}`;
    for (let i = 0; i < 90; i++) {
      const a0 = hash(i, 1, 61) * TAU;
      const ph = (t * (0.035 + hash(i, 2, 61) * 0.05) + hash(i, 3, 61)) % 1;
      const rad = pl.r * (1.25 + ph * 2.6);
      const ang = a0 + ph * 0.75;
      const x = pl.x + Math.cos(ang) * rad, y = pl.y + Math.sin(ang) * rad;
      const g = i % 3 === 0 ? lineGlyph(Math.cos(ang + 0.3), Math.sin(ang + 0.3)) : i % 3 === 1 ? "·" : ".";
      this.glyph(g, x, y, mix(SUN_MID, this.palette.orbit, ph), 0.42 * Math.sin(Math.PI * ph) ** 1.2);
    }
  }

  /** Day: now and then a comet swings past the sun, its tail always pointing away from it. */
  private spawnDayComet() {
    const pl = this.hero;
    const D = Math.max(this.w, this.h) * 0.95;
    const a = rand(0, TAU);
    const bend = Math.random() < 0.5 ? -1 : 1;
    const a2 = a + bend * (Math.PI - 0.8);
    const mid = a + (bend * (Math.PI - 0.8)) / 2;
    const p0: [number, number] = [pl.x + Math.cos(a) * D, pl.y + Math.sin(a) * D];
    const p2: [number, number] = [pl.x + Math.cos(a2) * D, pl.y + Math.sin(a2) * D];
    const c: [number, number] = [pl.x + Math.cos(mid) * pl.r * 1.9, pl.y + Math.sin(mid) * pl.r * 1.9];
    // Bend the curve so its midpoint passes close by the sun.
    const p1: [number, number] = [2 * c[0] - (p0[0] + p2[0]) / 2, 2 * c[1] - (p0[1] + p2[1]) / 2];
    this.dayComet = { start: this.time, dur: 9, p0, p1, p2 };
  }

  private drawDayComet() {
    const c = this.dayComet;
    if (!c) return;
    const pl = this.hero;
    const pal = this.palette;
    const at = (u: number) => {
      // Fastest at closest approach, as Kepler would have it.
      const v = clamp(u - 0.1 * Math.sin(TAU * u), 0, 1), q = 1 - v;
      return [q * q * c.p0[0] + 2 * q * v * c.p1[0] + v * v * c.p2[0], q * q * c.p0[1] + 2 * q * v * c.p1[1] + v * v * c.p2[1]];
    };
    const u = (this.time - c.start) / c.dur;
    const [x, y] = at(u);
    const dx = x - pl.x, dy = y - pl.y;
    const dist = Math.hypot(dx, dy) || 1;
    const heat = 1 - smoothstep(pl.r * 1.6, pl.r * 5, dist);
    this.ctx.font = `12px ${this.family}`;
    // The dust tail trails along the path; the ion tail points straight away from the sun and grows near it.
    for (let j = 1; j <= 10; j++) {
      const [tx, ty] = at(u - j * 0.007);
      this.glyph(".", tx, ty, pal.warm, (1 - j / 11) * 0.5);
    }
    const len = 14 + Math.round(heat * 16);
    const g = lineGlyph(dx, dy);
    for (let j = 1; j <= len; j++) {
      this.glyph(g, x + (dx / dist) * j * 7, y + (dy / dist) * j * 7, mix(pal.cool, pal.orbit, j / len), (1 - j / (len + 1)) * (0.45 + heat * 0.4));
    }
    this.glyph("@", x, y, pal.star, 0.9);
  }

  /**
   * Now and then an astronaut drifts across the open sky below the moon, on wide screens only (phones have no
   * open sky to spare). It never crosses the moon or sun, and it waves when clicked, then spins off.
   */
  private spawnAstro() {
    const { w, h } = this;
    const pl = this.hero;
    for (let tries = 0; tries < 6; tries++) {
      let a: [number, number] = [-60, rand(0.42, 0.5) * h];
      let b: [number, number] = [w + 60, rand(0.74, 0.84) * h];
      if (Math.random() < 0.5) [a, b] = [b, a];
      // Closest approach of the path to the hero's centre.
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const u = clamp(((pl.x - a[0]) * dx + (pl.y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
      if (Math.hypot(a[0] + dx * u - pl.x, a[1] + dy * u - pl.y) < pl.r * 1.25) continue;
      const dur = rand(30, 38);
      const turn = Math.random() < 0.5 ? -1 : 1;
      this.astro = { x: a[0], y: a[1], vx: dx / dur, vy: dy / dur, rot: rand(-0.3, 0.3), spin: rand(0.06, 0.14) * turn, waveAt: -1, fled: false };
      return;
    }
    this.nextAstro = rand(10, 20);
  }

  private stepAstro(dt: number) {
    if (this.variant !== "full") return;
    if (!this.astro && !this.turn && this.scene !== "earth" && this.w >= 1024 && (this.nextAstro -= dt) <= 0) this.spawnAstro();
    const a = this.astro;
    if (a) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.spin * dt;
      // After waving it kicks off, tumbling, the way it was going.
      if (a.waveAt >= 0 && !a.fled && this.time - a.waveAt > 1.6) {
        a.fled = true;
        a.vx *= 20;
        a.vy *= 20;
        a.spin = Math.sign(a.spin || 1) * 2.4;
      }
      const gone = (a.x < -80 && a.vx < 0) || (a.x > this.w + 80 && a.vx > 0) || (a.y < -80 && a.vy < 0) || (a.y > this.h + 80 && a.vy > 0);
      if (gone) {
        this.astro = null;
        this.nextAstro = rand(25, 45);
      }
    }
    // The pointer becomes a hand over the astronaut, even when it drifts under a still cursor.
    const over = this.pointer.active && this.astroHit(this.pointer.x, this.pointer.y);
    if (over !== this.overAstro) {
      this.overAstro = over;
      if (this.canvas.parentElement) this.canvas.parentElement.style.cursor = over ? "pointer" : "";
    }
  }

  private astroHit(x: number, y: number) {
    const a = this.astro;
    return !!a && !a.fled && !this.turn && this.scene !== "earth" && Math.abs(x - a.x) < 24 && Math.abs(y - a.y) < 30;
  }

  private drawAstro() {
    const a = this.astro;
    if (!a) return;
    const { ctx } = this;
    const pal = this.palette;
    const k = this.dim(a.x, a.y) * pal.alpha * this.sceneAlpha * this.fade;
    if (k < 0.02) return;
    const waving = a.waveAt >= 0 && this.time - a.waveAt < 1.6;
    const arm = waving && Math.floor((this.time - a.waveAt) * 6) % 2 ? "-" : "/";
    const rows = ["  _  ", ` (o)${arm}`, " /|  ", " / \\ "];
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    ctx.font = `12px ${this.family}`;
    ctx.globalAlpha = Math.min(1, 0.85 * k);
    rows.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch === " ") return;
        ctx.fillStyle = css(ch === "o" ? pal.warm : pal.star);
        ctx.fillText(ch, (c - 2) * 7, (r - 1.5) * 12);
      });
    });
    ctx.restore();
    if (waving) this.glyph("hi!", a.x, a.y - 40, pal.warm, 0.9);
  }

  /** Earth with everything round it: the moon on its orbit, satellites, and the pings where they were placed. */
  private drawEarthScene() {
    const pl = this.hero;
    const er = pl.r * 0.9;
    const ma = (this.time * TAU) / 45;
    const mt = -0.25, mk = 0.3;
    const mlx = Math.cos(ma) * er * 2.45, mly = Math.sin(ma) * er * 2.45 * mk;
    const mx = pl.x + mlx * Math.cos(mt) - mly * Math.sin(mt), my = pl.y + mlx * Math.sin(mt) + mly * Math.cos(mt);
    const moonFront = Math.sin(ma) > 0;
    this.use(DARK, 1);
    this.drawSats(false);
    if (!moonFront && Math.hypot(mx - pl.x, my - pl.y) > er) this.drawMiniMoon(mx, my, er * 0.17);
    this.drawEarth(er);
    this.drawSats(true);
    if (moonFront) this.drawMiniMoon(mx, my, er * 0.17);
    this.drawPings();
  }

  /**
   * Earth, turning once a minute on its tilted axis. Coastlines come from the land bitmap; oceans are drawn
   * in ~, land in dense glyphs, clouds drift over both, and the night side shows only city lights.
   */
  private drawEarth(er: number) {
    const pl = this.hero;
    const { cw, ch } = pl;
    const cx = pl.x, cy = pl.y;
    const t = this.time;
    const spin = (t * TAU) / 70;
    const tilt = 0.41;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const L = norm([-0.78, -0.3, 0.55]);
    const lxy = Math.hypot(L[0], L[1]);
    this.ctx.font = `${pl.font}px ${this.family}`;
    const reach = er * 1.16;
    const x0 = Math.floor((cx - reach) / cw) * cw, y0 = Math.floor((cy - reach) / ch) * ch;
    for (let y = y0; y <= cy + reach; y += ch) {
      for (let x = x0; x <= cx + reach; x += cw) {
        const gx = x + cw / 2, gy = y + ch / 2;
        const nx = (gx - cx) / er, ny = (gy - cy) / er;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1) {
          // A thin blue atmosphere round the edge, brightest on the sunlit side.
          const d = Math.sqrt(d2);
          if (d > reach / er) continue;
          const side = clamp((nx * L[0] + ny * L[1]) / (d * lxy), -1, 1);
          this.glyph(d < 1.06 ? ":" : ".", gx, gy, EARTH_ATMO, 0.5 * (1 - (d - 1) / (reach / er - 1)) * (0.25 + 0.75 * smoothstep(-0.4, 0.6, side)));
          continue;
        }
        const nz = Math.sqrt(1 - d2);
        const rim = smoothstep(0, 0.3, nz);
        const ux = nx * ct - ny * st, uy = nx * st + ny * ct;
        const lat = Math.asin(clamp(-uy, -1, 1));
        let lon = Math.atan2(ux, nz) + spin;
        lon = ((((lon + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
        const sx = Math.cos(lat) * Math.sin(lon), sy = Math.sin(lat), sz = Math.cos(lat) * Math.cos(lon);
        const lam = nx * L[0] + ny * L[1] + nz * L[2];
        const day = smoothstep(-0.08, 0.16, lam);
        const land = isLand(lon, lat) === 1;
        const ice = Math.abs(lat) > 1.22 || (land && Math.abs(lat) > 1.08);
        const cloud = smoothstep(0.52, 0.7, noise(sx * 2.6 + sz * 1.3 + t * 0.03, sy * 3.2 + sz * 0.7, 41) * 0.6 + noise(sx * 7 - t * 0.02, sy * 7 + sz * 3, 42) * 0.4);
        if (day < 0.5) {
          // Night side: cities on land, fixed to the surface so they turn with it.
          const ix = Math.floor(((lon + Math.PI) / TAU) * 160), iy = Math.floor(((lat + Math.PI / 2) / Math.PI) * 80);
          if (land && !ice && cloud < 0.5 && hash(ix, iy, 71) < 0.22) {
            const tw = 0.6 + 0.4 * Math.sin(t * 2 + hash(ix, iy, 72) * TAU);
            this.glyph(hash(ix, iy, 73) < 0.3 ? "*" : "·", gx, gy, EARTH_CITY, (0.9 - day) * tw * rim);
          } else {
            this.glyph(land ? ":" : ".", gx, gy, EARTH_NIGHT, (land ? 0.3 : 0.2) * rim + 0.05);
          }
          continue;
        }
        const b = clamp((0.3 + 0.7 * Math.max(lam, 0)) * (0.6 + 0.4 * rim) + 0.08, 0, 1);
        let g: string, col: Rgb, a: number;
        if (cloud > 0.4) {
          g = RAMP[clamp(Math.round((0.35 + 0.65 * cloud) * b * 9), 2, 9)];
          col = EARTH_CLOUD;
          a = 0.45 + 0.5 * b;
        } else if (ice) {
          g = RAMP[clamp(Math.round(b * 8), 3, 9)];
          col = EARTH_ICE;
          a = 0.5 + 0.45 * b;
        } else if (land) {
          const dry = smoothstep(0.4, 0.68, noise(sx * 5 + 9, sy * 5 + sz * 3, 44)) * 0.7 + (Math.abs(lat) < 0.5 ? 0.25 : 0);
          g = ".+*#%"[clamp(Math.round(b * 4 * 0.9), 0, 4)];
          col = mix(EARTH_GREEN, EARTH_DRY, clamp(dry, 0, 1));
          a = 0.5 + 0.5 * b;
        } else {
          g = b > 0.55 ? "~" : b > 0.35 ? "-" : ".";
          col = mix(EARTH_DEEP, EARTH_SEA, b);
          a = 0.4 + 0.5 * b;
        }
        this.glyph(g, gx, gy, mix(col, EARTH_ATMO, (1 - rim) * 0.55), a * (day * 2 - 1));
      }
    }
  }

  /** The moon as seen from near Earth: a small shaded disc. */
  private drawMiniMoon(x: number, y: number, rad: number) {
    const font = Math.max(5, this.hero.font * 0.85);
    const cw = font * 0.62, ch = font * 1.08;
    const L = norm([-0.78, -0.3, 0.55]);
    this.ctx.font = `${font}px ${this.family}`;
    for (let gy = -rad; gy <= rad; gy += ch) {
      for (let gx = -rad; gx <= rad; gx += cw) {
        const nx = gx / rad, ny = gy / rad, d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        const b = clamp(nx * L[0] + ny * L[1] + nz * L[2], 0, 1) * (0.75 + 0.25 * noise(nx * 3 + 5, ny * 3, 21));
        const g = RAMP[clamp(Math.round(b * 9), 1, 9)];
        this.glyph(g, x + gx, y + gy, DARK.bright, 0.3 + 0.7 * b);
      }
    }
  }

  private satPos(s: Sat) {
    const pl = this.hero;
    const lx = Math.cos(s.theta) * s.rho, ly = Math.sin(s.theta) * s.rho * s.k;
    const c = Math.cos(s.tilt), sn = Math.sin(s.tilt);
    return { x: pl.x + lx * c - ly * sn, y: pl.y + lx * sn + ly * c, front: Math.sin(s.theta) > 0 };
  }

  private drawSats(front: boolean) {
    const er = this.hero.r * 0.9;
    this.ctx.font = `10px ${this.family}`;
    for (const s of this.sats) {
      const at = this.satPos(s);
      if (at.front !== front) continue;
      if (!front && Math.hypot(at.x - this.hero.x, at.y - this.hero.y) < er) continue;
      // A short dotted wake along its orbit.
      for (let j = 1; j <= 6; j++) {
        const p = this.satPos({ ...s, theta: s.theta - Math.sign(s.w) * j * 0.07 });
        if (!p.front && Math.hypot(p.x - this.hero.x, p.y - this.hero.y) < er) continue;
        this.glyph("·", p.x, p.y, EARTH_ATMO, 0.4 * (1 - j / 7));
      }
      this.glyph("-", at.x - 6, at.y, EARTH_SAT, 0.75);
      this.glyph("-", at.x + 6, at.y, EARTH_SAT, 0.75);
      this.glyph("+", at.x, at.y, EARTH_SAT, 1);
      // A blinking beacon.
      if ((this.time + s.seed) % 1.4 < 0.15) this.glyph(".", at.x, at.y - 7, [255, 96, 96], 1);
    }
  }

  private drawPings() {
    this.ctx.font = `10px ${this.family}`;
    for (const p of this.pings) {
      const r = 4 + p.age * 34;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        this.glyph("·", p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, EARTH_ATMO, (1 - p.age) * 0.9);
      }
    }
  }

  private launchSat(x: number, y: number) {
    const pl = this.hero;
    const er = pl.r * 0.9;
    const tilt = rand(-0.5, 0.5);
    const k = rand(0.22, 0.5);
    const dx = x - pl.x, dy = y - pl.y;
    // Undo the orbit's tilt and squash to find the circle through the click.
    const lx = dx * Math.cos(-tilt) - dy * Math.sin(-tilt), ly = dx * Math.sin(-tilt) + dy * Math.cos(-tilt);
    const rho = clamp(Math.hypot(lx, ly / k), er * 1.15, er * 3.6);
    const theta = Math.atan2(ly / k, lx);
    const w = SAT_W0 * (er / rho) ** 1.5 * (Math.random() < 0.2 ? -1 : 1);
    this.sats.push({ rho, theta, k, tilt, w, seed: Math.random() * 10 });
    if (this.sats.length > MAX_SATS) this.sats.shift();
    this.pings.push({ x, y, age: 0 });
    this.launched++;
    this.report();
    if (this.reduced.matches || !this.raf) this.render();
  }

  private drawHero(scene: Scene) {
    if (scene === "night") {
      this.use(DARK, 1);
      this.drawMoonGlow(1);
      this.drawMoon(this.hero.x, this.hero.y, 1, DARK.orbit);
    } else if (scene === "day") {
      this.use(LIGHT, 1);
      this.drawSun(null, 1);
    } else {
      this.use(DARK, 1);
      this.drawEarthScene();
    }
  }

  /** Draw with the canvas moved and scaled about the hero, and everything faded by alpha. */
  private around(tx: number, ty: number, scale: number, alpha: number, draw: () => void) {
    if (alpha < 0.02) return;
    const { ctx, hero } = this;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);
    ctx.translate(-hero.x, -hero.y);
    this.fade = alpha;
    draw();
    this.fade = 1;
    ctx.restore();
  }

  /**
   * To and from Earth the camera pulls back: the moon or sun shrinks and swings off to the upper left as Earth
   * rises into view from below. Leaving plays the same move backwards.
   */
  private drawZoom(k: number) {
    const { ctx, w, h } = this;
    const turn = this.turn!;
    const e = ease(k);
    const p = turn.to === "earth" ? e : 1 - e;
    const other: Scene = turn.to === "earth" ? turn.from : turn.to;
    const bgOf = (sc: Scene) => (sc === "day" ? LIGHT_BG : sc === "earth" ? TWILIGHT_BG : DARK_BG);
    if (this.variant !== "emblem") {
      ctx.globalAlpha = 1;
      ctx.fillStyle = css(mix(bgOf(turn.from), bgOf(turn.to), e));
      ctx.fillRect(0, 0, w, h);
    }
    if (other === "day") {
      this.use(LIGHT, 1 - p);
      this.drawStars("day");
      this.use(DARK, p * 0.75);
    } else {
      this.use(DARK, 1 - p * 0.25);
    }
    this.drawStars("night");
    if (this.variant === "quiet") return;
    const { x, y, r } = this.hero;
    this.around(x - 1.9 * r * p, y - 0.8 * r * p, 1 - 0.8 * p, 1 - smoothstep(0.55, 1, p), () => this.drawHero(other));
    this.around(x, y + 1.1 * r * (1 - p), 0.35 + 0.65 * p, smoothstep(0, 0.45, p), () => this.drawHero("earth"));
  }

  /** A point on a flare's loop: t runs 0 → 1 from one foot, out round the apex, and back to the other. */
  private flarePoint(f: Flare, t: number, lift: number) {
    const pl = this.hero;
    const rs = pl.r;
    const spread = 0.26;
    const a1 = f.foot - spread, a2 = f.foot + spread;
    const x1 = pl.x + Math.cos(a1) * rs, y1 = pl.y + Math.sin(a1) * rs;
    const x2 = pl.x + Math.cos(a2) * rs, y2 = pl.y + Math.sin(a2) * rs;
    const dx = Math.cos(f.foot), dy = Math.sin(f.foot);
    const nx = -dy, ny = dx;
    const L = (f.reach - rs) * lift;
    // The loop bulges wider toward its top, like a real prominence.
    const bw = L * 0.42;
    const c1x = x1 + dx * L * 1.3 - nx * bw, c1y = y1 + dy * L * 1.3 - ny * bw;
    const c2x = x2 + dx * L * 1.3 + nx * bw, c2y = y2 + dy * L * 1.3 + ny * bw;
    const u = 1 - t;
    const x = u * u * u * x1 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x2;
    const y = u * u * u * y1 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y2;
    return { x, y };
  }

  /** The moment a flare reaches full height: it throws sparks off its crown, and nearby dust scatters. */
  private strike(f: Flare) {
    f.struck = true;
    const crown = this.flarePoint(f, 0.5, 1);
    for (let i = 0; i < 18; i++) {
      const a = f.foot + rand(-0.9, 0.9);
      const v = rand(60, 280);
      this.sparks.push({ x: crown.x, y: crown.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: rand(0.6, 1.4), glyph: "*+.'"[i % 4] });
    }
  }

  private drawFlares() {
    const pal = this.palette;
    const pl = this.hero;
    const tick = Math.floor(this.time * 14);
    this.ctx.font = `${pl.font}px ${this.family}`;
    for (const f of this.flares) {
      const grow = ease(clamp(f.age / FLARE_GROW, 0, 1));
      // After it peaks the loop keeps lifting a little as it fades, as if breaking away from the sun.
      const lift = 1 + Math.max(0, f.age - FLARE_GROW) * 0.14;
      const fade = f.age < 1 ? 1 : 1 - (f.age - 1) / (FLARE_LIFE - 1);
      const crown = this.flarePoint(f, 0.5, lift);
      const len = Math.hypot(crown.x - pl.x, crown.y - pl.y) * 2.6;
      const n = Math.max(12, Math.round(len / pl.cw));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        // Both legs rise from the surface together and meet at the crown.
        if (t > grow / 2 && t < 1 - grow / 2) continue;
        const a = this.flarePoint(f, t, lift);
        const b = this.flarePoint(f, Math.min(1, t + 0.01), lift);
        const heat = 1 - Math.abs(t - 0.5) * 2;
        const roll = hash(i, tick, f.seed);
        const g = roll < 0.25 ? "~" : roll < 0.4 ? "*" : lineGlyph(b.x - a.x, b.y - a.y);
        const nx = -(b.y - a.y), ny = b.x - a.x;
        const nl = Math.hypot(nx, ny) || 1;
        this.glyph(g, a.x, a.y, mix(pal.warm, pal.bright, heat * 0.6), (0.95 - heat * 0.2) * fade);
        // A thinner inner strand gives the loop some body.
        if (i % 2 === 0) this.glyph(roll > 0.5 ? "." : "'", a.x + (nx / nl) * 5, a.y + (ny / nl) * 5, pal.warm, 0.55 * fade);
      }
    }
    for (const sp of this.sparks) {
      const k = sp.age / sp.life;
      this.glyph(sp.glyph, sp.x, sp.y, mix(pal.warm, pal.bright, k), (1 - k) * 0.9);
    }
  }

  private launchFlare(x: number, y: number) {
    const pl = this.hero;
    const foot = Math.atan2(y - pl.y, x - pl.x);
    // Reach out to the click: never shorter than a stub, never too far from the sun.
    const reach = clamp(Math.hypot(x - pl.x, y - pl.y), pl.r * 1.6, pl.r * 3.2);
    this.flares.push({ foot, reach, age: 0, struck: false, seed: Math.floor(Math.random() * 1e6) });
    if (this.flares.length > MAX_FLARES) this.flares.shift();
    this.sunFlash = 1;
    this.flared++;
    this.report();
  }

  private onPointerMove = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.active = e.pointerType !== "touch" && x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
  };

  private onPointerLeave = () => {
    this.pointer.active = false;
  };

  // Clicks on empty sky launch a comet or a flare; links, buttons and text selection are left alone.
  private onClick = (e: MouseEvent) => {
    if (this.reduced.matches) return;
    if (e.composedPath().some((n) => n instanceof Element && n.matches(INTERACTIVE))) return;
    if (window.getSelection()?.toString()) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
    if (this.turn) return;
    if (this.astroHit(x, y)) {
      // It stops to wave before kicking off.
      const a = this.astro!;
      a.waveAt = this.time;
      a.vx *= 0.3;
      a.vy *= 0.3;
      return;
    }
    if (this.scene === "day") this.launchFlare(x, y);
    else if (this.scene === "earth") this.launchSat(x, y);
    else this.launchComet(x, y, rand(0.72, 1.08));
  };

  /** From the CV receiver under the hero: send the CV down to it, the current sky's way. */
  private onDeliver = (e: Event) => {
    if (this.turn || this.delivery) return;
    const { x: cx, y: cy } = (e as CustomEvent<{ x: number; y: number }>).detail;
    const rect = this.canvas.getBoundingClientRect();
    this.delivery = { scene: this.scene, start: this.time, x: cx - rect.left, y: cy - rect.top, bend: Math.random() < 0.5 ? -1 : 1 };
  };

  /** From the emblem's launch event: the CV button sends a comet into orbit, or makes the sun flare toward it. */
  private onLaunch = (e: Event) => {
    if (this.turn) return;
    const { x: cx, y: cy } = (e as CustomEvent<{ x: number; y: number }>).detail;
    const rect = this.canvas.getBoundingClientRect();
    const x = cx - rect.left, y = cy - rect.top;
    if (this.scene === "day") this.launchFlare(x, y);
    else if (this.scene === "earth") this.launchSat(x, y);
    // A touch under orbital speed, so it's caught and loops round rather than flying off.
    else this.launchComet(x, y, 0.9);
    if (this.reduced.matches || !this.raf) this.render();
  };

  private launchComet(x: number, y: number, speed: number) {
    const pl = this.hero;
    const dx = x - pl.x, dy = y - pl.y;
    const d = Math.max(Math.hypot(dx, dy), pl.r * 1.2);
    // Sideways to the moon at a little under orbital speed: most comets loop round on an ellipse,
    // some dive in close and slingshot, a few hit.
    const v = Math.sqrt(pl.gm / d) * speed;
    this.comets.push({ x, y, vx: (-dy / d) * v, vy: (dx / d) * v, age: 0, trail: [x, y], dying: 0 });
    if (this.comets.length > MAX_COMETS) {
      const oldest = this.comets.find((c) => c.dying === 0);
      if (oldest) oldest.dying = 0.0001;
    }
    this.launched++;
    this.report();
    if (this.reduced.matches || !this.raf) this.render();
  }
}
