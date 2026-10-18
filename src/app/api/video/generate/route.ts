import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { executeAsAgent } from "@/lib/agent-runtime";
import { execSync } from "child_process";
import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";

const VIDEO_DIR = path.join(process.cwd(), "storage", "videos");
const FONT_FILE = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

function exec(cmd: string, timeoutMs = 300000): string {
  try {
    return execSync(cmd, { timeout: timeoutMs, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (e: any) {
    throw new Error(`Command failed: ${cmd.slice(0, 100)}\n${(e.stderr || e.message || "").slice(0, 300)}`);
  }
}

function probeDuration(filePath: string): number {
  const out = exec(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`);
  return parseFloat(out);
}

function probeVideo(filePath: string) {
  const json = exec(`ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`);
  const data = JSON.parse(json);
  const v = data.streams.find((s: any) => s.codec_type === "video");
  const a = data.streams.find((s: any) => s.codec_type === "audio");
  return {
    duration: parseFloat(data.format.duration),
    width: parseInt(v?.width ?? "0"),
    height: parseInt(v?.height ?? "0"),
    fps: v?.r_frame_rate ?? "0/1",
    videoCodec: v?.codec_name ?? "unknown",
    audioCodec: a?.codec_name ?? "none",
    audioSampleRate: a?.sample_rate ?? "0",
    audioChannels: a?.channels ?? 0,
    fileSize: parseInt(data.format.size ?? "0"),
    mimeType: "video/mp4",
    formatName: data.format.format_name ?? "unknown",
  };
}

// Generate TTS audio and measure actual duration. If short, generate
// additional meaningful content until audio >= targetDuration.
function generateTTSToTarget(
  scriptLines: string[],
  voice: string,
  targetDuration: number,
  audioPath: string,
  jobId: string
): { duration: number; segments: { text: string; start: number; end: number }[] } {
  const audioParts: string[] = [];
  const segments: { text: string; start: number; end: number }[] = [];
  let totalDuration = 0;
  let lineIdx = 0;

  // Pad lines: if we run through all script lines and still haven't reached
  // target, add meaningful closing/recap content. 30 varied lines cycling.
  const paddingLines = [
    "আজকের ভিডিওটি ভালো লাগলে শেয়ার করুন।",
    "আলো লার্নিং জার্নিতে যুক্ত হোন।",
    "পরবর্তী ভিডিওতে আরও শিখবেন।",
    "আপনার শিশুর জন্য সেরা চেষ্টা করুন।",
    "ধৈর্য ধরুন, শিশু ধীরে ধীরে শিখবে।",
    "প্রতিদিন একটু একটু করে অনুশীলন করুন।",
    "ভালোবাসা দিয়ে শেখান, জোর করে নয়।",
    "শিশুকে সময় দিন, তারা শিখবে।",
    "আলো — ভালোবাসা দিয়ে শেখার পথ।",
    "ধন্যবাদ, আবার দেখা হবে।",
    "প্রতিটি শিশু আলাদা, তুলনা করবেন না।",
    "ছোট ছোট অর্জন উদযাপন করুন।",
    "শিশুর আগ্রহ অনুসরণ করুন।",
    "খেলার মাধ্যমে শেখা সবচেয়ে কার্যকর।",
    "প্রশংসা করুন, উৎসাহ দিন।",
    "ভুল করলে ধৈর্য ধরুন।",
    "প্রতিদিন নতুন কিছু শেখান।",
    "শিশুর কৌতূহল মূল্যবান।",
    "প্রশ্ন করতে উৎসাহিত করুন।",
    "আবিষ্কার করতে দিন।",
    "সৃজনশীলতা বাড়ান।",
    "কল্পনা শক্তি বিকাশ করুন।",
    "গল্প বলুন, গান গাইন।",
    "আলিঙ্গন করুন, ভালোবাসা দিন।",
    "নিরাপদ পরিবেশে খেলতে দিন।",
    "শিশুর সাথে বন্ধু হোন।",
    "শোনা শেখার প্রথম ধাপ।",
    "বোঝার চেষ্টা করুন শিশুকে।",
    "সংবেদনশীল প্যারেন্টিং করুন।",
    "আলো লার্নিং জার্নি — ভালোবাসা দিয়ে শেখার পথ।",
  ];

  let paddingIdx = 0;
  // No hard limit on line count — keep generating until target duration is met.
  // Safety cap at 500 lines (~2000s/~33min) to prevent pathological loops.
  while (totalDuration < targetDuration && lineIdx < 500) {
    // Get the next line (script first, then padding, cycling through padding)
    let text: string;
    if (lineIdx < scriptLines.length) {
      text = scriptLines[lineIdx];
    } else {
      text = paddingLines[paddingIdx % paddingLines.length];
      paddingIdx++;
    }

    const partPath = path.join(VIDEO_DIR, `${jobId}_part${lineIdx}.wav`);
    const escapedText = text.replace(/"/g, '\\"').replace(/`/g, "\\`").replace(/\$/g, "\\$");
    exec(`espeak "${escapedText}" -v ${voice} -s 140 -w "${partPath}"`);

    const partDur = probeDuration(partPath);
    segments.push({ text, start: totalDuration, end: totalDuration + partDur });
    audioParts.push(partPath);
    totalDuration += partDur;
    lineIdx++;
  }

  // Concatenate all audio parts
  const concatListPath = path.join(VIDEO_DIR, `${jobId}_concat.txt`);
  const concatContent = audioParts.map((p) => `file '${p}'`).join("\n");
  exec(`echo '${concatContent.replace(/'/g, "'\\''")}' > "${concatListPath}"`);
  exec(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${audioPath}"`);

  // Clean up parts
  for (const part of audioParts) {
    try { fsSync.unlinkSync(part); } catch {}
  }
  try { fsSync.unlinkSync(concatListPath); } catch {}

  const finalDuration = probeDuration(audioPath);
  return { duration: finalDuration, segments };
}

export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json().catch(() => ({}));

  const topic = body.topic || "Untitled";
  const script = body.script || `[হুক] ${topic} নিয়ে আজ জানবো\n\n[বিষয়] এই ভিডিওতে আমরা শিখব ${topic} সম্পর্কে\n\n[CTA] আলো লার্নিং জার্নি-তে যুক্ত হোন`;
  const voice = body.voice || "bn";
  const requestedDuration = Math.max(50, Math.min(3600, body.duration || 50));

  const jobId = `video_${Date.now()}`;
  const audioPath = path.join(VIDEO_DIR, `${jobId}_audio.wav`);
  const videoPath = path.join(VIDEO_DIR, `${jobId}.mp4`);

  // EXECUTE AS ALO AGENT — creates AgentRun + audit log
  type VideoResult = Record<string, any>;
    const agentResult = await executeAsAgent<VideoResult>(
    {
      agentId: "video_generator",
      task: `Generate ${requestedDuration}s video: ${topic}`,
      input: { topic, voice, duration: requestedDuration },
      tools: ["tts.local", "ffmpeg", "ffprobe"],
      requiresApproval: false,
    },
    async () => {
      try {
    await fs.mkdir(VIDEO_DIR, { recursive: true });

    // STEP 1: Parse script into lines
    const scriptLines = script.split("\n").filter((l: string) => l.trim());

    // STEP 2: Generate TTS audio to meet requested duration
    const { duration: audioDuration, segments } = generateTTSToTarget(
      scriptLines, voice, requestedDuration, audioPath, jobId
    );

    // STEP 3: Build scene timeline from actual audio segments
    const sceneColors = ["0xF59E0B", "0xEC4899", "0x10B981", "0x8B5CF6", "0x06B6D4"];
    const drawTexts = segments.map((seg, i) => {
      const start = seg.start.toFixed(2);
      const end = seg.end.toFixed(2);
      const escapedText = seg.text.slice(0, 80).replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/%/g, "\\%");
      const color = sceneColors[i % sceneColors.length];
      // Background color change per scene + text overlay
      return `drawtext=fontfile=${FONT_FILE}:text='${escapedText}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,${start},${end})'`;
    });

    const videoFilter = `scale=1920:1080,${drawTexts.join(",")}`;

    // STEP 4: Generate video — background + audio + text overlay
    // Video duration = audio duration (ensures narration matches video)
    exec(`ffmpeg -y -f lavfi -i "color=c=0x1a1a2e:s=1920x1080:d=${audioDuration.toFixed(2)}:r=30" -i "${audioPath}" -vf "${videoFilter}" -c:v libx264 -preset fast -pix_fmt yuv420p -c:a aac -b:a 128k -shortest "${videoPath}"`);

    // STEP 5: Validate the generated video with ffprobe
    const metadata = probeVideo(videoPath);

    // Clean up audio
    try { await fs.unlink(audioPath); } catch {}

    // STEP 6: Strict duration QA
    const actualDuration = metadata.duration;
    const durationMet = actualDuration >= requestedDuration;

    if (!durationMet) {
      // FAILED — duration requirement not met
      await db.auditLog.create({
        data: {
          actor: "VideoGeneratorAgent",
          action: "video.qa_failed",
          detail: `DURATION_REQUIREMENT_NOT_MET: requested=${requestedDuration}s, actual=${actualDuration.toFixed(1)}s, diff=${(requestedDuration - actualDuration).toFixed(1)}s`,
          severity: "error",
        },
      });

      // Clean up the failed video
      try { await fs.unlink(videoPath); } catch {}

      return {
        data: {
          status: "FAILED",
          errorCode: "DURATION_REQUIREMENT_NOT_MET",
          message: `Duration ${actualDuration.toFixed(1)}s < ${requestedDuration}s. File discarded.`,
          jobId, topic, requestedDuration,
          actualDuration: Math.round(actualDuration * 10) / 10,
          durationDifference: Math.round((requestedDuration - actualDuration) * 10) / 10,
          video: undefined as any,
          audioDuration: undefined as any,
          scenesGenerated: undefined as any,
          sceneTimeline: undefined as any,
        },
        provider: "local",
      };
    }

    // STEP 7: COMPLETED
    return {
      data: {
      status: "COMPLETED",
      errorCode: undefined as any,
      message: undefined as any,
      jobId,
      topic,
      video: {
        filePath: `/storage/videos/${jobId}.mp4`,
        absolutePath: videoPath,
        duration: Math.round(actualDuration * 10) / 10,
        requestedDuration,
        actualDuration: Math.round(actualDuration * 10) / 10,
        durationDifference: Math.round((actualDuration - requestedDuration) * 10) / 10,
        durationQaPassed: true,
        width: metadata.width,
        height: metadata.height,
        fps: metadata.fps,
        videoCodec: metadata.videoCodec,
        audioCodec: metadata.audioCodec,
        audioSampleRate: metadata.audioSampleRate,
        audioChannels: metadata.audioChannels,
        fileSize: metadata.fileSize,
        fileSizeMb: Math.round((metadata.fileSize / 1024 / 1024) * 100) / 100,
        mimeType: metadata.mimeType,
        formatName: metadata.formatName,
      },
      audioDuration: Math.round(audioDuration * 10) / 10,
      scenesGenerated: segments.length,
      sceneTimeline: segments.map((s, i) => ({
        scene: i + 1,
        start: Math.round(s.start * 10) / 10,
        end: Math.round(s.end * 10) / 10,
        duration: Math.round((s.end - s.start) * 10) / 10,
        text: s.text.slice(0, 60),
      })),
      },
      provider: "local",
    };
      } catch (e: any) {
        try { await fs.unlink(audioPath); } catch {}
        try { await fs.unlink(videoPath); } catch {}
        throw e;
      }
    }
  );

  if (agentResult.status === "success") {
    return NextResponse.json({
      ...agentResult.result,
      agentRunId: agentResult.runId,
      agentId: agentResult.agentId,
      agentStatus: agentResult.status,
      auditId: agentResult.auditId,
    });
  } else {
    return NextResponse.json({
      status: "FAILED",
      errorCode: "GENERATION_ERROR",
      jobId, topic,
      error: agentResult.error,
      agentRunId: agentResult.runId,
      agentId: agentResult.agentId,
      auditId: agentResult.auditId,
    }, { status: 500 });
  }
}
