"use client";

import { useEffect, useState } from "react";
import { coreStack } from "../lib/portfolio";
import { SkyCanvas, type SkyStats } from "./sky/sky-canvas";
import { CvReceiver } from "./cv-receiver";
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

  // On desktop the home page is a single screen: no scrolling and no overscroll bounce. Phones stack the sky
  // above the text, so a short phone may need to scroll a little. Restored when leaving.
  useEffect(() => {
    const root = document.documentElement;
    const previous = {
      overflow: root.style.overflow,
      overscroll: root.style.overscrollBehavior,
    };
    const wide = window.matchMedia("(min-width: 1024px)");
    const lock = () => {
      root.style.overflow = wide.matches ? "hidden" : previous.overflow;
      root.style.overscrollBehavior = wide.matches ? "none" : previous.overscroll;
    };
    lock();
    wide.addEventListener("change", lock);
    return () => {
      wide.removeEventListener("change", lock);
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
          {stats.scene === "earth" ? (
            <>
              <div>{stats.detail}</div>
              <div key={stats.sats} className="flash">
                {stats.sats} {stats.sats === 1 ? "satellite" : "satellites"}
              </div>
              {stats.sats === 0 && (
                <div className="hint">click to launch a satellite ↯</div>
              )}
            </>
          ) : stats.scene === "night" ? (
            <>
              <div>{stats.detail}</div>
              <div key={stats.comets} className="flash">
                {stats.comets} {stats.comets === 1 ? "comet" : "comets"}
              </div>
              {stats.launched === 0 && (
                <div className="hint">click the sky ↯</div>
              )}
            </>
          ) : (
            <>
              <div>{stats.detail}</div>
              <div key={stats.flared} className="flash">
                {stats.flares} {stats.flares === 1 ? "flare" : "flares"}
              </div>
              {stats.flared === 0 && (
                <div className="hint">click to flare ↯</div>
              )}
            </>
          )}
        </div>
      )}
      <main className="home-main gutter">
        {/* Desktop only: the name fills the empty sky across from the moon. Phones keep the short greeting below. */}
        <header className="hero fade-in" data-sky-avoid>
          <h1 className="hero-name">
            Jimuel Jean
            <br />
            Untalan
          </h1>
          <p className="hero-role">
            full-stack developer · seeking a software internship
          </p>
        </header>
        <blockquote className="quote fade-in" data-sky-avoid>
          through the rough, <br />
          to the stars
          <span className="caret" aria-hidden="true" />
        </blockquote>
        <div className="intro fade-in delay" data-sky-avoid>
          <h1 className="hi">Hi, I&apos;m Jean.</h1>
          {/* Desktop only: what a recruiter scans for, under the name. */}
          <p className="home-info">
            CS student at MSEUF-CI in Quezon. I like building things people
            actually use, from the database to the last pixel.
          </p>
          <p className="core-stack">
            <span className="label">core stack</span>
            {coreStack.join(" · ")}
          </p>
          <Socials />
        </div>
        {/* Under the moon on desktop; the last line of the column on phones. */}
        <CvReceiver />
      </main>
    </div>
  );
}
