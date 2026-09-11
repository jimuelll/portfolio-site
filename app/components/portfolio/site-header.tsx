import { navItems, type NavItem } from "../../lib/portfolio";

type SiteHeaderProps = {
  activeNav: NavItem;
  dark: boolean;
  onToggleTheme: () => void;
};

export function SiteHeader({
  activeNav,
  dark,
  onToggleTheme,
}: SiteHeaderProps) {
  return (
    <header className="site-header">
      <a
        className="identity"
        href="#top"
        aria-label="Go to the top"
      >
        <span className="identity-mark" aria-hidden="true" />
        <span>Untalan J.</span>
      </a>
      <nav aria-label="Primary navigation">
        {navItems.map((item) => (
          <a
            key={item}
            href={`#${item}`}
            className={activeNav === item ? "active" : undefined}
            aria-current={activeNav === item ? "location" : undefined}
            data-label={`/${item.toUpperCase()}`}
          >
            /{item.toUpperCase()}
          </a>
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
