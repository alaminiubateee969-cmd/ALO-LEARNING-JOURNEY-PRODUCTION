/**
 * ALO Human Avatar Library
 * Pre-defined human agent personas with consistent face descriptions,
 * voice mapping, and outfit/scene presets. Used to bootstrap avatars
 * instantly and to provide face-consistency seed prompts.
 */

export type AvatarPreset = {
  id: string;
  name: string;
  bnName: string;
  persona: string;
  gender: 'male' | 'female';
  ageRange: string;
  voiceProfile: 'tongtong' | 'chuichui' | 'xiaochen' | 'jam' | 'kazi' | 'douji' | 'luodo';
  voiceSpeed: number;
  faceDescription: string;
  backgroundStory: string;
  outfitStyle: string;
  sceneContext: string;
  bestFor: string;
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'megha-mother',
    name: 'Megha',
    bnName: 'মেঘা',
    persona: 'mother',
    gender: 'female',
    ageRange: '28-34',
    voiceProfile: 'tongtong',
    voiceSpeed: 0.95,
    faceDescription:
      'Warm Bengali mother, soft oval face, gentle brown eyes, subtle kohl eyeliner, warm tan skin tone, shoulder-length dark hair tied back, kind reassuring smile, small bindi, natural makeup',
    backgroundStory:
      'Megha is a gentle Bengali mother of two young children. She speaks softly, with warmth and patience, sharing parenting wisdom from everyday experience.',
    outfitStyle: 'elegant cotton saree in pastel tones',
    sceneContext: 'cozy home living room with soft natural window light, warm wooden tones',
    bestFor: 'Parenting tips, baby care, emotional guidance, daily routines',
  },
  {
    id: 'aditya-father',
    name: 'Aditya',
    bnName: 'আদিত্য',
    persona: 'father',
    gender: 'male',
    ageRange: '32-38',
    voiceProfile: 'douji',
    voiceSpeed: 1.0,
    faceDescription:
      'Friendly Bengali father, square jaw, short neat black hair, light stubble, warm brown eyes, confident calm expression, medium tan skin, approachable smile',
    backgroundStory:
      'Aditya is a hands-on father who loves teaching through play. He explains concepts simply and encouragingly.',
    outfitStyle: 'casual checked shirt with sleeves rolled up',
    sceneContext: 'bright home study room with bookshelf, warm afternoon light',
    bestFor: 'Activity demos, learning-through-play, father-child bonding',
  },
  {
    id: 'rahim-teacher',
    name: 'Rahim Sir',
    bnName: 'রহিম স্যার',
    persona: 'teacher',
    gender: 'male',
    ageRange: '40-48',
    voiceProfile: 'kazi',
    voiceSpeed: 0.9,
    faceDescription:
      'Distinguished Bengali male teacher, neat greying hair, wire-rimmed glasses, trimmed beard, thoughtful expression, warm but authoritative, medium skin tone',
    backgroundStory:
      'Rahim Sir is an experienced early-childhood educator with 20 years of teaching. He explains with clarity and patience.',
    outfitStyle: 'formal panjabi with a light shawl',
    sceneContext: 'classroom with chalkboard backdrop, soft diffused light',
    bestFor: 'Educational explainers, curriculum topics, study guidance',
  },
  {
    id: 'tania-expert',
    name: 'Dr. Tania',
    bnName: 'ডা. তানিয়া',
    persona: 'doctor',
    gender: 'female',
    ageRange: '34-42',
    voiceProfile: 'xiaochen',
    voiceSpeed: 0.95,
    faceDescription:
      'Professional Bengali female pediatrician, neat bob haircut, minimal makeup, warm confident eyes, stethoscope, calm reassuring expression, fair tan skin',
    backgroundStory:
      'Dr. Tania is a pediatrician who translates medical knowledge into simple reassuring advice for parents.',
    outfitStyle: 'white doctor coat over a teal blouse',
    sceneContext: 'clean clinic office with soft lighting, medical chart backdrop',
    bestFor: 'Health, nutrition, child development milestones, medical reassurance',
  },
  {
    id: 'farzana-narrator',
    name: 'Farzana',
    bnName: 'ফরজানা',
    persona: 'narrator',
    gender: 'female',
    ageRange: '26-32',
    voiceProfile: 'chuichui',
    voiceSpeed: 1.0,
    faceDescription:
      'Youthful Bengali female narrator, bright expressive eyes, long dark hair, friendly animated expression, warm golden skin tone, engaging storyteller look',
    backgroundStory:
      'Farzana is a lively storyteller who narrates children’s tales and educational rhymes with playful energy.',
    outfitStyle: 'colorful salwar kameez',
    sceneContext: 'bright colorful playroom with soft toys and books',
    bestFor: 'Storytelling, rhymes, kids content, playful narration',
  },
  {
    id: 'karim-uncle',
    name: 'Karim Uncle',
    bnName: 'করিম চাচা',
    persona: 'expert',
    gender: 'male',
    ageRange: '50-58',
    voiceProfile: 'jam',
    voiceSpeed: 0.92,
    faceDescription:
      'Wise elderly Bengali man, silver hair, full grey beard, deep thoughtful eyes, weathered kind face, warm dignified expression, light tan skin',
    backgroundStory:
      'Karim Uncle is a respected community elder who shares traditional wisdom and time-tested parenting values.',
    outfitStyle: 'white panjabi with a checked lungi pattern shawl',
    sceneContext: 'traditional veranda with green plants, golden hour light',
    bestFor: 'Cultural wisdom, traditional practices, values, generational advice',
  },
];

export const PERSONA_LABELS: Record<string, { en: string; bn: string }> = {
  mother: { en: 'Mother', bn: 'মা' },
  father: { en: 'Father', bn: 'বাবা' },
  teacher: { en: 'Teacher', bn: 'শিক্ষক' },
  narrator: { en: 'Narrator', bn: 'কথক' },
  doctor: { en: 'Doctor', bn: 'ডাক্তার' },
  expert: { en: 'Expert', bn: 'বিশেষজ্ঞ' },
};

export const OUTFIT_PRESETS = [
  'saree', 'salwar kameez', 'panjabi', 'checked shirt', 'formal shirt', 'doctor coat',
  'casual t-shirt', 'kurta', 'maxi dress',
];

export const SCENE_PRESETS = [
  'home living room', 'study room with bookshelf', 'classroom', 'clinic office',
  'playroom with toys', 'garden veranda', 'kitchen', 'outdoor park',
  'cozy reading corner', 'studio backdrop',
];

/**
 * Build a face-consistency prompt for portrait generation.
 * Combines face description + outfit + scene + photographic directives
 * so the same avatar regenerates a recognisably similar face.
 */
export function buildPortraitPrompt(avatar: {
  faceDescription: string;
  gender: string;
  ageRange: string;
  ethnicity: string;
  outfitStyle: string | null;
  sceneContext: string | null;
}): string {
  return [
    `Professional portrait photograph of a ${avatar.ageRange} year old ${avatar.gender} ${avatar.ethnicity} person`,
    avatar.faceDescription,
    `wearing ${avatar.outfitStyle || 'casual clothing'}`,
    `setting: ${avatar.sceneContext || 'neutral studio background'}`,
    'looking directly at camera, centered composition, head and shoulders',
    'soft natural lighting, shallow depth of field, 85mm lens, photorealistic',
    'high detail face, sharp eyes, natural skin texture, professional color grading',
    'high quality, 4k, cinematic portrait',
  ].join(', ');
}

/**
 * Build a scene-image prompt where the avatar appears in a specific
 * scene context (e.g. "mother helping child with homework"). Reuses
 * the face description for consistency but framed mid-action.
 */
export function buildSceneImagePrompt(
  avatar: { faceDescription: string; outfitStyle: string; sceneContext: string },
  sceneAction: string
): string {
  return [
    `Cinematic scene: ${sceneAction}`,
    `featuring a person with: ${avatar.faceDescription}`,
    `wearing ${avatar.outfitStyle}`,
    `setting: ${avatar.sceneContext}`,
    'natural expressive pose, mid-action, eye contact with camera',
    'soft cinematic lighting, 35mm lens, shallow depth of field, photorealistic',
    'warm color grade, high quality, 4k, detailed',
  ].join(', ');
}
