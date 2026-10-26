/**
 * ALO Workshop Curriculum — self-contained learning units adapted from the
 * reference repositories in the link review (2026-10-17):
 *
 *  - huggingface/education-toolkit (Apache-2.0): self-contained workshop pattern —
 *    duration badges, outcome bullets, tutorial + slide pairs, translated editions.
 *  - leandromoreira/digital_video_introduction (BSD-3): hands-on video technology
 *    chapters (image → sequence → codec → encoding) as progressive modules.
 *  - 0voice/audio_video_streaming: streaming-protocol learning paths (RTMP/HLS/WebRTC)
 *    organised as articles → papers → practice projects.
 *  - cursor/plugins `teaching` (skill mapping, practice plans, learning retrospectives):
 *    each unit ends with a retrospective checkpoint.
 *
 * Structure and wording are original ALO content; no third-party text is copied.
 */

export interface CurriculumUnit {
  id: string;
  title: string;
  sourceLineage: string;
  durationMinutes: [number, number];
  audience: "Beginner" | "Intermediate" | "Advanced";
  track: "Media Foundations" | "AI Literacy" | "Streaming & Delivery" | "Teaching Practice";
  outcomes: string[];
  modules: Array<{ name: string; detail: string }>;
  retrospective: string;
  officialReference: string;
}

export const CURRICULUM_UNITS: CurriculumUnit[] = [
  {
    id: "media-foundations",
    title: "Digital Video Foundations",
    sourceLineage: "Adapted progression from leandromoreira/digital_video_introduction (BSD-3)",
    durationMinutes: [20, 40],
    audience: "Beginner",
    track: "Media Foundations",
    outcomes: [
      "Explain how pixels, frames, and codecs relate in a short video",
      "Read a basic bitrate/resolution table and choose sensible export settings",
      "Describe what H.264, HEVC, VP9, and AV1 each trade away",
    ],
    modules: [
      { name: "Image → Sequence", detail: "How still frames compose motion; resolution, aspect, and frame rate without the maths fog." },
      { name: "Codecs & Containers", detail: "Why MP4 ≠ H.264, what a container holds, and when AV1's efficiency matters for mobile delivery." },
      { name: "Hands-on Export", detail: "Produce one 1080×1920 H.264 clip with a matching SRT track and read back the ffprobe report." },
    ],
    retrospective: "Which export setting changed quality the most for the file size? Note one myth you can now disprove.",
    officialReference: "https://github.com/leandromoreira/digital_video_introduction",
  },
  {
    id: "ai-literacy-hub",
    title: "AI Model Hub Literacy",
    sourceLineage: "Workshop pattern from huggingface/education-toolkit (Apache-2.0)",
    durationMinutes: [20, 40],
    audience: "Beginner",
    track: "AI Literacy",
    outcomes: [
      "Find and evaluate a public model card for a stated task",
      "Run a no-code demo and explain its input/output contract",
      "List two responsible-use limits for any classroom AI tool",
    ],
    modules: [
      { name: "Model & Dataset Discovery", detail: "Search public hubs by task, read licences and benchmark notes, and recognise stale checkpoints." },
      { name: "Instant Demos", detail: "Wrap a small model in an interactive demo; discuss why a demo is not deployment." },
      { name: "Pipelines in Practice", detail: "Follow one text pipeline end-to-end and mark where human review belongs." },
    ],
    retrospective: "Record one licence condition you would have missed without the model card.",
    officialReference: "https://github.com/huggingface/education-toolkit",
  },
  {
    id: "streaming-delivery",
    title: "Live Streaming & Delivery 101",
    sourceLineage: "Learning-path structure from 0voice/audio_video_streaming",
    durationMinutes: [30, 45],
    audience: "Intermediate",
    track: "Streaming & Delivery",
    outcomes: [
      "Compare RTMP ingest, HLS, and WebRTC on latency and scale",
      "Sketch a simple live-to-VOD pipeline with captions",
      "Identify what breaks first on a weak mobile network",
    ],
    modules: [
      { name: "Protocol Tour", detail: "RTMP, HLS/DASH, and WebRTC: where each sits in the glass-to-glass journey." },
      { name: "Adaptive Delivery", detail: "Why renditions exist; measure one ABR ladder against a 3G profile." },
      { name: "Practice Project", detail: "Publish one recorded lesson as VOD with captions and a chapter list." },
    ],
    retrospective: "Where did latency or buffering appear in your own pipeline? One fix, measured before/after.",
    officialReference: "https://github.com/0voice/audio_video_streaming",
  },
  {
    id: "teaching-practice-retro",
    title: "Practice Plan & Learning Retrospective",
    sourceLineage: "Teaching-pattern from cursor/plugins `teaching` (skill mapping, practice plans, retrospectives)",
    durationMinutes: [15, 25],
    audience: "Beginner",
    track: "Teaching Practice",
    outcomes: [
      "Turn one goal into a 3-session practice plan with checkpoints",
      "Run a short retrospective that names evidence, not feelings alone",
      "Map which ALO studio module each practice step uses",
    ],
    modules: [
      { name: "Skill Mapping", detail: "Break a target skill into observable sub-skills and order them by dependency." },
      { name: "Practice Plan", detail: "Three sessions: drill, apply, teach-back — each with a done-definition." },
      { name: "Retrospective", detail: "What worked, what evidence shows it, what changes next week." },
    ],
    retrospective: "Write the one-sentence change you will make to next week's plan before you close the tab.",
    officialReference: "https://github.com/cursor/plugins",
  },
];
