import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticationConfigured } from "@/lib/auth-config";
import { verifyMediaToken } from "@/lib/media-token";

const STATIC_PREFIXES = ["/_next/"];
const STATIC_PATHS = new Set(["/favicon.ico", "/robots.txt", "/logo.svg"]);
const PROTECTED_MEDIA_PREFIXES = [
  "/avatar-videos/",
  "/avatar-audio/",
  "/avatar-scenes/",
  "/avatar-thumbs/",
  "/avatars/",
];

function isPublicPath(request: NextRequest): boolean {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname === "/api/health" && searchParams.get("details") !== "1") return true;
  return pathname === "/api/auth" || pathname.startsWith("/api/auth/");
}

function apiResponse(status: number, error: string) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (STATIC_PATHS.has(pathname) || STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if ((pathname === "/api/recovery/sweep" || pathname.startsWith("/api/recovery/sweep/")) && request.method === "POST") {
    const configuredSecret = process.env.CRON_SECRET ?? "";
    const suppliedSecret = request.headers.get("x-cron-secret") ?? "";
    if (configuredSecret && suppliedSecret.length === configuredSecret.length && suppliedSecret === configuredSecret) {
      return NextResponse.next();
    }
    // Otherwise continue through normal session authentication. The route
    // accepts a signed-in admin or a constant-time-valid cron header.
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|logo.svg).*)"],
};
