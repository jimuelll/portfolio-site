"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { CvViewer } from "./cv-viewer";
import { DELIVER_EVENT, DELIVER_SECONDS } from "./sky/sky-canvas";

type Stage = "ready" | "incoming" | "caught";

/**
 * The CV receiver on the home page's label. Pressing it asks the sky to deliver: a shooting star, a
 * sunbeam or a satellite's pod comes down onto it, and on arrival the CV opens in the viewer.
 */
export function CvReceiver() {
  const [stage, setStage] = useState<Stage>("ready");
  const timers = useRef<number[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  function receive(e: MouseEvent<HTMLButtonElement>) {
    if (stage !== "ready") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!reduced)
      window.dispatchEvent(
        new CustomEvent(DELIVER_EVENT, {
          detail: { x: rect.left + rect.width / 2, y: rect.top },
        }),
      );
    setStage("incoming");
    const at = (ms: number, fn: () => void) =>
      timers.current.push(window.setTimeout(fn, ms));
    at(reduced ? 0 : DELIVER_SECONDS * 1000, () => {
      setStage("caught");
      setOpen(true);
    });
    at((reduced ? 0 : DELIVER_SECONDS * 1000) + 3200, () => setStage("ready"));
  }

  const label =
    stage === "incoming"
      ? "✦ incoming…"
      : stage === "caught"
        ? "✦ cv received"
        : "view cv ✦";
  return (
    <>
      <button
        type="button"
        className={`cv-receiver ${stage}`}
        onClick={receive}
        data-sky-ignore
        aria-label="View CV"
      >
        <span aria-live="polite">{label}</span>
      </button>
      <CvViewer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
