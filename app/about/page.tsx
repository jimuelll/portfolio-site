import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { AboutNav } from "../components/about-nav";
import { AboutPhoto } from "../components/about-photo";
import { Constellation } from "../components/constellation";
import { PageShell } from "../components/page-shell";
import { RailFoot } from "../components/rail-foot";
import { pageMetadata } from "../lib/seo";
import { awards, coreStack, education, projects, toolkit } from "../lib/portfolio";

export const metadata: Metadata = pageMetadata({
  title: "About | Jimuel Jean Untalan",
  description: "About Jimuel Jean Untalan, a software engineer and Computer Science student in Quezon, Philippines: education, skills, projects, and GitHub activity.",
  path: "/about",
});

const [degree, capstone] = education;
const launched = projects.filter((p) => p.status === "launched");
const orbiting = projects.length - launched.length;
// Each toolkit group without what the core tags already show; a group left empty is dropped.
const extras = toolkit
  .map((t) => ({ name: t.name, items: t.items.split(", ").filter((item) => !coreStack.includes(item)) }))
  .filter((t) => t.items.length > 0);
// Placeholders stay out of sight: the section and its link turn up with the first real entry.
const realAwards = awards.filter((a) => !a.placeholder);

const SECTIONS = [
  { id: "education", label: "Education" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  ...(realAwards.length > 0 ? [{ id: "awards", label: "Awards" }] : []),
  { id: "activity", label: "Activity" },
  { id: "about-me", label: "About Me" },
];
const ACTIVITY_WEEKS = 36;

/**
 * A dossier for an internship search: who, how to reach, and the CV stay pinned on the left while the record reads
 * down one column on the right, ending with the person behind it.
 */
export default function AboutPage() {
  return (
    <PageShell wide centered>
      <div className="dossier">
        <aside className="dossier-id">
          <AboutPhoto />
          <h1>Jimuel Jean<br />Untalan</h1>
          <p className="role-line"><span className="status-dot" aria-hidden="true" />software engineer, seeking an internship</p>
          <AboutNav sections={SECTIONS} />
          <RailFoot />
        </aside>

        <div className="dossier-body">
          <section className="about-section" id="education">
            <div className="section-head"><h2>Education</h2></div>
            <ol className="timeline">
              <li>
                <div className="timeline-head">
                  <p className="timeline-title">{degree.title}</p>
                  <p className="faint">{degree.date}</p>
                </div>
                <p className="muted">{degree.place}</p>
              </li>
              <li>
                <div className="timeline-head">
                  <p className="timeline-title">{capstone.title}</p>
                  <p className="faint">{capstone.date}</p>
                </div>
                <p className="muted">{capstone.place}</p>
              </li>
            </ol>
          </section>

          <section className="about-section" id="skills">
            <div className="section-head"><h2>Skills</h2></div>
            <div>
              <p className="label" id="core-stack">core stack</p>
              <ul className="tags" aria-labelledby="core-stack">
                {coreStack.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
            <dl className="toolkit-groups">
              {extras.map((g) => (
                <Fragment key={g.name}>
                  <dt className="label">{g.name}</dt>
                  <dd>{g.items.map((item) => <Fragment key={item}><span>{item}</span>{" "}</Fragment>)}</dd>
                </Fragment>
              ))}
            </dl>
          </section>

          <section className="about-section" id="projects">
            <div className="section-head">
              <h2>Projects</h2>
              <p>{launched.length} launched{orbiting > 0 && ` · ${orbiting} in orbit`}</p>
            </div>
            <ul className="project-lines">
              {launched.map((p) => (
                <li key={p.slug}>
                  <a href={p.links[0]?.href} target="_blank" rel="noopener noreferrer">
                    <span>{p.name}</span>
                    <span className="arrow" aria-hidden="true">↗</span>
                    <span className="muted">{p.short}</span>
                  </a>
                </li>
              ))}
            </ul>
            <Link className="ink-link more" href="/projects">see all projects →</Link>
          </section>

          {realAwards.length > 0 && (
            <section className="about-section" id="awards">
              <div className="section-head"><h2>Hackathons &amp; Awards</h2></div>
              <ul className="awards">
                {realAwards.map((a) => (
                  <li key={`${a.title}-${a.event}`}>
                    <span>{a.title}</span>
                    <span className="muted">{a.event} · {a.date}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="about-section" id="activity">
            <div className="section-head">
              <h2>Activity</h2>
              <p>last {ACTIVITY_WEEKS} weeks</p>
            </div>
            <Constellation weeks={ACTIVITY_WEEKS} />
          </section>

          <section className="about-section" id="about-me">
            <div className="section-head"><h2>About Me</h2></div>
            <p className="about-pitch">
              Just a guy who likes software. I genuinely love exploring unique UI styles (i mean look at this portfolio xd).
            </p>
            <div className="about-eggs">
              <p>oh yea one more thing, if u&apos;ve read this far, site has cool easter eggs so try to uncover &apos;em all</p>
              <p className="about-hint">hint: occasionally, objects pass by so be on the lookout</p>
            </div>
            <dl className="toolkit-groups">
              <dt className="label">PS</dt>
              <dd>huge fan of efficiency (agentic coding lol).</dd>
              <dt className="label">Off-hours</dt>
              <dd>games, anime, and Pokémon Showdown (hmu :p)</dd>
            </dl>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
