import { redis } from "./redis";

export type GuestEntry = { id: string; name: string; message: string; ts: number };

export const ENTRIES_KEY = "guestbook:entries";
export const MAX_ENTRIES = 200;
export const NAME_MAX = 40;
export const MESSAGE_MAX = 280;

/** Newest first. Returns null when the backend is offline so the page can say so instead of showing an empty book. */
export async function getEntries(): Promise<GuestEntry[] | null> {
  if (!redis) return null;
  try {
    const raw = await redis.lrange<GuestEntry | string>(ENTRIES_KEY, 0, MAX_ENTRIES - 1);
    return raw.map((e) => (typeof e === "string" ? (JSON.parse(e) as GuestEntry) : e));
  } catch {
    return null;
  }
}
