"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import type * as THREE from "three";
import { projects } from "../../lib/portfolio";

export function ThreeProjectCarousel() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const selectedRef = useRef(0);
  const dragProgressRef = useRef(0);
  const draggingRef = useRef(false);
  const dragStartRef = useRef<number | null>(null);
  const dragDistanceRef = useRef(0);
  const suppressClickRef = useRef(false);
  const [selected, setSelected] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [threeReady, setThreeReady] = useState(false);
  const [threeModule, setThreeModule] = useState<typeof import("three") | null>(null);
  const project = projects[selected];
  const mobileStack = project.stack
    .split(/\s*\/\s*|\n/)
    .filter(Boolean)
    .slice(0, 4)
    .join(" / ");

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;
    let cancelled = false;
    const loadObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        loadObserver.disconnect();
        void import("three").then((module) => {
          if (!cancelled) setThreeModule(module);
        });
      },
      { rootMargin: "240px" },
    );
    loadObserver.observe(mount);
    return () => {
      cancelled = true;
      loadObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount || !threeModule) return;
    const Three = threeModule;

    const scene = new Three.Scene();
    const camera = new Three.PerspectiveCamera(34, 1, 0.1, 20);
    camera.position.z = 5;
    const renderer = new Three.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const geometry = new Three.PlaneGeometry(3.1, 1.43, 24, 12);
    let disposed = false;
    const materials: THREE.MeshBasicMaterial[] = [];
    const textures: THREE.Texture[] = [];
    const cards = projects.map((item, index) => {
      const material = new Three.MeshBasicMaterial({
        color: index === 0 ? 0xffffff : 0x202020,
        transparent: true,
        opacity: index === 0 ? 1 : 0.92,
      });
      materials.push(material);
      const mesh = new Three.Mesh(geometry, material);
      scene.add(mesh);

      if (item.image) {
        const texture = new Three.TextureLoader().load(item.image, (loaded) => {
          loaded.colorSpace = Three.SRGBColorSpace;
          loaded.minFilter = Three.LinearFilter;
          material.map = loaded;
          material.color.set(0xffffff);
          material.needsUpdate = true;
          mount.dataset.ready = "true";
          if (!disposed) setThreeReady(true);
        });
        textures.push(texture);
      } else {
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 552;
        const context = canvas.getContext("2d");
        if (context) {
          context.fillStyle = "#151515";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.strokeStyle = "#3a3a3a";
          context.lineWidth = 2;
          for (let x = 0; x <= canvas.width; x += 100) {
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, canvas.height);
            context.stroke();
          }
          for (let y = 0; y <= canvas.height; y += 92) {
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(canvas.width, y);
            context.stroke();
          }
          context.fillStyle = "#f4f4f1";
          context.font = "700 38px monospace";
          context.fillText(`PROJECT / ${item.index}`, 58, 76);
          context.font = "700 82px monospace";
          context.fillText("IMAGE PENDING", 58, 310);
          const texture = new Three.CanvasTexture(canvas);
          texture.colorSpace = Three.SRGBColorSpace;
          material.map = texture;
          material.color.set(0xffffff);
          material.needsUpdate = true;
          textures.push(texture);
        }
      }
      return mesh;
    });
    let sceneScale = 1;
    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const visibleHeight = 2 * Math.tan(Three.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      const visibleWidth = visibleHeight * camera.aspect;
      sceneScale = Math.min(
        (visibleWidth * 0.9) / 3.1,
        (visibleHeight * 0.88) / 1.43,
      );
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let running = false;
    let inView = false;
    const render = () => {
      if (!running) return;
      if (!draggingRef.current) {
        dragProgressRef.current *= reducedMotion ? 0 : 0.84;
        if (Math.abs(dragProgressRef.current) < 0.001) dragProgressRef.current = 0;
      }
      cards.forEach((card, index) => {
        let offset = (index - selectedRef.current + cards.length) % cards.length;
        if (offset > cards.length / 2) offset -= cards.length;
        offset += dragProgressRef.current;
        const wheelAngle = offset * ((Math.PI * 2) / cards.length);
        const depth = (Math.cos(wheelAngle) + 1) / 2;
        const active = Math.max(0, 1 - Math.abs(offset));
        const targetX = Math.sin(wheelAngle) * 2.08 * sceneScale;
        const targetZ = (Math.cos(wheelAngle) - 1) * 1.28;
        const targetRotY = -Math.sin(wheelAngle) * 0.62 + (active * pointerRef.current.x * 0.055);
        const targetRotX = active * pointerRef.current.y * -0.035;
        const targetScale = sceneScale * (0.66 + depth * 0.34);
        const ease = draggingRef.current ? 0.3 : reducedMotion ? 1 : 0.1;
        card.position.x += (targetX - card.position.x) * ease;
        card.position.z += (targetZ - card.position.z) * ease;
        card.rotation.y += (targetRotY - card.rotation.y) * ease;
        card.rotation.x += (targetRotX - card.rotation.x) * ease;
        card.scale.x += (targetScale - card.scale.x) * ease;
        card.scale.y += (targetScale - card.scale.y) * ease;
        materials[index].opacity += ((0.46 + depth * 0.54) - materials[index].opacity) * ease;
      });
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    const start = () => {
      if (running || !inView || document.hidden) return;
      running = true;
      render();
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) start();
        else stop();
      },
      { rootMargin: "120px" },
    );
    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    visibilityObserver.observe(mount);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      stop();
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      resizeObserver.disconnect();
      geometry.dispose();
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [threeModule]);

  const move = (direction: number) => {
    dragProgressRef.current = 0;
    setDragOffset(0);
    setSelected(
      (current) => (current + direction + projects.length) % projects.length,
    );
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
        role={project.demoUrl ? undefined : "group"}
        href={project.demoUrl}
        target={project.demoUrl ? "_blank" : undefined}
        rel={project.demoUrl ? "noreferrer" : undefined}
        draggable={false}
        aria-label={
          project.demoUrl
            ? `Open demo site for ${project.name}. Drag horizontally to browse projects.`
            : `${project.name} preview. No demo link is published yet. Drag horizontally to browse projects.`
        }
        aria-disabled={project.demoUrl ? undefined : true}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          dragStartRef.current = event.clientX;
          dragDistanceRef.current = 0;
          dragProgressRef.current = 0;
          setDragOffset(0);
          draggingRef.current = true;
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          pointerRef.current = {
            x: ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
            y: ((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
          };
          if (dragStartRef.current === null) return;
          dragDistanceRef.current = event.clientX - dragStartRef.current;
          const travel = Math.max(210, Math.min(event.currentTarget.clientWidth * 0.68, 480));
          dragProgressRef.current = Math.max(-1.12, Math.min(1.12, dragDistanceRef.current / travel));
          setDragOffset(Math.max(-120, Math.min(120, dragDistanceRef.current)));
        }}
        onPointerUp={(event) => {
          const distance = dragDistanceRef.current;
          const threshold = Math.min(72, event.currentTarget.clientWidth * 0.18);
          const progress = dragProgressRef.current;
          if (Math.abs(distance) > threshold || Math.abs(progress) > 0.18) {
            const direction = progress > 0 ? -1 : 1;
            setSelected(
              (current) =>
                (current + direction + projects.length) % projects.length,
            );
            dragProgressRef.current = progress + (progress > 0 ? -1 : 1);
          }
          suppressClickRef.current = Math.abs(distance) > 8;
          dragStartRef.current = null;
          dragDistanceRef.current = 0;
          setDragOffset(0);
          draggingRef.current = false;
          setDragging(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          dragStartRef.current = null;
          dragDistanceRef.current = 0;
          dragProgressRef.current = 0;
          setDragOffset(0);
          draggingRef.current = false;
          setDragging(false);
        }}
        onPointerLeave={() => {
          pointerRef.current = { x: 0, y: 0 };
        }}
        onClick={(event) => {
          if (!suppressClickRef.current) return;
          event.preventDefault();
          suppressClickRef.current = false;
        }}
      >
        <div
          className={`carousel-image-shell ${threeReady ? "is-three-ready" : ""}`}
        >
          {project.image ? (
            <Image
              className="carousel-project-image"
              src={project.image}
              alt={`${project.name} interface preview`}
              fill
              sizes="(max-width: 1100px) 100vw, 72vw"
              draggable={false}
            />
          ) : (
            <div className="carousel-image-placeholder" aria-hidden="true">
              <span className="mono-label">PROJECT / {project.index}</span>
              <strong>IMAGE PENDING</strong>
            </div>
          )}
          <div className="carousel-three-image" ref={canvasMountRef} aria-hidden="true" />
          <div className="mobile-project-wheel" aria-hidden="true">
            {projects.map((item, index) => {
              let slot = (index - selected + projects.length) % projects.length;
              if (slot > projects.length / 2) slot -= projects.length;
              return (
                <div
                  className={`mobile-project-card ${slot === 0 ? "is-active" : ""}`}
                  key={item.index}
                  style={
                    {
                      "--card-left": `${50 + slot * 69}%`,
                      "--card-drag": `${dragOffset}px`,
                      "--card-scale": slot === 0 ? 1 : 0.78,
                      "--card-turn": `${slot * -5}deg`,
                    } as CSSProperties
                  }
                >
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt=""
                      fill
                      sizes="(max-width: 700px) 78vw, 430px"
                      style={{ objectFit: "cover" }}
                      draggable={false}
                    />
                  ) : (
                    <div className="mobile-project-placeholder">
                      <span>PROJECT / {item.index}</span>
                      <strong>IMAGE PENDING</strong>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </a>

      <article className="carousel-copy" aria-live="polite" key={project.index}>
        <div className="carousel-topline mono-label">
          <span>
            {project.index} / {project.type}
          </span>
          <span>{project.year}</span>
        </div>
        <div
          className={`carousel-project-copy ${project.dense ? "is-dense" : ""}`}
        >
          <h3>{project.name}</h3>
          <p className="project-summary">{project.summary}</p>
        </div>
        <p className="mobile-project-stack mono-label">
          CORE / {mobileStack}
        </p>
        <div className="carousel-project-meta">
          <div>
            <span className="mono-label">STACK</span>
            <p>{project.stack}</p>
          </div>
          {project.services ? (
            <div>
              <span className="mono-label">AI + SERVICES</span>
              <p>{project.services}</p>
            </div>
          ) : null}
        </div>
        {project.demoUrl ? (
          <a
            className="carousel-demo-link"
            href={project.demoUrl}
            target="_blank"
            rel="noreferrer"
          >
            {project.demoLabel ?? "DEMO SITE"} <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <span className="carousel-demo-link is-unavailable" aria-disabled="true">
            DEMO LINK / NOT AVAILABLE
          </span>
        )}
        <details className="mobile-project-details" key={`details-${project.index}`}>
          <summary>TECHNICAL DETAILS <span aria-hidden="true">+</span></summary>
          <div>
            <span className="mono-label">STACK</span>
            <p>{project.stack}</p>
          </div>
          {project.services ? (
            <div>
              <span className="mono-label">AI + SERVICES</span>
              <p>{project.services}</p>
            </div>
          ) : null}
        </details>
      </article>

      <div className="carousel-controls">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="Previous project"
        >
          ← PREV
        </button>
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
        <button
          type="button"
          onClick={() => move(1)}
          aria-label="Next project"
        >
          NEXT →
        </button>
      </div>
    </div>
  );
}
