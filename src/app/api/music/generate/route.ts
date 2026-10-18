import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { executeAsAgent, recordAgentPipelineStages } from "@/lib/agent-runtime";
import { generateSongLyrics, type QualityAgentPass } from "@/lib/ai";
import { generateProceduralInstrumental, type MusicMood } from "@/lib/local-audio";
import { ensureSeeded } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIO_DIR = path.join(process.cwd(), "storage", "audio");
const MOODS = new Set<MusicMood>(["calm", "hopeful", "playful", "reflective"]);

export async function POST(request: Request) {
  await ensureSeeded();
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic || topic.length > 240) {
    return NextResponse.json({ error: "topic must contain 1–240 characters" }, { status: 400 });
  }

  const mood = typeof body.mood === "string" && MOODS.has(body.mood as MusicMood)
    ? body.mood as MusicMood
    : "hopeful";
  const requestedDuration = Number(body.durationSeconds ?? 45);
  if (!Number.isInteger(requestedDuration) || requestedDuration < 10 || requestedDuration > 90) {
    return NextResponse.json({ error: "durationSeconds must be an integer from 10 to 90" }, { status: 400 });
  }
  const requestedBpm = Number(body.bpm ?? 88);
  const bpm = Number.isInteger(requestedBpm) ? Math.max(65, Math.min(130, requestedBpm)) : 88;
  const id = `song_${randomUUID()}`;
  const outputPath = path.join(AUDIO_DIR, `${id}.wav`);
  await mkdir(AUDIO_DIR, { recursive: true });

  const agent = await executeAsAgent<{
    id: string;
    audioUrl: string;
    lyrics: { title: string; lyrics: string; styleNote: string };
    instrumental: { durationSeconds: number; sampleRate: number; format: "wav"; generator: string };
    mood: MusicMood;
    bpm: number;
    lyricsProvider: string;
    lyricsUsedFallback: boolean;
    usedFallback: boolean;
    lyricsQualityPipeline: QualityAgentPass[];
  }>(
    {
      agentId: "music_composer",
      task: `Compose a local song draft about ${topic.slice(0, 100)}`,
      input: { topic, mood, durationSeconds: requestedDuration, bpm },
      tools: ["ollama.local", "procedural-music.local"],
      requiresApproval: false,
    },
    async () => {
      const [lyricsResult, instrumental] = await Promise.all([
        generateSongLyrics(topic, mood),
        generateProceduralInstrumental(outputPath, {
          durationSeconds: requestedDuration,
          bpm,
          mood,
          seed: `${topic}|${mood}|${bpm}`,
        }),
      ]);
      return {
        data: {
          id,
          audioUrl: `/api/media/audio/${id}`,
          lyrics: lyricsResult.data,
          instrumental,
          mood,
          bpm,
          lyricsProvider: lyricsResult.provider,
          lyricsUsedFallback: lyricsResult.usedFallback,
          usedFallback: lyricsResult.usedFallback,
          lyricsQualityPipeline: lyricsResult.qualityPipeline ?? [],
        },
        provider: `${lyricsResult.provider}+local-procedural-synth`,
        error: lyricsResult.error,
      };
    }
  );

  if (agent.status === "failed") {
    return NextResponse.json({ error: agent.error || "Local music generation failed", agentRunId: agent.runId }, { status: 500 });
  }
  await recordAgentPipelineStages("song lyric refinement", agent.result.lyricsQualityPipeline);
  return NextResponse.json(
    { ...agent.result, agentStatus: agent.status, agentError: agent.error, agentRunId: agent.runId, auditId: agent.auditId },
    { headers: { "Cache-Control": "no-store" } }
  );
}
