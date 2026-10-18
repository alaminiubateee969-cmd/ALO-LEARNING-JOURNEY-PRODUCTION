export type SkillValidationStatus = "PASS" | "WARNING" | "BLOCKED";

const BLOCK_PATTERNS: Array<[RegExp, string]> = [
  [/curl\s+[^\n|]*\|\s*(?:bash|sh)|wget\s+[^\n|]*\|\s*(?:bash|sh)/i, "pipe-to-shell command"],
  [/(?:\.env|id_rsa|\.ssh\/|shadow|browser.{0,20}(?:password|cookie)|wallet.{0,20}(?:key|file))/i, "credential or sensitive-file access"],
  [/(?:paid\s*api|public\s*publish|bulk\s*(?:whatsapp|message)|dns\s*change|delete\s+files?)/i, "high-impact action requires explicit owner approval"],
  [/(?:bypass|circumvent).{0,30}(?:login|paywall|authentication)/i, "access-control bypass"],
  [/(?:celebrity|real.person).{0,40}(?:voice.clone|face.clone|impersonat)/i, "non-consensual identity imitation risk"],
  [/(?:ignore|override).{0,30}(?:safety|system|previous instructions)/i, "instruction override / prompt injection"],
];

export function validatePrivateSkill(source: string) {
  if (typeof source !== "string" || source.trim().length < 20) {
    return { status: "BLOCKED" as const, reasons: ["skill content is missing or too short"], warnings: [] };
  }
  const reasons = BLOCK_PATTERNS.filter(([pattern]) => pattern.test(source)).map(([, reason]) => reason);
  const warnings: string[] = [];
  if (!/^---\s*\n[\s\S]*?\n---/m.test(source)) warnings.push("missing YAML frontmatter");
  if (!/^status:\s*private\s*$/m.test(source)) reasons.push("only private skill status is allowed");
  if (!/^allowed_tools:[\s\S]*?memory_read[\s\S]*?memory_write[\s\S]*?file_output/m.test(source)) {
    warnings.push("allowed tool declarations do not match the minimal private skill tool set");
  }
  if (!/^approval_rules:/m.test(source) && !/## Approval Rules/i.test(source)) warnings.push("approval rules are not documented");
  return { status: reasons.length ? "BLOCKED" as const : warnings.length ? "WARNING" as const : "PASS" as const, reasons, warnings };
}
