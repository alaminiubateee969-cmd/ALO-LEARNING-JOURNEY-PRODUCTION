/**
 * Bounded Agent Loop — controlled multi-turn agent execution.
 *
 * Per requirement 10: "Build a controlled AI agent loop with allowlisted
 * tools, bounded iterations, tool-call validation and human approval for
 * sensitive actions."
 *
 * The loop:
 *   1. Sends a system prompt + user task + tool definitions to the LLM
 *   2. The LLM responds with either text OR a tool_call
 *   3. If tool_call:
 *      a. Validate the tool name is in the allowlist
 *      b. Validate the args against the tool's schema
 *      c. Check if the tool requires human approval — if so, suspend
 *         the loop and return a HumanApprovalRequest to the caller
 *      d. Otherwise, execute the tool and feed the result back to the LLM
 *   4. Repeat until LLM responds with text only OR maxIterations reached
 *
 * Safety guarantees:
 *   - maxIterations caps the loop (default 8) — no infinite loops
 *   - Every tool_call is validated against the allowlist
 *   - Sensitive tools (publish_post, send_sms, send_email, dispatch_call,
 *     delete_record, etc.) REQUIRE human approval before execution
 *   - The full transcript is logged for audit
 *
 * Integration: the loop is provider-agnostic — it calls chainChat() under
 * the hood, so it benefits from the circuit breaker + retry + cost tracking
 * + PII scrubbing built into the chain.
 */
import { chainChat, type ChatMessage, type ChainCallResult } from './ai-chain';
import { scrubPii, isLocalProvider } from './pii-filter';
import { db } from './db';
import { estimateCost } from './cost-estimator';

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON schema for the args (used for validation) */
  inputSchema: Record<string, any>;
  /** Whether this tool requires human approval before execution */
  requiresApproval: boolean;
  /** The actual function that runs the tool */
  handler: (args: any, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  companyId: string;
  userId?: string;
  agentType: string;
  /** The full conversation transcript so far (for context-aware tools) */
  transcript: ChatMessage[];
  /** Tracks how many tool calls have been made in this loop */
  toolCallCount: number;
}

export interface ToolResult {
  success: boolean;
  output: string; // fed back to the LLM
  /** Side-effect metadata (e.g. { leadId: '...' }) — for audit log */
  metadata?: Record<string, any>;
  /** If true, the loop terminates immediately after this tool call */
  terminateLoop?: boolean;
}

export interface HumanApprovalRequest {
  toolName: string;
  args: any;
  reason: string;
  /** Resumable loop state — caller persists this and resumes when approved */
  loopState: string;
}

export interface AgentLoopResult {
  /** Final text response from the LLM (or truncated transcript) */
  finalResponse: string;
  /** Full transcript for audit */
  transcript: ChatMessage[];
  /** Every tool call made — for audit log */
  toolCalls: Array<{ tool: string; args: any; result: ToolResult; success: boolean }>;
  /** Why the loop terminated */
  terminationReason: 'completed' | 'max_iterations' | 'tool_error' | 'human_approval_required' | 'sensitive_action_blocked';
  /** If human approval is required, the request details */
  approvalRequest?: HumanApprovalRequest;
  /** Aggregate LLM call stats */
  llmCalls: ChainCallResult[];
  /** Total PII redactions across all calls */
  totalPiiRedactions: number;
  /** Total estimated cost across all calls */
  totalEstimatedCostUsd: number;
  /** Wall-clock duration */
  durationMs: number;
}

const DEFAULT_MAX_ITERATIONS = 8;

/**
 * Built-in allowlist of tools. Each agent type gets a subset of these
 * based on its responsibilities. Custom tools can be registered at runtime
 * via registerTool().
 */
const TOOL_REGISTRY = new Map<string, ToolDefinition>();

export function registerTool(def: ToolDefinition): void {
  TOOL_REGISTRY.set(def.name, def);
}

export function getRegisteredTools(): ToolDefinition[] {
  return Array.from(TOOL_REGISTRY.values());
}

/**
 * Run the agent loop.
 *
 * @param task       User's task description
 * @param systemPrompt  Agent's role + constraints
 * @param allowlistedTools  Names of tools this agent is allowed to use
 * @param companyId  Tenant scope
 * @param agentType  For logging
 * @param userId     For audit
 * @param options    maxIterations, etc.
 */
export async function runAgentLoop(params: {
  task: string;
  systemPrompt: string;
  allowlistedTools: string[];
  companyId: string;
  agentType: string;
  userId?: string;
  maxIterations?: number;
  /** If provided, called for each tool call that requires approval. If it
   * returns true, the tool executes. If false, the loop terminates with
   * terminationReason='sensitive_action_blocked'. */
  approvalGate?: (toolName: string, args: any) => Promise<boolean>;
}): Promise<AgentLoopResult> {
  const start = Date.now();
  const maxIterations = params.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const transcript: ChatMessage[] = [
    { role: 'system', content: params.systemPrompt },
    { role: 'user', content: params.task },
  ];
  const toolCalls: AgentLoopResult['toolCalls'] = [];
  const llmCalls: ChainCallResult[] = [];
  let totalPiiRedactions = 0;
  let totalCost = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    // PII scrub before sending to ANY cloud LLM (local Ollama passes through)
    // For simplicity here, we always scrub; local providers receive the scrubbed
    // prompt too — they may have access to the original via tool calls if needed.
    const lastUser = [...transcript].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      const scrub = scrubPii(lastUser.content);
      if (scrub.wasModified) {
        lastUser.content = scrub.redacted;
        totalPiiRedactions += scrub.redactions.length;
      }
    }

    // Call the LLM with tool definitions
    const tools = params.allowlistedTools
      .map((name) => TOOL_REGISTRY.get(name))
      .filter((t): t is ToolDefinition => !!t);

    const toolPrompt = tools.length > 0
      ? buildToolPrompt(tools)
      : '';

    const messages = [...transcript];
    if (toolPrompt) {
      messages.push({ role: 'system', content: toolPrompt });
    }

    const r = await chainChat(messages, { maxTokens: 1500, temperature: 0.3 });
    llmCalls.push(r);
    totalCost += estimateCost(r.provider, r.model, r.promptTokens || 0, r.completionTokens || 0).estimatedCostUsd;

    // Parse LLM response — check for tool call syntax
    const toolCall = parseToolCall(r.text);
    if (!toolCall) {
      // LLM responded with text — loop complete
      transcript.push({ role: 'assistant', content: r.text });
      return {
        finalResponse: r.text,
        transcript,
        toolCalls,
        terminationReason: 'completed',
        llmCalls,
        totalPiiRedactions,
        totalEstimatedCostUsd: totalCost,
        durationMs: Date.now() - start,
      };
    }

    // Validate tool name
    if (!params.allowlistedTools.includes(toolCall.tool)) {
      transcript.push({ role: 'assistant', content: r.text });
      transcript.push({
        role: 'user',
        content: `ERROR: tool "${toolCall.tool}" is not in the allowlist. Available tools: ${params.allowlistedTools.join(', ')}.`,
      });
      continue;
    }

    const tool = TOOL_REGISTRY.get(toolCall.tool);
    if (!tool) {
      transcript.push({
        role: 'user',
        content: `ERROR: tool "${toolCall.tool}" is registered but not in the registry. This is a system configuration error.`,
      });
      continue;
    }

    // Validate args (basic shape check)
    if (!validateToolArgs(toolCall.args, tool.inputSchema)) {
      transcript.push({
        role: 'user',
        content: `ERROR: args for tool "${toolCall.tool}" do not match its schema. Expected: ${JSON.stringify(tool.inputSchema)}`,
      });
      continue;
    }

    // Approval gate for sensitive tools
    if (tool.requiresApproval) {
      if (params.approvalGate) {
        const approved = await params.approvalGate(toolCall.tool, toolCall.args);
        if (!approved) {
          return {
            finalResponse: `Tool "${toolCall.tool}" was blocked by the approval gate.`,
            transcript,
            toolCalls,
            terminationReason: 'sensitive_action_blocked',
            llmCalls,
            totalPiiRedactions,
            totalEstimatedCostUsd: totalCost,
            durationMs: Date.now() - start,
          };
        }
      } else {
        // No approval gate provided — block by default (fail-safe)
        return {
          finalResponse: `Tool "${toolCall.tool}" requires human approval but no approval gate was provided. Loop terminated for safety.`,
          transcript,
          toolCalls,
          terminationReason: 'human_approval_required',
          approvalRequest: {
            toolName: toolCall.tool,
            args: toolCall.args,
            reason: 'sensitive action requires human approval',
            loopState: JSON.stringify({ transcript, iteration: iter }),
          },
          llmCalls,
          totalPiiRedactions,
          totalEstimatedCostUsd: totalCost,
          durationMs: Date.now() - start,
        };
      }
    }

    // Execute the tool
    const ctx: ToolContext = {
      companyId: params.companyId,
      userId: params.userId,
      agentType: params.agentType,
      transcript,
      toolCallCount: toolCalls.length + 1,
    };

    let result: ToolResult;
    try {
      result = await tool.handler(toolCall.args, ctx);
    } catch (e: any) {
      result = {
        success: false,
        output: `Tool "${toolCall.tool}" threw an error: ${e?.message || String(e)}`,
      };
    }

    toolCalls.push({ tool: toolCall.tool, args: toolCall.args, result, success: result.success });

    // Feed result back to LLM
    transcript.push({ role: 'assistant', content: r.text });
    transcript.push({ role: 'user', content: `Tool "${toolCall.tool}" result: ${result.output}` });

    if (result.terminateLoop) {
      return {
        finalResponse: result.output,
        transcript,
        toolCalls,
        terminationReason: 'completed',
        llmCalls,
        totalPiiRedactions,
        totalEstimatedCostUsd: totalCost,
        durationMs: Date.now() - start,
      };
    }
  }

  // Max iterations reached
  return {
    finalResponse: 'Agent loop reached max iterations without completion.',
    transcript,
    toolCalls,
    terminationReason: 'max_iterations',
    llmCalls,
    totalPiiRedactions,
    totalEstimatedCostUsd: totalCost,
    durationMs: Date.now() - start,
  };
}

function buildToolPrompt(tools: ToolDefinition[]): string {
  const lines = [
    'You have access to the following tools. To call a tool, respond with EXACTLY this JSON format (no other text):',
    '```json',
    '{ "tool": "<tool_name>", "args": { ... } }',
    '```',
    '',
    'Available tools:',
  ];
  for (const t of tools) {
    lines.push(`- ${t.name}: ${t.description}`);
    if (t.requiresApproval) lines.push(`  [REQUIRES HUMAN APPROVAL]`);
    lines.push(`  Args schema: ${JSON.stringify(t.inputSchema)}`);
  }
  return lines.join('\n');
}

function parseToolCall(text: string): { tool: string; args: any } | null {
  // Look for JSON block ```json ... ```
  const match = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed.tool && typeof parsed.tool === 'string') {
      return { tool: parsed.tool, args: parsed.args || {} };
    }
  } catch {
    // not valid JSON
  }
  return null;
}

function validateToolArgs(args: any, schema: Record<string, any>): boolean {
  if (!schema || typeof schema !== 'object') return true; // no schema = pass
  if (schema.type === 'object' && schema.properties) {
    for (const [key, def] of Object.entries(schema.properties)) {
      if (schema.required?.includes(key) && !(key in args)) return false;
    }
  }
  return true;
}
