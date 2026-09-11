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

  const weeks = buildContributionWeeks(contributions).slice(-18);

  return (
    <a
      className={`hero-github-action ${loading ? "is-loading" : ""}`}
      href="https://github.com/jimuelll"
      target="_blank"
      rel="noreferrer"
      aria-label={total === null ? "View GitHub profile" : `View GitHub profile, ${total} contributions in the last year`}
      title="GitHub activity"
    >
      <span className="hero-github-label">GITHUB</span>
      <span className="hero-github-grid" aria-hidden="true">
        {error ? <span className="hero-github-error">GH</span> : weeks.map((week, weekIndex) => (
          <span className="hero-github-week" key={weekIndex}>
            {week.map((day) => <i key={day.date} data-level={day.level} />)}
          </span>
        ))}
      </span>
      <span className="hero-github-mark mono-label" aria-hidden="true">365D ACTIVITY</span>
      <span className="hero-github-arrow" aria-hidden="true">↗</span>
    </a>
  );
}
