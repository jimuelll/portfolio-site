"use client";

import { useEffect, useState } from "react";
import {
  buildContributionWeeks,
  formatDateKey,
  type Contribution,
  type ContributionsResponse,
} from "../../lib/github";

const GITHUB_CONTRIBUTIONS_URL = "https://github-contributions-api.jogruber.de/v4/jimuelll?y=last";
const GITHUB_PROFILE_URL = "https://api.github.com/users/jimuelll";

type GithubProfile = {
  public_repos?: number;
};

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
      <span className="hero-github-label">GITHUB</span>
      <span className="hero-github-arrow" aria-hidden="true">↗</span>
    </a>
  );
}

export function useGithubStats() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [publicRepos, setPublicRepos] = useState<number | null>(null);
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
    const profileRequest = fetch(GITHUB_PROFILE_URL, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Profile data unavailable");
        return response.json() as Promise<GithubProfile>;
      })
      .catch(() => null);

    Promise.all([contributionRequest, profileRequest])
      .then(([data, profile]) => {
        if (cancelled) return;
        if (data) {
          setContributions(data.contributions ?? []);
          setTotal(data.total?.lastYear ?? null);
        }
        if (profile) setPublicRepos(profile.public_repos ?? null);
        setError(!data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const weeks = buildContributionWeeks(contributions).slice(-18);
  const activeDates = contributions
    .filter((day) => day.count > 0)
    .map((day) => day.date);
  const activeDateSet = new Set(activeDates);
  let currentStreak: number | null = contributions.length > 0 ? 0 : null;
  if (activeDates.length > 0) {
    const cursor = new Date();
    let streak = 0;
    if (!activeDateSet.has(formatDateKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (activeDateSet.has(formatDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    currentStreak = streak;
  }

  return {
    contributions,
    total,
    publicRepos,
    currentStreak,
    activeDays: activeDates.length,
    loading,
    error,
    weeks,
  };
}
