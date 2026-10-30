"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { cv } from "../lib/portfolio";
import { DELIVER_EVENT, DELIVER_SECONDS } from "./sky/sky-canvas";

type Stage = "ready" | "incoming" | "caught";

/**
 * The CV receiver under the moon, sun or Earth on the home page. Pressing it asks the sky to deliver: a
 * shooting star, a sunbeam or a satellite's pod comes down onto it, and on arrival the download starts
 * (or, until there's a PDF, it says the CV is landing soon). The engine places it via --hero-x/y/r.
 */
export function CvReceiver() {
  const [stage, setStage] = useState<Stage>("ready");
  const timers = useRef<number[]>([]);
  const download = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  function receive(e: MouseEvent<HTMLButtonElement>) {
    if (stage !== "ready") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) window.dispatchEvent(new CustomEvent(DELIVER_EVENT, { detail: { x: rect.left + rect.width / 2, y: rect.top } }));
    setStage("incoming");
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    at(reduced ? 0 : DELIVER_SECONDS * 1000, () => {
      setStage("caught");
      download.current?.click();
    });
    at((reduced ? 0 : DELIVER_SECONDS * 1000) + 3200, () => setStage("ready"));
  }

  const label = stage === "incoming" ? "✦ incoming…" : stage === "caught" ? (cv.href ? "✦ cv received ↓" : "✦ cv landing soon") : "✦ receive cv ↓";
  return (
    <>
      <button type="button" className={`cv-receiver ${stage}`} onClick={receive} data-sky-ignore aria-label="Receive CV">
        <span aria-live="polite">{label}</span>
      </button>
      {cv.href && <a ref={download} href={cv.href} download hidden tabIndex={-1} aria-hidden="true" />}
    </>
  );
}
