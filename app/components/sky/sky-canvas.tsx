"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { SkyEngine, type SkyStats, type SkyVariant } from "./engine";
export { DELIVER_EVENT, DELIVER_SECONDS, LAUNCH_EVENT } from "./engine";

const NO_STATS: SkyStats = { scene: "night", detail: "", comets: 0, flares: 0, sats: 0, launched: 0, flared: 0 };
let stats = NO_STATS;
const listeners = new Set<() => void>();
const publish = (next: SkyStats) => {
  stats = next;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
/** What the home sky reports (scene, counts) for its readout. */
export const useSkyStats = () => useSyncExternalStore(subscribe, () => stats, () => NO_STATS);

/**
 * The one sky behind every page (app/layout.tsx). The canvas never unmounts, so a page change doesn't pay for a new
 * canvas and its GPU surface (the freeze between pages); each kind of page still gets a fresh engine on it.
 */
export function SkyCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const variant: SkyVariant = usePathname() === "/" ? "full" : "quiet";

  // Before paint, so a new page never shows for a frame with an empty sky (most visible coming out of the day's glare).
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const engine = new SkyEngine(canvas, variant, publish);
    return () => {
      engine.destroy();
      publish(NO_STATS);
    };
  }, [variant]);

  return <canvas ref={ref} aria-hidden="true" className={`sky-canvas sky-fixed${variant === "full" ? " sky-home" : ""}`} />;
}

export type { SkyStats };
