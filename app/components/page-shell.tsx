import type { ReactNode } from "react";
import { TopNav } from "./top-nav";
import { VisitorCount } from "./visitor-count";

/** Interior pages: ordinary scrolling content over the quieter, fixed starfield (the layout's sky, sky-canvas.tsx). */
export function PageShell({ children, wide = false, centered = false }: { children: ReactNode; wide?: boolean; centered?: boolean }) {
  const width = `${wide ? "wide" : ""} ${centered ? "centered" : ""}`;
  return (
    <div className="page">
      <TopNav />
      <main className={`page-main gutter ${width}`}>{children}</main>
      <footer className={`page-footer gutter ${width}`}>
        <span>© 2026 jimuel jean untalan</span>
        <span>quezon, ph · utc+8</span>
        <VisitorCount />
      </footer>
    </div>
  );
}
