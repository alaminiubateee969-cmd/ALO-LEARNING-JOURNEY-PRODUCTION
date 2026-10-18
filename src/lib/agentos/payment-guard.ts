/**
 * Fail-closed gate for legacy external AI SDK calls. Unknown provider billing
 * is treated as potentially paid. Both switches must be explicitly configured
 * by the server owner after approval; API users cannot change either value.
 */
export function assertExternalAiAllowed(provider: string): void {
  const globallyEnabled = process.env.ALO_PAID_AI_API_ALLOWED === "true";
  const ownerApproved = process.env.ALO_OWNER_APPROVED_PAID_AI_API === "true";
  if (!globallyEnabled || !ownerApproved) {
    throw new Error(`external_ai_blocked_by_payment_guard:${provider}`);
  }
}

export function isExternalAiAllowed(): boolean {
  return process.env.ALO_PAID_AI_API_ALLOWED === "true" &&
    process.env.ALO_OWNER_APPROVED_PAID_AI_API === "true";
}
