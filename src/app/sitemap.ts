import type { MetadataRoute } from "next";

// PR #27 hard-coded marketing.alolabs.net here, so this deployment
// (learn.aloeducation.com) published a sitemap for a different host. A sitemap
// may only list URLs on its own host, so use the deployment's public URL and
// list only pages that are reachable without signing in (see middleware.ts).
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://learn.aloeducation.com").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];
}
