import type { ReactNode } from "react";
import { SkyCanvas } from "./sky/sky-canvas";
import { TopNav } from "./top-nav";

/** Interior pages: a quieter, fixed starfield behind ordinary scrolling content. */
export function PageShell({ children, wide = false, centered = false }: { children: ReactNode; wide?: boolean; centered?: boolean }) {
  const width = `${wide ? "wide" : ""} ${centered ? "centered" : ""}`;
  return (
    <div className="page">
      <SkyCanvas variant="quiet" className="sky-fixed" />
      <TopNav />
      <main className={`page-main gutter ${width}`}>{children}</main>
      <footer className={`page-footer gutter ${width}`}>
        <span>© 2026 jimuel jean untalan</span>
        <span>quezon, ph · utc+8</span>
      </footer>
    </div>
  );
}
