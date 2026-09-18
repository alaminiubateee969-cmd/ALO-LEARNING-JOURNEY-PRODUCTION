import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://marketingos.ai";
const SITE_NAME = "MarketingOS";
const SITE_DESCRIPTION =
  "Enterprise AI Workforce Platform — 2,000 specialized AI employees running your entire marketing operation. Connect 120+ tools, automate campaigns, manage CRM, optimize SEO, and scale your business with intelligent AI agents.";
const OG_IMAGE = `${SITE_URL}/og-image.png`;

export const metadata: Metadata = {
  // --- Basic ---
  title: {
    default: "MarketingOS — Enterprise AI Workforce Platform",
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
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
  authors: [{ name: "MarketingOS", url: SITE_URL }],
  creator: "MarketingOS",
  publisher: "MarketingOS",
  category: "Business > Marketing > Automation",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // --- Canonical ---
  alternates: {
    canonical: SITE_URL,
  },

  // --- Icons ---
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },

  // --- Open Graph ---
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "MarketingOS — Enterprise AI Workforce Platform",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "MarketingOS — Enterprise AI Workforce Platform",
      },
    ],
  },

  // --- Twitter Card ---
  twitter: {
    card: "summary_large_image",
    title: "MarketingOS — Enterprise AI Workforce Platform",
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },

  // --- App manifest ---
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="canonical" href={SITE_URL} />
        <meta name="author" content="MarketingOS" />
        <meta property="og:locale:alternate" content="en_US" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
