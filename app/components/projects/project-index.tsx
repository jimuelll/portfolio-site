"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Project } from "../../lib/portfolio";
import { SkyCanvas } from "../sky/sky-canvas";
import Image from "next/image";

const REDACTED = "░░░░░░░░ ░░░░░░";

/** An index of projects beside one detail panel: click a row to bring it up, no scrolling needed. */
export function ProjectIndex({ projects }: { projects: Project[] }) {
  const [active, setActive] = useState(0);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const current = projects[active];

  // Arriving from a star on the home sky (/projects#slug) opens that project.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const i = projects.findIndex((p) => `#${p.slug}` === window.location.hash);      if (i >= 0) setActive(i);
    });
    return () => cancelAnimationFrame(frame);
  }, [projects]);

  // Up and down move through the index like a list.
  const onKey = (e: KeyboardEvent<HTMLOListElement>) => {
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (active + step + projects.length) % projects.length;
    setActive(next);
    rows.current[next]?.focus();
  };

  return (
    <div className="pi">
      <ol className="pi-list" onKeyDown={onKey}>
        {projects.map((p, i) => {
          const launched = p.status === "launched";
          return (
            <li key={p.slug}>
              <button
                ref={(el) => { rows.current[i] = el; }}
                type="button"
                className={`pi-row ${i === active ? "on" : ""}`}
                onClick={() => setActive(i)}
                aria-expanded={i === active}
              >
                <span className="pi-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="pi-name">
                  {launched ? p.name : <span className="redacted" aria-label="Unannounced project">{REDACTED}</span>}
                </span>
                <span className={`pi-meta ${launched ? "" : "orbiting"}`}>{launched ? p.year : "in orbit"}</span>
              </button>
              {/* On narrow screens the detail opens right under its row instead of beside the list. */}
              {i === active && <div className="pi-detail pi-detail--inline"><Detail p={p} /></div>}
            </li>
          );
        })}
      </ol>
      <div className="pi-detail pi-detail--side" key={current.slug} aria-live="polite">
        <Detail p={current} />
      </div>
    </div>
  );
}

function Detail({ p }: { p: Project }) {
  if (p.status === "in-orbit") {
    return (
      <>
        <div className="pi-visual">
          <SkyCanvas variant="emblem" className="pi-sky" />
          <span className="pi-badge">in orbit · launching soon</span>
        </div>
        <h2 className="redacted-title" aria-label="Unannounced project">{REDACTED}</h2>
        <p className="muted">{p.summary}</p>
        <ul className="tags small tba" aria-label="Stack to be announced"><li>tba</li><li>tba</li><li>tba</li></ul>
      </>
    );
  }
  return (
    <>
      {p.image && (
        <div className="pi-shot">
          <Image src={p.image.src} width={p.image.width} height={p.image.height} alt={`${p.name} interface`} sizes="(max-width: 900px) 100vw, 40rem" />
        </div>
      )}
      <h2>{p.name}</h2>
      <p className="meta">{p.kind} · {p.year}</p>
      <p>{p.summary}</p>
      <ul className="tags small" aria-label="Stack">{p.stack.map((s) => <li key={s}>{s}</li>)}</ul>
      <p className="pi-links">
        {p.links.map((l) => <a key={l.href} className="ink-link" href={l.href} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>)}
      </p>
    </>
  );
}
