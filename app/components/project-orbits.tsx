"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import { projects } from "../lib/portfolio";
import { GO_EVENT, disc } from "./sky/engine";

const TAU = Math.PI * 2;
/** Every orbit shares one tilted plane, seen nearly edge-on, so the far half passes behind the disc. */
const TILT = -0.2;
const SQUASH = 0.28;
const ORBITS = projects
  .filter((p) => p.status === "launched")
  .map((p, i) => ({ p, period: 64 + i * 22, phase: 0.6 + i * 2.3 }));
/** Orbit size in disc radii. Phones keep them close, since their disc runs off the right edge. */
const reach = (i: number, wide: boolean) => (wide ? 1.22 + i * 0.2 : 1.08 + i * 0.12);

/**
 * The work, in orbit round the disc: each launched project is a small body on its own path, named, so a first look
 * at the sky already shows what's been built. Hovering or focusing one stops the clock so it can be clicked; a click
 * flies to it on the projects page the way the nav does.
 */
export function ProjectOrbits({ hidden }: { hidden: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const bodies = useRef<(HTMLAnchorElement | null)[]>([]);
  const near = useRef<(SVGPathElement | null)[]>([]);
  const far = useRef<(SVGPathElement | null)[]>([]);
  const mask = useRef<SVGCircleElement>(null);
  const held = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let last = performance.now();
    let clock = 0;
    let blocks: DOMRect[] = [];
    let box: DOMRect | null = null;
    let widths: number[] = [];
    let measured = 0;
    let drawn = "";

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!held.current && !reduced.matches) clock += dt;
      const { x: cx, y: cy, r } = disc;
      // Measured twice a second, not every frame: the label and readout have no backing, so a body passing under
      // their text steps out of sight.
      if (now - measured > 500) {
        measured = now;
        box = root.current?.getBoundingClientRect() ?? null;
        widths = bodies.current.map((el) => (el?.querySelector<HTMLElement>(".orbit-tag")?.offsetWidth ?? 0) + 30);
        blocks = Array.from(document.querySelectorAll(".home [data-sky-avoid]"), (el) => el.getBoundingClientRect());
      }
      const view = box;
      if (!r || !view) return;
      const cos = Math.cos(TILT), sin = Math.sin(TILT);
      const wide = view.width >= 1024;
      // The paths only change when the disc does, so the full-screen SVG isn't repainted every frame.
      if (drawn !== `${cx} ${cy} ${r} ${wide}`) {
        drawn = `${cx} ${cy} ${r} ${wide}`;
        mask.current?.setAttribute("cx", `${cx}`);
        mask.current?.setAttribute("cy", `${cy}`);
        mask.current?.setAttribute("r", `${r * 1.02}`);
        const deg = (TILT * 180) / Math.PI;
        ORBITS.forEach((o, i) => {
          const a = r * reach(i, wide), b = a * SQUASH;
          const end = (s: number) => `${cx + s * a * cos} ${cy + s * a * sin}`;
          near.current[i]?.setAttribute("d", `M ${end(1)} A ${a} ${b} ${deg} 0 1 ${end(-1)}`);
          far.current[i]?.setAttribute("d", `M ${end(-1)} A ${a} ${b} ${deg} 0 1 ${end(1)}`);
        });
      }
      ORBITS.forEach((o, i) => {
        const a = r * reach(i, wide), b = a * SQUASH;
        const el = bodies.current[i];
        if (!el) return;
        const t = o.phase + (TAU * clock) / o.period;
        const lx = a * Math.cos(t), ly = b * Math.sin(t);
        const x = cx + lx * cos - ly * sin, y = cy + lx * sin + ly * cos;
        const behind = Math.sin(t) < 0 && Math.hypot(x - cx, y - cy) < r;
        const px = view.left + x, py = view.top + y;
        const under = blocks.some((k) => px > k.left - 24 && px < k.right + 24 && py > k.top - 24 && py < k.bottom + 24);
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        // Off the screen's edge (phones, where the disc runs off the right), its name would hang there alone.
        const gone = behind || under || x < 8 || x > view.width - 8;
        if (el.hasAttribute("data-hidden") !== gone) el.toggleAttribute("data-hidden", gone);
        // The name sits to the right unless it would run off the screen; then whichever side has more room.
        const flip = x + widths[i] > view.width - 8 && (x - widths[i] >= 8 || x > view.width - x);
        if (el.hasAttribute("data-flip") !== flip) el.toggleAttribute("data-flip", flip);
      });
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const go = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    window.dispatchEvent(new CustomEvent(GO_EVENT, { detail: href }));
  };
  const hold = (on: boolean) => () => { held.current = Math.max(0, held.current + (on ? 1 : -1)); };

  return (
    <nav className="project-orbits" ref={root} aria-label="Projects" data-off={hidden || undefined}>
      <svg className="orbit-paths" aria-hidden="true">
        <defs>
          <mask id="orbit-behind" maskUnits="userSpaceOnUse" x="-10000" y="-10000" width="20000" height="20000">
            <rect x="-10000" y="-10000" width="20000" height="20000" fill="white" />
            <circle ref={mask} fill="black" />
          </mask>
        </defs>
        {ORBITS.map((o, i) => (
          <g key={o.p.slug}>
            <path ref={(el) => { far.current[i] = el; }} mask="url(#orbit-behind)" />
            <path ref={(el) => { near.current[i] = el; }} />
          </g>
        ))}
      </svg>
      {ORBITS.map((o, i) => {
        const href = `/projects#${o.p.slug}`;
        return (
          <a
            key={o.p.slug}
            ref={(el) => { bodies.current[i] = el; }}
            href={href}
            className="orbit-body"
            onClick={(e) => go(e, href)}
            onPointerEnter={hold(true)}
            onPointerLeave={hold(false)}
            onFocus={hold(true)}
            onBlur={hold(false)}
          >
            <span className="orbit-dot" aria-hidden="true" />
            <span className="orbit-tag">
              <span className="orbit-name">{o.p.name}</span>
              <span className="orbit-kind">{o.p.kind} →</span>
            </span>
          </a>
        );
      })}
    </nav>
  );
}
