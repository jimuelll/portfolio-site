/**
 * The sky's secrets, and which ones this visitor has found. The about page's star log (components/star-log.tsx)
 * charts them: found ones by name and how, the rest only as a hint.
 */

export type SecretId = "earth" | "voyage" | "vista" | "milkyway";

export const secrets: { id: SecretId; name: string; hint: string; how: string }[] = [
  { id: "earth", name: "Earth", hint: "knock on the sky five times, fast", how: "five quick taps on the toggle" },
  { id: "voyage", name: "Voyage", hint: "hold the little moon until the stars trail", how: "held the toggle for three seconds" },
  { id: "vista", name: "Vista", hint: "once you're flying, don't let go", how: "kept holding, all the way to arrival" },
  { id: "milkyway", name: "Milky Way", hint: "press the big moon and never let go", how: "held the moon, sun or Earth until hyperdrive" },
];

const LOG_KEY = "sky-log";
/** Fired on window whenever something new is found, so the star log can light up live. */
export const LOG_EVENT = "sky-log";

export function foundSecrets(): SecretId[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((id): id is SecretId => secrets.some((s) => s.id === id)) : [];
  } catch {
    return [];
  }
}

export function found(id: SecretId) {
  const log = foundSecrets();
  if (log.includes(id)) return;
  try { localStorage.setItem(LOG_KEY, JSON.stringify([...log, id])); } catch {}
  window.dispatchEvent(new Event(LOG_EVENT));
}
