import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner } from '@/lib/auth';
import { resolvePublicPath } from '@/lib/cleanup';
import fs from 'fs';

/**
 * GET /api/avatar-video/file?id=<videoId>
 * Authenticated, owner-scoped media download. Streams the MP4 file.
 * Replaces the previous public guessable URL pattern.
 */

export async function GET(req: NextRequest) {
  try {
    const owner = await requireOwner();
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id || !/^[a-zA-Z0-9]{10,40}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
    const video = await db.avatarVideo.findFirst({ where: { id, ownerId: owner.ownerId } });
    if (!video || !video.videoUrl) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    // resolve the actual file path (strip token query)
    const urlPath = video.videoUrl.split('?')[0];
    const filePath = resolvePublicPath(urlPath);
    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File missing on disk' }, { status: 410 });
    }
    const stat = fs.statSync(filePath);
    const range = req.headers.get('range');
    const headers: Record<string, string> = {
      'Content-Type': 'video/mp4',
      'Content-Length': String(stat.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    };
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
      headers['Content-Length'] = String(chunkSize);
      return new NextResponse(stream as any, { status: 206, headers });
    }
    const stream = fs.createReadStream(filePath);
    return new NextResponse(stream as any, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
