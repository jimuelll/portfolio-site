"use client";

import { useEffect, useState } from "react";
import CursorTrail from "../../cursor-trail";
import { SiteHeader } from "./site-header";

const slots = ["01", "02", "03", "04"];

export function LabShell() {
  const [dark, setDark] = useState(false);
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    const initialDark = window.localStorage.getItem("mono-corrupt-theme") === "dark";
    setDark(initialDark);
    document.documentElement.dataset.theme = initialDark ? "dark" : "light";
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    window.localStorage.setItem("mono-corrupt-theme", dark ? "dark" : "light");
  }, [dark, themeReady]);

  return (
    <main id="top" className="shell lab-shell">
      <CursorTrail suspended={false} />
      <SiteHeader
        activePage="lab"
        dark={dark}
        onToggleTheme={() => setDark((value) => !value)}
      />

      <section className="lab-page" aria-labelledby="lab-title">
        <div className="lab-heading">
          <div>
            <span className="mono-label">EXPERIMENTAL INDEX / 00</span>
            <h1 className="lab-title" id="lab-title" aria-label="Lab">
              <span className="lab-title-base">LAB</span>
              <span className="lab-title-copy lab-title-copy-a" aria-hidden="true">LAB</span>
              <span className="lab-title-copy lab-title-copy-b" aria-hidden="true">LAB</span>
            </h1>
          </div>
          <p>A space for experiments, small tools, visual studies, and unfinished ideas.</p>
        </div>

        <div className="lab-grid" aria-label="Future lab projects">
          {slots.map((slot) => (
            <article className="lab-slot" key={slot}>
              <span className="mono-label">SLOT / {slot}</span>
              <span className="lab-slot-state mono-label">STATUS::AVAILABLE</span>
              <strong>{slot}</strong>
              <p>RESERVED FOR A FUTURE EXPERIMENT</p>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <span>© 2026 UNTALAN J.</span>
        <span>LAB BUILD 00</span>
        <span>EXPERIMENTS / INCOMING</span>
        <LinkHome />
      </footer>
    </main>
  );
}

function LinkHome() {
  return <a href="/">RETURN HOME ↗</a>;
}
