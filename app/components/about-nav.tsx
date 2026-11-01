"use client";

import { useEffect, useState } from "react";

/** The dossier's contents, marking whichever section is being read. Sections are named by their element ids. */
export function AboutNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [current, setCurrent] = useState(sections[0]?.id);

  useEffect(() => {
    const measure = () => {
      const line = window.innerHeight * 0.3;
      let reading = sections[0]?.id;
      for (const { id } of sections) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= line) reading = id;
      }
      setCurrent(reading);
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [sections]);

  return (
    <nav className="section-nav" aria-label="On this page">
      {sections.map(({ id, label }) => (
        <a key={id} href={`#${id}`} aria-current={current === id ? "location" : undefined}>{label}</a>
      ))}
    </nav>
  );
}
