import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteTitle = "Jimuel Jean Untalan | Full-Stack Developer";
const siteDescription =
  "Portfolio of Jimuel Jean Untalan, a full-stack developer from Quezon, Philippines building reliable web applications with React, Node.js, databases, and cloud tooling.";
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
const socialImage = {
  url: "/og-image.png",
  width: 1733,
  height: 908,
  alt: "Jimuel Jean Untalan — Full-Stack Developer",
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
      jobTitle: "Full-Stack Developer",
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
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
