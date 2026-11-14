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
              {/* What it is comes first, in one line, so a skim gets the point before the screenshot. */}
              <div className="project-head">
                <div className="section-head">
                  <h2 id={`${project.slug}-title`}>{project.name}</h2>
                </div>
                <p className="about-pitch">{project.short}</p>
                <ul className="project-meta">
                  <li>{project.kind}</li>
                  {project.facts?.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </div>
              {project.gallery && <ProjectGallery shots={project.gallery} />}
              <p className="project-links">
                {project.links.map((l) => <a key={l.href} className="ink-link" href={l.href} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>)}
              </p>
              {/* The long parts wait behind "more details"; the first two highlights always show, since they're the best of it. */}
              <p className="about-pitch project-extra" id={`${project.slug}-summary`}>{project.summary}</p>
              {project.highlights && (
                <dl className="highlights" id={`${project.slug}-highlights`}>
                  {project.highlights.map((h) => (
                    <div key={h.title}>
                      <dt>{h.title}</dt>
                      <dd>{h.text}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="project-extra" id={`${project.slug}-more`}>
                <p className="label">stack</p>
                <ul className="tags">{project.stack.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
              <button
                type="button"
                className="see-more"
                aria-expanded={isOpen}
                aria-controls={`${project.slug}-summary ${project.slug}-highlights ${project.slug}-more`}
                onClick={() => toggle(project.slug)}
              >
                {isOpen ? "fewer details ↑" : "more details ↓"}
              </button>
            </section>
          );
        })}
        <RailFoot className="narrow-foot" />
      </div>
    </div>
  );
}
