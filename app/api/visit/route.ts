import { NextResponse } from "next/server";
import { redis, VISITORS_KEY } from "../../lib/redis";

const KEY = VISITORS_KEY;
const COOKIE = "visitor-id";

/**
 * Counts a browser once. The cookie is the "already counted" marker, so refreshes and page changes don't inflate the
 * total. POST (not GET) so prefetches and crawlers that merely fetch the URL never bump it.
 */
export async function POST(request: Request) {
  if (!redis) return NextResponse.json({ count: null });

  const seen = request.headers.get("cookie")?.includes(`${COOKIE}=`);
  try {
    const count = seen ? Number(await redis.get(KEY)) || 0 : await redis.incr(KEY);
    const res = NextResponse.json({ count });
    if (!seen) {
      res.cookies.set(COOKIE, "1", {
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }
    return res;
  } catch {
    return NextResponse.json({ count: null });
  }
}
