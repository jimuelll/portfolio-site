/*
 * The hero printed on the GPU: the moon, sun and Earth of the sky page, and the light around them (the moon's glow,
 * the sun's glow, rays, rim and almanac rings, the eclipse corona), in fine glyphs the 2D canvas couldn't afford.
 *
 * Two passes per body. Shade works out each glyph cell's colour from four looks inside it. Print picks the glyph by
 * brightness from an atlas and draws the light around the body cell by cell. Everything comes out see-through, so
 * the engine draws this canvas into its own at the point where the body belongs and the rest of the sky stays as it
 * was. All positions are the engine's: CSS pixels, y down.
 */

import type { Rgb } from "./engine";

type V3 = [number, number, number];
interface Layer { x: number; y: number; r: number; alpha: number }
/** halo: how much of the ring round the moon shows now (0 to 1). */
export interface MoonLayer extends Layer { light: V3; lib: [number, number]; lit: number; glow: number; hov: number; bump: number; halo: number }
/**
 * A star in the day's nebula, lighting the dust round it. lit: how bright (0 while it's still forming); pull: how hard
 * the dust is swirling in to make it; echo: how far its light echo has spread (CSS px, 0 for none) and how strong it is.
 */
export interface NebulaStar { x: number; y: number; lit: number; pull: number; echo: number; echoK: number }
/**
 * x, y, r: the sun, which lights the day's nebula; w, h: the page; masks: discs in front of it (moon, sun, Earth)
 * where it doesn't show; the rest, how much of each shows.
 */
export interface BackdropLayer extends Layer { w: number; h: number; masks: { x: number; y: number; r: number }[]; milky: number; nebula: number; day: number; stars: NebulaStar[]; pan: { x: number; y: number } }
export interface SunLayer extends Layer {
  /** false: only the light round it, for the corner of the plate the inner pages show. */
  disc: boolean;
  spin: number; boil: number; ink: number; rays: number;
  hov: number; hovAngle: number; occ: { x: number; y: number } | null; spots: { c: V3; size: number; k: number }[]; warm: Rgb;
}
export interface CoronaLayer extends Layer { strength: number }
export type EarthLayer = Layer;
type Box = { left: number; top: number; right: number; bottom: number };

/** Glyph cell height against its width, as the site's mono font sets it. */
const CELL_ASPECT = 1.74;
const MAX_SPOTS = 8;
const MAX_DIMS = 8;
/** Under page content the sky is dimmed to this (DIM_UNDER_CONTENT in engine.ts). */
const DIM = 0.12;
/** How far round page content (CSS px) the backdrop eases back in. */
const CALM = 160;
/** Bodies the backdrop hides behind at once (the zoom has two). */
const MAX_MASKS = 3;
/** Stars lighting the day's nebula at once: the fixed ones and the ones clicked into being (engine.ts). */
export const MAX_NEBULA_STARS = 12;

const VERT = "attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }";

const NOISE = `
float h1(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 h3(vec3 p) { return vec3(h1(p), h1(p + 17.31), h1(p + 41.7)); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h1(i), h1(i + vec3(1,0,0)), f.x), mix(h1(i + vec3(0,1,0)), h1(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h1(i + vec3(0,0,1)), h1(i + vec3(1,0,1)), f.x), mix(h1(i + vec3(0,1,1)), h1(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { if (i >= uLoop) break; s += a * vnoise(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
`;

const SHADE = `
precision highp float;
uniform vec2 uRes, uCell, uC;
uniform float uRad, uKind, uTime;
uniform vec3 uL;
uniform vec2 uLib;
uniform float uLit, uBump;
uniform float uSpin, uBoil;
uniform vec4 uSpot[${MAX_SPOTS}];
uniform float uSpotK[${MAX_SPOTS}];
uniform sampler2D uLand;
uniform float uMilky, uNebula, uDay;
uniform vec2 uScreen, uPan;
uniform vec4 uStar[${MAX_NEBULA_STARS}], uStarB[${MAX_NEBULA_STARS}];
// Always 99: a loop bound the compiler can't see, so it keeps the loop rather than copying its body out each time.
// On Windows (Direct3D) every copied height() made the moon's shader take seconds to compile.
uniform int uLoop;
${NOISE}

// Craters at one scale: bowl, raised rim, a skirt of ejecta. Only the 2x2x2 cells nearest the point can reach it.
float craters(vec3 p, float f, float seed, float dens) {
  vec3 q = p * f, i = floor(q), o = step(0.5, fract(q)) - 1.0;
  float h = 0.0;
  for (int x = 0; x < 2; x++) for (int y = 0; y < 2; y++) for (int z = 0; z < 2; z++) {
    vec3 c = i + o + vec3(x, y, z);
    vec3 r = h3(c + seed);
    if (r.x > dens) continue;
    float rad = mix(0.16, 0.46, r.y * r.y);
    vec3 cp = c + 0.25 + 0.5 * h3(c + seed + 9.1);
    float d = length(q - cp) / rad;
    if (d > 2.2) continue;
    float bowl = d < 1.0 ? (d * d - 1.0) * 0.85 : 0.0;
    float rim = exp(-pow((d - 1.0) * 4.0, 2.0)) * 0.32;
    float skirt = d > 1.0 ? exp(-(d - 1.0) * 3.0) * 0.07 : 0.0;
    h += (bowl + rim + skirt) * rad / f;
  }
  return h;
}
float height(vec3 s, float smoothness) {
  // Four scales (frequency, seed, density, weight), through one craters().
  float h = 0.0;
  for (int k = 0; k < 4; k++) {
    if (k >= uLoop) break;
    vec4 c = k == 0 ? vec4(3.5, 1.0, 0.55, 1.0) : k == 1 ? vec4(9.0, 7.0, 0.5, 1.0) : k == 2 ? vec4(22.0, 13.0, 0.42, 1.0) : vec4(48.0, 23.0, 0.35, 0.8);
    h += craters(s, c.x, c.y, c.z) * c.w;
  }
  return h * (1.0 - 0.55 * smoothness);
}
// Libration, as drawMoon's toSurface.
vec3 lib(vec3 v) {
  float cx = cos(uLib.x), sx = sin(uLib.x), cy = cos(uLib.y), sy = sin(uLib.y);
  float px = v.x * cx + v.z * sx, pz = -v.x * sx + v.z * cx;
  return vec3(px, v.y * cy - pz * sy, v.y * sy + pz * cy);
}

vec4 moon(vec2 n2) {
  float d2 = dot(n2, n2);
  if (d2 > 1.0) return vec4(0.0);
  vec3 s = lib(vec3(n2, sqrt(1.0 - d2)));
  vec3 Ls = lib(uL), Vs = lib(vec3(0.0, 0.0, 1.0));
  float mare = smoothstep(0.47, 0.58, fbm(s * 1.3 + 3.0) * 0.75 + vnoise(s * 3.1) * 0.25);
  vec3 t1 = normalize(cross(s, vec3(0.0, 1.0, 0.001))), t2 = cross(s, t1);

  // Cast shadows: walk toward the sun along the ground; any rise steeper than the sun's elevation blocks it.
  float geo = dot(s, Ls);
  vec3 Lt = Ls - s * geo;
  float ltl = length(Lt);
  float sunUp = geo / max(ltl, 1e-3);
  bool casts = geo > -0.14 && geo < 0.6 && ltl > 1e-3;
  Lt /= max(ltl, 1e-3);
  // Every height this point needs, through one height(): the point and two neighbours for its slope, then the steps
  // of the shadow walk.
  float e = 0.0025, h = 0.0, hx = 0.0, hy = 0.0, shadow = 1.0, dist = 0.0, stepLen = 0.008;
  for (int j = 0; j < 10; j++) {
    if (j >= uLoop || (j >= 3 && !casts)) break;
    if (j >= 3) { dist += stepLen; stepLen *= 1.45; }
    vec3 at = j == 0 ? s : j == 1 ? normalize(s + t1 * e) : j == 2 ? normalize(s + t2 * e) : normalize(s + Lt * dist);
    float hj = height(at, mare);
    if (j == 0) h = hj;
    else if (j == 1) hx = (hj - h) / e;
    else if (j == 2) hy = (hj - h) / e;
    else shadow = min(shadow, smoothstep(-0.03, 0.03, sunUp - (hj - h) * uBump / dist));
  }
  vec3 N = normalize(s - (t1 * hx + t2 * hy) * uBump);

  // A young crater's bright rays.
  vec3 T = normalize(vec3(-0.15, 0.62, 0.77));
  float far = acos(clamp(dot(s, T), -1.0, 1.0));
  vec3 ta = normalize(cross(T, vec3(0.0, 0.0, 1.0))), tb = cross(T, ta);
  float ang = atan(dot(s, tb), dot(s, ta));
  float rays = smoothstep(0.55, 0.9, vnoise(vec3(cos(ang), sin(ang), 0.0) * 13.0)) * exp(-far * 2.4) * step(0.035, far);

  float alb = mix(1.0, 0.5, mare) * (0.88 + (fbm(s * 9.0) - 0.5) * 0.4 + (vnoise(s * 40.0) - 0.5) * 0.12) + rays * 0.4;
  float mu0 = dot(N, Ls), mu = max(dot(N, Vs), 0.05);
  // Lommel-Seeliger, so a full moon is flat rather than a ball, with a little Lambert to keep the terminator readable.
  float lit = mix(max(mu0, 0.0) / (max(mu0, 0.0) + mu) * 2.0, max(mu0, 0.0) * 1.3, 0.35) * smoothstep(-0.14, 0.04, geo) * uLit;
  // Earthshine on the dark side; it stays through an eclipse, so the moon still reads as a silhouette.
  float shine = (1.0 - smoothstep(-0.1, 0.1, geo) * uLit) * 0.07 * alb;
  float b = clamp(pow(alb * lit * shadow * 0.7, 0.9), 0.0, 1.0);
  // Seas vary: some bluer (titanium-rich), some browner.
  vec3 sea = mix(vec3(0.52, 0.6, 0.78), vec3(0.66, 0.6, 0.54), smoothstep(0.35, 0.65, vnoise(s * 2.2 + 11.0)));
  vec3 col = mix(vec3(0.886, 0.902, 0.933), sea, mare);
  col = mix(col, vec3(0.36, 0.478, 0.73), (1.0 - smoothstep(0.0, 0.35, geo)) * 0.55);
  col = mix(col, vec3(1.0, 0.94, 0.84), smoothstep(0.72, 1.0, b) * 0.45);
  return vec4(col * b + vec3(0.42, 0.55, 0.85) * shine, 1.0);
}

// Granules: cells of rising gas with dark lanes between, each centre drifting so the surface boils.
float granules(vec3 p, float t) {
  vec3 i = floor(p), f = fract(p);
  float F1 = 8.0, F2 = 8.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 o = vec3(x, y, z), h = h3(i + o);
    vec3 pt = o + 0.5 + 0.38 * sin(t * (0.5 + h) + h * 6.2831);
    float d = length(pt - f);
    if (d < F1) { F2 = F1; F1 = d; } else if (d < F2) F2 = d;
  }
  return smoothstep(0.0, 0.32, F2 - F1) * (1.0 - F1 * 0.35);
}
// A sunspot: dark umbra, then a penumbra of radial filaments.
float spot(vec3 n, vec3 c, float size, float k) {
  float d = acos(clamp(dot(n, c), -1.0, 1.0));
  if (d > size * 1.3 || k < 0.01) return 1.0;
  vec3 ta = normalize(cross(c, vec3(0.0, 1.0, 0.0))), tb = cross(c, ta);
  float ang = atan(dot(n, tb), dot(n, ta));
  float fil = 0.55 + 0.45 * vnoise(vec3(cos(ang) * 9.0, sin(ang) * 9.0, d * 18.0));
  float pen = 1.0 - smoothstep(size * 0.75, size, d + (vnoise(vec3(ang * 3.0, 1.0, 2.0)) - 0.5) * size * 0.25);
  float umbra = 1.0 - smoothstep(size * 0.3, size * 0.45, d);
  return mix(1.0, mix(mix(1.0, 0.55 * fil, pen), 0.1, umbra), k);
}
// r: brightness as the soft (eclipse) sun shows it; g: granulation; b: how dark the spots make it.
vec4 sun(vec2 n2) {
  float d2 = dot(n2, n2);
  if (d2 > 1.0) return vec4(0.0);
  float mu = sqrt(1.0 - d2);
  vec3 n = vec3(n2, mu);
  // The surface turns with the spots (spotCentre in engine.ts).
  float cs = cos(uSpin), sn = sin(uSpin);
  vec3 s = vec3(n.x * cs - n.z * sn, n.y, n.x * sn + n.z * cs);
  float g = granules(s * 15.0, uBoil) * 0.7 + vnoise(s * 4.0 + uBoil * 0.05) * 0.3;
  float limb = 1.0 - 0.6 * (1.0 - mu) - 0.2 * (1.0 - mu) * (1.0 - mu);
  float spots = 1.0;
  for (int i = 0; i < ${MAX_SPOTS}; i++) spots *= spot(n, uSpot[i].xyz, uSpot[i].w, uSpotK[i]);
  // Faculae: bright patches that only show near the limb.
  float fac = smoothstep(0.62, 0.8, fbm(s * 6.0 + 5.0)) * smoothstep(0.55, 0.15, mu) * 0.35;
  float b = clamp(limb * (0.62 + 0.45 * g) * spots + fac, 0.0, 1.0);
  return vec4(b, g, 1.0 - spots, 1.0);
}

// Earth, as drawEarth: turning once in 70 s on its tilted axis, lit from the upper left.
const vec3 EL = vec3(-0.7796, -0.2999, 0.5497);
vec3 earthSurf(vec2 n2, out float lat, out float lon) {
  float ct = cos(0.41), st = sin(0.41), nz = sqrt(max(0.0, 1.0 - dot(n2, n2)));
  lat = asin(clamp(-(n2.x * st + n2.y * ct), -1.0, 1.0));
  lon = atan(n2.x * ct - n2.y * st, nz) + uTime * 6.2831853 / 70.0;
  return vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
}
float cloudAt(vec3 s) { return smoothstep(0.46, 0.66, fbm(s * 2.3 + vec3(uTime * 0.012, 0.0, uTime * 0.006))); }
// The sun just peeking past Earth's edge, creeping slowly along it: a bright rim and a small starburst.
vec3 sunrise(vec2 n2, float d) {
  float a0 = atan(EL.y, EL.x) + 0.22 * sin(uTime * 0.021);
  vec2 at = vec2(cos(a0), sin(a0));
  float ang = atan(n2.y, n2.x);
  float rim = exp(-pow((d - 1.0) / 0.022, 2.0)) * pow(max(0.0, cos(ang - a0)), 14.0);
  vec2 off = n2 - at * 1.01;
  float r = length(off), a = atan(off.y, off.x);
  float burst = exp(-r * 28.0) + pow(abs(cos(a * 3.0 + uTime * 0.05)), 60.0) * exp(-r * 7.0) * 0.8;
  return vec3(1.0, 0.86, 0.62) * (rim * 1.1 + burst);
}
// Aurora: curtains rising off the limb round the north pole (up, along Earth's tilt), rippling slowly, green into violet.
vec3 aurora(vec2 n2, float d) {
  vec2 pole = -vec2(sin(0.41), cos(0.41));
  float polar = smoothstep(0.3, 0.75, dot(n2 / d, pole));
  if (polar < 0.01 || d < 1.0 || d > 1.42) return vec3(0.0);
  float ang = atan(n2.y, n2.x);
  float curtain = smoothstep(0.4, 0.8, vnoise(vec3(ang * 26.0 + sin(ang * 7.0 + uTime * 0.3) * 1.5, uTime * 0.18, 3.0)));
  float h = (d - 1.0) / 0.42;
  float body = smoothstep(0.0, 0.06, h) * (1.0 - smoothstep(0.2, 1.0, h));
  return mix(vec3(0.25, 1.0, 0.55), vec3(0.62, 0.36, 0.95), smoothstep(0.2, 0.8, h)) * curtain * body * polar;
}
vec4 earth(vec2 n2) {
  float d2 = dot(n2, n2);
  if (d2 > 1.0) {
    // A thin blue atmosphere round the edge, brightest on the sunlit side.
    float d = sqrt(d2);
    vec3 extra = aurora(n2, d) + sunrise(n2, d);
    if (d > 1.16) return vec4(extra, 1.0);
    float k = 1.0 - (d - 1.0) / 0.16;
    float side = smoothstep(-0.4, 0.6, dot(n2 / d, normalize(EL.xy)));
    return vec4(vec3(0.49, 0.77, 1.0) * k * k * (0.15 + 0.6 * side) + extra, 1.0);
  }
  float nz = sqrt(1.0 - d2);
  vec3 n = vec3(n2, nz);
  float lat, lon;
  vec3 s = earthSurf(n2, lat, lon);
  float lam = dot(n, EL), day = smoothstep(-0.08, 0.16, lam);
  vec2 uv = vec2(fract(lon / 6.2831853 + 0.5), 0.5 - lat / 3.14159265);
  // The land bitmap is coarse, so it's read smoothly and its edge roughened: coasts come out organic, not blocky.
  float land = smoothstep(0.44, 0.56, texture2D(uLand, uv).r + (fbm(s * 11.0) - 0.5) * 0.45);
  float alat = abs(lat);
  float ice = max(smoothstep(1.18, 1.26, alat), land * smoothstep(1.04, 1.12, alat));
  float cl = cloudAt(s);
  // Cloud shadows fall a little away from the sun.
  float la, lo;
  float shade = cloudAt(earthSurf(n2 + EL.xy * 0.025, la, lo)) * (1.0 - cl);
  float dry = clamp(smoothstep(0.4, 0.68, vnoise(s * 5.0 + 9.0)) * 0.7 + (alat < 0.5 ? 0.25 : 0.0), 0.0, 1.0);
  vec3 ground = mix(vec3(96.0, 170.0, 98.0), vec3(196.0, 168.0, 108.0), dry) / 255.0;
  vec3 sea = mix(vec3(36.0, 78.0, 160.0), vec3(84.0, 156.0, 228.0), 0.3 + 0.5 * nz) / 255.0;
  vec3 surf = mix(mix(sea, ground, land), vec3(226.0, 236.0, 248.0) / 255.0, ice);
  float sunlit = max(lam, 0.0);
  vec3 dayc = surf * (0.22 + 0.62 * sunlit) * (1.0 - shade * 0.5);
  // The sun's glint on open water.
  vec3 hv = normalize(EL + vec3(0.0, 0.0, 1.0));
  dayc += vec3(1.0, 0.95, 0.85) * pow(max(dot(n, hv), 0.0), 60.0) * (1.0 - land) * (1.0 - cl) * 0.55;
  dayc = mix(dayc, vec3(0.94, 0.96, 0.99) * (0.3 + 0.62 * sunlit), cl);
  // Blue haze toward the limb, and a warm band along the terminator.
  dayc = mix(dayc, vec3(0.49, 0.77, 1.0) * (0.4 + 0.6 * sunlit), pow(1.0 - nz, 2.2) * 0.75);
  dayc = mix(dayc, vec3(0.75, 0.42, 0.25), smoothstep(0.22, 0.0, lam) * 0.4);
  // Night: the land faintly, and cities, fixed to the ground so they turn with it.
  vec3 night = mix(vec3(0.02, 0.03, 0.07), vec3(0.1, 0.13, 0.22), land * 0.7);
  float people = land * (1.0 - ice) * (1.0 - cl * 0.85) * smoothstep(0.35, 0.65, vnoise(s * 7.0 + 3.0));
  float hc = h1(vec3(floor(uv * vec2(360.0, 180.0)), 71.0));
  if (hc < 0.4 * people) night += vec3(1.0, 0.81, 0.48) * (0.6 + 0.4 * sin(uTime * 2.0 + hc * 60.0)) * 0.95;
  // Alpha 0.5 marks open water, which the print pass draws as swells.
  float water = (1.0 - land) * (1.0 - ice) * step(cl, 0.4);
  return vec4(mix(night, dayc, day) + sunrise(n2, sqrt(d2)), 1.0 - 0.5 * water);
}

// The night sky behind everything: rgb is the glow of the Milky Way's star clouds and the nebula; a is how thick the
// band's stars are there, for the print pass to scatter them.
vec4 backdrop(vec2 p) {
  // Placed on the page, not on the moon, in screen heights so it spans any screen alike.
  vec2 q = p / uScreen.y;
  // The band crosses the whole sky, falling to the lower right from high on the left.
  vec2 dir = normalize(vec2(1.0, 0.45)), nrm = vec2(-dir.y, dir.x);
  vec2 r = q - vec2(0.48 * uScreen.x, 0.16 * uScreen.y) / uScreen.y;
  // Its clouds and lanes drift slowly along it; the band itself stays where it is.
  float along = dot(r, dir) + uTime * 0.0035, across = dot(r, nrm) + (fbm(vec3(along * 2.2, 3.0, 0.0)) - 0.5) * 0.2;
  float width = 0.17 + 0.05 * sin(along * 3.1 + 1.0);
  float band = exp(-pow(across / width, 2.0));
  vec2 bq = vec2(along, across);
  float clouds = fbm(vec3(bq * 6.0, 0.0));
  // Dark dust lanes down the middle, as in the real one.
  float lane = smoothstep(0.5, 0.72, fbm(vec3(bq * 9.0 + 4.0, 1.0))) * exp(-pow(across / (width * 0.4), 2.0));
  float m = band * (0.3 + 0.9 * clouds) * (1.0 - lane * 0.85) * uMilky;
  vec3 col = mix(vec3(0.5, 0.58, 0.85), vec3(1.0, 0.9, 0.74), exp(-pow(across / (width * 0.45), 2.0))) * m * 0.3;
  float stars = band * (1.0 - lane * 0.75) * uMilky * 0.8;
  // Faint gas far behind, violet into teal, mostly on the right of the page.
  vec3 g = vec3(q * 2.4 + vec2(uTime * 0.003, 0.0), 7.0);
  float neb = smoothstep(0.5, 0.8, fbm(g)) * smoothstep(0.15, 0.65, p.x / uScreen.x);
  col += mix(vec3(0.46, 0.26, 0.68), vec3(0.14, 0.5, 0.56), fbm(vec3(q * 1.6, 9.0))) * neb * 0.36 * uNebula;
  return vec4(col, stars);
}

// The day's nebula: billowing dust that drifts and folds over itself, with fine filaments. q in units of the sun's
// radius; oct: how many octaves (the shadow walk only needs the broad shapes).
float dust(vec2 q, int oct) {
  q /= 1.1;
  vec2 w = vec2(vnoise(vec3(q * 0.6 + vec2(uTime * 0.018, 0.0), 1.0)), vnoise(vec3(q * 0.6 + vec2(3.1, -uTime * 0.014), 2.0))) - 0.5;
  q += w * 1.8 + vec2(uTime * 0.01, 0.0);
  float a = 0.55, f = 0.0;
  vec3 p = vec3(q, 5.0);
  for (int i = 0; i < 3; i++) { if (i >= uLoop || i >= oct) break; f += a * vnoise(p); p = p * 2.03 + 1.7; a *= i == 0 ? 0.545 : 0.5; }
  if (oct < 3) f += 0.075;
  float ridge = 1.0 - abs(2.0 * vnoise(vec3(q * 1.4 + vec2(7.0, -2.0), 3.0)) - 1.0);
  return clamp(smoothstep(0.3, 0.74, f) * 0.85 + pow(ridge, 6.0) * 0.45 * smoothstep(0.3, 0.6, f), 0.0, 1.0);
}
// r: sunlight reaching this bit of dust (after the dust between it and the sun), g: the stars' light, b: a light echo
// passing through, all /3; a: how thick the dust is.
vec4 dayNebula(vec2 p) {
  vec2 sp = p, rel = p - uC;
  float boost = 0.0;
  // A star being born: the dust round it spirals in.
  for (int i = 0; i < ${MAX_NEBULA_STARS}; i++) {
    if (i >= uLoop) break;
    float pull = uStarB[i].x;
    if (pull <= 0.0) continue;
    vec2 d = p - uStar[i].xy;
    float R = uRad * 0.7, dl = length(d);
    if (dl > R) continue;
    float f = (1.0 - dl / R) * (1.0 - dl / R) * pull, a = f * 2.4, sc = 1.0 + f * 1.6;
    sp = uStar[i].xy + mat2(cos(a), sin(a), -sin(a), cos(a)) * d * sc;
    boost += f * 0.5;
  }
  float q = length(rel) / uRad;
  // The walk toward the sun: step 0 is the point itself, the rest add up the dust in the way.
  float d = 0.0, tau = 0.0;
  for (int j = 0; j < 7; j++) {
    if (j >= uLoop || (j > 0 && q <= 1.0)) break;
    float u = float(j) / 6.0;
    vec2 at = j == 0 ? sp : uC + rel * mix(1.0, 1.0 / q, u);
    float dj = dust(at / uRad, j == 0 ? 3 : 2);
    if (j == 0) d = clamp(dj + boost, 0.0, 1.0);
    else tau += dj * (q - 1.0) / 6.0 * 1.25;
  }
  d *= smoothstep(0.9, 1.02, q);
  float sunL = exp(-tau) * 1.5 / (0.5 + 0.22 * q * q);
  float starL = 0.0, echoL = 0.0;
  for (int i = 0; i < ${MAX_NEBULA_STARS}; i++) {
    if (i >= uLoop) break;
    float ds = length(p - uStar[i].xy);
    starL += uStar[i].z * 0.9 * exp(-ds / (uRad * 0.42));
    if (uStar[i].w > 0.0) echoL += uStarB[i].y * 3.0 * exp(-pow((ds - uStar[i].w) / (uRad * 0.16), 2.0));
  }
  return vec4(clamp(vec3(sunL, starL, echoL) / 3.0, 0.0, 1.0), d);
}

void main() {
  // Each texel is a quarter of a glyph cell, so the print pass's linear sample averages four looks per cell.
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uCell * 0.5;
  vec2 n2 = (p - uC) / uRad;
  // A page change pans the backdrop (uPan, CSS px): it's worked out where that part of the sky now is, so it never runs out.
  // One body per program (SHADE_BODIES fills this in), so each compiles on its own.
  gl_FragColor = BODY;
}`;

/** The shade pass's bodies, by layer kind (moon 0, sun 1, Earth 2, backdrop 4): each its own program. */
const SHADE_BODIES: [number, string][] = [[0, "moon(n2)"], [1, "sun(n2)"], [2, "earth(n2)"], [4, "uDay > 0.5 ? dayNebula(p - uPan) : backdrop(p - uPan)"]];

const PRINT = `
precision highp float;
uniform sampler2D uShade, uAtlas;
uniform vec2 uRes, uCellD, uGrid, uC;
uniform float uRatio, uCount, uKind, uTime, uAlpha, uRad, uHov, uHovAng;
uniform float uGlowLit;
uniform float uInk, uRays, uBoil, uStrength, uDisc;
uniform vec3 uOcc, uWarm;
uniform vec4 uDim[${MAX_DIMS}];
uniform float uDimN, uDimHard, uShimmer;
uniform vec2 uPtr;
uniform float uMilky, uNebula, uDay, uHaloK;
uniform vec2 uScreen, uPan;
uniform vec4 uMask[${MAX_MASKS}];
const float TAU = 6.2831853;
const vec3 SUN_LIMB = vec3(150.0, 44.0, 34.0) / 255.0, SUN_MID = vec3(206.0, 92.0, 40.0) / 255.0, SUN_CORE = vec3(222.0, 150.0, 40.0) / 255.0;
const vec3 SPOT = vec3(74.0, 36.0, 30.0) / 255.0;
const vec3 MOON_BRIGHT = vec3(226.0, 230.0, 238.0) / 255.0, MOON_COOL = vec3(128.0, 182.0, 240.0) / 255.0;
const vec3 CORONA_IN = vec3(255.0, 240.0, 214.0) / 255.0, CORONA_OUT = vec3(242.0, 186.0, 84.0) / 255.0;
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash(vec2(i, 7.0)), hash(vec2(i + 1.0, 7.0)), f); }
float n2d(vec2 x) {
  vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// The shade target's rows run bottom up; cells here run top down, like the engine's.
vec4 S(vec2 ci) { return texture2D(uShade, vec2((ci.x + 0.5) / uGrid.x, 1.0 - (ci.y + 0.5) / uGrid.y)); }
float glyph(float idx, vec2 f) { return texture2D(uAtlas, vec2((idx + f.x) / uCount, 1.0 - f.y)).r; }
// After the ramp's ten: 10 |, 11 /, 12 -, 13 \\, 14 ~, 15 ·, 16 *. As lineGlyph in engine.ts, y down.
float lineIdx(vec2 d) {
  float l = length(d);
  return abs(d.y) < 0.38 * l ? 12.0 : abs(d.x) < 0.38 * l ? 10.0 : d.x * d.y > 0.0 ? 13.0 : 11.0;
}
// Glyphs for the day's dust and sun, light to heavy (. · : + * # % @), leaving out - and =, which in rows read as ruled lines.
float dustIdx(float lv) { return lv < 0.5 ? 0.0 : lv < 1.5 ? 1.0 : lv < 2.5 ? 15.0 : lv < 3.5 ? 2.0 : lv < 4.5 ? 5.0 : lv < 5.5 ? 6.0 : lv < 6.5 ? 7.0 : lv < 7.5 ? 8.0 : 9.0; }
vec4 over(vec4 src, vec4 dst) { return src + dst * (1.0 - src.a); }
vec4 ink(float idx, vec2 f, vec3 col, float a) { float g = glyph(idx, f) * clamp(a, 0.0, 1.0); return vec4(col * g, g); }

// The moon and Earth: light on a dark sky.
vec4 lit(vec2 ci, vec2 f, vec2 pc) {
  vec4 c = S(ci);
  float L = luma(c.rgb);
  // The surface breathes: cells near a step in the ramp flick between neighbours, a few at a time.
  float tick = floor(uTime * 3.0 + hash(ci) * 7.0);
  float Lq = L + (hash(ci + tick * 17.13) - 0.5) * 0.06;
  float idx = floor(clamp(Lq * 1.15, 0.0, 0.999) * 10.0);
  if (L > 0.02) idx = max(idx, 1.0);
  if (L < 0.006) idx = 0.0;
  float cover = c.a;
  if (uKind > 1.5 && c.a > 0.01) {
    // Open water: tiny ~ fuse into lines, so only swell crests get one, drifting across, with dots between.
    float water = clamp((1.0 - c.a) * 2.0, 0.0, 1.0);
    cover = min(1.0, c.a * 2.0);
    float swell = sin(ci.x * 0.55 - ci.y * 1.7 + sin(ci.x * 0.07 - ci.y * 0.31) * 2.0 - uTime * 1.3) + (hash(ci + 5.0) - 0.5) * 0.9;
    if (water > 0.5 && L < 0.6) idx = L < 0.02 ? 0.0 : Lq > 0.11 && swell > 0.35 ? 14.0 : Lq > 0.2 ? 2.0 : 1.0;
  }
  // The rim dissolves: partly covered cells drop out at random instead of being cut by a hard circle.
  if (cover < 0.999 && hash(ci * 1.7 + 3.1) > cover * 1.1) idx = 0.0;
  vec3 tint = clamp(mix(vec3(L), c.rgb, 1.25), 0.0, 1.0) * (1.0 + (1.0 - L) * 0.6);
  vec3 col = tint * (0.1 * step(0.01, cover) + glyph(idx, f) * 1.05);
  // Bloom: rings of taps a few cells out, bright parts only.
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7854;
    vec2 d = vec2(cos(a), sin(a));
    vec4 p1 = S(ci + floor(d * 3.0 + 0.5)), p2 = S(ci + floor(d * 7.0 + 0.5));
    glow += p1.rgb * smoothstep(0.35, 0.9, luma(p1.rgb)) * 0.6 + p2.rgb * smoothstep(0.3, 0.9, luma(p2.rgb)) * 0.4;
  }
  col += glow / 8.0 * 0.32;
  // The moon's halo (drawMoonGlow): sparse twinkling dots that thin out with distance.
  if (uKind < 0.5 && uGlowLit > 0.02 && c.a < 0.01) {
    float d = length(pc - uC) / uRad;
    float fall = exp(-(d - 1.0) * 4.2);
    if (d > 1.02 && d < 1.55 + uHov * 0.15 && hash(ci + 9.0) < 0.25 + fall * 0.5) {
      float tw = 0.65 + 0.35 * sin(uTime * 0.9 + hash(ci + 10.0) * TAU);
      float g = fall > 0.6 ? 2.0 : fall > 0.3 ? 15.0 : 1.0;
      col += mix(MOON_BRIGHT, MOON_COOL, clamp((d - 1.0) * 1.6, 0.0, 1.0)) * glyph(g, f) * 0.3 * fall * tw * uGlowLit * (1.0 + uHov * 0.4);
    }
  }
  // Now and then high ice cloud makes a ring round the moon: thin and icy, reddish on its inner edge, as a real halo is.
  if (uKind < 0.5 && uHaloK > 0.01 && c.a < 0.01) {
    float d = length(pc - uC) / uRad;
    float ring = exp(-pow((d - 1.9) / 0.035, 2.0)) * (0.75 + 0.25 * n2d(vec2(atan(pc.y - uC.y, pc.x - uC.x) * 3.0, uTime * 0.1)));
    if (hash(ci + 41.0) < ring * 0.85) {
      float tw = 0.7 + 0.3 * sin(uTime * 1.3 + hash(ci + 42.0) * TAU);
      col += mix(vec3(1.0, 0.6, 0.5), vec3(0.8, 0.9, 1.0), smoothstep(1.86, 1.94, d)) * glyph(ring > 0.6 ? 2.0 : 15.0, f) * 0.4 * ring * tw * uHaloK * uGlowLit;
    }
  }
  col = clamp(col, 0.0, 1.0);
  return vec4(col, max(col.r, max(col.g, col.b)));
}

// The sun: soft by eclipse, printed in ink by day (uInk cross-fades), with its glow, rim, rays and rings.
vec4 sun(vec2 ci, vec2 f, vec2 pc, vec2 pp) {
  if (uOcc.z > 0.5 && length(pp - uOcc.xy) < uRad) return vec4(0.0);
  vec4 o = vec4(0.0);
  float cw = uCellD.x / uRatio, ch = uCellD.y / uRatio;
  // The printed body is a smooth disc under the grid, so its edge is round, not stepped by cells.
  if (uInk > 0.01 && uDisc > 0.5) {
    vec2 rp = pp - uC;
    float cover = 1.0 - smoothstep(uRad - 0.75, uRad + 0.75, length(rp));
    float k = clamp(length(rp / uRad + vec2(0.25)) / 1.25, 0.0, 1.0);
    vec3 body = k < 0.6 ? mix(vec3(255.0, 252.0, 236.0), vec3(255.0, 236.0, 186.0), k / 0.6) / 255.0
                        : mix(vec3(255.0, 236.0, 186.0), vec3(246.0, 164.0, 84.0), (k - 0.6) / 0.4) / 255.0;
    float a = mix(0.85, 0.55, k) * uInk * cover;
    o = vec4(body * a, a);
  }
  vec2 rel = pc - uC;
  float dist = length(rel), d = dist / uRad, ang = atan(rel.y, rel.x);
  if (d < 1.0) {
    if (uDisc < 0.5) return o;
    vec4 c = S(ci);
    float b = c.r, g = c.g, dark = c.b;
    float depth = sqrt(sqrt(1.0 - d * d));
    float edge = smoothstep(0.0, 0.55, depth);
    float hot = smoothstep(0.55, 1.0, depth) * 0.5 + clamp(g - 0.6, 0.0, 1.0) * 0.5;
    float tick = floor(uTime * 3.0 + hash(ci) * 7.0);
    float jit = (hash(ci + tick * 17.13) - 0.5) * 0.06;
    // Soft: brighter glyphs where it's hotter.
    float si = max(1.0, floor(clamp(b + jit, 0.0, 0.999) * 10.0));
    vec3 soft = mix(mix(mix(SUN_LIMB, SUN_MID, edge), SUN_CORE, hot), SPOT, dark * 0.8);
    o = over(ink(si, f, soft, (0.35 + 0.55 * b) * (1.0 - uInk)), o);
    // By day the granules are printed in warm glyphs over the bright body: heavier toward the limb and in the spots.
    float limb = 1.0 - sqrt(1.0 - d * d);
    float bb = clamp(0.25 + limb * 0.75 + (g - 0.5) * 0.6 + dark * 0.8 + jit, 0.0, 1.0);
    vec3 ic = mix(mix(vec3(226.0, 150.0, 60.0) / 255.0, vec3(178.0, 64.0, 30.0) / 255.0, limb), SPOT, dark * 0.9);
    o = over(ink(dustIdx(0.6 + bb * 6.5), f, ic, (0.12 + 0.5 * bb * bb) * uInk), o);
    return o;
  }
  float idx = -1.0, a = 0.0;
  vec3 col = SUN_MID;
  if (uRays > 0.02) {
    // The glow round it (drawSunGlow): radial hatching in ink, soft dots otherwise.
    float fall = exp(-(d - 1.0) * 3.4);
    // By day the glow is a wash under the nebula (engine.ts); these dots are the eclipse's.
    if (d > 1.03 && d < 1.75 && hash(ci + 12.0) < 0.14 + fall * 0.5) {
      idx = fall > 0.6 ? 2.0 : fall > 0.3 ? 15.0 : 1.0;
      col = mix(SUN_MID, SUN_CORE, fall);
      a = 0.34 * fall * uRays * (1.0 + uHov * 0.5) * (1.0 - uInk);
    }
    // A dotted rim.
    if (abs(dist - uRad * 1.08) < ch * 0.5 && fract(ang * uRad * 1.08 / (cw * 2.6)) < 0.5) {
      idx = 15.0; col = uWarm; a = 0.5 * uRays * (1.0 - uInk);
    }
    // By day, fine streamers combed out from the limb, each flickering slowly in length.
    if (uInk > 0.01 && d > 1.0) {
      float stepA = TAU / 140.0, i = floor(ang / stepA + 0.5);
      float len = (0.25 + pow(hash(vec2(i, 7.0)), 2.0) * 1.1) * (0.85 + 0.15 * n1(i * 1.3 + uTime * 0.2));
      float k = (d - 1.02) / len;
      if (k > 0.0 && k < 1.0 && abs(dist * sin(ang - i * stepA)) < cw * 0.55) {
        idx = k < 0.33 ? lineIdx(rel) : 15.0; col = vec3(214.0, 128.0, 50.0) / 255.0;
        a = pow(1.0 - k, 1.6) * (0.25 + 0.75 * hash(vec2(i, 3.0))) * 0.6 * uInk * uRays;
      }
    }
    // Plain rays (the eclipse's sun): flickering in length, reaching toward the cursor.
    float q2 = dist - uRad * 1.18;
    if (uInk < 0.99 && q2 > 0.0) {
      float stepA = TAU / 28.0, u = ang - uTime * 0.03;
      float i = floor(u / stepA + 0.5), im = mod(i + 280.0, 28.0);
      float perp = dist * sin(u - i * stepA);
      float reach = 1.0 + uHov * 0.9 * pow(max(0.0, cos(i * stepA + uTime * 0.03 - uHovAng)), 4.0);
      float len = uRad * (mod(im, 2.0) < 0.5 ? 0.42 : 0.22) * (0.6 + 0.4 * n1(im * 1.7 + uBoil * 0.9)) * reach;
      float k = q2 / len;
      if (k < 1.0 && abs(perp) < cw * 0.55) { idx = lineIdx(rel); col = uWarm; a = (1.0 - k) * 0.75 * uRays * (1.0 - uInk); }
    }
  }
  if (idx >= 0.0) o = over(ink(idx, f, col, a), o);
  return o;
}

// The calm round the card: 0 on page content, easing to 1 some way off, so the backdrop never competes with the text.
float calm(vec2 pp) {
  float k = 1.0;
  for (int i = 0; i < ${MAX_DIMS}; i++) {
    if (float(i) >= uDimN) break;
    vec4 b = uDim[i];
    vec2 d = max(max(b.xy - pp, pp - b.zw), 0.0);
    k = min(k, smoothstep(0.0, ${CALM}.0, length(d)));
  }
  return k;
}

// The day's nebula, lit by the sun: warm near it, blue further out, dusky violet where the dust is in shadow.
const vec3 LIT_WARM = vec3(255.0, 214.0, 140.0) / 255.0, LIT_BLUE = vec3(96.0, 150.0, 236.0) / 255.0, LIT_ECHO = vec3(150.0, 220.0, 255.0) / 255.0;
const vec3 DUSK = vec3(104.0, 104.0, 188.0) / 255.0;
const vec3 DUST_WARM = vec3(232.0, 132.0, 36.0) / 255.0, DUST_BLUE = vec3(36.0, 100.0, 228.0) / 255.0, DUST_LANE = vec3(92.0, 72.0, 160.0) / 255.0;
const vec3 DUST_ECHO = vec3(30.0, 150.0, 210.0) / 255.0;
vec4 dayNebula(vec2 ci, vec2 pc, vec2 pp, vec2 f) {
  float q = length(pc - uC) / uRad;
  // A faint wash of the light under the glyphs, read smoothly between cells so it has no grid in it.
  vec2 g = pp * uRatio / uCellD;
  vec4 s = texture2D(uShade, vec2(g.x / uGrid.x, 1.0 - g.y / uGrid.y));
  vec3 Ls = s.rgb * 3.0;
  float lum = Ls.r + Ls.g + Ls.b;
  vec3 litCol = mix(mix(LIT_BLUE, LIT_WARM, (1.0 - smoothstep(1.05, 2.4, q)) * Ls.r / (lum + 1e-4)), LIT_ECHO, (Ls.b + Ls.g * 0.5) / (lum + 1e-4));
  float b = clamp(s.a * lum * 0.85, 0.0, 1.0), shade = s.a * clamp(1.0 - lum, 0.0, 1.0);
  float wa = clamp(b * 0.3 + shade * 0.1, 0.0, 0.38);
  vec4 o = vec4(mix(DUSK, litCol, b / (b + shade * 0.6 + 1e-4)) * wa, wa);
  // The dust itself, printed: heavier where it's thicker and better lit, flicking between neighbouring glyphs now and then.
  vec4 c = S(ci);
  float d = c.a;
  if (d < 0.06) return o;
  vec3 L = c.rgb * 3.0;
  float l = L.r + L.g + L.b;
  float tick = floor(uTime * 2.0 + hash(ci) * 7.0);
  float lv = 0.6 + d * 2.0 + clamp(d * l, 0.0, 1.0) * 4.0 + (hash(ci + tick * 17.13) - 0.5) * 0.5;
  vec3 col = mix(DUST_LANE, mix(DUST_BLUE, DUST_WARM, 1.0 - smoothstep(1.05, 2.2, q)), clamp(l, 0.0, 1.0));
  col = mix(col, DUST_ECHO, clamp(L.b / (l + 1e-4), 0.0, 1.0) * 0.7);
  float a = (0.22 + 0.78 * d) * (0.35 + 0.65 * clamp(l, 0.0, 1.2)) * (1.0 + clamp(l - 1.0, 0.0, 1.5) * 0.4);
  return over(ink(dustIdx(lv), f, col, a), o);
}

// Behind everything: the Milky Way and a nebula by night, the sunlit nebula by day.
vec4 backdrop(vec2 ci, vec2 f, vec2 pc, vec2 pp) {
  float quiet = calm(pp);
  // Nothing of it shows through the bodies in front: each masks a disc, wherever it is this frame.
  for (int i = 0; i < ${MAX_MASKS}; i++) {
    vec4 m = uMask[i];
    if (m.z > 0.0) quiet *= smoothstep(m.z, m.z * 1.06, length(pp - m.xy));
  }
  if (quiet < 0.01) return vec4(0.0);
  vec4 o = vec4(0.0);
  if (uMilky + uNebula > 0.01) {
    vec4 c = S(ci);
    float L = luma(c.rgb);
    // Its dots are scattered by sky cell, not screen cell, so they travel with the band while it pans.
    vec2 sc = ci - floor(uPan * uRatio / uCellD + 0.5);
    // The glow as a scatter of faint dots, thicker where it's brighter: a cloud of stars, not a grid of cells.
    if (L > 0.008 && hash(sc + 51.0) < clamp(L * 7.0, 0.0, 0.8)) {
      float gi = L > 0.08 ? 2.0 : L > 0.04 ? 15.0 : 1.0;
      vec3 tint = clamp(c.rgb / max(L, 0.001) * 0.55, 0.0, 1.0);
      float tw = 0.75 + 0.25 * sin(uTime * (0.5 + hash(sc + 52.0) * 2.0) + hash(sc + 53.0) * TAU);
      o = ink(gi, f, tint, clamp(0.25 + L * 4.0, 0.0, 0.7) * tw);
    }
    // The band's own stars, thick where it is, each twinkling on its own.
    float h = hash(sc + 31.0);
    if (h < c.a * 0.22) {
      float tw = 0.55 + 0.45 * sin(uTime * (0.7 + h * 9.0) + h * 80.0);
      float si = h < c.a * 0.012 ? 16.0 : h < c.a * 0.06 ? 15.0 : 1.0;
      o = over(ink(si, f, mix(vec3(0.72, 0.8, 1.0), vec3(1.0, 0.95, 0.85), hash(sc + 32.0)), (0.35 + 0.5 * tw) * (0.4 + 0.6 * c.a)), o);
    }
  }
  if (uDay > 0.01) o = dayNebula(ci, pc, pp, f);
  return o * quiet;
}

// The corona at totality (drawCorona): streamers all round the hidden sun.
vec4 corona(vec2 f, vec2 pc) {
  vec2 rel = pc - uC;
  float dist = length(rel), q = dist - uRad * 1.04;
  if (q < 0.0) return vec4(0.0);
  float ang = atan(rel.y, rel.x), stepA = TAU / 64.0;
  float i = floor(ang / stepA + 0.5), ai = i * stepA;
  float len = uRad * (0.25 + 0.95 * pow(n2d(vec2(ai * 2.2, uTime * 0.4)), 2.0));
  float k = q / len;
  if (k >= 1.0 || abs(dist * sin(ang - ai)) > uCellD.x / uRatio * 0.55) return vec4(0.0);
  return ink(k < 0.15 ? 16.0 : k < 0.5 ? lineIdx(rel) : 15.0, f, mix(CORONA_IN, CORONA_OUT, k), (1.0 - k) * 0.85 * uStrength);
}

void main() {
  vec2 dev = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  // By day the air near the cursor shimmers like heat haze: read from a little way off, as glyph() moves glyphs there.
  if (uShimmer > 0.01) {
    vec2 q = dev / uRatio;
    float dl = length(q - uPtr);
    if (dl < 150.0) {
      float k = (1.0 - dl / 150.0) * uShimmer;
      dev -= vec2(sin(q.y * 0.09 + uTime * 9.0) * 2.6, sin(q.x * 0.07 + uTime * 7.0) * 1.3) * k * uRatio;
    }
  }
  vec2 g = dev / uCellD, ci = floor(g), f = fract(g);
  vec2 pc = (ci + 0.5) * uCellD / uRatio, pp = dev / uRatio;
  vec4 o = uKind < 0.5 || (uKind > 1.5 && uKind < 2.5) ? lit(ci, f, pc) : uKind < 1.5 ? sun(ci, f, pc, pp) : uKind < 3.5 ? corona(f, pc) : backdrop(ci, f, pc, pp);
  // Under page content the sky dims, so text stays readable (the backdrop has its own, softer calm).
  for (int i = 0; i < ${MAX_DIMS}; i++) {
    if (float(i) >= uDimN || uDimHard < 0.5 || uKind > 3.5) break;
    vec4 b = uDim[i];
    if (pp.x > b.x && pp.x < b.z && pp.y > b.y && pp.y < b.w) { o *= ${DIM.toFixed(2)}; break; }
  }
  gl_FragColor = o * uAlpha;
}`;

type Uniforms = Record<string, WebGLUniformLocation>;

export class HeroPrinter {
  readonly canvas = document.createElement("canvas");
  /** The GPU took the context back; the engine falls back to drawing on its own canvas. */
  lost = false;
  /** Sized at least once. Before that its cell target has nothing to draw into. */
  sized = false;
  /** The shaders have finished compiling and linked (check() finds out); until then the engine draws the hero itself. */
  ready = false;
  private gl: WebGLRenderingContext;
  /** The shade pass, one program per body (by layer kind), so each compiles alone and in parallel. */
  private shades = new Map<number, { p: WebGLProgram; u: Uniforms }>();
  /** Bodies not finished yet: not started till the first ones are in, then not checked till they're used. */
  private pending = new Set<number>();
  private print: { p: WebGLProgram; u: Uniforms };
  /** Lets check() ask whether compiling is done without waiting for it. Without it, the first check waits. */
  private parallel: { COMPLETION_STATUS_KHR: number } | null;
  private shadeTex: WebGLTexture;
  private atlas: WebGLTexture;
  private land: WebGLTexture;
  private fbo: WebGLFramebuffer;
  private W = 1;
  private H = 1;
  private ratio = 1;
  /** A glyph cell in device px (whole pixels, so glyphs land crisply), and the grid of them over the canvas. */
  private cw = 4;
  private ch = 7;
  private gw = 1;
  private gh = 1;
  private time = 0;
  private dims = new Float32Array(MAX_DIMS * 4);
  private dimN = 0;
  private pointer = { x: 0, y: 0 };
  private shimmer = 0;
  private hard = true;

  /** glyphs: the engine's ramp, then | / - \ ~ · *. land: its 128 × 64 bitmap, one bit per cell. */
  constructor(private glyphs: string, private family: string, landBits: Uint8Array) {
    // Not on a software renderer (no GPU, or acceleration off): there copying each frame out costs ~300 ms, and the
    // canvas draws the hero far faster.
    const gl = this.canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, failIfMajorPerformanceCaveat: true });
    if (!gl) throw new Error("no webgl");
    this.gl = gl;
    this.canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.lost = true;
    });
    // Compiling these takes a phone's GPU a good part of a second. Started here and not waited on, so the page's first
    // frames don't wait for it.
    this.parallel = gl.getExtension("KHR_parallel_shader_compile");
    // First only the bodies the page's sky shows (night: moon and backdrop), so they don't queue behind the others;
    // check() starts the rest once these are in.
    const theme = document.documentElement.dataset.theme;
    const now = theme === "light" ? [1, 4] : theme === "twilight" ? [2] : theme === "deep" ? [] : [0, 4];
    for (const [kind, body] of SHADE_BODIES) {
      if (now.includes(kind)) this.shades.set(kind, this.program(SHADE.replace("BODY", body)));
      else this.pending.add(kind);
    }
    this.print = this.program(PRINT);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.shadeTex = this.texture(gl.LINEAR);
    this.atlas = this.texture(gl.NEAREST);
    this.land = this.texture(gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    const px = new Uint8Array(128 * 64);
    for (let i = 0; i < px.length; i++) px[i] = ((landBits[i >> 3] >> (7 - (i & 7))) & 1) * 255;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 128, 64, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, px);
    this.fbo = gl.createFramebuffer()!;
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.land);
    gl.activeTexture(gl.TEXTURE0);
    // Whichever font is ready now will do; if the real one comes later, the atlas is drawn again.
    document.fonts?.ready.then(() => { if (!this.lost) this.drawAtlas(); });
  }

  /** Compiles and links, without asking how it went: check() does that once it's done. */
  private program(frag: string) {
    const gl = this.gl;
    const make = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, make(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, make(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, "p");
    gl.linkProgram(p);
    return { p, u: {} as Uniforms };
  }

  /**
   * Whether the printer can draw yet. With parallel compiling this never waits: false until the GPU is done. Without
   * it the first call waits for the compile. A shader that failed counts as lost, and the engine keeps drawing the hero.
   */
  check() {
    if (this.ready || this.lost) return this.ready;
    const first = [this.print, ...[...this.shades].filter(([k]) => !this.pending.has(k)).map(([, s]) => s)];
    if (!first.every((prog) => this.done(prog.p))) return false;
    if (!first.every((prog) => this.finish(prog))) return false;
    this.ready = true;
    // Now the bodies this sky doesn't show yet, so a later change of sky finds them ready.
    for (const k of this.pending) this.shades.set(k, this.program(SHADE.replace("BODY", SHADE_BODIES.find(([kind]) => kind === k)![1])));
    return true;
  }

  private done(p: WebGLProgram) {
    return !this.parallel || this.gl.getProgramParameter(p, this.parallel.COMPLETION_STATUS_KHR);
  }

  /** Once compiled: whether it linked (if not, the printer is lost), and where its uniforms are. Waits if it isn't done. */
  private finish(prog: { p: WebGLProgram; u: Uniforms }) {
    const gl = this.gl;
    if (!gl.getProgramParameter(prog.p, gl.LINK_STATUS)) {
      console.warn("sky: hero shaders failed, drawing on the canvas instead", gl.getProgramInfoLog(prog.p));
      this.lost = true;
      return false;
    }
    const n = gl.getProgramParameter(prog.p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      // Arrays report as "name[0]"; set them through the bare name.
      const name = gl.getActiveUniform(prog.p, i)!.name.replace("[0]", "");
      prog.u[name] = gl.getUniformLocation(prog.p, name)!;
    }
    gl.useProgram(prog.p);
    // The land map is on unit 2 for good. Left at its default (unit 0) the shade pass's sampler would point at its own
    // target, which WebGL refuses to draw.
    if (prog.u.uLand) gl.uniform1i(prog.u.uLand, 2);
    if (prog.u.uLoop) gl.uniform1i(prog.u.uLoop, 99);
    return true;
  }

  /**
   * A body's program. One compiled after the first ones is finished on first use: by then it's long done, unless the
   * sky changed within a second or two of loading, when this waits for it once.
   */
  private shadeFor(kind: number) {
    const prog = this.shades.get(kind)!;
    if (this.pending.has(kind)) {
      this.pending.delete(kind);
      if (!this.finish(prog)) return null;
    }
    return prog;
  }

  private texture(filter: number) {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  /** w × h in CSS px at the engine's pixel ratio; cell is the glyph width in CSS px. */
  resize(w: number, h: number, ratio: number, cell: number) {
    const gl = this.gl;
    // The same size again (the next page's sky): nothing to rebuild.
    const W = Math.max(1, Math.round(w * ratio)), H = Math.max(1, Math.round(h * ratio));
    if (this.sized && W === this.W && H === this.H && ratio === this.ratio && Math.max(2, Math.round(cell * ratio)) === this.cw) return;
    this.ratio = ratio;
    this.W = this.canvas.width = Math.max(1, Math.round(w * ratio));
    this.H = this.canvas.height = Math.max(1, Math.round(h * ratio));
    this.cw = Math.max(2, Math.round(cell * ratio));
    this.ch = Math.max(4, Math.round(cell * CELL_ASPECT * ratio));
    this.gw = Math.ceil(this.W / this.cw) + 1;
    this.gh = Math.ceil(this.H / this.ch) + 1;
    gl.bindTexture(gl.TEXTURE_2D, this.shadeTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.gw * 2, this.gh * 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.shadeTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.drawAtlas();
    this.sized = true;
  }

  /** The glyphs in one row, each exactly one cell of device pixels, drawn a touch taller so rows knit together. */
  private drawAtlas() {
    const gl = this.gl;
    const c = document.createElement("canvas");
    c.width = this.cw * this.glyphs.length;
    c.height = this.ch;
    const x = c.getContext("2d")!;
    x.fillStyle = "#000";
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = "#fff";
    x.font = `600 ${Math.round(this.ch * 1.18)}px ${this.family}`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    [...this.glyphs].forEach((g, i) => x.fillText(g, (i + 0.5) * this.cw, this.ch * 0.54));
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  /**
   * A fresh, empty layer for this frame. dims: page content, which the backdrop keeps calm round and, when hard,
   * the bodies dim under. pointer and shimmer: the heat haze.
   */
  begin(time: number, dims: Box[], hard: boolean, pointer: { x: number; y: number }, shimmer: number) {
    const gl = this.gl;
    this.time = time;
    this.hard = hard;
    this.pointer = pointer;
    this.shimmer = shimmer;
    this.dimN = Math.min(MAX_DIMS, dims.length);
    for (let i = 0; i < this.dimN; i++) this.dims.set([dims[i].left, dims[i].top, dims[i].right, dims[i].bottom], i * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  moon(m: MoonLayer) {
    this.layer(0, m, m.r * (1.75 + m.hov * 0.15), (u) => {
      this.gl.uniform3f(u.uL, ...m.light);
      this.gl.uniform2f(u.uLib, ...m.lib);
      this.gl.uniform1f(u.uLit, m.lit);
      this.gl.uniform1f(u.uBump, m.bump);
    }, (u) => {
      this.gl.uniform1f(u.uGlowLit, m.glow);
      this.gl.uniform1f(u.uHov, m.hov);
      this.gl.uniform1f(u.uHaloK, m.halo);
    });
  }

  /** The sky behind everything; the strengths pick what shows (night: milky, nebula; day: the sunlit nebula). */
  backdrop(b: BackdropLayer) {
    const screen = (u: Uniforms) => {
      this.gl.uniform2f(u.uScreen, b.w, b.h);
      this.gl.uniform2f(u.uPan, b.pan.x, b.pan.y);
    };
    const stars = new Float32Array(MAX_NEBULA_STARS * 4), starsB = new Float32Array(MAX_NEBULA_STARS * 4);
    b.stars.slice(0, MAX_NEBULA_STARS).forEach((s, i) => {
      stars.set([s.x, s.y, s.lit, s.echo], i * 4);
      starsB.set([s.pull, s.echoK, 0, 0], i * 4);
    });
    // Covers the whole page, since the band and the nebula cross it.
    this.layer(4, b, Math.hypot(b.w, b.h) * 1.1, (u) => {
      const gl = this.gl;
      gl.uniform1f(u.uMilky, b.milky);
      gl.uniform1f(u.uNebula, b.nebula);
      gl.uniform1f(u.uDay, b.day > 0.01 ? 1 : 0);
      gl.uniform4fv(u.uStar, stars);
      gl.uniform4fv(u.uStarB, starsB);
      screen(u);
    }, (u) => {
      const gl = this.gl;
      gl.uniform1f(u.uMilky, b.milky);
      gl.uniform1f(u.uNebula, b.nebula);
      gl.uniform1f(u.uDay, b.day);
      const masks = new Float32Array(MAX_MASKS * 4);
      b.masks.slice(0, MAX_MASKS).forEach((m, i) => masks.set([m.x, m.y, m.r, 0], i * 4));
      gl.uniform4fv(u.uMask, masks);
      screen(u);
    });
  }

  sun(s: SunLayer) {
    const spots = new Float32Array(MAX_SPOTS * 4), ks = new Float32Array(MAX_SPOTS);
    s.spots.slice(0, MAX_SPOTS).forEach((sp, i) => {
      spots.set([...sp.c, sp.size], i * 4);
      ks[i] = sp.k;
    });
    // Out to the longest streamer or ray.
    const reach = s.r * 2.4;
    this.layer(1, s, reach, !s.disc ? null : (u) => {
      const gl = this.gl;
      gl.uniform1f(u.uSpin, s.spin);
      gl.uniform1f(u.uBoil, s.boil);
      gl.uniform4fv(u.uSpot, spots);
      gl.uniform1fv(u.uSpotK, ks);
    }, (u) => {
      const gl = this.gl;
      gl.uniform1f(u.uDisc, s.disc ? 1 : 0);
      gl.uniform1f(u.uInk, s.ink);
      gl.uniform1f(u.uRays, s.rays);
      gl.uniform1f(u.uBoil, s.boil);
      gl.uniform1f(u.uHov, s.hov);
      gl.uniform1f(u.uHovAng, s.hovAngle);
      gl.uniform3f(u.uOcc, s.occ?.x ?? 0, s.occ?.y ?? 0, s.occ ? 1 : 0);
      gl.uniform3f(u.uWarm, s.warm[0] / 255, s.warm[1] / 255, s.warm[2] / 255);
    });
  }

  corona(c: CoronaLayer) {
    if (c.strength < 0.02) return;
    this.layer(3, c, c.r * 2.3, null, (u) => this.gl.uniform1f(u.uStrength, c.strength));
  }

  earth(e: EarthLayer) {
    // Out past the atmosphere to the top of the aurora.
    this.layer(2, e, e.r * 1.5, () => {}, () => {});
  }

  /**
   * One body: shade it into the cell target, then print it onto the layer. Both passes are cut to the box it can
   * reach (with a margin for the print pass's bloom taps), so a small body costs little.
   */
  private layer(kind: number, b: Layer, reach: number, shadeSet: ((u: Uniforms) => void) | null, printSet: (u: Uniforms) => void) {
    if (b.alpha < 0.01) return;
    const gl = this.gl;
    const { ratio, cw, ch, gw, gh, W, H } = this;
    // In cells: what gets printed, and what gets shaded (wider, for the bloom taps up to 7 cells out).
    const px0 = Math.max(0, Math.floor(((b.x - reach) * ratio) / cw)), px1 = Math.min(gw, Math.ceil(((b.x + reach) * ratio) / cw));
    const py0 = Math.max(0, Math.floor(((b.y - reach) * ratio) / ch)), py1 = Math.min(gh, Math.ceil(((b.y + reach) * ratio) / ch));
    if (px1 <= px0 || py1 <= py0) return;
    const x0 = Math.max(0, px0 - 8), x1 = Math.min(gw, px1 + 8), y0 = Math.max(0, py0 - 8), y1 = Math.min(gh, py1 + 8);
    gl.enable(gl.SCISSOR_TEST);
    const common = (u: Uniforms) => {
      gl.uniform2f(u.uC, b.x, b.y);
      gl.uniform1f(u.uRad, b.r);
      gl.uniform1f(u.uKind, kind);
      gl.uniform1f(u.uTime, this.time);
    };
    if (shadeSet) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, gw * 2, gh * 2);
      // Texel rows run bottom up, cells top down.
      gl.scissor(x0 * 2, (gh - y1) * 2, (x1 - x0) * 2, (y1 - y0) * 2);
      gl.disable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const prog = this.shadeFor(kind);
      if (!prog) return;
      const { p, u } = prog;
      gl.useProgram(p);
      common(u);
      gl.uniform2f(u.uRes, gw * 2, gh * 2);
      gl.uniform2f(u.uCell, cw / ratio, ch / ratio);
      shadeSet(u);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.scissor(px0 * cw, H - py1 * ch, (px1 - px0) * cw, (py1 - py0) * ch);
    gl.enable(gl.BLEND);
    gl.useProgram(this.print.p);
    const u = this.print.u;
    common(u);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadeTex);
    gl.uniform1i(u.uShade, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(u.uAtlas, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(u.uRes, W, H);
    gl.uniform2f(u.uCellD, cw, ch);
    gl.uniform2f(u.uGrid, gw, gh);
    gl.uniform1f(u.uRatio, ratio);
    gl.uniform1f(u.uCount, this.glyphs.length);
    gl.uniform1f(u.uAlpha, b.alpha);
    gl.uniform4fv(u.uDim, this.dims);
    gl.uniform1f(u.uDimN, this.dimN);
    gl.uniform1f(u.uDimHard, this.hard ? 1 : 0);
    gl.uniform2f(u.uPtr, this.pointer.x, this.pointer.y);
    gl.uniform1f(u.uShimmer, this.shimmer);
    // A layer that doesn't set these leaves no trace of the last one's.
    for (const name of ["uGlowLit", "uHov", "uHovAng", "uInk", "uRays", "uBoil", "uStrength", "uHaloK", "uMilky", "uNebula", "uDay"]) gl.uniform1f(u[name], 0);
    printSet(u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.SCISSOR_TEST);
  }

  destroy() {
    const gl = this.gl;
    gl.deleteTexture(this.shadeTex);
    gl.deleteTexture(this.atlas);
    gl.deleteTexture(this.land);
    gl.deleteFramebuffer(this.fbo);
    for (const { p } of this.shades.values()) gl.deleteProgram(p);
    gl.deleteProgram(this.print.p);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
