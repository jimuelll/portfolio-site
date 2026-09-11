"use client";

import { useEffect, useRef, useState } from "react";
import { Euler, MathUtils, Quaternion, Vector2 } from "three";
import { useGithubStats } from "./github-contributions";

export function PhotoCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [flipped, setFlipped] = useState(false);
  const { total, publicRepos, currentStreak, activeDays, loading, error, weeks } = useGithubStats();

  useEffect(() => {
    const card = cardRef.current;
    const image = imageRef.current;
    if (!card || !image) return;
    const cardElement = card;
    const imageElement = image;
    const interactionArea = cardElement.closest<HTMLElement>(".hero-stage") ?? cardElement;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const pointer = new Vector2();
    const currentPointer = new Vector2();
    const targetRotation = new Quaternion();
    const currentRotation = new Quaternion();
    const euler = new Euler(0, 0, 0, "XYZ");
    let animationFrame = 0;

    function updateTarget(event: PointerEvent) {
      if (event.pointerType === "touch") return;

      const rect = interactionArea.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      pointer.set(MathUtils.clamp(x, -1, 1), MathUtils.clamp(y, -1, 1));
      euler.set(
        MathUtils.degToRad(pointer.y * -6),
        MathUtils.degToRad(pointer.x * 7),
        MathUtils.degToRad(pointer.x * 0.7),
      );
      targetRotation.setFromEuler(euler);
    }

    function resetTarget() {
      pointer.set(0, 0);
      targetRotation.identity();
    }

    function render() {
      currentPointer.lerp(pointer, 0.11);
      currentRotation.slerp(targetRotation, 0.11);
      euler.setFromQuaternion(currentRotation, "XYZ");

      cardElement.style.transform = `perspective(900px) rotateX(${MathUtils.radToDeg(euler.x).toFixed(3)}deg) rotateY(${MathUtils.radToDeg(euler.y).toFixed(3)}deg) rotateZ(${MathUtils.radToDeg(euler.z).toFixed(3)}deg)`;
      imageElement.style.transform = `translate3d(${(currentPointer.x * -5).toFixed(2)}px, ${(currentPointer.y * -4).toFixed(2)}px, 0) scale(1.045)`;
      animationFrame = window.requestAnimationFrame(render);
    }

    interactionArea.addEventListener("pointermove", updateTarget, { passive: true });
    interactionArea.addEventListener("pointerleave", resetTarget);
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      interactionArea.removeEventListener("pointermove", updateTarget);
      interactionArea.removeEventListener("pointerleave", resetTarget);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className={`hero-portrait photo-card ${flipped ? "is-flipped" : ""}`}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={`Portrait and GitHub stats panel. Currently showing ${flipped ? "user stats" : "portrait"}. Click to flip.`}
      onClick={() => setFlipped((value) => !value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setFlipped((value) => !value);
        }
      }}
    >
      <div className="portrait-inner">
        <div className="portrait-face portrait-front">
          <img
            className="portrait-image"
            ref={imageRef}
            src="/star.jpg"
            alt="Monochrome portrait"
          />
          <div className="portrait-grid" aria-hidden="true" />
          <div className="halftone" aria-hidden="true" />
          <span className="placeholder-label">PORTRAIT / 01</span>
          <span className="portrait-code mono-label">CLICK / FLIP FOR STATS</span>
        </div>
        <div className="portrait-face portrait-back" aria-hidden={!flipped}>
          <span className="portrait-back-kicker mono-label">USER / STATS</span>
          <strong className="portrait-back-title">ACTIVITY LOG</strong>
          <div className="portrait-contributions">
            <div className="portrait-contributions-top">
              <span className="mono-label">CONTRIBUTION SIGNAL / 18 WEEKS</span>
              <strong>{loading ? "···" : error ? "OFFLINE" : total ?? "—"}</strong>
            </div>
            <div className="portrait-contribution-grid" aria-label="GitHub contribution activity">
              {weeks.map((week, weekIndex) => (
                <span className="portrait-contribution-week" key={`week-${weekIndex}`}>
                  {week.map((day) => (
                    <i
                      key={day.date}
                      data-level={day.level}
                      title={`${day.date}: ${day.count} contribution${day.count === 1 ? "" : "s"}`}
                    />
                  ))}
                </span>
              ))}
            </div>
            <span className="portrait-contributions-note mono-label">
              {error ? "DATA LINK OFFLINE" : "LOW / HIGH ACTIVITY"}
            </span>
          </div>
          <div className="portrait-stats-grid">
            <div><span className="mono-label">PUBLIC REPOS</span><strong>{loading ? "···" : publicRepos ?? "—"}</strong></div>
            <div><span className="mono-label">CURRENT STREAK</span><strong>{loading ? "···" : currentStreak === null ? "—" : `${currentStreak}D`}</strong></div>
            <div><span className="mono-label">ACTIVE DAYS / 365D</span><strong>{loading ? "···" : error ? "—" : activeDays}</strong></div>
          </div>
          <span className="portrait-code mono-label">CLICK / RETURN TO PORTRAIT</span>
        </div>
      </div>
    </div>
  );
}
