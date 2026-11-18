"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useSkyStats } from "./sky/sky-canvas";
import { CvReceiver } from "./cv-receiver";
import { SecretCount } from "./secret-count";
import { Socials } from "./socials";
import { TopNav } from "./top-nav";
import { VisitorCount } from "./visitor-count";

export function HomeSky() {
  // The sky itself is in the layout (sky-canvas.tsx), so it carries on across page changes.
  const stats = useSkyStats();
  const [more, setMore] = useState(false);
  // Only while the sky's shaders are still compiling (a cold first visit); sky/engine.ts sets skyReady once the hero can show.
  const [cold] = useState(() => typeof document === "undefined" || !document.documentElement.dataset.skyReady);

  // The home page is a single screen at every size: no scrolling and no overscroll bounce. Restored when leaving.
  useEffect(() => {
    const root = document.documentElement;
    const previous = {
      overflow: root.style.overflow,
      overscroll: root.style.overscrollBehavior,
    };
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    return () => {
      root.style.overflow = previous.overflow;
      root.style.overscrollBehavior = previous.overscroll;
    };
  }, []);

  return (
    <div className="home">
      {cold && (
        <div className="sky-loader" role="status" aria-label="loading the sky">
          <div className="sky-loader-ramp" aria-hidden="true">
            {[..." .:-=+*#%@"].map((g, i) => <span key={i} style={{ "--i": i } as CSSProperties}>{g}</span>)}
          </div>
          <p aria-hidden="true">focusing the lens</p>
        </div>
      )}
      <TopNav />
      {stats.detail && (
        <div
          className="sky-stats"
          aria-hidden="true"
          data-sky-avoid
          key={stats.scene}
        >
          {stats.scene === "deep" ? (
            <>
              <div>{stats.detail}</div>
              <div className="hint">
                <span className="wide-only">drag to drift · pinch or scroll to zoom</span>
                <span className="narrow-only">drag · pinch</span> ↯
              </div>
            </>
          ) : stats.scene === "earth" ? (
            <>
              <div>{stats.detail}</div>
              {/* Counts appear once there's something to count; until then the hint speaks alone. */}
              {stats.sats > 0 && (
                <div key={stats.sats} className="flash">
                  {stats.sats} {stats.sats === 1 ? "satellite" : "satellites"}
                </div>
              )}
              {stats.sats === 0 && (
                <div className="hint"><span className="say-click">click</span><span className="say-tap">tap</span> to launch a satellite ↯</div>
              )}
            </>
          ) : stats.scene === "night" ? (
            <>
              <div>{stats.detail}</div>
              {stats.launched > 0 && (
                <div key={stats.comets} className="flash">
                  {stats.comets} {stats.comets === 1 ? "comet" : "comets"}
                </div>
              )}
              {stats.launched === 0 && (
                <div className="hint"><span className="say-click">click</span><span className="say-tap">tap</span> the sky ↯</div>
              )}
            </>
          ) : (
            <>
              <div>{stats.detail}</div>
              {stats.flared > 0 && (
                <div key={stats.flared} className="flash">
                  {stats.flares} {stats.flares === 1 ? "flare" : "flares"}
                </div>
              )}
              {stats.flared === 0 && (
                <div className="hint"><span className="say-click">click</span><span className="say-tap">tap</span> to flare ↯</div>
              )}
            </>
          )}
          <SecretCount />
          <VisitorCount className="visitor-line" />
        </div>
      )}
      <main className="home-main">
        <section className="wall-label fade-in" data-sky-avoid data-more={more || undefined}>
          <h1>Jimuel Jean Untalan</h1>
          <p className="role">
            aspiring software engineer, open to internships
            {/* Phones and tablets only: it trails the role line, where there's room, rather than crowding the links. */}
            <button type="button" className="label-more" aria-expanded={more} aria-controls="label-extra" onClick={() => setMore((m) => !m)}>
              {more ? "less ↑" : "more ↓"}
            </button>
          </p>
          {/* On phones and tablets this folds away behind "more", so the sky keeps the screen; desktop always shows it. */}
          <div className="label-extra" id="label-extra">
            <p className="label-note">Computer Science student building full-stack web apps with React, TypeScript, Node.js, and SQL. I use AI coding agents and build AI features into real projects.</p>
            <blockquote className="quote">
              through the rough, to the stars
              <span className="caret" aria-hidden="true" />
            </blockquote>
          </div>
          <div className="actions">
            <Socials />
            <CvReceiver />
          </div>
        </section>
      </main>
    </div>
  );
}
