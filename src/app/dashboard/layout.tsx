import type { Metadata } from "next";
import { marketingOsMetadata } from "@/lib/marketingos-metadata";

// The MarketingOS dashboard is an authenticated app shell: keep its branding,
// but never let search engines index it.
export const metadata: Metadata = {
  ...marketingOsMetadata,
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
