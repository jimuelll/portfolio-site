import Link from "next/link";
import { navItems, type NavPage } from "../../lib/portfolio";

type SiteHeaderProps = {
  activePage: NavPage;
  dark: boolean;
  onToggleTheme: () => void;
};

export function SiteHeader({
  activePage,
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
      <nav aria-label="Primary navigation">
        {navItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`nav-${item.id} ${activePage === item.id ? "active" : ""}`}
            aria-current={activePage === item.id ? "page" : undefined}
            data-label={`/${item.label}`}
          >
            /{item.label}
          </Link>
        ))}
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
