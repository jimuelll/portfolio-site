"use client";

import { useEffect, useRef, useState } from "react";
import { cv } from "../lib/portfolio";

/** The /about download button, pinned with the contact links. Until there's a PDF it says the CV is landing soon. */
export function CvButton() {
  const [pressed, setPressed] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (cv.href) {
    return <a className="cv-btn" href={cv.href} download>download cv ↓</a>;
  }

  function press() {
    setPressed(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPressed(false), 3000);
  }

  return (
    <button type="button" className={`cv-btn ${pressed ? "sent" : ""}`} onClick={press}>
      <span aria-live="polite">{pressed ? "✦ cv landing soon" : "download cv ↓"}</span>
    </button>
  );
}
