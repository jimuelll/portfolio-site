export type Contribution = {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

export type ContributionsResponse = {
  total?: Record<string, number>;
  contributions?: Contribution[];
};

export function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function buildContributionWeeks(contributions: Contribution[], weekCount = 36) {
  const byDate = new Map(contributions.map((day) => [day.date, day]));
  const latestContribution = contributions.reduce<Contribution | null>(
    (latest, day) => (!latest || day.date > latest.date ? day : latest),
    null,
  );
  const latest = latestContribution
    ? new Date(`${latestContribution.date}T00:00:00`)
    : new Date();
  const latestWeek = new Date(latest);
  latestWeek.setDate(latest.getDate() - latest.getDay());
  const firstWeek = new Date(latestWeek);
  firstWeek.setDate(latestWeek.getDate() - ((weekCount - 1) * 7));

  return Array.from({ length: weekCount }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(firstWeek);
      date.setDate(firstWeek.getDate() + (weekIndex * 7) + dayIndex);
      const dateKey = formatDateKey(date);
      return byDate.get(dateKey) ?? { date: dateKey, count: 0, level: 0 as const };
    }),
  );
}
