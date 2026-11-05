/**
 * POST /api/v1/agents/bounded-loop
 *
 * Runs the bounded agent loop with the allowlisted tools + sensitive-action
 * approval gate. The body carries:
 *   - agentType (determines which tools are allowlisted)
 *   - task (the user's natural-language task)
 *   - approvalGate (optional) — if "auto", sensitive tools are blocked;
 *     if omitted, the loop suspends with terminationReason='human_approval_required'
 *     and returns the approvalRequest for the caller to act on.
 *
 * Per requirement 10: "Build a controlled AI agent loop with allowlisted
 * tools, bounded iterations, tool-call validation and human approval for
 * sensitive actions."
 *
 * Per requirement 12: Bangladesh-focused SEO is injected into the system
 * prompt when agentType === 'seo'.
 *
 * Per requirement 14: AI-generated messages are tagged "ai_generated" —
 * provider-confirmed sent messages carry a separate "provider_confirmed"
 * tag (set by the SMS / social publishing tools after delivery).
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, ok, badRequest } from '@/lib/v1-middleware';
import { runAgentLoop } from '@/lib/agent-loop';
import { AGENT_TOOL_ALLOWLIST } from '@/lib/agent-tools';
import { evaluateAfterHours } from '@/lib/after-hours';
import { estimateCost } from '@/lib/cost-estimator';

export const dynamic = 'force-dynamic';

const BANGLADESH_SEO_PROMPT = `
You are generating marketing content for the Bangladesh market.

Bangladesh-focused SEO rules:
1. Target keywords must be relevant to Bangladeshi search intent (Bengali + English mix).
2. Currency references must be BDT (৳), never USD or EUR unless comparing.
3. Locations should reference Bangladeshi cities (Dhaka, Chittagong, Khulna, Rajshahi, Sylhet, Barishal, Rangpur, Mymensingh, Comilla) where relevant.
4. Cultural sensitivity: avoid alcohol/pork imagery; respect Ramadan, Eid, Durga Puja, Buddha Purnima, Christmas.
5. Use dd/mm/yyyy date format.
6. Phone numbers in examples should use Bangladeshi format: +8801XXXXXXXXX.
7. If the content is SEO-targeted, suggest primary keywords with monthly search volume estimates for Bangladesh Google search.
8. Always offer a Bengali translation alongside the English copy when the platform supports it.
`;

const SYSTEM_PROMPTS: Record<string, string> = {
  seo: `You are the SEO Specialist agent for ALO Labs MarketingOS.${BANGLADESH_SEO_PROMPT}

Your job: produce Bangladesh-optimized SEO recommendations. Use the seo_keyword_research tool to see what's already tracked, then suggest content gaps. Save drafts with content_save_artifact.`,
  content: `You are the Content Writer agent for ALO Labs MarketingOS.${BANGLADESH_SEO_PROMPT}

Your job: produce marketing content (blog posts, email copy, video scripts, ad copy, landing pages) for the Bangladesh market. Save artifacts as drafts for human review.`,
  sms: `You are the SMS Campaign Manager for ALO Labs MarketingOS.

Your job: send OTPs or transactional SMS. SMS_send_message requires human approval. Keep messages under 160 chars when possible. Always include a clear opt-out instruction.`,
  whatsapp: `You are the (DISABLED) WhatsApp Communication Agent. Per master directive, AI agents handle all communication channels (web chat, email, SMS, social DMs) — WhatsApp is not integrated. If asked to send a WhatsApp message, redirect the user to SMS or web chat instead.`,
  lead_qualifier: `You are the Lead Qualifier agent for ALO Labs MarketingOS.

Your job: qualify inbound leads. Use crm_lookup_lead to check if they exist; crm_create_lead to add new ones; crm_update_lead_status to advance the pipeline. Score leads 0-100 based on B2B intent signals.`,
  crm: `You are the CRM Manager for ALO Labs MarketingOS.

Your job: maintain CRM hygiene. Update lead statuses, deduplicate contacts, log interactions. Use crm_lookup_lead and crm_update_lead_status.`,
  social: `You are the Social Media Publisher for ALO Labs MarketingOS.

Your job: create draft social posts (social_create_post_draft). Publishing (social_publish_post) REQUIRES human approval — never publish without it.`,
  voice: `You are the Voice Call Center Agent. You transcribe inbound voice messages and route them to the right CRM action.`,
  support: `You are the Customer Support Agent. You answer customer inquiries and route complex cases to humans.`,
  default: `You are an AI agent for ALO Labs MarketingOS. Complete the user's task using the available tools.`,
};

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body || !body.agentType || !body.task) {
    return badRequest('agentType and task are required');
  }

  const { agentType, task, maxIterations, approvalGateMode } = body as {
    agentType: string;
    task: string;
    maxIterations?: number;
    approvalGateMode?: 'auto' | 'suspend';
  };

  const allowlistedTools = AGENT_TOOL_ALLOWLIST[agentType] || AGENT_TOOL_ALLOWLIST.default;
  const systemPrompt = SYSTEM_PROMPTS[agentType] || SYSTEM_PROMPTS.default;

  // Evaluate after-hours routing for this tenant (per requirement 13)
  const afterHours = await evaluateAfterHours(ctx.companyId);

  // If the agent is "sms" or "voice" or "support" and we're in after-hours,
  // append the disclaimer to the system prompt
  let finalSystemPrompt = systemPrompt;
  if (!afterHours.isWorkingHours && ['sms', 'voice', 'support', 'whatsapp'].includes(agentType)) {
    finalSystemPrompt += `\n\nAfter-hours context: ${afterHours.reason}. Policy: ${afterHours.policy}. ${
      afterHours.disclaimer ? `Append this disclaimer to any auto-reply: "${afterHours.disclaimer}"` : ''
    }`;
  }

  // Approval gate
  const approvalGate = approvalGateMode === 'auto'
    ? async (_tool: string, _args: any) => {
        // Auto-mode: block all sensitive tools
        return false;
      }
    : undefined; // suspend-mode: loop suspends and returns approvalRequest

  const result = await runAgentLoop({
    task,
    systemPrompt: finalSystemPrompt,
    allowlistedTools,
    companyId: ctx.companyId,
    agentType,
    userId: ctx.userId,
    maxIterations,
    approvalGate,
  });

  // Persist an AgentExecutionLog entry for each LLM call (audit trail)
  for (const call of result.llmCalls) {
    const cost = estimateCost(call.provider, call.model, call.promptTokens || 0, call.completionTokens || 0);
    await db.agentExecutionLog.create({
      data: {
        companyId: ctx.companyId,
        agentType,
        providerSlug: call.provider,
        modelName: call.model,
        promptCharCount: task.length,
        responseCharCount: call.text.length,
        promptTokens: call.promptTokens,
        completionTokens: call.completionTokens,
        totalTokens: call.promptTokens && call.completionTokens ? call.promptTokens + call.completionTokens : null,
        estimatedCostUsd: cost.estimatedCostUsd,
        latencyMs: call.durationMs,
        success: !call.fallback,
        errorMessage: call.fallback ? 'fell back to rule-based' : null,
        usedFallback: call.fallback,
        piiRedactionCount: result.totalPiiRedactions,
        actorUserId: ctx.userId,
      },
    });

    // Roll up to AgentUsageDaily
    const day = new Date().toISOString().slice(0, 10);
    await db.agentUsageDaily.upsert({
      where: { companyId_agentType_day: { companyId: ctx.companyId, agentType, day } },
      update: {
        requestCount: { increment: 1 },
        promptTokens: { increment: call.promptTokens || 0 },
        completionTokens: { increment: call.completionTokens || 0 },
        totalTokens: { increment: (call.promptTokens || 0) + (call.completionTokens || 0) },
        estimatedCostUsd: { increment: cost.estimatedCostUsd },
        failureCount: { increment: call.fallback ? 1 : 0 },
        fallbackCount: { increment: call.fallback ? 1 : 0 },
      },
      create: {
        companyId: ctx.companyId,
        agentType,
        day,
        requestCount: 1,
        promptTokens: call.promptTokens || 0,
        completionTokens: call.completionTokens || 0,
        totalTokens: (call.promptTokens || 0) + (call.completionTokens || 0),
        estimatedCostUsd: cost.estimatedCostUsd,
        failureCount: call.fallback ? 1 : 0,
        fallbackCount: call.fallback ? 1 : 0,
      },
    });
  }

  return ok({
    agentType,
    finalResponse: result.finalResponse,
    terminationReason: result.terminationReason,
    approvalRequest: result.approvalRequest,
    toolCalls: result.toolCalls.map((tc) => ({
      tool: tc.tool,
      args: tc.args,
      success: tc.success,
      resultPreview: tc.result.output.slice(0, 200),
      metadata: tc.result.metadata,
    })),
    stats: {
      iterations: result.toolCalls.length,
      llmCalls: result.llmCalls.length,
      durationMs: result.durationMs,
      totalPiiRedactions: result.totalPiiRedactions,
      totalEstimatedCostUsd: result.totalEstimatedCostUsd,
      providerUsed: result.llmCalls[0]?.provider || 'rule-based',
      modelUsed: result.llmCalls[0]?.model || 'rule-based',
    },
    afterHoursContext: {
      isWorkingHours: afterHours.isWorkingHours,
      policy: afterHours.policy,
      reason: afterHours.reason,
      timezone: afterHours.timezone,
    },
    messageProvenance: 'ai_generated', // Per requirement 14
  });
}
