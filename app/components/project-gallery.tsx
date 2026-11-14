"use client";

import Image from "next/image";
import { useState } from "react";
import type { Project } from "../lib/portfolio";

/** One large screenshot, with a thumbnail row that swaps it. A single shot needs no row. */
export function ProjectGallery({ shots }: { shots: NonNullable<Project["gallery"]> }) {
  const [active, setActive] = useState(0);
  const shot = shots[active];
  // Frame at the widest shot's shape: those show whole, taller ones lose only a little off the bottom, and swapping never jumps.
  const ratio = Math.max(...shots.map((s) => s.width / s.height));
  return (
    <figure className="gallery" style={{ "--shot-ratio": ratio } as React.CSSProperties}>
      <div className="gallery-main">
        <Image key={shot.src} src={shot.src} width={shot.width} height={shot.height} alt={shot.alt} sizes="(max-width: 860px) 100vw, 40rem" loading="eager" />
      </div>
      <figcaption aria-live="polite">{shot.caption}</figcaption>
      {shots.length > 1 && (
        <div className="gallery-thumbs">
          {shots.map((s, i) => (
            <button key={s.src} type="button" onClick={() => setActive(i)} aria-pressed={i === active} aria-label={`Show screenshot: ${s.caption}`}>
              <Image src={s.src} width={s.width} height={s.height} alt="" sizes="10rem" />
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}
