import Link from "next/link";
import { homeNavItems, type HomeSection, type NavPage } from "../../lib/portfolio";

type SiteHeaderProps = {
  activePage: NavPage;
  activeSection?: HomeSection;
  dark: boolean;
  onToggleTheme: () => void;
};

export function SiteHeader({
  activePage,
  activeSection = "work",
  dark,
  onToggleTheme,
}: SiteHeaderProps) {
  return (
    <header className="site-header">
      <Link
        className="identity"
        href="/"
        aria-label="Go home"
      >
        <span className="identity-mark" aria-hidden="true" />
        <span>Untalan J.</span>
      </Link>
      <nav className={activePage === "home" ? "home-section-nav" : "lab-route-nav"} aria-label="Primary navigation">
        {activePage === "home" ? (
          <>
            {homeNavItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`nav-section ${activeSection === item.id ? "active" : ""}`}
                aria-current={activeSection === item.id ? "location" : undefined}
                data-label={`/${item.label}`}
              >
                <span className="nav-label-desktop">/{item.label}</span>
                <span className="nav-label-mobile">/{item.mobileLabel}</span>
              </a>
            ))}
            <Link className="nav-lab" href="/lab" data-label="/LAB">/LAB</Link>
          </>
        ) : (
          <>
            <Link className="nav-home" href="/" data-label="/HOME">/HOME</Link>
            <Link className="nav-lab active" href="/lab" aria-current="page" data-label="/LAB">/LAB</Link>
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
