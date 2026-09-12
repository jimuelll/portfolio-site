"use client";

import { useState } from "react";
import { PageTitle } from "./page-title";

const practiceEntries = [
  {
    date: "ONGOING",
    role: "INDEPENDENT DEVELOPMENT",
    company: "PERSONAL + ACADEMIC PROJECTS",
    copy: "Shipping full-stack applications from interface to infrastructure, centered on maintainability and real workflows.",
  },
  {
    date: "ONGOING",
    role: "EXPERIMENTAL DEVELOPMENT",
    company: "LAB / SELF-DIRECTED WORK",
    copy: "Testing new tools, interaction patterns, and system ideas through focused prototypes.",
  },
  {
    date: "CURRENT",
    role: "CAPSTONE DEVELOPMENT",
    company: "ACADEMIC PROJECT",
    copy: "Building a production-scale academic system through research and collaborative engineering.",
  },
];

const education = [
  {
    date: "2022—ONGOING",
    role: "B.S. COMPUTER SCIENCE",
    school: "MANUEL S. ENVERGA UNIVERSITY FOUNDATION — CANDELARIA",
    copy: "Software engineering, algorithms, databases, systems, and human-centered development.",
  },
  {
    date: "2025—2026",
    role: "CAPSTONE / THESIS",
    school: "AI-ENHANCED SMART LIBRARY MANAGEMENT SYSTEM",
    copy: "Capstone on academic resource accessibility, scalable architecture, and practical user experience.",
  },
];

export function ExperienceView() {
  const [flipped, setFlipped] = useState(true);
  const [titleGlitch, setTitleGlitch] = useState(false);

  const toggle = () => {
    setTitleGlitch(true);
    setFlipped((value) => !value);
  };

  return (
    <section
      className="profile-section experience-section view"
      id="experience"
    >
      <PageTitle
        key={flipped ? "education-title" : "practice-title"}
        index="02"
        eyebrow={flipped ? "EDUCATION / PRACTICE" : "PRACTICE / EDUCATION"}
        title={flipped ? "EDUCATION" : "PRACTICE"}
        className={titleGlitch ? "experience-title-glitch" : undefined}
        glitchTitle={titleGlitch}
      />
      <div
        className={`experience-flip-card ${flipped ? "is-flipped" : ""}`}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={`Practice and education card. Currently showing ${flipped ? "education" : "practice"}. Click to flip.`}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
      >
        <div className="experience-card-ui">
          <div className="experience-card-face experience-card-front">
            <div className="experience-card-topline mono-label">
              <span>FACE / 01</span>
              <span className="experience-flip-control">
                <span>FLIP TO EDUCATION</span>
                <i className="flip-corrupt-copy copy-a" aria-hidden="true">FLIP TO EDUCATION</i>
                <i className="flip-corrupt-copy copy-b" aria-hidden="true">FLIP TO EDUCATION</i>
                <b aria-hidden="true">↗</b>
              </span>
            </div>
            <div className="experience-card-list">
              {practiceEntries.map((role, index) => (
                <article className="experience-card-row" key={role.date + role.role}>
                  <div className="experience-card-date mono-label">
                    <strong className="experience-entry-index">0{index + 1}</strong>
                    <span>{role.date}</span>
                  </div>
                  <div className="experience-card-entry">
                    <h3>{role.role}</h3>
                    <p className="experience-card-meta">{role.company}</p>
                    <p className="experience-card-description">{role.copy}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="experience-card-hint mono-label">
              EDUCATION / 02 ENTRIES · VIEW FILE{" "}
              <span aria-hidden="true">↻</span>
            </div>
          </div>
          <div className="experience-card-face experience-card-back">
            <div className="experience-card-topline mono-label">
              <span>FACE / 02</span>
              <span className="experience-flip-control">
                <span>FLIP TO PRACTICE</span>
                <i className="flip-corrupt-copy copy-a" aria-hidden="true">FLIP TO PRACTICE</i>
                <i className="flip-corrupt-copy copy-b" aria-hidden="true">FLIP TO PRACTICE</i>
                <b aria-hidden="true">↗</b>
              </span>
            </div>
            <div className="experience-card-list">
              {education.map((item, index) => (
                <article
                  className="experience-card-row"
                  key={item.date + item.role}
                >
                  <div className="experience-card-date mono-label">
                    <strong className="experience-entry-index">0{index + 1}</strong>
                    <span>{item.date}</span>
                  </div>
                  <div className="experience-card-entry">
                    <h3>{item.role}</h3>
                    <p className="experience-card-meta">{item.school}</p>
                    <p className="experience-card-description">{item.copy}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="experience-card-hint mono-label">
              PRACTICE / 03 TRACKS · RETURN{" "}
              <span aria-hidden="true">↻</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
