"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { projects } from "../../lib/portfolio";

type CardScene = {
  group: THREE.Group;
  frame: THREE.MeshBasicMaterial;
  grid: THREE.MeshBasicMaterial;
  accent: THREE.MeshBasicMaterial;
};

function signedOffset(index: number, active: number, total: number) {
  let offset = (index - active + total) % total;
  if (offset > total / 2) offset -= total;
  return offset;
}

export function ThreeProjectCarousel() {
  const mountRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(0);
  const dragStartRef = useRef<number | null>(null);
  const dragDistanceRef = useRef(0);
  const suppressClickRef = useRef(false);
  const [selected, setSelected] = useState(0);
  const [dragging, setDragging] = useState(false);
  const project = projects[selected];

  selectedRef.current = selected;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 7.2);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const color = new THREE.Color();
    const readThemeColor = () => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue("--foreground")
        .trim();
      color.setStyle(value || "#111111");
      cards.forEach(({ frame, grid, accent }) => {
        frame.color.copy(color);
        grid.color.copy(color);
        accent.color.copy(color);
      });
    };

    const cards: CardScene[] = projects.map((_, index) => {
      const group = new THREE.Group();
      const frame = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        wireframe: true,
      });
      const grid = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.16,
        wireframe: true,
      });
      const accent = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.72,
      });

      const frameMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.55, 2.16, 0.08),
        frame,
      );
      const gridMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3.3, 1.9, 9, 6),
        grid,
      );
      gridMesh.position.z = 0.07;

      const barWidths = [1.15, 0.7, 1.55];
      barWidths.forEach((width, barIndex) => {
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(width, 0.08, 0.06),
          accent,
        );
        bar.position.set(
          -1.35 + width / 2 + barIndex * 0.24,
          0.58 - barIndex * 0.34,
          0.12,
        );
        group.add(bar);
      });

      const indexBlock = new THREE.Mesh(
        new THREE.BoxGeometry(0.48 + index * 0.12, 0.48, 0.08),
        accent,
      );
      indexBlock.position.set(1.28, -0.63, 0.12);

      group.add(frameMesh, gridMesh, indexBlock);
      scene.add(group);
      return { group, frame, grid, accent };
    });

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

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrame = 0;
    const render = () => {
      cards.forEach(({ group, frame, grid, accent }, index) => {
        const offset = signedOffset(index, selectedRef.current, cards.length);
        const active = offset === 0;
        const targetX = offset * 3.05;
        const targetY = Math.abs(offset) * 0.08;
        const targetZ = -Math.abs(offset) * 1.5;
        const targetRotation = -offset * 0.34;
        const targetScale = active ? 1 : 0.82;
        const ease = reducedMotion ? 1 : 0.11;

        group.position.x += (targetX - group.position.x) * ease;
        group.position.y += (targetY - group.position.y) * ease;
        group.position.z += (targetZ - group.position.z) * ease;
        group.rotation.y += (targetRotation - group.rotation.y) * ease;
        group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), ease);
        frame.opacity += ((active ? 0.92 : 0.2) - frame.opacity) * ease;
        grid.opacity += ((active ? 0.2 : 0.06) - grid.opacity) * ease;
        accent.opacity += ((active ? 0.74 : 0.13) - accent.opacity) * ease;
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
      cards.forEach(({ frame, grid, accent }) => {
        frame.dispose();
        grid.dispose();
        accent.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const move = (direction: number) => {
    setSelected((current) => (current + direction + projects.length) % projects.length);
  };

  return (
    <div
      className="project-carousel"
      role="region"
      aria-label="Selected projects carousel"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") move(-1);
        if (event.key === "ArrowRight") move(1);
      }}
    >
      <a
        className={`carousel-stage ${dragging ? "is-dragging" : ""}`}
        href={project.demoUrl}
        target="_blank"
        rel="noreferrer"
        draggable={false}
        aria-label={`Open demo site for ${project.name}. Drag horizontally to browse projects.`}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          dragStartRef.current = event.clientX;
          dragDistanceRef.current = 0;
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragStartRef.current === null) return;
          dragDistanceRef.current = event.clientX - dragStartRef.current;
        }}
        onPointerUp={(event) => {
          const distance = dragDistanceRef.current;
          if (Math.abs(distance) > 42) {
            move(distance > 0 ? -1 : 1);
            suppressClickRef.current = true;
          }
          dragStartRef.current = null;
          dragDistanceRef.current = 0;
          setDragging(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          dragStartRef.current = null;
          dragDistanceRef.current = 0;
          setDragging(false);
        }}
        onClick={(event) => {
          if (!suppressClickRef.current) return;
          event.preventDefault();
          suppressClickRef.current = false;
        }}
      >
        <div className="carousel-canvas" ref={mountRef} aria-hidden="true" />
        <span className="carousel-stage-label mono-label" aria-hidden="true">THREE::PROJECT_INDEX</span>
        <span className="carousel-stage-index" aria-hidden="true">{project.index}</span>
      </a>

      <article className="carousel-copy" aria-live="polite">
        <div className="carousel-topline mono-label">
          <span>{project.index} / {project.type}</span>
          <span>{project.year}</span>
        </div>
        <div className="carousel-project-copy" key={project.index}>
          <h3>{project.name}</h3>
          <p className="project-summary">{project.summary}</p>
        </div>
        <div className="carousel-stack">
          <span className="mono-label">STACK</span>
          <p>{project.stack}</p>
        </div>
        <a className="carousel-demo-link" href={project.demoUrl} target="_blank" rel="noreferrer">
          DEMO SITE <span aria-hidden="true">↗</span>
        </a>
        <div className="carousel-controls">
          <button type="button" onClick={() => move(-1)} aria-label="Previous project">← PREV</button>
          <div className="carousel-pagination" aria-label="Choose project">
            {projects.map((item, index) => (
              <button
                type="button"
                key={item.index}
                className={selected === index ? "active" : ""}
                onClick={() => setSelected(index)}
                aria-label={`Show ${item.name}`}
                aria-pressed={selected === index}
              >
                {item.index}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => move(1)} aria-label="Next project">NEXT →</button>
        </div>
      </article>
    </div>
  );
}
