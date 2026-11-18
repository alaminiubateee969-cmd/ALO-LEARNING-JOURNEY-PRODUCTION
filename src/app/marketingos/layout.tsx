import type { Metadata } from "next";
import { marketingOsMetadata } from "@/lib/marketingos-metadata";

export const metadata: Metadata = marketingOsMetadata;

export default function MarketingOsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
