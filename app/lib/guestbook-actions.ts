"use server";

import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { ENTRIES_KEY, MAX_ENTRIES, MESSAGE_MAX, NAME_MAX, type GuestEntry } from "./guestbook";
import { grantAdmin, isAdmin, isAdminKeyword, revokeAdmin } from "./guestbook-admin";
import { redis } from "./redis";

export type GuestbookState = { ok: boolean; error?: string; sent?: number; entry?: GuestEntry; admin?: boolean };

const POSTS_PER_HOUR = 3;

// Control characters have no place in a name or message; collapsing them also stops line-break spam in names.
const clean = (v: FormDataEntryValue | null) =>
  String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

/** Server actions are public POST endpoints, so everything is re-validated here regardless of what the form enforces. */
export async function postEntry(_prev: GuestbookState, formData: FormData): Promise<GuestbookState> {
  if (!redis) return { ok: false, error: "the guestbook is offline right now" };

  // Honeypot: real visitors never see this field. Pretend success so bots get no signal to adapt to.
  if (clean(formData.get("website"))) return { ok: true, sent: Date.now() };

  const name = clean(formData.get("name")).slice(0, NAME_MAX) || "anonymous";
  const message = clean(formData.get("message"));
  if (!message) return { ok: false, error: "write something first" };
  if (message.length > MESSAGE_MAX) return { ok: false, error: `keep it under ${MESSAGE_MAX} characters` };

  // Rate limit per hashed IP, so no raw address is ever stored.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const bucket = `guestbook:rate:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
  let entry: GuestEntry;
  try {
    // Someone already holding the moderation pass this session is the site's owner, so their posts aren't counted.
    // Everyone else, including anyone guessing the keyword, is.
    if (!(await isAdmin())) {
      const used = await redis.incr(bucket);
      if (used === 1) await redis.expire(bucket, 60 * 60);
      if (used > POSTS_PER_HOUR) return { ok: false, error: "easy there, try again in a bit" };
    }

    // The moderation keyword is checked only after the rate limit, so guessing it costs a post per try. It is never
    // posted: it hands this browser the admin pass instead.
    if (isAdminKeyword(message)) {
      await grantAdmin();
      return { ok: true, sent: Date.now(), admin: true };
    }

    entry = { id: randomUUID(), name, message, ts: Date.now() };
    await redis.lpush(ENTRIES_KEY, JSON.stringify(entry));
    await redis.ltrim(ENTRIES_KEY, 0, MAX_ENTRIES - 1);
  } catch {
    return { ok: false, error: "couldn't save that, try again" };
  }

  // The orb loads entries in the browser, so nothing prerendered needs refreshing; it shows this one right away.
  return { ok: true, sent: entry.ts, entry };
}

/** Removes one entry. Only works with the admin pass; checked here because actions are public endpoints. */
export async function deleteEntry(id: string): Promise<{ ok: boolean }> {
  if (!redis || typeof id !== "string" || !(await isAdmin())) return { ok: false };
  try {
    // The client gets parsed objects; re-serialising gives the exact stored string LREM needs to match.
    const all = await redis.lrange<GuestEntry | string>(ENTRIES_KEY, 0, -1);
    const raw = all.find((e) => (typeof e === "string" ? (JSON.parse(e) as GuestEntry).id : e.id) === id);
    if (!raw) return { ok: true };
    await redis.lrem(ENTRIES_KEY, 1, typeof raw === "string" ? raw : JSON.stringify(raw));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Drops the admin pass from this browser. */
export async function leaveAdmin(): Promise<void> {
  await revokeAdmin();
}
