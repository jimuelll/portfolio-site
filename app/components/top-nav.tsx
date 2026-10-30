"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SUNRISE_CLASS, TURN_SECONDS } from "./sky/engine";

const LINKS = [
  { label: "sky", href: "/" },
  { label: "projects", href: "/projects" },
  { label: "about", href: "/about" },
];

export const THEME_KEY = "sky-theme";
type Theme = "dark" | "light" | "twilight";
/** Five presses, each within this long of the last, open the hidden Earth sky. Normal use never gets close. */
const BURST_GAP = 550;
const BURST_COUNT = 5;
/** After Earth unlocks, the rest of a burst is swallowed, so a mash can't bounce straight back out. */
const UNLOCK_LOCK = 2500;
const UNLOCK_NOTE = 3800;
/** How long colours take to ease over on inner pages (the ring pulse runs about twice as long). Matches globals.css. */
const FADE_MS = 500;

export function TopNav() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("dark");
  const [unlocked, setUnlocked] = useState(false);
  const [noted, setNoted] = useState(false);
  const presses = useRef<number[]>([]);
  const lockUntil = useRef(0);
  const noteTimer = useRef(0);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const t = document.documentElement.dataset.theme;
      setTheme(t === "light" ? "light" : t === "twilight" ? "twilight" : "dark");
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(noteTimer.current);
    };
  }, []);

  function apply(next: Theme) {
    const root = document.documentElement;
    const from = root.dataset.theme;
    const commit = () => {
      setTheme(next);
      root.dataset.theme = next;
      // Earth is an easter egg, so it isn't remembered between visits.
      if (next !== "twilight") try { localStorage.setItem(THEME_KEY, next); } catch {}
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Inner pages have no moon or sun to eclipse, so every colour eases over together while a thin ring pulses
    // out of the toggle. Nothing covers the page, so it keeps scrolling and taking clicks throughout.
    if (pathname !== "/" && !reduced && next !== "twilight" && from !== "twilight") {
      const b = button.current?.getBoundingClientRect();
      if (b) {
        const ring = document.createElement("i");
        ring.className = "theme-ring";
        ring.setAttribute("aria-hidden", "true");
        ring.style.left = `${b.left + b.width / 2}px`;
        ring.style.top = `${b.top + b.height / 2}px`;
        document.body.append(ring);
        window.setTimeout(() => ring.remove(), FADE_MS * 2 + 100);
      }
      root.classList.add("theme-fading");
      window.clearTimeout(Number(root.dataset.fadeTimer));
      root.dataset.fadeTimer = String(window.setTimeout(() => root.classList.remove("theme-fading"), FADE_MS + 100));
      // The sky switches at once instead of playing its eclipse; it reads the class in a microtask.
      root.classList.add(SUNRISE_CLASS);
      commit();
      requestAnimationFrame(() => root.classList.remove(SUNRISE_CLASS));
      return;
    }

    // Page colours ease over during the eclipse (or the zoom to Earth); only on a toggle, never on first load.
    root.classList.add("theme-turning");
    window.clearTimeout(Number(root.dataset.turnTimer));
    root.dataset.turnTimer = String(window.setTimeout(() => root.classList.remove("theme-turning"), TURN_SECONDS * 1000 + 200));
    commit();
  }

  function toggle() {
    const root = document.documentElement;
    if (performance.now() < lockUntil.current) return;
    const t = root.dataset.theme;
    const theme: Theme = t === "light" ? "light" : t === "twilight" ? "twilight" : "dark";
    if (theme === "twilight") {
      setUnlocked(false);
      presses.current = [];
      // Back to whatever the sky was before the burst of presses began (kept on the page, so it survives navigation).
      apply(root.dataset.skyHome === "light" ? "light" : "dark");
      return;
    }
    const now = performance.now();
    const last = presses.current[presses.current.length - 1];
    presses.current = last !== undefined && now - last < BURST_GAP ? [...presses.current, now] : [now];
    if (presses.current.length === 1) root.dataset.skyHome = theme;
    if (presses.current.length >= BURST_COUNT) {
      presses.current = [];
      lockUntil.current = now + UNLOCK_LOCK;
      apply("twilight");
      setUnlocked(true);
      setNoted(true);
      window.clearTimeout(noteTimer.current);
      noteTimer.current = window.setTimeout(() => setUnlocked(false), UNLOCK_NOTE);
      return;
    }
    apply(theme === "dark" ? "light" : "dark");
  }

  const label = theme === "twilight" ? "Leave Earth" : `Switch to ${theme === "dark" ? "day" : "night"} sky`;
  return (
    <nav className="top-nav" aria-label="Main" data-sky-avoid>
      {LINKS.map(({ label, href }) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>
      ))}
      {/* Dead space around the toggle, so a near miss doesn't launch a comet behind it. */}
      <span className="toggle-pad" data-sky-ignore>
        <button ref={button} type="button" onClick={toggle} aria-label={label} title={theme === "twilight" ? "back to the sky" : theme === "dark" ? "day sky" : "night sky"}>
          <span aria-hidden="true">{theme === "twilight" ? "⊕" : theme === "dark" ? "☾" : "☼"}</span>
        </button>
      </span>
      {/* The text stays once shown, so the note can fade out; the live region announces it the first time. */}
      <p className={`egg-note ${unlocked ? "on" : ""}`} aria-live="polite" aria-hidden={!unlocked} data-sky-ignore>
        {noted && "✦ earth unlocked · press ⊕ to return"}
      </p>
    </nav>
  );
}
