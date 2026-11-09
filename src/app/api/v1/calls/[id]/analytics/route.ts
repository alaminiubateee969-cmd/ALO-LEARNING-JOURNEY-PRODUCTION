/**
 * GET /api/v1/calls/{id}/analytics
 *
 * Returns the analytics for a call (sentiment, intent, topics, quality).
 * If no analytics row exists yet, generates one on-the-fly by feeding the
 * call transcript to the LLM and persisting the result to `CallAnalytics`.
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
    include: { callAnalytics: true },
  });
  if (!call) return notFound('call not found');

  if (call.callAnalytics) {
    return ok({ analytics: serialize(call.callAnalytics) });
  }

  if (!call.transcript) {
    return badRequest('call has no transcript — cannot generate analytics');
  }

  let analyticsRow;
  try {
    analyticsRow = await generateAnalytics(call);
  } catch (e: any) {
    console.error('[calls/analytics] generation failed:', e);
    return Response.json(
      { ok: false, error: 'provider_failed', message: e?.message?.slice(0, 200) || 'LLM analytics failed' },
      { status: 502 },
    );
  }

  await emitEvent({
    type: 'call_analytics.generated',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'call_analytics',
    resourceId: analyticsRow.id,
    title: 'Call analytics generated',
    description: `Analytics generated for call ${call.id}`,
    metadata: {
      callId: call.id,
      sentiment: analyticsRow.overallSentiment,
      topics: analyticsRow.topics ? JSON.parse(analyticsRow.topics) : null,
    },
  });

  return ok({ analytics: serialize(analyticsRow), generated: true });
}

function serialize(a: any) {
  return {
    id: a.id,
    callId: a.callId,
    overallSentiment: a.overallSentiment,
    sentimentScore: a.sentimentScore,
    sentimentTimeline: a.sentimentTimeline ? JSON.parse(a.sentimentTimeline) : null,
    topics: a.topics ? JSON.parse(a.topics) : null,
    talkToListenRatio: a.talkToListenRatio,
    silencePct: a.silencePct,
    interruptionCount: a.interruptionCount,
    agentScorecard: a.agentScorecard ? JSON.parse(a.agentScorecard) : null,
    complianceFlags: a.complianceFlags ? JSON.parse(a.complianceFlags) : null,
    generatedBy: a.generatedBy,
    generatedAt: a.generatedAt.toISOString(),
    reviewedAt: a.reviewedAt?.toISOString() || null,
    reviewedBy: a.reviewedBy,
  };
}

async function generateAnalytics(call: any) {
  const zai = await ZAI.create();
  const prompt = `Analyze this call transcript and respond as JSON ONLY with these keys:
- overallSentiment: "positive" | "neutral" | "negative" | "mixed"
- sentimentScore: number between -1 and 1
- topics: array of { topic, confidence (0-1), mentions (int) }
- talkToListenRatio: number between 0 and 2 (1 = balanced)
- silencePct: number 0-100
- interruptionCount: int
- agentScorecard: object { greeting (0-5), empathy (0-5), accuracy (0-5), closing (0-5) } or null
- complianceFlags: array of strings (e.g. "disclosure_missing", "dnc_violation_attempt") — empty if none

Call direction: ${call.direction}
Duration: ${call.durationSec}s

Transcript:
${call.transcript}`;

  let parsed: any = {};
  try {
    const r: any = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a call quality analytics engine. Respond with strict JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    });
    const text = r?.choices?.[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[calls/analytics] LLM call failed:', e);
  }

  return await db.callAnalytics.create({
    data: {
      callId: call.id,
      overallSentiment: parsed.overallSentiment || null,
      sentimentScore: typeof parsed.sentimentScore === 'number' ? parsed.sentimentScore : null,
      sentimentTimeline: null,
      topics: parsed.topics ? JSON.stringify(parsed.topics) : null,
      talkToListenRatio: typeof parsed.talkToListenRatio === 'number' ? parsed.talkToListenRatio : null,
      silencePct: typeof parsed.silencePct === 'number' ? parsed.silencePct : null,
      interruptionCount: typeof parsed.interruptionCount === 'number' ? parsed.interruptionCount : null,
      agentScorecard: parsed.agentScorecard ? JSON.stringify(parsed.agentScorecard) : null,
      complianceFlags: parsed.complianceFlags ? JSON.stringify(parsed.complianceFlags) : null,
      generatedBy: 'ai',
    },
  });
}
