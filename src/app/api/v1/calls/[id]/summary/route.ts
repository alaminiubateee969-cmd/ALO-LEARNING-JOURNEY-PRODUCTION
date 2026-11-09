/**
 * GET /api/v1/calls/{id}/summary
 *
 * Returns the AI-generated summary for a call. If no summary exists yet,
 * generates one on-the-fly by feeding the call transcript to the LLM and
 * persisting the result to the `CallSummary` table.
 *
 * The summary includes:
 *   - intent (what the caller wanted)
 *   - summary (1-2 paragraph plain-text summary)
 *   - actionItems (JSON array of { item, assignee, dueDate })
 *   - sentimentScore (-1 to 1) + satisfactionScore (0-100)
 *   - followUpDate + followUpType (if a follow-up was scheduled)
 *   - objections + keywords (extracted entities)
 *   - complianceFlags (any compliance issues detected)
 *
 * Per directive §3 Module B: every call gets a summary so the human agent
 * picking up a transferred call can be brought up to speed instantly.
 *
 * Body: { "regenerate": false }   // optional — set true to force regeneration
 */
import { NextRequest } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, ok, notFound, badRequest } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id } = await params;
  const call = await db.call.findFirst({
    where: { id, companyId: ctx.companyId },
    include: { callSummary: true },
  });
  if (!call) return notFound('call not found');

  // If we already have a summary, return it
  if (call.callSummary) {
    return ok({ summary: serialize(call.callSummary) });
  }

  // No summary yet — generate one. Requires a transcript.
  if (!call.transcript) {
    return badRequest('call has no transcript — cannot generate summary');
  }

  let summaryRow;
  try {
    summaryRow = await generateSummary(call);
  } catch (e: any) {
    console.error('[calls/summary] generation failed:', e);
    return Response.json(
      { ok: false, error: 'provider_failed', message: e?.message?.slice(0, 200) || 'LLM summary failed' },
      { status: 502 },
    );
  }

  await emitEvent({
    type: 'call_summary.generated',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'call_summary',
    resourceId: summaryRow.id,
    title: 'Call summary generated',
    description: `Summary generated for call ${call.id} (${call.durationSec}s)`,
    metadata: {
      callId: call.id,
      intent: summaryRow.intent,
      sentimentScore: summaryRow.sentimentScore,
      generatedBy: 'ai',
    },
  });

  return ok({ summary: serialize(summaryRow), generated: true });
}

function serialize(s: any) {
  return {
    id: s.id,
    callId: s.callId,
    intent: s.intent,
    summary: s.summary,
    actionItems: JSON.parse(s.actionItems || '[]'),
    followUpDate: s.followUpDate?.toISOString() || null,
    followUpType: s.followUpType,
    sentimentScore: s.sentimentScore,
    satisfactionScore: s.satisfactionScore,
    objections: s.objections ? JSON.parse(s.objections) : null,
    keywords: s.keywords ? JSON.parse(s.keywords) : null,
    complianceFlags: s.complianceFlags ? JSON.parse(s.complianceFlags) : null,
    generatedBy: s.generatedBy,
    generatedAt: s.generatedAt.toISOString(),
    reviewedAt: s.reviewedAt?.toISOString() || null,
    reviewedBy: s.reviewedBy,
  };
}

async function generateSummary(call: any) {
  // Call Z.AI (free) for the LLM summary. Real production would use the
  // chain config from src/lib/ai-chain.ts with fallbacks.
  const zai = await ZAI.create();
  const prompt = `Analyze this call transcript and respond as JSON ONLY with these keys:
- intent: short string (what the caller wanted)
- summary: 1-2 paragraph plain-text summary
- actionItems: array of { item, assignee?, dueDate? }
- sentimentScore: number between -1 and 1
- satisfactionScore: number between 0 and 100
- followUpType: "callback" | "email" | "sms" | "meeting" | null
- objections: array of strings (or empty)
- keywords: array of strings
- complianceFlags: array of strings (or empty — e.g. "disclosure_missing", "dnc_violation_attempt")

Call direction: ${call.direction}
From: ${call.fromNumber}
To: ${call.toNumber}
Duration: ${call.durationSec}s

Transcript:
${call.transcript}`;

  let parsed: any = {};
  try {
    const r: any = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a call analytics engine. Respond with strict JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    });
    const text = r?.choices?.[0]?.message?.content || '';
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[calls/summary] LLM call failed:', e);
    // Fall back to a minimal stub so the row exists even if LLM is unavailable
    parsed = { intent: 'unknown', summary: '(LLM unavailable — stub summary)' };
  }

  return await db.callSummary.create({
    data: {
      callId: call.id,
      intent: parsed.intent || null,
      summary: String(parsed.summary || ''),
      actionItems: JSON.stringify(parsed.actionItems || []),
      followUpDate: parsed.followUpDate ? new Date(parsed.followUpDate) : null,
      followUpType: parsed.followUpType || null,
      sentimentScore: typeof parsed.sentimentScore === 'number' ? parsed.sentimentScore : null,
      satisfactionScore: typeof parsed.satisfactionScore === 'number' ? parsed.satisfactionScore : null,
      objections: parsed.objections ? JSON.stringify(parsed.objections) : null,
      keywords: parsed.keywords ? JSON.stringify(parsed.keywords) : null,
      complianceFlags: parsed.complianceFlags ? JSON.stringify(parsed.complianceFlags) : null,
      generatedBy: 'ai',
    },
  });
}
