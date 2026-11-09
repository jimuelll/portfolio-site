import { Redis } from "@upstash/redis";

// Upstash's own names first, then the KV_ names Vercel's Upstash integration creates when it connects a project.
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

/**
 * One shared client, or null when the env vars are missing. Callers treat null as "backend offline" so the site
 * still builds and runs without a database (local dev before keys are set, preview deploys).
 */
/** Unique-visitor total, written by /api/visit and read by the guestbook. */
export const VISITORS_KEY = "visitors:total";

export const redis =url && token ? new Redis({ url, token }) : null;
