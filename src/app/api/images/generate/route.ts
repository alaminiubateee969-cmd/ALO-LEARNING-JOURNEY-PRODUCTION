import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { generateImageFile } from "@/lib/ai";
import { executeAsAgent } from "@/lib/agent-runtime";

export const runtime = "nodejs";
export const maxDuration = 240;

type ImageGenData = {
  url: string;
  provider: string;
  usedFallback: boolean;
  error?: string;
};

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "A JSON object with a prompt is required" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt || prompt.length > 2000) {
    return NextResponse.json({ error: "prompt must contain 1–2000 characters" }, { status: 400 });
  }
  // A filename is only a single simple basename, never a path. Keep the final
  // name within the documented 80-character limit and reject traversal, URL
  // metacharacters and platform-specific path separators rather than sanitizing.
  const supplied = input.filename;
  if (supplied !== undefined && (typeof supplied !== "string" ||
      !/^[A-Za-z0-9_-]+(?:\.png)?$/.test(supplied) || supplied.length > 76)) {
    return NextResponse.json({ error: "filename must be a simple basename of at most 76 characters, optionally ending in .png" }, { status: 400 });
  }
  const basename = typeof supplied === "string" ? supplied.replace(/\.png$/, "") : `alo_${randomUUID()}`;
  const filename = `${basename}.png`;
  const dir = path.join(process.cwd(), "public", "generated");
  await mkdir(dir, { recursive: true });
  const outPath = path.join(dir, filename);

  const agentResult = await executeAsAgent<ImageGenData>(
    {
      agentId: "image_generator",
      task: `Generate image: ${prompt.slice(0, 60)}`,
      tools: ["image.gen"],
    },
    async () => {
      const result = await generateImageFile(prompt, outPath, "1024x1024");
      if (!result.ok) {
        // The static SVG is deliberately not interpolated with user input.
        const svgName = `${basename}.svg`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#fef3c7"/><text x="512" y="500" font-size="48" text-anchor="middle" fill="#92400e" font-family="sans-serif">আলো ✨</text></svg>`;
        await writeFile(path.join(dir, svgName), svg);
        const data: ImageGenData = { url: `/generated/${svgName}`, provider: "image-fallback", usedFallback: true, error: "Local image generation unavailable; placeholder provided." };
        return { data, provider: data.provider, usedFallback: true, error: data.error };
      }
      const data: ImageGenData = { url: `/generated/${filename}`, provider: result.provider, usedFallback: result.usedFallback };
      return { data, provider: result.provider, usedFallback: result.usedFallback };
    },
  );

  if (agentResult.status === "failed") {
    return NextResponse.json({ error: "image_generation_failed", agentRunId: agentResult.runId }, { status: 500 });
  }
  return NextResponse.json({
    ...agentResult.result,
    agentRunId: agentResult.runId,
    agentId: agentResult.agentId,
    agentStatus: agentResult.status,
    auditId: agentResult.auditId,
  }, { headers: { "Cache-Control": "no-store" } });
}
