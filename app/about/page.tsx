import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { AboutNav } from "../components/about-nav";
import { AboutPhoto } from "../components/about-photo";
import { Constellation } from "../components/constellation";
import { CvButton } from "../components/cv-button";
import { PageShell } from "../components/page-shell";
import { awards, coreStack, education, projects, toolkit } from "../lib/portfolio";

export const metadata: Metadata = {
  title: "About | Jimuel Jean Untalan",
  description: "About Jimuel Jean Untalan, a software engineer and Computer Science student from Quezon, Philippines.",
};

const [degree, capstone] = education;
const launched = projects.filter((p) => p.status === "launched");
const orbiting = projects.length - launched.length;
// Each toolkit group without what the core tags already show; a group left empty is dropped.
const extras = toolkit
  .map((t) => ({ name: t.name, items: t.items.split(", ").filter((item) => !coreStack.includes(item)) }))
  .filter((t) => t.items.length > 0);
const REDACTED = "░░░░░░░░ ░░░░░";

const SECTIONS = [
  { id: "education", label: "Education" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "awards", label: "Awards" },
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
          <ul className="contact-line">
            <li><a className="ink-link" href="mailto:untalanjimueljean@gmail.com">untalanjimueljean@gmail.com</a></li>
            <li><a className="ink-link" href="https://github.com/jimuelll" target="_blank" rel="noopener noreferrer">github</a></li>
            <li><a className="ink-link" href="https://www.linkedin.com/in/jimuel-jean-untalan-8b84a42a5" target="_blank" rel="noopener noreferrer">linkedin</a></li>
            <li>Quezon, PH · UTC+8</li>
          </ul>
          <CvButton />
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
            <ul className="tags" aria-label="Core skills">
              {coreStack.map((s) => <li key={s}>{s}</li>)}
            </ul>
            <dl className="toolkit-groups">
              {extras.map((g) => (
                <Fragment key={g.name}>
                  <dt className="label">{g.name}</dt>
                  <dd>{g.items.join(" · ")}</dd>
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
            <div className="project-foot">
              {orbiting > 0 && <p className="faint">{orbiting} more launching soon</p>}
              <Link className="ink-link more" href="/projects">see all projects →</Link>
            </div>
          </section>

          <section className="about-section" id="awards">
            <div className="section-head"><h2>Hackathons &amp; Awards</h2></div>
            <ul className="awards">
              {awards.map((a, i) =>
                a.placeholder ? (
                  <li key={i} className="placeholder">
                    <span className="redacted" aria-label="To be announced">{REDACTED}</span>
                    <span className="faint">details soon</span>
                  </li>
                ) : (
                  <li key={i}>
                    <span>{a.title}</span>
                    <span className="muted">{a.event} · {a.date}</span>
                  </li>
                ),
              )}
            </ul>
          </section>

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
              I like making things work. I build with the user in mind, care a lot about interfaces, and think about how
              long the thing will last.
            </p>
            <p className="off-hours">Off-hours: games, anime, and Pokémon Showdown (hmu :p)</p>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
