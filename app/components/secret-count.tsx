"use client";

import { useSyncExternalStore } from "react";
import { SECRETS, foundCount, foundCountOnServer, subscribeSecrets } from "./sky/secrets";

/** How many of the sky's secrets you've found. Keyed by the count, so it flashes when that goes up. */
export function SecretCount({ className = "" }: { className?: string }) {
  const count = useSyncExternalStore(subscribeSecrets, foundCount, foundCountOnServer);
  return (
    <div key={count} className={`secret-count flash ${count === SECRETS.length ? "all" : ""} ${className}`}>
      ✦ {count}/{SECRETS.length} secrets
    </div>
  );
}
