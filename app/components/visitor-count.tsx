"use client";

import { useEffect, useState } from "react";

/** Registers this visit once per mount and shows the running total. Renders nothing until the backend answers. */
export function VisitorCount({ className }: { className?: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/visit", { method: "POST" })
      .then((r) => r.json())
      .then((d: { count: number | null }) => { if (alive && typeof d.count === "number") setCount(d.count); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (count === null) return null;
  return (
    <span className={`visitor-count${className ? ` ${className}` : ""}`}>
      <span className="visitor-mark" aria-hidden="true">✦</span> {count.toLocaleString("en-US")} {count === 1 ? "visitor" : "visitors"}
    </span>
  );
}
