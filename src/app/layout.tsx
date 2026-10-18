import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "আলো Learning Journey — Admin Command Center",
  description:
    "শিশুদের শিক্ষা ও প্যারেন্টিং নিয়ে সচেতনতা ✨ Own AI agents · RAG · Protective Mode · আলো — ভালোবাসা দিয়ে শেখার পথ 💛",
  keywords: [
    "ALO Learning Journey",
    "parenting",
    "child education",
    "Bengali parenting",
    "AI agents",
    "RAG",
    "aloeducation",
  ],
  authors: [{ name: "ALO Education" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
