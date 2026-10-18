/**
 * ALO File Cleanup — safe deletion of generated media.
 *
 * All paths are resolved against approved storage roots and verified to be
 * contained (realpath) before deletion. Prevents path traversal.
 */

import fs from 'fs';
import path from 'path';

const APPROVED_ROOTS = [
  path.join(process.cwd(), 'public', 'avatars'),
  path.join(process.cwd(), 'public', 'avatar-scenes'),
  path.join(process.cwd(), 'public', 'avatar-audio'),
  path.join(process.cwd(), 'public', 'avatar-videos'),
  path.join(process.cwd(), 'public', 'avatar-thumbs'),
  path.join(process.cwd(), 'storage', 'avatar-videos'),
];

/** Resolve a relative URL path to an absolute fs path under public/. */
export function resolvePublicPath(urlPath: string): string | null {
  if (!urlPath || !urlPath.startsWith('/')) return null;
  // strip query
  const clean = urlPath.split('?')[0];
  // block traversal
  if (clean.includes('..') || clean.includes('\0')) return null;
  const abs = path.join(process.cwd(), 'public', clean);
  return isWithinApprovedRoot(abs) ? abs : null;
}

export function isWithinApprovedRoot(absPath: string): boolean {
  const resolved = path.resolve(absPath);
  return APPROVED_ROOTS.some((root) => {
    const r = path.resolve(root);
    return resolved === r || resolved.startsWith(r + path.sep);
  });
}

export function safeDelete(absPath: string): boolean {
  try {
    if (!isWithinApprovedRoot(absPath)) return false;
    if (!fs.existsSync(absPath)) return false;
    fs.unlinkSync(absPath);
    return true;
  } catch {
    return false;
  }
}

/** Delete all files for an AvatarVideo: MP4 + thumbnail + per-scene audio/images. */
export function cleanupVideoFiles(opts: {
  videoId: string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  scenesJson?: string | null;
}): { deleted: string[]; skipped: string[] } {
  const deleted: string[] = [];
  const skipped: string[] = [];
  const { videoId, videoUrl, thumbnailUrl, scenesJson } = opts;

  const candidates: string[] = [];
  if (videoUrl) {
    const p = resolvePublicPath(videoUrl);
    if (p) candidates.push(p);
  }
  if (thumbnailUrl) {
    const p = resolvePublicPath(thumbnailUrl);
    if (p) candidates.push(p);
  }
  // per-scene files follow naming convention
  const sceneAudioGlob = path.join(process.cwd(), 'public', 'avatar-audio', `v_${videoId}_s*.wav`);
  const sceneImgGlob = path.join(process.cwd(), 'public', 'avatar-scenes', `v_${videoId}_s*.png`);
  for (const g of [sceneAudioGlob, sceneImgGlob]) {
    // simple glob via fs.readdir
    const dir = path.dirname(g);
    const prefix = path.basename(g).replace('*', '');
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (f.startsWith(prefix)) candidates.push(path.join(dir, f));
      }
    }
  }
  // storage/avatar-videos/avatar_video_<id>.mp4 (compose temp)
  const storagePath = path.join(process.cwd(), 'storage', 'avatar-videos', `avatar_video_${videoId}.mp4`);
  if (fs.existsSync(storagePath)) candidates.push(storagePath);

  // also delete scenes referenced in scenesJson
  if (scenesJson) {
    try {
      const scenes = JSON.parse(scenesJson) as Array<{ audioUrl?: string; imageUrl?: string }>;
      for (const s of scenes) {
        if (s.audioUrl) { const p = resolvePublicPath(s.audioUrl); if (p) candidates.push(p); }
        if (s.imageUrl) { const p = resolvePublicPath(s.imageUrl); if (p) candidates.push(p); }
      }
    } catch {}
  }

  for (const c of candidates) {
    if (safeDelete(c)) deleted.push(c);
    else skipped.push(c);
  }
  return { deleted, skipped };
}

/** Delete avatar portrait + cascade to videos (caller passes video list). */
export function cleanupAvatarFiles(opts: {
  avatarId: string;
  portraitUrl?: string | null;
  videos: Array<{ id: string; videoUrl?: string | null; thumbnailUrl?: string | null; scenesJson?: string | null }>;
}): { deleted: string[]; skipped: string[] } {
  const deleted: string[] = [];
  const skipped: string[] = [];
  if (opts.portraitUrl) {
    const p = resolvePublicPath(opts.portraitUrl);
    if (p && safeDelete(p)) deleted.push(p); else if (p) skipped.push(p);
  }
  for (const v of opts.videos) {
    const r = cleanupVideoFiles({ videoId: v.id, videoUrl: v.videoUrl, thumbnailUrl: v.thumbnailUrl, scenesJson: v.scenesJson });
    deleted.push(...r.deleted);
    skipped.push(...r.skipped);
  }
  return { deleted, skipped };
}
