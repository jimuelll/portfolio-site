/*
 * The sky behind the site, drawn entirely in monospace glyphs on one canvas.
 *
 * Night (dark theme): a large cratered moon, shaded with an ASCII density ramp. It rocks gently (libration)
 * and its phase drifts between gibbous and full. The starfield drifts, twinkles, and bends around the cursor
 * like light around a gravitational lens. Clicking empty sky launches a comet that falls under the moon's
 * gravity, so it orbits, slingshots away, or crashes. Now and then a shooting star crosses the sky.
 *
 * Day (light theme): a sun of the same size in the same place, printed like an old almanac plate: an inked disc
 * with a boiling surface and sunspots that turn with it, straight and wavy rays, and ruled rings round it. Dust
 * motes drift and glint. Clicking erupts a flare that reaches the cursor, then bursts with a shockwave. The inner
 * pages show a corner of the same plate.
 *
 * Switching theme is an eclipse. Going to night, the moon slides across the sun and the sky darkens as it
 * covers it; at totality the corona flares out and the stars come in. Going to day, the moon goes dark, the
 * corona appears behind it, and the moon slides off to let the light back.
 *
 * Earth (a hidden twilight theme, reached by flicking the theme toggle five times fast): the camera pulls back
 * from the moon or sun to a turning ASCII Earth drawn from a real coastline map, with clouds, city lights on the
 * night side and the moon going round it. Clicking puts a satellite into orbit where you click.
 *
 * The galaxy (a hidden fourth theme, "deep"): press and hold the moon, sun or Earth for three seconds. A ring charges
 * round it while the stars strain toward it, then hyperdrive: the disc collapses to a point, the stars stream past
 * in streaks, and you drop out in front of an ASCII spiral galaxy with the sun marked on one arm. Drag to drift
 * through it; scroll or pinch to zoom. The toggle jumps back the same way. Out there the nav's "projects" lights
 * your projects as star systems on the arms, and "about" flies you to the sun with a pilot's card.
 *
 * Moving between the sky and the inner pages, the sky carries you in its own way (top-nav.tsx starts it with
 * DEPART_EVENT): by night the camera tilts up and the moon sets as the stars stream past, by day you look into the
 * sun until its glare washes everything out, and at Earth the camera swings round it. The next page's sky picks
 * up the motion and lets it settle; the way back plays it in reverse (moonrise, sunrise, Earth swinging back).
 *
 * While the theme toggle is held the sky is a long exposure: the stars draw trails round the toggle as their
 * pole, until the hold lifts off into the cosmos (sky/cosmos.ts).
 *
 * Every so often something drifts across the sky page, different in each sky, telling how to trigger a secret you
 * haven't found yet (sky/drifters.ts).
 *
 * Anything on the page marked [data-sky-avoid] dims the sky underneath it so text always stays readable.
 */

export type Scene = "night" | "day" | "earth" | "deep";
/** detail: the moon's phase by night, the sunspot count by day. Empty when there's no moon or sun on screen. */
export type SkyStats = { scene: Scene; detail: string; comets: number; flares: number; sats: number; launched: number; flared: number };
/** full: the home page sky. quiet: a faint starfield behind interior pages. emblem: a small framed sky. */
export type SkyVariant = "full" | "quiet" | "emblem";
export type Rgb = [number, number, number];
type Box = { left: number; top: number; right: number; bottom: number };
type Vec = [number, number, number];

import { projects } from "../../lib/portfolio";
import { DRIFTERS, paintDrifter, type Saying, type SecretId, type Sprite } from "./drifters";

const TAU = Math.PI * 2;
const STEP = 1 / 120;
const MAX_COMETS = 24;
const TRAIL = 150;
const DIM_UNDER_CONTENT = 0.12;
const AVOID = "[data-sky-avoid]";
const INTERACTIVE = "a, button, input, textarea, select, label, [role='button'], [data-sky-ignore]";
export const RAMP = " .:-=+*#%@";
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
const MAX_FLARES = 4;
const FLARE_GROW = 0.45;
const FLARE_LIFE = 2.6;
/** How long a flare holds before it fades, and how long the shockwave off its crown takes to spread and go. */
const FLARE_HOLD = 1.5;
const SHOCK_LIFE = 0.9;
/** Flares are big events, so they get bigger glyphs than the fine surface of the sun. */
const FLARE_FONT = 12;
/** Enough to fill a screen with sparks when clicks are mashed, and no more. */
const MAX_SPARKS = 180;
/** The sun turns once in about two minutes, carrying its spots round. */
const SUN_SPIN = TAU / 130;
const PHASE_PERIOD = 150;
const SPOTS = 5;
/** The zoom between Earth and the moon or sun. */
const ZOOM_SECONDS = 1.8;
const TWILIGHT_BG: Rgb = [14, 22, 46];
/**
 * The long exposure while the theme toggle is held (top-nav.tsx writes it): k runs 0 → 1, and the stars wheel
 * round (x, y), the toggle in viewport px, leaving trails.
 */
export const exposure = { k: 0, x: 0, y: 0 };
/** Fired on window when the hero has been held long enough: top-nav.tsx switches to the galaxy. */
export const HYPERDRIVE_EVENT = "sky-hyperdrive";
/** Fired on window when the sky has something to say in the nav's note (sky/cosmos.ts): the text is the detail. */
export const NOTE_EVENT = "sky-note";
/**
 * Out in the galaxy or the cosmos, the nav's "projects" and "about" are answered by the sky itself: top-nav.tsx
 * fires NAV_EVENT with which one, and the sky shows it its own way. GO_EVENT (detail: a path) asks top-nav to bring
 * you home and then open that page, when something out there is tapped.
 */
export const NAV_EVENT = "sky-nav";
/** Fired on window as a page change between the sky and an inner page begins; the route changes DEPART_SECONDS later. */
export const DEPART_EVENT = "sky-depart";
export const DEPART_SECONDS = 0.8;
/** Fired on window when the next page never came: the sky settles back to where it was. */
export const DEPART_CANCEL_EVENT = "sky-depart-cancel";
/** How long the next page's sky takes to settle from the motion it arrives with. */
const SETTLE_SECONDS = 0.9;
/** The colour the day's glare washes everything to: the paper of the day pages, a touch brighter. */
const GLARE: Rgb = [255, 248, 234];
/** How long the galaxy's answers take to put themselves away, and how the star systems light up one by one. */
const NAV_FADE = 0.6;
const GLIMMER_GAP = 0.35;
const GLIMMER = 0.8;
export const GO_EVENT = "sky-go";
export type NavTarget = "projects" | "about";
/** How long the moon, sun or Earth has to be held. */
const CHARGE_MS = 3000;
/** How long a drifter stops when clicked, long enough to read what it's saying. */
const WAVE_SECONDS = 7;
/** How fast the instruction types itself out. */
const SAY_RATE = 42;
/** The jump through hyperdrive, either way. */
export const HYPER_SECONDS = 2.6;
const DEEP_BG: Rgb = [5, 6, 13];
const BLUESHIFT: Rgb = [150, 196, 255];
export const GALAXY_CORE: Rgb = [255, 226, 180];
export const GALAXY_ARM: Rgb = [150, 172, 255];
export const GALAXY_NEBULA: Rgb = [236, 120, 190];
/** Spiral arms wind out as a logarithmic spiral, r ∝ e^(bθ); b = 0.32 is a pitch of about 18°, like the Milky Way's. */
export const ARM_PITCH = 0.32;
/** The galaxy's disc seen at an angle: squashed and turned a little on screen (see galaxySquash for phones). */
export const GALAXY_SQUASH_WIDE = 0.6;
export const GALAXY_TURN = -0.32;
/** Where the sun sits: partway out along one arm. */
export const SUN_ORBIT = 0.58;
const GALAXY_ACCENT: Rgb = [195, 166, 255];
const GALAXY_FAINT: Rgb = [154, 150, 184];
/** How close the camera comes to the sun for the pilot's card. */
const SUN_ZOOM = 2.4;
const PILOT_CARD = ["pilot · jimuel jean untalan", "software engineer", "seeking a software internship", "read the dossier →"];
const MAX_SATS = 30;
/** One satellite at 1.3 Earth radii goes round in 8 s; further out is slower, by Kepler's third law. */
const SAT_W0 = (TAU / 8) * 1.3 ** 1.5;
/**
 * Where there's land on Earth: a 128 × 64 equirectangular bitmap (north up, from 180°W), one bit per cell,
 * base64. Made by sampling the global-land-mask package.
 */
const LAND = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwD6AAAAAAAAAAAAAAAAA/7//8AAAAAAYAAAAAAABhlz//+ABAAAAAwAAAAAAAur8A//gAAACAf/ACAAAAAP6vwP/wAAABD///14AIf///fnB/4AA/gP///////n////58fw4Af/////////A////yODgAAf/////////gf///4OAIAAPP///////ngAwf/+D8AAAgz//////8DAAAB//+/gAAcZ//////+BwAAAP///8AAHf///////4AAAAB///5gAAf///////8AAAAAP///AAAH///////+AAAAAD//+AAAF+8P/////IAAAAA///AAAB4X//////AAAAAAP//gAAAcBv////+RAAAAAB//4AAAD8Af////lwAAAAAP/8AAAB/mP////4gAAAAAA/yAAAA///////+AAAAAAAXgQAAAf//ff///gAAAAAAA4AAAAP///+P//wAAAAAAAPIgAAD//+/h+fwAAAAAAAB+CAAA///3wPHwAAAAAAAABwAAAP//9wDg+AAAAAAAAAEAAAD///wAYHhAAAAAAAAAnwAAf///AEBQAAAAAAAAAD+AAD///wAgACAAAAAAAAA/8AAAf/4AAKMAAAAAAAAAP/AAAH/8AABnAAAAAAAAAH/8AAB/+AAAJ8AAAAAAAAB//4AAP/AAADADwAAAAAAAf//AAD/wAAAOAeAAAAAAAD//gAAf8AAAAAAgAAAAAAAf/wAAH/AAAAAMgAAAAAAAH/8AAD/7AAAAPsAAAAAAAAf/AAA/4wAAAH/AAAAAAAAH/wAAH+YAAAH/4AAAAAAAB/wAAB/mAAAD//AAAAAAAAf4AAAfwAAAA//4AAAAAAAH8AAAD4AAAAH/+AAAAAAAB/AAAA8AAAAB5/AAAAAAAA/AAAAAAAAAAAHwAAAAAAAPwAAAAAAAAAAA4AgAAAAADwAAAAAAAAAAAAAIAAAAAA4AAAAAAAAAAAAAIAAAAAAcAAAAAAAAAAAAAAAAAAAAHAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAwABmBAAAAAAAAAIAAAAAD/5////+AAAAAAAPAAA//////////8AAAV4//wAA//////////+AAf///8AAP///////////AAD////oDj///////////gAD/////3/////////////D//////////////////////////////////////////w==";
let landBits: Uint8Array | null = null;
/**
 * How far the sky has stepped down for this device (0 full, 3 lowest), by the same rule as the voyage and the solar
 * system: two slow seconds in a row, never back up. Kept outside the engine, so a new page doesn't have to find out again.
 */
let skyQuality = 0;
const SLOW_FRAME_MS = 28;
const SKY_STARS = [1, 0.7, 0.45, 0.3];
const SKY_GLYPH = [1, 1.2, 1.45, 1.7];
export function isLand(lon: number, lat: number) {
  if (!landBits) {
    const raw = atob(LAND);
    landBits = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }
  const x = Math.floor((((lon / TAU + 0.5) % 1) + 1) % 1 * 128) % 128;
  const y = Math.min(63, Math.max(0, Math.floor((0.5 - lat / Math.PI) * 64)));
  const i = y * 128 + x;
  return (landBits[i >> 3] >> (7 - (i & 7))) & 1;
}
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const zooms = (s: Scene) => s === "earth" || s === "deep";

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
/** The same sun as printing ink, for the day sky at rest. Ink only reads on paper when it's dark. */
const INK_LIMB: Rgb = [108, 26, 20];
const INK_MID: Rgb = [176, 54, 22];
const INK_CORE: Rgb = [196, 104, 16];
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
const bgOf = (s: Scene) => (s === "day" ? LIGHT_BG : s === "earth" ? TWILIGHT_BG : s === "deep" ? DEEP_BG : DARK_BG);

const LIGHT: Palette = {
  star: [30, 42, 66],
  warm: [196, 74, 40],
  cool: [38, 86, 140],
  bright: [214, 120, 52],
  deep: [74, 36, 30],
  orbit: [108, 84, 62],
  comet: [176, 58, 30],
  ink: true,
  alpha: 0.92,
};

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function hash(x: number, y: number, z: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A two-armed spiral at a point on its disc, r out from the centre: how much core, arm and dust lane there is there, and the sum of them. */
export function spiralField(u: number, v: number, spin: number, pitch = ARM_PITCH) {
  const r = Math.hypot(u, v);
  const th = Math.atan2(v, u) - spin;
  const phase = th - Math.log(r + 0.02) / pitch;
  const core = Math.exp(-((r / 0.13) ** 2));
  const arm = (0.5 + 0.5 * Math.cos(2 * phase)) ** 3 * Math.exp(-r / 0.75) * smoothstep(0.04, 0.2, r) * (1 - smoothstep(0.95, 1.15, r));
  const lane = (0.5 + 0.5 * Math.cos(2 * phase + 0.7)) ** 14 * smoothstep(0.12, 0.3, r);
  const n = noise(u * 9 + 3, v * 9, 61);
  return { r, core, arm, lane, n, d: core * 1.3 + arm * (0.8 + 1.1 * n) + 0.07 * Math.exp(-r / 0.6) * n - lane * 0.25 };
}

export function noise(x: number, y: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const u = smoothstep(0, 1, x - xi), v = smoothstep(0, 1, y - yi);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** A glyph that follows a direction on screen, for comet tails, meteor streaks and rays. */
export function lineGlyph(dx: number, dy: number) {
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

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Colour strings, kept: thousands of glyphs a frame ask for the same few, and building each one anew is a real cost. */
const inks = new Map<number, string>();
export const css = (c: Rgb) => {
  const key = ((c[0] & 255) << 16) | ((c[1] & 255) << 8) | (c[2] & 255);
  let ink = inks.get(key);
  if (!ink) {
    if (inks.size > 8192) inks.clear();
    ink = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    inks.set(key, ink);
  }
  return ink;
};
const norm = (v: Vec): Vec => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

interface Star { x: number; y: number; z: number; phase: number; speed: number; glyph: string; tint: 0 | 1 | 2 }
interface Comet { x: number; y: number; vx: number; vy: number; age: number; trail: number[]; dying: number }
interface Flash { x: number; y: number; age: number }
/** The CV on its way down to the receiver; how it travels depends on the scene it started in. */
interface Delivery { scene: Scene; start: number; x: number; y: number; bend: number }
interface Meteor { x: number; y: number; vx: number; vy: number; age: number; life: number }
/** A looping prominence from two feet on the sun's surface out toward where the click landed. */
/** A curl of plasma peeling off a flare: where along the loop it leaves, which way it bends, and how far it gets. */
interface Tendril { at: number; side: number; curl: number; len: number; ray?: number }
/**
 * No two flares alike: how far apart its feet are (a jet's nearly touch), how lopsided its arch is, how much its path
 * wanders and churns, how torn it is, how thick, and what peels off it.
 */
interface Flare { foot: number; reach: number; age: number; struck: boolean; seed: number; spreadA: number; spreadB: number; lean: number; bulge: number; wander: number; freq: number; churn: number; torn: number; thick: number; tendrils: Tendril[] }
interface Spark { x: number; y: number; vx: number; vy: number; age: number; life: number; glyph: string }
interface Shock { x: number; y: number; age: number; reach: number; seed: number }
/** A crater on the moon: centre as a unit vector on the sphere, and angular radius. */
interface Crater { c: Vec; r: number }
/** A sunspot: where it sits on the turning surface, how big, and when it formed and fades. */
interface Spot { lon: number; lat: number; size: number; born: number; life: number }
/** A satellite on a tilted circular orbit, seen as an ellipse: rho is its radius, k the squash, tilt the turn. */
interface Sat { rho: number; theta: number; k: number; tilt: number; w: number; seed: number }
interface Ping { x: number; y: number; age: number }
/** A comet passing the sun by day, along a curve: p0 → p2 bent through p1. */
interface DayComet { start: number; dur: number; p0: [number, number]; p1: [number, number]; p2: [number, number] }
/**
 * Something drifting through the sky (sky/drifters.ts). waveAt is when it was clicked (-1: not yet). It says its line until
 * sayUntil (-1: not asked). pace is how fast it's going against its usual speed; it eases, so nothing snaps.
 */
interface Drifter { x: number; y: number; vx: number; vy: number; rot: number; spin: number; waveAt: number; fled: boolean; sprite: Sprite; line: Saying; phase: number; sayUntil: number; pace: number }
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
  private slowFor = 0;
  private quality = skyQuality;
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
  private shocks: Shock[] = [];
  /** How far the day sky has settled into its printed look (1) from the eclipse's softer one (0). */
  private inked = 1;
  /** The sky's colour that the nav and the label are wearing through a theme change (see matchSurfaces). */
  private surface: string | null = null;
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
  private drifter: Drifter | null = null;
  private nextDrifter = rand(3, 7);
  /** Which secret went by last, so the next one is a different one. */
  private lastDrifter: SecretId | null = null;
  private overDrifter = false;
  /** The card with what the drifter is saying, what it's showing, and how far that has typed. */
  private saying: HTMLElement | null = null;
  private said: Saying | null = null;
  private saidAt = 0;
  private saidTyped = -1;
  /** The long exposure (eased toward exposure.k), its pole in canvas px, and where the canvas sits in the viewport. */
  private trail = 0;
  private pole = { x: 0, y: 0 };
  private origin = { left: 0, top: 0 };
  /** The galaxy's camera: pan in px, zoom, and the drift it keeps after a fling. */
  private cam = { x: 0, y: 0, z: 1, vx: 0, vy: 0 };
  /** Pointers holding the galaxy: where each is now, and where it went down (a press that barely moves is a tap). */
  private grabs = new Map<number, { x: number; y: number; sx: number; sy: number }>();
  /** The nav's answer showing in the galaxy (star systems, or the pilot's card), and where the camera is easing to. */
  private galaxyNav: NavTarget | null = null;
  private camAim: "whole" | "sun" | null = null;
  /** When the galaxy's answer was asked for, and when it started putting itself away (-1: it isn't). */
  private navAt = 0;
  private navClosing = -1;
  /**
   * A page change: leaving this page ("out") or settling on arrival ("in"), and when it began, in wall-clock
   * seconds, so the move keeps time with the route change even when frames are dropped.
   */
  private pass: { dir: "out" | "in"; start: number } | null = null;
  /** How far the view moved over the last moment of a page change, for drawing the stars as streaks. */
  private streak = { x: 0, y: 0 };
  /** How far a page change has slid the sky; the stars wrap round it so the view never empties. */
  private passShift = { x: 0, y: 0 };
  /** Whatever is tappable this frame (a star system, the dossier link), in canvas px. */
  private hits: { x: number; y: number; w: number; h: number; href: string }[] = [];
  /** Labels placed this frame, so the next one can keep clear of them. */
  private labelBoxes: { x: number; y: number; w: number; h: number }[] = [];
  private lastDrag = 0;
  /** The middle of what's on screen, in canvas px. */
  private view = { x: 0, y: 0 };
  /** The hold on the hero: which pointer, when it began, its timer, and the charge (0 → 1) for drawing. */
  private charging = { id: -1, start: 0, timer: 0 };
  private charge = 0;
  /** How far the stars have streamed during hyperdrive. */
  private warpPos = 0;
  /** The click that ends a hold on the hero isn't also a comet. */
  private swallowUntil = 0;
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
    if (variant !== "emblem") {
      window.addEventListener("pointerdown", this.onGrab);
      window.addEventListener("pointerup", this.onLetGo);
      window.addEventListener("pointercancel", this.onLetGo);
      window.addEventListener("wheel", this.onWheel, { passive: false });
      window.addEventListener("contextmenu", this.onMenu);
      window.addEventListener(NAV_EVENT, this.onNav);
      window.addEventListener(DEPART_EVENT, this.onDepart);
      window.addEventListener(DEPART_CANCEL_EVENT, this.onDepartCancel);
      // Arriving from a page change: carry on the motion the last page's sky left with, and let it settle.
      // top-nav.tsx clears the flag once the new page is in.
      if (document.documentElement.dataset.skyArrive && !this.reduced.matches) this.pass = { dir: "in", start: performance.now() / 1000 };
    }
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
    window.removeEventListener("pointerdown", this.onGrab);
    window.removeEventListener("pointerup", this.onLetGo);
    window.removeEventListener("pointercancel", this.onLetGo);
    window.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("contextmenu", this.onMenu);
    window.removeEventListener(NAV_EVENT, this.onNav);
    window.removeEventListener(DEPART_EVENT, this.onDepart);
    window.removeEventListener(DEPART_CANCEL_EVENT, this.onDepartCancel);
    window.clearTimeout(this.charging.timer);
    if (this.overDrifter && this.canvas.parentElement) this.canvas.parentElement.style.cursor = "";
    this.saying?.remove();
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
    const next: Scene = theme === "light" ? "day" : theme === "twilight" ? "earth" : theme === "deep" ? "deep" : "night";
    if (next === this.scene) return;
    // Each visit to the galaxy starts from the same view.
    if (next === "deep") this.cam = { x: 0, y: 0, z: 1, vx: 0, vy: 0 };
    this.galaxyNav = null;
    this.navClosing = -1;
    this.camAim = null;
    // What was drifting belongs to the old sky, and so do its words.
    this.drifter = null;
    this.nextDrifter = rand(3, 7);
    // A settle still running belongs to the old scene; the new one has its own way of turning up.
    this.pass = null;
    // Inner pages fade their colours over instead, so the sky switches at once.
    const sunrise = document.documentElement.classList.contains(SUNRISE_CLASS);
    // The first read just picks the scene; later changes play the eclipse.
    if (this.started && !this.reduced.matches && this.raf && !sunrise) {
      const deep = this.scene === "deep" || next === "deep";
      const zoom = zooms(this.scene) || zooms(next);
      this.turn = { from: this.scene, to: next, start: this.time, dur: deep ? HYPER_SECONDS : zoom ? ZOOM_SECONDS : TURN_SECONDS };
      this.scene = next;
      this.syncTextColour();
      // Paint the first frame now, before the browser shows the new page background.
      this.render();
      return;
    }
    this.scene = next;
    this.turn = null;
    this.matchSurfaces(null);
    // Painted right away, so the stars change with the page.
    if (sunrise || this.reduced.matches || !this.raf) this.render();
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const ratio = skyQuality >= 3 ? 1 : Math.min(window.devicePixelRatio || 1, 2);
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
      // The exhibit: right of centre, with the label level with it across the gap on the left.
      p.r = Math.min(w, h) * 0.33;
      p.x = w * 0.66;
      p.y = h * 0.5;
    } else {
      // Phones and tablets: bigger than the screen can hold, running off the right edge above the label. Capped
      // by the height, so a short phone's disc still ends about where the label begins. Far enough right and low
      // enough that its curve leaves the top-left corner clear for the readout.
      p.r = Math.min(w * 0.62, h * 0.29);
      p.x = w * 0.76;
      p.y = h * 0.4;
    }
    // Small glyphs, so craters, coastlines and sunspots read as detail rather than noise.
    p.font = clamp(p.r / 20, 6, 11) * SKY_GLYPH[skyQuality];
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
    return Math.round(clamp((this.w * this.h) / density, 90, 460) * SKY_STARS[skyQuality]);
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
    this.origin = { left: origin.left, top: origin.top };
    // The canvas can be taller than the window (phones scroll the home page), so centre on what's visible.
    this.view = this.variant === "emblem" ? { x: this.hero.x, y: this.hero.y } : { x: window.innerWidth / 2 - origin.left, y: window.innerHeight / 2 - origin.top };
    this.boxes = Array.from(document.querySelectorAll(AVOID), (el) => el.getBoundingClientRect())
      .filter((b) => b.width > 0 && b.height > 0)
      .map((b) => ({ left: b.left - origin.left - 14, top: b.top - origin.top - 10, right: b.right - origin.left + 14, bottom: b.bottom - origin.top + 10 }));
  }

  private dim(x: number, y: number) {
    if (this.scene === "deep") return 1;
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

  /** Two slow seconds step the quality down. A long gap is a hidden tab or a page change, not a slow device. */
  private watch(ms: number) {
    if (this.variant === "emblem" || ms > 200) return;
    // Another page's sky may have stepped down already.
    if (this.quality !== skyQuality) {
      this.quality = skyQuality;
      this.resize();
    }
    if (skyQuality >= 3) return;
    this.slowFor = ms > SLOW_FRAME_MS ? this.slowFor + ms : Math.max(0, this.slowFor - ms * 2);
    if (this.slowFor < 2000) return;
    this.slowFor = 0;
    this.quality = ++skyQuality;
    this.resize();
  }

  private frame = (now: number) => {
    this.watch(now - this.last);
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
    if (hero && this.charge > 0.04 && !this.turn) {
      detail = `hyperdrive · ${Math.round(this.charge * 100)}%`;
    } else if (hero && this.scene === "deep") {
      detail = `milky way · ${this.cam.z.toFixed(1)}×`;
    } else if (hero && this.scene === "earth") {
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
    if (this.turn && this.time - this.turn.start > this.turn.dur) {
      this.turn = null;
      this.matchSurfaces(null);
    }
    this.boil += dt * (1 + this.hov * 2.5);
    // The shutter opens slowly and closes quickly.
    this.trail += (exposure.k - this.trail) * dt * (exposure.k > this.trail ? 4 : 7);
    this.pole = { x: exposure.x - this.origin.left, y: exposure.y - this.origin.top };
    this.charge = this.charging.start ? clamp((performance.now() - this.charging.start) / CHARGE_MS, 0, 1) : 0;
    // In hyperdrive the stars stream outward, fastest at the jump's midpoint.
    if (this.turn && (this.turn.to === "deep" || this.turn.from === "deep")) this.warpPos += dt * (0.15 + 2.2 * this.hyperIntensity((this.time - this.turn.start) / this.turn.dur));
    // A flung camera drifts on and slows; a held one stops. It never strays far past the galaxy's edge.
    const cam = this.cam;
    if (this.grabs.size) {
      cam.vx *= Math.exp(-10 * dt);
      cam.vy *= Math.exp(-10 * dt);
    } else {
      cam.x += cam.vx * dt;
      cam.y += cam.vy * dt;
      cam.vx *= Math.exp(-2.5 * dt);
      cam.vy *= Math.exp(-2.5 * dt);
    }
    // Asked to show something, the camera glides there on its own, until someone takes hold of it.
    if (this.camAim && !this.grabs.size) {
      const z = this.camAim === "sun" ? SUN_ZOOM : 1;
      const sun = this.sunOffset(this.galaxyRadius() * z);
      const tx = this.camAim === "sun" ? -sun.x : 0, ty = this.camAim === "sun" ? -sun.y : 0;
      const k = 1 - Math.exp(-2.6 * dt);
      cam.x += (tx - cam.x) * k;
      cam.y += (ty - cam.y) * k;
      cam.z += (z - cam.z) * k;
      cam.vx = cam.vy = 0;
    }
    // An answer that has finished putting itself away is gone; the camera, back on the whole galaxy, is let go.
    if (this.navClosing >= 0 && this.time - this.navClosing > NAV_FADE) {
      this.galaxyNav = null;
      this.navClosing = -1;
    }
    if (this.camAim === "whole" && !this.galaxyNav && Math.abs(cam.z - 1) < 0.01 && Math.hypot(cam.x, cam.y) < 1) this.camAim = null;
    if (this.pass?.dir === "in" && performance.now() / 1000 - this.pass.start > SETTLE_SECONDS) this.pass = null;
    const reach = this.galaxyRadius() * 1.1 * Math.max(1, cam.z);
    cam.x = clamp(cam.x, -reach, reach);
    cam.y = clamp(cam.y, -reach, reach);
    // Spots form, drift round with the sun, and fade; new ones keep the count up.
    for (let i = this.spots.length - 1; i >= 0; i--) if (this.time - this.spots[i].born > this.spots[i].life) this.spots.splice(i, 1);
    if (this.spots.length < SPOTS && Math.random() < dt / 6) this.spots.push(this.makeSpot(this.time));

    this.sunFlash = Math.max(0, this.sunFlash - dt * 1.4);
    // Eases rather than switches, so the disc doesn't jump in weight as an eclipse begins or ends.
    this.inked += ((this.turn ? 0 : 1) - this.inked) * Math.min(1, dt * 4);
    for (let i = this.shocks.length - 1; i >= 0; i--) if ((this.shocks[i].age += dt) > SHOCK_LIFE) this.shocks.splice(i, 1);
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
    this.stepDrifter(dt);
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
    this.hits = [];
    this.labelBoxes = [];
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const hero = this.variant !== "quiet";
    const full = this.variant === "full";
    this.moonAt = { x: this.hero.x, y: this.hero.y };
    // A page change moves the whole sky; how far it moved a moment ago gives the streaks.
    const now = performance.now() / 1000;
    const fx = this.passFx(now);
    if (fx) {
      const before = this.passFx(now - 1 / 30)!;
      this.streak = { x: (fx.dx - before.dx) * 1.6, y: (fx.dy - before.dy) * 1.6 };
      this.passShift = fx.scale === 1 ? { x: fx.dx, y: fx.dy } : { x: 0, y: 0 };
      const ox = full ? this.hero.x : w / 2, oy = full ? this.hero.y : h / 2;
      ctx.save();
      ctx.translate(ox + fx.dx, oy + fx.dy);
      ctx.scale(fx.scale, fx.scale);
      ctx.translate(-ox, -oy);
    } else {
      this.streak = { x: 0, y: 0 };
      this.passShift = { x: 0, y: 0 };
    }
    if (this.turn) {
      const k = clamp((this.time - this.turn.start) / this.turn.dur, 0, 1);
      if (this.turn.from === "deep" || this.turn.to === "deep") this.drawHyperdrive(k);
      else if (this.turn.from === "earth" || this.turn.to === "earth") this.drawZoom(k);
      else this.drawEclipse(k);
    } else if (this.scene === "deep") {
      this.use(DARK, 1);
      this.drawStars("deep");
      const c = this.galaxyCentre();
      this.drawGalaxy(c.x, c.y, this.galaxyRadius() * (this.variant === "emblem" ? 1 : this.cam.z), 1);
    } else if (this.scene === "earth") {
      this.use(DARK, 0.75);
      this.drawStars("earth");
      if (hero) this.drawEarthScene();
      if (full) this.drawDrifter();
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
      if (full) this.drawDrifter();
      this.drawMeteors();
      this.drawComets();
    } else {
      if (full) this.drawDaySky(1);
      this.use(LIGHT, 1);
      if (!hero) this.drawPlateCorner();
      this.drawStars("day");
      if (full) this.drawAlmanacRings(this.hero.x, this.hero.y, this.hero.r, this.inked);
      if (full) this.drawSolarWind();
      if (hero) {
        this.drawSun(null, 1);
        this.drawFlares();
      }
      if (full) this.drawDayComet();
      if (full) this.drawDrifter();
    }
    if (full && !this.turn) this.drawDelivery();
    if (full && !this.turn && this.charge > 0) this.drawCharge();
    if (fx) {
      ctx.restore();
      if (fx.glare > 0.01) {
        ctx.globalAlpha = Math.min(1, fx.glare);
        ctx.fillStyle = css(GLARE);
        ctx.fillRect(0, 0, w, h);
      }
    }
    ctx.globalAlpha = 1;
    this.sceneAlpha = 1;
  }

  /** A page change is starting: the sky begins to carry you out, in its own way. */
  private onDepart = () => {
    if (this.variant === "emblem" || this.reduced.matches) return;
    this.endCharge();
    // Mid-eclipse the sky is busy and can't move as well. It fades out with the page instead, and the next sky has
    // no motion to carry on from.
    if (this.turn || this.scene === "deep") {
      const root = document.documentElement;
      delete root.dataset.skyArrive;
      root.classList.add("sky-fade");
      return;
    }
    this.pass = { dir: "out", start: performance.now() / 1000 };
  };

  /** The next page never came: the sky comes back from wherever the move had taken it. */
  private onDepartCancel = () => {
    if (this.pass) this.pass = { dir: "in", start: performance.now() / 1000 };
  };

  /**
   * Where the sky is during a page change, at wall-clock time `at` (seconds): how far it has moved and zoomed, and how much glare covers
   * it. Leaving, the move speeds up as it goes; arriving, it carries on from where the last page left off and slows
   * to rest (r is how much of it is left).
   */
  private passFx(at: number) {
    const p = this.pass;
    if (!p) return null;
    const k = clamp((at - p.start) / (p.dir === "out" ? DEPART_SECONDS : SETTLE_SECONDS), 0, 1);
    const e = k * k, r = (1 - k) ** 3;
    const w = this.w, h = window.innerHeight;
    const home = this.variant === "full";
    const fx = { dx: 0, dy: 0, scale: 1, glare: 0 };
    const sc = this.scene;
    if (p.dir === "out" && home) {
      // Leaving the sky. Night: the camera tilts up and the moon sets. Day: you look into the sun until it
      // whites out. Earth: the camera swings round it and it slides away to the side.
      if (sc === "night") fx.dy = e * h * 0.9;
      else if (sc === "day") { fx.scale = 1 + 2.4 * e; fx.glare = smoothstep(0.3, 1, k); }
      else fx.dx = -e * w * 0.8;
    } else if (p.dir === "in" && !home) {
      // Arriving at a page: the stars are still streaming down, the glare still fading, or the sky still swinging.
      if (sc === "night") fx.dy = -r * h * 0.35;
      else if (sc === "day") { fx.glare = r; fx.scale = 1 + 0.15 * r; }
      else fx.dx = r * w * 0.3;
    } else if (p.dir === "out") {
      // Leaving a page for the sky: everything runs the other way.
      if (sc === "night") fx.dy = -e * h * 0.5;
      else if (sc === "day") { fx.glare = smoothstep(0.3, 1, k); fx.scale = 1 + 0.3 * e; }
      else fx.dx = e * w * 0.5;
    } else {
      // Home again: the moon rises, the sun comes up out of the glare, Earth swings back into view.
      if (sc === "night") fx.dy = r * h * 0.7;
      else if (sc === "day") { fx.glare = r; fx.scale = 1 + 0.8 * r; }
      else fx.dx = -r * w * 0.7;
    }
    return fx;
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
      const sky = css(mix(DARK_BG, LIGHT_BG, st.s));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      this.matchSurfaces(sky);
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
   * The nav and the label are solid, so through a theme change they take the colour the sky has this frame, and read
   * as part of it rather than as dark or pale boxes. Set on the home page, so it goes when the page does.
   */
  private matchSurfaces(sky: string | null) {
    if (this.variant !== "full" || sky === this.surface) return;
    this.surface = sky;
    const home = this.canvas.parentElement;
    if (sky) home?.style.setProperty("--surface", sky);
    else home?.style.removeProperty("--surface");
  }

  /**
   * Page text has one colour, so it can't fade with the sky. It switches at the moment the daylight crosses
   * halfway. This runs inside the theme change, before styles recalculate, so the CSS transition picks it up.
   */
  private syncTextColour() {
    if (this.turn && (zooms(this.turn.from) || zooms(this.turn.to))) {
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
        if (scene === "deep") {
          // In the galaxy the camera moves, and nearer stars slide past faster.
          x = ((((x + 10 + this.cam.x * s.z * 0.12) % (this.w + 20)) + this.w + 20) % (this.w + 20)) - 10;
          y = (((y + this.cam.y * s.z * 0.12) % this.h) + this.h) % this.h;
        }
      }
      // Charging for hyperdrive: the stars strain toward the held disc, nearer ones more.
      const strain = this.charge * this.charge * (this.variant === "full" && !this.turn ? 1 : 0);
      let sdx = 0, sdy = 0;
      if (strain > 0.001) {
        const dx = hero.x - x, dy = hero.y - y, d = Math.hypot(dx, dy) || 1;
        sdx = dx / d;
        sdy = dy / d;
        x += sdx * strain * 14 * s.z;
        y += sdy * strain * 14 * s.z;
      }
      if (this.passShift.x || this.passShift.y) {
        // A page change slides the sky (the canvas is moved), but the stars stream on round the screen at their
        // own depth, so the moon can set without leaving an empty sky behind it.
        const k = 0.5 + 0.5 * s.z;
        const wx = (((x + this.passShift.x * k) % this.w) + this.w) % this.w;
        const wy = (((y + this.passShift.y * k) % this.h) + this.h) % this.h;
        x = wx - this.passShift.x;
        y = wy - this.passShift.y;
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
      if (!quiet && !this.turn && scene !== "deep") {
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
      const base = (0.18 + s.z * 0.62) * (quiet ? 0.55 : 1) * (day ? 0.85 : 1);
      if (this.trail > 0.01 && this.variant !== "emblem") {
        // A long exposure: each star has wheeled a little way round the pole (the toggle being held), and the
        // arc it swept stays on the plate, longer the further out it is.
        const ox = x - this.pole.x, oy = y - this.pole.y;
        const sweep = this.trail * 0.2;
        const n = clamp(Math.round((Math.hypot(ox, oy) * sweep) / 6), 1, 24);
        for (let j = 1; j <= n; j++) {
          const a = -sweep * (j / n);
          const c = Math.cos(a), sn = Math.sin(a);
          this.glyph(".", this.pole.x + ox * c - oy * sn, this.pole.y + ox * sn + oy * c, color, base * (1 - j / (n + 1)) * this.trail * 0.8);
        }
      }
      if (strain > 0.05) {
        // A short streak behind each star, pointing at the disc.
        const len = strain * 26 * s.z;
        const lg = lineGlyph(sdx, sdy);
        for (let j = 1; j <= 3; j++) this.glyph(lg, x - sdx * len * (j / 3), y - sdy * len * (j / 3), color, base * strain * (1 - j / 4));
      }
      const sl = Math.hypot(this.streak.x, this.streak.y) * (0.4 + 0.6 * s.z);
      if (sl > 3) {
        // Mid page change: each star drawn back along the way the sky is moving, nearer ones longer.
        const n = clamp(Math.floor(sl / 7), 1, 10), lg = lineGlyph(this.streak.x, this.streak.y);
        const k = (0.4 + 0.6 * s.z) / n;
        for (let j = 1; j <= n; j++) this.glyph(lg, x - this.streak.x * k * j, y - this.streak.y * k * j, color, base * (1 - j / (n + 1)) * 0.7);
      }
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
    // By day the sun is printed: a solid warm body (gold core, vermilion limb) with dark ink over it, so it holds its
    // own against the paper. The body stays light enough for the name to read where it overlaps on phones. The
    // eclipse keeps its original, softer look.
    const ink = this.inked;
    if (ink > 0.01) {
      const ctx = this.ctx;
      const body = ctx.createRadialGradient(pl.x - r * 0.25, pl.y - r * 0.25, r * 0.1, pl.x, pl.y, r);
      body.addColorStop(0, "rgba(255, 214, 110, 0.96)");
      body.addColorStop(0.6, "rgba(244, 150, 58, 0.94)");
      body.addColorStop(1, "rgba(206, 74, 36, 0.92)");
      ctx.globalAlpha = this.sceneAlpha * this.fade * ink;
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
        // In ink the limb is drawn heavier, the way an engraver darkens the edge of a sphere; a flare lights the side it left from.
        const depth = Math.sqrt(nz);
        const b = clamp(0.12 + 0.62 * depth + (gran - 0.5) * 0.45 + (1 - depth) * 0.42 * ink + flash * (0.12 + ink * 0.1 + toward * (0.45 + ink * 0.3)), 0, 1);
        const g = RAMP[clamp(Math.round(b * (RAMP.length - 1)), 1, RAMP.length - 1)];
        // Gold at the core, orange through the disc, deep red at the limb; bright granules lean gold.
        const edge = smoothstep(0, 0.55, depth);
        const hot = smoothstep(0.55, 1, depth) * 0.5 + clamp(gran - 0.6, 0, 1) * 0.5;
        const soft = mix(mix(SUN_LIMB, SUN_MID, edge), SUN_CORE, hot);
        const col = ink > 0.01 ? mix(soft, mix(mix(INK_LIMB, INK_MID, edge), INK_CORE, hot), ink) : soft;
        this.glyph(g, gx, gy, col, 0.35 + 0.55 * b + ink * (0.3 - 0.1 * b));
      }
    }
    if (rays < 0.02) return;
    this.drawSunGlow(occ, rays);
    // A dotted rim, then rays that flicker in and out of length and stretch while the sun flares.
    const rimN = Math.round((TAU * r * 1.08) / (cw * 1.3));
    for (let i = 0; i < rimN; i++) {
      const a = (i / rimN) * TAU;
      const x = pl.x + Math.cos(a) * r * 1.08, y = pl.y + Math.sin(a) * r * 1.08;
      if (!hidden(x, y)) this.glyph("·", x, y, ink > 0.5 ? INK_MID : pal.warm, (0.5 + 0.4 * ink) * rays);
    }
    // The printed rays fade in as the eclipse's plain ones fade out.
    if (ink > 0.01) this.drawSplendour(ink * rays);
    if (ink > 0.99) return;
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + t * 0.03;
      const long = i % 2 === 0;
      // Rays stretch toward a nearby cursor.
      const reachOut = 1 + this.hov * 0.9 * Math.max(0, Math.cos(a - this.hovAngle)) ** 4;
      const len = r * (long ? 0.42 : 0.22) * (0.6 + 0.4 * noise(i * 1.7, this.boil * 0.9, 8)) * (1 + flash * 0.7) * reachOut;
      const g = lineGlyph(Math.cos(a), Math.sin(a));
      for (let q = r * 1.18; q < r * 1.18 + len; q += cw * 1.25) {
        const k = (q - r * 1.18) / len;
        const x = pl.x + Math.cos(a) * q, y = pl.y + Math.sin(a) * q;
        if (!hidden(x, y)) this.glyph(g, x, y, pal.warm, (1 - k) * 0.75 * rays * (1 - ink));
      }
    }
  }

  /**
   * The sun in splendour, as old engravings draw it: tapered straight rays turn and turn about with wavy ones. They
   * still flicker in length, stretch toward a nearby cursor, and leap when the sun flares.
   */
  private drawSplendour(alpha: number) {
    const pl = this.hero;
    const { cw, r } = pl;
    const n = 12;
    const start = r * 1.16;
    const step = cw * 1.8;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * TAU + this.time * 0.03;
      const dx = Math.cos(a), dy = Math.sin(a);
      const wavy = i % 2 === 1;
      const reachOut = 1 + this.hov * 0.9 * Math.max(0, Math.cos(a - this.hovAngle)) ** 4;
      const len = r * (wavy ? 0.38 : 0.68) * (0.72 + 0.28 * noise(i * 1.7, this.boil * 0.9, 8)) * (1 + this.sunFlash * 1.1) * reachOut;
      const g = lineGlyph(dx, dy);
      for (let q = 0; q < len; q += step) {
        const k = q / len;
        const x = pl.x + dx * (start + q), y = pl.y + dy * (start + q);
        const col = mix(INK_CORE, INK_LIMB, k);
        if (wavy) {
          const sway = Math.sin(q * 0.16 + this.boil * 1.2 + i) * cw * 1.1;
          this.glyph("~", x - dy * sway, y + dx * sway, col, (1 - k * 0.8) * 0.85 * alpha);
          continue;
        }
        this.glyph(g, x, y, col, (1 - k * 0.7) * alpha);
        // Two flanking strands make the root of the ray thick, and run out to leave it a point.
        if (k < 0.34) {
          const side = cw * 1.1 * (1 - k / 0.34);
          this.glyph(g, x - dy * side, y + dx * side, col, 0.8 * alpha);
          this.glyph(g, x + dy * side, y - dx * side, col, 0.8 * alpha);
        }
      }
    }
  }

  /** Ruled rings round the sun, with ticks every 30°, like the scales on an almanac's plate. */
  private drawAlmanacRings(cx: number, cy: number, r: number, alpha: number) {
    if (alpha < 0.02) return;
    const { w, h } = this;
    const turn = this.time * -0.006;
    this.ctx.font = `9px ${this.family}`;
    const seen = (x: number, y: number) => x > -10 && y > -10 && x < w + 10 && y < h + 10;
    for (const [ring, gap] of [[1.98, 24], [2.86, 32]]) {
      const rad = r * ring;
      const dots = Math.round((TAU * rad) / gap);
      for (let i = 0; i < dots; i++) {
        const a = (i / dots) * TAU + turn;
        const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
        if (seen(x, y)) this.glyph("·", x, y, this.palette.orbit, 0.62 * alpha);
      }
    }
    const rad = r * 1.98;
    for (let d = 0; d < 360; d += 30) {
      const a = (d / 360) * TAU + turn;
      const dx = Math.cos(a), dy = Math.sin(a);
      if (!seen(cx + dx * rad, cy + dy * rad)) continue;
      this.glyph(lineGlyph(dx, dy), cx + dx * (rad + 6), cy + dy * (rad + 6), INK_MID, 0.8 * alpha);
    }
  }

  /** Inner pages: a corner of the same plate looks in from the top right, faint enough to read a page over. */
  private drawPlateCorner() {
    const { ctx, w, h } = this;
    const r = Math.min(w, h) * 0.3;
    const cx = w - r * 0.28, cy = -r * 0.28;
    const glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 2.8);
    glow.addColorStop(0, "rgba(244, 164, 78, 0.3)");
    glow.addColorStop(1, "rgba(244, 164, 78, 0)");
    ctx.globalAlpha = this.sceneAlpha * this.fade;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.font = `10px ${this.family}`;
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * TAU + this.time * 0.012;
      const dx = Math.cos(a), dy = Math.sin(a);
      if (cx + dx * r * 1.1 < -10 || cy + dy * r * 1.1 > h + 10 || cy + dy * r * 1.8 < 0) continue;
      const wavy = i % 2 === 1;
      const len = r * (wavy ? 0.34 : 0.62);
      const g = wavy ? "~" : lineGlyph(dx, dy);
      for (let q = 0; q < len; q += 15) {
        this.glyph(g, cx + dx * (r * 1.12 + q), cy + dy * (r * 1.12 + q), INK_MID, (1 - q / len) * 0.42);
      }
    }
    // Only the quarter that's on the page.
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI / 2 + (i / 12) * (Math.PI / 2);
      this.glyph("·", cx + Math.cos(a) * r, cy + Math.sin(a) * r, INK_MID, 0.5);
    }
    this.drawAlmanacRings(cx, cy, r, 0.5);
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
    // The paper tones toward its edges, as an old page does. Text sits on this too, so it stays slight (globals.css
    // sets the day's inks to hold their contrast at this depth).
    const edges = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.56);
    edges.addColorStop(0, "rgba(150, 104, 58, 0)");
    edges.addColorStop(1, "rgba(150, 104, 58, 0.08)");
    ctx.fillStyle = edges;
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(pl.x, pl.y, pl.r * 0.6, pl.x, pl.y, pl.r * 3.4);
    glow.addColorStop(0, "rgba(244, 164, 78, 0.55)");
    glow.addColorStop(0.35, "rgba(244, 170, 88, 0.2)");
    glow.addColorStop(1, "rgba(246, 186, 96, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  /** The sun's glow: scattered warm marks that thin with distance and shimmer like heat haze; in ink, radial hatching. */
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
        if (hash(ix, iy, 12) > 0.14 + fall * 0.5) continue;
        const hatched = this.inked > 0.5;
        const g = hatched ? (fall > 0.16 ? lineGlyph(gx - pl.x, gy - pl.y) : "·") : fall > 0.6 ? ":" : fall > 0.3 ? "·" : ".";
        const col = hatched ? mix(INK_LIMB, INK_MID, fall) : mix(SUN_MID, SUN_CORE, fall);
        this.glyph(g, gx, gy, col, (0.34 + 0.56 * this.inked) * fall * rays * (1 + this.hov * 0.5));
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
      this.glyph(g, x, y, mix(INK_MID, this.palette.orbit, ph), 0.68 * Math.sin(Math.PI * ph) ** 1.2);
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
   * Every so often something drifts across the sky (sky/drifters.ts), through the widest band of it the page leaves
   * clear, in front of the disc if that's where the band runs. Clicked, it comes to a stop and says how to trigger its
   * secret, whether you've found it or not, then powers away.
   */
  private spawnDrifter() {
    if (this.scene === "deep") return;
    const { w } = this;
    const cast = DRIFTERS[this.scene];
    const pool = (Object.keys(cast) as SecretId[]).filter((id) => id !== this.lastDrifter);
    const id = pool[Math.floor(Math.random() * pool.length)];
    const sprite = cast[id]!;
    this.lastDrifter = id;
    const { scale } = this.drifterSize();
    const off = Math.hypot(sprite.reach, sprite.tall) * scale + 20;
    const [top, bottom] = this.openBand();
    const room = Math.max(0, (bottom - top) / 2 - sprite.tall * scale);
    const mid = (top + bottom) / 2;
    let a: [number, number] = [-off, mid + rand(-room, room)];
    let b: [number, number] = [w + off, mid + rand(-room, room)];
    if (Math.random() < 0.5) [a, b] = [b, a];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    // Things under power are in a hurry; things on momentum aren't.
    const dur = { coast: rand(26, 34), cruise: rand(13, 19), glide: rand(22, 28), hover: rand(18, 24) }[sprite.gait];
    this.drifter = {
      x: a[0], y: a[1], vx: dx / dur, vy: dy / dur, rot: sprite.face === "spin" ? rand(-0.3, 0.3) : 0,
      spin: sprite.face === "spin" ? rand(0.05, 0.12) * (Math.random() < 0.5 ? -1 : 1) : 0,
      waveAt: -1, fled: false, sprite, line: sprite.says, phase: rand(0, TAU), sayUntil: -1, pace: 1,
    };
  }

  /** Moves the drifter on, the way its kind moves. */
  private flyDrifter(a: Drifter, dt: number) {
    const { gait, face } = a.sprite;
    const t = this.time + a.phase * 9;
    const stopped = a.waveAt >= 0 && !a.fled;
    let aim = 1, ease = 1.6;
    if (a.fled) { aim = 7; ease = 1.5; }
    else if (stopped) { aim = 0.03; ease = 2.6; }
    else if (gait === "hover") { aim = Math.sin(t * 0.8) > -0.1 ? 1.9 : 0.1; ease = 3.2; }
    else if (gait === "glide") aim = 1 + 0.35 * Math.sin(t * 0.35);
    else if (gait === "cruise") aim = 1 + 0.12 * Math.sin(t * 0.5);
    a.pace += (aim - a.pace) * (1 - Math.exp(-dt * ease));
    // Off the straight line: a long curve under power, a slow wander otherwise. Enough to feel, not enough to leave the band.
    const curve = { coast: Math.cos(t * 0.21) * 3, cruise: Math.cos(t * 0.33) * 15, glide: Math.cos(t * 0.27) * 10, hover: Math.cos(t * 1.1) * 14 }[gait];
    const climb = a.vy * a.pace + curve * Math.min(1, a.pace + 0.15);
    a.x += a.vx * a.pace * dt;
    a.y += climb * dt;
    const turn = 1 - Math.exp(-dt * 2.2);
    if (face === "spin") a.rot += a.spin * dt;
    else if (face === "path") a.rot += ((Math.atan2(climb, Math.abs(a.vx * a.pace) + 20) * Math.sign(a.vx)) - a.rot) * turn;
    else if (face === "bank") a.rot += (Math.sign(a.vx) * (a.pace - 0.7) * 0.2 - a.rot) * turn;
    else if (face === "rock") a.rot = Math.sin(t * 0.42) * 0.14;
    else if (face === "sun") {
      const [lx, ly] = this.drifterLight();
      a.rot += (Math.atan2(ly - a.y, lx - a.x) - a.rot) * turn;
    }
  }

  /** Where the light on a drifter comes from: the disc, or at Earth, a sun off beyond the top left. */
  private drifterLight(): [number, number] {
    return this.scene === "earth" ? [-this.w, -this.h] : [this.hero.x, this.hero.y];
  }

  /** How big a drifter is drawn here, and the grid it's drawn on. */
  private drifterSize() {
    return this.w >= 1024 ? { scale: 112, font: 7, cw: 4.2, ch: 7.4 } : this.w >= 640 ? { scale: 96, font: 6.5, cw: 3.9, ch: 6.9 } : { scale: 76, font: 6, cw: 3.6, ch: 6.4 };
  }

  /** The tallest band of sky no wide block of the page's content runs through. Narrow things, like a side quote, don't count. */
  private openBand(): [number, number] {
    const blocks = this.boxes.filter((b) => b.right - b.left > this.w * 0.25).sort((p, q) => p.top - q.top);
    let best: [number, number] = [0, 0];
    let from = 0;
    for (const b of blocks) {
      if (b.top - from > best[1] - best[0]) best = [from, b.top];
      from = Math.max(from, b.bottom);
    }
    if (this.h - from > best[1] - best[0]) best = [from, this.h];
    return best;
  }

  private stepDrifter(dt: number) {
    if (this.variant !== "full") return;
    if (!this.drifter && !this.turn && this.scene !== "deep" && (this.nextDrifter -= dt) <= 0) this.spawnDrifter();
    const a = this.drifter;
    if (a) {
      this.flyDrifter(a, dt);
      // After stopping for you it powers away the way it was going; whatever was turning turns harder.
      if (a.waveAt >= 0 && !a.fled && this.time - a.waveAt > WAVE_SECONDS) {
        a.fled = true;
        if (a.spin) a.spin = Math.sign(a.spin) * 1.6;
      }
      const margin = Math.hypot(a.sprite.reach, a.sprite.tall) * this.drifterSize().scale + 30;
      const gone = (a.x < -margin && a.vx < 0) || (a.x > this.w + margin && a.vx > 0);
      if (gone) {
        this.drifter = null;
        this.nextDrifter = rand(6, 14);
      }
    }
    this.placeSaying();
    // The pointer becomes a hand over it, even when it drifts under a still cursor.
    const over = this.pointer.active && this.drifterHit(this.pointer.x, this.pointer.y);
    if (over !== this.overDrifter) {
      this.overDrifter = over;
      if (this.canvas.parentElement) this.canvas.parentElement.style.cursor = over ? "pointer" : "";
    }
  }

  private drifterHit(x: number, y: number) {
    const a = this.drifter;
    if (!a || a.fled || this.turn || this.scene === "deep") return false;
    const { scale } = this.drifterSize();
    return Math.abs(x - a.x) < Math.max(30, a.sprite.reach * scale + 12) && Math.abs(y - a.y) < Math.max(30, a.sprite.tall * scale + 12);
  }

  /** The drifter stops for a click, and says its piece for as long as it's stopped. */
  private stopDrifter(a: Drifter) {
    if (a.waveAt >= 0) return;
    a.waveAt = this.time;
    a.sayUntil = this.time + WAVE_SECONDS;
    this.said = null;
  }

  private drawDrifter() {
    const a = this.drifter;
    if (!a) return;
    const { ctx } = this;
    const pal = this.palette;
    const size = this.drifterSize();
    const backing = css(bgOf(this.scene));
    const fade = pal.alpha * this.sceneAlpha * this.fade;
    const [lightX, lightY] = this.drifterLight();
    const { gait, face } = a.sprite;
    ctx.font = `${size.font}px ${this.family}`;
    paintDrifter(a.sprite, {
      x: a.x, y: a.y + (gait === "hover" ? Math.sin(this.time * 2.1 + a.phase) * 4 : gait === "glide" ? Math.sin(this.time * 0.8 + a.phase) * 6 : 0), scale: size.scale, cw: size.cw, ch: size.ch,
      rot: a.rot, left: a.vx < 0 && face === "path", lightX, lightY, t: this.time + a.phase, wave: a.waveAt >= 0 && !a.fled ? 1 : 0, power: clamp(a.pace, 0, 1.3), inks: pal,
    }, (x, y, glyph, color, alpha, solid) => {
      // A cut-out behind anything solid, so it holds its shape in front of the disc. Fire and glow stay see-through.
      if (solid && this.dim(x, y) === 1) {
        ctx.globalAlpha = 0.86 * fade;
        ctx.fillStyle = backing;
        ctx.fillRect(x - size.cw / 2, y - size.ch / 2, size.cw, size.ch);
      }
      this.glyph(glyph, x, y, color, alpha);
    });
  }

  /** The card with what it's saying: on the page, above everything but the nav, so it can always be read. */
  private placeSaying() {
    const a = this.drifter;
    const showing = !!a && !a.fled && !this.turn && this.scene !== "deep" && a.sayUntil >= 0 && this.time < a.sayUntil;
    if (!showing || !a) {
      this.saying?.classList.remove("on");
      return;
    }
    let el = this.saying;
    if (!el) {
      el = this.saying = document.createElement("p");
      el.className = "drifter-say";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = '<span class="voice"></span> <span class="how"><span class="typed"></span><span class="rest"></span></span>';
      this.canvas.parentElement?.append(el);
    }
    if (this.said !== a.line) {
      this.said = a.line;
      this.saidAt = this.time;
      el.querySelector(".voice")!.textContent = a.line.voice;
      this.saidTyped = -1;
    }
    // The instruction types itself out; the rest of it already holds its space, so the card never changes size.
    const typed = Math.min(a.line.how.length, Math.floor(Math.max(0, this.time - this.saidAt - 0.35) * SAY_RATE));
    if (typed !== this.saidTyped) {
      this.saidTyped = typed;
      el.querySelector(".typed")!.textContent = a.line.how.slice(0, typed);
      el.querySelector(".rest")!.textContent = a.line.how.slice(typed);
    }
    const bw = el.offsetWidth, bh = el.offsetHeight;
    const { scale } = this.drifterSize();
    const x = clamp(a.x - bw / 2, 12, Math.max(12, this.w - bw - 12));
    const above = a.y - a.sprite.tall * scale - bh - 12;
    const under = above < 60;
    const y = under ? a.y + a.sprite.tall * scale + 12 : above;
    el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    el.style.setProperty("--tail", `${clamp(a.x - x, 18, bw - 18)}px`);
    el.classList.toggle("under", under);
    el.classList.add("on");
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
    if (this.variant !== "emblem") {
      ctx.globalAlpha = 1;
      const sky = css(mix(bgOf(turn.from), bgOf(turn.to), e));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      this.matchSurfaces(sky);
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

  /**
   * How flat the galaxy's disc looks. Wide screens see it tilted, a long ellipse that suits them; a tall phone sees
   * it more face-on, so the spiral fills the portrait frame instead of lying in a thin band across the middle.
   */
  private galaxySquash() {
    if (this.variant === "emblem") return GALAXY_SQUASH_WIDE;
    return clamp((window.innerHeight / Math.max(1, this.w)) * 0.5, GALAXY_SQUASH_WIDE, 0.92);
  }

  /** The galaxy's radius at a zoom of 1: most of the window, or most of the emblem's frame. */
  private galaxyRadius() {
    if (this.variant === "emblem") return this.hero.r * 1.25;
    return Math.min(this.w * 0.48, window.innerHeight * 0.44);
  }

  private galaxyCentre() {
    if (this.variant === "emblem") return { x: this.view.x, y: this.view.y };
    return { x: this.view.x + this.cam.x, y: this.view.y + this.cam.y };
  }

  /** A point on one of the two arms, r out from the centre (0 → 1), as an offset for a galaxy of radius R. */
  private armOffset(R: number, r: number, arm: number) {
    // On the arm: the spiral's phase is zero where θ = ln(r) / b, plus however far the disc has turned.
    const th = Math.log(r + 0.02) / ARM_PITCH + (this.time * TAU) / 400 + arm * Math.PI;
    const u = Math.cos(th) * r * R, v = Math.sin(th) * r * R * this.galaxySquash();
    const c = Math.cos(GALAXY_TURN), s = Math.sin(GALAXY_TURN);
    return { x: u * c - v * s, y: u * s + v * c };
  }

  /** Where the sun is in the galaxy, as an offset from its centre for a galaxy of radius R. */
  private sunOffset(R: number) {
    return this.armOffset(R, SUN_ORBIT, 0);
  }

  /** The nav's "projects" or "about" while in the galaxy. Asked again, it's put away. */
  private onNav = (e: Event) => {
    // Asked mid-jump, it's simply waiting when you arrive.
    if (this.scene !== "deep") return;
    const kind = (e as CustomEvent<NavTarget>).detail;
    if (this.galaxyNav === kind && this.navClosing < 0) return this.closeNav();
    this.galaxyNav = kind;
    // Asked mid-jump, the answer starts once you've arrived, so the glimmer isn't spent during the hyperdrive.
    this.navAt = this.turn ? this.turn.start + this.turn.dur : this.time;
    this.navClosing = -1;
    this.camAim = kind === "projects" ? "whole" : "sun";
    if (!this.raf) this.render();
  };

  /** Puts the galaxy's answer away gently, and glides the camera back out to the whole galaxy. */
  private closeNav() {
    if (!this.galaxyNav || this.navClosing >= 0) return;
    this.camAim = "whole";
    if (this.reduced.matches || !this.raf) {
      this.galaxyNav = null;
      this.render();
      return;
    }
    this.navClosing = this.time;
  }

  /** How much of the galaxy's answer is left as it puts itself away, 1 → 0. */
  private navOut() {
    return this.navClosing < 0 ? 1 : 1 - smoothstep(0, NAV_FADE, this.time - this.navClosing);
  }

  /** A label you can tap: right of its point if there's room, else left, nudged down clear of labels already placed. */
  private tapLabel(text: string, x: number, y: number, href: string, color: Rgb, alpha: number) {
    const { ctx } = this;
    ctx.font = `11px ${this.family}`;
    const tw = ctx.measureText(text).width;
    const right = x + 14 + tw < this.w - 12;
    const lx = clamp(right ? x + 14 : x - 14 - tw, 8, this.w - tw - 8);
    const clash = (ly: number) => this.labelBoxes.some((b) => lx - 6 < b.x + b.w && lx + tw + 6 > b.x && ly - 9 < b.y + b.h && ly + 21 > b.y);
    for (let tries = 0; tries < 4 && clash(y); tries++) y += 32;
    this.labelBoxes.push({ x: lx - 6, y: y - 9, w: tw + 12, h: 30 });
    // A dark backing, so the name reads over the arms.
    ctx.globalAlpha = 0.7 * this.sceneAlpha * alpha;
    ctx.fillStyle = css(DEEP_BG);
    ctx.fillRect(lx - 6, y - 9, tw + 12, 30);
    ctx.textAlign = "left";
    this.glyph(text, lx, y, color, 0.95 * alpha);
    ctx.font = `9px ${this.family}`;
    this.glyph("open →", lx, y + 13, GALAXY_FAINT, 0.8 * alpha);
    ctx.textAlign = "center";
    // Only tappable once it's fully there, and not while it's going away.
    if (alpha > 0.6 && this.navClosing < 0) this.hits.push({ x: Math.min(x, lx) - 10, y: y - 14, w: tw + 34, h: 36, href });
  }

  /**
   * Your projects as star systems along the arms. Each lights up in turn: a point of light swells and throws out
   * twinkling cross rays, then settles into a star with a slow pulsing ring, and only then does its name appear.
   * Launched ones are bright, unannounced ones dim. Tapping one goes home and opens it.
   */
  private drawSystems(cx: number, cy: number, R: number) {
    const out = this.navOut();
    projects.forEach((pr, i) => {
      const t = this.time - this.navAt - i * GLIMMER_GAP;
      if (t <= 0) return;
      const o = this.armOffset(R, 0.3 + i * 0.2, (i + 1) % 2);
      const x = cx + o.x, y = cy + o.y;
      const lit = pr.status === "launched";
      const col = lit ? GALAXY_ACCENT : GALAXY_FAINT;
      const ignite = smoothstep(0, 0.25, t), settle = smoothstep(GLIMMER * 0.6, GLIMMER, t);
      // The glimmer: rises as it ignites, gone once it settles.
      const burst = ignite * (1 - settle);
      if (burst > 0.02) {
        const L = 8 + 26 * burst;
        this.ctx.font = `10px ${this.family}`;
        for (const [dx, dy, g, len] of [[1, 0, "-", 1], [-1, 0, "-", 1], [0, 1, "|", 0.8], [0, -1, "|", 0.8], [0.7, 0.7, "·", 0.5], [-0.7, 0.7, "·", 0.5], [0.7, -0.7, "·", 0.5], [-0.7, -0.7, "·", 0.5]] as const) {
          for (let j = 1; j <= 4; j++) {
            const tw = 0.55 + 0.45 * Math.sin(this.time * 28 + j * 1.7 + i * 3);
            this.glyph(g, x + dx * L * len * (j / 4), y + dy * L * len * (j / 4), mix(col, GLARE, 0.6), burst * (1 - j / 5) * tw * out);
          }
        }
      }
      const ring = 9 + 3 * Math.sin(this.time * 2.2 + i);
      this.ctx.font = `9px ${this.family}`;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU + this.time * 0.4;
        this.glyph("·", x + Math.cos(a) * ring, y + Math.sin(a) * ring * 0.7, col, 0.6 * settle * out);
      }
      this.ctx.font = `${Math.round((lit ? 15 : 12) + 10 * burst)}px ${this.family}`;
      this.glyph("✦", x, y, mix(col, GLARE, burst), ignite * out);
      const named = smoothstep(GLIMMER, GLIMMER + 0.35, t) * out;
      if (named > 0.02) this.tapLabel(lit ? pr.name.toLowerCase() : "░░░░ unannounced", x, y - 2, `/projects#${pr.slug}`, col, named);
    });
  }

  /** The pilot's card beside the sun once the camera has flown there; on phones it sits low on the screen instead. */
  private drawPilot(sx: number, sy: number) {
    const { ctx } = this;
    const arrived = (1 - smoothstep(0.15, 0.5, Math.abs(this.cam.z - SUN_ZOOM))) * this.navOut();
    if (arrived < 0.05) return;
    const narrow = this.w < 640;
    ctx.font = `${narrow ? 11 : 12}px ${this.family}`;
    const pw = Math.min(this.w - 32, Math.max(...PILOT_CARD.map((l) => ctx.measureText(l).width)) + 32), ph = PILOT_CARD.length * 19 + 20;
    const bottom = window.innerHeight - this.origin.top;
    const px = narrow ? 16 : clamp(sx + 28, 16, this.w - pw - 16);
    const py = narrow ? bottom - ph - 72 : clamp(sy - ph / 2, 80, bottom - ph - 24);
    ctx.globalAlpha = 0.86 * arrived;
    ctx.fillStyle = css(DEEP_BG);
    ctx.fillRect(px, py, pw, ph);
    ctx.globalAlpha = 0.35 * arrived;
    ctx.strokeStyle = css(GALAXY_ACCENT);
    ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    ctx.textAlign = "left";
    PILOT_CARD.forEach((line, i) => {
      const last = i === PILOT_CARD.length - 1;
      const y = py + 19 + i * 19;
      this.glyph(line, px + 16, y, i === 0 || last ? GALAXY_ACCENT : DARK.star, (i === 0 || last ? 1 : 0.8) * arrived);
      if (last && this.navClosing < 0) this.hits.push({ x: px + 8, y: y - 12, w: ctx.measureText(line).width + 16, h: 24, href: "/about" });
    });
    ctx.textAlign = "center";
  }

  /** How hard the hyperdrive is running at progress k: it builds to the jump at the midpoint, then falls away. */
  private hyperIntensity(k: number) {
    return k < 0.5 ? smoothstep(0.05, 0.5, k) : 1 - smoothstep(0.5, 0.95, k);
  }

  /**
   * Hyperdrive, either way. Going out, the moon, sun or Earth collapses to a point while the stars stream out
   * of it in lengthening streaks; at the jump there's a wash of blue-white light, and you drop out with the galaxy
   * settling into view. Coming home, the galaxy rushes past and the disc opens out of the point it left from.
   */
  private drawHyperdrive(k: number) {
    const { ctx, w, h } = this;
    const turn = this.turn!;
    const going = turn.to === "deep";
    const home: Scene = going ? turn.from : turn.to;
    if (this.variant !== "emblem") {
      ctx.globalAlpha = 1;
      const sky = css(mix(bgOf(turn.from), bgOf(turn.to), smoothstep(0.3, 0.6, k)));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      this.matchSurfaces(sky);
    }
    const c = this.variant === "quiet" ? { x: this.view.x, y: this.view.y } : { x: this.hero.x, y: this.hero.y };
    const R = this.galaxyRadius();
    const drawHome = (alpha: number, scale: number) => {
      if (home === "day") { this.use(LIGHT, alpha); this.drawStars("day"); }
      else { this.use(DARK, alpha); this.drawStars(home === "earth" ? "earth" : "night"); }
      if (this.variant !== "quiet") this.around(c.x, c.y, scale, alpha, () => this.drawHero(home));
    };
    if (k < 0.5) {
      const a = 1 - smoothstep(0.3, 0.5, k);
      if (going) drawHome(a, 1 - 0.96 * smoothstep(0, 0.48, k));
      else {
        // The galaxy swells past you, centred on the sun, as you leave it.
        const g = 1 + 6 * smoothstep(0, 0.5, k) ** 2;
        const sun = this.sunOffset(R);
        this.use(DARK, a);
        this.drawStars("deep");
        this.drawGalaxy(c.x - sun.x * g, c.y - sun.y * g, R * g, a);
      }
    } else {
      const a = smoothstep(0.55, 0.85, k);
      if (going) {
        this.use(DARK, a);
        this.drawStars("deep");
        const c2 = this.galaxyCentre();
        this.drawGalaxy(c2.x, c2.y, R * (1 + 3 * (1 - smoothstep(0.5, 1, k)) ** 2), a);
      } else drawHome(a, smoothstep(0.5, 0.95, k));
    }
    this.drawWarp(c, this.hyperIntensity(k));
    const flash = Math.max(0, 1 - Math.abs(k - 0.5) / 0.07);
    if (flash > 0 && this.variant !== "emblem") {
      ctx.globalAlpha = flash * 0.32;
      ctx.fillStyle = css(BLUESHIFT);
      ctx.fillRect(0, 0, w, h);
    }
    this.sceneAlpha = 1;
  }

  /** The stars in hyperdrive: streaming out of the centre point, each a streak that lengthens with the speed. */
  private drawWarp(c: { x: number; y: number }, intensity: number) {
    if (intensity < 0.02) return;
    const { w, h } = this;
    const reach = Math.hypot(Math.max(c.x, w - c.x), Math.max(c.y, h - c.y));
    this.use(DARK, 1);
    this.ctx.font = `11px ${this.family}`;
    const col = mix(DARK.star, BLUESHIFT, intensity);
    for (const s of this.stars) {
      const th = s.x * TAU + s.y * 7;
      // Out from the centre, slow at first and quicker as it nears you (squared), then round again.
      const rho = (s.phase / TAU + this.warpPos * (0.4 + s.z)) % 1;
      const r = rho * rho * reach;
      const len = intensity * intensity * (12 + rho * reach * 0.35);
      const dx = Math.cos(th), dy = Math.sin(th);
      const lg = lineGlyph(dx, dy);
      const n = clamp(Math.floor(len / 8), 1, 14);
      for (let j = 0; j <= n; j++) {
        const rr = r - (len * j) / n;
        if (rr < 4) break;
        this.glyph(j === 0 ? "*" : lg, c.x + dx * rr, c.y + dy * rr, col, intensity * (0.25 + 0.75 * rho) * (1 - j / (n + 1)));
      }
    }
  }

  /**
   * The hold on the moon, sun or Earth: a ring of glyphs charges round it clockwise from the top, and past halfway
   * sparks start leaping off its rim, more and more until the jump.
   */
  private drawCharge() {
    const pl = this.hero;
    const k = this.charge;
    const day = this.scene === "day";
    this.use(day ? LIGHT : DARK, 1);
    const col = day ? LIGHT.warm : this.scene === "earth" ? EARTH_ATMO : DARK.warm;
    this.ctx.font = `${clamp(pl.font + 2, 8, 13)}px ${this.family}`;
    const r = pl.r * (1.14 + 0.02 * Math.sin(this.time * 24) * k);
    const n = Math.round((pl.r * TAU) / 9);
    for (let i = 0; i < n && i / n <= k; i++) {
      const a = -Math.PI / 2 + (i / n) * TAU;
      this.glyph(i % 4 === 0 ? "+" : "·", pl.x + Math.cos(a) * r, pl.y + Math.sin(a) * r, col, 0.4 + 0.6 * k);
    }
    if (k > 0.5) {
      const beat = Math.floor(this.time * 12);
      for (let j = 0; j < Math.round((k - 0.5) * 20); j++) {
        const a = hash(j, beat, 5) * TAU, rr = pl.r * (1.02 + hash(j, beat, 6) * 0.3 * k);
        this.glyph(hash(j, beat, 7) < 0.5 ? "'" : "*", pl.x + Math.cos(a) * rr, pl.y + Math.sin(a) * rr, col, k);
      }
    }
  }

  /**
   * A spiral galaxy in glyphs: a bright warm bulge, two logarithmic arms of cool blue stars broken up by noise,
   * dark dust lanes along their inner edges, and pink star-forming knots in the arms. The disc turns slowly.
   * Cells are dithered against their density, so the outskirts thin to scattered stars.
   */
  private drawGalaxy(cx: number, cy: number, R: number, alpha: number) {
    if (alpha < 0.02) return;
    const { w, h } = this;
    const emblem = this.variant === "emblem";
    const font = emblem ? 7 : 10;
    const cw = font * 0.62, ch = font * 1.08;
    const ct = Math.cos(GALAXY_TURN), st = Math.sin(GALAXY_TURN);
    const spin = (this.time * TAU) / 400;
    const squash = this.galaxySquash();
    this.sceneAlpha = alpha;
    this.ctx.font = `${font}px ${this.family}`;
    const reach = R * 1.15;
    const x0 = Math.max(0, Math.floor((cx - reach) / cw) * cw), x1 = Math.min(w, cx + reach);
    const y0 = Math.max(0, Math.floor((cy - reach) / ch) * ch), y1 = Math.min(h, cy + reach);
    for (let y = y0; y <= y1; y += ch) {
      for (let x = x0; x <= x1; x += cw) {
        const gx = x + cw / 2, gy = y + ch / 2;
        const dx = gx - cx, dy = gy - cy;
        // Back onto the disc: undo the turn, then the squash.
        const u = (dx * ct + dy * st) / R, v = (-dx * st + dy * ct) / (R * squash);
        if (Math.hypot(u, v) > 1.15) continue;
        const ix = Math.round(x / cw), iy = Math.round(y / ch);
        const { r, core, arm, n, d } = spiralField(u, v, spin);
        if (d <= 0 || hash(ix, iy, 63) > d * 2.2) continue;
        const tw = 0.8 + 0.2 * Math.sin(this.time * 1.3 + hash(ix, iy, 64) * TAU);
        const knot = arm > 0.35 && n > 0.7 && hash(ix, iy, 65) < 0.5;
        const g = knot ? "*" : RAMP[clamp(Math.round(d * 9), 1, 9)];
        const col = knot ? GALAXY_NEBULA : mix(GALAXY_ARM, GALAXY_CORE, clamp(core * 1.4 + (1 - r) * 0.25, 0, 1));
        this.glyph(g, gx, gy, col, (0.25 + 0.75 * Math.min(1, d)) * tw);
      }
    }
    // You are here: the sun, one star partway out along an arm.
    if (!emblem && !this.turn) {
      const s = this.sunOffset(R);
      this.ctx.font = `13px ${this.family}`;
      this.glyph("✦", cx + s.x, cy + s.y, DARK.warm, 1);
      this.ctx.font = `10px ${this.family}`;
      this.ctx.textAlign = "left";
      this.glyph("you are here", cx + s.x + 12, cy + s.y + 1, DARK.warm, 0.7);
      this.ctx.textAlign = "center";
      if (this.galaxyNav === "projects") this.drawSystems(cx, cy, R);
      if (this.galaxyNav === "about") this.drawPilot(cx + s.x, cy + s.y);
    }
    this.sceneAlpha = 1;
  }

  /** A point on a flare's loop: t runs 0 → 1 from one foot, out round the apex, and back to the other. */
  private flarePoint(f: Flare, t: number, lift: number) {
    const pl = this.hero;
    const rs = pl.r;
    const a1 = f.foot - f.spreadA, a2 = f.foot + f.spreadB;
    const x1 = pl.x + Math.cos(a1) * rs, y1 = pl.y + Math.sin(a1) * rs;
    const x2 = pl.x + Math.cos(a2) * rs, y2 = pl.y + Math.sin(a2) * rs;
    const dx = Math.cos(f.foot), dy = Math.sin(f.foot);
    const nx = -dy, ny = dx;
    const L = (f.reach - rs) * lift;
    // The loop bulges wider toward its top, like a real prominence; a long reach stays a tight arch, not a balloon.
    const bw = Math.min(L * f.bulge, rs * f.bulge * 1.3);
    // One leg climbs higher than the other, by as much as the other gives up, so the crown still lands on the click.
    const c1x = x1 + dx * L * (1.3 + f.lean) - nx * bw, c1y = y1 + dy * L * (1.3 + f.lean) - ny * bw;
    const c2x = x2 + dx * L * (1.3 - f.lean) + nx * bw, c2y = y2 + dy * L * (1.3 - f.lean) + ny * bw;
    const u = 1 - t;
    const x = u * u * u * x1 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x2;
    const y = u * u * u * y1 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y2;
    return { x, y };
  }

  /** A point on the flare as it's drawn: its path wanders and churns, pinned only at the feet and the crown. */
  private flareAt(f: Flare, t: number, lift: number) {
    const p = this.flarePoint(f, t, lift);
    const q = this.flarePoint(f, Math.min(1, t + 0.01), lift);
    const px = -(q.y - p.y), py = q.x - p.x;
    const pl = Math.hypot(px, py) || 1;
    const size = Math.min(f.reach - this.hero.r, this.hero.r * 1.6);
    const big = noise(t * f.freq + f.seed % 97, this.time * f.churn, 71) - 0.5;
    const fine = noise(t * f.freq * 3.7, this.time * f.churn * 2.3 + f.seed % 89, 72) - 0.5;
    const off = (big + fine * 0.35) * 2 * f.wander * size * Math.abs(Math.sin(TAU * t));
    return { x: p.x + (px / pl) * off, y: p.y + (py / pl) * off };
  }

  /**
   * The moment a flare reaches full height it bursts: a shockwave runs out from its crown, sparks scatter, and heavy
   * clumps of the sun carry on past the click, slowing as they go.
   */
  private strike(f: Flare) {
    f.struck = true;
    const crown = this.flarePoint(f, 0.5, 1);
    this.shocks.push({ x: crown.x, y: crown.y, age: 0, reach: this.hero.r * rand(0.9, 1.9), seed: f.seed % 101 });
    if (this.shocks.length > MAX_FLARES) this.shocks.shift();
    this.sunFlash = Math.max(this.sunFlash, 0.8);
    // Every burst has its own lean and its own mix: a wide scatter one time, a tight spray thrown off to one side the next.
    const fan = rand(0.7, 2.2);
    const lean = rand(-0.7, 0.7);
    const sparks = Math.round(rand(20, 44));
    for (let i = 0; i < sparks; i++) {
      const a = f.foot + lean + rand(-fan, fan);
      const v = rand(40, 200) * rand(1, 2.2);
      this.sparks.push({ x: crown.x, y: crown.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: rand(0.5, 1.9), glyph: "*+.'"[i % 4] });
    }
    const clumps = Math.round(rand(2, 10));
    for (let i = 0; i < clumps; i++) {
      const a = f.foot + lean * rand(0.4, 1.2) + rand(-0.5, 0.5);
      const v = rand(180, 560);
      this.sparks.push({ x: crown.x, y: crown.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: rand(1.1, 2.3), glyph: "@%*"[i % 3] });
    }
    if (this.sparks.length > MAX_SPARKS) this.sparks.splice(0, this.sparks.length - MAX_SPARKS);
  }

  private drawFlares() {
    const pal = this.palette;
    const pl = this.hero;
    const tick = Math.floor(this.time * 14);
    this.ctx.font = `${FLARE_FONT}px ${this.family}`;
    for (const f of this.flares) {
      const grow = ease(clamp(f.age / FLARE_GROW, 0, 1));
      // After it peaks the loop keeps lifting a little as it fades, as if breaking away from the sun.
      const lift = 1 + Math.max(0, f.age - FLARE_GROW) * 0.14;
      const fade = f.age < FLARE_HOLD ? 1 : 1 - (f.age - FLARE_HOLD) / (FLARE_LIFE - FLARE_HOLD);
      const crown = this.flarePoint(f, 0.5, lift);
      const len = Math.hypot(crown.x - pl.x, crown.y - pl.y) * 2.6;
      // Solid even at full stretch, with a limit so mashed clicks can't draw thousands of glyphs.
      const n = clamp(Math.round(len / (FLARE_FONT * 0.62)), 18, 120);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        // Both legs rise from the surface together and meet at the crown.
        if (t > grow / 2 && t < 1 - grow / 2) continue;
        // A torn flare has gaps in it that open and close as it churns.
        if (f.torn > 0 && noise(t * 11 + f.seed % 83, this.time * 0.7, 73) < f.torn) continue;
        const a = this.flareAt(f, t, lift);
        const b = this.flareAt(f, Math.min(1, t + 0.01), lift);
        const heat = 1 - Math.abs(t - 0.5) * 2;
        const roll = hash(i, tick, f.seed);
        // The crown is the thick of it: heavier marks as the loop climbs.
        const g = roll < 0.3 * heat ? "#" : roll < 0.5 ? "*" : roll < 0.62 ? "~" : lineGlyph(b.x - a.x, b.y - a.y);
        const nx = -(b.y - a.y), ny = b.x - a.x;
        const nl = Math.hypot(nx, ny) || 1;
        const ox = nx / nl, oy = ny / nl;
        this.glyph(g, a.x, a.y, mix(INK_LIMB, pal.warm, 0.35 + heat * 0.65), fade);
        // Strands either side give the loop its body: one hot and gold, one dark. They swell toward the crown.
        const wide = (5 + heat * 5) * f.thick * (0.7 + 0.6 * noise(t * 7, f.seed % 79, 74));
        this.glyph(roll > 0.5 ? "*" : "~", a.x + ox * wide, a.y + oy * wide, mix(pal.warm, INK_CORE, heat), 0.9 * fade);
        if (i % 2 === 0) this.glyph(roll > 0.5 ? "~" : "'", a.x - ox * wide, a.y - oy * wide, INK_LIMB, 0.85 * fade);
      }
      // Tendrils peel away once the loop has grown past where they leave it, bending as they go.
      for (const td of f.tendrils) {
        if (Math.abs(td.at - 0.5) * 2 < 1 - grow) continue;
        // A spray's streamers leave the sun itself; other tendrils leave the loop.
        let x: number, y: number, dir: number;
        if (td.ray !== undefined) {
          x = pl.x + Math.cos(f.foot + td.ray) * pl.r;
          y = pl.y + Math.sin(f.foot + td.ray) * pl.r;
          dir = f.foot + td.ray * 0.6;
        } else {
          ({ x, y } = this.flareAt(f, td.at, lift));
          const next = this.flareAt(f, Math.min(1, td.at + 0.01), lift);
          dir = Math.atan2(next.y - y, next.x - x) + (td.side * Math.PI) / 2;
        }
        const out = Math.min(1, f.age / (td.ray !== undefined ? FLARE_GROW : 0.9));
        const stride = Math.max(9, td.len / 45);
        const steps = Math.ceil((td.len * out) / stride);
        for (let j = 0; j < steps; j++) {
          dir += td.curl + (noise(j * 0.5 + td.len, this.time * f.churn + f.seed % 71, 75) - 0.5) * (td.ray !== undefined ? 0.34 : 0.7);
          x += Math.cos(dir) * stride;
          y += Math.sin(dir) * stride;
          this.glyph(j % 3 === 2 ? "*" : lineGlyph(Math.cos(dir), Math.sin(dir)), x, y, mix(pal.warm, INK_LIMB, j / (steps + 1)), (1 - j / (steps + 1)) * 0.9 * fade);
        }
      }
    }
    for (const s of this.shocks) {
      const k = s.age / SHOCK_LIFE;
      const rad = s.reach * (1 - (1 - k) ** 3);
      const dots = clamp(Math.round((TAU * rad) / 12), 10, 70);
      const a0 = (1 - k) ** 1.1;
      for (let i = 0; i < dots; i++) {
        const a = (i / dots) * TAU;
        const dx = Math.cos(a), dy = Math.sin(a);
        // The wave front is ragged and has holes in it: no two the same, and never a neat circle.
        const rag = noise(dx * 1.6 + s.seed, dy * 1.6, 76);
        if (rag < 0.3) continue;
        const front = rad * (0.62 + rag * 0.75);
        // Marks point outward, the way the wave is going, with a thinner echo trailing inside it.
        this.glyph(i % 4 === 0 ? "*" : lineGlyph(-dy, dx), s.x + dx * front, s.y + dy * front, mix(INK_LIMB, INK_MID, k), a0);
        if (i % 2 === 0) this.glyph("·", s.x + dx * front * 0.82, s.y + dy * front * 0.82, INK_MID, a0 * 0.75);
      }
    }
    for (const sp of this.sparks) {
      const k = sp.age / sp.life;
      this.glyph(sp.glyph, sp.x, sp.y, mix(INK_MID, pal.warm, k), (1 - k) * 0.95);
    }
  }

  private launchFlare(x: number, y: number) {
    const pl = this.hero;
    const foot = Math.atan2(y - pl.y, x - pl.x);
    // The crown lands on the click, wherever it is; only a click right by the sun gets a minimum stub.
    const reach = Math.max(Math.hypot(x - pl.x, y - pl.y), pl.r * 1.6);
    // Four broad kinds, each rolled fresh: a lopsided arch, a narrow jet with its feet almost together, a torn loop,
    // or a spray of separate streamers with no loop at all.
    const roll = Math.random();
    const jet = roll < 0.25, torn = !jet && roll < 0.5, spray = roll >= 0.72;
    const spread = jet ? rand(0.03, 0.08) : rand(0.14, 0.42);
    const tendrils: Tendril[] = [];
    if (spray) {
      const fan = rand(0.18, 0.75);
      const dist = reach - pl.r;
      for (let i = Math.round(rand(3, 7)); i > 0; i--) {
        tendrils.push({ at: 0, side: 1, curl: rand(-0.035, 0.035), len: dist * rand(0.45, 1.1), ray: rand(-fan, fan) });
      }
    }
    for (let i = spray ? 0 : Math.round(rand(jet ? 2 : 1, 5)); i > 0; i--) {
      tendrils.push({ at: rand(0.12, 0.88), side: Math.random() < 0.5 ? -1 : 1, curl: rand(-0.28, 0.28), len: pl.r * rand(0.25, 0.9) });
    }
    this.flares.push({
      foot, reach, age: 0, struck: false, seed: Math.floor(Math.random() * 1e6),
      spreadA: spread * rand(0.6, 1.4), spreadB: spread * rand(0.6, 1.4),
      lean: rand(-0.55, 0.55), bulge: jet ? rand(0.04, 0.12) : rand(0.18, 0.5),
      wander: jet ? rand(0.16, 0.34) : rand(0.08, 0.26), freq: rand(1.6, 4.5), churn: rand(0.5, 1.6),
      torn: spray ? 2 : torn ? rand(0.32, 0.46) : 0, thick: rand(0.6, 1.5), tendrils,
    });
    if (this.flares.length > MAX_FLARES) this.flares.shift();
    this.sunFlash = 1;
    this.flared++;
    this.report();
  }

  /**
   * A press on the moon, sun or Earth starts charging the hyperdrive; in the galaxy, a press on empty sky takes
   * hold of the camera instead (two take hold to pinch).
   */
  private onGrab = (e: PointerEvent) => {
    if (this.turn || this.pass?.dir === "out" || e.button !== 0) return;
    if (e.composedPath().some((n) => n instanceof Element && n.matches(INTERACTIVE))) return;
    if (this.scene === "deep") {
      const x = e.clientX - this.origin.left, y = e.clientY - this.origin.top;
      const hit = this.hits.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
      if (hit) return void window.dispatchEvent(new CustomEvent(GO_EVENT, { detail: hit.href }));
      this.grabs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
      this.lastDrag = performance.now();
      return;
    }
    if (this.variant !== "full" || this.charging.start) return;
    const rect = this.canvas.getBoundingClientRect();
    if (Math.hypot(e.clientX - rect.left - this.hero.x, e.clientY - rect.top - this.hero.y) > this.hero.r) return;
    // Timed, so the jump lands at three seconds even if frames are dropped.
    this.charging = { id: e.pointerId, start: performance.now(), timer: window.setTimeout(this.fire, CHARGE_MS) };
    this.canvas.parentElement?.setAttribute("data-charging", "");
  };

  private onLetGo = (e: PointerEvent) => {
    const g = this.grabs.get(e.pointerId);
    this.grabs.delete(e.pointerId);
    // A tap on empty sky in the galaxy puts away whatever the nav was showing.
    if (g && this.galaxyNav && Math.hypot(g.x - g.sx, g.y - g.sy) < 8) this.closeNav();
    if (e.pointerId !== this.charging.id) return;
    // A long press that gave up isn't a click on the sky either.
    if (performance.now() - this.charging.start > 500) this.swallowUntil = performance.now() + 400;
    this.endCharge();
  };

  /** Held long enough: hyperdrive. The page switches theme, and readTheme plays the jump. */
  private fire = () => {
    this.endCharge();
    window.dispatchEvent(new Event(HYPERDRIVE_EVENT));
  };

  private endCharge() {
    window.clearTimeout(this.charging.timer);
    this.charging = { id: -1, start: 0, timer: 0 };
    this.canvas.parentElement?.removeAttribute("data-charging");
    if (this.reduced.matches || !this.raf) this.render();
  }

  /** A long press on a phone would open a menu; while charging, it's ours. */
  private onMenu = (e: Event) => {
    if (this.charging.start) e.preventDefault();
  };

  private onWheel = (e: WheelEvent) => {
    if (this.scene !== "deep" || this.turn) return;
    e.preventDefault();
    this.zoomAt(e.clientX - this.origin.left, e.clientY - this.origin.top, Math.exp(-e.deltaY * 0.0015));
  };

  /** Zoom by f, keeping whatever is under (px, py) where it is. */
  private zoomAt(px: number, py: number, f: number) {
    const cam = this.cam;
    const z = clamp(cam.z * f, 0.6, 4);
    const k = z / cam.z;
    cam.x = px - this.view.x - (px - this.view.x - cam.x) * k;
    cam.y = py - this.view.y - (py - this.view.y - cam.y) * k;
    cam.z = z;
    if (!this.raf) this.render();
  }

  private drag(e: PointerEvent) {
    const g = this.grabs.get(e.pointerId)!;
    const other = [...this.grabs].find(([id]) => id !== e.pointerId)?.[1];
    if (other) {
      // Pinch: zoom by how far the fingers have spread, about the point between them.
      const before = Math.hypot(g.x - other.x, g.y - other.y), after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (before > 10) this.zoomAt((e.clientX + other.x) / 2 - this.origin.left, (e.clientY + other.y) / 2 - this.origin.top, after / before);
    } else {
      const now = performance.now();
      const dt = Math.max(1 / 240, (now - this.lastDrag) / 1000);
      this.lastDrag = now;
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      this.cam.x += dx;
      this.cam.y += dy;
      // Remembered, smoothed, so letting go flings the view on.
      this.cam.vx = this.cam.vx * 0.6 + (dx / dt) * 0.4;
      this.cam.vy = this.cam.vy * 0.6 + (dy / dt) * 0.4;
      if (!this.raf) this.render();
    }
    g.x = e.clientX;
    g.y = e.clientY;
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.grabs.has(e.pointerId)) this.drag(e);
    if (e.pointerId === this.charging.id) {
      // Sliding off the disc lets go of the charge.
      const r = this.canvas.getBoundingClientRect();
      if (Math.hypot(e.clientX - r.left - this.hero.x, e.clientY - r.top - this.hero.y) > this.hero.r * 1.3) this.endCharge();
    }
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
    if (this.reduced.matches || this.pass?.dir === "out") return;
    if (e.composedPath().some((n) => n instanceof Element && n.matches(INTERACTIVE))) return;
    if (window.getSelection()?.toString()) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
    if (this.turn || this.scene === "deep" || performance.now() < this.swallowUntil) return;
    if (this.drifterHit(x, y)) {
      this.stopDrifter(this.drifter!);
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
