"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { deleteEntry, postEntry, type GuestbookState } from "../lib/guestbook-actions";
import { MESSAGE_MAX, NAME_MAX, type GuestEntry } from "../lib/guestbook";
import { shownName } from "../lib/star-names";

const initial: GuestbookState = { ok: false };
/** How many lines show at first, and how many more each "show older" adds. Keeps a long book quick to scan. */
const PAGE = 15;
// Whether the main pointer is a finger, which decides what Enter does in the message box.
const TOUCH = "(pointer: coarse)";
const readTouch = () => window.matchMedia(TOUCH).matches;
function subscribeTouch(onChange: () => void) {
  const query = window.matchMedia(TOUCH);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** The character count only appears once it starts to matter. */
const COUNT_FROM = MESSAGE_MAX - 60;

// Catalog-style dates: "nov 09", with the year only once it isn't this one.
export function when(ts: number) {
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d
    .toLocaleDateString("en-US", { month: "short", day: "2-digit", ...(sameYear ? {} : { year: "numeric" }) })
    .toLowerCase();
}

/**
 * A scrolling log of entries, newest first, over a compose bar pinned to the panel's foot, so writing is always one
 * step away however long the book gets. `entries` is undefined while loading and null when the backend is offline.
 * `onPosted` hands a fresh entry up so it shows at once, without reloading the list.
 */
export function Guestbook({
  entries,
  admin,
  onPosted,
  onAdmin,
  onDeleted,
}: {
  entries: GuestEntry[] | null | undefined;
  admin: boolean;
  onPosted: (e: GuestEntry) => void;
  onAdmin: () => void;
  onDeleted: (id: string) => void;
}) {
  const [state, action, pending] = useActionState(postEntry, initial);
  const [shown, setShown] = useState(PAGE);
  // Deleting takes two presses: the first arms the button on that entry, the second removes it.
  const [armed, setArmed] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const log = useRef<HTMLOListElement>(null);

  // A new post: hand it up, then bring the top of the log, where it lands, into view. The keyword: switch on moderation.
  useEffect(() => {
    if (state.admin) onAdmin();
    if (!state.entry) return;
    onPosted(state.entry);
    log.current?.scrollTo({ top: 0, behavior: "smooth" });
    // Only a new action result should do this; the callbacks' identities changing must not repeat it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function remove(id: string) {
    if (armed !== id) return setArmed(id);
    setDeleting(id);
    const res = await deleteEntry(id);
    setDeleting(null);
    setArmed(null);
    if (res.ok) onDeleted(id);
  }

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [handled, setHandled] = useState<number | undefined>();
  const touch = useSyncExternalStore(subscribeTouch, readTouch, () => false);

  // Both fields are controlled so a failed post keeps what was typed (React resets uncontrolled fields after any
  // action). A new successful post clears the message and keeps the name for the next one. Adjusting state during
  // render, keyed on the post's timestamp, avoids an effect.
  if (state.ok && state.sent !== handled) {
    setHandled(state.sent);
    setMessage("");
  }

  if (entries === null) return <p className="guest-empty">the sky is clouded over right now. check back soon.</p>;

  const visible = entries?.slice(0, shown) ?? [];
  const older = (entries?.length ?? 0) - visible.length;

  return (
    <>
      {entries === undefined ? (
        <p className="guest-empty">looking up...</p>
      ) : entries.length === 0 ? (
        <p className="guest-empty">no lights yet. be the first.</p>
      ) : (
        <ol className="guest-log" ref={log}>
          {visible.map((e) => (
            <li key={e.id} data-fresh={e.id === state.entry?.id || undefined}>
              <p className="guest-head">
                <span className="guest-mark" aria-hidden="true">✦</span>
                <span className="guest-name">{shownName(e)}</span>
                <span className="guest-date">{when(e.ts)}</span>
                {admin && (
                  <button
                    type="button"
                    className="guest-delete"
                    data-armed={armed === e.id || undefined}
                    disabled={deleting === e.id}
                    onClick={() => remove(e.id)}
                    onBlur={() => setArmed((a) => (a === e.id ? null : a))}
                    aria-label={armed === e.id ? `Confirm deleting ${shownName(e)}'s entry` : `Delete ${shownName(e)}'s entry`}
                  >
                    {deleting === e.id ? "···" : armed === e.id ? "delete?" : "×"}
                  </button>
                )}
              </p>
              <p className="guest-message">{e.message}</p>
            </li>
          ))}
          {older > 0 && (
            <li className="guest-more">
              <button type="button" onClick={() => setShown((n) => n + PAGE)}>
                show {Math.min(older, PAGE)} older {older === 1 ? "light" : "lights"} ↓
              </button>
            </li>
          )}
        </ol>
      )}

      <form action={action} className="guest-compose">
        <label className="guest-as">
          <span className="sr-only">your star&apos;s name</span>
          {/* A box like the message's, with a pencil and an inviting placeholder, so it reads as yours to fill in. */}
          <span className="guest-as-edit" aria-hidden="true">✎</span>
          <input
            name="name"
            maxLength={NAME_MAX}
            placeholder="name your star (or stay anonymous)"
            autoComplete="nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="guest-row">
          <textarea
            name="message"
            aria-label="Message"
            required
            rows={2}
            maxLength={MESSAGE_MAX}
            placeholder="say hi, leave a note..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            // With a keyboard, Enter sends as in a chat and Shift+Enter makes a new line. On a touch keyboard there is no
            // Shift+Enter, so Enter stays a new line there and the ✦ button sends.
            onKeyDown={(e) => {
              if (!touch && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button type="submit" className="guest-send" disabled={pending || !message.trim()} aria-label="Leave a light">
            {pending ? "···" : "✦"}
          </button>
        </div>
        {/* Honeypot: hidden from people and assistive tech, irresistible to form-filling bots. */}
        <input className="guest-trap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <p className={`guest-note${state.error ? " error" : ""}`} role="status">
          {state.error ?? (state.admin && !message ? "moderation on for this session ✦" : message.length >= COUNT_FROM ? `${message.length}/${MESSAGE_MAX}` : touch ? "tap ✦ to send" : "enter to send · shift+enter for a new line")}
        </p>
      </form>
    </>
  );
}
