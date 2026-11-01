"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { projects } from "../lib/portfolio";
import { ProjectGallery } from "./project-gallery";
import { RailFoot } from "./rail-foot";

const REDACTED = "░░░░░░░░ ░░░░░░";
const IN_ORBIT = "in-orbit";
const launched = projects.filter((p) => p.status === "launched");
const orbiting = projects.filter((p) => p.status === "in-orbit");
const CHOICES = [
  ...launched.map((p) => ({ id: p.slug, label: p.name })),
  ...(orbiting.length > 0 ? [{ id: IN_ORBIT, label: "In orbit" }] : []),
];

/** What an address's #hash opens. An unannounced project's own slug opens the section they share. */
function choiceFor(hash: string) {
  const slug = hash.slice(1);
  if (orbiting.some((p) => p.slug === slug)) return IN_ORBIT;
  return CHOICES.some((c) => c.id === slug) ? slug : null;
}

/** The rail picks the project, and the column beside it shows only that one. */
export function ProjectDossier() {
  const [current, setCurrent] = useState(CHOICES[0]?.id);
  const section = useRef<HTMLElement>(null);
  const picked = useRef(false);

  // Arriving from a star on the home sky (/projects#slug) opens that project, as do Back and Forward across hashes.
  useEffect(() => {
    const read = () => {
      const choice = choiceFor(window.location.hash);
      if (choice) setCurrent(choice);
    };
    const frame = requestAnimationFrame(read);
    window.addEventListener("hashchange", read);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", read);
    };
  }, []);

  // After a pick, the reader lands on the new project: focus moves there, and the page comes back up if it had scrolled past.
  useEffect(() => {
    if (!picked.current || !section.current) return;
    picked.current = false;
    section.current.focus({ preventScroll: true });
    if (section.current.getBoundingClientRect().top < 80) section.current.scrollIntoView();
  }, [current]);

  function pick(e: MouseEvent<HTMLAnchorElement>, id: string) {
    // New tabs are left to the browser.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    picked.current = true;
    setCurrent(id);
    window.history.replaceState(window.history.state, "", `#${id}`);
  }

  const project = launched.find((p) => p.slug === current);

  return (
    <div className="dossier">
      <aside className="dossier-id">
        <h1>Projects</h1>
        <p className="role-line">Things I&apos;ve launched into orbit.<br />{launched.length} launched · {orbiting.length} in orbit</p>
        <nav className="section-nav picker" aria-label="Projects">
          {CHOICES.map(({ id, label }) => (
            <a key={id} href={`#${id}`} onClick={(e) => pick(e, id)} aria-current={current === id ? "true" : undefined}>{label}</a>
          ))}
        </nav>
        {/* In the rail on desktop; on phones it follows the project, so the work comes first. */}
        <RailFoot className="wide-foot" />
      </aside>

      <div className="dossier-body">
        {project ? (
          <section ref={section} tabIndex={-1} className="about-section fade-in" key={project.slug} aria-label={project.name}>
            <div className="section-head">
              <h2>{project.name}</h2>
              <p>{project.year}</p>
            </div>
            {project.gallery && <ProjectGallery shots={project.gallery} />}
            <p className="muted">{project.kind}</p>
            <p className="about-pitch">{project.summary}</p>
            {project.highlights && (
              <dl className="highlights">
                {project.highlights.map((h) => (
                  <div key={h.title}>
                    <dt>{h.title}</dt>
                    <dd>{h.text}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div>
              <p className="label">stack</p>
              <ul className="tags">{project.stack.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
            <p className="project-links">
              {project.links.map((l) => <a key={l.href} className="ink-link" href={l.href} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>)}
            </p>
          </section>
        ) : (
          <section ref={section} tabIndex={-1} className="about-section fade-in" key={IN_ORBIT} aria-label="In orbit">
            <div className="section-head">
              <h2>In orbit</h2>
              <p>launching soon</p>
            </div>
            <ul className="orbit-list">
              {orbiting.map((p) => (
                <li key={p.slug}>
                  <span className="redacted">{REDACTED}<span className="sr-only">Unannounced project</span></span>
                  <span className="muted">{p.summary}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <RailFoot className="narrow-foot" />
      </div>
    </div>
  );
}
