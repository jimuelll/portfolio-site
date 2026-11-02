"use client";

import { useSyncExternalStore } from "react";
import { PLACE_IDS, SECRETS, foundCount, foundCountOnServer, placesCount, subscribeSecrets } from "./sky/secrets";

/** How many of the sky's secrets you've found, and, once you've been to one, the places. Keyed by the secrets, so it flashes when they go up. */
export function SecretCount({ className = "" }: { className?: string }) {
  const count = useSyncExternalStore(subscribeSecrets, foundCount, foundCountOnServer);
  const places = useSyncExternalStore(subscribeSecrets, placesCount, foundCountOnServer);
  return (
    <div key={count} className={`secret-count flash ${count === SECRETS.length ? "all" : ""} ${className}`}>
      ✦ {count}/{SECRETS.length} secrets{places > 0 && ` · ${places}/${PLACE_IDS.length} places`}
    </div>
  );
}
