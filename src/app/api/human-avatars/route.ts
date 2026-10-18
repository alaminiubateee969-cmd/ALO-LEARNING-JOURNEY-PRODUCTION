import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  AVATAR_PRESETS,
  PERSONA_LABELS,
  OUTFIT_PRESETS,
  SCENE_PRESETS,
  buildPortraitPrompt,
} from '@/lib/human-avatars';
import {
  parseJsonBody, validateId, validatePersona, validateVoice, validateGender,
  badRequest,
} from '@/lib/validation';
import { requireOwner } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { log, newJobId, truncatePrompt } from '@/lib/observability';
import { cleanupAvatarFiles, cleanupVideoFiles } from '@/lib/cleanup';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * ALO Human Avatar API — PRODUCTION REPAIR
 * Ownership-scoped CRUD. Validation via lib/validation. Rate limit on portrait gen.
 * DELETE cascades to videos + cleans up files safely.
 */

// GET — list owner's avatars + presets
export async function GET() {
  try {
    const owner = await requireOwner();
    const avatars = await db.humanAvatar.findMany({
      where: { ownerId: owner.ownerId },
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: { _count: { select: { videos: true } } },
    });
    const stats = {
      total: avatars.length,
      active: avatars.filter((a) => a.active).length,
      generated: avatars.filter((a) => a.portraitStatus === 'generated').length,
      pending: avatars.filter((a) => a.portraitStatus === 'pending').length,
      failed: avatars.filter((a) => a.portraitStatus === 'failed').length,
      totalVideos: avatars.reduce((s, a) => s + (a._count?.videos || 0), 0),
    };
    return NextResponse.json({
      avatars,
      presets: AVATAR_PRESETS,
      personaLabels: PERSONA_LABELS,
      outfitPresets: OUTFIT_PRESETS,
      scenePresets: SCENE_PRESETS,
      stats,
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

// POST — create / generate_portrait / seed_presets / delete
export async function POST(req: NextRequest) {
  const jobId = newJobId();
  let ownerId: string;
  try {
    ownerId = (await requireOwner()).ownerId;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return badRequest('body', parsed.error);
  const body = parsed.value;
  const action: string = body.action || 'create';

  // ---------- DELETE ----------
  if (action === 'delete') {
    const idV = validateId(body.id, 'id');
    if (!idV.ok) return badRequest('id', idV.error);
    const avatar = await db.humanAvatar.findFirst({ where: { id: idV.value, ownerId } });
    if (!avatar) {
      return NextResponse.json({ ok: false, error: 'Avatar not found' }, { status: 404 });
    }
    // fetch dependent videos for cleanup
    const videos = await db.avatarVideo.findMany({
      where: { avatarId: avatar.id },
      select: { id: true, videoUrl: true, thumbnailUrl: true, scenesJson: true },
    });
    // delete avatar (cascade deletes videos via Prisma relation)
    await db.humanAvatar.delete({ where: { id: avatar.id } });
    // cleanup files (portrait + all video files)
    const cleanup = cleanupAvatarFiles({
      avatarId: avatar.id,
      portraitUrl: avatar.portraitUrl?.split('?')[0],
      videos: videos.map((v) => ({
        id: v.id,
        videoUrl: v.videoUrl?.split('?')[0],
        thumbnailUrl: v.thumbnailUrl?.split('?')[0],
        scenesJson: v.scenesJson,
      })),
    });
    log('info', 'avatar-deleted', { ownerId, avatarId: avatar.id, filesDeleted: cleanup.deleted.length });
    return NextResponse.json({ ok: true, id: avatar.id, filesDeleted: cleanup.deleted.length, cascadedVideos: videos.length });
  }

  // ---------- SEED PRESETS ----------
  if (action === 'seed_presets') {
    const rl = checkRateLimit(ownerId);
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 });
    }
    const created: string[] = [];
    for (const preset of AVATAR_PRESETS) {
      const existing = await db.humanAvatar.findFirst({ where: { name: preset.name, ownerId } });
      if (existing) {
        created.push(`${preset.name} (skipped — exists)`);
        continue;
      }
      const avatar = await db.humanAvatar.create({
        data: {
          ownerId,
          name: preset.name,
          persona: preset.persona,
          gender: preset.gender,
          ageRange: preset.ageRange,
          ethnicity: 'bengali',
          faceDescription: preset.faceDescription,
          voiceProfile: preset.voiceProfile,
          voiceSpeed: preset.voiceSpeed,
          backgroundStory: preset.backgroundStory,
          consistencySeed: crypto.createHash('md5').update(preset.id).digest('hex').slice(0, 8),
          outfitStyle: preset.outfitStyle,
          sceneContext: preset.sceneContext,
          portraitStatus: 'pending',
        },
      });
      created.push(`${avatar.name} (id: ${avatar.id})`);
    }
    log('info', 'presets-seeded', { ownerId, count: created.length });
    return NextResponse.json({ ok: true, seeded: created.length, details: created });
  }

  // ---------- GENERATE PORTRAIT ----------
  if (action === 'generate_portrait') {
    const idV = validateId(body.avatarId, 'avatarId');
    if (!idV.ok) return badRequest('avatarId', idV.error);
    const avatar = await db.humanAvatar.findFirst({ where: { id: idV.value, ownerId } });
    if (!avatar) {
      return NextResponse.json({ ok: false, error: 'Avatar not found' }, { status: 404 });
    }
    await db.humanAvatar.update({
      where: { id: avatar.id },
      data: { portraitStatus: 'pending' },
    });
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();
      const prompt = buildPortraitPrompt(avatar);
      log('info', 'portrait-gen-start', { jobId, avatarId: avatar.id, promptPreview: truncatePrompt(prompt) });
      const response = await zai.images.generations.create({ prompt, size: '864x1152' });
      const base64 = response.data[0].base64;
      const buffer = Buffer.from(base64, 'base64');
      const dir = path.join(process.cwd(), 'public', 'avatars');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filename = `avatar_${avatar.id}.png`;
      fs.writeFileSync(path.join(dir, filename), buffer);
      const url = `/avatars/${filename}`;
      const updated = await db.humanAvatar.update({
        where: { id: avatar.id },
        data: { portraitUrl: url, portraitStatus: 'generated' },
      });
      log('info', 'portrait-gen-complete', { jobId, avatarId: avatar.id, bytes: buffer.length });
      return NextResponse.json({ ok: true, avatar: updated, portraitUrl: url, promptUsed: prompt });
    } catch (genErr) {
      await db.humanAvatar.update({
        where: { id: avatar.id },
        data: { portraitStatus: 'failed' },
      });
      log('error', 'portrait-gen-failed', { jobId, avatarId: avatar.id, error: (genErr as Error).message });
      return NextResponse.json({ ok: false, error: (genErr as Error).message }, { status: 500 });
    }
  }

  // ---------- CREATE ----------
  const {
    presetId,
    name: rawName,
    persona: rawPersona,
    gender: rawGender,
    ageRange: rawAge,
    ethnicity = 'bengali',
    faceDescription: rawFace,
    voiceProfile: rawVoice,
    voiceSpeed = 0.95,
    outfitStyle: rawOutfit,
    sceneContext: rawScene,
    backgroundStory = '',
    generatePortrait = true,
  } = body;

  let finalData: {
    name: string; persona: string; gender: string; ageRange: string;
    ethnicity: string; faceDescription: string; voiceProfile: string;
    voiceSpeed: number; outfitStyle: string; sceneContext: string;
    backgroundStory: string; consistencySeed: string;
  };

  if (presetId) {
    const preset = AVATAR_PRESETS.find((p) => p.id === presetId);
    if (!preset) {
      return NextResponse.json({ ok: false, error: `Unknown preset: ${presetId}` }, { status: 400 });
    }
    finalData = {
      name: (typeof rawName === 'string' && rawName.trim()) ? rawName.trim() : preset.name,
      persona: preset.persona,
      gender: preset.gender,
      ageRange: preset.ageRange,
      ethnicity: 'bengali',
      faceDescription: preset.faceDescription,
      voiceProfile: preset.voiceProfile,
      voiceSpeed: preset.voiceSpeed,
      outfitStyle: preset.outfitStyle,
      sceneContext: preset.sceneContext,
      backgroundStory: preset.backgroundStory,
      consistencySeed: crypto.createHash('md5').update(preset.id).digest('hex').slice(0, 8),
    };
  } else {
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    const ageRange = typeof rawAge === 'string' ? rawAge.trim() : '';
    const faceDescription = typeof rawFace === 'string' ? rawFace.trim() : '';
    const outfitStyle = typeof rawOutfit === 'string' ? rawOutfit.trim() : '';
    const sceneContext = typeof rawScene === 'string' ? rawScene.trim() : '';
    if (!name) return badRequest('name', 'name is required');
    if (!ageRange) return badRequest('ageRange', 'ageRange is required');
    if (!faceDescription) return badRequest('faceDescription', 'faceDescription is required');
    if (!outfitStyle) return badRequest('outfitStyle', 'outfitStyle is required');
    if (!sceneContext) return badRequest('sceneContext', 'sceneContext is required');
    const personaV = validatePersona(rawPersona);
    if (!personaV.ok) return badRequest('persona', personaV.error);
    const genderV = validateGender(rawGender);
    if (!genderV.ok) return badRequest('gender', genderV.error);
    const voiceV = validateVoice(rawVoice);
    if (!voiceV.ok) return badRequest('voiceProfile', voiceV.error);
    if (typeof voiceSpeed !== 'number' || voiceSpeed < 0.5 || voiceSpeed > 2.0) {
      return badRequest('voiceSpeed', 'voiceSpeed must be between 0.5 and 2.0');
    }
    finalData = {
      name, persona: personaV.value, gender: genderV.value, ageRange, ethnicity,
      faceDescription, voiceProfile: voiceV.value, voiceSpeed, outfitStyle, sceneContext,
      backgroundStory, consistencySeed: crypto.createHash('md5').update(name + personaV.value + Date.now()).digest('hex').slice(0, 8),
    };
  }

  const avatar = await db.humanAvatar.create({
    data: { ...finalData, ownerId, portraitStatus: 'pending' },
  });
  log('info', 'avatar-created', { ownerId, avatarId: avatar.id, fromPreset: !!presetId });

  if (generatePortrait) {
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();
      const prompt = buildPortraitPrompt(avatar);
      const response = await zai.images.generations.create({ prompt, size: '864x1152' });
      const base64 = response.data[0].base64;
      const buffer = Buffer.from(base64, 'base64');
      const dir = path.join(process.cwd(), 'public', 'avatars');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filename = `avatar_${avatar.id}.png`;
      fs.writeFileSync(path.join(dir, filename), buffer);
      const url = `/avatars/${filename}`;
      const updated = await db.humanAvatar.update({
        where: { id: avatar.id },
        data: { portraitUrl: url, portraitStatus: 'generated' },
      });
      return NextResponse.json({ ok: true, avatar: updated, portraitUrl: url, promptUsed: prompt, fromPreset: !!presetId });
    } catch (genErr) {
      await db.humanAvatar.update({
        where: { id: avatar.id },
        data: { portraitStatus: 'failed' },
      });
      return NextResponse.json({
        ok: true, avatar, portraitUrl: null,
        warning: `Avatar created but portrait generation failed: ${(genErr as Error).message}`,
        fromPreset: !!presetId,
      });
    }
  }
  return NextResponse.json({ ok: true, avatar, fromPreset: !!presetId });
}

// DELETE — delete avatar (owner-scoped, cascade)
export async function DELETE(req: NextRequest) {
  try {
    const owner = await requireOwner();
    const parsed = await parseJsonBody(req);
    if (!parsed.ok) return badRequest('body', parsed.error);
    const idV = validateId(parsed.value.id, 'id');
    if (!idV.ok) return badRequest('id', idV.error);
    const avatar = await db.humanAvatar.findFirst({ where: { id: idV.value, ownerId: owner.ownerId } });
    if (!avatar) return NextResponse.json({ ok: false, error: 'Avatar not found' }, { status: 404 });
    const videos = await db.avatarVideo.findMany({
      where: { avatarId: avatar.id },
      select: { id: true, videoUrl: true, thumbnailUrl: true, scenesJson: true },
    });
    await db.humanAvatar.delete({ where: { id: avatar.id } });
    const cleanup = cleanupAvatarFiles({
      avatarId: avatar.id,
      portraitUrl: avatar.portraitUrl?.split('?')[0],
      videos: videos.map((v) => ({
        id: v.id, videoUrl: v.videoUrl?.split('?')[0], thumbnailUrl: v.thumbnailUrl?.split('?')[0], scenesJson: v.scenesJson,
      })),
    });
    log('info', 'avatar-deleted', { ownerId: owner.ownerId, avatarId: avatar.id, filesDeleted: cleanup.deleted.length });
    return NextResponse.json({ ok: true, id: avatar.id, filesDeleted: cleanup.deleted.length, cascadedVideos: videos.length });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
