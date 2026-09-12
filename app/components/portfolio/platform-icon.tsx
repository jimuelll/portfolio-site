export type PlatformIconKind = "download" | "linkedin" | "github" | "mail" | "instagram" | "facebook";

export function PlatformIcon({ kind }: { kind: PlatformIconKind }) {
  if (kind === "download") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M4 20h16" /></svg>;
  }
  if (kind === "linkedin") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9v9M6 6v.01M11 18v-5a3 3 0 0 1 6 0v5M11 9v9" /><path d="M3 3h18v18H3z" /></svg>;
  }
  if (kind === "mail") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" /><path d="m3 6 9 7 9-7" /></svg>;
  }
  if (kind === "instagram") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="12" cy="12" r="3.5" /><path d="M17.5 6.5h.01" /></svg>;
  }
  if (kind === "facebook") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 20v-7h2.5l.5-3h-3V8.2c0-.9.3-1.5 1.6-1.5H17V4.1c-.4-.1-1.2-.1-2.1-.1-2.6 0-4.4 1.6-4.4 4.5V10H8v3h2.5v7" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0-2.8 17.6c.4.1.5-.2.5-.4v-1.6c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.1-.9-1.1-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.8.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.7-.9-3.7-4A3.1 3.1 0 0 1 7.3 10c-.1-.2-.5-1 .1-2 0 0 .8-.3 2.5 1a8.7 8.7 0 0 1 4.5 0c1.7-1.2 2.5-1 2.5-1 .6 1 .2 1.8.1 2a3.1 3.1 0 0 1 .8 2.2c0 3.1-1.9 3.8-3.7 4 .3.2.5.7.5 1.4v2c0 .2.1.5.5.4A9 9 0 0 0 12 3Z" /></svg>;
}
