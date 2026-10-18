/**
 * ALO Input Validation + Prompt-Injection Hardening
 *
 * - Structured validation returning 400 (never 500) for malformed input
 * - Whitespace-only rejection
 * - Prompt length cap (2000 chars) + basic normalization
 * - Bengali/Arabic/English content preserved
 * - LLM output strict-JSON schema validation (reject malformed scripts)
 * - Prompt-injection guardrails (system/user separation + content fence)
 */

import { NextResponse } from 'next/server';

export interface ValidationError {
  field: string;
  message: string;
}

export function badRequest(field: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, field, ...extra }, { status: 400 });
}

const VALID_PERSONAS = ['mother', 'father', 'teacher', 'narrator', 'doctor', 'expert'];
const VALID_VOICES = ['tongtong', 'chuichui', 'xiaochen', 'jam', 'kazi', 'douji', 'luodo'];
const VALID_QUALITIES = ['standard', 'hd', 'cinematic'];
const VALID_GENDERS = ['male', 'female'];

export const MAX_PROMPT_LENGTH = 2000;

export function validatePrompt(prompt: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof prompt !== 'string') return { ok: false, error: 'prompt must be a string' };
  const trimmed = prompt.trim();
  if (trimmed.length === 0) return { ok: false, error: 'prompt is required (cannot be empty/whitespace)' };
  if (trimmed.length > MAX_PROMPT_LENGTH) {
    return { ok: false, error: `prompt too long (max ${MAX_PROMPT_LENGTH} chars, got ${trimmed.length})` };
  }
  return { ok: true, value: trimmed };
}

export function validateId(id: unknown, field: string): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof id !== 'string' || id.trim().length === 0) {
    return { ok: false, error: `${field} is required` };
  }
  // cuid pattern: cm... alphanumeric
  if (!/^[a-zA-Z0-9]{10,40}$/.test(id.trim())) {
    return { ok: false, error: `${field} has invalid format` };
  }
  return { ok: true, value: id.trim() };
}

export function validateDuration(d: unknown): { ok: true; value: number } | { ok: false; error: string } {
  const n = Number(d);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, error: 'targetDuration must be an integer' };
  }
  if (n < 30 || n > 3600) {
    return { ok: false, error: 'targetDuration must be 30-3600 seconds' };
  }
  return { ok: true, value: n };
}

export function validateQuality(q: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof q !== 'string' || !VALID_QUALITIES.includes(q)) {
    return { ok: false, error: `quality must be one of ${VALID_QUALITIES.join(', ')}` };
  }
  return { ok: true, value: q };
}

export function validatePersona(p: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof p !== 'string' || !VALID_PERSONAS.includes(p)) {
    return { ok: false, error: `persona must be one of ${VALID_PERSONAS.join(', ')}` };
  }
  return { ok: true, value: p };
}

export function validateVoice(v: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof v !== 'string' || !VALID_VOICES.includes(v)) {
    return { ok: false, error: `voiceProfile must be one of ${VALID_VOICES.join(', ')}` };
  }
  return { ok: true, value: v };
}

export function validateGender(g: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof g !== 'string' || !VALID_GENDERS.includes(g)) {
    return { ok: false, error: `gender must be one of ${VALID_GENDERS.join(', ')}` };
  }
  return { ok: true, value: g };
}

/**
 * Parse request JSON safely — returns 400-friendly error on malformed input
 * rather than letting the runtime throw a 500.
 */
export async function parseJsonBody(req: Request): Promise<{ ok: true; value: any } | { ok: false; error: string }> {
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, error: 'Failed to read request body' };
  }
  if (!text || text.trim().length === 0) {
    return { ok: false, error: 'Request body is empty' };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
}

/**
 * Validate the LLM-generated script structure.
 * Rejects malformed output (e.g. prompt-injection-corrupted responses).
 */
export interface Scene { heading: string; text: string; }
export interface Script {
  title: string;
  intro: string;
  scenes: Scene[];
  outro: string;
}

export function validateScript(raw: unknown): { ok: true; value: Script } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'script is not an object' };
  const s = raw as Record<string, unknown>;
  if (typeof s.title !== 'string' || s.title.trim().length === 0) return { ok: false, error: 'script.title missing or empty' };
  if (typeof s.intro !== 'string') return { ok: false, error: 'script.intro missing' };
  if (typeof s.outro !== 'string') return { ok: false, error: 'script.outro missing' };
  if (!Array.isArray(s.scenes) || s.scenes.length === 0) return { ok: false, error: 'script.scenes must be a non-empty array' };
  if (s.scenes.length > 25) return { ok: false, error: 'script.scenes too long (max 25)' };
  for (let i = 0; i < s.scenes.length; i++) {
    const sc = s.scenes[i];
    if (!sc || typeof sc !== 'object') return { ok: false, error: `scene[${i}] is not an object` };
    if (typeof sc.heading !== 'string' || sc.heading.trim().length === 0) return { ok: false, error: `scene[${i}].heading missing` };
    if (typeof sc.text !== 'string' || sc.text.trim().length === 0) return { ok: false, error: `scene[${i}].text missing` };
    if (sc.text.length > 4000) return { ok: false, error: `scene[${i}].text too long (max 4000 chars)` };
  }
  return {
    ok: true,
    value: {
      title: String(s.title).slice(0, 200),
      intro: String(s.intro).slice(0, 1000),
      outro: String(s.outro).slice(0, 1000),
      scenes: (s.scenes as Scene[]).map((sc) => ({
        heading: String(sc.heading).slice(0, 200),
        text: String(sc.text).slice(0, 4000),
      })),
    },
  };
}

/**
 * Prompt-injection guard: returns a sanitized prompt string + flags suspicious content.
 * Does NOT reject legitimate creative prompts; only flags obvious override attempts
 * for logging. The LLM system prompt explicitly instructs the model to ignore
 * embedded instructions in the user prompt (defense in depth).
 */
export function sanitizePrompt(prompt: string): { sanitized: string; suspicious: boolean; flags: string[] } {
  const flags: string[] = [];
  const lower = prompt.toLowerCase();
  const suspiciousPatterns = [
    /ignore (previous|prior|all) instructions/i,
    /system prompt/i,
    /you are now/i,
    /forget everything/i,
    /disregard the above/i,
    /new instructions:/i,
    /\brole\s*:\s*(?!mother|father|teacher|narrator|doctor|expert)/i,
  ];
  for (const p of suspiciousPatterns) {
    if (p.test(prompt)) flags.push(p.source.slice(0, 40));
  }
  // strip null bytes + control chars (except newline/tab)
  const sanitized = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  return { sanitized, suspicious: flags.length > 0, flags };
}
