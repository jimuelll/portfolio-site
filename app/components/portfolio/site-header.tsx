"use client";

import { useEffect, useState } from "react";
import { homeNavItems, type HomeSection, type NavPage } from "../../lib/portfolio";

type SiteHeaderProps = {
  activePage: NavPage;
  activeSection?: HomeSection;
  dark: boolean;
  onToggleTheme: () => void;
  onNavigatePage: (page: NavPage) => void;
  navTransition?: "merging" | "splitting" | null;
};

export function SiteHeader({
  activePage,
  activeSection = "work",
  dark,
  onToggleTheme,
  onNavigatePage,
  navTransition = null,
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [activePage]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <header className={`site-header ${navTransition ? `is-${navTransition}-nav` : ""}`}>
      <button
        className="identity"
        type="button"
        onClick={() => onNavigatePage("home")}
        aria-label="Go home"
      >
        <span className="identity-mark" aria-hidden="true" />
        <span>Untalan J.</span>
      </button>
      <button
        className={`menu-toggle ${menuOpen ? "is-open" : ""}`}
        type="button"
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
        aria-label={`${menuOpen ? "Close" : "Open"} navigation`}
        onClick={() => setMenuOpen((value) => !value)}
      >
        <span /><span /><span />
      </button>
      <nav
        id="primary-navigation"
        className={`${activePage === "home" ? "home-section-nav" : "lab-route-nav"} ${menuOpen ? "is-open" : ""}`}
        aria-label="Primary navigation"
      >
        {activePage === "home" ? (
          <>
            {homeNavItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`nav-section ${activeSection === item.id ? "active" : ""}`}
                aria-current={activeSection === item.id ? "location" : undefined}
                data-label={`/${item.label}`}
                onClick={() => setMenuOpen(false)}
              >
                <span className="nav-label-desktop">/{item.label}</span>
                <span className="nav-label-mobile">/{item.mobileLabel}</span>
              </a>
            ))}
            <button className="nav-lab" type="button" onClick={() => { setMenuOpen(false); onNavigatePage("lab"); }} data-label="/LAB">/LAB</button>
          </>
        ) : (
          <>
            <button className="nav-home" type="button" onClick={() => { setMenuOpen(false); onNavigatePage("home"); }} data-label="/HOME">/HOME</button>
            <button className="nav-lab active" type="button" aria-current="page" data-label="/LAB">/LAB</button>
          </>
        )}
      </nav>
      <button
        className="theme-toggle"
        onClick={onToggleTheme}
        aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
        aria-pressed={dark}
        title={`Switch to ${dark ? "light" : "dark"} mode`}
      >
        <span className="theme-copy">
          <span className="theme-label">THEME</span>
          <span className="theme-value">{dark ? "DARK" : "LIGHT"}</span>
        </span>
        <span className="theme-switch" aria-hidden="true">
          <span className="theme-switch-knob" />
        </span>
      </button>
    </header>
  );
}
