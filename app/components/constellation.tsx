"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { buildContributionWeeks, type Contribution, type ContributionsResponse } from "../lib/github";

const URL = "https://github-contributions-api.jogruber.de/v4/jimuelll?y=last";
const GLYPH = ["·", "+", "*", "✦", "✦"];

/** GitHub contributions for recent weeks, charted as a field of stars: busier days burn brighter. */
export function Constellation({ weeks: weekCount = 26 }: { weeks?: number }) {
  const [days, setDays] = useState<Contribution[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(URL)
      .then((r) => (r.ok ? (r.json() as Promise<ContributionsResponse>) : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setDays(data.contributions ?? []);
        setTotal(data.total?.lastYear ?? null);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
  }, []);

  const weeks = buildContributionWeeks(days ?? [], weekCount);

  return (
    <figure className="constellation">
      <div className="constellation-grid" aria-label={`GitHub contribution activity, last ${weekCount} weeks`}>
        {weeks.map((week, w) => (
          <span key={w}>
            {week.map((day, di) => (
              // Each star has its own delay, so they come out column by column like dusk.
              <i key={day.date} style={{ "--d": `${w * 28 + ((di * 37 + w * 13) % 120)}ms` } as CSSProperties} data-level={days ? day.level : 0} title={`${day.date}: ${day.count} contribution${day.count === 1 ? "" : "s"}`}>
                {GLYPH[days ? day.level : 0]}
              </i>
            ))}
          </span>
        ))}
      </div>
      <figcaption>
        {failed ? "github signal lost" : days === null ? "scanning github…" : `${total ?? "—"} contributions this year`}
        {" · "}
        <a className="ink-link" href="https://github.com/jimuelll" target="_blank" rel="noopener noreferrer">github</a>
      </figcaption>
    </figure>
  );
}
