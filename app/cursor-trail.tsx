"use client";

import { useEffect, useRef } from "react";

const POOL_SIZE = 20;
const INTERACTIVE_SELECTOR = "a, button, [role='button'], input, select, textarea";

type CursorTrailProps = {
  suspended: boolean;
};

export default function CursorTrail({ suspended }: CursorTrailProps) {
  const trailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trail = trailRef.current;
    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (!trail || suspended || !finePointer.matches || reducedMotion.matches) return;

    const fragments = Array.from(trail.children) as HTMLElement[];
    let poolIndex = 0;
    let animationFrame = 0;
    let pendingPointer: PointerEvent | null = null;
    let lastX = Number.NaN;
    let lastY = Number.NaN;

    const nextFragment = () => {
      const fragment = fragments[poolIndex];
      poolIndex = (poolIndex + 1) % fragments.length;
      fragment.getAnimations().forEach((animation) => animation.cancel());
      return fragment;
    };

    const animateFragment = (
      x: number,
      y: number,
      offsetX: number,
      offsetY: number,
      size: number,
      duration: number,
    ) => {
      const fragment = nextFragment();
      fragment.style.left = `${Math.round(x - size / 2)}px`;
      fragment.style.top = `${Math.round(y - size / 2)}px`;
      fragment.style.width = `${size}px`;
      fragment.style.height = `${size}px`;

      fragment.animate(
        [
          { opacity: 0.78, transform: "translate(0, 0) scale(1)" },
          { opacity: 0.5, transform: `translate(${offsetX * 0.45}px, ${offsetY * 0.45}px) scale(1)` },
          { opacity: 0, transform: `translate(${offsetX}px, ${offsetY}px) scale(0.6)` },
        ],
        { duration, easing: "steps(4, end)", fill: "forwards" },
      );
    };

    const isInteractive = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));

    const emitTrailFragment = (event: PointerEvent) => {
      const tight = isInteractive(event.target);
      const spread = tight ? 2.5 : 6;
      const offsetX = (Math.random() - 0.5) * spread * 2;
      const offsetY = (Math.random() - 0.5) * spread * 2;
      const size = tight ? 2 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 4);
      const duration = 280 + Math.floor(Math.random() * 130);

      animateFragment(event.clientX, event.clientY, offsetX, offsetY, size, duration);
    };

    const processPointer = () => {
      animationFrame = 0;
      const event = pendingPointer;
      pendingPointer = null;
      if (!event || reducedMotion.matches || !finePointer.matches) return;

      const distance = Number.isNaN(lastX)
        ? Number.POSITIVE_INFINITY
        : Math.hypot(event.clientX - lastX, event.clientY - lastY);

      if (distance < 10) return;
      lastX = event.clientX;
      lastY = event.clientY;
      emitTrailFragment(event);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pendingPointer = event;
      if (!animationFrame) animationFrame = window.requestAnimationFrame(processPointer);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || reducedMotion.matches) return;

      for (let index = 0; index < 8; index += 1) {
        const angle = (Math.PI * 2 * index) / 8;
        const distance = 7 + (index % 3) * 2;
        animateFragment(
          event.clientX,
          event.clientY,
          Math.cos(angle) * distance,
          Math.sin(angle) * distance,
          2 + (index % 3),
          240 + (index % 3) * 35,
        );
      }
    };

    const clearTrail = () => {
      fragments.forEach((fragment) => fragment.getAnimations().forEach((animation) => animation.cancel()));
      lastX = Number.NaN;
      lastY = Number.NaN;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    document.documentElement.addEventListener("mouseleave", clearTrail);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      document.documentElement.removeEventListener("mouseleave", clearTrail);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      clearTrail();
    };
  }, [suspended]);

  return (
    <div ref={trailRef} className="cursor-trail" aria-hidden="true">
      {Array.from({ length: POOL_SIZE }, (_, index) => (
        <i className="cursor-fragment" key={index} />
      ))}
    </div>
  );
}
