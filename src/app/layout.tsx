import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://learn.alolabs.net").replace(/\/+$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "আলো Learning Journey — Admin Command Center",
    template: "%s · আলো Learning Journey",
  },
  description:
    "শিশুদের শিক্ষা ও প্যারেন্টিং নিয়ে সচেতনতা ✨ Own AI agents · RAG · Protective Mode · আলো — ভালোবাসা দিয়ে শেখার পথ 💛",
  keywords: [
    "ALO Learning Journey",
    "parenting",
    "child education",
    "Bengali parenting",
    "শিশু শিক্ষা",
    "প্যারেন্টিং",
    "AI agents",
    "RAG",
    "aloeducation",
    "alolabs",
  ],
  authors: [{ name: "ALO Education" }],
  creator: "ALO Education",
  publisher: "ALO Education",
  applicationName: "ALO Learning Journey",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
  alternates: {
    canonical: "/",
    languages: {
      "bn-BD": "/",
      "en-US": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "bn_BD",
    alternateLocale: ["en_US"],
    url: SITE_URL,
    siteName: "আলো Learning Journey",
    title: "আলো Learning Journey — ভালোবাসা দিয়ে শেখার পথ",
    description:
      "শিশুদের শিক্ষা ও প্যারেন্টিং নিয়ে সচেতনতা। Own AI agents, RAG, protective mode — সবই এক জায়গায়।",
    images: [
      {
        url: "/api/og-image",
        width: 1200,
        height: 630,
        alt: "আলো Learning Journey",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "আলো Learning Journey — ভালোবাসা দিয়ে শেখার পথ",
    description:
      "শিশুদের শিক্ষা ও প্যারেন্টিং নিয়ে সচেতনতা। Own AI agents, RAG, protective mode।",
    images: ["/api/og-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

// JSON-LD structured data — helps Google understand the organization + site
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ALO Learning Journey",
  alternateName: "আলো Learning Journey",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.svg`,
  description:
    "শিশুদের শিক্ষা ও প্যারেন্টিং নিয়ে সচেতনতা — Own AI agents, RAG, protective mode।",
  sameAs: [
    "https://www.facebook.com/ALOLearningJourney",
    "https://learn.alolabs.net",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+8801805020103",
    contactType: "customer service",
    areaServed: "BD",
    availableLanguage: ["Bengali", "English"],
  },
};

// Pageview analytics — opt-in via env vars. Only one needs to be set.
// Google Analytics 4 (GA_MEASUREMENT_ID, e.g. "G-XXXXXXXXXX") OR
// Plausible Analytics (NEXT_PUBLIC_PLAUSIBLE_DOMAIN + optional PLAUSIBLE_SRC).
// Both are privacy-friendly options; Plausible is cookieless + GDPR-safe.
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim() || "";
const PLAUSIBLE_SRC =
  process.env.NEXT_PUBLIC_PLAUSIBLE_SRC?.trim() || "https://plausible.io/js/script.js";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {GA_ID && (
          <>
            {/* Google Analytics 4 */}
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});`,
              }}
            />
          </>
        )}
        {PLAUSIBLE_DOMAIN && (
          /* Plausible Analytics — cookieless, GDPR-friendly */
          <script
            async
            defer
            data-domain={PLAUSIBLE_DOMAIN}
            src={PLAUSIBLE_SRC}
          />
        )}
      </head>
      <body className="antialiased bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
