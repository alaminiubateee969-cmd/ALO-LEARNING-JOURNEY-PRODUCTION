import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://learn.alolabs.net").replace(/\/+$/, "");

/**
 * OG share image. Returns the logo SVG rendered as an SVG response.
 * For a richer image (text + branding), replace with a ComfyUI / @vercel/og
 * render. This keeps the route dependency-free for now.
 */
export async function GET() {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.svg");
    const svg = await readFile(logoPath, "utf-8");
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    // Fallback: minimal branded SVG
    const fallback = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="#f59e0b"/>
      <text x="600" y="280" font-family="system-ui, sans-serif" font-size="72" font-weight="bold" fill="white" text-anchor="middle">আলো</text>
      <text x="600" y="360" font-family="system-ui, sans-serif" font-size="36" fill="white" text-anchor="middle">Learning Journey</text>
      <text x="600" y="440" font-family="system-ui, sans-serif" font-size="24" fill="white" text-anchor="middle">ভালোবাসা দিয়ে শেখার পথ</text>
    </svg>`;
    return new NextResponse(fallback, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
}
