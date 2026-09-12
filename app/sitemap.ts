import type { MetadataRoute } from "next";

const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteOrigin) return [];

  return [
    {
      url: siteOrigin,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${siteOrigin}/lab`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
