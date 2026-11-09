// @ts-nocheck — temporary: see audit for fix plan
/**
 * Tool Registry — the actual tools agents can call.
 *
 * Each tool is registered with the agent-loop module. Sensitive tools
 * (those that send messages, publish posts, modify data, or cost money)
 * are marked requiresApproval: true.
 *
 * Per requirement 11: "Integrate agent outputs with existing CRM, n8n,
 * OpenSMS, HTTPSMS, WhatsApp and approved social publishing APIs."
 *
 * (Note: WhatsApp is DISABLED per master directive — AI agents handle all
 * communication, no WhatsApp Business API integration is provided.)
 */
import { registerTool, type ToolResult } from './agent-loop';
import { db } from './db';
import { emitEvent } from './events';
import { scrubPii } from './pii-filter';

// ─── CRM Tools ───────────────────────────────────────────────────────────────
registerTool({
  name: 'crm_create_lead',
  description: 'Create a new lead in the CRM. Use when an inquiry contains contact info + intent.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      companyName: { type: 'string' },
      source: { type: 'string', enum: ['website', 'social', 'email', 'sms', 'phone', 'referral'] },
      notes: { type: 'string' },
    },
    required: ['name', 'source'],
  },
  requiresApproval: false,
  handler: async (args, ctx): Promise<ToolResult> => {
    const lead = await db.lead.create({
      data: {
        name: args.name,
        email: args.email || null,
        phone: args.phone || null,
        companyName: args.companyName || null,
        source: args.source,
        status: 'new',
        score: 0,
        companyId: ctx.companyId,
      },
    });
    await emitEvent({
      type: 'crm.lead_create',
      companyId: ctx.companyId,
      userId: ctx.userId,
      resource: 'lead',
      resourceId: lead.id,
      metadata: { source: args.source, name: args.name, agent: ctx.agentType },
    });
    return {
      success: true,
      output: `Created lead ${lead.id} for ${args.name}.`,
      metadata: { leadId: lead.id },
    };
  },
});

registerTool({
  name: 'crm_update_lead_status',
  description: 'Update the status of a lead (new, contacted, qualified, proposal, negotiation, won, lost).',
  inputSchema: {
    type: 'object',
    properties: {
      leadId: { type: 'string' },
      newStatus: { type: 'string', enum: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] },
      note: { type: 'string' },
    },
    required: ['leadId', 'newStatus'],
  },
  requiresApproval: false,
  handler: async (args, ctx): Promise<ToolResult> => {
    const lead = await db.lead.updateMany({
      where: { id: args.leadId, companyId: ctx.companyId },
      data: { status: args.newStatus },
    });
    if (lead.count === 0) return { success: false, output: `Lead ${args.leadId} not found in this tenant.` };
    return { success: true, output: `Lead ${args.leadId} status → ${args.newStatus}.` };
  },
});

// ─── SMS Tools (sensitive — require approval) ────────────────────────────────
registerTool({
  name: 'sms_send_otp',
  description: 'Send a one-time password (OTP) via SMS to verify a phone number. Use for identity verification.',
  inputSchema: {
    type: 'object',
    properties: {
      phone: { type: 'string', description: 'E.164 format: +8801XXXXXXXXX' },
      purpose: { type: 'string', description: 'e.g. "login verification", "lead verification"' },
    },
    required: ['phone', 'purpose'],
  },
  requiresApproval: true, // Sends a real SMS — costs money + reaches a person
  handler: async (args, ctx): Promise<ToolResult> => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/sms/otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: args.phone, purpose: args.purpose }),
    });
    if (!res.ok) return { success: false, output: `OTP send failed: HTTP ${res.status}` };
    const data = await res.json();
    return {
      success: true,
      output: `OTP sent (smsId=${data.data?.smsId}). Delivery requires provider config; user must verify within 5 min.`,
      metadata: { smsId: data.data?.smsId },
    };
  },
});

registerTool({
  name: 'sms_send_message',
  description: 'Send a transactional SMS message. Requires explicit human approval — message will reach a real person.',
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'string' },
      message: { type: 'string', maxLength: 480 },
    },
    required: ['to', 'message'],
  },
  requiresApproval: true,
  handler: async (args, ctx): Promise<ToolResult> => {
    // PII scrub the message before storing it
    const scrub = scrubPii(args.message);
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: args.to, message: scrub.redacted }),
    });
    if (!res.ok) return { success: false, output: `SMS send failed: HTTP ${res.status}` };
    const data = await res.json();
    return {
      success: true,
      output: `SMS queued for delivery (smsId=${data.data?.smsId || data.id}). AI-generated, awaiting provider confirmation.`,
      metadata: { smsId: data.data?.smsId || data.id, piiRedacted: scrub.redactions.length },
      terminateLoop: true,
    };
  },
});

// ─── Social Publishing Tools (sensitive — require approval) ──────────────────
registerTool({
  name: 'social_create_post_draft',
  description: 'Create a DRAFT social media post for review. Does NOT publish — use social_publish_post for that.',
  inputSchema: {
    type: 'object',
    properties: {
      platform: { type: 'string', enum: ['facebook', 'instagram', 'linkedin', 'x', 'tiktok', 'youtube'] },
      content: { type: 'string', maxLength: 2200 },
      mediaUrls: { type: 'array', items: { type: 'string' } },
    },
    required: ['platform', 'content'],
  },
  requiresApproval: false, // Drafts are safe
  handler: async (args, ctx): Promise<ToolResult> => {
    const scrub = scrubPii(args.content);
    const content = await db.content.create({
      data: {
        title: `Draft ${args.platform} post — ${new Date().toISOString()}`,
        type: 'social_post',
        status: 'draft',
        platform: args.platform,
        body: scrub.redacted,
        aiGenerated: true,
        companyId: ctx.companyId,
      },
    });
    return {
      success: true,
      output: `Draft created (contentId=${content.id}) for ${args.platform}. Awaiting review/publish.`,
      metadata: { contentId: content.id, piiRedacted: scrub.redactions.length },
    };
  },
});

registerTool({
  name: 'social_publish_post',
  description: 'Publish a previously-created social media post. Sends a REAL post to the platform. Requires human approval.',
  inputSchema: {
    type: 'object',
    properties: {
      contentId: { type: 'string' },
      scheduledAt: { type: 'string', description: 'ISO date; if omitted, publishes immediately' },
    },
    required: ['contentId'],
  },
  requiresApproval: true, // Real publishing — irreversibly public
  handler: async (args, ctx): Promise<ToolResult> => {
    // Mark the content as scheduled — actual publishing goes through Postiz adapter (Phase 4)
    const content = await db.content.updateMany({
      where: { id: args.contentId, companyId: ctx.companyId, status: 'draft' },
      data: {
        status: 'scheduled',
        scheduledAt: args.scheduledAt ? new Date(args.scheduledAt) : new Date(),
      },
    });
    if (content.count === 0) return { success: false, output: `Draft ${args.contentId} not found or already scheduled.` };
    return {
      success: true,
      output: `Post ${args.contentId} scheduled. Will publish via Postiz adapter at ${args.scheduledAt || 'now'}.`,
      metadata: { contentId: args.contentId, scheduledAt: args.scheduledAt || new Date().toISOString() },
      terminateLoop: true,
    };
  },
});

// ─── Content Generation Tools (safe — no approval needed) ────────────────────
registerTool({
  name: 'content_save_artifact',
  description: 'Save a generated content artifact (blog post, video script, email copy) for later review.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      type: { type: 'string', enum: ['blog', 'email', 'sms', 'video_script', 'ad_copy', 'landing_page'] },
      body: { type: 'string' },
      platform: { type: 'string' },
    },
    required: ['title', 'type', 'body'],
  },
  requiresApproval: false,
  handler: async (args, ctx): Promise<ToolResult> => {
    const scrub = scrubPii(args.body);
    const content = await db.content.create({
      data: {
        title: args.title,
        type: args.type,
        body: scrub.redacted,
        status: 'draft',
        platform: args.platform || null,
        aiGenerated: true,
        companyId: ctx.companyId,
      },
    });
    return {
      success: true,
      output: `Content saved (contentId=${content.id}). Status=draft, awaiting review.`,
      metadata: { contentId: content.id, piiRedacted: scrub.redactions.length },
    };
  },
});

// ─── Lookup Tools (read-only — safe) ────────────────────────────────────────
registerTool({
  name: 'crm_lookup_lead',
  description: 'Look up an existing lead by email or phone. Returns lead details if found.',
  inputSchema: {
    type: 'object',
    properties: {
      email: { type: 'string' },
      phone: { type: 'string' },
    },
  },
  requiresApproval: false,
  handler: async (args, ctx): Promise<ToolResult> => {
    const where: any = { companyId: ctx.companyId };
    if (args.email) where.email = args.email;
    else if (args.phone) where.phone = args.phone;
    else return { success: false, output: 'Provide email or phone to look up.' };
    const lead = await db.lead.findFirst({ where });
    if (!lead) return { success: true, output: 'No matching lead found.' };
    // Mask PII before returning to the LLM
    return {
      success: true,
      output: `Found lead: name=${lead.name}, status=${lead.status}, score=${lead.score}, source=${lead.source}. (PII masked)`,
      metadata: { leadId: lead.id },
    };
  },
});

registerTool({
  name: 'seo_keyword_research',
  description: 'Lookup tracked keywords for the company. Returns the top keywords with their current rankings.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Max keywords to return (default 10)' },
    },
  },
  requiresApproval: false,
  handler: async (args, ctx): Promise<ToolResult> => {
    const keywords = await db.keywordTracker.findMany({
      where: { companyId: ctx.companyId },
      take: args.limit || 10,
      orderBy: { createdAt: 'desc' },
    });
    if (keywords.length === 0) return { success: true, output: 'No tracked keywords yet.' };
    const lines = keywords.map((k) => `- ${k.keyword} (rank=${k.currentRank || 'n/a'})`);
    return {
      success: true,
      output: `Tracked keywords:\n${lines.join('\n')}`,
      metadata: { count: keywords.length },
    };
  },
});

// Re-export the registry so callers can see what's available
export const TOOL_NAMES = [
  'crm_create_lead',
  'crm_update_lead_status',
  'crm_lookup_lead',
  'sms_send_otp',
  'sms_send_message',
  'social_create_post_draft',
  'social_publish_post',
  'content_save_artifact',
  'seo_keyword_research',
];

// Tools that require human approval — surfaced to the agent loop + admin UI
export const SENSITIVE_TOOLS = [
  'sms_send_otp',
  'sms_send_message',
  'social_publish_post',
];

// Per-agent-type allowlists — restrict what each agent can do
export const AGENT_TOOL_ALLOWLIST: Record<string, string[]> = {
  seo: ['seo_keyword_research', 'content_save_artifact'],
  content: ['content_save_artifact', 'seo_keyword_research'],
  whatsapp: ['crm_create_lead', 'crm_lookup_lead', 'content_save_artifact'], // DISABLED agent — listed for completeness
  sms: ['sms_send_otp', 'sms_send_message', 'crm_lookup_lead'],
  lead_qualifier: ['crm_create_lead', 'crm_update_lead_status', 'crm_lookup_lead', 'content_save_artifact'],
  crm: ['crm_create_lead', 'crm_update_lead_status', 'crm_lookup_lead'],
  social: ['social_create_post_draft', 'social_publish_post', 'content_save_artifact'],
  voice: ['crm_create_lead', 'crm_lookup_lead'],
  support: ['crm_lookup_lead', 'content_save_artifact'],
  // Default = read-only tools only
  default: ['crm_lookup_lead', 'seo_keyword_research'],
};
