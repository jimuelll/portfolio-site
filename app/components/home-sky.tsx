"use client";

import { useEffect, useState } from "react";
import { SkyCanvas, type SkyStats } from "./sky/sky-canvas";
import { CvReceiver } from "./cv-receiver";
import { SecretCount } from "./secret-count";
import { Socials } from "./socials";
import { TopNav } from "./top-nav";

export function HomeSky() {
  const [stats, setStats] = useState<SkyStats>({
    scene: "night",
    detail: "",
    comets: 0,
    flares: 0,
    sats: 0,
    launched: 0,
    flared: 0,
  });

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
      <SkyCanvas variant="full" onStats={setStats} className="sky-fill" />
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
              <div key={stats.sats} className="flash">
                {stats.sats} {stats.sats === 1 ? "satellite" : "satellites"}
              </div>
              {stats.sats === 0 && (
                <div className="hint"><span className="say-click">click</span><span className="say-tap">tap</span> to launch a satellite ↯</div>
              )}
            </>
          ) : stats.scene === "night" ? (
            <>
              <div>{stats.detail}</div>
              <div key={stats.comets} className="flash">
                {stats.comets} {stats.comets === 1 ? "comet" : "comets"}
              </div>
              {stats.launched === 0 && (
                <div className="hint"><span className="say-click">click</span><span className="say-tap">tap</span> the sky ↯</div>
              )}
            </>
          ) : (
            <>
              <div>{stats.detail}</div>
              <div key={stats.flared} className="flash">
                {stats.flares} {stats.flares === 1 ? "flare" : "flares"}
              </div>
              {stats.flared === 0 && (
                <div className="hint"><span className="say-click">click</span><span className="say-tap">tap</span> to flare ↯</div>
              )}
            </>
          )}
          <SecretCount />
        </div>
      )}
      <main className="home-main">
        <section className="wall-label fade-in" data-sky-avoid>
          <h1>Jimuel Jean Untalan</h1>
          <p className="role">aspiring software engineer, open to internships</p>
          <p className="label-note">Computer Science student in Quezon, Philippines, building full web apps with React, Node.js, and SQL.</p>
          <blockquote className="quote">
            through the rough, to the stars
            <span className="caret" aria-hidden="true" />
          </blockquote>
          <div className="actions">
            <Socials />
            <CvReceiver />
          </div>
        </section>
      </main>
    </div>
  );
}
