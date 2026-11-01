/*
 * The look: a voxel scene seen as a toy through a tilt-shift lens, printed in coloured glyphs.
 *
 * The scene renders small, about two pixels per glyph. It is blurred above and below a sharp band, then every cell of
 * the screen picks a glyph by how bright it is (or / \ | - where there's a strong edge), coloured by the cell. Glyphs
 * come from an atlas drawn once in the site's mono font. A dim fill of the same colour sits under each one, so it
 * reads as a picture first and as text when you look closely. Last come scanlines, a little bloom and a vignette.
 */

import {
  CanvasTexture, Mesh, NearestFilter, NoColorSpace, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, Vector3, WebGLRenderTarget, WebGLRenderer,
  LinearFilter, ClampToEdgeWrapping, PCFShadowMap, LinearSRGBColorSpace, ColorManagement, type Camera, type IUniform,
} from "three";
import { RAMP } from "../engine";

/** Colours are chosen as they should look on screen, and lighting is part of the style, so nothing converts them. */
ColorManagement.enabled = false;

/** What the lens does to this view: where its sharp band sits, how wide, and how far the blur reaches, in texels. */
export interface Lens { center: number; band: number; blur: number }

const GLYPHS = `${RAMP}/\\|-`;
/** A glyph cell in device px, the clip's fine weave on any screen. */
const CELL_W = 6;
const CELL_H = 10;
/** The darkest glyph's fill: enough that a lit surface is never empty. */
const SPACE = new Vector3(4 / 255, 5 / 255, 11 / 255);

const VERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

const BLUR = `
varying vec2 vUv;
uniform sampler2D tMap;
uniform vec2 uStep;
uniform float uCenter, uBand, uBlur, uFlat;
void main() {
  float d = max(0.0, abs(vUv.y - uCenter) - uBand) / max(0.05, 1.0 - uBand - abs(uCenter - 0.5));
  float r = uFlat + uBlur * d * (0.45 + d);
  vec3 sum = texture2D(tMap, vUv).rgb * 0.2;
  float total = 0.2;
  for (int i = 1; i <= 4; i++) {
    float k = float(i) / 4.0, w = exp(-2.4 * k * k) * 0.2;
    sum += (texture2D(tMap, vUv + uStep * r * k).rgb + texture2D(tMap, vUv - uStep * r * k).rgb) * w;
    total += 2.0 * w;
  }
  gl_FragColor = vec4(sum / total, 1.0);
}`;

const BRIGHT = `
varying vec2 vUv;
uniform sampler2D tMap;
void main() {
  vec3 c = texture2D(tMap, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * smoothstep(0.62, 0.98, l), 1.0);
}`;

const PRINT = `
varying vec2 vUv;
uniform sampler2D tMap, tBloom, tAtlas;
uniform vec2 uRes, uCell;
uniform vec3 uBg;
uniform float uMul, uFade, uFlash, uCount;
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float at(vec2 p) { return luma(texture2D(tMap, p).rgb); }
void main() {
  vec2 cell = uCell * uMul;
  vec2 g = gl_FragCoord.xy / cell;
  vec2 s = cell / uRes;
  vec2 c = (floor(g) + 0.5) * s;
  vec3 col = texture2D(tMap, c).rgb;
  float L = luma(col);
  float tl = at(c + vec2(-s.x, s.y)), tt = at(c + vec2(0.0, s.y)), tr = at(c + s);
  float ll = at(c - vec2(s.x, 0.0)), rr = at(c + vec2(s.x, 0.0));
  float bl = at(c - s), bb = at(c - vec2(0.0, s.y)), br = at(c + vec2(s.x, -s.y));
  float gx = tr + 2.0 * rr + br - tl - 2.0 * ll - bl;
  float gy = tl + 2.0 * tt + tr - bl - 2.0 * bb - br;
  float idx;
  if (length(vec2(gx, gy)) > 1.5 && L > 0.05) {
    float ax = abs(gx), ay = abs(gy);
    idx = ay > ax * 2.4 ? 13.0 : ax > ay * 2.4 ? 12.0 : gx * gy < 0.0 ? 10.0 : 11.0;
  } else {
    idx = floor(pow(clamp(L * 1.3, 0.0, 1.0), 0.6) * 9.0 + 0.5);
    if (L > 0.035) idx = max(idx, 2.0);
    if (L < 0.012) idx = 0.0;
  }
  float ink = texture2D(tAtlas, vec2((idx + fract(g.x)) / uCount, fract(g.y))).r;
  // Hue kept, saturation up, and lifted a little since the glyph only covers part of its cell.
  vec3 tint = clamp(mix(vec3(L), col, 1.3), 0.0, 1.0);
  tint *= 1.0 + (1.0 - L) * 0.35;
  vec3 out3 = uBg + tint * (0.46 + ink * 0.84);
  out3 += texture2D(tBloom, vUv).rgb * 0.5;
  out3 *= mod(gl_FragCoord.y, 3.0) < 1.0 ? 0.84 : 1.0;
  vec2 v = vUv - 0.5;
  out3 *= 1.0 - dot(v, v) * 0.62;
  out3 = mix(uBg, out3, uFade);
  out3 = mix(out3, vec3(1.0), uFlash);
  gl_FragColor = vec4(out3, 1.0);
}`;

type Uniforms = Record<string, IUniform>;

export class AsciiPass {
  readonly renderer: WebGLRenderer;
  /** How much coarser than normal the glyph grid is right now: the dive between places. */
  mul = 1;
  /** 0 is black, 1 the picture: the fade in on arrival and across a cut. */
  fade = 1;
  flash = 0;
  /** Sustained slow frames raise this: 1 coarser glyphs, 2 fewer motes, 3 no shadows. */
  level = 0;

  /** The current view's glyph size against the usual. */
  private cellScale = 1;
  private w = 1;
  private h = 1;
  private family: string;
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private screen = new Scene();
  private quad: Mesh;
  private atlas: CanvasTexture | null = null;
  private cell = new Vector2(CELL_W, CELL_H);
  private shot!: WebGLRenderTarget;
  private blurA!: WebGLRenderTarget;
  private blurB!: WebGLRenderTarget;
  private glowA!: WebGLRenderTarget;
  private glowB!: WebGLRenderTarget;
  private blur: ShaderMaterial;
  private bright: ShaderMaterial;
  private print: ShaderMaterial;
  private slowFor = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, family: string) {
    this.family = family;
    // A failed context throws here: Cosmos catches it and stays with the vista.
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    const blur: Uniforms = { tMap: { value: null }, uStep: { value: new Vector2() }, uCenter: { value: 0.5 }, uBand: { value: 0.2 }, uBlur: { value: 0 }, uFlat: { value: 0 } };
    const shader = (fragmentShader: string, uniforms: Uniforms) => new ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false });
    this.blur = shader(BLUR, blur);
    this.bright = shader(BRIGHT, { tMap: { value: null } });
    this.print = shader(PRINT, {
      tMap: { value: null }, tBloom: { value: null }, tAtlas: { value: null }, uRes: { value: new Vector2() }, uCell: { value: this.cell }, uBg: { value: SPACE },
      uMul: { value: 1 }, uFade: { value: 1 }, uFlash: { value: 0 }, uCount: { value: GLYPHS.length },
    });
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.print);
    this.quad.frustumCulled = false;
    this.screen.add(this.quad);
    // Whichever font is ready now will do; if the real one comes later, the atlas is drawn again.
    document.fonts?.ready.then(() => { if (!this.disposed) this.drawAtlas(); });
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    const dpr = window.devicePixelRatio || 1;
    const ratio = Math.min(dpr, 2);
    const bw = Math.max(2, Math.round(w * ratio)), bh = Math.max(2, Math.round(h * ratio));
    this.renderer.setSize(bw, bh, false);
    // Device px decide the cell, so a sharp phone gets as fine a weave as a monitor; the buffer's capped ratio scales it.
    const scale = (ratio / Math.min(dpr, 3)) * (this.level >= 1 ? 1.34 : 1) * this.cellScale;
    this.cell.set(Math.max(3, Math.round(CELL_W * scale)), Math.max(5, Math.round(CELL_H * scale)));
    (this.print.uniforms.uRes.value as Vector2).set(bw, bh);
    this.drawAtlas();
    const gw = Math.ceil(bw / this.cell.x), gh = Math.ceil(bh / this.cell.y);
    for (const target of [this.shot, this.blurA, this.blurB, this.glowA, this.glowB]) target?.dispose();
    const target = (tw: number, th: number, depth = false) => {
      const t = new WebGLRenderTarget(Math.max(2, tw), Math.max(2, th), { depthBuffer: depth, stencilBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
      t.texture.wrapS = t.texture.wrapT = ClampToEdgeWrapping;
      return t;
    };
    this.shot = target(gw * 2, gh * 2, true);
    this.blurA = target(gw * 2, gh * 2);
    this.blurB = target(gw * 2, gh * 2);
    this.glowA = target(gw / 2, gh / 2);
    this.glowB = target(gw / 2, gh / 2);
  }

  /** Changes the glyph size, which remakes the buffers: for the cut between views, when nobody can see it. */
  setCell(scale: number) {
    if (scale === this.cellScale) return;
    this.cellScale = scale;
    this.resize(this.w, this.h);
  }

  /** The glyphs in one row, each exactly one cell of buffer pixels, so they land crisply on the screen's. */
  private drawAtlas() {
    const { x: cw, y: ch } = this.cell;
    const canvas = document.createElement("canvas");
    canvas.width = cw * GLYPHS.length;
    canvas.height = ch;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, ch);
    ctx.fillStyle = "#fff";
    ctx.font = `600 ${ch}px ${this.family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    [...GLYPHS].forEach((g, i) => ctx.fillText(g, (i + 0.5) * cw, ch * 0.54));
    this.atlas?.dispose();
    this.atlas = new CanvasTexture(canvas);
    this.atlas.minFilter = this.atlas.magFilter = NearestFilter;
    this.atlas.generateMipmaps = false;
    this.atlas.colorSpace = NoColorSpace;
    this.print.uniforms.tAtlas.value = this.atlas;
  }

  private pass(material: ShaderMaterial, to: WebGLRenderTarget | null) {
    this.quad.material = material;
    this.renderer.setRenderTarget(to);
    this.renderer.render(this.screen, this.camera);
  }

  private blurred(from: WebGLRenderTarget, to: WebGLRenderTarget, dx: number, dy: number, lens: Lens | null, flat: number) {
    const u = this.blur.uniforms;
    u.tMap.value = from.texture;
    (u.uStep.value as Vector2).set(dx / from.width, dy / from.height);
    u.uCenter.value = lens?.center ?? 0.5;
    u.uBand.value = lens?.band ?? 0.5;
    u.uBlur.value = lens?.blur ?? 0;
    u.uFlat.value = flat;
    this.pass(this.blur, to);
  }

  render(scene: Scene, camera: Camera, lens: Lens) {
    this.renderer.setRenderTarget(this.shot);
    this.renderer.render(scene, camera);
    this.blurred(this.shot, this.blurA, 1, 0, lens, 0);
    this.blurred(this.blurA, this.blurB, 0, 1, lens, 0);
    this.bright.uniforms.tMap.value = this.blurB.texture;
    this.pass(this.bright, this.glowA);
    this.blurred(this.glowA, this.glowB, 1, 0, null, 3);
    this.blurred(this.glowB, this.glowA, 0, 1, null, 3);
    const u = this.print.uniforms;
    u.tMap.value = this.blurB.texture;
    u.tBloom.value = this.glowA.texture;
    u.uMul.value = this.mul;
    u.uFade.value = this.fade;
    u.uFlash.value = this.flash;
    this.pass(this.print, null);
  }

  /** Watches the frame time; two slow seconds in a row step the quality down one level. True when it just did. */
  watch(ms: number) {
    // A long gap is a hidden tab or a scene being built, not a slow device.
    if (this.level >= 3 || ms > 200) return false;
    this.slowFor = ms > 28 ? this.slowFor + ms : Math.max(0, this.slowFor - ms * 2);
    if (this.slowFor < 2000) return false;
    this.slowFor = 0;
    this.level++;
    if (this.level === 1) this.resize(this.w, this.h);
    return true;
  }

  destroy() {
    this.disposed = true;
    for (const target of [this.shot, this.blurA, this.blurB, this.glowA, this.glowB]) target?.dispose();
    this.atlas?.dispose();
    this.blur.dispose();
    this.bright.dispose();
    this.print.dispose();
    this.quad.geometry.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
