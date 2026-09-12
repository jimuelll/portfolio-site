"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useGithubStats } from "./github-contributions";

const coreSkills = [
  { name: "TypeScript", slug: "typescript", color: "#3178c6" },
  { name: "React", slug: "react", color: "#149eca" },
  { name: "Next.js", slug: "nextdotjs", color: "#111111" },
  { name: "Node.js", slug: "nodedotjs", color: "#339933" },
  { name: "Express", slug: "express", color: "#222222" },
  { name: "MySQL", slug: "mysql", color: "#00758f" },
  { name: "PostgreSQL", slug: "postgresql", color: "#336791" },
  { name: "MongoDB", slug: "mongodb", color: "#47a248" },
  { name: "Tailwind CSS", slug: "tailwindcss", color: "#06b6d4" },
  { name: "Flutter", slug: "flutter", color: "#54c5f8" },
] as const;

export function PhotoCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [flipped, setFlipped] = useState(false);
  const { total, loading, error, weeks } = useGithubStats();

  useEffect(() => {
    const card = cardRef.current;
    const image = imageRef.current;
    if (!card || !image) return;
    const cardElement = card;
    const imageElement = image;
    const interactionArea = cardElement.closest<HTMLElement>(".hero-stage") ?? cardElement;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const pointer = { x: 0, y: 0 };
    const currentPointer = { x: 0, y: 0 };
    const targetRotation = { x: 0, y: 0, z: 0 };
    const currentRotation = { x: 0, y: 0, z: 0 };
    let animationFrame = 0;
    let running = false;
    let inView = false;

    function updateTarget(event: PointerEvent) {
      if (event.pointerType === "touch") return;

      const rect = interactionArea.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      pointer.x = Math.max(-1, Math.min(1, x));
      pointer.y = Math.max(-1, Math.min(1, y));
      targetRotation.x = pointer.y * -6;
      targetRotation.y = pointer.x * 7;
      targetRotation.z = pointer.x * 0.7;
      start();
    }

    function resetTarget() {
      pointer.x = 0;
      pointer.y = 0;
      targetRotation.x = 0;
      targetRotation.y = 0;
      targetRotation.z = 0;
      start();
    }

    function hasPendingMotion() {
      return (
        Math.abs(pointer.x - currentPointer.x) > 0.01 ||
        Math.abs(pointer.y - currentPointer.y) > 0.01 ||
        Math.abs(targetRotation.x - currentRotation.x) > 0.01 ||
        Math.abs(targetRotation.y - currentRotation.y) > 0.01 ||
        Math.abs(targetRotation.z - currentRotation.z) > 0.01
      );
    }

    function stop() {
      running = false;
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    }

    function start() {
      if (running || !inView || document.hidden || !hasPendingMotion()) return;
      running = true;
      animationFrame = window.requestAnimationFrame(render);
    }

    function render() {
      if (!running) return;
      currentPointer.x += (pointer.x - currentPointer.x) * 0.11;
      currentPointer.y += (pointer.y - currentPointer.y) * 0.11;
      currentRotation.x += (targetRotation.x - currentRotation.x) * 0.11;
      currentRotation.y += (targetRotation.y - currentRotation.y) * 0.11;
      currentRotation.z += (targetRotation.z - currentRotation.z) * 0.11;

      cardElement.style.transform = `perspective(900px) rotateX(${currentRotation.x.toFixed(3)}deg) rotateY(${currentRotation.y.toFixed(3)}deg) rotateZ(${currentRotation.z.toFixed(3)}deg)`;
      imageElement.style.transform = `translate3d(${(currentPointer.x * -5).toFixed(2)}px, ${(currentPointer.y * -4).toFixed(2)}px, 0) scale(1.045)`;
      if (hasPendingMotion()) {
        animationFrame = window.requestAnimationFrame(render);
      } else {
        stop();
      }
    }

    interactionArea.addEventListener("pointermove", updateTarget, { passive: true });
    interactionArea.addEventListener("pointerleave", resetTarget);
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) start();
        else stop();
      },
      { rootMargin: "80px" },
    );
    visibilityObserver.observe(interactionArea);
    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
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
      aria-label={`Portrait and developer profile panel. Currently showing ${flipped ? "skills and contribution activity" : "portrait"}. Click to flip.`}
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
          <Image
            className="portrait-image"
            ref={imageRef}
            src="/star.jpg"
            alt="Monochrome portrait"
            fill
            priority
            sizes="(max-width: 700px) 80vw, 360px"
          />
          <div className="portrait-grid" aria-hidden="true" />
          <div className="halftone" aria-hidden="true" />
          <span className="placeholder-label">PORTRAIT / 01</span>
          <span className="portrait-code mono-label">CLICK / FLIP FOR STATS</span>
        </div>
        <div className="portrait-face portrait-back" aria-hidden={!flipped}>
          <span className="portrait-back-kicker mono-label">CORE / TOOLKIT</span>
          <strong className="portrait-back-title">SKILL SIGNAL</strong>
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
            <div className="portrait-contribution-axis mono-label" aria-hidden="true">
              <span>−18W</span>
              <span>NOW</span>
            </div>
            <span className="portrait-contributions-note mono-label">
              {error ? "DATA LINK OFFLINE" : "LOW / HIGH ACTIVITY"}
            </span>
          </div>
          <div className="portrait-skill-grid" aria-label="Core skills: TypeScript, React, Next.js, Node.js, Express, MySQL, PostgreSQL, MongoDB, Tailwind CSS, and Flutter">
            <span className="portrait-skills-label mono-label">SKILLS / 10</span>
            {coreSkills.map((skill) => (
              <span
                className="portrait-skill-icon"
                key={skill.name}
                title={skill.name}
                aria-hidden="true"
                style={{ backgroundColor: skill.color, borderColor: skill.color } as CSSProperties}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="portrait-skill-logo" src={`https://cdn.simpleicons.org/${skill.slug}/ffffff`} alt="" />
              </span>
            ))}
          </div>
          <span className="portrait-availability mono-label">AVAILABLE / UTC +8</span>
          <span className="portrait-code mono-label">CLICK / RETURN TO PORTRAIT</span>
        </div>
      </div>
    </div>
  );
}
