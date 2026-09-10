"use client";

import { useEffect, useState } from "react";
import CursorTrail from "./cursor-trail";

type View = "work" | "experience" | "stack" | "about";

const projects = [
  { index: "01", name: "PROJECT ALPHA", type: "REALTIME PLATFORM", year: "2026", summary: "A collaborative workspace designed for fast-moving distributed teams.", stack: "NEXT.JS / TYPESCRIPT / GO / POSTGRESQL" },
  { index: "02", name: "PROJECT BETA", type: "DEVELOPER TOOL", year: "2025", summary: "An observability interface that turns complex systems into clear decisions.", stack: "REACT / NODE.JS / CLICKHOUSE / AWS" },
  { index: "03", name: "PROJECT GAMMA", type: "COMMERCE SYSTEM", year: "2025", summary: "A resilient multi-market storefront built for speed, scale, and conversion.", stack: "NEXT.JS / GRAPHQL / STRIPE / VERCEL" },
];

const navItems: View[] = ["work", "experience", "stack", "about"];

export default function Home() {
  const [view, setView] = useState<View>("work");
  const [dark, setDark] = useState(false);
  const [corrupting, setCorrupting] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  function transition(next?: View, toggleTheme = false) {
    if (corrupting) return;
    setCorrupting(true);
    window.setTimeout(() => {
      if (next) setView(next);
      if (toggleTheme) setDark((value) => !value);
    }, 180);
    window.setTimeout(() => setCorrupting(false), 560);
  }

  return (
    <main className={`shell ${corrupting ? "is-corrupting" : ""}`}>
      <CursorTrail suspended={corrupting} />
      <div className="corruption" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6].map((number) => <i className={`corrupt-block b${number}`} key={number} />)}
      </div>

      <header className="site-header">
        <button className="identity" onClick={() => transition("work")} aria-label="Go to work">
          <span className="identity-mark" aria-hidden="true" /><span>YOUR NAME</span>
        </button>
        <nav aria-label="Primary navigation">
          {navItems.map((item) => (
            <button key={item} className={view === item ? "active" : ""} onClick={() => transition(item)}>
              /{item.toUpperCase()}
            </button>
          ))}
        </nav>
        <button className="theme-toggle" onClick={() => transition(undefined, true)}>
          <span>{dark ? "LIGHT" : "DARK"}</span><span className="toggle-box" aria-hidden="true">{dark ? "□" : "■"}</span>
        </button>
      </header>

      {view === "work" && <WorkView />}
      {view === "experience" && <ExperienceView />}
      {view === "stack" && <StackView />}
      {view === "about" && <AboutView />}

      <footer>
        <span>© 2026 YOUR NAME</span><span>BUILD 2026.09</span><span>LOCATION / CITY, COUNTRY</span>
        <a href="mailto:hello@example.com">CONTACT ↗</a>
      </footer>
    </main>
  );
}

function WorkView() {
  return (
    <div className="view" key="work">
      <section className="hero">
        <div className="hero-kicker mono-label">00 / INDEX</div>
        <h1>FULL-STACK<br /><span>DEVELOPER</span></h1>
        <div className="hero-meta">
          <div><span className="mono-label">SPECIALIZATION</span><p>INTERFACE TO<br />INFRASTRUCTURE</p></div>
          <div><span className="mono-label">CURRENT STATUS</span><p><span className="status-square" />AVAILABLE FOR WORK</p></div>
          <div className="hero-intro"><p>Building precise, resilient software systems where product thinking meets technical depth.</p></div>
        </div>
        <div className="hero-code" aria-hidden="true">SYS::PORTFOLIO / 01</div>
      </section>

      <section className="work-section">
        <div className="section-heading">
          <span className="section-number">01</span>
          <div><span className="mono-label">SELECTED</span><h2>WORK</h2></div>
          <p>03 / 05 PROJECTS</p>
        </div>
        <div className="project-list">
          {projects.map((project) => (
            <article className="project" key={project.index} tabIndex={0}>
              <div className="project-visual" aria-label={`${project.name} image placeholder`}>
                <span className="placeholder-label">IMAGE / {project.index}</span><div className="pixel-field" aria-hidden="true" /><div className="project-index">{project.index}</div>
              </div>
              <div className="project-copy">
                <div className="project-topline mono-label"><span>{project.index} / {project.type}</span><span>{project.year}</span></div>
                <h3>{project.name}</h3><p className="project-summary">{project.summary}</p>
                <div className="project-bottom">
                  <div><span className="mono-label">STACK</span><p>{project.stack}</p></div><span className="view-project">VIEW PROJECT ↗</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ExperienceView() {
  const roles = [
    ["2024—NOW", "SENIOR SOFTWARE ENGINEER", "COMPANY NAME", "Shipped core platform systems and led frontend architecture."],
    ["2022—2024", "FULL-STACK ENGINEER", "PREVIOUS COMPANY", "Built customer-facing products from first commit to production."],
    ["2020—2022", "SOFTWARE DEVELOPER", "EARLY-STAGE STUDIO", "Delivered web applications across product and infrastructure."],
  ];
  return <section className="inner-page view"><PageTitle index="02" eyebrow="CAREER LOG" title="EXPERIENCE" /><div className="timeline">
    {roles.map(([date, role, company, copy], i) => <article className="role" key={date}><span className="role-index mono-label">0{i + 1}</span><span className="role-date mono-label">{date}</span><div><h2>{role}</h2><p className="company">{company}</p></div><p className="role-copy">{copy}</p></article>)}
  </div></section>;
}

function StackView() {
  const groups = [
    ["INTERFACE", "TypeScript, React, Next.js, CSS, Design Systems"], ["SYSTEMS", "Node.js, Go, REST, GraphQL, WebSockets"],
    ["DATA", "PostgreSQL, Redis, ClickHouse, Search"], ["DELIVERY", "AWS, Cloudflare, Docker, CI/CD, Observability"],
  ];
  return <section className="inner-page view"><PageTitle index="03" eyebrow="CAPABILITY MAP" title="STACK" /><div className="stack-grid">
    {groups.map(([name, items], i) => <article key={name}><span className="stack-number">0{i + 1}</span><span className="mono-label">{name}</span><p>{items}</p></article>)}
  </div><div className="stack-note"><span className="mono-label">PRINCIPLE</span><p>Tools are selected for the problem. Fundamentals stay constant.</p></div></section>;
}

function AboutView() {
  return <section className="inner-page view"><PageTitle index="04" eyebrow="PERSONAL FILE" title="ABOUT" /><div className="about-grid">
    <div className="portrait-placeholder" aria-label="Portrait placeholder"><div className="halftone" /><span className="placeholder-label">PORTRAIT / PLACEHOLDER</span></div>
    <div className="about-copy"><p className="lead">I build software with equal attention to how it works, how it feels, and how long it lasts.</p><p>This space will hold a concise personal introduction: working style, interests, and the perspective behind the work. The final copy should sound direct and human.</p><dl>
      <div><dt>LOCATION</dt><dd>CITY, COUNTRY</dd></div><div><dt>FOCUS</dt><dd>PRODUCT ENGINEERING</dd></div><div><dt>STATUS</dt><dd>AVAILABLE</dd></div>
    </dl><a className="contact-link" href="mailto:hello@example.com">HELLO@EXAMPLE.COM ↗</a></div>
  </div></section>;
}

function PageTitle({ index, eyebrow, title }: { index: string; eyebrow: string; title: string }) {
  return <div className="page-title"><span className="page-index">{index}</span><div><span className="mono-label">{eyebrow}</span><h1>{title}</h1></div><span className="page-state mono-label">STATE / LOADED</span></div>;
}
