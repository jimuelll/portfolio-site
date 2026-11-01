"use client";

import { useEffectEvent, useLayoutEffect, useRef } from "react";
import { SkyEngine, type SkyStats, type SkyVariant } from "./engine";
export { DELIVER_EVENT, DELIVER_SECONDS, LAUNCH_EVENT } from "./engine";

type SkyCanvasProps = {
  variant?: SkyVariant;
  className?: string;
  onStats?: (stats: SkyStats) => void;
};

export function SkyCanvas({ variant = "full", className = "", onStats }: SkyCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  // An Effect Event, so a new callback doesn't tear down the engine.
  const emit = useEffectEvent((stats: SkyStats) => onStats?.(stats));

  // Before paint, so a new page never shows for a frame with an empty sky (most visible coming out of the day's glare).
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const engine = new SkyEngine(canvas, variant, (stats) => emit(stats));
    return () => engine.destroy();
  }, [variant]);

  return <canvas ref={ref} aria-hidden="true" className={`sky-canvas ${className}`} />;
}

export type { SkyStats };
