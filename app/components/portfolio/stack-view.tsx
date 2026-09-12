"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { stackGroups } from "../../lib/portfolio";
import { PageTitle } from "./page-title";

type StackLayout = {
  positions: THREE.Vector3[];
  pairs: [number, number][];
};

const desktopPairs: [number, number][] = [
  [0, 1],
  [1, 3],
  [3, 2],
];
const linearPairs: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
];

function columnCount(grid: HTMLDivElement | null) {
  if (!grid) return 2;
  return getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean)
    .length;
}

function makeLayout(
  Three: typeof import("three"),
  columns: number,
  worldWidth: number,
  worldHeight: number,
): StackLayout {
  if (columns <= 1) {
    const y = worldHeight * 0.36;
    return {
      positions: [
        new Three.Vector3(0, y, 0),
        new Three.Vector3(0, y / 3, 0),
        new Three.Vector3(0, -y / 3, 0),
        new Three.Vector3(0, -y, 0),
      ],
      pairs: linearPairs,
    };
  }

  if (columns >= 4) {
    const x = worldWidth * 0.39;
    return {
      positions: [
        new Three.Vector3(-x, 0, 0),
        new Three.Vector3(-x / 3, 0, 0),
        new Three.Vector3(x / 3, 0, 0),
        new Three.Vector3(x, 0, 0),
      ],
      pairs: linearPairs,
    };
  }

  const x = worldWidth * 0.27;
  const y = worldHeight * 0.25;
  return {
    positions: [
      new Three.Vector3(-x, y, 0),
      new Three.Vector3(x, y, 0),
      new Three.Vector3(-x, -y, 0),
      new Three.Vector3(x, -y, 0),
    ],
    pairs: desktopPairs,
  };
}

export function StackView() {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [threeModule, setThreeModule] = useState<typeof import("three") | null>(null);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
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
    loadObserver.observe(surface);
    return () => {
      cancelled = true;
      loadObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const surface = surfaceRef.current;
    const mount = mountRef.current;
    if (!surface || !mount || !threeModule) return;
    const Three = threeModule;

    const scene = new Three.Scene();
    const camera = new Three.OrthographicCamera(-2.2, 2.2, 1.7, -1.7, 0.1, 100);
    camera.position.set(0, 0, 10);

    const renderer = new Three.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const group = new Three.Group();
    scene.add(group);

    const color = new Three.Color();
    const nodeGeometry = new Three.BoxGeometry(0.16, 0.16, 0.16);
    const nodeMaterials = stackGroups.map(
      () =>
        new Three.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.56,
        }),
    );
    const nodeMeshes = nodeMaterials.map((material) => {
      const node = new Three.Mesh(nodeGeometry, material);
      group.add(node);
      return node;
    });

    const pulseMaterial = new Three.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });
    const pulse = new Three.Mesh(
      new Three.SphereGeometry(0.07, 10, 10),
      pulseMaterial,
    );
    group.add(pulse);

    const routeLines: THREE.Line[] = [];
    const routeMaterials: THREE.LineBasicMaterial[] = [];
    const routeCurves: THREE.CatmullRomCurve3[] = [];
    let routePairs: [number, number][] = desktopPairs;

    const readThemeColor = () => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue("--foreground")
        .trim();
      color.setStyle(value || "#111111");
      nodeMaterials.forEach((material) => material.color.copy(color));
      pulseMaterial.color.copy(color);
      routeMaterials.forEach((material) => material.color.copy(color));
    };

    const rebuildRoutes = (layout: StackLayout) => {
      routeLines.forEach((line) => {
        group.remove(line);
        line.geometry.dispose();
      });
      routeLines.length = 0;
      routeMaterials.forEach((material) => material.dispose());
      routeMaterials.length = 0;
      routeCurves.length = 0;
      routePairs = layout.pairs;

      nodeMeshes.forEach((node, index) =>
        node.position.copy(layout.positions[index]),
      );

      layout.pairs.forEach(([from, to], index) => {
        const start = layout.positions[from].clone();
        const end = layout.positions[to].clone();
        const middle = start.clone().lerp(end, 0.5);
        if (layout.pairs === desktopPairs && index === 1) middle.x += 0.1;
        const curve = new Three.CatmullRomCurve3([start, middle, end]);
        const geometry = new Three.BufferGeometry().setFromPoints(
          curve.getPoints(28),
        );
        const material = new Three.LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.3,
        });
        const line = new Three.Line(geometry, material);
        group.add(line);
        routeCurves.push(curve);
        routeMaterials.push(material);
        routeLines.push(line);
      });
      readThemeColor();
    };

    const resize = () => {
      const width = Math.max(1, surface.clientWidth);
      const height = Math.max(1, surface.clientHeight);
      const aspect = width / height;
      const worldWidth = 4.4;
      const worldHeight = worldWidth / Math.max(0.45, aspect);
      renderer.setSize(width, height, false);
      camera.left = -worldWidth / 2;
      camera.right = worldWidth / 2;
      camera.top = worldHeight / 2;
      camera.bottom = -worldHeight / 2;
      camera.updateProjectionMatrix();
      rebuildRoutes(
        makeLayout(Three, columnCount(gridRef.current), worldWidth, worldHeight),
      );
    };

    readThemeColor();
    const themeObserver = new MutationObserver(readThemeColor);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(surface);
    resize();

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = new Three.Timer();
    timer.connect(document);
    const inViewRef = { current: false };
    let animationFrame = 0;
    let running = false;

    const updateScene = () => {
      const active = activeRef.current;
      const pointer = pointerRef.current;
      const targetRotationY = reducedMotion ? 0 : pointer.x * 0.055;
      const targetRotationX = reducedMotion ? 0 : -pointer.y * 0.045;
      group.rotation.y += (targetRotationY - group.rotation.y) * 0.08;
      group.rotation.x += (targetRotationX - group.rotation.x) * 0.08;

      nodeMeshes.forEach((node, index) => {
        const isActive = active === index;
        const isDimmed = active !== null && !isActive;
        const targetScale = isActive ? 1.5 : 1;
        const targetOpacity = isActive ? 0.98 : isDimmed ? 0.2 : 0.56;
        const material = node.material as THREE.MeshBasicMaterial;
        node.scale.x +=
          (targetScale - node.scale.x) * (reducedMotion ? 1 : 0.12);
        node.scale.y = node.scale.x;
        node.scale.z = node.scale.x;
        material.opacity +=
          (targetOpacity - material.opacity) * (reducedMotion ? 1 : 0.12);
        if (!reducedMotion) {
          node.rotation.x += 0.002;
          node.rotation.y += 0.003;
        }
      });

      routeMaterials.forEach((material, index) => {
        const [from, to] = routePairs[index] ?? [0, 1];
        const isConnected = active === null || active === from || active === to;
        const targetOpacity = active === null ? 0.3 : isConnected ? 0.82 : 0.08;
        material.opacity +=
          (targetOpacity - material.opacity) * (reducedMotion ? 1 : 0.12);
      });

      if (reducedMotion || routeCurves.length === 0) {
        pulse.visible = false;
      } else {
        timer.update();
        const progress = (timer.getElapsed() % 5.6) / 5.6;
        const scaled = progress * routeCurves.length;
        const segment = Math.min(routeCurves.length - 1, Math.floor(scaled));
        pulse.position.copy(routeCurves[segment].getPointAt(scaled - segment));
        pulse.visible = true;
      }
      renderer.render(scene, camera);
    };

    const render = () => {
      if (!running) return;
      updateScene();
      animationFrame = window.requestAnimationFrame(render);
    };
    const start = () => {
      if (running || !inViewRef.current || document.hidden) return;
      running = true;
      render();
    };
    const stop = () => {
      running = false;
      window.cancelAnimationFrame(animationFrame);
    };

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting;
        if (entry.isIntersecting) start();
        else stop();
      },
      { rootMargin: "120px" },
    );
    visibilityObserver.observe(surface);
    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const bounds = surface.getBoundingClientRect();
      pointerRef.current = {
        x: ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
        y: ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 - 1,
      };
    };
    const resetPointer = () => {
      pointerRef.current = { x: 0, y: 0 };
    };
    surface.addEventListener("pointermove", handlePointerMove);
    surface.addEventListener("pointerleave", resetPointer);

    return () => {
      stop();
      timer.disconnect();
      surface.removeEventListener("pointermove", handlePointerMove);
      surface.removeEventListener("pointerleave", resetPointer);
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      routeLines.forEach((line) => line.geometry.dispose());
      routeMaterials.forEach((material) => material.dispose());
      nodeGeometry.dispose();
      nodeMaterials.forEach((material) => material.dispose());
      pulse.geometry.dispose();
      pulseMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [threeModule]);

  const activate = (index: number) => {
    activeRef.current = index;
    setActiveIndex(index);
  };
  const clearActive = () => {
    activeRef.current = null;
    setActiveIndex(null);
  };

  return (
    <section className="profile-section stack-section view" id="stack">
      <PageTitle index="03" eyebrow="CAPABILITY MAP" title="STACK" />
      <div className="stack-routing-surface" ref={surfaceRef}>
        <div
          className="stack-signal-canvas"
          ref={mountRef}
          aria-hidden="true"
        />
        <div className="stack-grid" ref={gridRef}>
          {stackGroups.map((group, index) => {
            const isActive = activeIndex === index;
            const isDimmed = activeIndex !== null && !isActive;
            return (
              <article
                key={group.name}
                className={`${isActive ? "is-active" : ""} ${
                  isDimmed ? "is-dimmed" : ""
                }`}
                role="button"
                tabIndex={0}
                aria-current={isActive ? "true" : undefined}
                aria-label={`${group.name} stack category. Highlight connected technologies.`}
                onMouseEnter={() => activate(index)}
                onMouseLeave={clearActive}
                onFocus={() => activate(index)}
                onBlur={clearActive}
                onClick={() => activate(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    activate(index);
                  }
                }}
              >
                <span className="stack-number">0{index + 1}</span>
                <span className="mono-label">{group.name}</span>
                <p>{group.items}</p>
              </article>
            );
          })}
        </div>
      </div>
      <div className="stack-note">
        <span className="mono-label">PRINCIPLE</span>
        <p>Tools are selected for the problem. Fundamentals stay constant.</p>
      </div>
    </section>
  );
}
