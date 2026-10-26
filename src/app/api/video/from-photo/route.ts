import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fsSync from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { executeAsAgent } from "@/lib/agent-runtime";
import {
  getAudioStorageDir,
  getVideoStorageDir,
} from "@/lib/storage-paths";
import {
  generateProceduralInstrumental,
  resolveFfmpegBinary,
  resolveFfprobeBinary,
  synthesizeLocalSpeech,
  type MusicMood,
} from "@/lib/local-audio";
import {
  ASPECT_PRESETS,
  FREE_PIPELINE_POLICY,
  MOTION_IDS,
  PHOTO_VIDEO_LIMITS,
  QUALITY_PRESETS,
  TRANSITION_IDS,
  assertFreeEngine,
  buildAudioMixPlan,
  buildCaptionCues,
  buildDipToBlackGraph,
  buildMotionFilter,
  buildSrt,
  transitionNeedsXfade,
  buildTimeline,
  buildXfadeFilterComplex,
  evenNumber,
  getAspectPreset,
  getCaptionStyle,
  getQualityPreset,
  getTransitionPreset,
  pickAutoMotion,
  prepareStillSize,
  resolveOutputSize,
  shotFrameCount,
  splitNarration,
  wrapCaption,
  type MotionId,
  type PhotoVideoRenderResult,
  type PhotoVideoShotResult,
  type TransitionId,
} from "@/lib/photo-video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VIDEO_DIR = getVideoStorageDir();
const AUDIO_DIR = getAudioStorageDir();
const WORK_DIR = path.join(process.cwd(), "storage", "photo-video");
const PUBLIC_DIR = path.join(process.cwd(), "public");

const CAPTION_FONT_CANDIDATES = [
  path.join(PUBLIC_DIR, "fonts", "HindSiliguri-Bold.ttf"),
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
];

function resolveCaptionFont(): string | null {
  return CAPTION_FONT_CANDIDATES.find((candidate) => {
    try {
      return fsSync.existsSync(candidate);
    } catch {
      return false;
    }
  }) ?? null;
}

const FFMPEG = resolveFfmpegBinary();
const FFPROBE = resolveFfprobeBinary();

/**
 * Older static FFmpeg builds (Ubuntu 18.04 era) ship without `xfade`. Probe
 * once per process and fall back to fade-to-black joins so a render never dies
 * on a filter that is merely nice-to-have.
 */
let xfadeCapability: boolean | null = null;
function supportsXfade(): boolean {
  if (xfadeCapability !== null) return xfadeCapability;
  try {
    const output = execBinary(FFMPEG, ["-hide_banner", "-filters"], 20_000);
    xfadeCapability = /\bxfade\b/.test(output);
  } catch {
    xfadeCapability = false;
  }
  return xfadeCapability;
}

function execBinary(bin: string, args: string[], timeoutMs = 600_000): string {
  const result = spawnSync(bin, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`${path.basename(bin)} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = String(result.stderr ?? "").trim().slice(-800);
    throw new Error(`${path.basename(bin)} exited ${result.status}: ${stderr || "unknown error"}`);
  }
  return String(result.stdout ?? "").trim();
}

function ffmpeg(args: string[], timeoutMs?: number): string {
  return execBinary(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], timeoutMs);
}

interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  sizeBytes: number;
}

function probe(filePath: string): ProbeResult {
  const json = execBinary(FFPROBE, [
    "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath,
  ]);
  const data = JSON.parse(json) as {
    format?: { duration?: string; size?: string };
    streams?: Array<Record<string, unknown>>;
  };
  const streams = data.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  const [num, den] = String(video?.r_frame_rate ?? "25/1").split("/").map(Number);
  return {
    durationSec: Number.parseFloat(String(data.format?.duration ?? "0")) || 0,
    width: Number(video?.width ?? 0),
    height: Number(video?.height ?? 0),
    fps: den ? Math.round((num / den) * 100) / 100 : 25,
    videoCodec: String(video?.codec_name ?? "none"),
    audioCodec: String(audio?.codec_name ?? "none"),
    sizeBytes: Number.parseInt(String(data.format?.size ?? "0"), 10) || 0,
  };
}

function numeric(value: FormDataEntryValue | null, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function truthy(value: FormDataEntryValue | null, fallback: boolean): boolean {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "on", "yes"].includes(normalized)) return true;
  if (["0", "false", "off", "no"].includes(normalized)) return false;
  return fallback;
}

/** Wrap drawtext text into a textfile so Bengali punctuation needs no escaping. */
function drawtextBlock(input: {
  textFilePath: string;
  fontFile: string;
  fontSize: number;
  boxOpacity: number;
  y: string;
  lineSpacing: number;
}): string {
  const base = [
    `fontfile='${input.fontFile.replace(/\\/g, "/")}'`,
    `textfile='${input.textFilePath.replace(/\\/g, "/")}'`,
    `fontcolor=white`,
    `fontsize=${Math.round(input.fontSize)}`,
    `line_spacing=${input.lineSpacing}`,
    `x=(w-text_w)/2`,
    `y=${input.y}`,
    `shadowcolor=black@0.65`,
    `shadowx=2`,
    `shadowy=2`,
  ];
  if (input.boxOpacity > 0) {
    base.push("box=1", `boxcolor=black@${input.boxOpacity.toFixed(2)}`, "boxborderw=22");
  }
  return `drawtext=${base.join(":")}`;
}

async function writeCaptionFile(dir: string, index: number, text: string, maxChars: number): Promise<string | null> {
  const lines = wrapCaption(text, maxChars, 3);
  if (lines.length === 0) return null;
  const filePath = path.join(dir, `caption_${index}.txt`);
  await writeFile(filePath, lines.join("\n"), "utf8");
  return filePath;
}

interface PreparedSource {
  index: number;
  fileName: string;
  source: "upload" | "generated";
  originalPath: string;
  stillPath: string;
  width: number;
  height: number;
}

const SAFE_LOCAL_IMAGE = /^\/(generated|avatar-scenes|avatars)\/([A-Za-z0-9._-]{1,180})\.(png|jpe?g|webp)$/i;

/** Resolve a same-origin public image path (Image Studio output etc.) safely. */
function resolveLocalImage(publicPath: string): string | null {
  const match = SAFE_LOCAL_IMAGE.exec(publicPath);
  if (!match) return null;
  const resolved = path.join(PUBLIC_DIR, match[1], `${match[2]}.${match[3]}`);
  const relative = path.relative(PUBLIC_DIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return fsSync.existsSync(resolved) ? resolved : null;
}

type ImageFormat = "jpeg" | "png" | "webp" | "gif" | "avif" | "heic";

/**
 * Magic-byte image detection. Deliberately Sharp-free: the production VPS
 * (Intel Core 2 Duo, no SSE4.2) cannot load Sharp's prebuilt binaries, so the
 * whole photo pipeline must run on FFmpeg alone (see
 * tests/image-processing.test.mjs — no module may eagerly import Sharp).
 */
function detectImageFormat(buffer: Buffer): ImageFormat | null {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buffer.length > 3 && buffer.toString("ascii", 0, 3) === "GIF") return "gif";
  if (buffer.length > 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12).trim().toLowerCase();
    if (brand.startsWith("avif") || brand === "avis") return "avif";
    if (["heic", "heix", "heim", "heis", "mif1", "msf1"].includes(brand)) return "heic";
  }
  return null;
}

/**
 * Normalise any uploaded still to a 2× output-size JPEG using FFmpeg only.
 * `force_original_aspect_ratio=increase` + `crop` is the FFmpeg equivalent of
 * `object-fit: cover`, and the 2× source gives zoompan real travel pixels.
 */
async function prepareStill(inputPath: string, outputPath: string, size: { width: number; height: number }) {
  const prepared = prepareStillSize(size);
  ffmpeg([
    "-i", inputPath,
    "-vf", `scale=${prepared.width}:${prepared.height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${prepared.width}:${prepared.height},setsar=1`,
    "-frames:v", "1",
    "-q:v", "2",
    outputPath,
  ], 120_000);
  return prepared;
}

/** Returns the measured duration of a wav file (or 0 when probing fails). */
function durationOf(filePath: string): number {
  try {
    return probe(filePath).durationSec;
  } catch {
    return 0;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/* ------------------------------------------------------------------ */
/* GET — recent photo → video renders                                  */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  try {
    const { ownerId } = await requireOwner();
    const url = new URL(request.url);

    if (url.searchParams.get("images") === "1") {
      const dir = path.join(PUBLIC_DIR, "generated");
      const entries = fsSync.existsSync(dir) ? fsSync.readdirSync(dir) : [];
      const images = entries
        .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
        .map((name) => {
          const full = path.join(dir, name);
          const info = fsSync.statSync(full);
          return { path: `/generated/${name}`, name, sizeBytes: info.size, modifiedAt: info.mtime.toISOString() };
        })
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
        .slice(0, 40);
      return NextResponse.json({ images, aspectPresets: ASPECT_PRESETS, qualityPresets: QUALITY_PRESETS });
    }

    let renders: Array<Record<string, unknown>> = [];
    try {
      const rows = await db.mediaGeneration.findMany({
        where: { stage: "photo_video", status: "passed" },
        orderBy: { createdAt: "desc" },
        take: 24,
      });
      renders = rows.map((row) => {
        let output: Record<string, unknown> = {};
        try {
          output = JSON.parse(row.outputJson ?? "{}");
        } catch {}
        return { id: row.id, createdAt: row.createdAt, provider: row.provider, ...output };
      });
    } catch {
      renders = [];
    }

    const onDisk = fsSync.existsSync(VIDEO_DIR)
      ? fsSync
          .readdirSync(VIDEO_DIR)
          .filter((name) => /^pv_[0-9a-f-]{36}\.json$/i.test(name))
          .map((name) => {
            try {
              return JSON.parse(fsSync.readFileSync(path.join(VIDEO_DIR, name), "utf8")) as Record<string, unknown>;
            } catch {
              return null;
            }
          })
          .filter((value): value is Record<string, unknown> => Boolean(value))
          .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
          .slice(0, 24)
      : [];

    const merged = new Map<string, Record<string, unknown>>();
    for (const render of [...onDisk, ...renders]) {
      const id = String(render.id ?? "");
      if (id && !merged.has(id)) merged.set(id, render);
    }

    return NextResponse.json({
      owner: ownerId,
      renders: Array.from(merged.values()).slice(0, 24),
      policy: FREE_PIPELINE_POLICY,
      limits: PHOTO_VIDEO_LIMITS,
    });
  } catch (error) {
    const status = Number((error as { statusCode?: number }).statusCode ?? 500);
    return NextResponse.json({ error: (error as Error).message }, { status: status === 401 || status === 503 ? status : 500 });
  }
}

/* ------------------------------------------------------------------ */
/* POST — upload photos (+ optional narration/audio) → finished video  */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  const createdAt = new Date().toISOString();
  const id = `pv_${randomUUID()}`;
  const workDir = path.join(WORK_DIR, id);

  let ownerId = "dev-admin";
  try {
    ownerId = (await requireOwner()).ownerId;
  } catch (error) {
    const status = Number((error as { statusCode?: number }).statusCode ?? 401);
    return NextResponse.json({ error: (error as Error).message }, { status: status === 503 ? 503 : 401 });
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "multipart/form-data required (upload photos as files)" }, { status: 415 });
    }

    const form = await request.formData();
    const uploads = form.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const localPaths = String(form.get("imagePaths") ?? "").trim();
    let generatedPaths: string[] = [];
    if (localPaths) {
      try {
        const parsed = JSON.parse(localPaths);
        if (Array.isArray(parsed)) generatedPaths = parsed.filter((value): value is string => typeof value === "string").slice(0, PHOTO_VIDEO_LIMITS.maxImages);
      } catch {
        return NextResponse.json({ error: "imagePaths must be a JSON array of /generated/... paths" }, { status: 400 });
      }
    }

    if (uploads.length + generatedPaths.length === 0) {
      return NextResponse.json({ error: "upload at least one photo (images field) or pass imagePaths" }, { status: 400 });
    }
    if (uploads.length + generatedPaths.length > PHOTO_VIDEO_LIMITS.maxImages) {
      return NextResponse.json({ error: `maximum ${PHOTO_VIDEO_LIMITS.maxImages} photos per render` }, { status: 400 });
    }

    const engineCheck = assertFreeEngine(String(form.get("engine") ?? "local"));
    if (!engineCheck.allowed) {
      return NextResponse.json({ error: engineCheck.message, policy: FREE_PIPELINE_POLICY }, { status: 400 });
    }

    const title = String(form.get("title") ?? "").trim().slice(0, PHOTO_VIDEO_LIMITS.maxTitleChars);
    const narration = String(form.get("narration") ?? "").trim().slice(0, PHOTO_VIDEO_LIMITS.maxNarrationChars);
    const voice = String(form.get("voice") ?? "bn").trim() || "bn";
    const aspectPreset = getAspectPreset(String(form.get("aspect") ?? "vertical"));
    const qualityPreset = getQualityPreset(String(form.get("quality") ?? "standard"));
    const requestedMotion = String(form.get("motion") ?? "kenburns-in");
    const motionMode: MotionId | "auto" = requestedMotion === "auto"
      ? "auto"
      : (MOTION_IDS.includes(requestedMotion as MotionId) ? (requestedMotion as MotionId) : "kenburns-in");
    const transition = (TRANSITION_IDS.includes(String(form.get("transition")) as TransitionId)
      ? String(form.get("transition"))
      : "fade") as TransitionId;
    const transitionSec = numeric(form.get("transitionSec"), PHOTO_VIDEO_LIMITS.defaultTransitionSec, 0, PHOTO_VIDEO_LIMITS.maxTransitionSec);
    const shotSec = numeric(form.get("shotSec"), PHOTO_VIDEO_LIMITS.defaultShotSec, PHOTO_VIDEO_LIMITS.minShotSec, PHOTO_VIDEO_LIMITS.maxShotSec);
    const captionsEnabled = truthy(form.get("captions"), true);
    const captionStyle = getCaptionStyle(String(form.get("captionStyle") ?? "editorial"));
    const musicMoodRaw = String(form.get("music") ?? "hopeful");
    const musicMood: MusicMood | "none" = ["calm", "hopeful", "playful", "reflective"].includes(musicMoodRaw)
      ? (musicMoodRaw as MusicMood)
      : musicMoodRaw === "none"
        ? "none"
        : "hopeful";
    const musicVolume = numeric(form.get("musicVolume"), 0.16, PHOTO_VIDEO_LIMITS.minMusicVolume, PHOTO_VIDEO_LIMITS.maxMusicVolume);
    const uploadedAudio = form.get("audio");
    const audioFile = uploadedAudio instanceof File && uploadedAudio.size > 0 ? uploadedAudio : null;
    const explicitCaptionsRaw = String(form.get("captions_json") ?? "").trim();

    if (audioFile && audioFile.size > PHOTO_VIDEO_LIMITS.maxAudioBytes) {
      return NextResponse.json({ error: `voice track must be under ${Math.round(PHOTO_VIDEO_LIMITS.maxAudioBytes / 1024 / 1024)}MB` }, { status: 413 });
    }

    const outputSize = resolveOutputSize(aspectPreset, qualityPreset);
    await mkdir(workDir, { recursive: true });
    await mkdir(VIDEO_DIR, { recursive: true });

    /* ---------- 1. Save + normalise photos ---------- */
    const sources: PreparedSource[] = [];
    let totalBytes = 0;

    for (let index = 0; index < uploads.length; index++) {
      const file = uploads[index];
      if (file.size > PHOTO_VIDEO_LIMITS.maxImageBytes) {
        return NextResponse.json({ error: `photo ${index + 1} is larger than ${Math.round(PHOTO_VIDEO_LIMITS.maxImageBytes / 1024 / 1024)}MB` }, { status: 413 });
      }
      totalBytes += file.size;
      if (totalBytes > PHOTO_VIDEO_LIMITS.maxTotalUploadBytes) {
        return NextResponse.json({ error: "upload batch too large" }, { status: 413 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const format = detectImageFormat(buffer);
      if (!format) {
        return NextResponse.json({ error: `photo ${index + 1} is not a supported image (jpeg/png/webp/heic/avif/gif)` }, { status: 415 });
      }
      const originalPath = path.join(workDir, `src_${index}.${format === "jpeg" ? "jpg" : format}`);
      await writeFile(originalPath, buffer);
      const stillPath = path.join(workDir, `still_${index}.jpg`);
      let dims: { width: number; height: number };
      try {
        dims = await prepareStill(originalPath, stillPath, outputSize);
      } catch {
        return NextResponse.json(
          {
            error: `photo ${index + 1} could not be decoded (${format})`,
            hint: format === "heic" || format === "avif"
              ? "This FFmpeg build has no HEIF decoder. Export the photo as JPEG/PNG and re-upload."
              : "The file looks corrupt or is not a real image.",
          },
          { status: 415 }
        );
      }
      sources.push({
        index,
        fileName: file.name || `photo-${index + 1}`,
        source: "upload",
        originalPath,
        stillPath,
        width: dims.width,
        height: dims.height,
      });
    }

    for (const publicPath of generatedPaths) {
      const resolved = resolveLocalImage(publicPath);
      if (!resolved) {
        return NextResponse.json({ error: `image path not allowed: ${publicPath}` }, { status: 400 });
      }
      const index = sources.length;
      const stillPath = path.join(workDir, `still_${index}.jpg`);
      let dims: { width: number; height: number };
      try {
        dims = await prepareStill(resolved, stillPath, outputSize);
      } catch {
        return NextResponse.json({ error: `image could not be decoded: ${publicPath}` }, { status: 415 });
      }
      sources.push({
        index,
        fileName: path.basename(resolved),
        source: "generated",
        originalPath: resolved,
        stillPath,
        width: dims.width,
        height: dims.height,
      });
    }

    /* ---------- 2. Narration → per-shot voice + captions ---------- */
    const shotCount = sources.length;
    let captions: string[] = [];
    if (explicitCaptionsRaw) {
      try {
        const parsed = JSON.parse(explicitCaptionsRaw);
        if (Array.isArray(parsed)) captions = parsed.map((value) => String(value ?? "").trim()).slice(0, shotCount);
      } catch {
        captions = [];
      }
    }
    if (captions.length === 0 && narration) {
      captions = splitNarration(narration, shotCount);
    } else if (captions.length > 0 && captions.length < shotCount) {
      while (captions.length < shotCount) captions.push("");
    }
    if (captions.length === 0) captions = Array.from({ length: shotCount }, () => "");

    let voiceEngine: string | null = null;
    const narrationPaths: string[] = [];
    const durations: number[] = [];

    if (!audioFile && narration) {
      for (let index = 0; index < shotCount; index++) {
        const text = captions[index]?.trim();
        if (!text) {
          durations.push(shotSec);
          narrationPaths.push("");
          continue;
        }
        const speechPath = path.join(workDir, `voice_${index}.wav`);
        const result = await synthesizeLocalSpeech(text, speechPath, voice);
        voiceEngine = result.engine;
        const measured = durationOf(speechPath);
        const spoken = measured > 0 ? measured : result.durationSeconds;
        durations.push(clamp(spoken + 0.5, PHOTO_VIDEO_LIMITS.minShotSec, PHOTO_VIDEO_LIMITS.maxShotSec));
        narrationPaths.push(speechPath);
      }
    } else if (audioFile) {
      // Owner supplied a finished voice track: split its length evenly.
      const audioPath = path.join(workDir, "voice_upload.wav");
      const ext = path.extname(audioFile.name || "").toLowerCase();
      const tempInput = path.join(workDir, `voice_upload_input${ext || ".bin"}`);
      await writeFile(tempInput, Buffer.from(await audioFile.arrayBuffer()));
      ffmpeg(["-i", tempInput, "-vn", "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le", audioPath], 120_000);
      const audioDuration = durationOf(audioPath);
      if (!(audioDuration > 0)) {
        return NextResponse.json({ error: "uploaded voice track could not be decoded" }, { status: 415 });
      }
      const perShot = clamp(audioDuration / shotCount, PHOTO_VIDEO_LIMITS.minShotSec, PHOTO_VIDEO_LIMITS.maxShotSec);
      for (let index = 0; index < shotCount; index++) durations.push(perShot);
      voiceEngine = "owner-upload";
      narrationPaths.push(audioPath);
    } else {
      for (let index = 0; index < shotCount; index++) durations.push(shotSec);
    }

    /* ---------- 3. Timeline + captions ---------- */
    const useXfade = transitionNeedsXfade(shotCount, transition, transitionSec) && supportsXfade();
    const effectiveTransitionSec = useXfade ? transitionSec : 0;
    const timeline = buildTimeline(durations, effectiveTransitionSec);
    const cues = captionsEnabled ? buildCaptionCues(timeline.shots, captions) : [];
    const srtPath = cues.length > 0 ? path.join(VIDEO_DIR, `${id}.srt`) : null;
    if (srtPath) await writeFile(srtPath, buildSrt(cues), "utf8");

    const fontFile = captionsEnabled ? resolveCaptionFont() : null;

    /* ---------- 4. Per-shot motion clips ---------- */
    const clipPaths: string[] = [];
    const shotResults: PhotoVideoShotResult[] = [];

    for (let index = 0; index < shotCount; index++) {
      const source = sources[index];
      const shot = timeline.shots[index];
      const motion: MotionId = motionMode === "auto" ? pickAutoMotion(index) : motionMode;
      const frames = shotFrameCount(shot.durationSec, qualityPreset.fps);
      const filters = [buildMotionFilter({
        motion,
        width: outputSize.width,
        height: outputSize.height,
        fps: qualityPreset.fps,
        seconds: shot.durationSec,
      }), "format=yuv420p"];

      if (fontFile) {
        const captionFile = await writeCaptionFile(workDir, index, captions[index] ?? "", Math.max(14, Math.round(outputSize.width / 26)));
        if (captionFile) {
          filters.push(drawtextBlock({
            textFilePath: captionFile,
            fontFile,
            fontSize: outputSize.width / captionStyle.fontSizeRatio,
            boxOpacity: captionStyle.boxOpacity,
            y: "h-th-64",
            lineSpacing: Math.round(outputSize.width / 70),
          }));
        }
        if (index === 0 && title) {
          const titleFile = path.join(workDir, "title.txt");
          await writeFile(titleFile, wrapCaption(title, 30, 2).join("\n"), "utf8");
          filters.push(drawtextBlock({
            textFilePath: titleFile,
            fontFile,
            fontSize: outputSize.width / 17,
            boxOpacity: 0.5,
            y: "64",
            lineSpacing: Math.round(outputSize.width / 60),
          }));
        }
      }

      const clipPath = path.join(workDir, `clip_${index}.mp4`);
      ffmpeg([
        "-i", source.stillPath,
        "-vf", filters.join(","),
        "-frames:v", String(frames),
        "-an",
        "-c:v", "libx264",
        "-preset", qualityPreset.preset,
        "-crf", String(qualityPreset.crf),
        "-pix_fmt", "yuv420p",
        "-r", String(qualityPreset.fps),
        clipPath,
      ]);

      clipPaths.push(clipPath);
      shotResults.push({
        index,
        caption: captions[index] ?? "",
        startSec: shot.startSec,
        endSec: shot.endSec,
        durationSec: shot.durationSec,
        motion,
      });
    }

    /* ---------- 5. Join shots (xfade / concat) → silent master ---------- */
    const silentPath = path.join(workDir, "picture.mp4");
    const graph = useXfade
      ? buildXfadeFilterComplex(durations, transition, transitionSec)
      : transitionNeedsXfade(shotCount, transition, transitionSec)
        ? buildDipToBlackGraph(durations, transitionSec, "vout", qualityPreset.fps)
        : buildXfadeFilterComplex(durations, "none", 0);
    const inputArgs = clipPaths.flatMap((clip) => ["-i", clip]);
    ffmpeg([
      ...inputArgs,
      "-filter_complex", graph.filterComplex,
      "-map", graph.outputLabel,
      "-an",
      "-c:v", "libx264",
      "-preset", qualityPreset.preset,
      "-crf", String(qualityPreset.crf),
      "-pix_fmt", "yuv420p",
      "-r", String(qualityPreset.fps),
      silentPath,
    ]);

    const pictureProbe = probe(silentPath);
    if (!pictureProbe.width || !pictureProbe.durationSec) {
      throw new Error("picture track failed validation");
    }
    const totalDurationSec = pictureProbe.durationSec;

    /* ---------- 6. Audio bed ---------- */
    await mkdir(AUDIO_DIR, { recursive: true });
    const audioInputs: string[][] = [];
    let hasNarration = false;

    if (narrationPaths.length === 1) {
      audioInputs.push(["-i", narrationPaths[0]]);
      hasNarration = true;
    } else if (narrationPaths.length > 1) {
      // Pad every shot's voice to its exact shot length, then concatenate.
      const padded: string[] = [];
      for (let index = 0; index < narrationPaths.length; index++) {
        if (!narrationPaths[index]) continue;
        const paddedPath = path.join(workDir, `voice_pad_${index}.wav`);
        ffmpeg([
          "-i", narrationPaths[index],
          "-af", `apad,atrim=0:${timeline.shots[index].durationSec.toFixed(3)}`,
          "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le",
          paddedPath,
        ], 120_000);
        padded.push(paddedPath);
      }
      if (padded.length === 1) {
        audioInputs.push(["-i", padded[0]]);
        hasNarration = true;
      } else if (padded.length > 1) {
        const concatInputs = padded.flatMap((clip) => ["-i", clip]);
        const concatFilter = `${padded.map((_, index) => `[${index}:a]`).join("")}concat=n=${padded.length}:v=0:a=1[voiceout]`;
        const voicePath = path.join(workDir, "voice_full.wav");
        ffmpeg([...concatInputs, "-filter_complex", concatFilter, "-map", "[voiceout]", "-c:a", "pcm_s16le", voicePath], 180_000);
        audioInputs.push(["-i", voicePath]);
        hasNarration = true;
      }
    }

    let musicEngine: string | null = null;
    if (musicMood !== "none") {
      const musicPath = path.join(workDir, "music.wav");
      const musicDuration = Math.min(90, Math.max(10, Math.ceil(totalDurationSec)));
      try {
        const music = await generateProceduralInstrumental(musicPath, {
          durationSeconds: musicDuration,
          mood: musicMood as MusicMood,
          seed: `${id}:${musicMood}`,
        });
        musicEngine = music.generator;
        audioInputs.push(["-stream_loop", "-1", "-i", musicPath]);
      } catch {
        musicEngine = null;
      }
    }

    const mixPlan = buildAudioMixPlan({
      hasNarration,
      hasMusic: Boolean(musicEngine),
      totalDurationSec,
      musicVolume,
      narrationVolume: 1,
      fadeOutSec: 1.2,
    });

    /* ---------- 7. Final mux ---------- */
    const finalMp4 = path.join(VIDEO_DIR, `${id}.mp4`);
    const audioArgs = mixPlan.inputs.includes("silence")
      ? ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]
      : audioInputs.flat();

    // Audio inputs come first so `[0:a]`, `[1:a]` in the mix plan line up; the
    // picture track is appended last and mapped explicitly.
    const pictureIndex = mixPlan.inputs.includes("silence") ? 1 : audioInputs.length;
    const muxArgs: string[] = [
      ...audioArgs,
      "-i", silentPath,
      "-filter_complex", mixPlan.filterComplex,
      "-map", `${pictureIndex}:v`,
      "-map", mixPlan.outputLabel,
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "160k",
      "-ar", "44100",
      "-ac", "2",
      "-shortest",
      "-movflags", "+faststart",
      finalMp4,
    ];
    ffmpeg(muxArgs);

    const finalProbe = probe(finalMp4);
    if (!finalProbe.width || finalProbe.audioCodec === "none" || finalProbe.durationSec < 0.5) {
      throw new Error(`output validation failed (video=${finalProbe.videoCodec} audio=${finalProbe.audioCodec} duration=${finalProbe.durationSec})`);
    }

    /* ---------- 8. Thumbnail ---------- */
    const thumbPath = path.join(VIDEO_DIR, `${id}.jpg`);
    try {
      ffmpeg(["-ss", "1", "-i", finalMp4, "-frames:v", "1", "-vf", `scale=${Math.round(outputSize.width / 2)}:-2`, thumbPath], 60_000);
    } catch {
      await rm(thumbPath, { force: true }).catch(() => {});
      try {
        const prepared = prepareStillSize(outputSize);
        ffmpeg(["-i", sources[0].stillPath, "-vf", `scale=${prepared.width}:${prepared.height}:flags=lanczos`, "-frames:v", "1", "-q:v", "4", thumbPath], 60_000);
      } catch {
        // Gallery falls back to the player when no thumbnail can be extracted.
      }
    }

    /* ---------- 9. Result + persistence ---------- */
    const result: PhotoVideoRenderResult = {
      ok: true,
      id,
      videoUrl: `/api/media/video/${id}`,
      srtUrl: srtPath ? `/api/media/subtitle/${id}` : null,
      thumbnailUrl: fsSync.existsSync(thumbPath) ? `/api/media/thumbnail/${id}` : "",
      posterUrl: `/api/media/video/${id}`,
      durationSec: Math.round(finalProbe.durationSec * 100) / 100,
      width: finalProbe.width,
      height: finalProbe.height,
      fps: finalProbe.fps,
      sizeBytes: finalProbe.sizeBytes,
      aspect: aspectPreset.id,
      quality: qualityPreset.id,
      shots: shotResults,
      sources: sources.map((source) => ({ index: source.index, fileName: source.fileName, source: source.source })),
      voiceEngine,
      musicEngine,
      captionsBurned: Boolean(fontFile) && cues.length > 0,
      policy: FREE_PIPELINE_POLICY,
      agentRunId: null,
      agentStatus: "local-render-complete",
      createdAt,
    };

    // Disk manifest keeps the gallery working even without a database.
    await writeFile(path.join(VIDEO_DIR, `${id}.json`), JSON.stringify(result, null, 2), "utf8");

    let agentRunId: string | null = null;
    let agentStatus = "local-render-complete";
    try {
      const agent = await executeAsAgent<PhotoVideoRenderResult>(
        {
          agentId: "video_generator",
          task: `Photo → video: ${shotCount} photo(s), ${result.durationSec}s ${aspectPreset.label}`,
          input: {
            photos: shotCount,
            narrationChars: narration.length,
            voice: voiceEngine,
            music: musicEngine,
            aspect: aspectPreset.id,
            quality: qualityPreset.id,
            captions: result.captionsBurned,
          },
          tools: ["ffmpeg", "local-tts", "procedural-music"],
          requiresApproval: false,
        },
        async () => ({
          data: result,
          provider: "local-ffmpeg-free",
          error: undefined,
          usedFallback: false,
        })
      );
      agentRunId = agent.runId;
      agentStatus = agent.status;
      result.agentRunId = agent.runId;
      result.agentStatus = agent.status;
      await writeFile(path.join(VIDEO_DIR, `${id}.json`), JSON.stringify(result, null, 2), "utf8");
    } catch {
      agentStatus = "local-render-complete (agent log skipped)";
    }

    try {
      await db.mediaGeneration.create({
        data: {
          stage: "photo_video",
          provider: "local-ffmpeg-free",
          status: "passed",
          qualityScore: result.captionsBurned ? 0.92 : 0.86,
          identityScore: 1,
          inputJson: JSON.stringify({
            ownerId,
            photos: shotCount,
            title,
            aspect: aspectPreset.id,
            quality: qualityPreset.id,
            motion: motionMode,
            transition,
            music: musicMood,
            voice,
            narrationChars: narration.length,
            source: audioFile ? "owner-upload" : narration ? "local-tts" : "none",
          }).slice(0, 4000),
          outputJson: JSON.stringify(result).slice(0, 12000),
        },
      });
    } catch {
      // Database unavailable — the on-disk manifest is the source of truth.
    }

    await rm(workDir, { recursive: true, force: true }).catch(() => {});

    return NextResponse.json({ ...result, owner: ownerId, engineGuard: engineCheck });
  } catch (error) {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        error: "photo_video_render_failed",
        detail: message.slice(0, 900),
        hint:
          "The renderer needs ffmpeg/ffprobe on the server. Run `node scripts/verify-media-pipeline.mjs` to check the media toolchain.",
        policy: FREE_PIPELINE_POLICY,
      },
      { status: 500 }
    );
  }
}
