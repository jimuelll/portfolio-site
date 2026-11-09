"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { GuestEntry } from "../lib/guestbook";
import { leaveAdmin } from "../lib/guestbook-actions";
import { Guestbook } from "./guestbook";
import { addMine, StarMap } from "./star-map";

// Each mote's sideways drift and its place in the cycle, staggered so one is usually in the air.
const SPARKS = [
  { c: "✦", dx: -14, delay: 0 },
  { c: "·", dx: 10, delay: 0.7 },
  { c: "⋆", dx: -4, delay: 1.4 },
  { c: "✦", dx: 16, delay: 2.1 },
  { c: "·", dx: -18, delay: 2.8 },
  { c: "⋆", dx: 6, delay: 3.5 },
];

const SEEN_KEY = "guestbook-seen";
const SEEN_EVENT = "guestbook-seen-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SEEN_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SEEN_EVENT, onChange);
  };
}

// The newest entry time this browser has already looked at. localStorage can throw (private windows), so an
// unreadable value just means "nothing seen yet".
function readSeen() {
  try { return localStorage.getItem(SEEN_KEY) ?? "0"; } catch { return "0"; }
}

function markSeen(newest: number) {
  try { localStorage.setItem(SEEN_KEY, String(newest)); } catch { /* unread simply stays on */ }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

/**
 * The guestbook as a small light that follows the visitor across every page. Mounted once in the root layout, so it
 * never remounts on navigation and an open panel stays open. When entries arrive that this browser hasn't seen, the
 * light swells, sends out ripples and shows how many are new.
 */
export function GuestOrb() {
  const [open, setOpen] = useState(false);
  // undefined while loading, null when the backend is offline.
  const [entries, setEntries] = useState<GuestEntry[] | null | undefined>(undefined);
  const [visitors, setVisitors] = useState<number | null>(null);
  // Whether this browser holds the moderation pass this session. Only shows the delete buttons; every delete is
  // checked again on the server.
  const [admin, setAdmin] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Loaded in the browser once, after the page is already showing, so no page waits on the database.
  useEffect(() => {
    let alive = true;
    fetch("/api/guestbook")
      .then((r) => r.json())
      .then((d: { entries: GuestEntry[] | null; visitors: number | null; admin?: boolean }) => {
        if (!alive) return;
        setEntries(d.entries);
        setVisitors(d.visitors);
        setAdmin(!!d.admin);
      })
      .catch(() => { if (alive) setEntries(null); });
    return () => { alive = false; };
  }, []);
  // Infinity on the server and during hydration, so the unread state never flashes in for someone who has read it all.
  const seen = Number(useSyncExternalStore(subscribe, readSeen, () => "Infinity"));
  const newest = entries?.[0]?.ts ?? 0;
  const unread = open ? 0 : (entries ?? []).filter((e) => e.ts > seen).length;

  function toggle(next = !open) {
    markSeen(newest);
    setOpen(next);
  }

  // While open: focus moves into the panel, and a press anywhere outside the orb closes it.
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onDown = (e: PointerEvent) => {
      // The star map is drawn outside the orb (over the whole page), but it belongs to the guestbook.
      const inMap = e.target instanceof Element && e.target.closest(".star-map");
      if (root.current && !root.current.contains(e.target as Node) && !inMap) {
        markSeen(newest);
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, newest]);

  const count = entries?.length ?? 0;

  return (
    // No data-sky-avoid: the light sits in the sky as one more star, with no dimmed patch around it.
    <div ref={root} className="guest-orb">
      {open && (
        <div
          ref={panel}
          className="orb-panel"
          role="dialog"
          aria-label="Star log"
          tabIndex={-1}
          // The page listens for keys on window (sky shortcuts, Escape); typing here shouldn't reach any of that.
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") toggle(false);
          }}
        >
          <div className="orb-head">
            <div className="orb-title">
              <h2>star log</h2>
              <p className="orb-meta">
                {count} {count === 1 ? "light" : "lights"}
                {visitors !== null && <> · {visitors.toLocaleString("en-US")} {visitors === 1 ? "visitor" : "visitors"}</>}
              </p>
            </div>
            <button
              type="button"
              className="orb-map-btn"
              onClick={() => setMapOpen(true)}
              disabled={!entries || entries.length === 0}
              title="see the lights as a constellation"
            >
              ✦ chart
            </button>
            <button type="button" className="orb-close" onClick={() => toggle(false)} aria-label="Close star log">×</button>
          </div>
          {admin && (
            <div className="orb-admin">
              <span>✦ moderating</span>
              <button
                type="button"
                onClick={async () => {
                  await leaveAdmin();
                  setAdmin(false);
                }}
              >
                leave
              </button>
            </div>
          )}
          <Guestbook
            entries={entries}
            admin={admin}
            onPosted={(e) => {
              addMine(e.id);
              setEntries((prev) => [e, ...(prev ?? [])]);
            }}
            onAdmin={() => setAdmin(true)}
            onDeleted={(id) => setEntries((prev) => prev?.filter((e) => e.id !== id))}
          />
        </div>
      )}
      {mapOpen && entries && entries.length > 0 && <StarMap entries={entries} onClose={() => setMapOpen(false)} />}
      <button
        type="button"
        className="orb-btn"
        onClick={() => toggle()}
        aria-expanded={open}
        data-unread={unread > 0 || undefined}
        aria-label={unread > 0 ? `Open the star log, ${unread} new` : "Open the star log"}
      >
        <span className="orb-body" aria-hidden="true">
          {/* Motes the light keeps shedding, so it reads as something alive to reach for rather than a fixed star. */}
          {SPARKS.map((s, i) => (
            <i key={i} className="orb-spark" style={{ "--dx": `${s.dx}px`, "--delay": `${s.delay}s` } as CSSProperties}>{s.c}</i>
          ))}
          <span className="orb-core" />
        </span>
        <span className="orb-label" aria-hidden="true">
          {unread > 0 ? <>+{unread > 9 ? "9" : unread} new {unread === 1 ? "light" : "lights"}</> : "leave a light"}
        </span>
      </button>
    </div>
  );
}
