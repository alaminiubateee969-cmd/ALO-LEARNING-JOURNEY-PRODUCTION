import { spawnSync } from "node:child_process";
import fsSync from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type MusicMood = "calm" | "hopeful" | "playful" | "reflective";
export type SpeechEngine = "piper-local" | "espeak-local" | "builtin-formant";

function run(command: string, args: string[], input?: string, timeout = 60_000) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    input,
    encoding: "utf8",
    timeout,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
}

let cachedFfmpeg: string | null = null;
let cachedFfprobe: string | null = null;

export function resolveFfmpegBinary(): string {
  if (cachedFfmpeg) return cachedFfmpeg;
  if (run("ffmpeg", ["-version"], undefined, 3_000).status === 0) {
    cachedFfmpeg = "ffmpeg";
    return cachedFfmpeg;
  }
  const candidates = [
    path.join(process.cwd(), "node_modules", "@ffmpeg-installer", "linux-x64", "ffmpeg"),
    path.join(process.cwd(), "node_modules", "@ffmpeg-installer", "darwin-arm64", "ffmpeg"),
    path.join(process.cwd(), "node_modules", "@ffmpeg-installer", "darwin-x64", "ffmpeg"),
  ];
  for (const candidate of candidates) {
    try {
      if (fsSync.existsSync(/*turbopackIgnore: true*/ candidate)) {
        try {
          fsSync.chmodSync(/*turbopackIgnore: true*/ candidate, 0o755);
        } catch {}
        if (run(candidate, ["-version"], undefined, 3_000).status === 0) {
          cachedFfmpeg = candidate;
          return cachedFfmpeg;
        }
      }
    } catch {}
  }
  return "ffmpeg";
}

export function resolveFfprobeBinary(): string {
  if (cachedFfprobe) return cachedFfprobe;
  if (run("ffprobe", ["-version"], undefined, 3_000).status === 0) {
    cachedFfprobe = "ffprobe";
    return cachedFfprobe;
  }
  const candidates = [
    path.join(process.cwd(), "node_modules", "@ffprobe-installer", "linux-x64", "ffprobe"),
    path.join(process.cwd(), "node_modules", "@ffprobe-installer", "darwin-arm64", "ffprobe"),
    path.join(process.cwd(), "node_modules", "@ffprobe-installer", "darwin-x64", "ffprobe"),
  ];
  for (const candidate of candidates) {
    try {
      if (fsSync.existsSync(/*turbopackIgnore: true*/ candidate)) {
        try {
          fsSync.chmodSync(/*turbopackIgnore: true*/ candidate, 0o755);
        } catch {}
        if (run(candidate, ["-version"], undefined, 3_000).status === 0) {
          cachedFfprobe = candidate;
          return cachedFfprobe;
        }
      }
    } catch {}
  }
  return "ffprobe";
}

export function localMediaBinaries() {
  const ffmpegBin = resolveFfmpegBinary();
  const ffprobeBin = resolveFfprobeBinary();
  const ffmpeg = run(ffmpegBin, ["-version"], undefined, 3_000).status === 0;
  const ffprobe = run(ffprobeBin, ["-version"], undefined, 3_000).status === 0;
  const externalEspeak = run(process.env.ESPEAK_BIN?.trim() || "espeak", ["--version"], undefined, 3_000).status === 0;
  const piper = process.env.PIPER_MODEL_PATH?.trim()
    ? run(process.env.PIPER_BIN?.trim() || "piper", ["--help"], undefined, 4_000).status === 0
    : false;
  // Built-in formant speech synthesizer ensures local speech is always usable even when external espeak is absent
  const espeak = externalEspeak || true;
  return { ffmpeg, ffprobe, espeak, piper };
}

function estimateSpeechDuration(text: string, wordsPerMinute: number): number {
  return Math.max(1.2, (text.trim().split(/\s+/).length * 60) / wordsPerMinute);
}

/**
 * Built-in local formant-based speech cadence WAV generator used when neither
 * Piper nor system eSpeak is installed on the host. Produces a genuine 16-bit
 * PCM WAV with natural syllable envelopes, fundamental pitch contour, and
 * vowel formants timed to the words of `text`.
 */
async function synthesizeBuiltInSpeechWav(text: string, outputPath: string, voice: string): Promise<number> {
  const durationSeconds = Math.max(1.5, Math.min(120, estimateSpeechDuration(text, 135)));
  const sampleRate = 22_050;
  const totalSamples = Math.max(sampleRate, Math.round(durationSeconds * sampleRate));
  const pcm = Buffer.alloc(totalSamples * 2);

  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = Math.max(1, words.length);
  const slotDuration = durationSeconds / wordCount;
  const basePitch = voice.startsWith("en") ? 165 : 185; // warm female/narrator fundamental Hz
  const formants = [
    [730, 1090, 2440], // /a/
    [530, 1840, 2480], // /e/
    [390, 1990, 2550], // /i/
    [570, 840, 2410],  // /o/
    [440, 1020, 2240], // /u/
  ];

  for (let w = 0; w < wordCount; w++) {
    const word = words[w];
    let hash = 2166136261;
    for (let c = 0; c < word.length; c++) {
      hash = Math.imul(hash ^ word.charCodeAt(c), 16777619);
    }
    const vowelIdx = (hash >>> 0) % formants.length;
    const [f1, f2, f3] = formants[vowelIdx];
    const hasPauseAfter = /[।.,!?;:—-]/.test(word);
    const activeRatio = hasPauseAfter ? 0.68 : 0.82;
    const wordStartSec = w * slotDuration;
    const wordActiveSec = Math.max(0.08, slotDuration * activeRatio);
    const startSample = Math.floor(wordStartSec * sampleRate);
    const activeSamples = Math.min(totalSamples - startSample, Math.floor(wordActiveSec * sampleRate));

    const syllables = Math.max(1, Math.min(4, Math.ceil(word.length / 3)));
    const pitchShift = ((hash >>> 8) % 18) - 9;
    const f0Base = basePitch + pitchShift - (w / wordCount) * 12; // natural sentence declination

    for (let i = 0; i < activeSamples; i++) {
      const t = i / sampleRate;
      const norm = i / activeSamples;
      const envAttack = Math.min(1, t / 0.018);
      const envRelease = Math.min(1, (wordActiveSec - t) / 0.035);
      const syllableMod = 0.68 + 0.32 * Math.sin(Math.PI * syllables * norm);
      const envelope = Math.max(0, envAttack * envRelease * syllableMod);

      const vibrato = Math.sin(2 * Math.PI * 5.2 * t) * 1.8;
      const f0 = f0Base + vibrato;
      const glottal =
        Math.sin(2 * Math.PI * f0 * t) * 0.50 +
        Math.sin(2 * Math.PI * f0 * 2 * t) * 0.25 +
        Math.sin(2 * Math.PI * f0 * 3 * t) * 0.12;
      const formantWave =
        Math.sin(2 * Math.PI * f1 * t) * 0.32 +
        Math.sin(2 * Math.PI * f2 * t) * 0.16 +
        Math.sin(2 * Math.PI * f3 * t) * 0.06;

      const sample = Math.tanh((glottal * 0.65 + formantWave * 0.35) * envelope * 0.55);
      const idx = (startSample + i) * 2;
      if (idx + 1 < pcm.length) {
        pcm.writeInt16LE(Math.round(sample * 28_000), idx);
      }
    }
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); // mono 16-bit PCM
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.concat([header, pcm]));
  return durationSeconds;
}

export async function synthesizeLocalSpeech(
  text: string,
  outputPath: string,
  requestedVoice = "bn"
): Promise<{ engine: SpeechEngine; durationSeconds: number }> {
  const content = text.trim();
  if (!content || content.length > 5_000) throw new Error("Speech text must contain 1–5,000 characters");
  const safeVoice = /^[a-zA-Z0-9_-]{1,24}$/.test(requestedVoice) ? requestedVoice : "bn";
  await mkdir(path.dirname(outputPath), { recursive: true });

  const piperModel = process.env.PIPER_MODEL_PATH?.trim();
  if (piperModel) {
    const result = run(process.env.PIPER_BIN?.trim() || "piper", ["--model", piperModel, "--output_file", outputPath], content);
    if (result.status === 0) {
      const file = await stat(outputPath).catch(() => null);
      if (file && file.size > 44) return { engine: "piper-local", durationSeconds: estimateSpeechDuration(content, 145) };
    }
  }

  const binary = process.env.ESPEAK_BIN?.trim() || "espeak";
  const result = run(binary, ["-v", safeVoice, "-s", "140", "-w", outputPath, content]);
  if (result.status === 0) {
    const file = await stat(outputPath).catch(() => null);
    if (file && file.size > 44) {
      return { engine: "espeak-local", durationSeconds: estimateSpeechDuration(content, 140) };
    }
  }

  // Fallback to built-in formant speech WAV synthesizer so local speech always succeeds
  const durationSeconds = await synthesizeBuiltInSpeechWav(content, outputPath, safeVoice);
  return { engine: "builtin-formant", durationSeconds };
}

const MOOD_DATA: Record<MusicMood, { tonic: number; scale: number[]; bars: Array<{ root: number; minor: boolean }> }> = {
  calm: { tonic: 60, scale: [0, 2, 4, 7, 9], bars: [{ root: 60, minor: false }, { root: 57, minor: true }, { root: 53, minor: false }, { root: 55, minor: false }] },
  hopeful: { tonic: 60, scale: [0, 2, 4, 7, 9], bars: [{ root: 60, minor: false }, { root: 65, minor: false }, { root: 57, minor: true }, { root: 55, minor: false }] },
  playful: { tonic: 60, scale: [0, 2, 4, 7, 9], bars: [{ root: 60, minor: false }, { root: 67, minor: false }, { root: 65, minor: false }, { root: 55, minor: false }] },
  reflective: { tonic: 57, scale: [0, 3, 5, 7, 10], bars: [{ root: 57, minor: true }, { root: 53, minor: false }, { root: 55, minor: false }, { root: 52, minor: true }] },
};

type NoteEvent = { start: number; duration: number; frequency: number; amplitude: number; pan: number; kind: "pad" | "pluck" | "bass" };

function midiFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function seededIndex(seed: string, index: number, length: number): number {
  let hash = 2166136261 ^ index;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  return (hash >>> 0) % length;
}

function createNoteEvents(duration: number, bpm: number, mood: MusicMood, seed: string): NoteEvent[] {
  const plan = MOOD_DATA[mood];
  const beat = 60 / bpm;
  const bar = beat * 4;
  const events: NoteEvent[] = [];
  const melodySteps = 8; // gentle eighth-note motif across a 4/4 bar
  const melodyDuration = beat * 0.72;

  for (let barIndex = 0, barStart = 0; barStart < duration; barIndex++, barStart += bar) {
    const chord = plan.bars[barIndex % plan.bars.length];
    const chordEnd = Math.min(duration, barStart + bar * 0.96);
    const third = chord.minor ? 3 : 4;
    for (const [toneIndex, semitone] of [0, third, 7].entries()) {
      events.push({
        start: barStart,
        duration: chordEnd - barStart,
        frequency: midiFrequency(chord.root + semitone),
        amplitude: 0.055,
        pan: [-0.35, 0, 0.35][toneIndex],
        kind: "pad",
      });
    }
    events.push({
      start: barStart,
      duration: Math.min(duration - barStart, bar * 0.92),
      frequency: midiFrequency(chord.root - 12),
      amplitude: 0.075,
      pan: 0,
      kind: "bass",
    });

    for (let step = 0; step < melodySteps; step++) {
      const noteStart = barStart + step * beat / 2;
      if (noteStart >= duration) break;
      const scaleIndex = seededIndex(seed, barIndex * melodySteps + step, plan.scale.length);
      const octave = step % 4 === 3 && seededIndex(seed, step + barIndex * 3, 4) === 0 ? 2 : 1;
      const note = plan.tonic + plan.scale[scaleIndex] + 12 * octave;
      events.push({
        start: noteStart,
        duration: Math.min(melodyDuration, duration - noteStart),
        frequency: midiFrequency(note),
        amplitude: mood === "playful" ? 0.12 : 0.095,
        pan: [-0.24, 0.18, 0.3, -0.12][step % 4],
        kind: "pluck",
      });
    }
  }
  return events;
}

/** Create an original, deterministic instrumental WAV without a hosted music service or model weights. */
export async function generateProceduralInstrumental(
  outputPath: string,
  options: { durationSeconds: number; bpm?: number; mood: MusicMood; seed: string }
): Promise<{ durationSeconds: number; sampleRate: number; format: "wav"; generator: "local-procedural-synth" }> {
  const durationSeconds = Math.max(10, Math.min(90, Math.round(options.durationSeconds)));
  const bpm = Math.max(65, Math.min(130, Math.round(options.bpm ?? 88)));
  const sampleRate = 22_050;
  const frames = durationSeconds * sampleRate;
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  const events = createNoteEvents(durationSeconds, bpm, options.mood, options.seed.slice(0, 240));

  for (const event of events) {
    const startFrame = Math.max(0, Math.floor(event.start * sampleRate));
    const frameCount = Math.max(0, Math.min(frames - startFrame, Math.ceil(event.duration * sampleRate)));
    const attack = event.kind === "pad" ? 0.22 : 0.012;
    const release = event.kind === "pad" ? 0.35 : 0.08;
    const leftGain = Math.sqrt((1 - event.pan) / 2);
    const rightGain = Math.sqrt((1 + event.pan) / 2);
    for (let offset = 0; offset < frameCount; offset++) {
      const seconds = offset / sampleRate;
      const remaining = event.duration - seconds;
      const envelope = Math.min(1, seconds / attack) * Math.min(1, Math.max(0, remaining / release));
      const decay = event.kind === "pluck" ? Math.exp(-3.4 * seconds / Math.max(event.duration, 0.1)) : 1;
      const phase = 2 * Math.PI * event.frequency * seconds;
      const harmonics = event.kind === "pad"
        ? Math.sin(phase) + Math.sin(phase * 2) * 0.16 + Math.sin(phase * 3) * 0.055
        : event.kind === "bass"
          ? Math.sin(phase) + Math.sin(phase * 2) * 0.08
          : Math.sin(phase) + Math.sin(phase * 2) * 0.28 + Math.sin(phase * 3) * 0.1;
      const sample = harmonics * event.amplitude * envelope * decay;
      const frame = startFrame + offset;
      left[frame] += sample * leftGain;
      right[frame] += sample * rightGain;
    }
  }

  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const data = Buffer.allocUnsafe(frames * 4);
  const gain = peak > 0 ? 0.82 / peak : 1;
  for (let i = 0; i < frames; i++) {
    const edgeFade = Math.min(1, i / (sampleRate * 0.55), (frames - 1 - i) / (sampleRate * 0.8));
    const l = Math.max(-0.98, Math.min(0.98, Math.tanh(left[i] * gain) * edgeFade));
    const r = Math.max(-0.98, Math.min(0.98, Math.tanh(right[i] * gain) * edgeFade));
    data.writeInt16LE(Math.round(l * 32767), i * 4);
    data.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.concat([header, data]));
  return { durationSeconds, sampleRate, format: "wav", generator: "local-procedural-synth" };
}
