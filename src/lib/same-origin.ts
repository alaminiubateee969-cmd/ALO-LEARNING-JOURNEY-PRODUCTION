/**
 * Same-origin guard for state-changing auth endpoints (CSRF defence).
 *
 * IMPORTANT: Next.js route handlers derive `request.url` from the server's
 * bound address (e.g. http://0.0.0.0:3017), NOT from the Host header the
 * browser sent. Comparing the Origin header against `request.url` therefore
 * rejects every legitimate request in a reverse-proxy deployment. The check
 * must compare the Origin header against the effective request host — the
 * X-Forwarded-Host / Host headers — and, when the proxy declares it, the
 * forwarded protocol.
 */

function firstHeader(value: string | null): string {
  return (value ?? "").split(",")[0].trim();
}

function defaultPort(protocol: string): string {
  return protocol === "https:" ? "443" : protocol === "http:" ? "80" : "";
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  // No Origin header: same-site GET/form navigation or a non-browser client.
  // Allow outside strict production; in production require the header.
  if (!origin) return process.env.NODE_ENV !== "production";

  try {
    const originUrl = new URL(origin);
    const forwardedHost = firstHeader(request.headers.get("x-forwarded-host"));
    const hostHeader = firstHeader(request.headers.get("host"));
    const effectiveHost = forwardedHost || hostHeader;
    const hostToCompare = effectiveHost || new URL(request.url).host;
    const requestUrl = new URL(`${originUrl.protocol}//${hostToCompare}`);

    const hostMatches =
      originUrl.hostname.toLowerCase() === requestUrl.hostname.toLowerCase() &&
      (originUrl.port || defaultPort(originUrl.protocol)) ===
        (requestUrl.port || defaultPort(requestUrl.protocol));

    if (!hostMatches) return false;

    // Protocol: only enforce when the proxy explicitly declares it (Nginx
    // sets X-Forwarded-Proto in deploy/nginx/learn-aloeducation.conf).
    const forwardedProto = firstHeader(request.headers.get("x-forwarded-proto")).replace(/:$/, "");
    if (forwardedProto && forwardedProto !== originUrl.protocol.replace(/:$/, "")) return false;

    return true;
  } catch {
    return false;
  }
}

/** Standard 403 response for failed same-origin checks. */
export function sameOriginRejection(): Response {
  return new Response(JSON.stringify({ error: "same_origin_required" }), {
    status: 403,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
