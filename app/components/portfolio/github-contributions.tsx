"use client";

import { useEffect, useState } from "react";
import { buildContributionWeeks, type Contribution, type ContributionsResponse } from "../../lib/github";

const GITHUB_CONTRIBUTIONS_URL = "https://github-contributions-api.jogruber.de/v4/jimuelll?y=last";

export function GithubContributions() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(GITHUB_CONTRIBUTIONS_URL)
      .then((response) => {
        if (!response.ok) throw new Error("Contribution data unavailable");
        return response.json() as Promise<ContributionsResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        const nextContributions = data.contributions ?? [];
        setContributions(nextContributions);
        setTotal(data.total?.lastYear ?? null);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const weeks = buildContributionWeeks(contributions);

  return (
    <section className="contributions" id="github" aria-labelledby="contributions-title">
      <div className="contribution-copy">
        <span className="section-number">05</span>
        <div>
          <span className="mono-label">OPEN SOURCE / ACTIVITY</span>
          <h2 id="contributions-title">GITHUB ACTIVITY</h2>
        </div>
        <p>Consistent work across products, experiments, and open-source projects.</p>
      </div>
      <div className="contribution-panel">
        <div className="contribution-topline mono-label">
          <span>{total === null ? "LAST 36 WEEKS" : `${total} CONTRIBUTIONS / LAST YEAR`}</span>
          <a href="https://github.com/jimuelll" target="_blank" rel="noreferrer">VIEW PROFILE ↗</a>
        </div>
        <div className={`contribution-chart ${loading ? "is-loading" : ""}`} aria-label="GitHub contribution activity for jimuelll">
          {error ? <p className="contribution-error">CONTRIBUTION DATA TEMPORARILY UNAVAILABLE. <a href="https://github.com/jimuelll" target="_blank" rel="noreferrer">OPEN GITHUB ↗</a></p> : weeks.map((week, weekIndex) => (
            <div className="contribution-week" key={weekIndex}>
              {week.map((day) => <i key={day.date} data-level={day.level} title={`${day.count} contribution${day.count === 1 ? "" : "s"} on ${day.date}`} />)}
            </div>
          ))}
        </div>
        <div className="contribution-legend mono-label"><span>LESS</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} data-level={level} />)}<span>MORE</span></div>
      </div>
    </section>
  );
}
