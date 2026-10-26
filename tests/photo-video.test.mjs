import test from "node:test";
import assert from "node:assert/strict";
import {
  ASPECT_PRESETS,
  FREE_PIPELINE_POLICY,
  PHOTO_VIDEO_LIMITS,
  XFADE_NAMES,
  assertFreeEngine,
  balanceChunks,
  buildAudioMixPlan,
  buildCaptionCues,
  buildDipToBlackGraph,
  buildMotionFilter,
  buildSrt,
  buildTimeline,
  buildXfadeFilterComplex,
  evenNumber,
  formatSrtTime,
  getAspectPreset,
  getCaptionStyle,
  getMotionPreset,
  getQualityPreset,
  pickAutoMotion,
  prepareStillSize,
  resolveOutputSize,
  shotFrameCount,
  splitNarration,
  transitionNeedsXfade,
  wrapCaption,
} from "../src/lib/photo-video.ts";

/* ---------------- presets ---------------- */

test("aspect presets are even-sized and resolve to the requested ratio", () => {
  for (const preset of ASPECT_PRESETS) {
    assert.equal(preset.width % 2, 0, `${preset.id} width must be even`);
    assert.equal(preset.height % 2, 0, `${preset.id} height must be even`);
    assert.ok(preset.width > 0 && preset.height > 0);
  }
  assert.equal(getAspectPreset("nope").id, "vertical");
  assert.equal(getAspectPreset("landscape").width, 1920);
});

test("unknown motion/quality/caption ids fall back to the first preset", () => {
  assert.equal(getMotionPreset("warp-drive").id, "kenburns-in");
  assert.equal(getQualityPreset("ultra").id, "standard");
  assert.equal(getCaptionStyle("neon").id, "editorial");
});

test("auto motion rotates deterministically and never repeats a neighbour", () => {
  const first = pickAutoMotion(0);
  assert.equal(pickAutoMotion(0), first);
  const sequence = Array.from({ length: 8 }, (_, index) => pickAutoMotion(index));
  for (let index = 1; index < sequence.length; index++) {
    assert.notEqual(sequence[index], sequence[index - 1], "consecutive shots must differ");
  }
});

test("output size honours quality scale and stays even", () => {
  const vertical = getAspectPreset("vertical");
  const draft = resolveOutputSize(vertical, getQualityPreset("draft"));
  const standard = resolveOutputSize(vertical, getQualityPreset("standard"));
  assert.ok(draft.width < standard.width);
  assert.equal(draft.width % 2, 0);
  assert.equal(draft.height % 2, 0);
  assert.equal(evenNumber(713), 714);
  assert.deepEqual(prepareStillSize({ width: 100, height: 100 }), { width: 200, height: 200 });
});

/* ---------------- motion filter ---------------- */

test("motion filter emits zoompan with frame-exact duration", () => {
  const filter = buildMotionFilter({ motion: "kenburns-in", width: 1080, height: 1920, fps: 25, seconds: 4 });
  assert.match(filter, /^zoompan=/);
  assert.match(filter, /d=100/);
  assert.match(filter, /s=1080x1920/);
  assert.match(filter, /fps=25/);
  // `format` is appended by the route as a separate filter: older static
  // FFmpeg builds reject it as a zoompan option.
  assert.doesNotMatch(filter, /format=/);
  assert.equal(shotFrameCount(4, 25), 100);
});

test("every motion preset produces a distinct, valid filter", () => {
  const seen = new Set();
  for (const motion of ["kenburns-in", "kenburns-out", "pan-left", "pan-right", "tilt-up", "tilt-down", "orbit", "static"]) {
    const filter = buildMotionFilter({ motion, width: 720, height: 1280, fps: 25, seconds: 3 });
    assert.match(filter, /^zoompan=/);
    assert.doesNotMatch(filter, /\bundefined\b|\bNaN\b/);
    seen.add(filter);
  }
  assert.equal(seen.size, 8);
});

test("static motion keeps zoom constant at 1.0", () => {
  const filter = buildMotionFilter({ motion: "static", width: 720, height: 1280, fps: 25, seconds: 2 });
  assert.match(filter, /z='1\.0'/);
});

/* ---------------- timeline ---------------- */

test("timeline overlaps shots by the transition duration", () => {
  const timeline = buildTimeline([3, 3, 3], 0.5);
  assert.equal(timeline.shots.length, 3);
  assert.equal(timeline.transitionSec, 0.5);
  assert.equal(timeline.shots[0].startSec, 0);
  assert.equal(timeline.shots[1].startSec, 2.5);
  assert.equal(timeline.shots[2].startSec, 5);
  // 9s of footage minus two 0.5s overlaps
  assert.equal(timeline.totalDurationSec, 8);
});

test("timeline clamps an over-long transition to 45% of the shortest shot", () => {
  const timeline = buildTimeline([2, 2], 1.2);
  assert.equal(timeline.transitionSec, 0.9);
  assert.equal(timeline.totalDurationSec, 3.1);
});

test("timeline with a single shot has no overlap", () => {
  const timeline = buildTimeline([4], 0.6);
  assert.equal(timeline.shots.length, 1);
  assert.equal(timeline.totalDurationSec, 4);
});

test("empty timeline is safe", () => {
  assert.deepEqual(buildTimeline([], 0.6), { shots: [], totalDurationSec: 0, transitionSec: 0 });
});

/* ---------------- xfade graph ---------------- */

test("xfade offsets follow sum(durations) - k*transition", () => {
  const graph = buildXfadeFilterComplex([4, 4, 4], "fade", 0.5);
  assert.deepEqual(graph.offsets, [3.5, 7]);
  assert.equal(graph.outputLabel, "[vout]");
  assert.match(graph.filterComplex, /\[0:v\]\[1:v\]xfade=transition=fade:duration=0\.5:offset=3\.5\[vx1\]/);
  assert.match(graph.filterComplex, /\[vx1\]\[2:v\]xfade=transition=fade:duration=0\.5:offset=7\[vout\]/);
});

test("hard cut uses concat instead of xfade", () => {
  const graph = buildXfadeFilterComplex([2, 3], "none", 0.5);
  assert.match(graph.filterComplex, /concat=n=2:v=1:a=0\[vout\]/);
  assert.deepEqual(graph.offsets, []);
});

test("single clip short-circuits to concat", () => {
  const graph = buildXfadeFilterComplex([3], "fade", 0.5);
  assert.match(graph.filterComplex, /concat=n=1/);
});

test("every transition id maps to a real xfade name", () => {
  for (const name of Object.values(XFADE_NAMES)) {
    assert.match(name, /^[a-z]+$/);
  }
  assert.equal(Object.keys(XFADE_NAMES).length, 7);
});

test("dip-to-black fallback fades every clip and concatenates them", () => {
  const graph = buildDipToBlackGraph([3, 3], 0.6, "vout", 25);
  assert.match(graph.filterComplex, /\[0:v\]fade=t=in:st=0:d=0\.6,fade=t=out:st=2\.4:d=0\.6/);
  assert.match(graph.filterComplex, /concat=n=2:v=1:a=0\[vout\]/);
});

test("xfade is only requested for multi-clip animated joins", () => {
  assert.equal(transitionNeedsXfade(3, "fade", 0.5), true);
  assert.equal(transitionNeedsXfade(1, "fade", 0.5), false);
  assert.equal(transitionNeedsXfade(3, "none", 0.5), false);
  assert.equal(transitionNeedsXfade(3, "fade", 0), false);
});

/* ---------------- narration + captions ---------------- */

test("narration splits into one chunk per photo", () => {
  const chunks = splitNarration("এক। দুই। তিন। চার।", 2);
  assert.equal(chunks.length, 2);
  assert.equal(chunks.join(" ").replace(/\s+/g, " "), "এক। দুই। তিন। চার।");
});

test("explicit newline-per-photo narration is respected", () => {
  const chunks = splitNarration("প্রথম ছবি\nদ্বিতীয় ছবি\nতৃতীয় ছবি", 3);
  assert.deepEqual(chunks, ["প্রথম ছবি", "দ্বিতীয় ছবি", "তৃতীয় ছবি"]);
});

test("narration with fewer lines than photos keeps every line", () => {
  const chunks = splitNarration("এক লাইন\nআরেক লাইন", 4);
  assert.equal(chunks.length, 4);
  assert.ok(chunks.some((chunk) => chunk.includes("এক লাইন")));
  assert.ok(chunks.some((chunk) => chunk.includes("আরেক লাইন")));
});

test("empty narration yields empty captions rather than crashing", () => {
  assert.deepEqual(splitNarration("   ", 3), ["", "", ""]);
  assert.deepEqual(balanceChunks([], 2), ["", ""]);
});

test("balanceChunks always returns exactly the requested count", () => {
  for (const count of [1, 2, 3, 5]) {
    const groups = balanceChunks(["a", "b", "c", "d", "e", "f", "g"], count);
    assert.equal(groups.length, count);
  }
});

test("captions wrap to at most three lines", () => {
  const lines = wrapCaption("এই একটি খুবই দীর্ঘ ক্যাপশন যা তিন লাইনে ভেঙে দেখাতে হবে যাতে ভিডিওতে ভালো দেখায়", 18, 3);
  assert.ok(lines.length <= 3);
  for (const line of lines) assert.ok(line.length <= 19, `line too long: ${line}`);
});

test("SDL/SRT timestamps are zero padded with milliseconds", () => {
  assert.equal(formatSrtTime(0), "00:00:00,000");
  assert.equal(formatSrtTime(65.5), "00:01:05,500");
  assert.equal(formatSrtTime(3661.25), "01:01:01,250");
});

test("SRT output is numbered and ordered", () => {
  const timeline = buildTimeline([2, 2], 0);
  const cues = buildCaptionCues(timeline.shots, ["প্রথম", "দ্বিতীয়"]);
  const srt = buildSrt(cues);
  assert.match(srt, /^1\n00:00:00,000 --> 00:00:02,000\nপ্রথম\n/);
  assert.match(srt, /2\n00:00:02,000 --> 00:00:04,000\nদ্বিতীয়/);
});

test("blank captions are dropped from the subtitle track", () => {
  const timeline = buildTimeline([2, 2], 0);
  const cues = buildCaptionCues(timeline.shots, ["প্রথম", "   "]);
  assert.equal(cues.length, 1);
});

/* ---------------- audio mix ---------------- */

test("audio mix uses amix for voice + music", () => {
  const plan = buildAudioMixPlan({ hasNarration: true, hasMusic: true, totalDurationSec: 10, musicVolume: 0.2 });
  assert.deepEqual(plan.inputs, ["narration", "music"]);
  assert.match(plan.filterComplex, /amix=inputs=2/);
  assert.match(plan.filterComplex, /loudnorm=I=-16/);
  assert.match(plan.filterComplex, /atrim=0:10\.000/);
  assert.doesNotMatch(plan.filterComplex, /normalize=0/, "old FFmpeg builds reject amix normalize");
});

test("audio mix emits a silent track when nothing is generated", () => {
  const plan = buildAudioMixPlan({ hasNarration: false, hasMusic: false, totalDurationSec: 5, musicVolume: 0 });
  assert.deepEqual(plan.inputs, ["silence"]);
  assert.match(plan.filterComplex, /^\[0:a\]anull/);
  assert.doesNotMatch(plan.filterComplex, /amix/, "silence must not go through amix with zero inputs");
});

test("music clamps to the documented maximum volume", () => {
  const plan = buildAudioMixPlan({ hasNarration: true, hasMusic: true, totalDurationSec: 8, musicVolume: 4 });
  assert.match(plan.filterComplex, new RegExp(`volume=${PHOTO_VIDEO_LIMITS.maxMusicVolume.toFixed(2)}`));
});

test("voice-only mix still normalises and fades out", () => {
  const plan = buildAudioMixPlan({ hasNarration: true, hasMusic: false, totalDurationSec: 6, musicVolume: 0 });
  assert.deepEqual(plan.inputs, ["narration"]);
  assert.match(plan.filterComplex, /afade=t=out/);
});

/* ---------------- free-only policy ---------------- */

test("free-only policy declares zero cost and no paid APIs", () => {
  assert.equal(FREE_PIPELINE_POLICY.freeOnly, true);
  assert.equal(FREE_PIPELINE_POLICY.paidApisUsed, false);
  for (const engine of FREE_PIPELINE_POLICY.engines) assert.equal(engine.costUsd, 0);
});

test("paid/hosted video engines are refused", () => {
  for (const engine of ["sora", "veo-3", "kling-ai", "heygen", "elevenlabs", "runway-ml"]) {
    const result = assertFreeEngine(engine);
    assert.equal(result.allowed, false, `${engine} must be blocked`);
    assert.ok(result.blockedToken);
  }
});

test("local engine passes the free-only guard", () => {
  const result = assertFreeEngine("local");
  assert.equal(result.allowed, true);
  assert.equal(assertFreeEngine("").allowed, true);
});

test("photo limits stay within safe rendering bounds", () => {
  assert.ok(PHOTO_VIDEO_LIMITS.maxImages <= 20);
  assert.ok(PHOTO_VIDEO_LIMITS.maxImageBytes <= 25 * 1024 * 1024);
  assert.ok(PHOTO_VIDEO_LIMITS.minShotSec > 0);
  assert.ok(PHOTO_VIDEO_LIMITS.maxShotSec <= 30);
});
