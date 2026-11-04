/**
 * POST /api/v1/agents/integration-setup
 *
 * Single endpoint that drives the Integration Setup Agent conversation.
 * The dashboard SPA calls this with the user's message + the current
 * conversation phase; the agent responds with the next reply + any
 * side-effect actions (open OAuth URL, render credential form, poll
 * status, show resources, show summary).
 *
 * Body:
 *   {
 *     "user_message": "...",
 *     "phase": "awaiting_category",
 *     "history": [{ "role": "user", "content": "..." }, ...],
 *     "selected_provider": "google",        // optional
 *     "connection_id": "cmw...",             // optional
 *     "language": "bn"                       // optional, defaults to "bn"
 *   }
 *
 * The agent NEVER accepts credentials in this body — it only accepts
 * free-form user text. Credentials go through /api/v1/integrations/*
 * routes with separate auth.
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { runIntegrationSetupAgent, type ConversationPhase } from '@/lib/integration-setup-agent';

export const dynamic = 'force-dynamic';

const VALID_PHASES: ConversationPhase[] = [
  'awaiting_category',
  'awaiting_provider',
  'awaiting_oauth_redirect',
  'awaiting_discovery',
  'awaiting_resource_selection',
  'awaiting_missing_fields',
  'awaiting_validation',
  'awaiting_confirmation',
  'awaiting_correction',
];

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('body must be JSON');

  const userMessage = typeof body.user_message === 'string' ? body.user_message : '';
  const phase = (typeof body.phase === 'string' ? body.phase : 'awaiting_category') as ConversationPhase;
  if (!VALID_PHASES.includes(phase)) {
    return badRequest(`invalid phase; must be one of: ${VALID_PHASES.join(', ')}`);
  }
  const history = Array.isArray(body.history) ? body.history : [];
  if (history.length > 50) {
    return badRequest('history is too long (max 50 turns)');
  }
  const language = body.language === 'en' ? 'en' : 'bn'; // default Bengali
  const selectedProvider = typeof body.selected_provider === 'string' ? body.selected_provider : undefined;
  const connectionId = typeof body.connection_id === 'string' ? body.connection_id : undefined;

  const result = await runIntegrationSetupAgent({
    userMessage,
    userId: ctx.userId,
    companyId: ctx.companyId,
    history,
    phase,
    selectedProvider,
    connectionId,
    language,
  });

  return ok({
    reply: result.reply,
    phase: result.phase,
    actions: result.actions || [],
    selected_provider: result.selectedProvider,
    connection_id: result.connectionId,
    model_used: result.modelUsed,
    fallback: result.fallback,
  });
}
