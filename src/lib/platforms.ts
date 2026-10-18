// Platform + image-size registry for ALO Learning Journey

export interface PlatformDef {
  id: string;
  name: string;
  bn: string;
  icon: string; // emoji
  color: string; // tailwind text color class
  bgColor: string;
  connected: boolean;
  scopes: string[];
  mediaSizes: { label: string; w: number; h: number }[];
}

export const PLATFORMS: PlatformDef[] = [
  {
    id: "facebook",
    name: "Facebook",
    bn: "ফেসবুক",
    icon: "📘",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    connected: true,
    scopes: ["pages_manage_posts", "pages_read_engagement"],
    mediaSizes: [
      { label: "Profile", w: 1080, h: 1080 },
      { label: "Cover", w: 1640, h: 624 },
      { label: "Feed", w: 1200, h: 630 },
    ],
  },
  {
    id: "instagram",
    name: "Instagram",
    bn: "ইনস্টাগ্রাম",
    icon: "📸",
    color: "text-pink-600",
    bgColor: "bg-pink-50",
    connected: true,
    scopes: ["instagram_content_publish"],
    mediaSizes: [
      { label: "Profile", w: 1080, h: 1080 },
      { label: "Square", w: 1080, h: 1080 },
      { label: "Portrait", w: 1080, h: 1350 },
      { label: "Reel cover", w: 1080, h: 1920 },
      { label: "Story", w: 1080, h: 1920 },
    ],
  },
  {
    id: "youtube",
    name: "YouTube",
    bn: "ইউটিউব",
    icon: "▶️",
    color: "text-red-600",
    bgColor: "bg-red-50",
    connected: true,
    scopes: ["youtube.upload"],
    mediaSizes: [
      { label: "Profile", w: 800, h: 800 },
      { label: "Thumbnail", w: 1280, h: 720 },
      { label: "Banner", w: 2560, h: 1440 },
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    bn: "টিকটক",
    icon: "🎵",
    color: "text-gray-900",
    bgColor: "bg-gray-100",
    connected: false,
    scopes: ["video.upload"],
    mediaSizes: [
      { label: "Profile", w: 1080, h: 1080 },
      { label: "Video", w: 1080, h: 1920 },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    bn: "লিংকডইন",
    icon: "💼",
    color: "text-sky-700",
    bgColor: "bg-sky-50",
    connected: false,
    scopes: ["w_member_social"],
    mediaSizes: [
      { label: "Profile", w: 400, h: 400 },
      { label: "Post", w: 1200, h: 627 },
      { label: "Cover", w: 1128, h: 191 },
    ],
  },
  {
    id: "x",
    name: "X (Twitter)",
    bn: "এক্স",
    icon: "✖️",
    color: "text-gray-900",
    bgColor: "bg-gray-100",
    connected: false,
    scopes: ["tweet.read", "tweet.write"],
    mediaSizes: [
      { label: "Profile", w: 800, h: 800 },
      { label: "Post", w: 1600, h: 900 },
      { label: "Header", w: 1500, h: 500 },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    bn: "হোয়াটসঅ্যাপ",
    icon: "💬",
    color: "text-green-600",
    bgColor: "bg-green-50",
    connected: true,
    scopes: ["whatsapp_business_messaging"],
    mediaSizes: [
      { label: "Profile", w: 1080, h: 1080 },
      { label: "Status", w: 1080, h: 1920 },
    ],
  },
  {
    id: "telegram",
    name: "Telegram",
    bn: "টেলিগ্রাম",
    icon: "✈️",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    connected: true,
    scopes: ["bot.messages"],
    mediaSizes: [{ label: "Post", w: 1280, h: 720 }],
  },
  {
    id: "pinterest",
    name: "Pinterest",
    bn: "পিন্টারেস্ট",
    icon: "📌",
    color: "text-red-700",
    bgColor: "bg-red-50",
    connected: false,
    scopes: ["boards:read", "pins:write"],
    mediaSizes: [{ label: "Pin", w: 1000, h: 1500 }],
  },
  {
    id: "threads",
    name: "Threads",
    bn: "থ্রেডস",
    icon: "🧵",
    color: "text-gray-900",
    bgColor: "bg-gray-100",
    connected: false,
    scopes: ["threads_basic"],
    mediaSizes: [{ label: "Post", w: 1080, h: 1350 }],
  },
  {
    id: "gbp",
    name: "Google Business",
    bn: "গুগল বিজনেস",
    icon: "📍",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    connected: false,
    scopes: ["business.manage"],
    mediaSizes: [{ label: "Post", w: 1200, h: 900 }],
  },
];

// Bengali parenting topic presets for the Content Studio
export const TOPIC_PRESETS: { topic: string; audience: string }[] = [
  { topic: "১৮ মাসের শিশুর ভাষা বিকাশে মায়ের ভূমিকা", audience: "নবজাতক-পিতামাতা" },
  { topic: "স্ক্রিন টাইম কমানোর ৫টি বাস্তব উপায়", audience: "প্রাক-প্রাথমিক পিতামাতা" },
  { topic: "রাগ করলে শিশুকে শান্ত করার কৌশল", audience: "পিতামাতা" },
  { topic: "প্রথম দিনের স্কুল প্রস্তুতি", audience: "প্রাথমিক পিতামাতা" },
  { topic: "শিশুর ঘুমের রুটিন তৈরি", audience: "নবজাতক-পিতামাতা" },
  { topic: "মায়ের মানসিক স্বাস্থ্য ও সংবেদনশীল প্যারেন্টিং", audience: "মায়েরা" },
];

export const TELEGRAM_COMMANDS = [
  { cmd: "/start", desc: "বট শুরু ও পরিচিতি", admin: false },
  { cmd: "/help", desc: "সব কমান্ডের তালিকা", admin: false },
  { cmd: "/ideas", desc: "নতুন কনটেন্ট আইডিয়া", admin: true },
  { cmd: "/create <topic>", desc: "নতুন কনটেন্ট প্যাকেজ তৈরি", admin: true },
  { cmd: "/status", desc: "পাইপলাইন স্ট্যাটাস", admin: true },
  { cmd: "/review", desc: "অনুমোদনের অপেক্ষায় আইটেম", admin: true },
  { cmd: "/approve <ID>", desc: "একটি আইটেম অনুমোদন", admin: true },
  { cmd: "/reject <ID>", desc: "একটি আইটেম প্রত্যাখ্যান", admin: true },
  { cmd: "/edit <ID>", desc: "আইটেম সম্পাদনার অনুরোধ", admin: true },
  { cmd: "/publish <ID>", desc: "অনুমোদিত আইটেম প্রকাশ", admin: true },
  { cmd: "/schedule <ID>", desc: "প্রকাশনা নির্ধারণ", admin: true },
  { cmd: "/analytics", desc: "সাম্প্রতিক অ্যানালিটিক্স", admin: true },
  { cmd: "/connections", desc: "সোশ্যাল সংযোগ স্ট্যাটাস", admin: true },
  { cmd: "/failures", desc: "ব্যর্থ জব তালিকা", admin: true },
  { cmd: "/comments", desc: "সংবেদনশীল মন্তব্য তালিকা", admin: true },
  { cmd: "/backups", desc: "ব্যাকআপ তালিকা", admin: true },
  { cmd: "/emergency_stop", desc: "জরুরি বন্ধ", admin: true },
  { cmd: "/resume", desc: "পুনরায় চালু", admin: true },
];

export const SAFETY_CHECKS = [
  "Child safety",
  "Medical claims",
  "Parent shaming",
  "Fear-based language",
  "Unsafe parenting advice",
  "Fake expert claims",
  "Guaranteed outcomes",
  "Violence",
  "Abuse",
  "Sexual content",
  "Political persuasion",
  "Religious hostility",
  "Copyright risk",
  "Platform policy risk",
  "Face-consent status",
  "Voice-consent status",
  "Deepfake risk",
  "Bengali grammar",
  "Subtitle accuracy",
  "Brand tone",
  "Image integrity",
  "Face consistency",
  "Lip-sync quality",
  "Audio quality",
  "CTA safety",
  "Comment safety",
];

export const FAMILY_CHARACTERS = [
  { id: "baby_girl", name: "Baby Girl", bn: "বেবি গার্ল", personType: "শিশু", emoji: "👶" },
  { id: "mother", name: "Mother", bn: "মা", personType: "অভিভাবক", emoji: "👩" },
  { id: "father", name: "Father", bn: "বাবা", personType: "অভিভাবক", emoji: "👨" },
  { id: "teacher", name: "Teacher", bn: "শিক্ষক", personType: "শিক্ষক", emoji: "🧑‍🏫" },
  { id: "narrator", name: "Narrator", bn: "বর্ণনাকারী", personType: "বর্ণনা", emoji: "🎙️" },
];
