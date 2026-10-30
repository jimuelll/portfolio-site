export type Project = {
  slug: string;
  /** "in-orbit" projects are placeholders: their names stay hidden and they show a planet instead of a screenshot. */
  status: "launched" | "in-orbit";
  name: string;
  kind: string;
  year: string;
  summary: string;
  /** One line for the about page's at-a-glance view. */
  short: string;
  stack: string[];
  links: { label: string; href: string }[];
  image?: { src: string; width: number; height: number };
};

export const projects: Project[] = [
  {
    slug: "euc-library",
    status: "launched",
    name: "Enverga-Candelaria Library System",
    kind: "ai-enabled library platform · capstone",
    year: "2026",
    short: "AI library platform: semantic recommendations, analytics, real-time notifications.",
    summary:
      "A full-stack library services platform with semantic book recommendations, AI-assisted analytics, real-time notifications, and role-based workflows for students, staff, and administrators.",
    stack: ["React", "TypeScript", "Vite", "Tailwind", "Node.js", "Express", "MySQL", "WebSockets", "Gemini embeddings", "JWT", "Cloudinary"],
    links: [{ label: "live site", href: "https://euc-lib.vercel.app" }],
    image: { src: "/euc-library.webp", width: 1280, height: 590 },
  },
  // Placeholders: shown as "in orbit" until a real project replaces them. Swap one out by filling in its
  // fields and setting status to "launched".
  {
    slug: "in-orbit-1",
    status: "in-orbit",
    name: "Unannounced project",
    kind: "in orbit · launching soon",
    year: "soon",
    short: "",
    summary: "Something new is being built. The details land here once it launches.",
    stack: [],
    links: [],
  },
  {
    slug: "in-orbit-2",
    status: "in-orbit",
    name: "Unannounced project",
    kind: "in orbit · launching soon",
    year: "soon",
    short: "",
    summary: "Another one is still on the launch pad. Check back soon.",
    stack: [],
    links: [],
  },
];

/**
 * The CV: the receiver under the moon on the home page, and the download button on /about. With no file yet
 * both say it's landing soon. Put the PDF in public/ and set its path here (e.g. "/jimuel-jean-untalan-cv.pdf").
 */
export const cv: { href: string | null } = { href: null };

/** The portrait on /about, shown as a theme-tinted duotone. Put the image in public/ and set its path here. */
export const profile: { photo: string | null; photoAlt: string } = { photo: null, photoAlt: "Jimuel Jean Untalan" };

export type Award = { title: string; event: string; date: string; placeholder?: boolean };
/** Hackathons and awards on /about. Placeholders show redacted; fill one in and drop `placeholder`. */
export const awards: Award[] = [
  { title: "Hackathon entry", event: "To be announced", date: "soon", placeholder: true },
  { title: "Award or recognition", event: "To be announced", date: "soon", placeholder: true },
];

/** What a recruiter should see first. */
export const coreStack = ["TypeScript", "React", "Next.js", "Node.js", "Express", "MySQL", "PostgreSQL"];

export const toolkit = [
  { name: "frontend", items: "TypeScript, React, Next.js, Flutter, Vite, Tailwind CSS, TanStack Query, Framer Motion" },
  { name: "backend", items: "Node.js, Express, REST APIs, WebSockets, JWT auth" },
  { name: "data", items: "MySQL, MariaDB, PostgreSQL, MongoDB, Redis, Cloudinary" },
  { name: "cloud", items: "Vercel, Cloudflare, CI/CD" },
  { name: "python & ml", items: "Python, TensorFlow, NumPy, Matplotlib, Pillow, OpenCV, Flask" },
  { name: "ai & dev tools", items: "Claude Code, Codex, n8n, agentic workflows" },
];

export const education = [
  {
    date: "2022 — now",
    title: "B.S. Computer Science",
    place: "Manuel S. Enverga University Foundation — Candelaria",
  },
  {
    date: "2025 — 2026",
    title: "Capstone: AI-enhanced smart library system",
    place: "Academic resource access, scalable architecture, practical UX",
  },
];
