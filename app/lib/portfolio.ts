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
  /** Screenshots for the project's gallery, the lead one first. */
  gallery?: { src: string; width: number; height: number; alt: string; caption: string }[];
  /** What it does, most interesting first. */
  highlights?: { title: string; text: string }[];
};

export const projects: Project[] = [
  {
    slug: "euc-library",
    status: "launched",
    name: "Enverga-Candelaria Library System",
    kind: "ai-enabled library platform · capstone",
    year: "2026",
    short: "RBAC · Real-time notifications · AI recommendations · Analytics dashboards · Barcode/QR circulation · Vector embeddings · Rate limiting",
    summary:
      "A web-based library management system for Manuel S. Enverga University Foundation — Candelaria Inc. It combines a public library website and catalogue, patron self-service, and a role-based workspace for library operations.",
    stack: ["React", "TypeScript", "Vite", "Tailwind", "Node.js", "Express", "MySQL", "WebSockets", "Gemini embeddings", "Groq", "JWT", "Cloudinary"],
    links: [{ label: "live site", href: "https://euc-lib.vercel.app" }],
    gallery: [
      { src: "/euc-home.webp", width: 1906, height: 922, alt: "EUC Library home page with catalogue search", caption: "Public home page, with catalogue search" },
      { src: "/euc-catalogue.jpg", width: 1536, height: 702, alt: "Library catalogue with filters, availability, and similar book links", caption: "Catalogue search, with live availability and similar-book suggestions on each title" },
      { src: "/euc-dashboard.jpg", width: 1536, height: 702, alt: "Admin dashboard showing overdue loans, unpaid fines, and today's totals", caption: "Admin dashboard: outstanding items and today's desk activity" },
      { src: "/euc-analytics.jpg", width: 1536, height: 702, alt: "Operations analytics with circulation figures and an AI Report tab", caption: "Operations analytics, home of the AI Report tab" },
    ],
    highlights: [
      { title: "AI recommendations", text: "Semantic book suggestions from Gemini embeddings, alongside rule-based matches. Patrons can dismiss them, and super admins can run and monitor embedding backfills." },
      { title: "AI analytics", text: "Performance briefs and questions about aggregate library data, using Gemini or Groq, with supporting figures and links back to records." },
      { title: "Catalogue and self-service", text: "Public search across books and theses, plus personal loans, reservations, fines, and a library barcode." },
      { title: "Desk operations", text: "Checkout, returns, renewals, reservations, fine payments with receipts, and attendance scanning." },
      { title: "Collection records", text: "Copy-level holdings and accessions, barcode labels, ISBN lookup, and CSV import with a validation preview." },
      { title: "Administration", text: "Reports and exports, audit history, website publishing, real-time notifications, and backups with a guarded restore." },
    ],
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

/** The avatar on /about, with an animation that plays when pressed. */
export const profile = {
  avatar: "/avatar.webp",
  avatarPlay: "/avatar-play.gif",
  avatarAlt: "Illustrated avatar: a character in a yellow hood against a dark blue background",
};

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
  { name: "ai & dev tools", items: "Claude Code, Codex, n8n" },
];

export const education = [
  {
    date: "2022 — now",
    title: "B.S. Computer Science",
    place: "Manuel S. Enverga University Foundation — Candelaria",
  }
];
