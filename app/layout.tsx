import type { Metadata } from "next";
import { Young_Serif } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});

// Instrument Serif (SIL Open Font License) for headings: the star-atlas voice next to the mono body.
const instrumentSerif = localFont({
  src: [
    { path: "./fonts/instrument-serif-latin-400-normal.woff2", style: "normal", weight: "400" },
    { path: "./fonts/instrument-serif-latin-400-italic.woff2", style: "italic", weight: "400" },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
});

// Young Serif for the name alone: wider and sturdier than Instrument Serif, so it reads first beside the disc.
const youngSerif = Young_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-young-serif",
  display: "swap",
});

const siteTitle = "Jimuel Jean Untalan | Software Engineer";
const siteDescription =
  "Portfolio of Jimuel Jean Untalan, a software engineer from Quezon, Philippines building reliable web applications with React, Node.js, databases, and cloud tooling.";
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
const socialImage = {
  url: "/og-image.png",
  width: 2400,
  height: 1260,
  alt: "Jimuel Jean Untalan, software engineer, beside a moon drawn in text characters",
};

export const metadata: Metadata = {
  ...(siteOrigin ? { metadataBase: new URL(siteOrigin) } : {}),
  title: siteTitle,
  description: siteDescription,
  verification: {
    google: "kR15d-A0JYppNf_o4vLwKiAp9OuE8gY6wg7uUL_q71c",
  },
  alternates: siteOrigin ? { canonical: "/" } : undefined,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: "website",
    locale: "en_PH",
    siteName: siteTitle,
    images: [socialImage],
    ...(siteOrigin ? { url: siteOrigin } : {}),
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [socialImage.url],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      name: "Jimuel Jean Untalan",
      jobTitle: "Software Engineer",
      description: siteDescription,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Quezon",
        addressCountry: "PH",
      },
      sameAs: ["https://github.com/jimuelll"],
      knowsAbout: [
        "TypeScript",
        "React",
        "Next.js",
        "Node.js",
        "Express",
        "MySQL",
        "PostgreSQL",
        "WebSockets",
        "Cloudflare",
      ],
      ...(siteOrigin ? { url: siteOrigin } : {}),
    },
    {
      "@type": "WebSite",
      name: siteTitle,
      description: siteDescription,
      ...(siteOrigin ? { url: siteOrigin } : {}),
    },
    {
      "@type": "SoftwareApplication",
      name: "Enverga-Candelaria Library System",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      url: "https://euc-lib.vercel.app",
      description:
        "A full-stack library services platform with semantic recommendations, AI-assisted analytics, real-time notifications, and role-based workflows.",
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html suppressHydrationWarning
      lang="en"
      className={`${geistMono.variable} ${instrumentSerif.variable} ${youngSerif.variable}`}
    >
      <head>
        {/* Set the theme before first paint so the sky never flashes the wrong colour. Night is the default. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('sky-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}` }} />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
