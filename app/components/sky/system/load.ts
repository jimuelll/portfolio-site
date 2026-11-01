/*
 * The way to the solar system, kept free of three.js so that importing it costs nothing. The chunk is only asked for
 * once someone has held the toggle for a second (top-nav.tsx) or lifted off (cosmos.ts).
 */

type SystemModule = typeof import("./solar-system");

let pending: Promise<SystemModule> | null = null;

export function loadSystem() {
  // A failed fetch isn't remembered, so a later trip can try again.
  pending ??= import("./solar-system").catch((error) => {
    pending = null;
    throw error;
  });
  return pending;
}
