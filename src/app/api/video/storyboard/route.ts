import { NextResponse } from "next/server";
import { ensureSeeded } from "@/lib/seed";
import { executeAsAgent, recordAgentPipelineStages } from "@/lib/agent-runtime";
import { generateLocalChatJson } from "@/lib/local-models";
import type { QualityAgentPass } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface StoryboardSceneItem {
  id: string;
  number: number;
  title: string;
  duration: number;
  character: "baby_girl" | "mother" | "father" | "teacher" | "narrator";
  shotType: "wide" | "medium" | "close-up" | "over-shoulder" | "top-down";
  visualPrompt: string;
  voiceover: string;
  emotion: "warm" | "hopeful" | "concerned" | "joyful" | "calm" | "excited";
}

function buildLocalStoryboardScenes(topic: string, audience: string): StoryboardSceneItem[] {
  const cleanTopic = topic.trim() || "শিশুর ভাষা বিকাশ ও উচ্চশিক্ষা গাইড";
  return [
    {
      id: `s1_${Date.now()}`,
      number: 1,
      title: `হুক — ${cleanTopic.slice(0, 36)}`,
      duration: 4,
      character: "mother",
      shotType: "close-up",
      visualPrompt: `Warm Bengali editorial illustration of a caring mother and child beginning a learning moment about ${cleanTopic}, soft golden morning sunlight, cozy bookshelf background, portrait 9:16, child-safe, no text`,
      voiceover: `${cleanTopic} নিয়ে সঠিক তথ্যের অভাবে অনেকেই শুরুতে দ্বিধায় পড়েন—চলুন সহজ সমাধানটি জেনে নিই।`,
      emotion: "warm",
    },
    {
      id: `s2_${Date.now() + 1}`,
      number: 2,
      title: "মূল চ্যালেঞ্জ ও বাস্তব প্রেক্ষাপট",
      duration: 5,
      character: "father",
      shotType: "medium",
      visualPrompt: `Warm editorial illustration of a thoughtful Bengali father reviewing a checklist and notebook for ${cleanTopic} with ${audience}, calm study desk, warm lamp glow, portrait 9:16, no text`,
      voiceover: `${audience}-দের সবচেয়ে বড় প্রশ্ন থাকে—কোথা থেকে এবং কোন ধাপে প্রস্তুতি শুরু করলে ভুল হওয়ার ঝুঁকি থাকবে না?`,
      emotion: "concerned",
    },
    {
      id: `s3_${Date.now() + 2}`,
      number: 3,
      title: "ধাপে ধাপে সমাধান — বিশেষজ্ঞ পরামর্শ",
      duration: 6,
      character: "teacher",
      shotType: "medium",
      visualPrompt: `Bright hopeful editorial illustration of a friendly Bengali mentor guiding a family step-by-step on ${cleanTopic}, warm classroom setting with plants and books, portrait 9:16, no text`,
      voiceover: `প্রতিদিন মাত্র ১৫ মিনিট পরিকল্পিত রুটিন এবং যাচাইকৃত চেকলিস্ট অনুসরণ করলে পুরো প্রক্রিয়াটি অনেক সহজ ও আনন্দময় হয়ে ওঠে।`,
      emotion: "hopeful",
    },
    {
      id: `s4_${Date.now() + 3}`,
      number: 4,
      title: "CTA — পরিবারের আত্মবিশ্বাসী পদক্ষেপ",
      duration: 5,
      character: "narrator",
      shotType: "wide",
      visualPrompt: `Heartwarming wide editorial illustration of a joyful Bengali family celebrating progress on ${cleanTopic}, golden hour light, warm pastel palette, portrait 9:16, no text`,
      voiceover: `আপনার পরিবারের পরবর্তী পদক্ষেপ নিতে আজই কমেন্টে আপনার প্রশ্ন লিখুন—আলো লার্নিং জার্নি সবসময় আপনার পাশে আছে।`,
      emotion: "joyful",
    },
  ];
}

export async function POST(request: Request) {
  await ensureSeeded();
  const body = (await request.json().catch(() => ({}))) as {
    topic?: unknown;
    audience?: unknown;
  };
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const audience =
    typeof body.audience === "string" && body.audience.trim()
      ? body.audience.trim()
      : "বাংলাদেশি পিতামাতা ও শিক্ষার্থী";

  if (!topic || topic.length > 240) {
    return NextResponse.json(
      { error: "topic must contain 1–240 characters" },
      { status: 400 }
    );
  }

  const startMs = Date.now();
  const agent = await executeAsAgent<{
    topic: string;
    audience: string;
    scenes: StoryboardSceneItem[];
    totalDuration: number;
    provider: string;
    paidApiCalls: boolean;
    qualityPipeline: QualityAgentPass[];
  }>(
    {
      agentId: "video_director",
      task: `Direct 4-scene storyboard for: ${topic.slice(0, 90)}`,
      input: { topic, audience },
      tools: ["storyboard.gen", "ollama.local"],
      requiresApproval: false,
    },
    async () => {
      const fallbackScenes = buildLocalStoryboardScenes(topic, audience);
      let scenes = fallbackScenes;
      let modelUsed = "built-in-local";
      let usedFallback = true;

      try {
        const completion = await generateLocalChatJson(
          "You are VideoDirectorAgent for ALO Learning Journey. Return JSON with a scenes array of 4 scenes (title, duration, character, shotType, visualPrompt, voiceover, emotion) in warm Bengali.",
          `Topic: "${topic}"\nAudience: "${audience}"\nCreate 4 9:16 storyboard scenes totaling 20 seconds.`,
          12_000
        );
        modelUsed = completion.model;
        const parsed = JSON.parse(completion.content) as { scenes?: Partial<StoryboardSceneItem>[] };
        if (!completion.model.includes("(built-in-local)") && Array.isArray(parsed.scenes) && parsed.scenes.length >= 3) {
          scenes = parsed.scenes.slice(0, 4).map((s, idx) => ({
            ...fallbackScenes[idx % fallbackScenes.length],
            ...s,
            id: `s${idx + 1}_${Date.now()}`,
            number: idx + 1,
            duration: Math.max(3, Math.min(15, Number(s.duration ?? fallbackScenes[idx % fallbackScenes.length].duration))),
          }));
          usedFallback = false;
        }
      } catch {
        // The route retains a labeled built-in storyboard template.
      }

      const elapsed = Math.max(1, Date.now() - startMs);
      const qualityPipeline: QualityAgentPass[] = [
        {
          agentId: "video_director",
          role: "Storyboard generation",
          status: usedFallback ? "fallback" : "complete",
          provider: usedFallback ? "local-fallback" : "ollama-local",
          latencyMs: elapsed,
          summary: usedFallback
            ? "Built-in storyboard template used; no model-based critic, finalist, child-safety review, or quality score was run."
            : "A local Ollama model returned a storyboard. No separate critic, finalist, or child-safety reviewer was run.",
        },
      ];

      return {
        data: {
          topic,
          audience,
          scenes,
          totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
          provider: modelUsed,
          usedFallback,
          paidApiCalls: false,
          qualityPipeline,
        },
        provider: usedFallback ? "local-fallback" : "ollama-local",
        usedFallback,
        error: usedFallback ? "Built-in storyboard template used; the configured Ollama model did not provide a valid storyboard." : undefined,
      };
    }
  );

  await recordAgentPipelineStages("video storyboard direction", agent.result.qualityPipeline);
  return NextResponse.json({
    ...agent.result,
    agentStatus: agent.status,
    agentError: agent.error,
    agentRunId: agent.runId,
    auditId: agent.auditId,
  });
}
