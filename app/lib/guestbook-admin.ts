import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/*
 * Moderation for the guestbook. Sending the secret keyword as a message (instead of posting it) hands this browser a
 * pass; with the pass, the guestbook shows a delete button on each entry.
 *
 * The keyword lives only in the server's environment (GUESTBOOK_ADMIN_KEY), never in code shipped to browsers, so
 * reading the site's source reveals nothing. Without the variable, moderation is simply off.
 * Server-only: imported by the server action and the guestbook route, never by a client component.
 */

const ADMIN_KEY = process.env.GUESTBOOK_ADMIN_KEY;
const ADMIN_COOKIE = "guestbook-admin";

// The pass is derived from the keyword, so changing the keyword revokes every pass already handed out.
function pass() {
  return ADMIN_KEY ? createHmac("sha256", ADMIN_KEY).update("guestbook-admin-pass").digest("hex") : null;
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function isAdminKeyword(message: string) {
  return !!ADMIN_KEY && same(message, ADMIN_KEY);
}

export async function isAdmin() {
  const expected = pass();
  const got = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!expected && !!got && same(got, expected);
}

export async function grantAdmin() {
  const value = pass();
  if (!value) return;
  // No maxAge or expires: a session cookie, gone when the browser closes.
  (await cookies()).set(ADMIN_COOKIE, value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function revokeAdmin() {
  (await cookies()).delete(ADMIN_COOKIE);
}
