"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

/** The last stretch of scrolling, as a share of the window, in which the reading line sweeps down to the bottom. */
const SWEEP = 0.25;

/** The dossier's contents, marking whichever section is being read. Sections are named by their element ids. */
export function AboutNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [current, setCurrent] = useState(sections[0]?.id);
  /** A clicked link stays marked through its scroll, and until the reader next scrolls for themselves. */
  const chosen = useRef(false);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const measure = () => {
      const height = window.innerHeight;
      const left = document.documentElement.scrollHeight - height - window.scrollY;
      // The last sections are too short to scroll up to the reading line, so near the end the line comes down to them.
      const sweep = Math.min(1, Math.max(0, 1 - left / (height * SWEEP)));
      const line = height * (0.3 + 0.7 * sweep);
      const tops = sections.map(({ id }) => document.getElementById(id)?.getBoundingClientRect().top ?? Infinity);
      const at = Math.max(0, tops.findLastIndex((top) => top <= line));
      // The thread runs star to star, so it is measured in sections: how far the reading line is from this one to the next.
      const next = tops[at + 1];
      const into = next === undefined ? 0 : Math.min(1, Math.max(0, (line - tops[at]) / (next - tops[at])));
      nav.current?.style.setProperty("--progress", String(sections.length > 1 ? (at + into) / (sections.length - 1) : 1));
      if (chosen.current) return;
      setCurrent(sections[at]?.id);
    };
    const release = () => { chosen.current = false; };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchmove", release, { passive: true });
    window.addEventListener("keydown", release);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchmove", release);
      window.removeEventListener("keydown", release);
    };
  }, [sections]);

  function go(e: MouseEvent<HTMLAnchorElement>, id: string) {
    // New tabs are left to the browser.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const section = document.getElementById(id);
    if (!section) return;
    e.preventDefault();
    chosen.current = true;
    setCurrent(id);
    section.scrollIntoView();
    // Keyboard and screen reader users carry on from the section they asked for.
    section.tabIndex = -1;
    section.focus({ preventScroll: true });
    // The address still names the section, but Back leaves the page rather than stepping through sections.
    window.history.replaceState(window.history.state, "", `#${id}`);
  }

  return (
    <nav ref={nav} className="section-nav" aria-label="On this page">
      {sections.map(({ id, label }, i) => (
        <a key={id} href={`#${id}`} onClick={(e) => go(e, id)} aria-current={current === id ? "location" : undefined}
          data-read={i < sections.findIndex((s) => s.id === current) || undefined}>{label}</a>
      ))}
    </nav>
  );
}
