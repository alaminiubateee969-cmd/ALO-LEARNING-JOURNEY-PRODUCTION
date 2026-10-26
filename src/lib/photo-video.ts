/**
 * ALO Photo → Video Studio — pure planning engine.
 *
 * Everything in this module is deterministic and dependency-free so it can be
 * imported by both the browser (presets, timeline maths) and the Node route
 * handler (FFmpeg graph construction). No FFmpeg call happens here: the route
 * handler executes the graph returned by `buildClipVideoFilter` /
 * `buildXfadeFilterComplex`.
 *
 * FREE-ONLY CONTRACT
 * ------------------
 * The whole pipeline (still-image motion, local TTS, procedural music, H.264
 * encode) runs on the server's own binaries. No paid model, gateway or hosted
 * render farm is ever contacted. `FREE_PIPELINE_POLICY` below is the single
 * source of truth that the route returns to the UI and that tests assert on.
 */

export type AspectPresetId = "vertical" | "portrait" | "square" | "landscape" | "wide";

export interface AspectPreset {
  id: AspectPresetId;
  label: string;
  labelBn: string;
  width: number;
  height: number;
  /** Where the output is normally published. */
  use: string;
}

export const ASPECT_PRESETS: AspectPreset[] = [
  { id: "vertical", label: "9:16 Vertical", labelBn: "৯:১৬ ভার্টিক্যাল", width: 1080, height: 1920, use: "Reels / Shorts / TikTok" },
  { id: "portrait", label: "4:5 Portrait", labelBn: "৪:৫ পোর্ট্রেট", width: 1080, height: 1350, use: "Instagram feed" },
  { id: "square", label: "1:1 Square", labelBn: "১:১ স্কয়ার", width: 1080, height: 1080, use: "Facebook feed / carousel" },
  { id: "landscape", label: "16:9 Landscape", labelBn: "১৬:৯ ল্যান্ডস্কেপ", width: 1920, height: 1080, use: "YouTube / website" },
  { id: "wide", label: "21:9 Cinematic", labelBn: "২১:৯ সিনেমাটিক", width: 1920, height: 824, use: "Cinematic banner" },
];

export function getAspectPreset(id: string | null | undefined): AspectPreset {
  return ASPECT_PRESETS.find((preset) => preset.id === id) ?? ASPECT_PRESETS[0];
}

export type MotionId =
  | "kenburns-in"
  | "kenburns-out"
  | "pan-left"
  | "pan-right"
  | "tilt-up"
  | "tilt-down"
  | "orbit"
  | "static";

export interface MotionPreset {
  id: MotionId;
  label: string;
  labelBn: string;
  desc: string;
}

export const MOTION_PRESETS: MotionPreset[] = [
  { id: "kenburns-in", label: "Ken Burns — push in", labelBn: "ধীরে কাছে আসা", desc: "Slow zoom into the subject. The safest choice for portraits." },
  { id: "kenburns-out", label: "Ken Burns — pull out", labelBn: "ধীরে দূরে যাওয়া", desc: "Starts close, reveals the whole photo. Great for establishing shots." },
  { id: "pan-left", label: "Pan left", labelBn: "বাঁয়ে প্যান", desc: "Camera travels left across the image with a slight zoom." },
  { id: "pan-right", label: "Pan right", labelBn: "ডানে প্যান", desc: "Camera travels right across the image with a slight zoom." },
  { id: "tilt-up", label: "Tilt up", labelBn: "উপরে টিল্ট", desc: "Reveals from bottom to top — good for tall shots and buildings." },
  { id: "tilt-down", label: "Tilt down", labelBn: "নিচে টিল্ট", desc: "Reveals from top to bottom — good for faces and details." },
  { id: "orbit", label: "Soft orbit", labelBn: "সফট অরবিট", desc: "Diagonal drift with a gentle zoom — the most cinematic motion." },
  { id: "static", label: "Still", labelBn: "স্থির", desc: "No camera motion. Use when motion would distract from a caption." },
];

export const MOTION_IDS = MOTION_PRESETS.map((motion) => motion.id);

export function getMotionPreset(id: string | null | undefined): MotionPreset {
  return MOTION_PRESETS.find((motion) => motion.id === id) ?? MOTION_PRESETS[0];
}

/** Deterministic motion rotation used when the owner picks "auto". */
export const AUTO_MOTION_ORDER: MotionId[] = [
  "kenburns-in",
  "pan-right",
  "kenburns-out",
  "tilt-up",
  "orbit",
  "pan-left",
  "tilt-down",
  "kenburns-in",
];

export function pickAutoMotion(shotIndex: number): MotionId {
  const safeIndex = Math.max(0, Math.trunc(shotIndex));
  return AUTO_MOTION_ORDER[safeIndex % AUTO_MOTION_ORDER.length];
}

export type TransitionId =
  | "fade"
  | "dissolve"
  | "slideleft"
  | "slideright"
  | "wipeleft"
  | "circleopen"
  | "smoothleft"
  | "none";

export interface TransitionPreset {
  id: TransitionId;
  label: string;
  labelBn: string;
}

export const TRANSITION_PRESETS: TransitionPreset[] = [
  { id: "fade", label: "Cross fade", labelBn: "ক্রস ফেড" },
  { id: "dissolve", label: "Dissolve", labelBn: "ডিসলভ" },
  { id: "slideleft", label: "Slide left", labelBn: "স্লাইড বাঁ" },
  { id: "slideright", label: "Slide right", labelBn: "স্লাইড ডান" },
  { id: "wipeleft", label: "Wipe", labelBn: "ওয়াইপ" },
  { id: "circleopen", label: "Circle open", labelBn: "সার্কেল" },
  { id: "smoothleft", label: "Smooth", labelBn: "স্মুথ" },
  { id: "none", label: "Hard cut", labelBn: "হার্ড কাট" },
];

export const TRANSITION_IDS = TRANSITION_PRESETS.map((transition) => transition.id);

export function getTransitionPreset(id: string | null | undefined): TransitionPreset {
  return TRANSITION_PRESETS.find((transition) => transition.id === id) ?? TRANSITION_PRESETS[0];
}

/**
 * xfade transition names shipped by FFmpeg. `none` is handled by the caller as
 * a hard concat (no xfade filter is emitted at all).
 */
export const XFADE_NAMES: Record<Exclude<TransitionId, "none">, string> = {
  fade: "fade",
  dissolve: "dissolve",
  slideleft: "slideleft",
  slideright: "slideright",
  wipeleft: "wipeleft",
  circleopen: "circleopen",
  smoothleft: "smoothleft",
};

export type QualityId = "draft" | "standard" | "hd";

export interface QualityPreset {
  id: QualityId;
  label: string;
  scale: number;
  crf: number;
  preset: string;
  fps: number;
}

export const QUALITY_PRESETS: QualityPreset[] = [
  { id: "draft", label: "Draft (fast preview)", scale: 0.66, crf: 26, preset: "veryfast", fps: 25 },
  { id: "standard", label: "Standard (publish ready)", scale: 1, crf: 22, preset: "medium", fps: 25 },
  { id: "hd", label: "HD (slower, cleaner)", scale: 1, crf: 19, preset: "slow", fps: 30 },
];

export function getQualityPreset(id: string | null | undefined): QualityPreset {
  return QUALITY_PRESETS.find((quality) => quality.id === id) ?? QUALITY_PRESETS[1];
}

export interface CaptionStyle {
  id: "editorial" | "bold" | "minimal";
  label: string;
  fontSizeRatio: number;
  boxOpacity: number;
  fontColor: string;
}

export const CAPTION_STYLES: CaptionStyle[] = [
  { id: "editorial", label: "Editorial (soft plate)", fontSizeRatio: 24, boxOpacity: 0.46, fontColor: "white" },
  { id: "bold", label: "Bold (high contrast)", fontSizeRatio: 20, boxOpacity: 0.72, fontColor: "white" },
  { id: "minimal", label: "Minimal (shadow only)", fontSizeRatio: 26, boxOpacity: 0, fontColor: "white" },
];

export function getCaptionStyle(id: string | null | undefined): CaptionStyle {
  return CAPTION_STYLES.find((style) => style.id === id) ?? CAPTION_STYLES[0];
}

export const PHOTO_VIDEO_LIMITS = {
  minImages: 1,
  maxImages: 12,
  maxImageBytes: 15 * 1024 * 1024,
  maxImagePixels: 60_000_000,
  maxAudioBytes: 25 * 1024 * 1024,
  maxTotalUploadBytes: 120 * 1024 * 1024,
  maxNarrationChars: 4000,
  maxTitleChars: 120,
  minShotSec: 1.5,
  maxShotSec: 12,
  defaultShotSec: 4,
  maxTransitionSec: 1.2,
  defaultTransitionSec: 0.6,
  minMusicVolume: 0,
  maxMusicVolume: 0.5,
  maxShots: 40,
} as const;

export const PHOTO_VIDEO_DEFAULTS = {
  aspect: "vertical" as AspectPresetId,
  motion: "kenburns-in" as MotionId,
  transition: "fade" as TransitionId,
  transitionSec: PHOTO_VIDEO_LIMITS.defaultTransitionSec,
  shotSec: PHOTO_VIDEO_LIMITS.defaultShotSec,
  quality: "standard" as QualityId,
  captions: true,
  captionStyle: "editorial" as CaptionStyle["id"],
  music: "hopeful" as MusicMoodId | "none",
  musicVolume: 0.16,
  voice: "bn",
} as const;

export type MusicMoodId = "calm" | "hopeful" | "playful" | "reflective";

export const MUSIC_MOODS: { id: MusicMoodId | "none"; label: string; labelBn: string }[] = [
  { id: "none", label: "No music (voice only)", labelBn: "মিউজিক ছাড়া" },
  { id: "calm", label: "Calm", labelBn: "শান্ত" },
  { id: "hopeful", label: "Hopeful", labelBn: "আশাবাদী" },
  { id: "playful", label: "Playful", labelBn: "খেলাধুলার" },
  { id: "reflective", label: "Reflective", labelBn: "ভাবুক" },
];

export function evenNumber(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

export interface OutputSize {
  width: number;
  height: number;
}

/** Output pixel size for an aspect ratio + quality preset (always even). */
export function resolveOutputSize(aspect: AspectPreset, quality: QualityPreset): OutputSize {
  return {
    width: evenNumber(aspect.width * quality.scale),
    height: evenNumber(aspect.height * quality.scale),
  };
}

/* ------------------------------------------------------------------ */
/* Motion (Ken Burns / pan / tilt) filter construction                 */
/* ------------------------------------------------------------------ */

export interface MotionFilterInput {
  motion: MotionId;
  width: number;
  height: number;
  fps: number;
  seconds: number;
}

function clampSeconds(seconds: number): number {
  return Math.min(PHOTO_VIDEO_LIMITS.maxShotSec + 6, Math.max(0.5, seconds));
}

/**
 * Build the FFmpeg `zoompan` filter for a still image.
 *
 * The prepared source image is already 2× the output size (see
 * `prepareStillImage`), which gives the pan/zoom window real pixels to travel
 * over and removes the shimmer a 1× source produces.
 *
 * `d=<frames>` plus a single input frame means FFmpeg emits exactly `frames`
 * output frames, so `on / (frames - 1)` is a clean 0→1 progress ramp.
 */
export function buildMotionFilter(input: MotionFilterInput): string {
  const { motion, width, height, fps, seconds } = input;
  const totalFrames = Math.max(2, Math.round(clampSeconds(seconds) * Math.max(12, fps)));
  const progress = `(on/${totalFrames - 1})`;
  const cx = "iw/2-(iw/zoom/2)";
  const cy = "ih/2-(ih/zoom/2)";
  const maxX = "(iw-iw/zoom)";
  const maxY = "(ih-ih/zoom)";

  let zoomExpr = "1.0";
  let xExpr = cx;
  let yExpr = cy;

  switch (motion) {
    case "kenburns-in":
      zoomExpr = `min(1+0.16*${progress},1.16)`;
      break;
    case "kenburns-out":
      zoomExpr = `max(1.16-0.16*${progress},1.0)`;
      break;
    case "pan-left":
      zoomExpr = "1.14";
      xExpr = `${maxX}*(1-${progress})`;
      break;
    case "pan-right":
      zoomExpr = "1.14";
      xExpr = `${maxX}*${progress}`;
      break;
    case "tilt-up":
      zoomExpr = "1.14";
      yExpr = `${maxY}*(1-${progress})`;
      break;
    case "tilt-down":
      zoomExpr = "1.14";
      yExpr = `${maxY}*${progress}`;
      break;
    case "orbit":
      zoomExpr = `min(1.06+0.10*${progress},1.16)`;
      xExpr = `${maxX}*(0.5-0.32*${progress})`;
      yExpr = `${maxY}*(0.5-0.22*${progress})`;
      break;
    case "static":
    default:
      zoomExpr = "1.0";
      break;
  }

  return [
    `zoompan=z='${zoomExpr}'`,
    `x='${xExpr}'`,
    `y='${yExpr}'`,
    `d=${totalFrames}`,
    `s=${width}x${height}`,
    `fps=${fps}`,
  ].join(":");
}

/** Number of frames FFmpeg will emit for one shot. */
export function shotFrameCount(seconds: number, fps: number): number {
  return Math.max(2, Math.round(clampSeconds(seconds) * Math.max(12, fps)));
}

/** Source size handed to FFmpeg for motion headroom (2× output). */
export function prepareStillSize(size: OutputSize): OutputSize {
  return { width: evenNumber(size.width * 2), height: evenNumber(size.height * 2) };
}

/* ------------------------------------------------------------------ */
/* Timeline + transition graph                                         */
/* ------------------------------------------------------------------ */

export interface TimelineShot {
  index: number;
  durationSec: number;
  startSec: number;
  endSec: number;
}

export interface Timeline {
  shots: TimelineShot[];
  totalDurationSec: number;
  transitionSec: number;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Absolute placement of every shot once overlapping xfade transitions are
 * accounted for. Shot `n` starts `transitionSec` before shot `n-1` ends.
 */
export function buildTimeline(durations: number[], transitionSec: number): Timeline {
  if (durations.length === 0) {
    return { shots: [], totalDurationSec: 0, transitionSec: 0 };
  }
  const shortest = Math.min(...durations);
  // A transition can never consume more than 45% of the shortest neighbour.
  const trans = Math.max(0, Math.min(transitionSec, PHOTO_VIDEO_LIMITS.maxTransitionSec, shortest * 0.45));

  const shots: TimelineShot[] = [];
  let cursor = 0;
  durations.forEach((duration, index) => {
    const durationSec = Math.max(0.2, duration);
    const startSec = cursor;
    const endSec = startSec + durationSec;
    shots.push({ index, durationSec: round3(durationSec), startSec: round3(startSec), endSec: round3(endSec) });
    cursor = endSec - trans;
  });

  return { shots, totalDurationSec: round3(cursor + trans), transitionSec: round3(trans) };
}

export interface XfadeGraph {
  filterComplex: string;
  outputLabel: string;
  offsets: number[];
}

/**
 * Chain of `xfade` filters joining N prepared clips.
 *
 * offset(k) = sum(d0..d(k-1)) − k·t, which is exactly the length of the
 * accumulated stream minus one transition.
 */
export function buildXfadeFilterComplex(
  durations: number[],
  transition: TransitionId,
  transitionSec: number,
  outputLabel = "vout"
): XfadeGraph {
  const clips = durations.length;
  if (clips === 0) return { filterComplex: "", outputLabel: "[0:v]", offsets: [] };

  const trans = Math.max(0, transitionSec);
  if (clips === 1 || transition === "none" || trans === 0) {
    // Hard cut: concat keeps the exact per-shot durations.
    const inputs = durations.map((_, index) => `[${index}:v]`).join("");
    return {
      filterComplex: `${inputs}concat=n=${clips}:v=1:a=0[${outputLabel}]`,
      outputLabel: `[${outputLabel}]`,
      offsets: [],
    };
  }

  const pieces: string[] = [];
  const offsets: number[] = [];
  let currentLabel = "0:v";
  let accumulated = durations[0];

  for (let index = 1; index < clips; index++) {
    const offset = round3(Math.max(0, accumulated - trans));
    offsets.push(offset);
    const nextLabel = index === clips - 1 ? outputLabel : `vx${index}`;
    pieces.push(
      `[${currentLabel}][${index}:v]xfade=transition=${XFADE_NAMES[transition as Exclude<TransitionId, "none">]}:duration=${round3(trans)}:offset=${offset}[${nextLabel}]`
    );
    currentLabel = nextLabel;
    accumulated = accumulated + durations[index] - trans;
  }

  return { filterComplex: pieces.join(";"), outputLabel: `[${outputLabel}]`, offsets };
}

/**
 * Fallback join for FFmpeg builds without `xfade` (Ubuntu 18.04-era static
 * builds, some Windows binaries). Each clip fades in from and out to black and
 * the clips are concatenated — a "dip to black" transition that reads as
 * intentional and needs only the ancient, universally available `fade` filter.
 */
export function buildDipToBlackGraph(
  durations: number[],
  transitionSec: number,
  outputLabel = "vout",
  fps = 25
): { filterComplex: string; outputLabel: string } {
  const clips = durations.length;
  if (clips === 0) return { filterComplex: "", outputLabel: "[0:v]" };
  const dip = Math.max(0.12, Math.min(0.9, transitionSec || 0.45));

  const chains = durations.map((duration, index) => {
    const fadeOutStart = Math.max(0, duration - dip);
    return `[${index}:v]fade=t=in:st=0:d=${round3(dip)},fade=t=out:st=${round3(fadeOutStart)}:d=${round3(dip)},fps=${fps},format=yuv420p[v${index}]`;
  });
  const inputs = durations.map((_, index) => `[v${index}]`).join("");
  chains.push(`${inputs}concat=n=${clips}:v=1:a=0[${outputLabel}]`);
  return { filterComplex: chains.join(";"), outputLabel: `[${outputLabel}]` };
}

/** True when the graph produced by `buildXfadeFilterComplex` actually joins clips. */
export function transitionNeedsXfade(count: number, transition: TransitionId, transitionSec: number): boolean {
  return count > 1 && transition !== "none" && transitionSec > 0;
}

/* ------------------------------------------------------------------ */
/* Narration + captions                                                */
/* ------------------------------------------------------------------ */

const SENTENCE_SPLIT = /(?<=[.!?।॥…])\s+/u;

/**
 * Split a narration block into exactly `count` caption/voice chunks.
 *
 * Strategy: sentence-aware split first, then balance by character weight so
 * every shot receives roughly the same amount of speech. Never returns empty
 * strings, and always returns `count` entries when the text is non-empty.
 */
export function splitNarration(text: string, count: number): string[] {
  const target = Math.max(1, Math.trunc(count));
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return Array.from({ length: target }, () => "");

  // Explicit per-shot lines win: owner wrote one line per photo.
  const explicit = clean.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (explicit.length === target) return explicit;
  if (explicit.length > 1 && explicit.length < target) {
    return balanceChunks(explicit, target);
  }
  if (explicit.length > target) {
    return balanceChunks(explicit.flatMap((line) => line.split(SENTENCE_SPLIT).filter(Boolean)), target);
  }

  const sentences = clean.split(SENTENCE_SPLIT).map((s) => s.trim()).filter(Boolean);
  if (sentences.length === 1) {
    const words = sentences[0].split(/\s+/).filter(Boolean);
    return balanceChunks(words, target).map((chunk) => chunk.trim());
  }
  return balanceChunks(sentences, target);
}

/**
 * Greedy balancing of ordered fragments into `count` contiguous groups whose
 * character weights are as close as possible.
 */
export function balanceChunks(fragments: string[], count: number): string[] {
  const target = Math.max(1, Math.trunc(count));
  const items = fragments.filter((fragment) => fragment != null);
  if (items.length === 0) return Array.from({ length: target }, () => "");
  if (target === 1) return [items.join(" ")];
  if (items.length <= target) {
    const out = items.slice();
    while (out.length < target) out.push("");
    return out;
  }

  const weights = items.map((item) => Math.max(1, item.length));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const perGroup = total / target;

  const groups: string[] = [];
  let current: string[] = [];
  let currentWeight = 0;
  const remainingGroups = () => target - groups.length;

  for (let index = 0; index < items.length; index++) {
    const weight = weights[index];
    const itemsLeft = items.length - index;
    const mustFill = remainingGroups() >= itemsLeft;
    if (
      current.length > 0 &&
      (currentWeight + weight / 2 > perGroup || mustFill)
    ) {
      groups.push(current.join(" "));
      current = [];
      currentWeight = 0;
    }
    current.push(items[index]);
    currentWeight += weight;
  }
  if (current.length > 0) groups.push(current.join(" "));

  while (groups.length < target) groups.push("");
  if (groups.length > target) {
    // Merge overflow into the final group so no text is lost.
    const head = groups.slice(0, target - 1);
    const tail = groups.slice(target - 1).join(" ");
    return [...head, tail];
  }
  return groups;
}

/**
 * Wrap one caption into lines of at most `maxChars` characters without
 * breaking Bengali conjuncts awkwardly (we break on whitespace only, and fall
 * back to hard slicing for very long unspaced text).
 */
export function wrapCaption(text: string, maxChars = 26, maxLines = 3): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;
  const head = lines.slice(0, maxLines - 1);
  const tail = lines.slice(maxLines - 1).join(" ");
  head.push(tail.length > maxChars ? `${tail.slice(0, maxChars - 1)}…` : tail);
  return head;
}

export interface CaptionCue {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
}

export function buildCaptionCues(shots: TimelineShot[], captions: string[]): CaptionCue[] {
  return shots
    .map((shot, index) => ({
      index: index + 1,
      startSec: shot.startSec,
      endSec: shot.endSec,
      text: (captions[index] ?? "").replace(/\s+/g, " ").trim(),
    }))
    .filter((cue) => cue.text.length > 0);
}

export function formatSrtTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const millis = Math.round((safe - Math.floor(safe)) * 1000);
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(millis % 1000, 3)}`;
}

export function buildSrt(cues: CaptionCue[]): string {
  return cues
    .map((cue, index) => `${index + 1}\n${formatSrtTime(cue.startSec)} --> ${formatSrtTime(cue.endSec)}\n${cue.text}\n`)
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Audio mix planning                                                  */
/* ------------------------------------------------------------------ */

export interface AudioPlanInput {
  hasNarration: boolean;
  hasMusic: boolean;
  totalDurationSec: number;
  musicVolume: number;
  narrationVolume?: number;
  fadeOutSec?: number;
}

export interface AudioMixPlan {
  inputs: ("narration" | "music" | "silence")[];
  filterComplex: string;
  outputLabel: string;
}

/**
 * Build the final audio mix graph used when muxing the silent picture track.
 * `[0:a]`/`[1:a]` input order matches `AudioMixPlan.inputs`.
 */
export function buildAudioMixPlan(input: AudioPlanInput): AudioMixPlan {
  const inputs: ("narration" | "music" | "silence")[] = [];
  if (input.hasNarration) inputs.push("narration");
  if (input.hasMusic) inputs.push("music");
  if (inputs.length === 0) inputs.push("silence");

  const narrationVolume = Math.min(2, Math.max(0, input.narrationVolume ?? 1));
  const musicVolume = Math.min(PHOTO_VIDEO_LIMITS.maxMusicVolume, Math.max(0, input.musicVolume));
  const fadeOut = Math.min(Math.max(0, input.fadeOutSec ?? 1.2), Math.max(0.2, input.totalDurationSec / 3));

  const chains: string[] = [];
  const labels: string[] = [];

  inputs.forEach((kind, index) => {
    if (kind === "narration") {
      chains.push(`[${index}:a]volume=${narrationVolume.toFixed(2)},aresample=44100[nar]`);
      labels.push("[nar]");
    } else if (kind === "music") {
      chains.push(`[${index}:a]volume=${musicVolume.toFixed(2)},aresample=44100[mus]`);
      labels.push("[mus]");
    }
  });

  if (labels.length === 0) {
    // Silence only: still emit a real AAC track so the MP4 always has audio.
    chains.push(
      `[0:a]anull,loudnorm=I=-16:TP=-1.5:LRA=11,atrim=0:${input.totalDurationSec.toFixed(3)}[aout]`
    );
    return { inputs, filterComplex: chains.join(";"), outputLabel: "[aout]" };
  }

  if (labels.length === 1) {
    const only = labels[0].replace("[", "").replace("]", "");
    chains.push(`[${only}]loudnorm=I=-16:TP=-1.5:LRA=11,atrim=0:${input.totalDurationSec.toFixed(3)},afade=t=out:st=${Math.max(
      0,
      input.totalDurationSec - fadeOut
    ).toFixed(3)}:d=${fadeOut.toFixed(3)}[aout]`);
    return { inputs, filterComplex: chains.join(";"), outputLabel: "[aout]" };
  }

  if (labels.length === 2) {
    chains.push(`${labels.join("")}amix=inputs=2:duration=longest:dropout_transition=0[mixed]`);
    chains.push(
      `[mixed]loudnorm=I=-16:TP=-1.5:LRA=11,atrim=0:${input.totalDurationSec.toFixed(3)},afade=t=out:st=${Math.max(
        0,
        input.totalDurationSec - fadeOut
      ).toFixed(3)}:d=${fadeOut.toFixed(3)}[aout]`
    );
    return { inputs, filterComplex: chains.join(";"), outputLabel: "[aout]" };
  }

  chains.push(
    `${labels.join("")}amix=inputs=${labels.length}:duration=longest:dropout_transition=0[mixed]`,
    `[mixed]loudnorm=I=-16:TP=-1.5:LRA=11,atrim=0:${input.totalDurationSec.toFixed(3)}[aout]`
  );
  return { inputs, filterComplex: chains.join(";"), outputLabel: "[aout]" };
}

/* ------------------------------------------------------------------ */
/* Free-only policy                                                    */
/* ------------------------------------------------------------------ */

export interface FreePipelinePolicy {
  freeOnly: true;
  paidApisUsed: false;
  engines: { stage: string; engine: string; licence: string; costUsd: 0 }[];
  notes: string[];
}

/**
 * Returned verbatim in every render response and asserted by the test suite.
 * If a future change introduces a paid call, this object must change too and
 * the tests will fail loudly.
 */
export const FREE_PIPELINE_POLICY: FreePipelinePolicy = {
  freeOnly: true,
  paidApisUsed: false,
  engines: [
    { stage: "image-motion", engine: "local-ffmpeg/zoompan", licence: "LGPL/GPL build", costUsd: 0 },
    { stage: "voice", engine: "local-piper/espeak/formant-synth", licence: "MIT/GPL/ALO", costUsd: 0 },
    { stage: "music", engine: "local-procedural-synth", licence: "ALO original", costUsd: 0 },
    { stage: "video-encode", engine: "local-ffmpeg/libx264", licence: "LGPL/GPL build", costUsd: 0 },
    { stage: "captions", engine: "local-ffmpeg/drawtext + SRT", licence: "LGPL/GPL build", costUsd: 0 },
  ],
  notes: [
    "No hosted text-to-video, avatar or render API is contacted.",
    "Voice uses the server's local engines; the built-in formant synthesiser is the guaranteed fallback.",
    "Music is generated procedurally in-process (no model weights, no licensing fees).",
    "Optional AI writing for narration still goes through the existing free-tier allowlist and the payment guard.",
  ],
};

/** Guard: refuse to render when the caller asks for a paid engine. */
export const BLOCKED_ENGINE_TOKENS = [
  "sora",
  "veo",
  "kling",
  "runway",
  "heygen",
  "synthesia",
  "elevenlabs",
  "d-id",
  "did-api",
  "luma",
  "pika",
  "replicate-paid",
];

export interface EngineGuardResult {
  allowed: boolean;
  requested: string;
  blockedToken?: string;
  message: string;
}

export function assertFreeEngine(requestedEngine: string): EngineGuardResult {
  const requested = (requestedEngine || "").trim().toLowerCase();
  const blockedToken = BLOCKED_ENGINE_TOKENS.find((token) => requested.includes(token));
  if (blockedToken) {
    return {
      allowed: false,
      requested,
      blockedToken,
      message: `Paid/hosted video engines are disabled. "${blockedToken}" is not part of the free-only pipeline. Use "local" instead.`,
    };
  }
  return {
    allowed: true,
    requested: requested || "local",
    message: "Free-only pipeline: local FFmpeg + local voice + procedural music.",
  };
}

/* ------------------------------------------------------------------ */
/* API contract types (shared with the UI)                             */
/* ------------------------------------------------------------------ */

export interface PhotoVideoShotResult {
  index: number;
  caption: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  motion: MotionId;
}

export interface PhotoVideoRenderResult {
  ok: true;
  id: string;
  videoUrl: string;
  srtUrl: string | null;
  thumbnailUrl: string;
  posterUrl: string;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  sizeBytes: number;
  aspect: AspectPresetId;
  quality: QualityId;
  shots: PhotoVideoShotResult[];
  sources: { index: number; fileName: string; source: "upload" | "generated" }[];
  voiceEngine: string | null;
  musicEngine: string | null;
  captionsBurned: boolean;
  policy: FreePipelinePolicy;
  agentRunId: string | null;
  agentStatus: string;
  createdAt: string;
}
