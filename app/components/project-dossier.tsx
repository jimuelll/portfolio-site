"use client";

import { useState } from "react";
import { projects } from "../lib/portfolio";
import { AboutNav } from "./about-nav";
import { ProjectGallery } from "./project-gallery";
import { RailFoot } from "./rail-foot";

// Unannounced projects stay off this page until they launch; the home sky still shows them as dim worlds.
const launched = projects.filter((p) => p.status === "launched");
const SECTIONS = launched.map((p) => ({ id: p.slug, label: p.name }));

/**
 * Every launched project, one plate after another, so a skim down the page sees all of them. The rail marks the one
 * being read and jumps between them; arriving for one (/projects#slug, from a star on the home sky) lands on it.
 */
export function ProjectDossier() {
  // Each project is trimmed until "see more"; this tracks which ones are opened.
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (slug: string) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  return (
    <div className="dossier plated">
      <aside className="dossier-id">
        <h1>Projects</h1>
        <p className="role-line">Things I&apos;ve launched into orbit.<br />{launched.length} launched</p>
        <AboutNav sections={SECTIONS} />
        {/* In the rail on desktop; on phones it follows the projects, so the work comes first. */}
        <RailFoot className="wide-foot" />
      </aside>

      <div className="dossier-body">
        {launched.map((project) => {
          const isOpen = open.has(project.slug);
          return (
            <section
              className="about-section project-card fade-in"
              key={project.slug}
              id={project.slug}
              aria-labelledby={`${project.slug}-title`}
              data-open={isOpen || undefined}
            >
              <div className="project-head">
                <div className="section-head">
                  <h2 id={`${project.slug}-title`}>{project.name}</h2>
                  <p>{project.year}</p>
                </div>
                <ul className="project-meta">
                  <li>{project.kind}</li>
                  {project.facts?.map((f) => <li key={f}>{f}</li>)}
                </ul>
                <p className="project-links">
                  {project.links.map((l) => <a key={l.href} className="ink-link" href={l.href} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>)}
                </p>
              </div>
              {project.gallery && <ProjectGallery shots={project.gallery} />}
              <p className="about-pitch">{project.summary}</p>
              {/* The long part: it waits behind "see more". */}
              <div className="project-extra" id={`${project.slug}-more`}>
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
              </div>
              <button
                type="button"
                className="see-more"
                aria-expanded={isOpen}
                aria-controls={`${project.slug}-more`}
                onClick={() => toggle(project.slug)}
              >
                {isOpen ? "see less ↑" : "see more ↓"}
              </button>
            </section>
          );
        })}
        <RailFoot className="narrow-foot" />
      </div>
    </div>
  );
}
