import { NextResponse } from "next/server";
import { generateImageFile } from "@/lib/ai";
import { executeAsAgent } from "@/lib/agent-runtime";

type ImageGenData = {
  url: string;
  provider: string;
  usedFallback: boolean;
  error: string | undefined;
};

export async function POST(req: Request) {
  let { prompt, filename } = await req.json().catch(() => ({
    prompt: "warm pastel parenting illustration",
    filename: `alo_${Date.now()}`,
  }));
  if (!filename.endsWith(".png")) filename = `${filename}.png`;
  const fs = await import("fs");
  const path = await import("path");
  const dir = path.join(process.cwd(), "public", "generated");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, filename);

  const agentResult = await executeAsAgent<ImageGenData>(
    {
      agentId: "image_generator",
      task: `Generate image: ${prompt.slice(0, 60)}`,
      tools: ["image.gen"],
    },
    async () => {
      const result = await generateImageFile(prompt, outPath, "1024x1024");
      const url = `/generated/${filename}`;
      if (result.usedFallback) {
        const svgName = filename.replace(/\.png$/, ".svg");
        const svgPath = path.join(dir, svgName);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#fef3c7"/><text x="512" y="500" font-size="48" text-anchor="middle" fill="#92400e" font-family="sans-serif">আলো ✨</text></svg>`;
        fs.writeFileSync(svgPath, svg);
        try { fs.unlinkSync(outPath); } catch {}
        const data: ImageGenData = { url: `/generated/${svgName}`, provider: "image-fallback", usedFallback: true, error: result.error ?? "unknown" };
        return { data, provider: "image-fallback" };
      }
      const data: ImageGenData = { url, provider: "image-gen", usedFallback: false, error: undefined };
      return { data, provider: "image-gen" };
    }
  );

  return NextResponse.json({
    ...agentResult.result,
    agentRunId: agentResult.runId,
    agentId: agentResult.agentId,
    agentStatus: agentResult.status,
    auditId: agentResult.auditId,
  });
}
