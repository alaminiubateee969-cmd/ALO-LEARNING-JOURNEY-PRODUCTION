/**
 * PII Data Minimization Filter.
 *
 * Before any cloud LLM call, this module scrubs Bangladeshi + international
 * PII patterns from the prompt: phone numbers, NID numbers, birth dates,
 * email addresses, credit card numbers, passport numbers, and student IDs.
 *
 * The scrubbed prompt is what gets sent to the LLM. The original prompt
 * stays server-side; only the scrubbed version crosses the network to
 * cloud providers (per requirement 9: "Do not automatically send student
 * personal information to cloud providers").
 *
 * Locally-hosted providers (local Ollama) are exempt — they don't leave
 * the host, so PII can pass through unchanged when explicitly allowed by
 * the caller.
 *
 * The scrubbed entities are returned to the caller so they can be logged
 * in AgentExecutionLog.piiRedactionCount for audit trail.
 */

export interface PiiRedaction {
  kind: 'phone' | 'email' | 'nid' | 'passport' | 'credit_card' | 'birth_date' | 'student_id' | 'name';
  matched: string;
  redactedTo: string;
}

export interface PiiFilterResult {
  /** The scrubbed prompt — safe to send to cloud LLMs. */
  redacted: string;
  /** The original prompt — kept server-side only. */
  original: string;
  /** Every PII entity that was found + replaced. */
  redactions: PiiRedaction[];
  /** Whether the prompt was modified at all. */
  wasModified: boolean;
}

// Bangladeshi phone: +8801XXXXXXXXX, 01XXXXXXXXX, +880-1XXX-XXXXXX
const BD_PHONE = /\+?880[-\s]?1[3-9]\d{2}[-\s]?\d{6}/g;
// Generic international phone with country code
const INTL_PHONE = /\+\d{1,3}[-\s]?\d{1,4}[-\s]?\d{3,4}[-\s]?\d{3,4}/g;
// Email
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
// Bangladeshi National ID: 10 or 13 or 17 digits
const BD_NID = /\b\d{10}\b|\b\d{13}\b|\b\d{17}\b/g;
// Passport: 1-2 letters + 7-8 digits (Bangladesh format: BR1234567)
const BD_PASSPORT = /\b[A-Z]{1,2}\d{7,8}\b/g;
// Credit card: 13-16 digits with optional separators
const CREDIT_CARD = /\b(?:\d[ -]*?){13,16}\b/g;
// Birth date: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
const BIRTH_DATE = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/g;
// Student ID: STUDENT-XXXXX or STUD-XXXXX or SID-XXXXX
const STUDENT_ID = /\b(?:STUDENT|STUD|SID)[-_]?\d{4,}\b/gi;

/**
 * Scrub PII from a prompt. Returns the redacted prompt + a list of every
 * redaction made so the caller can log them.
 *
 * Replacement tokens are deterministic so the LLM sees consistent placeholders:
 *   phone     → [PHONE_REDACTED]
 *   email     → [EMAIL_REDACTED]
 *   nid       → [NID_REDACTED]
 *   passport  → [PASSPORT_REDACTED]
 *   card      → [CARD_REDACTED]
 *   birthdate → [DATE_REDACTED]
 *   student   → [STUDENT_ID_REDACTED]
 */
export function scrubPii(prompt: string): PiiFilterResult {
  if (!prompt || typeof prompt !== 'string') {
    return { redacted: '', original: prompt || '', redactions: [], wasModified: false };
  }

  let redacted = prompt;
  const redactions: PiiRedaction[] = [];

  const patterns: Array<[RegExp, PiiRedaction['kind'], string]> = [
    // BD_PHONE FIRST — matches +8801XXXXXXXXX before CREDIT_CARD grabs the digits
    [BD_PHONE, 'phone', '[PHONE_REDACTED]'],
    [INTL_PHONE, 'phone', '[PHONE_REDACTED]'],
    [EMAIL, 'email', '[EMAIL_REDACTED]'],
    [BD_PASSPORT, 'passport', '[PASSPORT_REDACTED]'],
    [BIRTH_DATE, 'birth_date', '[DATE_REDACTED]'],
    [STUDENT_ID, 'student_id', '[STUDENT_ID_REDACTED]'],
    // CREDIT_CARD LAST — runs after phone/passport so it only catches
    // genuine card-like sequences (and skips 17-digit NIDs).
    [CREDIT_CARD, 'credit_card', '[CARD_REDACTED]'],
    // BD_NID runs last so phone digits aren't matched as NIDs
    [BD_NID, 'nid', '[NID_REDACTED]'],
  ];

  for (const [pattern, kind, replacement] of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(redacted)) !== null) {
      // Skip false positives: "credit card" patterns that are actually 17-digit NIDs
      if (kind === 'credit_card' && (match[0].replace(/\D/g, '').length === 17)) continue;
      redactions.push({ kind, matched: match[0], redactedTo: replacement });
    }
    redacted = redacted.replace(pattern, replacement);
  }

  return {
    redacted,
    original: prompt,
    redactions,
    wasModified: redacted !== prompt,
  };
}

/**
 * Determine whether a provider is "local" (PII-safe).
 *
 * Local providers don't leave the host, so PII may pass through unchanged
 * if the caller explicitly opts in. Cloud providers ALWAYS get the scrubbed
 * prompt.
 */
export function isLocalProvider(providerSlug: string, baseUrl?: string | null): boolean {
  if (providerSlug === 'ollama' || providerSlug === 'opencode') return true;
  if (!baseUrl) return false;
  // Localhost / 127.0.0.1 / private IP ranges
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i.test(baseUrl);
}
