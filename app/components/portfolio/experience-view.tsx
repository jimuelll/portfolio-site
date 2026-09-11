"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { experienceRoles } from "../../lib/portfolio";
import { PageTitle } from "./page-title";

const education = [
  {
    date: "2016—2020",
    role: "B.S. COMPUTER SCIENCE",
    school: "UNIVERSITY NAME",
    copy: "Systems, algorithms, and human-centered product design.",
  },
  {
    date: "2020",
    role: "CAPSTONE / PRODUCT SYSTEMS",
    school: "INDEPENDENT STUDY",
    copy: "A first-principles study in resilient interfaces and infrastructure.",
  },
  {
    date: "ONGOING",
    role: "CONTINUOUS PRACTICE",
    school: "SELF-DIRECTED",
    copy: "Reading, shipping, and learning in public through every new build.",
  },
];

export function ExperienceView() {
  const mountRef = useRef<HTMLDivElement>(null);
  const flippedRef = useRef(false);
  const [flipped, setFlipped] = useState(false);
  const [titleGlitch, setTitleGlitch] = useState(false);

  flippedRef.current = flipped;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 6.2);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);
    const cardMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      wireframe: true,
    });
    const edgeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
      wireframe: true,
    });
    const accentMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.52,
    });
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(4.15, 2.55, 0.12),
      cardMaterial,
    );
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(4.28, 2.68, 0.08),
      edgeMaterial,
    );
    // The HTML face is the card users should see. Keep the Three.js geometry
    // available for the flip treatment, but hide the extra wireframe shells
    // so they do not read as a second box around the card.
    card.visible = false;
    edge.visible = false;
    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 2.2, 12, 7),
      cardMaterial,
    );
    grid.position.z = 0.08;
    // Do not expose the construction grid through the translucent HTML face.
    grid.visible = false;
    group.add(card, edge, grid);

    const bars = [
      { width: 1.2, y: 0.56 },
      { width: 0.82, y: 0.25 },
      { width: 1.48, y: -0.06 },
    ].map(({ width, y }, index) => {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.07, 0.08),
        accentMaterial,
      );
      // Keep the scene available for the card's interaction lifecycle without
      // drawing decorative lines behind the visible HTML card.
      bar.visible = false;
      const baseX = -1.25 + width / 2;
      bar.position.set(baseX, y, 0.13);
      bar.userData.baseX = baseX;
      bar.userData.index = index;
      group.add(bar);
      return bar;
    });

    const readThemeColor = () => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue("--foreground")
        .trim();
      const color = new THREE.Color(value || "#111111");
      cardMaterial.color.copy(color);
      edgeMaterial.color.copy(color);
      accentMaterial.color.copy(color);
    };
    readThemeColor();
    const themeObserver = new MutationObserver(readThemeColor);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let animationFrame = 0;
    const render = () => {
      const isFlipped = flippedRef.current;
      const ease = reducedMotion ? 1 : 0.1;
      group.rotation.y += ((isFlipped ? Math.PI : 0) - group.rotation.y) * ease;
      group.rotation.x +=
        ((isFlipped ? -0.06 : 0.06) - group.rotation.x) * ease;
      group.rotation.z +=
        ((isFlipped ? -0.012 : 0.012) - group.rotation.z) * ease;
      bars.forEach((bar) => {
        const baseX = Number(bar.userData.baseX ?? 0);
        const index = Number(bar.userData.index ?? 0);
        bar.position.x +=
          (baseX + (isFlipped ? 0.18 : -0.18) * (index + 1) - bar.position.x) *
          0.025;
      });
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      cardMaterial.dispose();
      edgeMaterial.dispose();
      accentMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const toggle = () => {
    setTitleGlitch(true);
    setFlipped((value) => !value);
  };

  return (
    <section
      className="profile-section experience-section view"
      id="experience"
    >
      <PageTitle
        key={flipped ? "education-title" : "experience-title"}
        index="02"
        eyebrow={flipped ? "EDUCATION / EXPERIENCE" : "EXPERIENCE / EDUCATION"}
        title={flipped ? "EDUCATION" : "EXPERIENCE"}
        className={titleGlitch ? "experience-title-glitch" : undefined}
        glitchTitle={titleGlitch}
      />
      <div
        className={`experience-flip-card ${flipped ? "is-flipped" : ""}`}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={`Experience and education card. Currently showing ${flipped ? "education" : "experience"}. Click to flip.`}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
      >
        <div
          className="experience-three-canvas"
          ref={mountRef}
          aria-hidden="true"
        />
        <div className="experience-card-ui">
          <div className="experience-card-face experience-card-front">
            <div className="experience-card-topline mono-label">
              <span>FACE / 01</span>
              <span className="experience-flip-control">
                <span>FLIP TO EDUCATION</span>
                <i className="flip-corrupt-copy copy-a" aria-hidden="true">FLIP TO EDUCATION</i>
                <i className="flip-corrupt-copy copy-b" aria-hidden="true">FLIP TO EDUCATION</i>
                <b aria-hidden="true">↗</b>
              </span>
            </div>
            <div className="experience-card-list">
              {experienceRoles.map((role, index) => (
                <article className="experience-card-row" key={role.date}>
                  <span className="mono-label">
                    0{index + 1} / {role.date}
                  </span>
                  <div>
                    <h3>{role.role}</h3>
                    <p>{role.company}</p>
                  </div>
                  <p>{role.copy}</p>
                </article>
              ))}
            </div>
            <div className="experience-card-hint mono-label">
              EDUCATION / B.S. COMPUTER SCIENCE · VIEW FILE{" "}
              <span aria-hidden="true">↻</span>
            </div>
          </div>
          <div className="experience-card-face experience-card-back">
            <div className="experience-card-topline mono-label">
              <span>FACE / 02</span>
              <span className="experience-flip-control">
                <span>FLIP TO EXPERIENCE</span>
                <i className="flip-corrupt-copy copy-a" aria-hidden="true">FLIP TO EXPERIENCE</i>
                <i className="flip-corrupt-copy copy-b" aria-hidden="true">FLIP TO EXPERIENCE</i>
                <b aria-hidden="true">↗</b>
              </span>
            </div>
            <div className="experience-card-list">
              {education.map((item, index) => (
                <article
                  className="experience-card-row"
                  key={item.date + item.role}
                >
                  <span className="mono-label">
                    0{index + 1} / {item.date}
                  </span>
                  <div>
                    <h3>{item.role}</h3>
                    <p>{item.school}</p>
                  </div>
                  <p>{item.copy}</p>
                </article>
              ))}
            </div>
            <div className="experience-card-hint mono-label">
              EXPERIENCE / 03 ROLES · RETURN{" "}
              <span aria-hidden="true">↻</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
