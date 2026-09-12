"use client";

import { useEffect, useRef } from "react";

const colors = ["#00f5ff", "#ff20d6", "#f4ff00", "#ff3158", "#5267ff"];
const fragmentLayers = ["a", "b", "c", "d", "e", "f", "g"] as const;
const barLayers = ["one", "two", "three"] as const;
const cutLayers = ["one", "two", "three", "four", "five"] as const;

function LetterLine({ text, kind }: { text: string; kind: "color" | "mono" }) {
  return (
    <span className={`glitch-line glitch-line-${kind}`}>
      {Array.from(text).map((letter, index) => (
        <span
          className="glitch-letter"
          data-char={letter}
          data-kind={kind}
          key={`${letter}-${index}`}
        >
          {fragmentLayers.map((layer) => (
            <span
              className={`glitch-fragment glitch-fragment-${layer}`}
              data-char={letter}
              aria-hidden="true"
              key={layer}
            >
            </span>
          ))}
          {barLayers.map((layer) => (
            <i
              className={`glitch-bar glitch-bar-${layer}`}
              aria-hidden="true"
              key={layer}
            />
          ))}
          {cutLayers.map((layer) => (
            <i
              className={`glitch-cut glitch-cut-${layer}`}
              aria-hidden="true"
              key={layer}
            />
          ))}
        </span>
      ))}
    </span>
  );
}

function randomLetters(letters: HTMLElement[]) {
  return [...letters]
    .sort(() => Math.random() - 0.5)
    .slice(0, 1 + Math.floor(Math.random() * 3));
}

type GlitchTitleProps = {
  variant?: "hero" | "lab";
  id?: string;
};

export function GlitchTitle({
  variant = "hero",
  id,
}: GlitchTitleProps) {
  const rootRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const titleElement = root;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const mobileViewport = window.matchMedia("(max-width: 520px)").matches;
    const idleGlitchInterval = mobileViewport ? 1350 : 2800;
    const letters = Array.from(
      titleElement.querySelectorAll<HTMLElement>(".glitch-letter"),
    );
    let glitchLoop = 0;
    let clearGlitch = 0;
    let layoutFrames: number[] = [];
    let lastPointerGlitch = 0;
    let pointerIsNear = false;
    let pointerX = 0;
    let pointerY = 0;

    function clearLetters() {
      titleElement
        .querySelectorAll(".is-color-glitch,.is-mono-glitch")
        .forEach((letter) => {
          letter.classList.remove("is-color-glitch", "is-mono-glitch");
        });
    }

    function clearLayoutFrames() {
      layoutFrames.forEach((frame) => window.clearTimeout(frame));
      layoutFrames = [];
    }

    function prepareLetter(letter: HTMLElement, kind: "color" | "mono") {
      const firstColor = colors[Math.floor(Math.random() * colors.length)];
      let secondColor = colors[Math.floor(Math.random() * colors.length)];
      if (secondColor === firstColor)
        secondColor = colors[(colors.indexOf(firstColor) + 1) % colors.length];
      const offsetX = Math.random() * 20 - 10;
      const offsetY = Math.random() * 8 - 4;

      letter.style.setProperty("--letter-a", firstColor);
      letter.style.setProperty("--letter-b", secondColor);
      fragmentLayers.forEach((layer) => {
        const top = Math.round(3 + Math.random() * 89);
        const height = Math.round(2 + Math.random() * 12);
        const layerX = offsetX + (Math.random() * 4 - 2);
        const layerY = offsetY + (Math.random() * 2 - 1);
        letter.style.setProperty(`--layer-${layer}-top`, `${top}%`);
        letter.style.setProperty(
          `--layer-${layer}-bottom`,
          `${Math.max(2, 100 - top - height)}%`,
        );
        letter.style.setProperty(
          `--layer-${layer}-x`,
          `${layerX.toFixed(0)}px`,
        );
        letter.style.setProperty(
          `--layer-${layer}-y`,
          `${layerY.toFixed(0)}px`,
        );
        letter.style.setProperty(
          `--layer-${layer}-reverse-x`,
          `${(-layerX * 0.6).toFixed(0)}px`,
        );
        letter.style.setProperty(
          `--layer-${layer}-width`,
          `${Math.round(100 + Math.random() * 55)}%`,
        );
        letter.style.setProperty(
          `--layer-${layer}-left`,
          `${Math.round(Math.random() * -12)}px`,
        );
        letter.style.setProperty(
          `--layer-${layer}-delay`,
          `${(-Math.random() * 0.2).toFixed(2)}s`,
        );
        letter.style.setProperty(
          `--layer-${layer}-opacity`,
          `${(0.6 + Math.random() * 0.35).toFixed(2)}`,
        );
      });
      barLayers.forEach((layer) => {
        const barX = Math.random() * 24 - 12;
        const barY = Math.random() * 4 - 2;
        letter.style.setProperty(`--bar-${layer}-top`, `${Math.round(8 + Math.random() * 78)}%`);
        letter.style.setProperty(`--bar-${layer}-left`, `${Math.round(Math.random() * -18)}px`);
        letter.style.setProperty(`--bar-${layer}-width`, `${Math.round(55 + Math.random() * 150)}%`);
        letter.style.setProperty(`--bar-${layer}-height`, `${Math.round(2 + Math.random() * 6)}px`);
        letter.style.setProperty(`--bar-${layer}-x`, `${barX.toFixed(0)}px`);
        letter.style.setProperty(`--bar-${layer}-y`, `${barY.toFixed(0)}px`);
        letter.style.setProperty(`--bar-${layer}-reverse-x`, `${(-barX * 0.45).toFixed(0)}px`);
        letter.style.setProperty(`--bar-${layer}-delay`, `${(-Math.random() * 0.24).toFixed(2)}s`);
        letter.style.setProperty(`--bar-${layer}-opacity`, `${(0.55 + Math.random() * 0.4).toFixed(2)}`);
      });
      cutLayers.forEach((layer) => {
        const cutX = Math.random() * 12 - 6;
        letter.style.setProperty(`--cut-${layer}-top`, `${Math.round(12 + Math.random() * 66)}%`);
        letter.style.setProperty(`--cut-${layer}-left`, `${Math.round(Math.random() * -8)}px`);
        letter.style.setProperty(`--cut-${layer}-width`, `${Math.round(80 + Math.random() * 75)}%`);
        letter.style.setProperty(`--cut-${layer}-height`, `${Math.round(3 + Math.random() * 6)}px`);
        letter.style.setProperty(`--cut-${layer}-x`, `${cutX.toFixed(0)}px`);
        letter.style.setProperty(`--cut-${layer}-reverse-x`, `${(-cutX * 0.5).toFixed(0)}px`);
        letter.style.setProperty(`--cut-${layer}-delay`, `${(-Math.random() * 0.16).toFixed(2)}s`);
      });
      letter.classList.add(
        kind === "color" ? "is-color-glitch" : "is-mono-glitch",
      );
    }

    function nearbyLetters(x: number, y: number) {
      return letters
        .map((letter) => {
          const rect = letter.getBoundingClientRect();
          const distanceX = Math.max(rect.left - x, 0, x - rect.right);
          const distanceY = Math.max(rect.top - y, 0, y - rect.bottom);
          return { letter, distance: Math.hypot(distanceX, distanceY) };
        })
        .sort((first, second) => first.distance - second.distance);
    }

    function glitch(x?: number, y?: number) {
      window.clearTimeout(clearGlitch);
      clearLayoutFrames();
      clearLetters();
      void titleElement.offsetWidth;
      const selectedLetters =
        typeof x === "number" && typeof y === "number"
          ? (() => {
              const nearest = nearbyLetters(x, y);
              const closestDistance = nearest[0]?.distance ?? Infinity;
              const radius = Math.max(closestDistance + 2, 96);
              const localLetters = nearest
                .filter(({ distance }) => distance <= radius)
                .slice(0, 3);
              return localLetters.length > 0
                ? localLetters.map(({ letter }) => letter)
                : nearest.slice(0, 1).map(({ letter }) => letter);
            })()
          : randomLetters(letters);

      selectedLetters.forEach((letter) => {
        const kind = letter.dataset.kind === "mono" ? "mono" : "color";
        prepareLetter(letter, kind);
      });
      [72, 146, 238, 344].forEach((delay) => {
        layoutFrames.push(
          window.setTimeout(() => {
            selectedLetters.forEach((letter) => {
              const kind = letter.dataset.kind === "mono" ? "mono" : "color";
              prepareLetter(letter, kind);
            });
          }, delay),
        );
      });
      clearGlitch = window.setTimeout(clearLetters, 430);
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType === "touch") return;

      const rect = titleElement.getBoundingClientRect();
      const padding = 88;
      const distanceX = Math.max(
        rect.left - event.clientX,
        0,
        event.clientX - rect.right,
      );
      const distanceY = Math.max(
        rect.top - event.clientY,
        0,
        event.clientY - rect.bottom,
      );
      const isNear = Math.hypot(distanceX, distanceY) <= padding;

      if (!isNear) {
        pointerIsNear = false;
        lastPointerGlitch = 0;
        clearLayoutFrames();
        clearLetters();
        return;
      }

      const wasNear = pointerIsNear;
      pointerX = event.clientX;
      pointerY = event.clientY;
      pointerIsNear = true;
      const now = performance.now();
      if (wasNear && now - lastPointerGlitch < 220) return;
      lastPointerGlitch = now;
      glitch(pointerX, pointerY);
    }

    function handlePointerLeave() {
      pointerIsNear = false;
      lastPointerGlitch = 0;
      clearLayoutFrames();
      clearLetters();
    }

    if (reducedMotion) {
      return;
    }

    glitch();
    glitchLoop = window.setInterval(() => {
      if (pointerIsNear) glitch(pointerX, pointerY);
      else glitch();
    }, idleGlitchInterval);
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      window.clearInterval(glitchLoop);
      window.clearTimeout(clearGlitch);
      clearLayoutFrames();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  if (variant === "lab") {
    return (
      <h1
        className="glitch-title lab-glitch-title"
        ref={rootRef}
        id={id}
        aria-label="Lab"
      >
        <span className="glitch-title-base">LAB</span>
        <span className="glitch-title-overlay" aria-hidden="true">
          <LetterLine text="LAB" kind="color" />
        </span>
      </h1>
    );
  }

  return (
    <h1
      className="glitch-title"
      ref={rootRef}
      id={id}
      aria-label="Full-stack developer"
    >
      <span className="glitch-title-base">
        FULL-STACK
        <br />
        <span className="hero-title-line">DEVELOPER</span>
      </span>
      <span className="glitch-title-overlay" aria-hidden="true">
        <LetterLine text="FULL-STACK" kind="color" />
        <br />
        <LetterLine text="DEVELOPER" kind="mono" />
      </span>
    </h1>
  );
}
