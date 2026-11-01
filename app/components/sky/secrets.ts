/*
 * Which of the sky's big secrets you've found. They stay found between visits, though the Earth and galaxy skies
 * themselves aren't remembered (top-nav.tsx). Everything is told apart by the ids the drifters hint at.
 */

import type { SecretId } from "./drifters";

export const SECRETS: readonly SecretId[] = ["earth", "voyage", "vista", "milkyway"];

const KEY = "sky-secrets";
const listeners = new Set<() => void>();
let found: Set<SecretId> | null = null;

function read() {
  if (found) return found;
  found = new Set();
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(saved)) for (const id of SECRETS) if (saved.includes(id)) found.add(id);
  } catch {}
  return found;
}

export function markSecret(id: SecretId) {
  const set = read();
  if (set.has(id)) return;
  set.add(id);
  try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch {}
  listeners.forEach((listener) => listener());
}

export function subscribeSecrets(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const foundCount = () => read().size;
/** The first render has to match the prerendered page, which has found nothing. */
export const foundCountOnServer = () => 0;
