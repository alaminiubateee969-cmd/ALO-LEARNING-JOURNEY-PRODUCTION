/**
 * AI Agent Runtime — actually executes agent tasks via the z-ai-web-dev-sdk LLM.
 *
 * Each agent has a "type" (lead_scorer, content_writer, seo_agent, etc.) that
 * determines its system prompt + the output format it produces. The runtime:
 *   1. Loads the agent's config from DB
 *   2. Picks the right system prompt + task template
 *   3. Calls zai.chat.completions.create() with the task input
 *   4. Parses the LLM response
 *   5. Writes a TaskExecution row (audit trail) and emits an event
 *
 * This file is the bridge between "agent metadata in DB" and "agent actually does work".
 */
import { db } from './db';
import { emitEvent } from './events';
import ZAI from 'z-ai-web-dev-sdk';

export interface AgentRunInput {
  /** The lead, deal, contact, campaign, etc. that the agent should work on */
  resourceType: 'lead' | 'deal' | 'contact' | 'campaign' | 'content' | 'ticket' | 'keyword' | 'general';
  resourceId?: string;
  /** Free-form task description from the user */
  task: string;
  /** Extra context (lead details, campaign info, etc.) */
  context?: Record<string, any>;
}

export interface AgentRunResult {
  agentId: string;
  agentName: string;
  agentType: string;
  task: string;
  output: string;
  /** The LLM call took this many milliseconds */
  durationMs: number;
  /** Number of tokens used (if reported by SDK) */
  promptTokens?: number;
  completionTokens?: number;
  taskExecutionId: string;
  success: boolean;
  error?: string;
}

/**
 * System prompts per agent type. Each prompt tells the LLM:
 *  - Who it is (role)
 *  - What it should produce (output format)
 *  - How to think about the task
 */
const SYSTEM_PROMPTS: Record<string, string> = {
  lead_scorer: `You are the Lead Qualifier Agent for Kexsio MarketingOS.
Given a lead's details (name, email, company, source, current score), analyze the lead and return a JSON object with:
{
  "score": <0-100 integer>,
  "tier": "hot" | "warm" | "cold",
  "reasoning": "<2-3 sentences explaining the score>",
  "recommendedAction": "<one concrete next step, e.g. 'Call within 24h' or 'Add to nurture sequence'>",
  "estimatedValue": "<rough annual contract value estimate, e.g. '$15,000-$25,000'>"
}
Be conservative — only mark as "hot" if the lead has B2B intent + decision-maker signals.`,

  content_writer: `You are the Content Writer Agent for Kexsio MarketingOS.
Given a topic, audience, and platform, produce a ready-to-publish piece of content.
Match the platform's tone and length conventions:
- Blog post: 800-1500 words, markdown, with H2/H3 sections
- LinkedIn: 200-400 words, professional, with a hook + insight + CTA
- Twitter/X: max 280 chars per tweet, punchy, with hashtags
- Instagram: 100-300 chars caption + 5-10 hashtags
- Email subject + body: 60-char subject, 200-word body
Return ONLY the content. No preamble.`,

  seo_agent: `You are the SEO Optimizer Agent for Kexsio MarketingOS.
Given a URL, target keywords, or content piece, return concrete SEO recommendations as JSON:
{
  "titleTagSuggestion": "<50-60 char optimized title>",
  "metaDescriptionSuggestion": "<150-160 char meta description>",
  "keywordOpportunities": ["<keyword 1>", "<keyword 2>", "<keyword 3>"],
  "onPageIssues": ["<issue 1>", "<issue 2>"],
  "priorityAction": "<the single most impactful fix to make today>"
}
Be specific to the input. Don't give generic advice.`,

  social_curator: `You are the LinkedIn Curator Agent for Kexsio MarketingOS.
Given an industry or topic, produce a week's worth of LinkedIn post ideas (5 posts).
For each post, provide:
- Day of the week
- Hook (first 2 lines — must stop the scroll)
- Outline (3-5 bullet points)
- CTA
Return as a markdown list.`,

  email_automation: `You are the Email Drip Composer Agent for Kexsio MarketingOS.
Given a product/service + audience, design a 5-email drip sequence.
For each email, return:
- Email number + send delay (Day 0, Day 2, Day 5, etc.)
- Subject line (max 60 chars)
- Body (200-300 words, plain text, no markdown)
- Goal of this email (e.g. "Educate", "Build trust", "Convert")
Return as markdown.`,

  image_generator: `You are the Image Generator Agent for Kexsio MarketingOS.
Given a content piece or campaign brief, generate a single descriptive image prompt suitable for an AI image generator like DALL-E or Midjourney.
Return ONLY the prompt — no preamble, no explanation.
Format: [subject], [style], [lighting], [composition], [mood]`,

  strategy_advisor: `You are the Strategy Advisor Agent for Kexsio MarketingOS.
Given a company's current metrics (leads, deals, revenue, pipeline), analyze the situation and recommend 3 strategic pivots.
For each pivot, return:
- The recommendation
- Why now (timing)
- Expected impact (high/medium/low)
- Risk if we DON'T do it
Be honest — if the data is bad, say so. Don't recommend vanity metrics.`,

  support_triage: `You are the Support Triage Agent for Kexsio MarketingOS.
Given a support ticket subject + description, classify it as JSON:
{
  "category": "billing" | "bug" | "feature_request" | "how_to" | "urgent" | "other",
  "priority": "low" | "medium" | "high" | "critical",
  "suggestedReply": "<3-4 sentence reply the support agent can review and send>",
  "shouldEscalate": true | false,
  "escalationReason": "<if shouldEscalate, why>"
}`,

  analytics_agent: `You are the Funnel Analyst Agent for Kexsio MarketingOS.
Given funnel data (lead counts by stage, conversion rates, drop-off points), identify the biggest bottleneck and recommend one A/B test to run.
Return as markdown with: bottleneck, hypothesis, test design, success metric.`,

  default: `You are an AI Agent for Kexsio MarketingOS. Complete the task given to you. Be specific and actionable.`,
};

/**
 * Run an agent on a task. This is the canonical entry point — called by:
 *   - /api/ai/agents/[id]/run (manual trigger from UI)
 *   - /api/crm/leads POST (auto lead scoring)
 *   - /api/content POST (auto content generation)
 *   - cron jobs (scheduled agent runs)
 *
 * Writes a TaskExecution row to the DB for audit, and emits an event so the
 * activity feed + webhooks fire.
 */
export async function runAgent(
  agentId: string,
  companyId: string,
  userId: string | null,
  input: AgentRunInput,
): Promise<AgentRunResult> {
  const startedAt = Date.now();

  // 1. Load the agent
  const agent = await db.aiAgent.findFirst({
    where: { id: agentId, companyId },
  });
  if (!agent) {
    throw new Error(`Agent ${agentId} not found in company ${companyId}`);
  }
  if (!agent.isEnabled) {
    throw new Error(`Agent "${agent.name}" is disabled. Enable it first.`);
  }

  // 2. Create a TaskExecution row (pending)
  const execution = await db.taskExecution.create({
    data: {
      taskId: `exec_${agentId}_${Date.now()}`,
      title: `${agent.name}: ${input.task.slice(0, 100)}`,
      description: input.task,
      taskType: agent.type,
      complexity: 'standard',
      executionPath: 'fast',
      priority: 'medium',
      // assignedEmployeeId is null for AI agents (no Employee row) — see schema comment
      status: 'running',
      input: JSON.stringify({ resourceType: input.resourceType, resourceId: input.resourceId, context: input.context || {} }),
      startedAt: new Date(),
      companyId, // required by schema
    },
  });

  // 3. Build the messages for the LLM
  const systemPrompt = SYSTEM_PROMPTS[agent.type] || SYSTEM_PROMPTS.default;
  const userMessage = buildUserMessage(input);

  // 4. Call the LLM
  let output = '';
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let errorMsg: string | undefined;

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      thinking: { type: 'disabled' },
    });
    output = completion.choices[0]?.message?.content || '(no output)';
    if (completion.usage) {
      promptTokens = completion.usage.prompt_tokens;
      completionTokens = completion.usage.completion_tokens;
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
    output = `Agent failed: ${errorMsg}`;
  }

  const durationMs = Date.now() - startedAt;

  // 5. Update the TaskExecution row with the result
  await db.taskExecution.update({
    where: { id: execution.id },
    data: {
      status: errorMsg ? 'failed' : 'completed',
      output,
      modelUsed: 'z-ai-sdk',
      modelTier: 'balanced',
      promptTokens: promptTokens || 0,
      completionTokens: completionTokens || 0,
      latencyMs: durationMs,
      completedAt: new Date(),
      validationStatus: errorMsg ? 'failed' : 'passed',
      validationScore: errorMsg ? 0 : 1,
      qualityNotes: errorMsg ? errorMsg : 'LLM call succeeded',
    },
  });

  // 6. Update the agent's KPIs (increment totalTasks, completedTasks)
  await db.aiAgent.update({
    where: { id: agentId },
    data: {
      config: JSON.stringify({
        ...parseConfig(agent.config),
        tasksCompleted: (parseConfig(agent.config).tasksCompleted || 0) + 1,
        lastRunAt: new Date().toISOString(),
        lastRunStatus: errorMsg ? 'failed' : 'success',
      }),
    },
  });

  // 7. Emit event (creates notification + audit log + activity + webhook)
  await emitEvent({
    companyId,
    userId,
    type: errorMsg ? 'agent.run_failed' : 'agent.run_completed',
    title: errorMsg ? `Agent "${agent.name}" failed` : `Agent "${agent.name}" completed a task`,
    description: `Task: ${input.task.slice(0, 80)}${input.task.length > 80 ? '...' : ''} → ${errorMsg ? 'FAILED: ' + errorMsg : output.slice(0, 80) + (output.length > 80 ? '...' : '')}`,
    resourceType: 'agent_execution',
    resourceId: execution.id,
    link: '/ai-agents',
    metadata: {
      agentId,
      agentName: agent.name,
      agentType: agent.type,
      task: input.task,
      durationMs,
      promptTokens,
      completionTokens,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      success: !errorMsg,
    },
  });

  return {
    agentId,
    agentName: agent.name,
    agentType: agent.type,
    task: input.task,
    output,
    durationMs,
    promptTokens,
    completionTokens,
    taskExecutionId: execution.id,
    success: !errorMsg,
    error: errorMsg,
  };
}

function buildUserMessage(input: AgentRunInput): string {
  const parts: string[] = [`# Task`, input.task];
  if (input.resourceType && input.resourceId) {
    parts.push(`\n# Resource`, `${input.resourceType} with ID ${input.resourceId}`);
  }
  if (input.context && Object.keys(input.context).length > 0) {
    parts.push(`\n# Context`, '```json', JSON.stringify(input.context, null, 2), '```');
  }
  return parts.join('\n');
}

function parseConfig(config: string | null): Record<string, any> {
  if (!config) return {};
  try {
    return JSON.parse(config);
  } catch {
    return {};
  }
}

/**
 * Convenience wrappers — call runAgent with the right agent + input shape.
 */

/** Auto-score a lead using the Lead Qualifier agent. */
export async function autoScoreLead(companyId: string, leadId: string, leadData: any): Promise<void> {
  // Find the lead_scorer agent for this company
  const agent = await db.aiAgent.findFirst({
    where: { companyId, type: 'lead_scorer', isEnabled: true },
  });
  if (!agent) return; // not configured — skip silently

  const result = await runAgent(agent.id, companyId, null, {
    resourceType: 'lead',
    resourceId: leadId,
    task: `Score this lead and recommend next action: ${leadData.name} (${leadData.email || 'no email'}) from ${leadData.companyName || 'Unknown'} via ${leadData.source || 'Unknown'}. Current score: ${leadData.score}.`,
    context: leadData,
  });

  // If the agent returned valid JSON with a score, update the lead
  if (result.success) {
    try {
      const parsed = JSON.parse(result.output);
      if (typeof parsed.score === 'number' && parsed.score >= 0 && parsed.score <= 100) {
        await db.lead.update({
          where: { id: leadId },
          data: { score: parsed.score },
        });
        await db.leadActivity.create({
          data: {
            type: 'ai_scored',
            content: `AI scored ${parsed.score}/100 (${parsed.tier || 'unknown'}): ${parsed.reasoning || ''}`,
            leadId,
          },
        });
      }
    } catch {
      // LLM didn't return valid JSON — leave the score as-is, the run is still logged
    }
  }
}

/** Generate a content draft using the Content Writer agent. */
export async function generateContentDraft(
  companyId: string,
  userId: string,
  params: { title: string; type: string; platform?: string; audience?: string; tone?: string; keyPoints?: string[] },
): Promise<{ content: string; executionId: string } | null> {
  const agent = await db.aiAgent.findFirst({
    where: { companyId, type: 'content_writer', isEnabled: true },
  });
  if (!agent) return null;

  const task = `Write a ${params.type} piece titled "${params.title}"${params.platform ? ` for ${params.platform}` : ''}.
${params.audience ? `Target audience: ${params.audience}.` : ''}
${params.tone ? `Tone: ${params.tone}.` : ''}
${params.keyPoints && params.keyPoints.length > 0 ? `Key points to cover: ${params.keyPoints.join(', ')}.` : ''}`;

  const result = await runAgent(agent.id, companyId, userId, {
    resourceType: 'content',
    task,
    context: params,
  });

  if (!result.success) return null;
  return { content: result.output, executionId: result.taskExecutionId };
}
