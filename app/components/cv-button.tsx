"use client";

import { useState } from "react";
import { CvViewer } from "./cv-viewer";

/** The /about CV button, pinned with the contact links: opens the viewer. */
export function CvButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="cv-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">view cv ✦</button>
      <CvViewer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
