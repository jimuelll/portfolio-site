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
      url: `${siteOrigin}/projects`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteOrigin}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
