"use client";

import { useEffect, useRef } from "react";
import { cv } from "../lib/portfolio";

/** The CV in a sheet over the page, printed in the theme's own ink, with the PDF a click away. */
export function CvViewer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="cv-viewer"
      aria-label="CV"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-sky-ignore
    >
      <header className="cv-viewer-bar">
        <span>cv · jimuel jean untalan</span>
        <nav>
          <a className="ink-link" href={cv.href} target="_blank" rel="noopener noreferrer">pdf ↗</a>
          <a className="ink-link" href={cv.href} download>download ↓</a>
          <button type="button" className="ink-link" onClick={onClose} aria-label="Close CV">close ×</button>
        </nav>
      </header>
      <div className="cv-sheet">
        {/* eslint-disable-next-line @next/next/no-img-element -- a static page scan, sized by its sheet */}
        <img src={cv.image} alt="Jimuel Jean Untalan's CV" width={1700} height={2200} loading="lazy"
          // Until the scan arrives the sheet stays the page colour, not a flash of ink.
          onLoad={(e) => (e.currentTarget.parentElement!.dataset.ready = "")}
          ref={(i) => { if (i?.complete && i.naturalWidth) i.parentElement!.dataset.ready = ""; }}
        />
      </div>
    </dialog>
  );
}
