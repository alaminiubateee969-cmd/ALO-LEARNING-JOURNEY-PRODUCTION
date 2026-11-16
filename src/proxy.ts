import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticationConfigured } from "@/lib/auth-config";
import {
  isMarketingOsApiPath,
  readBearerToken,
  verifyMarketingOsBearer,
} from "@/lib/bearer-auth";
import { verifyMediaToken } from "@/lib/media-token";

const STATIC_PREFIXES = ["/_next/"];
const STATIC_PATHS = new Set(["/favicon.ico", "/robots.txt", "/sitemap.xml", "/logo.svg"]);
const PROTECTED_MEDIA_PREFIXES = [
  "/avatar-videos/",
  "/avatar-audio/",
  "/avatar-scenes/",
  "/avatar-thumbs/",
  "/avatars/",
];

function constantTimeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function isPublicPath(request: NextRequest): boolean {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname === "/contact" || pathname.startsWith("/contact/")) return true;
  if (pathname === "/api/contact" || pathname.startsWith("/api/contact/")) return true;
  if (pathname === "/api/health" && searchParams.get("details") !== "1") return true;
  if (pathname === "/api/v1/auth/refresh" && request.method === "POST") return true;
  if (/^\/api\/v1\/integrations\/[^/]+\/callback\/?$/.test(pathname) && request.method === "GET") {
    return true;
  }
  return pathname === "/api/auth" || pathname.startsWith("/api/auth/");
}

function apiResponse(status: number, error: string) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (STATIC_PATHS.has(pathname) || STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if ((pathname === "/api/recovery/sweep" || pathname.startsWith("/api/recovery/sweep/")) && request.method === "POST") {
    const configuredSecret = process.env.CRON_SECRET ?? "";
    const suppliedSecret = request.headers.get("x-cron-secret") ?? "";
    if (constantTimeEqual(suppliedSecret, configuredSecret)) {
      return NextResponse.next();
    }
    // Otherwise continue through normal session authentication. The route
    // accepts a signed-in admin or a constant-time-valid cron header.
  }

  if ((pathname === "/api/cron/social-publish" || pathname.startsWith("/api/cron/social-publish/")) && request.method === "GET") {
    const configuredSecret = process.env.CRON_SECRET ?? "";
    const suppliedBearer = readBearerToken(request.headers.get("authorization")) ?? "";
    if (constantTimeEqual(suppliedBearer, configuredSecret)) {
      return NextResponse.next();
    }
  }

  if (isPublicPath(request)) return NextResponse.next();

  // Local previews remain usable without production credentials. Opt in to
  // exercising auth locally with ALO_REQUIRE_AUTH=true.
  if (process.env.NODE_ENV !== "production" && process.env.ALO_REQUIRE_AUTH !== "true") {
    const response = NextResponse.next();
    response.headers.set("x-alo-auth", "local-preview");
    return response;
  }

  if (!isAdminAuthenticationConfigured()) {
    if (pathname.startsWith("/api/")) return apiResponse(503, "authentication_not_configured");
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("reason", "setup");
    return NextResponse.redirect(loginUrl);
  }

  // MarketingOS authenticates with a signed JWT instead of the admin session.
  // Both the signature and the route allowlist are checked here so neither an
  // arbitrary `Authorization: Bearer <junk>` header nor a valid MarketingOS
  // tenant token can skip the gateway and reach a single-tenant ALO route.
  // Allowed route handlers additionally verify the token and scope every query
  // by the `companyId` it carries.
  // Accept verified Bearer JWT on ALL API routes, not just MarketingOS.
  // The frontend api-client.ts sends Bearer on every request.
  const bearerSubject = await verifyMarketingOsBearer(request.headers.get("authorization"));
  if (bearerSubject) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });
  if (token) return NextResponse.next();

  const isProtectedMedia = PROTECTED_MEDIA_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtectedMedia) {
    const mediaToken = request.nextUrl.searchParams.get("t");
    if (mediaToken && await verifyMediaToken(mediaToken, pathname)) return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in is required." },
      { status: 401, headers: { "Cache-Control": "no-store", "WWW-Authenticate": "Bearer" } },
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|logo.svg).*)"],
};
