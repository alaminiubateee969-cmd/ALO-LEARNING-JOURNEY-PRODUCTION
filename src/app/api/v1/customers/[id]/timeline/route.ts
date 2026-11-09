/**
 * GET /api/v1/customers/{id}/timeline
 *
 * Returns the customer's 360° interaction timeline, sorted by date DESC:
 *   - Calls (inbound/outbound/missed)
 *   - SMS messages
 *   - Emails
 *   - Internal notes
 *   - Lead activities (if linked via leadId)
 *
 * Useful for the agent's "Customer 360" panel before picking up a call.
 *
 * Query params:
 *   ?limit=50&channel=voice|sms|email|note
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, ok, notFound, badRequest } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id } = await params;
  const customer = await db.customer.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!customer) return notFound('customer not found');

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const channel = url.searchParams.get('channel');

  // Calls — match by phone OR fromNumber OR toNumber
  const phone = customer.phone;
  const altPhone = customer.alternatePhone;
  const phoneClauses: any[] = [];
  if (phone) {
    phoneClauses.push({ fromNumber: phone }, { toNumber: phone });
  }
  if (altPhone) {
    phoneClauses.push({ fromNumber: altPhone }, { toNumber: altPhone });
  }
  const calls = phoneClauses.length > 0
    ? await db.call.findMany({
        where: { companyId: ctx.companyId, OR: phoneClauses },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, direction: true, status: true, fromNumber: true, toNumber: true, durationSec: true, intent: true, outcome: true, createdAt: true, answeredAt: true },
      })
    : [];

  // SMS messages
  const smsClauses: any[] = [];
  if (phone) smsClauses.push({ to: phone }, { from: phone });
  const smsMessages = smsClauses.length > 0
    ? await db.smsMessage.findMany({
        where: { companyId: ctx.companyId, OR: smsClauses },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
    : [];

  // Shared inbox messages — match by fromAddress or toAddress (email or phone)
  const inboxClauses: any[] = [];
  if (phone) inboxClauses.push({ fromAddress: phone }, { toAddress: phone });
  if (customer.email) {
    inboxClauses.push({ fromAddress: customer.email }, { toAddress: customer.email });
  }
  const inboxMessages = inboxClauses.length > 0
    ? await db.sharedInboxMessage.findMany({
        where: { companyId: ctx.companyId, OR: inboxClauses },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, channel: true, direction: true, fromAddress: true, toAddress: true, subject: true, body: true, status: true, createdAt: true },
      })
    : [];

  // Lead activities (if linked)
  let leadActivities: any[] = [];
  if (customer.leadId) {
    leadActivities = await db.leadActivity.findMany({
      where: { leadId: customer.leadId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // Merge into a single timeline
  const timeline: any[] = [
    ...calls.map((c) => ({
      id: c.id, channel: 'voice', direction: c.direction,
      summary: `${c.direction} call from ${c.fromNumber} to ${c.toNumber} (${c.durationSec}s) — ${c.status}`,
      details: { callId: c.id, status: c.status, intent: c.intent, outcome: c.outcome },
      timestamp: c.createdAt.toISOString(),
    })),
    ...smsMessages.map((m) => ({
      id: m.id, channel: 'sms', direction: m.to === phone ? 'inbound' : 'outbound',
      summary: `SMS ${m.to === phone ? 'from' : 'to'} ${m.to === phone ? m.from || phone : m.to} — "${m.body?.slice(0, 80) || ''}"`,
      details: { smsId: m.id, status: m.status, body: m.body },
      timestamp: m.createdAt.toISOString(),
    })),
    ...inboxMessages.map((m) => ({
      id: m.id, channel: m.channel, direction: m.direction,
      summary: `${m.channel} ${m.direction} — ${m.subject || m.body?.slice(0, 80) || ''}`,
      details: { messageId: m.id, fromAddress: m.fromAddress, toAddress: m.toAddress, status: m.status },
      timestamp: m.createdAt.toISOString(),
    })),
    ...leadActivities.map((a) => ({
      id: a.id, channel: 'note', direction: 'internal',
      summary: a.description || a.type,
      details: { type: a.type, leadId: customer.leadId },
      timestamp: a.createdAt?.toISOString?.() || new Date().toISOString(),
    })),
  ];

  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filtered = channel ? timeline.filter((t) => t.channel === channel) : timeline;

  return ok({
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      status: customer.status,
    },
    timeline: filtered.slice(0, limit),
    counts: {
      total: filtered.length,
      byChannel: {
        voice: timeline.filter((t) => t.channel === 'voice').length,
        sms: timeline.filter((t) => t.channel === 'sms').length,
        email: timeline.filter((t) => t.channel === 'email').length,
        note: timeline.filter((t) => t.channel === 'note').length,
      },
    },
  });
}
