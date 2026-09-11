"use client";

import { useEffect, useState, type CSSProperties } from "react";
import CursorTrail from "../../cursor-trail";
import type { HomeSection, NavPage } from "../../lib/portfolio";
import { AboutView } from "./about-view";
import { ContactView } from "./contact-view";
import { ExperienceView } from "./experience-view";
import { GithubContributions } from "./github-contributions";
import { LabView } from "./lab-view";
import { SiteHeader } from "./site-header";
import { StackView } from "./stack-view";
import { WorkView } from "./work-view";

type CorruptionPiece = {
  style: CSSProperties;
  type: "fragment" | "bar" | "cut";
};

const initialCorruption: CorruptionPiece[] = [];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function createCorruptionLayout(): CorruptionPiece[] {
  const fragments = Array.from({ length: 24 }, (_, index) => {
    const width =
      index % 6 === 0 ? randomBetween(14, 28) : randomBetween(3, 13);
    return {
      type: "fragment" as const,
      style: {
        width: `${width.toFixed(1)}vw`,
        height: `${randomBetween(0.45, 2.8).toFixed(2)}vh`,
        left: `${randomBetween(-8, 100 - width + 8).toFixed(1)}vw`,
        top: `${randomBetween(1, 98).toFixed(1)}vh`,
        "--layer-opacity": randomBetween(0.58, 0.96).toFixed(2),
        "--layer-x": `${randomBetween(-30, 30).toFixed(0)}px`,
        "--layer-y": `${randomBetween(-5, 5).toFixed(0)}px`,
        "--layer-reverse-x": `${randomBetween(-18, 18).toFixed(0)}px`,
        animationDelay: `${(-randomBetween(0, 0.2)).toFixed(2)}s`,
      } as CSSProperties,
    };
  });
  const bars = Array.from({ length: 18 }, (_, index) => {
    const width =
      index % 5 === 0 ? randomBetween(18, 34) : randomBetween(4, 18);
    return {
      type: "bar" as const,
      style: {
        width: `${width.toFixed(1)}vw`,
        height: `${randomBetween(1, 4.5).toFixed(1)}px`,
        left: `${randomBetween(-4, 100 - width + 4).toFixed(1)}vw`,
        top: `${randomBetween(1, 99).toFixed(1)}vh`,
        "--bar-opacity": randomBetween(0.55, 0.95).toFixed(2),
        "--bar-x": `${randomBetween(-32, 32).toFixed(0)}px`,
        "--bar-y": `${randomBetween(-3, 3).toFixed(0)}px`,
        "--bar-reverse-x": `${randomBetween(-16, 16).toFixed(0)}px`,
        animationDelay: `${(-randomBetween(0, 0.24)).toFixed(2)}s`,
      } as CSSProperties,
    };
  });
  const cuts = Array.from({ length: 22 }, (_, index) => {
    const width =
      index % 7 === 0 ? randomBetween(16, 30) : randomBetween(3, 16);
    return {
      type: "cut" as const,
      style: {
        width: `${width.toFixed(1)}vw`,
        height: `${randomBetween(2, 6).toFixed(1)}px`,
        left: `${randomBetween(-4, 100 - width + 4).toFixed(1)}vw`,
        top: `${randomBetween(1, 99).toFixed(1)}vh`,
        "--cut-x": `${randomBetween(-20, 20).toFixed(0)}px`,
        "--cut-reverse-x": `${randomBetween(-10, 10).toFixed(0)}px`,
        animationDelay: `${(-randomBetween(0, 0.16)).toFixed(2)}s`,
      } as CSSProperties,
    };
  });

  return [...fragments, ...bars, ...cuts];
}

export function PortfolioShell() {
  const [dark, setDark] = useState(false);
  const [activeSection, setActiveSection] = useState<HomeSection>("work");
  const [themeReady, setThemeReady] = useState(false);
  const [corrupting, setCorrupting] = useState(false);
  const [corruptionLayout, setCorruptionLayout] = useState(initialCorruption);
  const [pageMode, setPageMode] = useState<NavPage>("home");
  const [navTransition, setNavTransition] = useState<"merging" | "splitting" | null>(null);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("mono-corrupt-theme");
    const initialDark = savedTheme === "dark";
    setDark(initialDark);
    document.documentElement.dataset.theme = initialDark ? "dark" : "light";
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    window.localStorage.setItem("mono-corrupt-theme", dark ? "dark" : "light");
  }, [dark, themeReady]);

  useEffect(() => {
    if (pageMode !== "home") return;
    const sections: HomeSection[] = ["work", "experience", "about", "contact"];
    let frame = 0;

    const updateActiveSection = () => {
      frame = 0;
      const marker = window.innerHeight * 0.34;
      let current: HomeSection = "work";
      sections.forEach((section) => {
        const element = document.getElementById(section);
        if (element && element.getBoundingClientRect().top <= marker) current = section;
      });
      setActiveSection(current);
    };

    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pageMode]);

  function navigatePage(nextPage: NavPage) {
    if (nextPage === pageMode || navTransition) return;

    if (nextPage === "lab") {
      setNavTransition("merging");
      window.setTimeout(() => {
        setPageMode("lab");
        setNavTransition(null);
        window.scrollTo({ top: 0, behavior: "auto" });
      }, 560);
      return;
    }

    setPageMode("home");
    setNavTransition("splitting");
    window.scrollTo({ top: 0, behavior: "auto" });
    window.setTimeout(() => setNavTransition(null), 560);
  }

  function transitionTheme() {
    if (corrupting) return;
    setCorruptionLayout(createCorruptionLayout());
    setCorrupting(true);
    [72, 146, 238, 344, 468, 612, 742].forEach((delay) => {
      window.setTimeout(() => {
        setCorruptionLayout(createCorruptionLayout());
      }, delay);
    });
    window.setTimeout(() => {
      setDark((value) => !value);
    }, 220);
    window.setTimeout(() => setCorrupting(false), 840);
  }

  return (
    <main id="top" className={`shell ${corrupting ? "is-corrupting" : ""}`}>
      <CursorTrail suspended={corrupting} />
      <div className="corruption" aria-hidden="true">
        {corruptionLayout.map(({ style, type }, index) => (
          <i
            className={`corrupt-piece corrupt-${type}`}
            style={style}
            key={index}
          />
        ))}
      </div>

      <SiteHeader
        activePage={pageMode}
        activeSection={activeSection}
        dark={dark}
        onToggleTheme={transitionTheme}
        onNavigatePage={navigatePage}
        navTransition={navTransition}
      />
      {pageMode === "home" ? (
        <>
          <WorkView />
          <div className="profile-band">
            <ExperienceView />
            <StackView />
          </div>
          <AboutView />
          <GithubContributions />
          <ContactView />
        </>
      ) : (
        <LabView />
      )}

      <footer>
        <span>© 2026 UNTALAN J.</span>
        <span>{pageMode === "lab" ? "LAB BUILD 00" : "BUILD 2026.09"}</span>
        <span>{pageMode === "lab" ? "EXPERIMENTS / INCOMING" : "LOCATION / CITY, COUNTRY"}</span>
        {pageMode === "lab" ? (
          <button className="footer-home" type="button" onClick={() => navigatePage("home")}>RETURN HOME ↗</button>
        ) : (
          <a href="mailto:hello@example.com">CONTACT ↗</a>
        )}
      </footer>
    </main>
  );
}
