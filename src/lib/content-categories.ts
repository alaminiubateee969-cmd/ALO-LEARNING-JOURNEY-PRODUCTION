// ALO Learning Journey — Content Categories & Age Groups
// 37 categories × 8 age groups = 296 content combinations

export interface ContentCategory {
  id: string;
  name: string;
  bn: string;
  icon: string;
  family: string;
}

export interface AgeGroup {
  id: string;
  label: string;
  bn: string;
  range: string;
  icon: string;
}

export const CATEGORIES: ContentCategory[] = [
  // Baby Learning
  { id: "baby-learning", name: "Baby Learning", bn: "বেবি লার্নিং", icon: "👶", family: "Baby" },
  { id: "child-development", name: "Child Development", bn: "শিশুর বিকাশ", icon: "🌱", family: "Development" },
  { id: "parenting", name: "Parenting", bn: "প্যারেন্টিং", icon: "👨‍👩‍👧", family: "Parenting" },
  { id: "early-education", name: "Early Childhood Education", bn: "প্রাথমিক শিক্ষা", icon: "📚", family: "Education" },
  { id: "speech-language", name: "Speech & Language Development", bn: "ভাষা বিকাশ", icon: "💬", family: "Development" },
  { id: "play-based-learning", name: "Play-Based Learning", bn: "খেলার মাধ্যমে শেখা", icon: "🎲", family: "Learning" },
  { id: "reading", name: "Reading", bn: "পড়াশোনা", icon: "📖", family: "Learning" },
  { id: "storytelling", name: "Storytelling", bn: "গল্প বলা", icon: "📖", family: "Content" },
  { id: "vocabulary", name: "Vocabulary", bn: "শব্দভান্ডার", icon: "🔤", family: "Learning" },
  { id: "numbers", name: "Numbers", bn: "সংখ্যা", icon: "🔢", family: "Learning" },
  { id: "colors", name: "Colors", bn: "রং শেখা", icon: "🎨", family: "Learning" },
  { id: "shapes", name: "Shapes", bn: "আকার", icon: "⭐", family: "Learning" },
  { id: "memory", name: "Memory", bn: "স্মৃতি", icon: "🧠", family: "Cognitive" },
  { id: "problem-solving", name: "Problem Solving", bn: "সমস্যা সমাধান", icon: "🧩", family: "Cognitive" },
  { id: "emotional-development", name: "Emotional Development", bn: "আবেগ বিকাশ", icon: "💛", family: "Development" },
  { id: "positive-parenting", name: "Positive Parenting", bn: "ইতিবাচক প্যারেন্টিং", icon: "✨", family: "Parenting" },
  { id: "parent-child-bond", name: "Parent-Child Bond", bn: "বন্ধন", icon: "🤗", family: "Parenting" },
  { id: "screen-time", name: "Screen Time", bn: "স্ক্রিন টাইম", icon: "📱", family: "Safety" },
  { id: "digital-safety", name: "Digital Safety", bn: "ডিজিটাল নিরাপত্তা", icon: "🔒", family: "Safety" },
  { id: "sleep", name: "Sleep", bn: "ঘুম", icon: "😴", family: "Health" },
  { id: "nutrition", name: "Nutrition", bn: "পুষ্টি", icon: "🥗", family: "Health" },
  { id: "hygiene", name: "Hygiene", bn: "স্বাস্থ্যবিধি", icon: "🧼", family: "Health" },
  { id: "daily-activities", name: "Daily Activities", bn: "দৈনন্দিন কার্যক্রম", icon: "☀️", family: "Parenting" },
  { id: "school-readiness", name: "School Readiness", bn: "স্কুল প্রস্তুতি", icon: "🎒", family: "Education" },
  { id: "toddler-learning", name: "Toddler Learning", bn: "টডলার শেখা", icon: "🧒", family: "Learning" },
  { id: "preschool-learning", name: "Preschool Learning", bn: "প্রি-স্কুল", icon: "🏫", family: "Education" },
  { id: "creative-activities", name: "Creative Activities", bn: "সৃজনশীল কার্যক্রম", icon: "🎨", family: "Learning" },
  { id: "home-learning", name: "Home Learning", bn: "ঘরে শেখা", icon: "🏠", family: "Learning" },
  { id: "teacher-tips", name: "Teacher Tips", bn: "শিক্ষকের টিপস", icon: "👩‍🏫", family: "Education" },
  { id: "parenting-mistakes", name: "Parenting Mistakes", bn: "প্যারেন্টিং ভুল", icon: "⚠️", family: "Parenting" },
  { id: "parenting-questions", name: "Common Parenting Questions", bn: "সাধারণ প্রশ্ন", icon: "❓", family: "Parenting" },
  { id: "age-based-learning", name: "Age-Based Learning", bn: "বয়স অনুযায়ী", icon: "📊", family: "Learning" },
  { id: "educational-games", name: "Educational Games", bn: "শিক্ষামূলক খেলা", icon: "🎯", family: "Learning" },
  { id: "family-activities", name: "Family Activities", bn: "পারিবারিক কার্যক্রম", icon: "👨‍👩‍👧‍👦", family: "Parenting" },
  { id: "expert-interviews", name: "Expert Interviews", bn: "বিশেষজ্ঞ সাক্ষাৎকার", icon: "🎤", family: "Content" },
  { id: "parent-stories", name: "Parent Stories", bn: "অভিভাবকের গল্প", icon: "📝", family: "Content" },
  { id: "teacher-stories", name: "Teacher Stories", bn: "শিক্ষকের গল্প", icon: "📖", family: "Content" },
];

export const AGE_GROUPS: AgeGroup[] = [
  { id: "0-6m", label: "0-6 months", bn: "০-৬ মাস", range: "newborn", icon: "🍼" },
  { id: "6-12m", label: "6-12 months", bn: "৬-১২ মাস", range: "infant", icon: "👶" },
  { id: "1-2y", label: "1-2 years", bn: "১-২ বছর", range: "toddler", icon: "🧒" },
  { id: "2-3y", label: "2-3 years", bn: "২-৩ বছর", range: "toddler", icon: "🧒" },
  { id: "3-4y", label: "3-4 years", bn: "৩-৪ বছর", range: "preschool", icon: "👶" },
  { id: "4-5y", label: "4-5 years", bn: "৪-৫ বছর", range: "preschool", icon: "🏫" },
  { id: "5-6y", label: "5-6 years", bn: "৫-৬ বছর", range: "kindergarten", icon: "🎒" },
  { id: "6+y", label: "6+ years", bn: "৬+ বছর", range: "school-age", icon: "📚" },
];

// SEO keyword clusters for topical authority
export const SEO_CLUSTERS = [
  {
    name: "Child Development",
    bn: "শিশুর বিকাশ",
    pillar: "শিশুর বিকাশ: সম্পূর্ণ গাইড",
    keywords: [
      "শিশুর বিকাশ", "শিশুর মানসিক বিকাশ", "শিশুর শারীরিক বিকাশ",
      "child development Bangladesh", "baby development milestones",
      "toddler development", "শিশুর বুদ্ধি বৃদ্ধি",
    ],
    subtopics: [
      "Baby Development", "Toddler Development", "Language Development",
      "Cognitive Development", "Social Development", "Emotional Development",
      "Motor Skills", "Learning Activities",
    ],
  },
  {
    name: "Parenting Guide",
    bn: "প্যারেন্টিং গাইড",
    pillar: "প্যারেন্টিং: বাংলাদেশি বাবা-মায়ের জন্য সম্পূর্ণ গাইড",
    keywords: [
      "parenting tips Bangladesh", "প্যারেন্টিং টিপস", "বাবা মায়ের দায়িত্ব",
      "positive parenting", "শিশু প্যারেন্টিং", "বাচ্চাদের প্যারেন্টিং",
      "parenting guide Bengali",
    ],
    subtopics: [
      "Positive Parenting", "Parent-Child Bond", "Parenting Mistakes",
      "Screen Time", "Daily Activities", "Parenting Questions",
    ],
  },
  {
    name: "Baby Learning",
    bn: "বেবি লার্নিং",
    pillar: "বাচ্চাদের শেখার পদ্ধতি: সম্পূর্ণ গাইড",
    keywords: [
      "baby learning activities", "বাচ্চাদের শেখার পদ্ধতি",
      "শিশুকে কীভাবে শেখাব", "শিক্ষামূলক খেলা",
      "toddler activities", "preschool learning", "early learning",
    ],
    subtopics: [
      "Play-Based Learning", "Reading", "Vocabulary", "Numbers",
      "Colors", "Shapes", "Memory", "Educational Games",
    ],
  },
  {
    name: "Early Education",
    bn: "প্রাথমিক শিক্ষা",
    pillar: "প্রাথমিক শিক্ষা: বাংলাদেশি বাবা-মায়ের জন্য",
    keywords: [
      "early childhood education", "preschool learning",
      "school readiness", "শিশুর স্কুল প্রস্তুতি",
      "home learning", "শিক্ষকের টিপস",
    ],
    subtopics: [
      "School Readiness", "Preschool Learning", "Home Learning",
      "Teacher Tips", "Creative Activities", "Age-Based Learning",
    ],
  },
];

// Family character definitions
export const FAMILY_CAST = [
  { id: "baby", name: "Baby", bn: "বেবি", role: "শিশু", emoji: "👶", consentRequired: true },
  { id: "father", name: "Father", bn: "বাবা", role: "অভিভাবক", emoji: "👨", consentRequired: true },
  { id: "mother", name: "Mother", bn: "মা", role: "অভিভাবক", emoji: "👩", consentRequired: true },
  { id: "teacher", name: "Teacher", bn: "শিক্ষক", role: "শিক্ষক", emoji: "👩‍🏫", consentRequired: true },
];

// Recurring content formats
export const RECURRING_FORMATS = [
  "Amin & Baby Learning Time",
  "Mom & Baby Discovery",
  "Family Learning Challenge",
  "5-Minute Baby Activity",
  "Teacher Tips Tuesday",
  "Parenting Mistake Monday",
  "Story Time Saturday",
  "Expert Sunday",
];

// Weekly content calendar template
export const WEEKLY_CALENDAR = [
  { day: "Monday", bn: "সোম", theme: "Parenting tip", category: "parenting", icon: "💡" },
  { day: "Tuesday", bn: "মঙ্গল", theme: "Teacher activity", category: "teacher-tips", icon: "👩‍🏫" },
  { day: "Wednesday", bn: "বুধ", theme: "Baby learning", category: "baby-learning", icon: "👶" },
  { day: "Thursday", bn: "বৃহ", theme: "Family story", category: "family-activities", icon: "📖" },
  { day: "Friday", bn: "শুক্র", theme: "Expert advice", category: "expert-interviews", icon: "🎤" },
  { day: "Saturday", bn: "শনি", theme: "Family activity", category: "family-activities", icon: "🎲" },
  { day: "Sunday", bn: "রবি", theme: "Q&A / engagement", category: "parenting-questions", icon: "❓" },
];
