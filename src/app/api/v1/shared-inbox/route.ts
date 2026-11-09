/**
 * GET/POST /api/v1/shared-inbox
 * GET/PATCH/DELETE /api/v1/shared-inbox/[id]
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const url = new URL(request.url);
  const channel = url.searchParams.get('channel');
  const status = url.searchParams.get('status');

  const where: any = { companyId: ctx.companyId };
  if (channel) where.channel = channel;
  if (status) where.status = status;

  const messages = await db.sharedInboxMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return ok({ messages });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.channel || !body?.fromAddress || !body?.toAddress || !body?.body) {
    return badRequest('channel, fromAddress, toAddress, and body are required');
  }

  const msg = await db.sharedInboxMessage.create({
    data: {
      companyId: ctx.companyId,
      channel: body.channel,
      direction: body.direction || 'outbound',
      fromAddress: body.fromAddress,
      toAddress: body.toAddress,
      fromName: body.fromName || null,
      toName: body.toName || null,
      subject: body.subject || null,
      body: body.body,
      mediaUrls: JSON.stringify(body.mediaUrls || []),
      threadId: body.threadId || null,
      assignedToId: body.assignedToId || null,
      status: body.status || 'unread',
      isAiGenerated: body.isAiGenerated || false,
      isProviderConfirmed: body.isProviderConfirmed || false,
      tags: JSON.stringify(body.tags || []),
    },
  });

  return ok(msg);
}
