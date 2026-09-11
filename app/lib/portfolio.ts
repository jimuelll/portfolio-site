export type Project = {
  index: string;
  name: string;
  type: string;
  year: string;
  summary: string;
  stack: string;
  services?: string;
  dense?: boolean;
  demoLabel?: string;
  image?: string;
  demoUrl: string;
};

export type StackGroup = {
  name: string;
  items: string;
};

export const homeNavItems = [
  { id: "start", label: "START", mobileLabel: "START" },
  { id: "projects", label: "PROJECTS", mobileLabel: "PROJECTS" },
  { id: "expertise", label: "EXPERTISE", mobileLabel: "EXPERTISE" },
  { id: "about", label: "ABOUT", mobileLabel: "ABOUT" },
] as const;
export type HomeSection = (typeof homeNavItems)[number]["id"];
export type NavPage = "home" | "lab";

export const projects: Project[] = [
  {
    index: "01",
    name: "ENVERGA-CANDELARIA LIBRARY SYSTEM",
    type: "AI-ENABLED LIBRARY PLATFORM",
    year: "2026",
    summary:
      "A full-stack library services platform with semantic recommendations, AI-assisted analytics, real-time notifications, and role-based workflows for students, staff, and administrators.",
    stack:
      "REACT / TYPESCRIPT / VITE / TAILWIND CSS\nNODE.JS / EXPRESS / MYSQL / WEBSOCKETS",
    services:
      "GEMINI EMBEDDINGS / GEMINI OR GROQ ANALYTICS\nJWT AUTH / CLOUDINARY / QR + BARCODE SCANNING",
    dense: true,
    demoLabel: "LIBRARY PORTAL",
    image: "/euc-library.png",
    demoUrl: "https://euc-lib.vercel.app",
  },
  {
    index: "02",
    name: "PROJECT BETA",
    type: "DEVELOPER TOOL",
    year: "2025",
    summary:
      "An observability interface that turns complex systems into clear decisions.",
    stack: "REACT / NODE.JS / CLICKHOUSE / AWS",
    demoUrl: "https://example.com",
  },
  {
    index: "03",
    name: "PROJECT GAMMA",
    type: "COMMERCE SYSTEM",
    year: "2025",
    summary:
      "A resilient multi-market storefront built for speed, scale, and conversion.",
    stack: "NEXT.JS / GRAPHQL / STRIPE / VERCEL",
    demoUrl: "https://example.com",
  },
];

export const stackGroups: StackGroup[] = [
  {
    name: "FRONTEND",
    items: "TypeScript, React, Next.js, Vite, Tailwind CSS, TanStack Query, Framer Motion",
  },
  {
    name: "BACKEND",
    items: "Node.js, Express, REST APIs, WebSockets, JWT Authentication",
  },
  {
    name: "DATA / STORAGE",
    items: "MySQL, MariaDB, PostgreSQL, Redis, Cloudinary",
  },
  {
    name: "CLOUD / DEVOPS",
    items: "Cloudflare, CI/CD, Vercel",
  },
];
