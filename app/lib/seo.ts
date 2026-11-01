import type { Metadata } from "next";

export const SITE_NAME = "Jimuel Jean Untalan";
export const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
export const socialImage = {
  url: "/og-image.png",
  width: 2400,
  height: 1260,
  alt: "Jimuel Jean Untalan, software engineer, beside a moon drawn in text characters",
};

/**
 * A page's title, description, canonical address and link previews. Next.js replaces rather than merges these
 * groups from the layout, so each page states them whole; a canonical left in the layout would claim every page.
 */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: siteOrigin ? { canonical: path } : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "en_PH",
      siteName: SITE_NAME,
      images: [socialImage],
      ...(siteOrigin ? { url: path } : {}),
    },
    twitter: { card: "summary_large_image", title, description, images: [socialImage.url] },
  };
}
