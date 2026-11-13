export type Project = {
  slug: string;
  /** "in-orbit" projects are placeholders: their names stay hidden and they show a planet instead of a screenshot. */
  status: "launched" | "in-orbit";
  name: string;
  kind: string;
  year: string;
  summary: string;
  /** One sentence for the about page's at-a-glance view: what it does, not what it's built with. */
  short: string;
  /** The key technologies, most telling first; the about page shows the first four. */
  stack: string[];
  /** Role and hard numbers, shown under the project's title so a skim catches them. */
  facts?: string[];
  links: { label: string; href: string }[];
  /** Screenshots for the project's gallery, the lead one first. */
  gallery?: { src: string; width: number; height: number; alt: string; caption: string }[];
  /** What it does, most interesting first. */
  highlights?: { title: string; text: string }[];
};

export const projects: Project[] = [
  {
    slug: "bookwyrm",
    status: "launched",
    name: "Bookwyrm",
    kind: "ai study tool · quizzes from your pdfs",
    year: "2026",
    short: "Turns a PDF into quizzes where every answer cites the exact sentence and page it came from.",
    summary:
      "Turns a PDF into quizzes you can trust. Questions are written only from your document, each one is checked by a second AI pass, and every answer shows the exact sentence and page it came from. Topics you miss get short follow-up quizzes.",
    stack: ["Python", "FastAPI", "PostgreSQL", "pgvector", "React", "TypeScript", "Docker Compose", "GitHub Actions"],
    facts: ["300+ automated tests", "CI on every push"],
    links: [
      { label: "live site", href: "https://bookwyrm.wyrmm.workers.dev" },
      { label: "source", href: "https://github.com/jimuelll/bookwyrm" },
    ],
    gallery: [
      { src: "/bookwyrm-home.webp", width: 1536, height: 800, alt: "Bookwyrm landing page: a lamplit bookshelf scene beside the headline", caption: "Landing page, with a live three.js scene" },
      { src: "/bookwyrm-citations.webp", width: 1536, height: 800, alt: "Bookwyrm results page showing a wrong answer, the correct answer, and the quoted sentence with its page number", caption: "Every answer cites the exact sentence and page it came from, shown here on a real quiz" },
      { src: "/bookwyrm-topic-search.webp", width: 1536, height: 800, alt: "Quiz setup with the topic 'powerhouse' matched to one passage on pages 1 to 3", caption: "Topic search by meaning: “powerhouse” never appears in the book, yet it finds the mitochondria passage" },
      { src: "/bookwyrm-library.webp", width: 1536, height: 800, alt: "Bookwyrm library with an uploaded PDF and links to take or write a quiz", caption: "The library: upload a PDF, then take or write a quiz" },
    ],
    highlights: [
      { title: "Verified, cited questions", text: "Each question is tied to a source passage and an evidence quote checked against its text. A second AI pass rejects ambiguous or unanswerable ones." },
      { title: "Search by meaning", text: "Passages are embedded into pgvector and matched by meaning as well as keywords. The similarity cutoff was measured on the real model, not guessed." },
      { title: "Resilient AI calls", text: "Groq and Gemini sit behind one interface with retries, backoff and automatic fallback, so a quota error never fails an upload." },
      { title: "Review quizzes", text: "Missed topics are listed with their pages, and one click writes a short quiz from just the passages that cover them." },
      { title: "Safe with untrusted files", text: "PDFs are parsed in a sandboxed child process with time limits, behind upload quotas, rate limits and a strict Content-Security-Policy." },
      { title: "CI and Docker", text: "GitHub Actions runs lint, type checks, 300+ tests and a build on every push, against a real pgvector Postgres. Docker Compose starts the database in one command." },
    ],
  },
  {
    slug: "euc-library",
    status: "launched",
    name: "Enverga-Candelaria Library System",
    kind: "ai-enabled library platform",
    year: "2026",
    short: "A university library platform: public catalogue, patron self-service, and a staff workspace with AI recommendations and analytics.",
    summary:
      "A web-based library management system for Manuel S. Enverga University Foundation — Candelaria Inc. It combines a public library website and catalogue, patron self-service, and a role-based workspace for library operations.",
    stack: ["React", "TypeScript", "Node.js", "Express", "MySQL", "WebSockets", "Gemini embeddings", "JWT"],
    facts: ["solo developer", "capstone project"],
    links: [{ label: "live site", href: "https://euc-lib.vercel.app" }],
    gallery: [
      { src: "/euc-home.webp", width: 1906, height: 922, alt: "EUC Library home page with catalogue search", caption: "Public home page, with catalogue search" },
      { src: "/euc-catalogue.jpg", width: 1536, height: 702, alt: "Library catalogue with filters, availability, and similar book links", caption: "Catalogue search, with live availability and similar-book suggestions on each title" },
      { src: "/euc-dashboard.jpg", width: 1536, height: 702, alt: "Admin dashboard showing overdue loans, unpaid fines, and today's totals", caption: "Admin dashboard: outstanding items and today's desk activity" },
      { src: "/euc-analytics.jpg", width: 1536, height: 702, alt: "Operations analytics with circulation figures and an AI Report tab", caption: "Operations analytics, home of the AI Report tab" },
    ],
    highlights: [
      { title: "AI recommendations", text: "Semantic book suggestions from Gemini embeddings alongside rule-based matches, with admin tools to run and monitor embedding backfills." },
      { title: "AI analytics", text: "Performance briefs and questions about aggregate library data, using Gemini or Groq, with supporting figures and links to records." },
      { title: "Catalogue and self-service", text: "Public search across books and theses, plus personal loans, reservations, fines, and a library barcode." },
      { title: "Desk operations", text: "Checkout, returns, renewals, reservations, fine payments with receipts, and attendance scanning." },
      { title: "Collection records", text: "Copy-level holdings and accessions, barcode labels, ISBN lookup, and CSV import with a validation preview." },
      { title: "Administration", text: "Reports and exports, audit history, real-time notifications, and backups with a guarded restore." },
    ],
  },
  {
    slug: "fluxion",
    status: "launched",
    name: "Fluxion",
    kind: "ui style gallery · 3d tv wall",
    year: "2026",
    short: "A handmade collection of distinct UI styles, browsed on a wall of 3D retro TVs that play live previews.",
    summary:
      "A collection of handmade UI styles (landing pages, marketing sites, product UI and dashboards), each with its own type, colour, layout and motion. They are browsed on a 3D wall of CRT televisions, where every screen plays a recorded preview of its style; pick one to open it full size.",
    stack: ["Next.js", "React", "TypeScript", "three.js", "React Three Fiber", "GSAP", "Playwright"],
    facts: ["solo design and build", "static export"],
    links: [
      { label: "live site", href: "https://fluxion-mauve.vercel.app/" },
      { label: "source", href: "https://github.com/jimuelll/fluxion" },
    ],
    gallery: [
      { src: "/fluxion-wall.webp", width: 1536, height: 800, alt: "A wall of stacked retro CRT televisions, some playing site previews, others showing static", caption: "The TV wall, with live previews playing on the CRT screens" },
      { src: "/fluxion-bakawan.webp", width: 1536, height: 800, alt: "Bakawan landing page: a mangrove aerial photo under the headline Restoring the Mangroves That Protect Us", caption: "Bakawan: a landing page for mangrove restoration" },
      { src: "/fluxion-kaye.webp", width: 1536, height: 800, alt: "Kaye Eats marketing site with a bold purple headline and phone mockups", caption: "Kaye Eats: a loud marketing site for a food content creator" },
      { src: "/fluxion-agos.webp", width: 1536, height: 800, alt: "Agos dark logistics dashboard with KPI tiles and a Philippines hub map", caption: "Agos: a dark operations dashboard with a live hub map" },
    ],
    highlights: [
      { title: "3D TV wall", text: "A react-three-fiber room of stacked CRTs with a custom scanline shader; unused slots show NO SIGNAL static." },
      { title: "Live previews", text: "Each TV plays a video of its style, recorded by a Playwright script, so the wall always matches the real pages." },
      { title: "Distinct styles", text: "Every style is its own design with its own type, colour, layout and motion, not a re-skin of one template." },
      { title: "Lighter on phones", text: "Mobile and low-power devices get a reduced wall, keeping the scene smooth." },
    ],
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
export const coreStack = ["TypeScript", "React", "Next.js", "Node.js", "Python", "PostgreSQL", "MySQL"];

export const toolkit = [
  { name: "frontend", items: "TypeScript, React, Next.js, Tailwind CSS, Vite, Flutter" },
  { name: "backend", items: "Node.js, Python, Express, FastAPI, Flask, WebSockets" },
  { name: "data", items: "PostgreSQL, MySQL, pgvector, MongoDB, Redis, Supabase" },
  { name: "ai & ml", items: "RAG, TensorFlow, OpenCV, n8n" },
  { name: "testing", items: "pytest, Vitest, Testing Library" },
  { name: "devops", items: "Docker, GitHub Actions, Vercel, Cloudflare" },
];

/** What the work gets built with, not what it's built from: a tier below the toolkit. */
export const workflow = ["Claude Code", "Codex"];

export const education = [
  {
    date: "2022 — now",
    title: "B.S. Computer Science",
    place: "Manuel S. Enverga University Foundation — Candelaria",
  }
];
