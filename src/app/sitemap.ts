import type { MetadataRoute } from "next";

// Production sitemap. Lists only publicly-reachable pages (proxy.ts gates
// everything else behind auth). The site URL defaults to the live domain.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://learn.alolabs.net").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
