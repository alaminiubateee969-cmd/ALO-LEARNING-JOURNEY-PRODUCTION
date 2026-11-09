/**
 * PATCH /api/v1/shared-inbox/{id}
 *
 * Update a shared-inbox message. Used for:
 *   - Assigning to an agent (assignedToId)
 *   - Tagging (tags)
 *   - Marking resolved/escalated (status)
 *   - Confirming provider delivery (isProviderConfirmed=true when SMS/email
 *     receipt arrives)
 *
 * Body (any subset):
 *   { "assignedToId": "...", "tags": ["vip","escalate"],
 *     "status": "resolved"|"escalated"|"pending_reply",
 *     "isProviderConfirmed": true, "internalNotes": "..." }
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok, notFound } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

const WRITABLE = ['assignedToId', 'tags', 'status', 'isProviderConfirmed', 'internalNotes', 'threadId'] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id } = await params;
  const existing = await db.sharedInboxMessage.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!existing) return notFound('message not found');

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('body required');

  const update: any = {};
  for (const k of WRITABLE) {
    if (!(k in body)) continue;
    if (k === 'tags') {
      update[k] = Array.isArray(body[k]) ? JSON.stringify(body[k]) : body[k];
    } else {
      update[k] = body[k];
    }
  }

  const updated = await db.sharedInboxMessage.update({ where: { id }, data: update });

  await emitEvent({
    type: 'shared_inbox.message_updated',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'shared_inbox_message',
    resourceId: id,
    title: 'Shared inbox message updated',
    description: `Message ${id} updated (${Object.keys(update).join(', ')})`,
    metadata: { fields: Object.keys(update), newStatus: updated.status },
  });

  return ok({
    message: {
      ...updated,
      mediaUrls: JSON.parse(updated.mediaUrls || '[]'),
      tags: JSON.parse(updated.tags || '[]'),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}
