import { NextResponse } from "next/server";
import { getEntries } from "../../lib/guestbook";
import { isAdmin } from "../../lib/guestbook-admin";
import { redis, VISITORS_KEY } from "../../lib/redis";

/**
 * The entries, read by the orb in the browser. Loading them here rather than in the layout keeps every page
 * prerendered: the page arrives at once and the guestbook fills in a moment later.
 */
export async function GET() {
  const [entries, visitors, admin] = await Promise.all([
    getEntries(),
    // Read-only: counting happens in /api/visit, so opening the guestbook never bumps the total.
    redis ? redis.get<number>(VISITORS_KEY).then((n) => Number(n) || 0).catch(() => null) : null,
    // Only says whether this browser holds a valid pass this session; the pass itself never leaves the cookie.
    isAdmin(),
  ]);
  return NextResponse.json({ entries, visitors, admin }, { headers: { "Cache-Control": "no-store" } });
}
