export type Project = {
  index: string;
  name: string;
  type: string;
  year: string;
  summary: string;
  stack: string;
  demoUrl: string;
};

export type ExperienceRole = {
  date: string;
  role: string;
  company: string;
  copy: string;
};

export type StackGroup = {
  name: string;
  items: string;
};

export const homeNavItems = [
  { id: "start", label: "START", mobileLabel: "START" },
  { id: "work", label: "WORK", mobileLabel: "WORK" },
  { id: "profile", label: "PROFILE", mobileLabel: "PROFILE" },
  { id: "about", label: "ABOUT", mobileLabel: "ABOUT" },
] as const;
export type HomeSection = (typeof homeNavItems)[number]["id"];
export type NavPage = "home" | "lab";

export const projects: Project[] = [
  {
    index: "01",
    name: "PROJECT ALPHA",
    type: "REALTIME PLATFORM",
    year: "2026",
    summary: "A collaborative workspace designed for fast-moving distributed teams.",
    stack: "NEXT.JS / TYPESCRIPT / GO / POSTGRESQL",
    demoUrl: "https://example.com",
  },
  {
    index: "02",
    name: "PROJECT BETA",
    type: "DEVELOPER TOOL",
    year: "2025",
    summary: "An observability interface that turns complex systems into clear decisions.",
    stack: "REACT / NODE.JS / CLICKHOUSE / AWS",
    demoUrl: "https://example.com",
  },
  {
    index: "03",
    name: "PROJECT GAMMA",
    type: "COMMERCE SYSTEM",
    year: "2025",
    summary: "A resilient multi-market storefront built for speed, scale, and conversion.",
    stack: "NEXT.JS / GRAPHQL / STRIPE / VERCEL",
    demoUrl: "https://example.com",
  },
];

export const experienceRoles: ExperienceRole[] = [
  {
    date: "2024—NOW",
    role: "SENIOR SOFTWARE ENGINEER",
    company: "COMPANY NAME",
    copy: "Shipped core platform systems and led frontend architecture.",
  },
  {
    date: "2022—2024",
    role: "FULL-STACK ENGINEER",
    company: "PREVIOUS COMPANY",
    copy: "Built customer-facing products from first commit to production.",
  },
  {
    date: "2020—2022",
    role: "SOFTWARE DEVELOPER",
    company: "EARLY-STAGE STUDIO",
    copy: "Delivered web applications across product and infrastructure.",
  },
];

export const stackGroups: StackGroup[] = [
  { name: "INTERFACE", items: "TypeScript, React, Next.js, CSS, Design Systems" },
  { name: "SYSTEMS", items: "Node.js, Go, REST, GraphQL, WebSockets" },
  { name: "DATA", items: "PostgreSQL, Redis, ClickHouse, Search" },
  { name: "DELIVERY", items: "AWS, Cloudflare, Docker, CI/CD, Observability" },
];
