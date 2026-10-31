"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent as KeyEvent } from "react";
import { HYPERDRIVE_EVENT, SUNRISE_CLASS, TURN_SECONDS, exposure } from "./sky/engine";
import { Cosmos, type Stage } from "./sky/cosmos";

const LINKS = [
  { label: "sky", href: "/" },
  { label: "projects", href: "/projects" },
  { label: "about", href: "/about" },
];

export const THEME_KEY = "sky-theme";
type Theme = "dark" | "light" | "twilight" | "deep";
/** Five presses, each within this long of the last, open the hidden Earth sky. Normal use never gets close. */
const BURST_GAP = 550;
const BURST_COUNT = 5;
/** After Earth unlocks, the rest of a burst is swallowed, so a mash can't bounce straight back out. */
const UNLOCK_LOCK = 2500;
const UNLOCK_NOTE = 3800;
/** How long colours take to ease over on inner pages (the ring pulse runs about twice as long). Matches globals.css. */
const FADE_MS = 500;
/** Holding the toggle is a launch: at three seconds you lift off into the voyage, at five you arrive at the vista. */
const LIFTOFF_MS = 3000;
const ARRIVE_MS = 5000;
/** The click that ends a hold is swallowed, so letting go doesn't also flip day and night. */
const HOLD_SWALLOW = 400;
/** Once the page has dropped away, the sky behind it stops drawing (it's covered). Matches globals.css. */
const DROP_MS = 1400;

/** The cosmos, kept outside the component: it floats over every page, so it outlives the nav of any one of them. */
let cosmos: Cosmos | null = null;

const readTheme = (t?: string): Theme => (t === "light" || t === "twilight" || t === "deep" ? t : "dark");
const plain = (t?: string) => t === "dark" || t === "light";
/** A tick of haptics on phones that have them, once the page has been touched (Chrome refuses it before). */
const buzz = (pattern: number | number[]) => { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(pattern); };

export function TopNav() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("dark");
  const [stage, setStage] = useState<Stage | null>(null);
  const [note, setNote] = useState("");
  const [noteOn, setNoteOn] = useState(false);
  const presses = useRef<number[]>([]);
  const lockUntil = useRef(0);
  const noteTimer = useRef(0);
  const button = useRef<HTMLButtonElement>(null);
  /** The hold in progress: when it began, how far it has got (0 none, 1 voyage, 2 vista), its frame and stage timers. */
  const hold = useRef({ start: 0, stage: 0, raf: 0, timers: [] as number[], swallowUntil: 0 });

  const onEscape = useEffectEvent((e: KeyboardEvent) => {
    // Out of the cosmos or the galaxy, the same as a tap on the toggle.
    if (e.key === "Escape" && (cosmos || document.documentElement.dataset.theme === "deep")) toggle();
  });

  /** The moon, sun or Earth was held for five seconds (sky/engine.ts): hyperdrive to the galaxy. */
  const onHyperdrive = useEffectEvent(() => {
    const root = document.documentElement;
    if (cosmos || root.dataset.theme === "deep") return;
    // Where to come back to (kept on the page, so it survives navigation).
    root.dataset.galaxyHome = readTheme(root.dataset.theme);
    apply("deep");
    buzz([12, 60, 12]);
    showNote("✦ hyperdrive · tap ✧ to jump home");
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setTheme(readTheme(document.documentElement.dataset.theme));
      setStage(cosmos?.stage ?? null);
    });
    const held = hold.current;
    const onKey = (e: KeyboardEvent) => onEscape(e);
    const onJump = () => onHyperdrive();
    window.addEventListener("keydown", onKey);
    window.addEventListener(HYPERDRIVE_EVENT, onJump);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(held.raf);
      held.timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(noteTimer.current);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(HYPERDRIVE_EVENT, onJump);
      exposure.k = 0;
    };
  }, []);

  function showNote(text: string, ms = UNLOCK_NOTE) {
    setNote(text);
    setNoteOn(true);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNoteOn(false), ms);
  }

  /** Every colour eases over together (the registered colour properties in globals.css animate). */
  function fadeColours() {
    const root = document.documentElement;
    root.classList.add("theme-fading");
    window.clearTimeout(Number(root.dataset.fadeTimer));
    root.dataset.fadeTimer = String(window.setTimeout(() => root.classList.remove("theme-fading"), FADE_MS + 100));
  }

  function apply(next: Theme) {
    const root = document.documentElement;
    const commit = () => {
      setTheme(next);
      root.dataset.theme = next;
      // Earth and the galaxy are easter eggs, so they aren't remembered between visits.
      if (plain(next)) try { localStorage.setItem(THEME_KEY, next); } catch {}
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Inner pages have no moon or sun to eclipse, so every colour eases over together while a thin ring pulses
    // out of the toggle. Nothing covers the page, so it keeps scrolling and taking clicks throughout.
    if (pathname !== "/" && !reduced && plain(next) && plain(root.dataset.theme)) {
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
      fadeColours();
      // The sky switches at once instead of playing its eclipse; it reads the class in a microtask.
      root.classList.add(SUNRISE_CLASS);
      commit();
      requestAnimationFrame(() => root.classList.remove(SUNRISE_CLASS));
      return;
    }

    // Page colours ease over during the eclipse (or the zoom to Earth, or hyperdrive); only on a toggle, never on first load.
    root.classList.add("theme-turning");
    window.clearTimeout(Number(root.dataset.turnTimer));
    root.dataset.turnTimer = String(window.setTimeout(() => root.classList.remove("theme-turning"), TURN_SECONDS * 1000 + 200));
    commit();
  }

  /** Back down from the cosmos: it fades away and the page rises back into place. */
  function land() {
    if (!cosmos) return;
    const root = document.documentElement;
    cosmos.leave();
    cosmos = null;
    setStage(null);
    setNoteOn(false);
    fadeColours();
    window.clearTimeout(Number(root.dataset.dropTimer));
    root.classList.remove("cosmos", "cosmos-still");
  }

  function toggle() {
    const root = document.documentElement;
    if (performance.now() < lockUntil.current) return;
    if (cosmos) {
      land();
      return;
    }
    const theme = readTheme(root.dataset.theme);
    if (theme === "deep") {
      setNoteOn(false);
      const home = readTheme(root.dataset.galaxyHome);
      apply(home === "deep" ? "dark" : home);
      return;
    }
    if (theme === "twilight") {
      setNoteOn(false);
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
      showNote("✦ earth unlocked · press ⊕ to return");
      return;
    }
    apply(theme === "dark" ? "light" : "dark");
  }

  /** Three seconds: the page drops away below and the voyage begins. */
  function liftoff() {
    const root = document.documentElement;
    cosmos = new Cosmos("voyage");
    fadeColours();
    root.classList.add("cosmos");
    // Once the page is out of sight, the sky behind the cosmos can rest.
    window.clearTimeout(Number(root.dataset.dropTimer));
    root.dataset.dropTimer = String(window.setTimeout(() => root.classList.add("cosmos-still"), DROP_MS));
    setStage("voyage");
    buzz(12);
    showNote("✦ liftoff · keep holding to arrive", 60000);
  }

  /** Five seconds: out of warp, in front of the vista. */
  function arrive() {
    cosmos?.arrive();
    setStage("vista");
    buzz([12, 60, 12]);
    showNote("✦ arrival · tap ✧ to land");
  }

  function startHold() {
    const root = document.documentElement;
    const h = hold.current;
    // Only from the day or night sky; from anywhere else a tap is the way back.
    if (cosmos || !plain(root.dataset.theme ?? "dark") || h.start) return;
    h.start = performance.now();
    h.stage = 0;
    const b = button.current!.getBoundingClientRect();
    exposure.x = b.left + b.width / 2;
    exposure.y = b.top + b.height / 2;
    button.current!.dataset.holding = "";
    // The stages run on timers, so they land on time even if frames are dropped; frames only draw the ring.
    h.timers = [
      window.setTimeout(() => { h.stage = 1; liftoff(); }, LIFTOFF_MS),
      window.setTimeout(() => { h.stage = 2; arrive(); }, ARRIVE_MS),
    ];
    const tick = () => {
      const held = performance.now() - h.start;
      button.current?.style.setProperty("--hold", Math.min(1, held / ARRIVE_MS).toFixed(3));
      // The countdown is a long exposure: star trails lengthen until liftoff.
      exposure.k = Math.min(1, held / LIFTOFF_MS);
      h.raf = held < ARRIVE_MS ? requestAnimationFrame(tick) : 0;
    };
    h.raf = requestAnimationFrame(tick);
  }

  /** Lets go of the hold and says how far it got. */
  function endHold() {
    const h = hold.current;
    cancelAnimationFrame(h.raf);
    h.timers.forEach((t) => window.clearTimeout(t));
    h.raf = 0;
    button.current?.style.removeProperty("--hold");
    if (button.current) delete button.current.dataset.holding;
    exposure.k = 0;
    const stage = h.start ? h.stage : 0;
    h.start = 0;
    h.stage = 0;
    if (stage > 0) {
      h.swallowUntil = performance.now() + HOLD_SWALLOW;
      Cosmos.askTilt();
    }
    if (stage === 1) showNote("✦ voyage · tap ✧ to land");
    return stage;
  }

  function onKeyDown(e: KeyEvent) {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (!e.repeat) startHold();
  }

  function onKeyUp(e: KeyEvent) {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (endHold() > 0) return;
    toggle();
    // In case the browser still turns the key into a click.
    hold.current.swallowUntil = performance.now() + 100;
  }

  const away = stage !== null || theme === "deep";
  const label = stage ? "Land, back to the sky" : theme === "deep" ? "Jump home" : theme === "twilight" ? "Leave Earth" : `Switch to ${theme === "dark" ? "day" : "night"} sky`;
  return (
    <nav className="top-nav" aria-label="Main" data-sky-avoid>
      {LINKS.map(({ label, href }) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>
      ))}
      {/* Dead space around the toggle, so a near miss doesn't launch a comet behind it. */}
      <span className="toggle-pad" data-sky-ignore>
        <button
          ref={button}
          type="button"
          onClick={() => {
            // Only the one click that ends a hold is swallowed; the next tap is a real one.
            if (performance.now() < hold.current.swallowUntil) hold.current.swallowUntil = 0;
            else toggle();
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            // Captured, so a finger that slides a little off the toggle keeps holding it.
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
            startHold();
          }}
          onPointerUp={endHold}
          onPointerCancel={endHold}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onBlur={endHold}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={label}
          title={away || theme === "twilight" ? "back to the sky" : theme === "dark" ? "day sky" : "night sky"}
        >
          <span aria-hidden="true">{away ? "✧" : theme === "twilight" ? "⊕" : theme === "dark" ? "☾" : "☼"}</span>
        </button>
      </span>
      {/* The text stays once shown, so the note can fade out; the live region announces each new one. */}
      <p className={`egg-note ${noteOn ? "on" : ""}`} aria-live="polite" aria-hidden={!noteOn} data-sky-ignore>
        {note}
      </p>
    </nav>
  );
}
