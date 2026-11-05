/**
 * GET  /api/v1/voicemails   — list voicemails (filter by status, assignedTo)
 * POST /api/v1/voicemails   — create a voicemail record manually
 *
 * Most voicemails are created automatically by the telephony adapter when a
 * call goes unanswered and the destination's fallback is voicemail. This
 * route exists for manual creation (e.g. an integration that drops in a
 * pre-recorded voicemail).
 *
 * Body for POST:
 *   { "callId": "...", "fromNumber": "+880...", "fromName": "...",
 *     "audioUrl": "https://...", "durationSec": 30,
 *     "assignedTo": "userId...", "status": "unread"|"read"|"archived" }
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const assignedTo = url.searchParams.get('assignedTo');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);

  const where: any = { companyId: ctx.companyId };
  if (status) where.status = status;
  if (assignedTo) where.assignedTo = assignedTo;

  const voicemails = await db.voicemail.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return ok({
    voicemails: voicemails.map((v) => ({
      ...v,
      listenedAt: v.listenedAt?.toISOString() || null,
      createdAt: v.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body || !body.fromNumber || !body.audioUrl) {
    return badRequest('fromNumber and audioUrl are required');
  }

  const created = await db.voicemail.create({
    data: {
      companyId: ctx.companyId,
      callId: body.callId || null,
      fromNumber: String(body.fromNumber),
      fromName: body.fromName || null,
      audioUrl: String(body.audioUrl),
      durationSec: body.durationSec ?? 0,
      assignedTo: body.assignedTo || null,
      status: body.status || 'unread',
    },
  });

  await emitEvent({
    type: 'voicemail.created',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'voicemail',
    resourceId: created.id,
    title: 'Voicemail received',
    description: `Voicemail from ${created.fromNumber} (${created.durationSec}s)`,
    metadata: { fromNumber: created.fromNumber, durationSec: created.durationSec },
  });

  return ok({
    voicemail: {
      ...created,
      listenedAt: created.listenedAt?.toISOString() || null,
      createdAt: created.createdAt.toISOString(),
    },
  });
}
