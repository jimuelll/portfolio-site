import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { AboutPhoto } from "../components/about-photo";
import { Constellation } from "../components/constellation";
import { CvButton } from "../components/cv-button";
import { PageShell } from "../components/page-shell";
import { awards, coreStack, education, projects, toolkit } from "../lib/portfolio";

export const metadata: Metadata = {
  title: "About | Jimuel Jean Untalan",
  description: "About Jimuel Jean Untalan, a full-stack developer and Computer Science student from Quezon, Philippines.",
};

const [degree, capstone] = education;
const launched = projects.filter((p) => p.status === "launched");
const orbiting = projects.length - launched.length;
// Each toolkit group without what the core tags already show; a group left empty is dropped.
const extras = toolkit
  .map((t) => ({ name: t.name, items: t.items.split(", ").filter((item) => !coreStack.includes(item)) }))
  .filter((t) => t.items.length > 0);
const REDACTED = "░░░░░░░░ ░░░░░";

/**
 * A dossier for an internship search: who, how to reach, and the CV stay pinned on the left while education,
 * skills, projects, awards and activity scroll past on the right.
 */
export default function AboutPage() {
  return (
    <PageShell wide>
      <div className="dossier">
        <aside className="dossier-id">
          <AboutPhoto />
          <h1>Jimuel Jean <em>Untalan</em></h1>
          <p className="kicker"><span className="status-dot" aria-hidden="true" />Full-stack developer · seeking an internship</p>
          <p className="about-pitch">
            I like making things work. I build with the user in mind, care a lot about interfaces, and think about how
            long the thing will last.
          </p>
          <ul className="contact-line">
            <li><a className="ink-link" href="mailto:untalanjimueljean@gmail.com">untalanjimueljean@gmail.com</a></li>
            <li><a className="ink-link" href="https://github.com/jimuelll" target="_blank" rel="noopener noreferrer">github</a></li>
            <li><a className="ink-link" href="https://www.linkedin.com/in/jimuel-jean-untalan-8b84a42a5" target="_blank" rel="noopener noreferrer">linkedin</a></li>
            <li>Quezon, PH · UTC+8</li>
          </ul>
          <CvButton />
        </aside>

        <div className="dossier-body">
          <section className="about-row">
            <h2><span>01</span>Education</h2>
            <div className="about-body">
              <div className="degree">
                <p className="degree-title">{degree.title}</p>
                <p>{degree.place}</p>
                <p className="faint">{degree.date}</p>
              </div>
              <div className="capstone">
                <p className="label">capstone · {capstone.date}</p>
                <p className="capstone-title">{capstone.title.replace(/^Capstone:\s*/, "")}</p>
                <p className="muted">{capstone.place}</p>
              </div>
            </div>
          </section>

          <section className="about-row">
            <h2><span>02</span>Skills</h2>
            <div className="about-body">
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
            </div>
          </section>

          <section className="about-row">
            <h2><span>03</span>Projects</h2>
            <div className="about-body">
              <ul className="project-lines">
                {launched.map((p) => (
                  <li key={p.slug}>
                    <a className="ink-link" href={p.links[0]?.href} target="_blank" rel="noopener noreferrer">{p.name}</a>
                    <span className="muted">{p.short}</span>
                  </li>
                ))}
              </ul>
              {orbiting > 0 && <p className="faint">+ {orbiting} more in orbit, launching soon</p>}
              <Link className="ink-link more" href="/projects">see all projects →</Link>
            </div>
          </section>

          <section className="about-row">
            <h2><span>04</span>Hackathons<br />&amp; awards</h2>
            <div className="about-body">
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
            </div>
          </section>

          <section className="about-row">
            <h2><span>05</span>Activity</h2>
            <div className="about-body">
              <Constellation weeks={26} />
            </div>
          </section>

          <p className="off-hours">Off-hours: games, anime, and Pokémon Showdown (hmu :p)</p>
        </div>
      </div>
    </PageShell>
  );
}
