/*
 * What drifts across the sky page: one little ship or figure per secret, per sky. Click one and it tells in its own
 * voice exactly how to trigger its secret, found or not (sky/engine.ts flies them). Every sky is still space: by night the usual
 * visitors, by day things you'd find near a star, and at Earth things in orbit. Earth has none for its own secret;
 * being there means you found it.
 *
 * They're drawn the way the moon is: shapes shaded in light and laid onto a grid through a density ramp, not typed-out
 * pictures. The light comes from the disc, so each one is lit on the side facing it, and a comet's tail points away.
 * Tumbling turns the shape under the grid, so the glyphs stay upright.
 */

import type { Rgb, Scene } from "./engine";

export type SecretId = "earth" | "voyage" | "vista" | "milkyway";
export type DrifterSky = Exclude<Scene, "deep">;

/** The colours a drifter is drawn in: the part of the sky's palette it needs. */
export interface DrifterInks { star: Rgb; warm: Rgb; cool: Rgb; bright: Rgb; deep: Rgb; comet: Rgb; ink: boolean }

/** A saying: the character's voice, then the literal instruction. */
export interface Saying { voice: string; how: string }

type Tone = "body" | "dark" | "glass" | "warm" | "flame" | "sheen";
type Hit = { b: number; tone: Tone };
/** One piece of a drifter: what's at (u, v), in units where 1 is the drifter's scale. */
type Part = (u: number, v: number) => Hit | null;
/** What a part gets to draw with: the light in the drifter's own coordinates, the clock, how excited it is, and how hard its engine is running. */
interface Stage { lx: number; ly: number; lz: number; t: number; wave: number; power: number }

export interface Sprite {
  parts: (stage: Stage) => Part[];
  /**
   * How it travels. coast: on momentum alone, steady. cruise: under power, on a long curve. glide: on the light itself,
   * swelling and easing. hover: stops, then darts.
   */
  gait: "coast" | "cruise" | "glide" | "hover";
  /** Which way it faces. path: along its flight. spin: turns slowly, end over end. sun: keeps toward the light. rock: sways upright. bank: tips into its moves. still: as drawn. */
  face: "path" | "spin" | "sun" | "rock" | "bank" | "still";
  /** How far it reaches from its centre, across and down, in units. */
  reach: number;
  tall: number;
  says: Saying;
}

const RAMP = " .:-=+*#%@";
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const mix = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/* ── the pieces ───────────────────────────────────── */

/** A rounded form: a ball, or an egg, lit as one. */
const ball = (s: Stage, cx: number, cy: number, rx: number, ry: number, tone: Tone = "body", albedo = 1): Part => (u, v) => {
  const nx = (u - cx) / rx, ny = (v - cy) / ry;
  const d2 = nx * nx + ny * ny;
  if (d2 > 1) return null;
  const lam = nx * s.lx + ny * s.ly + Math.sqrt(1 - d2) * s.lz;
  return { b: albedo * (0.16 + 0.84 * clamp(lam, 0, 1)), tone };
};

/** A tube from a to b: a limb, a hull, a boom. */
const rod = (s: Stage, ax: number, ay: number, bx: number, by: number, r: number, tone: Tone = "body", albedo = 1): Part => {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const len = Math.sqrt(len2);
  return (u, v) => {
    const k = clamp(((u - ax) * dx + (v - ay) * dy) / len2, 0, 1);
    const ox = u - (ax + dx * k), oy = v - (ay + dy * k);
    const d2 = ox * ox + oy * oy;
    if (d2 > r * r) return null;
    const side = (-dy * ox + dx * oy) / len / r;
    const lam = (-dy / len) * side * s.lx + (dx / len) * side * s.ly + Math.sqrt(Math.max(0, 1 - d2 / (r * r))) * s.lz;
    return { b: albedo * (0.16 + 0.84 * clamp(lam, 0, 1)), tone };
  };
};

/** A flat panel; given a pitch, ruled into cells that catch the light as it moves. */
const plate = (s: Stage, x0: number, y0: number, x1: number, y1: number, tone: Tone = "body", albedo = 0.7, pitch = 0): Part => (u, v) => {
  if (u < x0 || u > x1 || v < y0 || v > y1) return null;
  const glint = 0.5 + 0.5 * Math.sin(s.t * 0.9 + (u + v) * 5);
  if (pitch && (Math.abs(((u - x0) % pitch) - pitch / 2) > pitch * 0.38 || Math.abs(((v - y0) % pitch) - pitch / 2) > pitch * 0.38)) return { b: albedo * 0.3, tone: "dark" };
  return { b: albedo * (0.55 + 0.45 * glint * glint), tone };
};

/** A flat three-cornered face. */
const wedge = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, tone: Tone = "body", albedo = 0.6): Part => (u, v) => {
  const d1 = (u - bx) * (ay - by) - (ax - bx) * (v - by);
  const d2 = (u - cx) * (by - cy) - (bx - cx) * (v - cy);
  const d3 = (u - ax) * (cy - ay) - (cx - ax) * (v - ay);
  return (d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0) ? null : { b: albedo, tone };
};

/** Fire out of the back of something, licking toward -u. */
const flame = (s: Stage, x: number, y: number, full: number, hw: number): Part => (u, v) => {
  if (s.power < 0.08) return null;
  const len = full * (0.35 + 0.65 * s.power);
  const along = (x - u) / len;
  if (along < 0 || along > 1) return null;
  const room = hw * Math.pow(1 - along, 0.7) * (0.8 + 0.2 * Math.sin(s.t * 31 + along * 9));
  const off = Math.abs(v - y) / (room || 1);
  if (off > 1) return null;
  return { b: clamp((1 - along) * (1 - off * 0.5) * (0.8 + 0.2 * Math.sin(s.t * 47 + v * 40 + u * 23)) * 1.15 + 0.16, 0, 1), tone: "flame" };
};

/** Something small that blinks, faster when it's excited. */
const blink = (s: Stage, x: number, y: number, r: number): Part => {
  const on = Math.sin(s.t * (s.wave ? 14 : 3.2) + x * 7) > 0.2;
  return (u, v) => (on && Math.hypot(u - x, v - y) < r ? { b: 1, tone: "warm" } : null);
};

/** A figure in a suit, its arm raised and waving when it's excited. */
function figure(s: Stage, ox: number, oy: number): Part[] {
  // Weightless, the limbs drift on their own; stopped for you, the arm goes up and waves.
  const drift = Math.sin(s.t * 0.7), sway = Math.sin(s.t * 0.47 + 1.3);
  const swing = s.wave ? -1.15 + Math.sin(s.t * 7) * 0.5 : -0.25 + drift * 0.3;
  const hand = [ox + 0.15 + Math.cos(swing) * 0.32, oy - 0.12 + Math.sin(swing) * 0.32] as const;
  return [
    ball(s, ox + 0.045, oy - 0.42, 0.125, 0.105, "warm", 1),
    ball(s, ox, oy - 0.42, 0.2, 0.2, "body", 1),
    rod(s, ox + 0.15, oy - 0.12, hand[0], hand[1], 0.06),
    rod(s, ox - 0.05, oy + 0.14, ox - 0.17 - sway * 0.05, oy + 0.54, 0.075),
    rod(s, ox + 0.06, oy + 0.14, ox + 0.2 + drift * 0.06, oy + 0.5 - drift * 0.03, 0.075),
    rod(s, ox, oy - 0.17, ox, oy + 0.13, 0.17),
    rod(s, ox - 0.15, oy - 0.1, ox - 0.42, oy + 0.08 + sway * 0.07, 0.06),
    plate(s, ox - 0.3, oy - 0.24, ox - 0.13, oy + 0.12, "dark", 0.55),
  ];
}

/* ── the cast ─────────────────────────────────────── */

const satellite: Sprite["parts"] = (s) => [
  blink(s, 0, 0.27, 0.04),
  plate(s, -0.15, -0.19, 0.15, 0.19, "body", 0.85),
  rod(s, 0, -0.19, 0, -0.32, 0.018),
  ball(s, 0, -0.38, 0.28, 0.09),
  plate(s, -1, -0.24, -0.27, 0.24, "sheen", 0.85, 0.16),
  plate(s, 0.27, -0.24, 1, 0.24, "sheen", 0.85, 0.16),
  rod(s, -0.27, 0, 0.27, 0, 0.02, "dark"),
];

const rocket: Sprite["parts"] = (s) => [
  ball(s, 0.26, -0.01, 0.1, 0.1, "glass", 1),
  wedge(0.46, -0.19, 0.46, 0.19, 1.02, 0, "warm", 0.8),
  rod(s, -0.5, 0, 0.42, 0, 0.21),
  wedge(-0.2, -0.17, -0.56, -0.17, -0.74, -0.5, "warm", 0.62),
  wedge(-0.2, 0.17, -0.56, 0.17, -0.74, 0.5, "warm", 0.42),
  plate(s, -0.66, -0.12, -0.5, 0.12, "dark", 0.5),
  flame(s, -0.66, 0, 0.62, 0.15),
];

const ufo: Sprite["parts"] = (s) => [
  (u, v) => {
    if (Math.abs(v - 0.015) > 0.05) return null;
    const lamp = Math.sin(u * 13 + s.t * (s.wave ? 13 : 3.6));
    return lamp > 0.55 ? { b: 1, tone: "warm" } : null;
  },
  ball(s, 0, -0.17, 0.32, 0.3, "glass", 1),
  ball(s, 0, 0, 1, 0.2),
  ball(s, 0, 0.14, 0.5, 0.14, "dark", 0.9),
  (u, v) => {
    const down = (v - 0.24) / 0.6;
    if (down < 0 || down > 1 || Math.abs(u) > 0.1 + 0.36 * down) return null;
    const b = (1 - down) * 0.42 * (0.6 + 0.4 * Math.sin(s.t * 6 + v * 26));
    return b > 0.1 ? { b, tone: "flame" } : null;
  },
];

const astronaut: Sprite["parts"] = (s) => figure(s, 0, 0);

const probe: Sprite["parts"] = (s) => [
  ball(s, 0.58, 0, 0.17, 0.78, "body", 1.1),
  rod(s, 0.44, 0, -0.08, 0, 0.05, "dark"),
  blink(s, -0.86, 0, 0.045),
  rod(s, -0.42, 0, -0.84, 0, 0.018),
  plate(s, -0.42, -0.2, -0.06, 0.2, "body", 0.72),
  plate(s, -0.38, -0.72, -0.14, -0.22, "sheen", 0.85, 0.12),
  plate(s, -0.38, 0.22, -0.14, 0.72, "sheen", 0.85, 0.12),
];

const sail: Sprite["parts"] = (s) => [
  ball(s, 0, 0, 0.09, 0.09, "warm", 1.1),
  rod(s, 0, -0.98, 0, 0.98, 0.014, "dark"),
  rod(s, -0.98, 0, 0.98, 0, 0.014, "dark"),
  (u, v) => {
    if (Math.abs(u) + Math.abs(v) > 0.98) return null;
    const face = (u > 0 ? 0.12 : 0) + (v > 0 ? 0 : 0.14);
    const ripple = Math.sin(s.t * 0.9 + (u - v) * 3.4 + Math.sin(u * 4 + s.t * 0.6) * 0.5);
    return { b: clamp(0.34 + face + 0.5 * ripple * ripple * ripple * ripple, 0, 1), tone: "sheen" };
  },
];

const comet: Sprite["parts"] = (s) => [
  ball(s, 0, 0, 0.11, 0.11, "warm", 1.25),
  (u, v) => {
    const d = Math.hypot(u, v) / 0.34;
    return d < 1 ? { b: (1 - d) * (1 - d) * 0.95 + 0.06, tone: "flame" } : null;
  },
  (u, v) => {
    const k = Math.hypot(s.lx, s.ly) || 1;
    const ax = -s.lx / k, ay = -s.ly / k;
    const along = u * ax + v * ay;
    if (along < 0 || along > 1.5) return null;
    const off = -u * ay + v * ax;
    const room = 0.08 + 0.24 * along;
    if (Math.abs(off) > room) return null;
    const b = Math.pow(1 - along / 1.5, 1.3) * (1 - Math.abs(off) / room) * (0.62 + 0.38 * Math.sin(along * 24 - s.t * 7 + off * 44));
    return b > 0.07 ? { b, tone: "flame" } : null;
  },
];

const parasol: Sprite["parts"] = (s) => [
  ...figure(s, 0, 0.3),
  (u, v) => {
    const nx = u / 0.68, ny = (v + 0.42) / 0.36;
    if (ny > 0 || nx * nx + ny * ny > 1) return null;
    const rib = Math.abs(Math.sin(Math.atan2(ny + 0.02, nx) * 6));
    return { b: rib > 0.8 ? 0.28 : clamp(0.62 + 0.3 * (nx * s.lx + ny * s.ly), 0, 1), tone: "warm" };
  },
  rod(s, 0.14, -0.42, 0.14, 0.12, 0.016, "dark"),
];

const shuttle: Sprite["parts"] = (s) => [
  plate(s, 0.5, -0.1, 0.68, -0.03, "glass", 0.9),
  ball(s, 0.72, 0, 0.3, 0.15),
  rod(s, -0.6, 0, 0.72, 0, 0.16),
  wedge(0.22, 0.09, -0.62, 0.09, -0.74, 0.5, "dark", 0.55),
  wedge(-0.32, -0.12, -0.66, -0.12, -0.78, -0.52, "body", 0.62),
  plate(s, -0.72, -0.1, -0.6, 0.1, "dark", 0.5),
  flame(s, -0.72, 0, 0.42, 0.11),
];

const station: Sprite["parts"] = (s) => [
  blink(s, 0, -0.34, 0.04),
  ball(s, 0, -0.21, 0.12, 0.11),
  rod(s, -0.34, 0, 0.34, 0, 0.11),
  (u, v) => {
    const d = Math.hypot(u / 0.5, v / 0.3);
    return d > 0.85 && d < 1 ? { b: clamp(0.5 + 0.4 * (u * s.lx + v * s.ly), 0, 1), tone: "body" } : null;
  },
  plate(s, -1.1, -0.48, -0.58, -0.08, "sheen", 0.85, 0.13),
  plate(s, -1.1, 0.08, -0.58, 0.48, "sheen", 0.85, 0.13),
  plate(s, 0.58, -0.48, 1.1, -0.08, "sheen", 0.85, 0.13),
  plate(s, 0.58, 0.08, 1.1, 0.48, "sheen", 0.85, 0.13),
  rod(s, -1.1, 0, 1.1, 0, 0.022, "dark"),
];

export const DRIFTERS: Record<DrifterSky, Partial<Record<SecretId, Sprite>>> = {
  night: {
    earth: { parts: satellite, gait: "coast", face: "spin", reach: 1, tall: 0.5, says: { voice: "signal lost!", how: "press the ☾ in the top bar 5 times, fast, to find Earth" } },
    voyage: { parts: rocket, gait: "cruise", face: "path", reach: 1.3, tall: 0.5, says: { voice: "want a ride?", how: "press and hold the ☾ in the top bar for 3 seconds" } },
    vista: { parts: ufo, gait: "hover", face: "bank", reach: 1, tall: 0.85, says: { voice: "we come in peace.", how: "press and hold the ☾ in the top bar for 5 seconds" } },
    milkyway: { parts: astronaut, gait: "coast", face: "spin", reach: 0.75, tall: 0.75, says: { voice: "houston, try this:", how: "press and hold the big moon for 3 seconds" } },
  },
  day: {
    earth: { parts: probe, gait: "coast", face: "sun", reach: 0.95, tall: 0.8, says: { voice: "too hot out here!", how: "press the ☼ in the top bar 5 times, fast, to reach Earth" } },
    voyage: { parts: sail, gait: "glide", face: "rock", reach: 1, tall: 1, says: { voice: "catch the solar wind:", how: "press and hold the ☼ in the top bar for 3 seconds" } },
    vista: { parts: comet, gait: "cruise", face: "still", reach: 1.55, tall: 1.55, says: { voice: "can't stop!", how: "press and hold the ☼ in the top bar for 5 seconds" } },
    milkyway: { parts: parasol, gait: "coast", face: "rock", reach: 0.9, tall: 0.9, says: { voice: "wear sunscreen.", how: "press and hold the big sun for 3 seconds" } },
  },
  earth: {
    voyage: { parts: shuttle, gait: "cruise", face: "path", reach: 1.15, tall: 0.55, says: { voice: "next launch is yours:", how: "press and hold the ⊕ in the top bar for 3 seconds" } },
    vista: { parts: station, gait: "coast", face: "spin", reach: 1.15, tall: 0.55, says: { voice: "the view's better up here.", how: "press and hold the ⊕ in the top bar for 5 seconds" } },
    milkyway: { parts: astronaut, gait: "coast", face: "spin", reach: 0.75, tall: 0.75, says: { voice: "houston, try this:", how: "press and hold the big Earth for 3 seconds" } },
  },
};

/* ── laying it on the grid ────────────────────────── */

/** How a tone looks at brightness b, in this sky. On paper the shadows are the dense ink; on black, the lights are. */
function inkFor(tone: Tone, b: number, inks: DrifterInks): { density: number; color: Rgb } {
  const lit = tone === "flame" || tone === "warm";
  const density = inks.ink ? (lit ? Math.sqrt(b) : clamp(1 - b * 0.82, 0.12, 1)) : b;
  switch (tone) {
    case "flame": return { density, color: mix(inks.warm, inks.comet, inks.ink ? 0.1 : b * b) };
    case "warm": return { density, color: mix(inks.warm, inks.comet, inks.ink ? 0 : b * b * 0.5) };
    case "glass": return { density, color: inks.cool };
    case "sheen": return { density, color: inks.ink ? mix(inks.deep, inks.warm, b * 0.8) : mix(inks.cool, inks.star, b * 0.7) };
    case "dark": return { density, color: inks.ink ? inks.star : mix(inks.deep, inks.star, b * 0.4) };
    default: return { density, color: inks.ink ? mix(inks.star, inks.deep, b) : mix(mix(inks.deep, inks.bright, clamp(b * 1.3, 0, 1)), inks.comet, clamp(b * 1.4 - 0.9, 0, 0.6)) };
  }
}

export interface DrifterView {
  /** Where its centre is, and how big a unit is. */
  x: number; y: number; scale: number;
  cw: number; ch: number;
  rot: number;
  /** Flying left: the drifter is turned round. */
  left: boolean;
  /** Where the light comes from, as a point on the canvas. */
  lightX: number; lightY: number;
  t: number;
  /** Non-zero while it has stopped for you. */
  wave: number;
  /** How hard its engine is running, 0 to about 1. */
  power?: number;
  inks: DrifterInks;
}

/** Calls put for every glyph of the drifter, snapped to a global grid so it reads as terminal text, as the moon does. */
export function paintDrifter(sprite: Sprite, view: DrifterView, put: (x: number, y: number, glyph: string, color: Rgb, alpha: number, solid: boolean) => void) {
  const { x, y, scale, cw, ch, rot, inks } = view;
  const flip = view.left ? -1 : 1;
  const cos = Math.cos(-rot), sin = Math.sin(-rot);
  // The light, in the drifter's own coordinates.
  const dx = view.lightX - x, dy = view.lightY - y, len = Math.hypot(dx, dy) || 1;
  const wx = (dx / len) * 0.78, wy = (dy / len) * 0.78;
  const stage: Stage = { lx: (wx * cos - wy * sin) * flip, ly: wx * sin + wy * cos, lz: 0.62, t: view.t, wave: view.wave, power: view.power ?? 1 };
  const parts = sprite.parts(stage);
  const far = Math.hypot(sprite.reach, sprite.tall) * scale;
  const x0 = Math.floor((x - far) / cw) * cw, y0 = Math.floor((y - far) / ch) * ch;
  for (let gy = y0; gy <= y + far; gy += ch) {
    for (let gx = x0; gx <= x + far; gx += cw) {
      const ox = (gx + cw / 2 - x) / scale, oy = (gy + ch / 2 - y) / scale;
      const u = (ox * cos - oy * sin) * flip, v = ox * sin + oy * cos;
      let hit: Hit | null = null;
      for (const part of parts) if ((hit = part(u, v))) break;
      if (!hit) continue;
      const { density, color } = inkFor(hit.tone, clamp(hit.b, 0, 1), inks);
      const g = RAMP[clamp(Math.round(density * (RAMP.length - 1)), 1, RAMP.length - 1)];
      put(gx + cw / 2, gy + ch / 2, g, color, inks.ink ? 0.72 + 0.28 * density : 0.42 + 0.58 * clamp(hit.b, 0, 1), hit.tone !== "flame");
    }
  }
}
