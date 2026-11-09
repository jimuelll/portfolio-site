"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { MESSAGE_MAX, type GuestEntry } from "../lib/guestbook";
import { shownName } from "../lib/star-names";
import { when } from "./guestbook";

/*
 * The guestbook as a star chart: every entry a star, joined oldest to newest into one constellation that grows as
 * people sign. Full screen, its own dark backdrop, drag to pan, scroll or pinch to zoom. On opening, the line traces
 * itself star by star.
 */

// --- Stars this browser left. Only ids, kept locally, so a visitor can find their own light again. ---
const MINE_KEY = "guestbook-mine";

export function readMine(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(MINE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function addMine(id: string) {
  try {
    const mine = readMine();
    if (!mine.includes(id)) localStorage.setItem(MINE_KEY, JSON.stringify([id, ...mine].slice(0, 50)));
  } catch {
    /* without storage, the star simply isn't marked as theirs */
  }
}

// --- Seeded randomness, so the chart is drawn the same for every visitor on every visit. ---
function seeded(text: string) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `from` is the earlier star this one is joined to, or null for the first star of a constellation. */
type Star = { entry: GuestEntry; x: number; y: number; r: number; from: number | null };

/** Lights per constellation: about the size of a real one, small enough to read as a shape. */
const GROUP = 7;
/** How far apart constellation centres sit, and how far a star may stray from its own centre. */
const SPREAD = 300;
const REACH = 95;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

type Point = { x: number; y: number };
// Whether segments ab and cd cross somewhere other than a shared end.
function crosses(a: Point, b: Point, c: Point, d: Point) {
  const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(c, d, a) * side(c, d, b) < 0 && side(a, b, c) * side(a, b, d) < 0;
}

/**
 * The sky, oldest light first. Every seven lights make a constellation. Constellations sit along a golden-angle spiral,
 * so each new one finds open sky beside the last instead of piling onto the middle. Within one, every new light joins
 * the nearest star already there, so shapes branch the way real constellations do. A spot that would cross a line
 * already drawn, crowd another star or stray too far is passed over for another try. All of it is seeded by the entry's
 * id: earlier stars never move when new ones arrive, so the sky people saw stays theirs.
 */
function chart(oldestFirst: GuestEntry[]): Star[] {
  const stars: Star[] = [];
  oldestFirst.forEach((entry, i) => {
    const rand = seeded(entry.id);
    // Longer messages burn a little brighter, like a star's magnitude.
    const r = 2 + (Math.min(entry.message.length, MESSAGE_MAX) / MESSAGE_MAX) * 2.4;
    const group = Math.floor(i / GROUP);
    const first = group * GROUP;
    const centre = {
      x: Math.cos(group * GOLDEN_ANGLE) * SPREAD * Math.sqrt(group),
      y: Math.sin(group * GOLDEN_ANGLE) * SPREAD * Math.sqrt(group),
    };
    const mates = stars.slice(first);

    let pick: Star | null = null;
    let fallback: Star | null = null;
    for (let attempt = 0; attempt < 24 && !pick; attempt++) {
      const angle = rand() * Math.PI * 2;
      const dist = mates.length ? 15 + rand() * REACH : rand() * 30;
      const x = centre.x + Math.cos(angle) * dist;
      const y = centre.y + Math.sin(angle) * dist;
      let from: number | null = null;
      let near = Infinity;
      mates.forEach((m, k) => {
        const d = Math.hypot(m.x - x, m.y - y);
        if (d < near) {
          near = d;
          from = first + k;
        }
      });
      const candidate: Star = { entry, x, y, r, from };
      fallback ??= candidate;
      if (stars.some((s) => Math.hypot(s.x - x, s.y - y) < 36)) continue;
      if (from !== null) {
        const a = stars[from];
        if (near > 110) continue;
        if (mates.some((m) => m.from !== null && crosses(a, candidate, stars[m.from], m))) continue;
      }
      pick = candidate;
    }
    stars.push(pick ?? fallback!);
  });
  return stars;
}

type View = { k: number; x: number; y: number };
const MIN_K = 0.3;
const MAX_K = 3;
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));
/** How far the backdrop of faint stars reaches past the chart on every side, in chart units. */
const FIELD_PAD = 900;

type Box = { minX: number; maxX: number; minY: number; maxY: number };

function bounds(stars: Star[]): Box {
  const xs = stars.map((s) => s.x);
  const ys = stars.map((s) => s.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function fieldOf(stars: Star[]): Box {
  const b = stars.length ? bounds(stars) : { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  return { minX: b.minX - FIELD_PAD, maxX: b.maxX + FIELD_PAD, minY: b.minY - FIELD_PAD, maxY: b.maxY + FIELD_PAD };
}

/**
 * Keeps the screen inside the starry field: never zoomed out so far, or dragged so far, that its edge shows. Every
 * view change goes through here.
 */
function constrain(v: View, field: Box, w: number, h: number): View {
  const k = Math.max(clampK(v.k), w / (field.maxX - field.minX), h / (field.maxY - field.minY));
  const x = Math.min(-field.minX * k, Math.max(w - field.maxX * k, v.x));
  const y = Math.min(-field.minY * k, Math.max(h - field.maxY * k, v.y));
  return { k, x, y };
}

/** The view that shows every star, centred below the header. */
function fit(stars: Star[], w: number, h: number): View {
  const b = bounds(stars);
  const bw = Math.max(b.maxX - b.minX, 1);
  const bh = Math.max(b.maxY - b.minY, 1);
  const k = Math.min(1.4, clampK(Math.min((w - 120) / bw, (h - 200) / bh)));
  const v = { k, x: w / 2 - ((b.minX + b.maxX) / 2) * k, y: (h + 30) / 2 - ((b.minY + b.maxY) / 2) * k };
  return constrain(v, fieldOf(stars), w, h);
}

/** The whole trace runs in about this long, however many stars there are: each segment gets its share. */
const TRACE = 3.6;
const TRACE_START = 0.45;

export function StarMap({ entries, onClose }: { entries: GuestEntry[]; onClose: () => void }) {
  const stars = useMemo(() => chart([...entries].reverse()), [entries]);
  const [mine] = useState(() => new Set(readMine()));
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [view, setView] = useState<View>(() => fit(stars, window.innerWidth, window.innerHeight));
  // Which star's card is showing, and whether a hover (which ends when the pointer leaves) or a tap opened it.
  const [active, setActive] = useState<{ i: number; by: "hover" | "pick" } | null>(null);
  // Bumped by "replay", which remounts the constellation so its animations start over.
  const [run, setRun] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const field = useMemo(() => fieldOf(stars), [stars]);

  // Gestures read the latest view, field and size without re-binding their handlers each time those change.
  const viewRef = useRef(view);
  const fieldRef = useRef(field);
  const sizeRef = useRef(size);
  useEffect(() => {
    viewRef.current = view;
    fieldRef.current = field;
    sizeRef.current = size;
  }, [view, field, size]);

  /** Every pan and zoom goes through here, so the view never leaves the starry field. */
  function move(next: View | ((v: View) => View)) {
    setView((v) => constrain(typeof next === "function" ? next(v) : next, fieldRef.current, sizeRef.current.w, sizeRef.current.h));
  }
  // The furthest out the field still fills the screen. Zoom gestures stop here rather than being pushed back after,
  // so zooming toward a point never jumps.
  function minZoom() {
    const f = fieldRef.current;
    const s = sizeRef.current;
    return Math.max(s.w / (f.maxX - f.minX), s.h / (f.maxY - f.minY));
  }

  // Segment timing: shorter per segment as the book grows, so the trace never drags.
  const seg = stars.length > 1 ? Math.min(0.45, TRACE / (stars.length - 1)) : 0;
  // Zoomed out, stars would shrink to specks; below this zoom they hold their size on screen instead.
  const grow = Math.max(1, 0.9 / view.k);
  const traceEnd = TRACE_START + seg * Math.max(stars.length - 1, 0);

  // Faint backdrop stars over a field wider than the chart, the same every time.
  // Density stays even however large the field grows: about one faint star per 120×120 patch.
  const backdrop = useMemo(() => {
    const rand = seeded("guestbook-backdrop");
    const w = field.maxX - field.minX;
    const h = field.maxY - field.minY;
    return Array.from({ length: Math.round((w * h) / 14400) }, () => ({
      x: field.minX + rand() * w,
      y: field.minY + rand() * h,
      r: 0.4 + rand() * 0.9,
      o: 0.12 + rand() * 0.35,
    }));
  }, [field]);
  const centre = useMemo(() => {
    if (!stars.length) return { x: 0, y: 0, reach: 400 };
    const b = bounds(stars);
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, reach: Math.max(b.maxX - b.minX, b.maxY - b.minY) / 2 + 500 };
  }, [stars]);

  // While open: the page beneath stays still, focus moves in, and comes back to where it was on close.
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overflow;
    const focused = document.activeElement as HTMLElement | null;
    html.style.overflow = "hidden";
    root.current?.focus();
    const onResize = () => {
      sizeRef.current = { w: window.innerWidth, h: window.innerHeight };
      setSize(sizeRef.current);
      move((v) => v);
    };
    window.addEventListener("resize", onResize);
    return () => {
      html.style.overflow = before;
      window.removeEventListener("resize", onResize);
      focused?.focus?.();
    };
  }, []);

  // Wheel zoom, toward the pointer. Bound natively because React's wheel listener can't prevent the page scrolling.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      move((v) => {
        const k = Math.max(clampK(v.k * Math.exp(-e.deltaY * 0.0015)), minZoom());
        return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Drag to pan, two fingers to pinch. A press that barely moves is a tap: on a star it opens that star's card, on
  // empty sky it closes the card.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ view: View; points: { x: number; y: number }[]; moved: boolean; star: number | null } | null>(null);

  function startGesture(star: number | null) {
    gesture.current = { view: viewRef.current, points: [...pointers.current.values()], moved: false, star };
  }

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Capture keeps a drag going when it leaves the window; if the browser refuses, dragging still works inside it.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const hit = (e.target as Element).closest("[data-star]");
    startGesture(hit ? Number(hit.getAttribute("data-star")) : null);
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const now = [...pointers.current.values()];
    if (now.length >= 2 && g.points.length >= 2) {
      const [a0, b0] = g.points;
      const [a, b] = now;
      const k = Math.max(minZoom(), clampK((g.view.k * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(Math.hypot(a0.x - b0.x, a0.y - b0.y), 1)));
      const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const wx = (m0.x - g.view.x) / g.view.k;
      const wy = (m0.y - g.view.y) / g.view.k;
      g.moved = true;
      move({ k, x: m.x - wx * k, y: m.y - wy * k });
    } else if (now.length === 1 && g.points.length >= 1) {
      const dx = now[0].x - g.points[0].x;
      const dy = now[0].y - g.points[0].y;
      if (!g.moved && Math.hypot(dx, dy) < 6) return;
      g.moved = true;
      move({ ...g.view, x: g.view.x + dx, y: g.view.y + dy });
    }
  }

  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (g && !g.moved && pointers.current.size === 0) {
      if (g.star === null) setActive(null);
      else setActive((a) => (a?.i === g.star && a.by === "pick" ? null : { i: g.star!, by: "pick" }));
    }
    // Lifting one finger of a pinch carries on as a pan from where things are now.
    if (pointers.current.size > 0) startGesture(null);
    else gesture.current = null;
  }

  const shown = active ? stars[active.i] : null;
  const card = shown && (() => {
    const sx = shown.x * view.k + view.x;
    const sy = shown.y * view.k + view.y;
    const width = Math.min(260, size.w - 32);
    const left = sx + 18 + width > size.w - 16 ? Math.max(16, sx - 18 - width) : sx + 18;
    const top = Math.min(Math.max(sy - 24, 64), size.h - 190);
    return { left, top, width };
  })();

  return createPortal(
    <div
      ref={root}
      className="star-map"
      role="dialog"
      aria-modal="true"
      aria-label="Star log chart"
      tabIndex={-1}
      onKeyDown={(e) => {
        // The site listens for keys on window (sky shortcuts); none of them should fire from in here.
        e.stopPropagation();
        if (e.key === "Escape") {
          if (active) setActive(null);
          else onClose();
        }
      }}
    >
      <svg
        ref={svg}
        className="map-sky"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <radialGradient id="map-halo">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {/* An old atlas plate: faint rings of declination and spokes of right ascension around the chart. */}
          <g className="map-grid">
            {[1, 2, 3, 4].map((n) => (
              <circle key={n} cx={centre.x} cy={centre.y} r={(centre.reach / 4) * n} vectorEffect="non-scaling-stroke" />
            ))}
            {Array.from({ length: 12 }, (_, n) => {
              const a = (n / 12) * Math.PI * 2;
              return (
                <line
                  key={n}
                  x1={centre.x}
                  y1={centre.y}
                  x2={centre.x + Math.cos(a) * centre.reach}
                  y2={centre.y + Math.sin(a) * centre.reach}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
          <g className="map-backdrop">
            {backdrop.map((d, n) => (
              <circle key={n} cx={d.x} cy={d.y} r={d.r / view.k} opacity={d.o} />
            ))}
          </g>

          <g key={run} className="map-constellation">
            {stars.map((s, i) => {
              // Each light's line draws in its turn, from the star it joins; a constellation's first light has none.
              if (s.from === null) return null;
              const p = stars[s.from];
              const timing = { "--d": `${TRACE_START + (i - 1) * seg}s`, "--t": `${seg}s` } as CSSProperties;
              return (
                <g key={s.entry.id}>
                  <line className="map-seg" x1={p.x} y1={p.y} x2={s.x} y2={s.y} pathLength={1} vectorEffect="non-scaling-stroke" style={timing} />
                  <circle
                    className="map-spark"
                    r={2.6 / view.k}
                    style={{ ...timing, "--x1": `${p.x}px`, "--y1": `${p.y}px`, "--x2": `${s.x}px`, "--y2": `${s.y}px` } as CSSProperties}
                  />
                </g>
              );
            })}
            {stars.map((s, i) => {
              const own = mine.has(s.entry.id);
              const newest = i === stars.length - 1;
              return (
                <g
                  key={s.entry.id}
                  className="map-star"
                  data-star={i}
                  data-mine={own || undefined}
                  data-newest={newest || undefined}
                  data-active={active?.i === i || undefined}
                  transform={`translate(${s.x} ${s.y})`}
                  style={{ "--d": `${Math.max(0, TRACE_START + (i - 1) * seg + seg * 0.85)}s`, "--end": `${traceEnd + 0.3}s` } as CSSProperties}
                  tabIndex={0}
                  role="button"
                  aria-label={`${shownName(s.entry)}, ${when(s.entry.ts)}${own ? ", your light" : ""}: ${s.entry.message}`}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse" && !gesture.current?.moved) setActive((a) => (a?.by === "pick" ? a : { i, by: "hover" }));
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === "mouse") setActive((a) => (a?.by === "hover" && a.i === i ? null : a));
                  }}
                  onFocus={() => setActive({ i, by: "pick" })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActive((a) => (a?.i === i ? null : { i, by: "pick" }));
                    }
                  }}
                >
                  {/* A generous invisible hit area, so small stars are easy to tap. */}
                  <circle className="map-hit" r={14 / view.k} />
                  <g className="map-body">
                    <circle className="map-halo" r={s.r * grow * 4.5} fill="url(#map-halo)" />
                    <circle className="map-core" r={s.r * grow} />
                  </g>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <header className="map-head">
        <div>
          <h2>star log <span>· chart</span></h2>
          <p>
            {stars.length} {stars.length === 1 ? "light" : "lights"}
          </p>
        </div>
        <div className="map-tools">
          <button type="button" onClick={() => { setActive(null); setRun((r) => r + 1); }} aria-label="Replay the trace" title="replay">↻</button>
          <button type="button" onClick={() => move(fit(stars, size.w, size.h))} aria-label="Recenter the map" title="recenter">⌖</button>
          <button type="button" onClick={onClose} aria-label="Close the chart" title="close">×</button>
        </div>
      </header>

      {shown && card && (
        <div className="map-card" style={{ left: card.left, top: card.top, width: card.width }} role="status">
          <p className="map-card-head">
            <span className="guest-name">{shownName(shown.entry)}</span>
            <span className="guest-date">{when(shown.entry.ts)}</span>
          </p>
          {mine.has(shown.entry.id) && <p className="map-card-mine">✦ your light</p>}
          <p className="guest-message">{shown.entry.message}</p>
        </div>
      )}
    </div>,
    document.body,
  );
}
