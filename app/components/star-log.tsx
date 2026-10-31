"use client";

import { useEffect, useRef, useState } from "react";
import { LOG_EVENT, foundSecrets, secrets, type SecretId } from "../lib/secrets";

const READ_KEY = "sky-log-read";

/**
 * The reward for reading the whole dossier: once the reader reaches the end, a star log fades in charting the
 * sky's secrets. Found ones are lit and named; the rest are only hints. It remembers being earned.
 */
export function StarLog() {
  const end = useRef<HTMLDivElement>(null);
  const [earned, setEarned] = useState(false);
  const [found, setFound] = useState<SecretId[]>([]);

  useEffect(() => {
    const sync = () => setFound(foundSecrets());
    let read = false;
    try { read = localStorage.getItem(READ_KEY) === "1"; } catch {}
    const frame = requestAnimationFrame(() => {
      sync();
      if (read) setEarned(true);
    });
    window.addEventListener(LOG_EVENT, sync);
    // Only reaching the very end of the page earns it.
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setEarned(true);
      try { localStorage.setItem(READ_KEY, "1"); } catch {}
      observer.disconnect();
    });
    if (end.current && !read) observer.observe(end.current);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(LOG_EVENT, sync);
      observer.disconnect();
    };
  }, []);

  const all = found.length === secrets.length;
  return (
    <>
      <section className={`about-row star-log ${earned ? "on" : ""}`} aria-hidden={!earned}>
        <h2><span>06</span>Star log</h2>
        <div className="about-body">
          <p className="star-chart" aria-label={`${found.length} of ${secrets.length} secrets found`}>
            {secrets.map((s) => <span key={s.id} className={found.includes(s.id) ? "lit" : ""}>{found.includes(s.id) ? "✦" : "·"}</span>)}
            <span className="faint">{found.length}/{secrets.length} charted{all ? " · the whole sky is yours ✦" : ""}</span>
          </p>
          <ul className="star-entries">
            {secrets.map((s) =>
              found.includes(s.id) ? (
                <li key={s.id}><span>{s.name}</span><span className="muted">{s.how}</span></li>
              ) : (
                <li key={s.id} className="unfound"><span className="redacted" aria-label="Not found yet">░░░░░</span><span className="faint">{s.hint}</span></li>
              ),
            )}
          </ul>
        </div>
      </section>
      <div ref={end} className="star-log-end" aria-hidden="true" />
    </>
  );
}
