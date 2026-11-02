/*
 * The stranger things you pass on the voyage (cosmos.ts): comets, debris, ships, pulsars, black holes, the wormhole and
 * a few things you'd recognise, each drawn in glyphs around a point on screen, what the planets are made of, and what
 * the ship's scanner has to say about all of it.
 */

import { RAMP, clamp, hash, lineGlyph, mix, noise, smoothstep, css, type Rgb } from "./engine";

export type SightKind =
  | "comet" | "asteroids" | "derelict" | "pulsar" | "blackhole" | "wormhole" | "remnant" | "binary" | "station" | "colony" | "convoy"
  | "voyager" | "hubble" | "webb" | "crab" | "paleblue";
export type Surface = "rocky" | "ice" | "lava" | "ocean" | "gas";
/** Everything the scanner can name, the ordinary worlds included. */
type Named = SightKind | "planet" | "ringed" | "nebula";

/** A speck shed by a comet, in flight space, so it stays where it was left as the comet moves on. */
export interface Bit { x: number; y: number; z: number; vx: number; vy: number; age: number; life: number; ion: boolean }
/** What a sight is made from. */
export interface Shape { seed: number; tilt: number; body: Rgb; band: Rgb; parts?: Bit[] }

/** What a sight needs from the cosmos to draw itself. */
export interface Pen {
  ctx: CanvasRenderingContext2D;
  family: string;
  time: number;
  put(ch: string, x: number, y: number, color: Rgb, alpha: number): void;
  project(x: number, y: number, z: number): { x: number; y: number };
  /** The share of the usual glyph cells to draw: lower on a device that can't keep up. */
  detail: number;
}

const TAU = Math.PI * 2;
const SPACE: Rgb = [4, 5, 11];
const WHITE: Rgb = [255, 244, 232];
const ICE: Rgb = [170, 226, 236];
const BLUE: Rgb = [150, 196, 255];
const STEEL: Rgb = [150, 158, 176];
const ROCK: Rgb = [168, 150, 132];
const RED: Rgb = [240, 92, 72];
const AMBER: Rgb = [240, 168, 92];
const GOLD: Rgb = [232, 190, 96];
const VIOLET: Rgb = [140, 112, 240];
const TEAL: Rgb = [70, 196, 204];
const EARTH: Rgb = [110, 170, 255];

const SCANS: Record<Named, { tag: (n: number) => string; facts: string[] }> = {
  planet: { tag: (n) => `world kx-${n}`, facts: ["thin air, no answer on any channel", "iron core, cold for a billion years", "storms older than your species", "oceans under the ice, maybe"] },
  ringed: { tag: (n) => `ringed giant rg-${n}`, facts: ["the rings are ice, and younger than the moons", "you could lose Earth in its bands", "more moons than the charts admit"] },
  nebula: { tag: (n) => `nebula ngc ${n}`, facts: ["a nursery: stars are lighting up inside", "mostly hydrogen, mostly nothing", "the ashes of a star, still spreading"] },
  comet: { tag: (n) => `comet c/${n}`, facts: ["dirty ice, on its one trip past", "the tail always points away from the star", "last came through before anyone was counting"] },
  asteroids: { tag: (n) => `debris field d-${n}`, facts: ["a world that never got to be one", "further apart than it looks", "metal-rich: someone will want this"] },
  derelict: { tag: (n) => `derelict sv-${n}`, facts: ["no power, no reply, one light still blinking", "the log's last entry: \"going to look\"", "hull breached from the inside"] },
  pulsar: { tag: (n) => `pulsar psr j${n}`, facts: ["a dead star, spinning faster than a drill", "keeps better time than any clock you own", "a city's width of star, a sun's worth of mass"] },
  blackhole: { tag: (n) => `black hole bh-${n}`, facts: ["the light you see left long ago", "no hurry: the time is slower over there", "the stars aren't moving, the sky is bending"] },
  wormhole: { tag: () => "wormhole", facts: ["unstable, unlisted: the far side has other colours", "the far side doesn't match the charts"] },
  remnant: { tag: (n) => `remnant snr ${n}`, facts: ["a star blew up here, and it's still going", "the iron in your blood came from one of these", "its shockwave is still spreading"] },
  binary: { tag: (n) => `binary hd ${n}`, facts: ["the small one is eating the big one", "two suns: every sunset comes twice", "they'll merge, given long enough"] },
  station: { tag: (n) => `ring station k-${n}`, facts: ["its spin gives the people inside their weight", "docking lights on, no one answering", "someone still pays the power bill"] },
  colony: { tag: (n) => `colony ship ark-${n}`, facts: ["ten thousand asleep, a century to go", "the grandchildren will get there", "built to arrive long after its builders"] },
  convoy: { tag: (n) => `convoy ${n}`, facts: ["ore haulers, in no hurry at all", "running lights only, keeping radio silence", "they flash a hello and carry on"] },
  voyager: { tag: () => "voyager 1", facts: ["launched 1977, the farthest thing we've ever made", "carries a golden record of the sounds of Earth"] },
  hubble: { tag: () => "hubble", facts: ["in orbit since 1990", "found thousands of galaxies in one dark patch of sky"] },
  webb: { tag: () => "james webb", facts: ["gold mirror 6.5 m wide, kept in the cold", "sees the infrared light of the earliest galaxies"] },
  crab: { tag: () => "crab nebula", facts: ["what's left of a supernova seen from Earth in 1054", "a pulsar still spins at its heart"] },
  paleblue: { tag: () => "the pale blue dot", facts: ["Earth, as Voyager saw it in 1990", "everyone you've ever known, on a speck in a sunbeam"] },
};

export function scanOf(kind: Named, seed: number) {
  const { tag, facts } = SCANS[kind];
  return { name: tag(seed), fact: facts[seed % facts.length] };
}

// ── comets ───────────────────────────────────────

/**
 * Sheds the comet's tail and moves what it has shed. Each speck is left behind in flight space, so the tail follows the
 * comet's real path, however it looks on screen: ion gas blows straight away from the star, dust lags and curves.
 */
export function stepComet(wd: Shape & { x: number; y: number; z: number; vx?: number }, dt: number, sx: number, sy: number, dz: number) {
  const parts = (wd.parts ??= []);
  const away = { x: Math.cos(wd.tilt), y: Math.sin(wd.tilt) };
  const due = Math.min(6, Math.ceil(dt * 60));
  for (let i = 0; i < due && parts.length < 260; i++) {
    const ion = Math.random() < 0.35;
    const push = ion ? 0.1 + Math.random() * 0.06 : 0.015 + Math.random() * 0.025;
    const side = (Math.random() - 0.5) * (ion ? 0.012 : 0.03);
    parts.push({
      x: wd.x, y: wd.y, z: wd.z,
      vx: away.x * push - away.y * side + (ion ? 0 : (wd.vx ?? 0) * 0.45),
      vy: away.y * push + away.x * side,
      age: 0, life: ion ? 1.6 + Math.random() : 2.8 + Math.random() * 1.6, ion,
    });
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    p.x += p.vx * dt - sx;
    p.y += p.vy * dt - sy;
    p.z -= dz;
    if (p.age > p.life || p.z < 0.06) parts.splice(i, 1);
  }
}

function comet(pen: Pen, wd: Shape, x: number, y: number, r: number, a: number) {
  const { ctx } = pen;
  const ionGlyph = lineGlyph(Math.cos(wd.tilt), Math.sin(wd.tilt));
  font(pen, 10);
  for (const p of wd.parts ?? []) {
    const at = pen.project(p.x, p.y, p.z);
    const k = p.age / p.life;
    if (p.ion) pen.put(ionGlyph, at.x, at.y, mix(ICE, BLUE, k), a * (1 - k) * 0.75);
    else pen.put(k < 0.3 ? "*" : k < 0.65 ? "·" : ".", at.x, at.y, mix(WHITE, AMBER, Math.min(1, k * 1.4)), a * (1 - k) ** 1.2 * 0.8);
  }
  // The coma: a soft glow, rather than a character sliding across the screen.
  const halo = Math.max(8, r * 1.5);
  const glow = ctx.createRadialGradient(x, y, 0, x, y, halo);
  glow.addColorStop(0, css(WHITE));
  glow.addColorStop(0.3, `rgba(${ICE.join(",")},0.5)`);
  glow.addColorStop(1, `rgba(${ICE.join(",")},0)`);
  ctx.globalAlpha = a * 0.9;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, halo, 0, TAU);
  ctx.fill();
  const core = Math.max(4, r * 0.7);
  solid(pen, x, y, core, 1, 1, (u, v) => {
    const round = ball(u, v);
    return round === null ? null : { lum: 0.55 + round * 0.45, col: mix(ICE, WHITE, round) };
  }, a);
}

// ── drawing ──────────────────────────────────────

export function drawSight(pen: Pen, kind: SightKind, wd: Shape, x: number, y: number, r: number, a: number) {
  const { seed, tilt } = wd;
  if (kind === "comet") comet(pen, wd, x, y, r, a);
  else if (kind === "asteroids") asteroids(pen, seed, tilt, x, y, r, a);
  else if (kind === "derelict") derelict(pen, seed, tilt, x, y, r, a);
  else if (kind === "pulsar") pulsar(pen, seed, x, y, r, a);
  else if (kind === "blackhole") blackHole(pen, tilt, x, y, r, a);
  else if (kind === "wormhole") wormhole(pen, wd, x, y, r, a);
  else if (kind === "remnant") remnant(pen, seed, x, y, r, a, RED, TEAL);
  else if (kind === "crab") remnant(pen, seed, x, y, r, a, AMBER, BLUE);
  else if (kind === "binary") binary(pen, seed, x, y, r, a);
  else if (kind === "station") station(pen, tilt, x, y, r, a);
  else if (kind === "colony") colony(pen, tilt, x, y, r, a);
  else if (kind === "convoy") convoy(pen, x, y, r, a);
  else if (kind === "voyager") voyager(pen, tilt, x, y, r, a);
  else if (kind === "hubble") hubble(pen, tilt, x, y, r, a);
  else if (kind === "webb") webb(pen, tilt, x, y, r, a);
  else paleBlue(pen, x, y, r, a);
}

const font = (pen: Pen, px: number) => { pen.ctx.font = `${Math.round(px)}px ${pen.family}`; };

/** What's at a point of a model: how bright (0 → 1) and what colour. Nothing there is null. */
type Fill = { lum: number; col: Rgb; add?: boolean } | null;
/** Most cells a single model gets; past this its glyphs get bigger instead. */
const MODEL_CELLS = 1500;

/**
 * Fills a model cell by cell, the same way the planets are drawn, so everything out here has the same weight: the glyph
 * grows with the model, its brightness picks the glyph, and the model says what's at each point, in units of r.
 */
function solid(pen: Pen, x: number, y: number, r: number, wide: number, tall: number, at: (u: number, v: number) => Fill, a: number, angle = 0) {
  if (r < 1) return;
  const budget = MODEL_CELLS * pen.detail;
  const rx = r * wide, ry = r * tall;
  let size = clamp(r / 14, 7, 26);
  const cells = ((2 * rx) / (size * 0.62)) * ((2 * ry) / (size * 1.08));
  if (cells > budget) size *= Math.sqrt(cells / budget);
  const cw = size * 0.62, ch = size * 1.08;
  font(pen, size);
  const c = Math.cos(angle), s = Math.sin(angle);
  // A turned model needs the corners of its turned box.
  const reachX = Math.abs(c) * rx + Math.abs(s) * ry, reachY = Math.abs(s) * rx + Math.abs(c) * ry;
  for (let py = Math.floor((y - reachY) / ch) * ch; py <= y + reachY; py += ch) {
    for (let px = Math.floor((x - reachX) / cw) * cw; px <= x + reachX; px += cw) {
      const dx = px - x, dy = py - y;
      const seen = at((dx * c + dy * s) / r, (-dx * s + dy * c) / r);
      if (!seen || seen.lum <= 0.02) continue;
      const lum = Math.min(1, seen.lum);
      pen.put(RAMP[clamp(Math.round(lum * 9), 1, 9)], px, py, seen.col, a * (0.25 + 0.75 * lum));
    }
  }
}

/** Light on a ball of radius 1 at (u, v), from the upper left as on the planets: 0 → 1, or null off its edge. */
function ball(u: number, v: number) {
  const d2 = u * u + v * v;
  if (d2 > 1) return null;
  return clamp(u * -0.6 + v * -0.45 + Math.sqrt(1 - d2) * 0.66, 0, 1);
}

/** Light across a tube lying along u, where v runs from -1 to 1 across it. */
const tube = (v: number) => clamp(v * -0.5 + Math.sqrt(Math.max(0, 1 - v * v)) * 0.72, 0.08, 1);

/** Tumbling rocks in a wide flat band with a gap down the middle, so you pass through with rock on both sides. */
function asteroids(pen: Pen, seed: number, tilt: number, x: number, y: number, r: number, a: number) {
  const c = Math.cos(tilt), s = Math.sin(tilt);
  const count = Math.round(44 * pen.detail);
  for (let i = 0; i < count; i++) {
    const th = hash(i, seed, 3) * TAU + pen.time * 0.03;
    const out = 0.45 + hash(i, seed, 4) * 1.3;
    const u = Math.cos(th) * r * out, v = Math.sin(th) * r * out * 0.4;
    const px = x + u * c - v * s, py = y + u * s + v * c;
    const big = hash(i, seed, 5);
    const rock = r * (0.035 + big * big * 0.13);
    if (px < -rock || py < -rock || px > pen.ctx.canvas.clientWidth + rock || py > pen.ctx.canvas.clientHeight + rock) continue;
    const lump = seed + i * 7, base = mix(ROCK, STEEL, hash(i, seed, 6));
    const spin = pen.time * (0.2 + big * 0.5) + i;
    solid(pen, px, py, Math.max(4, rock), 1.3, 1.3, (nu, nv) => {
      const turnU = nu * Math.cos(spin) - nv * Math.sin(spin), turnV = nu * Math.sin(spin) + nv * Math.cos(spin);
      const edge = 0.74 + noise(turnU * 1.8 + lump, turnV * 1.8, 44) * 0.56;
      const round = ball(nu / edge, nv / edge);
      if (round === null) return null;
      return { lum: 0.14 + round * 0.86, col: mix(base, SPACE, noise(turnU * 4 + lump, turnV * 4, 45) * 0.45) };
    }, a);
  }
}

/** A long hull broken in two, its ribs showing where the plating's gone, with one light still working. */
function derelict(pen: Pen, seed: number, tilt: number, x: number, y: number, r: number, a: number) {
  const angle = tilt * 0.3 + Math.sin(pen.time * 0.15) * 0.08;
  const blink = Math.sin(pen.time * 3) > 0.55;
  solid(pen, x, y, r, 1.7, 0.7, (u, v) => {
    // The stern has drifted away from the rest, at a slight angle.
    const stern = u > 0.62;
    const lu = stern ? u - 0.1 : u, lv = stern ? v - 0.1 - (u - 0.62) * 0.14 : v;
    if (lu > 0.5 && lu < 0.62) return null;
    if (lu < -1.45 || lu > 1.42) return null;
    const half = lu < -1 ? 0.34 * ((lu + 1.45) / 0.45) ** 0.7 : lu > 1.1 ? 0.24 : 0.34;
    const hull = Math.abs(lv) / half;
    if (hull < 1) {
      const gone = noise(lu * 2.6 + seed, lv * 4, 46);
      // Where the plating's torn away, ribs against the dark.
      if (gone > 0.62) return Math.sin(lu * 28) > 0.2 ? { lum: 0.34, col: mix(STEEL, RED, 0.25) } : { lum: 0.06, col: STEEL };
      const panel = Math.sin(lu * 14) > 0.86 ? 0.65 : 1;
      if (blink && Math.hypot(lu + 0.75, lv + 0.12) < 0.07) return { lum: 1, col: RED };
      return { lum: tube(hull * Math.sign(lv)) * panel, col: mix(STEEL, ROCK, noise(lu * 5, lv * 5, 47)) };
    }
    // The bridge, and a mast sticking up from it.
    if (lu > -0.65 && lu < -0.25 && lv < -0.3 && lv > -0.52) return { lum: 0.72 - (lv + 0.52), col: STEEL };
    if (Math.abs(lu + 0.45) < 0.03 && lv < -0.5 && lv > -0.68) return { lum: 0.5, col: STEEL };
    return null;
  }, a, angle);
}

/** A turning wheel seen at an angle: a thick rim with lit windows, four spokes, and a hub. */
function station(pen: Pen, tilt: number, x: number, y: number, r: number, a: number) {
  const squash = 0.42, spin = pen.time * 0.18;
  solid(pen, x, y, r, 1.25, 1.25, (u, v) => {
    const flatV = v / squash;
    const e = Math.hypot(u, flatV);
    const round = ball(u / 0.24, v / 0.24);
    if (round !== null) return { lum: 0.2 + round * 0.8, col: mix(STEEL, WHITE, round * 0.5) };
    const across = (e - 1) / 0.17;
    if (Math.abs(across) < 1) {
      const t = Math.atan2(flatV, u) + spin;
      const slot = Math.floor(((t + TAU) % TAU) * 7.6);
      // A row of windows round the inner face, most of them lit.
      if (across > -0.55 && across < 0.05 && slot % 2 === 0 && hash(slot, 9, 21) > 0.3) return { lum: 1, col: AMBER };
      const seg = Math.sin(t * 24) > 0.8 ? 0.6 : 1;
      return { lum: clamp(tube(across * Math.sign(v || 1)) * seg, 0.12, 0.9), col: STEEL };
    }
    if (e < 0.86) {
      const t = Math.atan2(flatV, u) + spin;
      const spoke = Math.abs(Math.sin(t * 2));
      if (spoke * e < 0.055) return { lum: 0.42, col: STEEL };
    }
    return null;
  }, a, tilt * 0.6);
}

/** A long spine of sleeping drums, a prow at one end and engines at the other. */
function colony(pen: Pen, tilt: number, x: number, y: number, r: number, a: number) {
  const burn = 0.8 + 0.2 * Math.sin(pen.time * 9);
  solid(pen, x, y, r, 1.95, 0.62, (u, v) => {
    if (u < -1.55 || u > 1.85) return null;
    // Engines, burning at the stern.
    if (u > 1.5) {
      const plume = 1 - (u - 1.5) / 0.35;
      for (const n of [-0.2, 0, 0.2]) if (Math.abs(v - n) < 0.07 * plume) return { lum: burn * plume, col: mix(WHITE, BLUE, 1 - plume) };
      return null;
    }
    if (u > 1.22) {
      const h = Math.abs(v) / 0.3;
      return h < 1 ? { lum: tube(h * Math.sign(v)) * 0.7, col: STEEL } : null;
    }
    if (u < -1.1) {
      const h = Math.abs(v) / (0.26 * ((u + 1.55) / 0.45) ** 0.6);
      return h < 1 ? { lum: tube(h * Math.sign(v)), col: mix(STEEL, WHITE, 0.3) } : null;
    }
    // Drums on a thinner spine, each ringed with windows.
    const drum = Math.abs((((u + 1.1) / 0.58) % 1) - 0.5) < 0.38;
    const half = drum ? 0.34 : 0.12;
    const h = Math.abs(v) / half;
    if (h > 1) return null;
    if (drum && Math.sin(v * 26) > 0.72 && Math.sin(u * 44) > 0.2) return { lum: Math.sin(u * 3 + v * 40) > -0.5 ? 1 : 0.18, col: AMBER };
    return { lum: tube(h * Math.sign(v)) * (drum ? 1 : 0.6), col: drum ? mix(STEEL, BLUE, 0.18) : STEEL };
  }, a, tilt * 0.2);
}

/** Small haulers in loose formation, each with its cargo blocks and a blink of running light passing down the line. */
function convoy(pen: Pen, x: number, y: number, r: number, a: number) {
  const spots = [[-1.25, -0.28], [-0.4, 0.26], [0.45, -0.2], [1.3, 0.3]];
  const scale = 0.42;
  solid(pen, x, y, r, 1.9, 0.85, (u, v) => {
    for (let i = 0; i < spots.length; i++) {
      const lu = (u - spots[i][0]) / scale, lv = (v - spots[i][1]) / scale;
      if (Math.abs(lu) > 1 || Math.abs(lv) > 0.55) continue;
      if (lu > 0.82) return Math.abs(lv) < 0.14 ? { lum: 0.85 + 0.15 * Math.sin(pen.time * 8 + i), col: BLUE } : null;
      if (lu < -0.6) {
        if (Math.abs(lv) > 0.3 * ((lu + 1) / 0.4)) return null;
        if (Math.sin(pen.time * 2.2 - i * 0.9) > 0.6 && lu < -0.86) return { lum: 1, col: RED };
        return { lum: tube(lv / 0.3), col: mix(STEEL, WHITE, 0.35) };
      }
      if (Math.abs(lv) > 0.42) return null;
      const block = Math.floor((lu + 1) * 3.2);
      return { lum: tube(lv / 0.42) * (Math.sin(lu * 20) > 0.84 ? 0.5 : 1), col: mix(STEEL, hash(block, i, 51) > 0.5 ? AMBER : ROCK, 0.45) };
    }
    return null;
  }, a);
}

/** Voyager: the big white dish, the small instrument box under it, and its long booms. */
function voyager(pen: Pen, tilt: number, x: number, y: number, r: number, a: number) {
  solid(pen, x, y, r, 1.45, 1.05, (u, v) => {
    const dish = Math.hypot(u / 0.62, (v + 0.46) / 0.3);
    if (dish < 1 && v < -0.36) return { lum: 0.42 + (1 - dish) * 0.58, col: mix(WHITE, STEEL, dish * 0.5) };
    if (Math.abs(u) < 0.26 && v > -0.34 && v < 0.08) return { lum: tube((v + 0.13) / 0.21) * (Math.sin(u * 28) > 0.6 ? 0.65 : 1), col: GOLD };
    // The boom to its power source on one side, and the long one for the magnetometer on the other.
    if (u < -0.24 && u > -0.88 && Math.abs(v + 0.1 + (u + 0.24) * 0.24) < 0.03) return { lum: 0.55, col: STEEL };
    if (u < -0.8 && u > -1.05 && Math.abs(v - 0.05) < 0.08) return { lum: 0.75, col: AMBER };
    if (u > 0.24 && u < 1.4 && Math.abs(v + 0.08 - (u - 0.24) * 0.16) < 0.022) return { lum: 0.5, col: STEEL };
    if (Math.abs(u + 0.08) < 0.022 && v > 0.08 && v < 0.85) return { lum: 0.4, col: STEEL };
    return null;
  }, a, tilt * 0.3);
}

/** Hubble: a silver tube with its door open, and two blue panels either side. */
function hubble(pen: Pen, tilt: number, x: number, y: number, r: number, a: number) {
  solid(pen, x, y, r, 1.2, 1.15, (u, v) => {
    if (u > -0.2 && u < 0.08 && Math.abs(v) > 0.3 && Math.abs(v) < 1.05) {
      return { lum: Math.sin(v * 34) > 0.72 || Math.sin(u * 50) > 0.8 ? 0.25 : 0.62, col: BLUE };
    }
    if (Math.abs(u + 0.06) < 0.02 && Math.abs(v) < 0.3) return { lum: 0.45, col: STEEL };
    // The narrow rear and the wide light-gathering front.
    const half = u > 0.28 ? 0.2 : 0.28;
    if (u < -1.05 || u > 1 || Math.abs(v) > half) {
      // The door, standing open at the front.
      if (u < -1 && u > -1.18 && v < -0.05 && v > -0.42) return { lum: 0.55, col: STEEL };
      return null;
    }
    if (u < -0.96) return { lum: 0.08, col: SPACE };
    return { lum: tube(v / half) * (Math.sin(u * 16) > 0.84 ? 0.55 : 1), col: mix(STEEL, WHITE, 0.45) };
  }, a, tilt * 0.3);
}

/** Webb: a honeycomb of gold mirrors, its diamond sunshield in layers below. */
function webb(pen: Pen, tilt: number, x: number, y: number, r: number, a: number) {
  solid(pen, x, y, r, 1.4, 1.2, (u, v) => {
    const my = v + 0.5, size = 0.2;
    // Which hexagon of the mirror this falls in.
    const qf = (u * 0.577 - my * 0.333) / (size * 0.577), rf = (my * 0.667) / (size * 0.577);
    let q = Math.round(qf), w = Math.round(rf);
    const sf = -qf - rf, sr = Math.round(sf);
    const dq = Math.abs(q - qf), dw = Math.abs(w - rf), ds = Math.abs(sr - sf);
    if (dq > dw && dq > ds) q = -w - sr;
    else if (dw > ds) w = -q - sr;
    if (Math.max(Math.abs(q), Math.abs(w), Math.abs(q + w)) <= 2 && Math.hypot(u, my) < 0.72) {
      const face = 0.55 + hash(q + 5, w + 5, 52) * 0.4;
      const edge = Math.max(dq, dw, ds) > 0.42;
      return { lum: edge ? 0.18 : face, col: edge ? AMBER : GOLD };
    }
    if (Math.abs(u) < 0.03 && v > 0.15 && v < 0.5) return { lum: 0.45, col: STEEL };
    // The shield: thin layers, widest in the middle.
    if (v > 0.42 && v < 1.08) {
      const half = 1.32 * (1 - Math.abs(v - 0.72) / 0.36);
      if (Math.abs(u) < half) return { lum: 0.5 + 0.2 * Math.sin(v * 44), col: mix(VIOLET, WHITE, 0.4) };
    }
    return null;
  }, a, tilt * 0.3);
}

/** A point of light in a knot of its own hot wind, with two tight beams sweeping round it like a lighthouse. */
function pulsar(pen: Pen, seed: number, x: number, y: number, r: number, a: number) {
  const angle = pen.time * 2.4 + seed;
  const beat = 0.5 + 0.5 * Math.sin(pen.time * 19);
  solid(pen, x, y, r, 2.4, 2.4, (u, v) => {
    const d = Math.hypot(u, v);
    if (d > 2.4) return null;
    const wind = (noise(u * 1.7 + seed, v * 1.7, 53) - 0.28 - d * 0.22) * 2.2;
    if (d < 0.7) return { lum: 1 - d * 0.6 + beat * 0.15, col: mix(WHITE, BLUE, d) };
    return wind > 0 ? { lum: wind * (0.75 + 0.25 * beat), col: mix(BLUE, VIOLET, d / 2.4) } : null;
  }, a);
  font(pen, clamp(r * 0.2, 10, 15));
  for (const side of [0, Math.PI]) {
    const dx = Math.cos(angle + side), dy = Math.sin(angle + side);
    const length = r * 11;
    const steps = Math.min(44, Math.ceil(length / 8));
    const g = lineGlyph(dx, dy);
    for (let i = 2; i <= steps; i++) {
      const t = i / steps;
      const across = length * t * 0.03;
      pen.put(g, x + dx * length * t, y + dy * length * t, mix(WHITE, BLUE, t), a * (1 - t) ** 1.1);
      if (pen.detail < 1) continue;
      pen.put(g, x + dx * length * t - dy * across, y + dy * length * t + dx * across, BLUE, a * (1 - t) ** 1.5 * 0.6);
      pen.put(g, x + dx * length * t + dy * across, y + dy * length * t - dx * across, BLUE, a * (1 - t) ** 1.5 * 0.6);
    }
  }
}

/** A hole in the sky with a sharp bright lip, its disc of hot gas brighter on the side turning toward you, the far side bent up over the top. */
function blackHole(pen: Pen, tilt: number, x: number, y: number, r: number, a: number) {
  const { ctx } = pen;
  ctx.globalAlpha = a;
  ctx.fillStyle = css(SPACE);
  ctx.beginPath();
  ctx.arc(x, y, r * 1.08, 0, TAU);
  ctx.fill();
  const spin = pen.time * 0.5;
  solid(pen, x, y, r, 3.1, 1.95, (u, v) => {
    const d = Math.hypot(u, v);
    const e = Math.hypot(u, v / 0.27);
    const onDisc = e > 1.5 && e < 3.1;
    // In front of the hole the disc crosses it; behind, the hole hides it.
    if (d < 1.08 && !(onDisc && v > 0)) return null;
    if (d < 1.22) return { lum: 1, col: mix(AMBER, WHITE, 0.85) };
    const th = Math.atan2(v / 0.27, u);
    const hot = 0.22 + 0.78 * smoothstep(-1, 1, Math.cos(th));
    // The far side's light, bent up over the top.
    const arch = v < 0 ? Math.max(0, 1 - Math.abs(d - 1.5) / 0.3) : Math.max(0, 1 - Math.abs(d - 1.3) / 0.1) * 0.5;
    const streak = noise(th * 3 - spin, e * 2.6, 54);
    const disc = onDisc ? (1 - Math.abs(e - 2.15) / 0.95) * (0.5 + streak) : 0;
    const lum = Math.max(arch * (0.45 + streak * 0.5), disc) * hot * 1.25;
    return lum > 0.03 ? { lum, col: mix(RED, mix(AMBER, WHITE, hot), clamp(lum * 1.4, 0, 1)) } : null;
  }, a, tilt);
}

/** A swirl falling in on itself, with the colours of the other side showing through the opening. */
function wormhole(pen: Pen, wd: Shape, x: number, y: number, r: number, a: number) {
  const { ctx } = pen;
  const inner = ctx.createRadialGradient(x, y, 0, x, y, r);
  inner.addColorStop(0, css(wd.body));
  inner.addColorStop(1, `rgba(${wd.band.join(",")},0.05)`);
  ctx.globalAlpha = a * 0.4;
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  solid(pen, x, y, r, 1.14, 1.14, (u, v) => {
    const d = Math.hypot(u, v);
    if (d > 1.12) return null;
    if (d > 0.93) return { lum: 1 - (d - 0.93) * 3, col: mix(wd.body, WHITE, 0.45) };
    const th = Math.atan2(v, u);
    // Arms winding inward, turning as they go.
    const arm = 0.5 + 0.5 * Math.sin(th * 3 + Math.log(d + 0.05) * 7 + pen.time * 1.6);
    const n = noise(th * 2 + pen.time * 0.2, d * 5, 55);
    return { lum: arm ** 2 * (0.25 + n * 0.75) + (1 - d) ** 3, col: mix(wd.band, mix(wd.body, WHITE, (1 - d) ** 2), 1 - d) };
  }, a);
  font(pen, clamp(r * 0.3, 12, 30));
  pen.put("✧", x, y, WHITE, a);
}

/** The shell of a star that blew up: thick glowing filaments spreading from a point that's still lit. */
function remnant(pen: Pen, seed: number, x: number, y: number, r: number, a: number, hot: Rgb, cool: Rgb) {
  solid(pen, x, y, r, 1.25, 1.1, (u, v) => {
    const d = Math.hypot(u, v / 0.86);
    if (d > 1.22) return null;
    const dirU = u / (d || 1), dirV = v / (d || 1);
    const warp = noise(dirU * 2 + seed, dirV * 2 + d * 1.6, 56);
    const ridge = 1 - Math.abs(noise(dirU * 4 + warp * 2 + seed, dirV * 4 + d * 3, 57) - 0.5) * 4.4;
    const shell = Math.exp(-(((d - 0.8) / 0.3) ** 2)) + 0.4 * Math.exp(-((d / 0.45) ** 2));
    const lum = Math.max(0, ridge) * shell * 1.15;
    return lum > 0.08 ? { lum, col: mix(cool, hot, smoothstep(0.4, 0.95, d + (warp - 0.5) * 0.3)) } : null;
  }, a);
  font(pen, clamp(r * 0.2, 10, 24));
  pen.put("✦", x, y, WHITE, a * (0.65 + 0.35 * Math.sin(pen.time * 5)));
}

/** A big warm star and a small hot one going round each other, with a thick stream of gas from the first into the second. */
function binary(pen: Pen, seed: number, x: number, y: number, r: number, a: number) {
  const orbit = pen.time * 0.35 + seed;
  const ax = -Math.cos(orbit) * 0.55, ay = -Math.sin(orbit) * 0.2;
  const bx = Math.cos(orbit) * 1.25, by = Math.sin(orbit) * 0.45;
  const big = 0.78;
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  // The stream, as points along its curve, since asking every cell how far it is from a curve exactly would cost more.
  const stream = Array.from({ length: 14 }, (_, i) => {
    const t = (i + 1) / 15, bow = Math.sin(t * Math.PI) * 0.34;
    return { x: ax + dx * t - (dy / len) * bow, y: ay + dy * t + (dx / len) * bow, t };
  });
  solid(pen, x, y, r, 1.8, 1.1, (u, v) => {
    const round = ball((u - ax) / big, (v - ay) / big);
    if (round !== null) {
      const cell = noise((u - ax) * 5 + seed, (v - ay) * 5 + pen.time * 0.1, 58);
      return { lum: 0.32 + round * 0.68 * (0.65 + cell * 0.55), col: mix(RED, GOLD, round) };
    }
    const b = Math.hypot(u - bx, v - by);
    if (b < 0.13) return { lum: 1, col: WHITE };
    const disc = Math.hypot(u - bx, (v - by) / 0.36);
    if (disc < 0.42) return { lum: 0.9 - disc, col: mix(WHITE, BLUE, disc * 2) };
    for (const p of stream) {
      if (Math.hypot(u - p.x, v - p.y) < 0.075 + (1 - p.t) * 0.05) return { lum: 0.7, col: mix(GOLD, BLUE, p.t) };
    }
    return null;
  }, a);
}

/** Barely anything: one blue speck, hanging in a broad band of scattered sunlight. */
function paleBlue(pen: Pen, x: number, y: number, r: number, a: number) {
  solid(pen, x, y, r, 6, 6, (u, v) => {
    const along = u * 0.82 + v * 0.57, across = -u * 0.57 + v * 0.82;
    const width = 0.75 + noise(along * 0.8, 3, 59) * 0.5;
    if (Math.abs(across) > width || Math.abs(along) > 5.6) return null;
    return { lum: (1 - Math.abs(across) / width) * (1 - Math.abs(along) / 5.6) * 0.34 * (0.5 + noise(along * 3, across * 3, 60)), col: GOLD };
  }, a);
  const { ctx } = pen;
  const halo = ctx.createRadialGradient(x, y, 0, x, y, 12);
  halo.addColorStop(0, css(EARTH));
  halo.addColorStop(1, `rgba(${EARTH.join(",")},0)`);
  ctx.globalAlpha = a * 0.8;
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, TAU);
  ctx.fill();
  font(pen, 14);
  pen.put("•", x, y, EARTH, a);
}

// ── what the worlds are made of ──────────────────

const SURFACE_COLOURS: Record<Exclude<Surface, "gas">, [Rgb, Rgb]> = {
  rocky: [[176, 140, 110], [96, 76, 66]],
  ice: [[214, 232, 244], [110, 160, 208]],
  lava: [[62, 44, 44], [255, 136, 54]],
  ocean: [[52, 112, 196], [116, 148, 92]],
};
export const SURFACES: Surface[] = ["rocky", "ice", "lava", "ocean", "gas"];
export const surfaceColours = (surface: Surface, gas: [Rgb, Rgb]): [Rgb, Rgb] => (surface === "gas" ? gas : SURFACE_COLOURS[surface]);

/** A world's colour at a point on its disc, and how much of that light is its own (a lava seam still shows at night). */
export function worldAt(surface: Surface, wd: Shape, nx: number, ny: number, nz: number, time: number): { col: Rgb; glow: number } {
  // Wrapped round the sphere and slowly turning, rather than painted flat on the disc.
  const lon = nx / (nz + 0.45) + time * 0.012, lat = ny / (nz + 0.45);
  const { seed, body, band } = wd;
  if (surface === "gas") {
    const flow = noise(lon * 1.6 + seed, ny * 3, 33) * 1.3;
    const stripes = 0.5 + 0.5 * Math.sin(ny * 13 + flow * 2.4 + seed);
    const sx = (lon - 0.3) / 0.34, sy = (ny - 0.28) / 0.13;
    const storm = Math.exp(-(sx * sx + sy * sy));
    const col = mix(mix(body, band, stripes), RED, storm * 0.8);
    return { col: storm > 0.3 ? mix(col, WHITE, Math.max(0, Math.sin(sx * 5 + sy * 5)) * 0.2) : col, glow: 0 };
  }
  if (surface === "rocky") {
    const ground = noise(lon * 3 + seed, lat * 3, 34);
    const gx = lon * 4.5 + seed, gy = lat * 4.5;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    const dx = gx - ix - 0.5 - (hash(ix, iy, 35) - 0.5) * 0.4, dy = gy - iy - 0.5 - (hash(ix, iy, 36) - 0.5) * 0.4;
    const size = 0.1 + hash(ix, iy, 37) * 0.3;
    const d = Math.hypot(dx, dy) / size;
    const crater = hash(ix, iy, 38) > 0.42 ? (d < 0.8 ? 0.5 : d < 1.05 ? -0.35 : 0) : 0;
    return { col: mix(mix(body, band, smoothstep(0.3, 0.7, ground)), crater > 0 ? band : WHITE, Math.abs(crater)), glow: 0 };
  }
  if (surface === "ice") {
    const crack = Math.abs(noise(lon * 3.4 + seed, lat * 3.4, 39) - 0.5);
    const polar = smoothstep(0.55, 0.95, Math.abs(ny));
    return { col: mix(mix(body, WHITE, polar * 0.7), band, crack < 0.035 ? 0.9 : 0), glow: 0 };
  }
  if (surface === "lava") {
    const seam = Math.abs(noise(lon * 3 + seed, lat * 3, 40) - 0.5);
    const hot = 1 - smoothstep(0.015, 0.075, seam);
    return { col: mix(body, mix(band, [255, 226, 130], hot * hot), hot), glow: hot * 0.9 };
  }
  const land = noise(lon * 2.4 + seed, lat * 2.4, 41);
  const cloud = noise(lon * 3 + seed + time * 0.02, lat * 6, 42);
  const col = mix(land > 0.56 ? band : body, WHITE, smoothstep(0.58, 0.72, cloud) * 0.85);
  return { col, glow: 0 };
}
