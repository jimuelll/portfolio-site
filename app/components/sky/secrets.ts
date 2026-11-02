/*
 * Which of the sky's big secrets you've found. They stay found between visits, though the Earth and galaxy skies
 * themselves aren't remembered (top-nav.tsx). Everything is told apart by the ids the drifters hint at.
 */

import type { SecretId } from "./drifters";

export const SECRETS: readonly SecretId[] = ["earth", "voyage", "vista", "milkyway", "wormhole"];

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

/** Every place you can land, by the id its scene goes by. Kept here so the home page can count them without loading any of them. */
export const PLACE_IDS: readonly string[] = ["sun", "mercury", "venus", "earth", "aurora", "moon", "mars", "belt", "jupiter", "saturn", "iapetus", "uranus", "miranda", "neptune"];
const PLACES_KEY = "sky-places";
let visited: Set<string> | null = null;

function readPlaces() {
  if (visited) return visited;
  visited = new Set();
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PLACES_KEY) ?? "[]");
    if (Array.isArray(saved)) for (const id of PLACE_IDS) if (saved.includes(id)) visited.add(id);
  } catch {}
  return visited;
}

export function markPlace(id: string) {
  const set = readPlaces();
  if (set.has(id) || !PLACE_IDS.includes(id)) return;
  set.add(id);
  try { localStorage.setItem(PLACES_KEY, JSON.stringify([...set])); } catch {}
  listeners.forEach((listener) => listener());
}

export const placesCount = () => readPlaces().size;
/** The first render has to match the prerendered page, which has found nothing. */
export const foundCountOnServer = () => 0;
