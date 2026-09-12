"use client";

import { useEffect, useState, type MouseEvent } from "react";
import {
  homeNavItems,
  type HomeSection,
  type NavPage,
} from "../../lib/portfolio";

type SiteHeaderProps = {
  activePage: NavPage;
  activeSection?: HomeSection;
  dark: boolean;
  onToggleTheme: () => void;
  onNavigatePage: (page: NavPage) => void;
  navTransition?: "glitching" | "merging" | "holding" | "home-glitching" | "splitting" | null;
};

export function SiteHeader({
  activePage,
  activeSection = "start",
  dark,
  onToggleTheme,
  onNavigatePage,
  navTransition = null,
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const showLabNavigation =
    navTransition === "holding" ||
    (activePage === "lab" && navTransition !== "splitting");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function handleRouteLink(event: MouseEvent<HTMLAnchorElement>, page: NavPage) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;
    event.preventDefault();
    setMenuOpen(false);
    onNavigatePage(page);
  }

  return (
    <header
      className={`site-header ${navTransition ? `is-${navTransition}-nav` : ""}`}
    >
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
        <span />
        <span />
        <span />
      </button>
      <nav
        id="primary-navigation"
        className={`${showLabNavigation ? "lab-route-nav" : "home-section-nav"} ${menuOpen ? "is-open" : ""}`}
        aria-label="Primary navigation"
      >
        {!showLabNavigation ? (
          <>
            {homeNavItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`nav-section ${activeSection === item.id ? "active" : ""}`}
                aria-current={
                  activeSection === item.id ? "location" : undefined
                }
                data-label={`/${item.label}`}
                onClick={() => setMenuOpen(false)}
              >
                <span className="nav-label-desktop">/{item.label}</span>
                <span className="nav-label-mobile">/{item.mobileLabel}</span>
              </a>
            ))}
            <a
              className="nav-lab"
              href="/lab"
              onClick={(event) => handleRouteLink(event, "lab")}
              data-label="/LAB"
            >
              /LAB
            </a>
            <span className="nav-merge-home" aria-hidden="true">/HOME</span>
          </>
        ) : (
          <>
            <a
              className="nav-home"
              href="/"
              onClick={(event) => handleRouteLink(event, "home")}
              data-label="/HOME"
            >
              /HOME
            </a>
            <a
              className="nav-lab active"
              href="/lab"
              aria-current="page"
              data-label="/LAB"
            >
              /LAB
            </a>
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
