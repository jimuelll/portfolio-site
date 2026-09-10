import { navItems, type View } from "../../lib/portfolio";

type SiteHeaderProps = {
  view: View;
  dark: boolean;
  onNavigate: (view: View) => void;
  onToggleTheme: () => void;
};

export function SiteHeader({
  view,
  dark,
  onNavigate,
  onToggleTheme,
}: SiteHeaderProps) {
  return (
    <header className="site-header">
      <button
        className="identity"
        onClick={() => onNavigate("work")}
        aria-label="Go to work"
      >
        <span className="identity-mark" aria-hidden="true" />
        <span>Untalan J.</span>
      </button>
      <nav aria-label="Primary navigation">
        {navItems.map((item) => (
          <button
            key={item}
            className={view === item ? "active" : ""}
            onClick={() => onNavigate(item)}
          >
            /{item.toUpperCase()}
          </button>
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
