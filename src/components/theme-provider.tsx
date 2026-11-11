"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Routes owned by the MarketingOS app (integrated in PR #27).
 *
 * - `/dashboard` mounts its own next-themes provider (dark default + system
 *   preference). next-themes silently ignores nested providers, so the ALO
 *   provider must step aside there or MarketingOS would lose its theme config.
 * - Every MarketingOS route gets the `mos-theme` class on <html>, which scopes
 *   MarketingOS's colour tokens (see globals.css) so portalled dialogs,
 *   popovers and toasts match its palette. ALO routes are unaffected.
 */
const MARKETINGOS_PREFIXES = ["/dashboard", "/marketingos"];
const SELF_THEMED_PREFIXES = ["/dashboard"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const isMarketingOs = matchesPrefix(pathname, MARKETINGOS_PREFIXES);

  useEffect(() => {
    document.documentElement.classList.toggle("mos-theme", isMarketingOs);
  }, [isMarketingOs]);

  if (matchesPrefix(pathname, SELF_THEMED_PREFIXES)) return <>{children}</>;

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
