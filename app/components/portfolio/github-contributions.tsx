"use client";

import { useEffect, useState } from "react";
import {
  buildContributionWeeks,
  type Contribution,
  type ContributionsResponse,
} from "../../lib/github";
import { PlatformIcon } from "./platform-icon";

const GITHUB_CONTRIBUTIONS_URL = "https://github-contributions-api.jogruber.de/v4/jimuelll?y=last";

export function GithubContributions() {
  return (
    <a
      className="hero-github-action"
      href="https://github.com/jimuelll"
      target="_blank"
      rel="noreferrer"
      aria-label="View GitHub profile"
      title="GitHub profile"
    >
      <PlatformIcon kind="github" />
      <span className="hero-github-label">GITHUB</span>
      <span className="hero-github-arrow" aria-hidden="true">↗</span>
    </a>
  );
}

export function useGithubStats() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const contributionRequest = fetch(GITHUB_CONTRIBUTIONS_URL)
      .then((response) => {
        if (!response.ok) throw new Error("Contribution data unavailable");
        return response.json() as Promise<ContributionsResponse>;
      })
      .catch(() => null);
    contributionRequest
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setContributions(data.contributions ?? []);
          setTotal(data.total?.lastYear ?? null);
        }
        setError(!data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const weeks = buildContributionWeeks(contributions).slice(-18);

  return {
    total,
    loading,
    error,
    weeks,
  };
}
