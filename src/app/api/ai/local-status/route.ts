import { NextResponse } from "next/server";
import { getLocalAiStatus } from "@/lib/local-models";
import { getExternalAiStatus } from "@/lib/external-ai";
import { localMediaBinaries } from "@/lib/local-audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [ai, binaries] = await Promise.all([
    getLocalAiStatus(),
    Promise.resolve(localMediaBinaries()),
  ]);
  const external = getExternalAiStatus();
  return NextResponse.json({
    ...ai,
    external,
    media: {
      ffmpeg: binaries.ffmpeg,
      ffprobe: binaries.ffprobe,
      speech: {
        piperAvailable: binaries.piper,
        espeakAvailable: binaries.espeak,
        usable: binaries.piper || binaries.espeak,
      },
    },
    notes: {
      noPaidApis: !external.enabled,
      externalAi: external.enabled
        ? "External free providers are enabled by the owner switches for allowlisted non-personal content drafts only; local models are still tried first."
        : "External AI is disabled by default; set both owner switches and at least one provider API key to enable the free draft fallback.",
      localTextNeededForModelGeneratedLyrics: true,
      imageGenerationNeedsComfyUiAndCheckpoint: true,
      imageCheckpointNotVerified: "Service status does not verify that the configured checkpoint is installed or usable.",
      chatNeedsOllamaModel: "The template fallback cannot answer free-form chat. Model availability does not guarantee a successful or timely response.",
      songAudio: "procedural instrumental; it is not a sung vocal track",
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
