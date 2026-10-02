import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// POST /api/workflows/execute — manually trigger a workflow execution
// Body: { workflowId: string, input?: object }
//
// Executes the workflow steps sequentially. Each step is a JSON object:
// { type: 'ai_agent'|'webhook'|'email'|'sms'|'delay'|'condition', config: {...} }
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { workflowId } = body;
    if (!workflowId) return NextResponse.json({ error: 'workflowId is required' }, { status: 400 });

    const workflow = await db.workflow.findFirst({
      where: { id: workflowId, companyId: payload.companyId },
    });
    if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    // Create a workflow run record
    const run = await db.workflowRun.create({
      data: {
        workflowId,
        status: 'running',
        trigger: 'manual',
        input: JSON.stringify(body.input || {}),
        startedAt: new Date(),
        companyId: payload.companyId,
      },
    });

    // Parse steps
    let steps: any[] = [];
    try { steps = JSON.parse(workflow.steps || '[]'); } catch { /* skip */ }

    const outputs: any[] = [];
    let error: string | null = null;

    // Execute steps sequentially
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      try {
        const stepOutput = await executeStep(step, payload.companyId, payload.userId, body.input);
        outputs.push({ step: i + 1, type: step.type, success: true, output: stepOutput });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputs.push({ step: i + 1, type: step.type, success: false, error: msg });
        error = `Step ${i + 1} (${step.type}) failed: ${msg}`;
        break;
      }
    }

    // Update the run record
    await db.workflowRun.update({
      where: { id: run.id },
      data: {
        status: error ? 'failed' : 'completed',
        output: JSON.stringify(outputs),
        error,
        completedAt: new Date(),
      },
    });

    // Update workflow run count
    await db.workflow.update({
      where: { id: workflowId },
      data: { runCount: { increment: 1 }, lastRunAt: new Date() },
    });

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: error ? 'workflow.run_failed' : 'workflow.run_completed',
      title: `Workflow "${workflow.name}" ${error ? 'failed' : 'completed'}`,
      description: `${steps.length} steps executed → ${error ? 'FAILED: ' + error : outputs.length + ' steps completed'}`,
      resourceType: 'workflow',
      resourceId: workflowId,
      link: undefined,
      metadata: { workflowName: workflow.name, stepCount: steps.length, runId: run.id },
    });

    return NextResponse.json({
      data: {
        runId: run.id,
        workflowName: workflow.name,
        status: error ? 'failed' : 'completed',
        steps: outputs,
        error,
      },
    });
  } catch (err) {
    console.error('[POST /api/workflows/execute]', err);
    return NextResponse.json({ error: 'Failed to execute workflow' }, { status: 500 });
  }
}

/**
 * Execute a single workflow step.
 * Each step type has different behavior:
 * - ai_agent: calls an AI agent (via /api/ai/agents/[id]/run)
 * - webhook: fires a webhook (via emitEvent)
 * - email: creates a Content row with type=email
 * - sms: creates an SmsMessage
 * - delay: waits N seconds
 * - condition: evaluates a condition (if/else)
 */
async function executeStep(
  step: any,
  companyId: string,
  userId: string,
  input: any,
): Promise<any> {
  switch (step.type) {
    case 'ai_agent': {
      // Find the agent by ID or type
      const agent = step.config?.agentId
        ? await db.aiAgent.findFirst({ where: { id: step.config.agentId, companyId } })
        : await db.aiAgent.findFirst({ where: { companyId, type: step.config?.agentType || 'content_writer' } });

      if (!agent) throw new Error(`Agent not found for step: ${step.config?.agentType || step.config?.agentId}`);

      // Use the agent runtime directly (import dynamically to avoid circular deps)
      const { runAgent } = await import('@/lib/agent-runtime');
      const result = await runAgent(agent.id, companyId, userId, {
        resourceType: 'general',
        task: step.config?.task || 'Execute workflow step',
        context: { ...input, stepConfig: step.config },
      });
      return { agentName: agent.name, output: result.output.slice(0, 500) };
    }

    case 'webhook': {
      await emitEvent({
        companyId,
        userId,
        type: step.config?.eventType || 'workflow.webhook_step',
        title: `Workflow webhook: ${step.config?.eventTitle || 'Webhook fired'}`,
        description: step.config?.description || 'Webhook step executed',
        resourceType: 'workflow_step',
        metadata: { url: step.config?.url, payload: step.config?.payload },
      });
      return { fired: true, eventType: step.config?.eventType };
    }

    case 'email': {
      const content = await db.content.create({
        data: {
          title: step.config?.subject || 'Workflow email',
          type: 'email',
          status: 'draft',
          body: step.config?.body || '',
          creatorId: userId,
          companyId,
        },
      });
      return { contentId: content.id, subject: content.title };
    }

    case 'sms': {
      const sms = await db.smsMessage.create({
        data: {
          to: step.config?.to || '',
          body: step.config?.body || '',
          status: 'queued',
          companyId,
          sentBy: userId,
        },
      });
      return { smsId: sms.id, to: sms.to };
    }

    case 'delay': {
      const seconds = Math.min(60, Math.max(1, step.config?.seconds || 1));
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      return { delayed: seconds };
    }

    case 'condition': {
      const condition = step.config?.expression || 'true';
      // Simple boolean evaluation — in production, use a safe expression evaluator
      const result = condition === 'true' || condition === '1';
      return { condition, result };
    }

    default:
      return { message: `Unknown step type: ${step.type}` };
  }
}
