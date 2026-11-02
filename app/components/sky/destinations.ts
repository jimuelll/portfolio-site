/*
 * Where the wormholes go (cosmos.ts): real places you might recognise, one per trip. Each is a field of gas worked out
 * once into a small map on the way through the wormhole, then only sampled as you fly up to it, plus the stars and the
 * landmarks you can tap. Their facts are short and real.
 */

import { ARM_PITCH, GALAXY_ARM, GALAXY_CORE, GALAXY_NEBULA, GALAXY_SQUASH_WIDE, GALAXY_TURN, SUN_ORBIT, clamp, css, hash, noise, smoothstep, spiralField, type Rgb } from "./engine";
import type { Pen } from "./sights";

const KEY = "sky-wormhole-next";
const MAP = 220;
/** How far the map reaches, in radii of the place. */
const SPAN = 1.3;
/** Glyph cells a frame at most: past this they get bigger instead of more numerous. */
const MAX_CELLS = 3000;
const TAU = Math.PI * 2;

export interface Landmark { name: string; fact: string; u: number; v: number; glyph?: string; colour?: Rgb }
/** A star drawn sharply over the gas. */
interface Fixed { u: number; v: number; glyph: string; colour: Rgb }
export interface Destination {
  id: string;
  title: string;
  /** Said as you come out of the wormhole. */
  hello: string;
  /** What the sky's stars turn, how thickly they lie, and the faint colour of the dark between them. */
  stars: Rgb;
  density: number;
  fog: Rgb;
  /** The gas, cool to hot: a field's m runs along this. */
  palette: Rgb[];
  field(x: number, y: number): { d: number; m: number };
  fixed: Fixed[];
  landmarks: Landmark[];
}

const fbm = (x: number, y: number, seed: number) => noise(x, y, seed) * 0.5 + noise(x * 2.1, y * 2.1, seed + 1) * 0.3 + noise(x * 4.3, y * 4.3, seed + 2) * 0.2;
const blob = (x: number, y: number, cx: number, cy: number, r: number) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (r * r));

// ── andromeda ────────────────────────────────────

const M31_TURN = -0.62, M31_SQUASH = 0.3;
function andromeda(x: number, y: number) {
  const c = Math.cos(M31_TURN), s = Math.sin(M31_TURN);
  const u = x * c + y * s, v = (-x * s + y * c) / M31_SQUASH;
  const { r, core, arm, lane, n } = spiralField(u, v, 0.4, 0.2);
  // A smooth glow of old stars under the arms is what makes it read as one long disc, rather than loose strands.
  const halo = 0.42 * Math.exp(-r / 0.42) * (1 - smoothstep(0.85, 1.1, r)) * (0.65 + 0.7 * n);
  const m32 = blob(x, y, 0.14, -0.2, 0.05);
  const m110 = blob(x, y * 0.8, -0.42, 0.3, 0.055);
  const disc = core * 1.6 + arm * (1.5 + 1.5 * n) + halo - lane * 0.55;
  const d = Math.max(0, disc) + m32 * 1.3 + m110 * 0.6;
  const knot = arm > 0.3 && n > 0.72 && hash(Math.round(x * 300), Math.round(y * 300), 91) < 0.5;
  return { d, m: knot ? 1 : clamp(0.18 + core * 0.5 + (1 - r) * 0.32 + (m32 + m110) * 0.4, 0, 0.66) };
}

// ── the milky way, the same one the galaxy secret shows ──

const ct = Math.cos(GALAXY_TURN), st = Math.sin(GALAXY_TURN);
/** From a point on the galaxy's disc to where it lands as seen from here. */
const onDisc = (a: number, b: number) => ({ u: a * ct - b * GALAXY_SQUASH_WIDE * st, v: a * st + b * GALAXY_SQUASH_WIDE * ct });
const sol = (() => {
  const th = Math.log(SUN_ORBIT + 0.02) / ARM_PITCH;
  return onDisc(Math.cos(th) * SUN_ORBIT, Math.sin(th) * SUN_ORBIT);
})();
const orionArm = (() => {
  const r = SUN_ORBIT * 1.2, th = Math.log(r + 0.02) / ARM_PITCH;
  return onDisc(Math.cos(th) * r, Math.sin(th) * r);
})();
function milkyWay(x: number, y: number) {
  const u = x * ct + y * st, v = (-x * st + y * ct) / GALAXY_SQUASH_WIDE;
  const { r, core, arm, d: disc, n } = spiralField(u, v, 0);
  const clouds = blob(x, y, 0.84, 0.66, 0.09) * (0.5 + n) + blob(x, y, 1.05, 0.44, 0.05) * (0.4 + n);
  const knot = arm > 0.35 && n > 0.7 && hash(Math.round(x * 300), Math.round(y * 300), 65) < 0.5;
  return { d: Math.max(0, disc) + clouds, m: knot ? 1 : clamp(core * 0.7 + (1 - r) * 0.125 + clouds * 0.2, 0, 0.5) };
}

// ── the pillars of creation ──────────────────────

const PILLARS = [
  { x: -0.5, top: -0.5, width: 0.2, lean: 0.14 },
  { x: 0.0, top: -0.12, width: 0.16, lean: 0.1 },
  { x: 0.42, top: 0.2, width: 0.13, lean: -0.06 },
];
function pillars(x: number, y: number) {
  const r = Math.hypot(x, y);
  const edge = 1 - smoothstep(0.92, 1.28, r);
  const gas = fbm(x * 2.3 + 9, y * 2.3, 71);
  // Patchy, with dark sky between the clouds, so the columns stand out against it.
  let d = Math.max(0, gas - 0.42) * 2.1 * edge;
  let m = clamp(0.1 + ((y + 1) / 2) * 0.25 + (gas - 0.45) * 0.8, 0, 0.66);
  PILLARS.forEach((p, i) => {
    if (y < p.top) return;
    const t = clamp((y - p.top) / (1.15 - p.top), 0, 1);
    const wobble = (noise(y * 6 + i * 7, i, 73) - 0.5) * 0.11;
    const half = p.width * (0.32 + 0.68 * t) * Math.sqrt(smoothstep(0, 0.07, t) * 0.75 + 0.25);
    const off = Math.abs(x - (p.x + p.lean * t + wobble)) / half;
    if (off > 1) return;
    // Dark dust, with a lit edge where the young stars are boiling it away.
    const rim = smoothstep(0.6, 0.95, off) + (1 - smoothstep(0, 0.05, t)) * 0.7;
    const dust = (0.3 + 0.3 * noise(x * 11, y * 11, 74)) * edge;
    if (rim > 0.3) {
      d = (0.45 + 0.5 * rim) * edge;
      m = 0.62;
    } else {
      d = dust;
      m = 1;
    }
  });
  return { d, m };
}

// ── the orion nebula ─────────────────────────────

function orion(x: number, y: number) {
  const r = Math.hypot(x, y);
  const th = Math.atan2(y, x);
  const wings = 0.5 + 0.36 * Math.cos(th * 2 + 0.8) + fbm(x * 2.4 + 3, y * 2.4, 81) * 0.7;
  let d = Math.max(0, wings * Math.exp(-r / 0.5) * 1.2 - 0.1) * (1 - smoothstep(0.82, 1.1, r));
  // The dark bay, a lane of dust cutting in beside the heart.
  d *= 1 - 0.9 * blob(x * 0.7 - y * 0.5, y, -0.22, -0.14, 0.13);
  let m = smoothstep(0.03, 0.62, r + (fbm(x * 3, y * 3, 83) - 0.5) * 0.25);
  // Off to one side, a strip of red gas with the dark shape of a horse's head against it.
  const strip = Math.exp(-(((y - 0.84 + (x - 0.72) * 0.25) / 0.09) ** 2)) * smoothstep(0.32, 0.5, x) * (1 - smoothstep(1.04, 1.18, x));
  if (strip > 0.01) {
    const hx = x - 0.72, hy = y - 0.84;
    const neck = Math.abs(hx + hy * 0.2) < 0.03 && hy > -0.03;
    const head = blob(hx, hy * 1.4, -0.005, -0.045, 0.04) > 0.55 || (hy > -0.06 && hy < -0.028 && hx > -0.075 && hx < 0);
    if (neck || head) return { d: 0, m: 1 };
    d += strip * (0.55 + 0.5 * noise(x * 9, y * 9, 84));
    m = Math.max(m, 0.86);
  }
  return { d, m };
}

// ── the places ───────────────────────────────────

export const DESTINATIONS: Destination[] = [
  {
    id: "andromeda", title: "andromeda", hello: "✦ andromeda · 2.5 million ly from home",
    stars: [214, 196, 186], density: 0.55, fog: [34, 22, 46],
    palette: [[120, 150, 240], [176, 182, 230], [255, 216, 160], [240, 110, 170]],
    field: andromeda,
    fixed: [],
    landmarks: [
      { name: "andromeda's core", fact: "a black hole of about 100 million suns", u: 0, v: 0 },
      { name: "m32", fact: "a small companion, stripped down by the big galaxy", u: 0.14, v: -0.2 },
      { name: "m110", fact: "a dwarf galaxy, one of many in its orbit", u: -0.42, v: 0.38 },
      { name: "home", fact: "from here our whole galaxy is a faint smudge", u: -0.62, v: -0.7, glyph: "·", colour: [255, 214, 150] },
    ],
  },
  {
    id: "milkyway", title: "the milky way", hello: "✦ the milky way · all of it, from outside",
    stars: [200, 208, 236], density: 0.5, fog: [18, 22, 44],
    palette: [GALAXY_ARM, GALAXY_CORE, GALAXY_NEBULA],
    field: milkyWay,
    fixed: [{ ...sol, glyph: "✦", colour: [255, 214, 150] }],
    landmarks: [
      { name: "you are here", fact: "one star of a few hundred billion: the sun", ...sol, glyph: "✦", colour: [255, 214, 150] },
      { name: "sagittarius a*", fact: "the black hole at the centre: 4 million suns", u: 0, v: 0 },
      { name: "orion arm", fact: "our home: a modest spur between two great arms", ...orionArm },
      { name: "magellanic clouds", fact: "small galaxies in orbit, seen from Earth's southern sky", u: 0.84, v: 0.66 },
    ],
  },
  {
    id: "pillars", title: "the pillars of creation", hello: "✦ the pillars of creation · 6,500 ly out",
    stars: [190, 226, 214], density: 1, fog: [10, 38, 40],
    palette: [[46, 140, 150], [96, 196, 170], [246, 202, 120], [92, 58, 44]],
    field: pillars,
    fixed: [
      { u: -0.47, v: -0.58, glyph: "*", colour: [255, 240, 210] },
      { u: 0.02, v: -0.2, glyph: "*", colour: [255, 240, 210] },
      { u: 0.42, v: 0.13, glyph: "*", colour: [255, 240, 210] },
      { u: -0.2, v: -0.72, glyph: "✦", colour: [220, 240, 255] },
      { u: 0.62, v: -0.45, glyph: "✦", colour: [220, 240, 255] },
    ],
    landmarks: [
      { name: "the pillars", fact: "columns of gas light-years tall, in the eagle nebula", u: -0.5, v: -0.15 },
      { name: "the tips", fact: "new stars are forming inside these fingers of dust", u: 0.02, v: -0.2, glyph: "*" },
      { name: "hubble's view", fact: "its 1995 photo made these the famous ones", u: 0.42, v: 0.3 },
    ],
  },
  {
    id: "orion", title: "the orion nebula", hello: "✦ the orion nebula · 1,300 ly out",
    stars: [216, 214, 232], density: 1, fog: [38, 16, 34],
    palette: [[206, 244, 232], [108, 208, 182], [240, 118, 150], [190, 52, 72]],
    field: orion,
    fixed: [
      { u: -0.018, v: -0.025, glyph: "✦", colour: [255, 255, 255] },
      { u: 0.022, v: -0.015, glyph: "*", colour: [255, 255, 255] },
      { u: -0.012, v: 0.022, glyph: "*", colour: [255, 255, 255] },
      { u: 0.024, v: 0.024, glyph: "*", colour: [255, 255, 255] },
      { u: 0.5, v: -0.84, glyph: "✦", colour: [200, 220, 255] },
      { u: 0.66, v: -0.72, glyph: "✦", colour: [200, 220, 255] },
      { u: 0.82, v: -0.6, glyph: "✦", colour: [200, 220, 255] },
    ],
    landmarks: [
      { name: "the trapezium", fact: "four young stars lighting up the whole nebula", u: 0, v: 0, glyph: "" },
      { name: "orion's belt", fact: "alnitak, alnilam, mintaka: you've seen them from home", u: 0.66, v: -0.72, glyph: "" },
      { name: "horsehead nebula", fact: "a dark cloud of dust against glowing red gas", u: 0.72, v: 0.8 },
      { name: "the nebula", fact: "about 1,300 light years away, our nearest big nursery", u: -0.45, v: 0.32 },
    ],
  },
];

/** The next stop, without moving on. */
export function nextDestination() {
  let i = 0;
  try { i = Number(localStorage.getItem(KEY)) || 0; } catch {}
  return DESTINATIONS[((i % DESTINATIONS.length) + DESTINATIONS.length) % DESTINATIONS.length];
}

/** Sets off for the next stop, and remembers to go somewhere else next time. */
export function takeDestination() {
  const dest = nextDestination();
  try { localStorage.setItem(KEY, String((DESTINATIONS.indexOf(dest) + 1) % DESTINATIONS.length)); } catch {}
  return dest;
}

/** The place's gas, worked out a few rows at a time so the flight doesn't stutter. */
export class PlaceMap {
  private rows = 0;
  private d = new Float32Array(MAP * MAP);
  private m = new Float32Array(MAP * MAP);
  /** The palette, stepped ahead of time: making colour strings per glyph is what would cost. */
  private inks: string[] = [];

  constructor(readonly dest: Destination) {
    const stops = dest.palette;
    for (let i = 0; i <= 32; i++) {
      const t = (i / 32) * (stops.length - 1);
      const at = Math.min(stops.length - 2, Math.floor(t)), k = t - at;
      const a = stops[at], b = stops[at + 1];
      this.inks.push(css([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]));
    }
  }

  build(count: number) {
    const { field } = this.dest;
    for (let n = 0; n < count && this.rows < MAP; n++, this.rows++) {
      const y = (this.rows / MAP) * 2 * SPAN - SPAN;
      for (let col = 0; col < MAP; col++) {
        const { d, m } = field((col / MAP) * 2 * SPAN - SPAN, y);
        this.d[this.rows * MAP + col] = d;
        this.m[this.rows * MAP + col] = m;
      }
    }
  }

  /** The place at radius R around (cx, cy): a soft glow while it's far off, its gas in glyphs as it nears. */
  draw(pen: Pen, w: number, h: number, cx: number, cy: number, R: number, alpha: number, time: number) {
    if (alpha < 0.02) return;
    const { ctx } = pen;
    const reach = R * SPAN;
    const glow = (1 - smoothstep(30, 150, R)) * alpha;
    if (glow > 0.01) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
      g.addColorStop(0, this.inks[20]);
      g.addColorStop(1, "transparent");
      ctx.globalAlpha = glow * 0.75;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.5, 0, TAU);
      ctx.fill();
    }
    const x0 = Math.max(0, cx - reach), x1 = Math.min(w, cx + reach), y0 = Math.max(0, cy - reach), y1 = Math.min(h, cy + reach);
    if (x1 <= x0 || y1 <= y0) return;
    const scale = Math.max(1, Math.sqrt((((x1 - x0) / 6.2) * ((y1 - y0) / 10.8)) / (MAX_CELLS * pen.detail)));
    const size = 10 * scale, cw = 6.2 * scale, ch = 10.8 * scale;
    ctx.font = `${size}px ${pen.family}`;
    const toMap = MAP / (2 * SPAN * R);
    const showing = smoothstep(14, 60, R);
    for (let y = Math.floor(y0 / ch) * ch; y <= y1; y += ch) {
      const row = Math.floor((y - cy) * toMap + MAP / 2);
      if (row < 0 || row >= MAP) continue;
      const iy = Math.round(y / ch);
      for (let x = Math.floor(x0 / cw) * cw; x <= x1; x += cw) {
        const col = Math.floor((x - cx) * toMap + MAP / 2);
        if (col < 0 || col >= MAP) continue;
        const d = this.d[row * MAP + col];
        if (d <= 0.01) continue;
        const ix = Math.round(x / cw);
        if (hash(ix, iy, 63) > d * 1.9) continue;
        // Every cell a little different, or smooth gas falls into rows of the same character.
        const grain = hash(ix, iy, 66);
        const tw = 0.82 + 0.18 * Math.sin(time * 1.3 + hash(ix, iy, 64) * TAU);
        ctx.globalAlpha = Math.min(1, (0.25 + 0.75 * Math.min(1, d)) * (0.7 + 0.3 * grain) * tw * alpha * showing);
        ctx.fillStyle = this.inks[Math.round(this.m[row * MAP + col] * 32)];
        ctx.fillText(GLYPHS[clamp(Math.round(d * 9 + (grain - 0.5) * 3.5), 1, 9)], x, y);
      }
    }
    if (R < 50) return;
    ctx.font = `${Math.round(clamp(R * 0.05, 11, 18))}px ${pen.family}`;
    for (const s of this.dest.fixed) pen.put(s.glyph, cx + s.u * R, cy + s.v * R, s.colour, alpha);
  }
}

const GLYPHS = " .·:-=+*#%@";
