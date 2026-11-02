/*
 * The way to the solar system, kept free of three.js so that importing it costs nothing. The chunk is only asked for
 * once someone has held the toggle for a second (top-nav.tsx) or lifted off (cosmos.ts).
 */

type SystemModule = typeof import("./solar-system");
type InsideModule = typeof import("./inside");
type CosmosModule = typeof import("../cosmos");

let pending: Promise<SystemModule> | null = null;
let pendingInside: Promise<InsideModule> | null = null;
let pendingCosmos: Promise<CosmosModule> | null = null;

/** The voyage itself, a bonus nobody pays for until they've held the toggle long enough to mean it (top-nav.tsx). */
export function loadCosmos() {
  pendingCosmos ??= import("../cosmos").catch((error) => {
    pendingCosmos = null;
    throw error;
  });
  return pendingCosmos;
}

export function loadSystem() {
  // A failed fetch isn't remembered, so a later trip can try again.
  pending ??= import("./solar-system").catch((error) => {
    pending = null;
    throw error;
  });
  return pending;
}

/** The places the wormholes go, from the inside: asked for only by someone who has just found a wormhole. */
export function loadInside() {
  pendingInside ??= import("./inside").catch((error) => {
    pendingInside = null;
    throw error;
  });
  return pendingInside;
}
