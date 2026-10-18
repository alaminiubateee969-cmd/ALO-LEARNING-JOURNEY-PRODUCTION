// ALO Learning Journey — Department Registry (100 departments across 10 families)
// Scalable architecture for the 2,000 AI Employee workforce.

export interface DepartmentDef {
  name: string;
  family: DepartmentFamily;
  description: string;
  agentCount: number;
}

export type DepartmentFamily =
  | "CONTENT_STRATEGY"
  | "SOCIAL_MEDIA"
  | "IMAGE"
  | "VIDEO"
  | "VOICE"
  | "COMMUNICATION"
  | "MARKETING"
  | "QA_SAFETY"
  | "RESEARCH_RAG"
  | "OPS_INFRA";

export const DEPARTMENT_FAMILIES: { id: DepartmentFamily; label: string; bn: string; icon: string }[] = [
  { id: "CONTENT_STRATEGY", label: "Content Strategy", bn: "কনটেন্ট কৌশল", icon: "✍️" },
  { id: "SOCIAL_MEDIA", label: "Social Media", bn: "সোশ্যাল মিডিয়া", icon: "📱" },
  { id: "IMAGE", label: "Image Generation", bn: "ইমেজ", icon: "🎨" },
  { id: "VIDEO", label: "Video Production", bn: "ভিডিও", icon: "🎬" },
  { id: "VOICE", label: "Voice & Audio", bn: "ভয়েস", icon: "🎙️" },
  { id: "COMMUNICATION", label: "Communication", bn: "যোগাযোগ", icon: "💬" },
  { id: "MARKETING", label: "Marketing & Ads", bn: "মার্কেটিং", icon: "📈" },
  { id: "QA_SAFETY", label: "QA & Safety", bn: "মান ও নিরাপত্তা", icon: "🛡️" },
  { id: "RESEARCH_RAG", label: "Research & RAG", bn: "গবেষণা", icon: "📚" },
  { id: "OPS_INFRA", label: "Ops & Infrastructure", bn: "পরিচালনা", icon: "⚙️" },
];

export const DEPARTMENTS: DepartmentDef[] = [
  // ===== CONTENT_STRATEGY (10) =====
  { name: "Content Strategy", family: "CONTENT_STRATEGY", description: "Overall content direction and planning", agentCount: 20 },
  { name: "Bangla Content", family: "CONTENT_STRATEGY", description: "Bengali-language content specialists", agentCount: 22 },
  { name: "English Content", family: "CONTENT_STRATEGY", description: "English-language content specialists", agentCount: 18 },
  { name: "Copywriting", family: "CONTENT_STRATEGY", description: "Persuasive copy for ads and posts", agentCount: 20 },
  { name: "Script Writing", family: "CONTENT_STRATEGY", description: "Video and reel script writing", agentCount: 20 },
  { name: "Hook Optimization", family: "CONTENT_STRATEGY", description: "3-second hook crafting", agentCount: 15 },
  { name: "SEO Content", family: "CONTENT_STRATEGY", description: "Search-optimized content", agentCount: 18 },
  { name: "Storytelling", family: "CONTENT_STRATEGY", description: "Narrative structure specialists", agentCount: 15 },
  { name: "Educational Content", family: "CONTENT_STRATEGY", description: "Child development and parenting education", agentCount: 22 },
  { name: "Content Localization", family: "CONTENT_STRATEGY", description: "Adapt content across languages", agentCount: 12 },

  // ===== SOCIAL_MEDIA (10) =====
  { name: "Facebook Management", family: "SOCIAL_MEDIA", description: "Facebook page and posts", agentCount: 18 },
  { name: "Instagram Management", family: "SOCIAL_MEDIA", description: "Instagram feed and reels", agentCount: 20 },
  { name: "YouTube Management", family: "SOCIAL_MEDIA", description: "YouTube shorts and long-form", agentCount: 20 },
  { name: "TikTok Management", family: "SOCIAL_MEDIA", description: "TikTok video content", agentCount: 18 },
  { name: "LinkedIn Management", family: "SOCIAL_MEDIA", description: "Professional content", agentCount: 12 },
  { name: "X (Twitter) Management", family: "SOCIAL_MEDIA", description: "Threads and posts", agentCount: 14 },
  { name: "Telegram Management", family: "SOCIAL_MEDIA", description: "Channel and broadcast", agentCount: 12 },
  { name: "Pinterest Management", family: "SOCIAL_MEDIA", description: "Pins and boards", agentCount: 10 },
  { name: "Community Engagement", family: "SOCIAL_MEDIA", description: "Comment replies and DMs", agentCount: 22 },
  { name: "Influencer Coordination", family: "SOCIAL_MEDIA", description: "Influencer outreach and management", agentCount: 8 },

  // ===== IMAGE (10) =====
  { name: "Image Concept", family: "IMAGE", description: "Creative concept development", agentCount: 15 },
  { name: "Image Prompt Engineering", family: "IMAGE", description: "Prompt crafting for image models", agentCount: 20 },
  { name: "Image Composition", family: "IMAGE", description: "Layout and composition", agentCount: 15 },
  { name: "Image Lighting", family: "IMAGE", description: "Lighting design", agentCount: 12 },
  { name: "Image Character", family: "IMAGE", description: "Character consistency in images", agentCount: 18 },
  { name: "Image Background", family: "IMAGE", description: "Background generation", agentCount: 12 },
  { name: "Image Thumbnail", family: "IMAGE", description: "YouTube/video thumbnails", agentCount: 15 },
  { name: "Image Ad Creative", family: "IMAGE", description: "Advertising visuals", agentCount: 18 },
  { name: "Image QA", family: "IMAGE", description: "Image quality analysis", agentCount: 20 },
  { name: "Image Upscaling", family: "IMAGE", description: "Resolution enhancement", agentCount: 10 },

  // ===== VIDEO (10) =====
  { name: "Video Direction", family: "VIDEO", description: "Overall video creative direction", agentCount: 12 },
  { name: "Storyboard", family: "VIDEO", description: "Scene-by-scene storyboards", agentCount: 15 },
  { name: "Scene Generation", family: "VIDEO", description: "Individual scene creation", agentCount: 20 },
  { name: "Video Editing", family: "VIDEO", description: "Cut, transition, assembly", agentCount: 18 },
  { name: "Video Animation", family: "VIDEO", description: "Motion and animation", agentCount: 15 },
  { name: "Lip Sync", family: "VIDEO", description: "Audio-video synchronization", agentCount: 12 },
  { name: "Subtitle & Captions", family: "VIDEO", description: "Bengali subtitles and SRT", agentCount: 18 },
  { name: "Video QA", family: "VIDEO", description: "Video quality analysis", agentCount: 20 },
  { name: "Shorts & Reels", family: "VIDEO", description: "Vertical format specialists", agentCount: 22 },
  { name: "Video Optimization", family: "VIDEO", description: "Platform-specific encoding", agentCount: 12 },

  // ===== VOICE (10) =====
  { name: "Voice Direction", family: "VOICE", description: "Voice casting and direction", agentCount: 8 },
  { name: "Bangla Voice", family: "VOICE", description: "Bengali voice synthesis", agentCount: 20 },
  { name: "English Voice", family: "VOICE", description: "English voice synthesis", agentCount: 15 },
  { name: "Banglish Voice", family: "VOICE", description: "Banglish (mixed) voice", agentCount: 12 },
  { name: "Voice Emotion", family: "VOICE", description: "Emotional tone control", agentCount: 15 },
  { name: "Narration", family: "VOICE", description: "Story and explainer narration", agentCount: 18 },
  { name: "Dialogue", family: "VOICE", description: "Character dialogue voices", agentCount: 15 },
  { name: "Voice QA", family: "VOICE", description: "Voice quality analysis", agentCount: 18 },
  { name: "Audio Cleanup", family: "VOICE", description: "Noise removal and cleanup", agentCount: 12 },
  { name: "Music & SFX", family: "VOICE", description: "Background music and sound effects", agentCount: 14 },

  // ===== COMMUNICATION (10) =====
  { name: "AI Calling", family: "COMMUNICATION", description: "Outbound AI voice calls", agentCount: 15 },
  { name: "SMS Engine", family: "COMMUNICATION", description: "SMS generation and sending", agentCount: 12 },
  { name: "WhatsApp Business", family: "COMMUNICATION", description: "WhatsApp messaging", agentCount: 15 },
  { name: "Messenger", family: "COMMUNICATION", description: "Facebook Messenger automation", agentCount: 10 },
  { name: "Instagram DM", family: "COMMUNICATION", description: "Instagram direct messages", agentCount: 10 },
  { name: "Telegram Bot", family: "COMMUNICATION", description: "Telegram bot responses", agentCount: 12 },
  { name: "Email Marketing", family: "COMMUNICATION", description: "Email campaigns", agentCount: 14 },
  { name: "Lead Qualification", family: "COMMUNICATION", description: "Lead scoring and qualification", agentCount: 12 },
  { name: "Appointment Setting", family: "COMMUNICATION", description: "Scheduling and booking", agentCount: 10 },
  { name: "Customer Support", family: "COMMUNICATION", description: "Support ticket handling", agentCount: 18 },

  // ===== MARKETING (10) =====
  { name: "Campaign Strategy", family: "MARKETING", description: "Campaign planning", agentCount: 12 },
  { name: "Ad Copywriting", family: "MARKETING", description: "Paid ad copy", agentCount: 15 },
  { name: "Audience Targeting", family: "MARKETING", description: "Audience research and targeting", agentCount: 12 },
  { name: "Budget Optimization", family: "MARKETING", description: "Ad spend optimization", agentCount: 8 },
  { name: "A/B Testing", family: "MARKETING", description: "Creative testing", agentCount: 14 },
  { name: "Analytics", family: "MARKETING", description: "Performance analytics", agentCount: 20 },
  { name: "Marketing Intelligence", family: "MARKETING", description: "Competitive intelligence", agentCount: 10 },
  { name: "Conversion Optimization", family: "MARKETING", description: "CRO specialists", agentCount: 12 },
  { name: "Retargeting", family: "MARKETING", description: "Retargeting campaigns", agentCount: 10 },
  { name: "Lead Attribution", family: "MARKETING", description: "Attribution modeling", agentCount: 8 },

  // ===== QA_SAFETY (10) =====
  { name: "Protective Mode", family: "QA_SAFETY", description: "Child safety and content safety", agentCount: 22 },
  { name: "Fact Checking", family: "QA_SAFETY", description: "Claim verification", agentCount: 18 },
  { name: "Brand Consistency", family: "QA_SAFETY", description: "Brand voice and visual consistency", agentCount: 15 },
  { name: "Quality Scoring", family: "QA_SAFETY", description: "Output quality evaluation", agentCount: 20 },
  { name: "Safety Review", family: "QA_SAFETY", description: "Pre-publish safety checks", agentCount: 18 },
  { name: "Compliance", family: "QA_SAFETY", description: "Platform policy compliance", agentCount: 12 },
  { name: "Consent Verification", family: "QA_SAFETY", description: "Family consent checks", agentCount: 10 },
  { name: "Copyright Check", family: "QA_SAFETY", description: "Copyright risk assessment", agentCount: 10 },
  { name: "Error Classification", family: "QA_SAFETY", description: "Failure type classification", agentCount: 12 },
  { name: "Audit & Logging", family: "QA_SAFETY", description: "Audit trail and logging", agentCount: 15 },

  // ===== RESEARCH_RAG (10) =====
  { name: "Trend Research", family: "RESEARCH_RAG", description: "Trending topic discovery", agentCount: 18 },
  { name: "Topic Ideation", family: "RESEARCH_RAG", description: "Content idea generation", agentCount: 20 },
  { name: "RAG Retrieval", family: "RESEARCH_RAG", description: "Knowledge base retrieval", agentCount: 22 },
  { name: "RAG Indexing", family: "RESEARCH_RAG", description: "Document ingestion and chunking", agentCount: 15 },
  { name: "Knowledge Curation", family: "RESEARCH_RAG", description: "Knowledge base management", agentCount: 12 },
  { name: "Parenting Research", family: "RESEARCH_RAG", description: "Parenting topic research", agentCount: 18 },
  { name: "Child Development Research", family: "RESEARCH_RAG", description: "Developmental milestone research", agentCount: 15 },
  { name: "Competitor Analysis", family: "RESEARCH_RAG", description: "Competitor content analysis", agentCount: 10 },
  { name: "Audience Research", family: "RESEARCH_RAG", description: "Audience behavior research", agentCount: 12 },
  { name: "Citation Management", family: "RESEARCH_RAG", description: "Source citation tracking", agentCount: 8 },

  // ===== OPS_INFRA (10) =====
  { name: "Loop Orchestration", family: "OPS_INFRA", description: "LOOP AI coordination", agentCount: 8 },
  { name: "Model Router", family: "OPS_INFRA", description: "Model selection and routing", agentCount: 10 },
  { name: "Cost Engine", family: "OPS_INFRA", description: "Cost tracking and budgets", agentCount: 10 },
  { name: "Queue Management", family: "OPS_INFRA", description: "Task queue and scheduling", agentCount: 12 },
  { name: "Retry & Recovery", family: "OPS_INFRA", description: "Error recovery and retry", agentCount: 15 },
  { name: "Memory Engine", family: "OPS_INFRA", description: "Agent and content memory", agentCount: 12 },
  { name: "Backup & Storage", family: "OPS_INFRA", description: "Backup and storage management", agentCount: 10 },
  { name: "Notification", family: "OPS_INFRA", description: "Admin notifications", agentCount: 8 },
  { name: "OAuth Health", family: "OPS_INFRA", description: "Token health monitoring", agentCount: 8 },
  { name: "Self-Healing", family: "OPS_INFRA", description: "Infrastructure self-healing", agentCount: 10 },
];

export const LOOP_PHASES = [
  { id: "observe", label: "Observe", bn: "পর্যবেক্ষণ", icon: "👁️" },
  { id: "understand", label: "Understand", bn: "বোঝা", icon: "🧠" },
  { id: "plan", label: "Plan", bn: "পরিকল্পনা", icon: "📋" },
  { id: "delegate", label: "Delegate", bn: "অর্পণ", icon: "📤" },
  { id: "create", label: "Create", bn: "তৈরি", icon: "✨" },
  { id: "verify", label: "Verify", bn: "যাচাই", icon: "✓" },
  { id: "critique", label: "Critique", bn: "সমালোচনা", icon: "🔍" },
  { id: "correct", label: "Correct", bn: "সংশোধন", icon: "🔧" },
  { id: "evaluate", label: "Evaluate", bn: "মূল্যায়ন", icon: "📊" },
  { id: "publish", label: "Publish", bn: "প্রকাশ", icon: "🚀" },
  { id: "learn", label: "Learn", bn: "শেখা", icon: "📚" },
] as const;

export const QUALITY_MODES = [
  { id: "fast", label: "Fast", bn: "দ্রুত", desc: "one agent, minimum latency", threshold: 80 },
  { id: "balanced", label: "Balanced", bn: "ভারসাম্য", desc: "specialist + validator", threshold: 85 },
  { id: "quality", label: "Quality", bn: "মান", desc: "specialist + critic + fact checker", threshold: 90 },
  { id: "ultra", label: "Ultra", bn: "আল্ট্রা", desc: "multiple candidates + full review", threshold: 95 },
] as const;

export const ERROR_TYPES = [
  "CONTENT_ERROR", "FACT_ERROR", "LANGUAGE_ERROR", "IMAGE_ERROR", "VIDEO_ERROR",
  "VOICE_ERROR", "AUDIO_ERROR", "CHARACTER_ERROR", "STYLE_ERROR", "BRAND_ERROR",
  "SEO_ERROR", "PLATFORM_ERROR", "API_ERROR", "AUTH_ERROR", "RATE_LIMIT",
  "MODEL_ERROR", "RAG_ERROR", "SAFETY_ERROR", "QUALITY_ERROR", "TOOL_ERROR",
  "WORKFLOW_ERROR",
] as const;
