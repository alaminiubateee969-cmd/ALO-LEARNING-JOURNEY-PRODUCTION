import type { Metadata } from "next";

/**
 * MarketingOS site identity (integrated in PR #27).
 *
 * PR #27 put this metadata — including a hard-coded canonical link to
 * marketing.alolabs.net — in the *root* layout, so every ALO Learning Journey
 * page on learn.aloeducation.com advertised another site. It now applies only
 * to the MarketingOS segments (/marketingos and /dashboard). The canonical host
 * is configurable for deployments that serve MarketingOS on its own domain.
 */
export const MARKETINGOS_SITE_URL = (
  process.env.NEXT_PUBLIC_MARKETINGOS_SITE_URL || "https://marketing.alolabs.net"
).replace(/\/+$/, "");
export const MARKETINGOS_SITE_NAME = "ALO Labs MarketingOS";
const SITE_DESCRIPTION =
  "ALO Labs MarketingOS — Enterprise AI Workforce Platform with 2,000 specialized AI employees, 120+ integrations, autonomous CRM, SEO, content, and campaign automation.";
const OG_IMAGE = `${MARKETINGOS_SITE_URL}/kexsio-logo.png`;
const TITLE = "ALO Labs MarketingOS — Enterprise AI Workforce Platform";

export const marketingOsMetadata: Metadata = {
  title: {
    default: TITLE,
    template: `%s | ${MARKETINGOS_SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "kexsio",
    "marketing",
    "AI",
    "AI workforce",
    "AI employees",
    "social media",
    "CRM",
    "SEO",
    "automation",
    "content generation",
    "campaigns",
    "MarketingOS",
    "enterprise marketing",
    "AI agents",
    "marketing automation",
    "AI marketing platform",
  ],
  authors: [{ name: "ALO Labs", url: MARKETINGOS_SITE_URL }],
  creator: "ALO Labs",
  publisher: "ALO Labs",
  category: "Business > Marketing > Automation",
  alternates: {
    canonical: `${MARKETINGOS_SITE_URL}/`,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/kexsio-logo.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/kexsio-logo.png", sizes: "512x512" }],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: MARKETINGOS_SITE_URL,
    siteName: MARKETINGOS_SITE_NAME,
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 512, height: 512, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  manifest: "/manifest.json",
};
