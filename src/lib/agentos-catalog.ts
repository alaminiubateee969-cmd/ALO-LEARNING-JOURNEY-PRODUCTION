import { DEPARTMENTS } from "@/lib/departments";

/**
 * Catalog scaffolds only. These descriptors are not independent models, active
 * autonomous workers, or permission to execute tools. Activation must follow
 * owner review, implementation, sandbox tests, and an explicit approval.
 */
export const AGENT_ROLES = [
  "manager", "planner", "executor", "quality-assurance", "reporter",
  "automation-planner", "safety-reviewer", "memory-curator", "productivity-analyst",
  "owner-approval-coordinator", "specialist-01", "specialist-02", "specialist-03",
  "specialist-04", "specialist-05", "specialist-06", "specialist-07", "specialist-08",
  "specialist-09", "specialist-10",
] as const;

const DEFAULT_FORBIDDEN_TOOLS = [
  "unrestricted-shell", "secret-read", "paid-api", "bulk-send", "dns-change",
  "delete-files", "public-publish", "private-login-scrape", "real-person-clone-without-consent",
];

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const AGENT_CATALOG = DEPARTMENTS.flatMap((department, departmentIndex) =>
  AGENT_ROLES.map((role, roleIndex) => {
    const sequence = departmentIndex * AGENT_ROLES.length + roleIndex + 1;
    const id = `AGENT-${String(sequence).padStart(4, "0")}`;
    const departmentSlug = slugify(department.name);
    return {
      id,
      name: `${department.name} ${role.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      slug: `${departmentSlug}-${role}`,
      department_id: `DEPT-${String(departmentIndex + 1).padStart(3, "0")}`,
      department_name: department.name,
      purpose: `${role.replace(/-/g, " ")} support for ${department.name}; generated catalog scaffold requiring owner review and implementation.`,
      allowed_skills: [] as string[],
      forbidden_skills: ["unapproved", "quarantined", "public", "paid-api", "unsafe"],
      allowed_tools: [] as string[],
      forbidden_tools: [...DEFAULT_FORBIDDEN_TOOLS],
      input_schema: { type: "object", properties: { owner_command: { type: "string", maxLength: 8000 } }, required: ["owner_command"], additionalProperties: false },
      output_schema: { type: "object", properties: { status: { type: "string" }, summary: { type: "string" }, approval_required: { type: "boolean" } }, required: ["status", "summary", "approval_required"], additionalProperties: false },
      workflow_steps: ["validate request", "apply protection and payment guards", "request owner approval when required", "return plan or reviewed output"],
      protection_rules: ["local-first", "private-skills-only", "no secrets", "no unrestricted shell", "no public action without approval"],
      approval_rules: ["new-agent activation requires owner approval", "external cost and public actions require owner approval"],
      handoff_rules: ["handoff risky or unsupported work to owner approval queue"],
      quality_checklist: ["validate input", "cite evidence when applicable", "report uncertainty", "never claim unexecuted work"],
      self_improvement_rules: ["suggest improvements only", "never modify its own permissions or code"],
      productivity_rules: ["reuse approved private knowledge", "do not auto-create agents, skills, or workflows"],
      status: "planned" as const,
      version: "0.1.0-scaffold",
    };
  }),
);

export const SKILL_ROLES = [
  "analyze-request", "build-plan", "gather-approved-context", "draft-output", "review-quality",
  "check-safety", "check-permissions", "prepare-report", "prepare-approval-request", "record-audit",
  "create-checklist", "summarize-evidence", "identify-risks", "prepare-template", "validate-input",
  "verify-output", "handoff-to-owner", "suggest-improvement", "prepare-workflow", "archive-result",
] as const;

export const SKILLS_PER_CATEGORY = 200;
export const PRIVATE_SKILL_COUNT = DEPARTMENTS.length * SKILLS_PER_CATEGORY;

export interface SkillDescriptor {
  id: string;
  slug: string;
  category: string;
  category_slug: string;
  title: string;
  risk_level: "low" | "medium" | "high";
  requires_approval: boolean;
  allowed_tools: string[];
  forbidden_tools: string[];
  inputs: string[];
  outputs: string[];
  status: "private";
  validation_status: "pending";
  version: "1.0.0";
}

export function getSkillDescriptor(categoryIndex: number, skillIndex: number): SkillDescriptor | null {
  const department = DEPARTMENTS[categoryIndex];
  if (!department || !Number.isInteger(skillIndex) || skillIndex < 0 || skillIndex >= SKILLS_PER_CATEGORY) return null;
  const categorySlug = slugify(department.name);
  const role = SKILL_ROLES[skillIndex % SKILL_ROLES.length];
  const skillNumber = skillIndex + 1;
  const risk = skillIndex >= 180 ? "high" : skillIndex >= 120 ? "medium" : "low";
  return {
    id: `SKILL-${String(categoryIndex * SKILLS_PER_CATEGORY + skillNumber).padStart(5, "0")}`,
    slug: `${categorySlug}-${role}-${String(skillNumber).padStart(3, "0")}`,
    category: `${department.name} Skills`,
    category_slug: categorySlug,
    title: `${department.name}: ${role.replace(/-/g, " ")} ${skillNumber}`,
    risk_level: risk,
    requires_approval: true,
    allowed_tools: ["local_ai", "memory_read", "memory_write", "file_output"],
    forbidden_tools: [...DEFAULT_FORBIDDEN_TOOLS, "celebrity-voice-clone", "copyrighted-copy"],
    inputs: ["owner_command", "task_context"],
    outputs: ["skill_output"],
    status: "private",
    validation_status: "pending",
    version: "1.0.0",
  };
}

export function listSkillDescriptors(options: { offset?: number; limit?: number; category?: number } = {}) {
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  const limit = Math.min(200, Math.max(1, Math.floor(options.limit ?? 50)));
  const categories = options.category === undefined
    ? DEPARTMENTS.map((_, index) => index)
    : (options.category >= 0 && options.category < DEPARTMENTS.length ? [options.category] : []);
  const result: SkillDescriptor[] = [];
  let index = 0;
  for (const category of categories) {
    for (let skill = 0; skill < SKILLS_PER_CATEGORY; skill++, index++) {
      if (index >= offset && result.length < limit) {
        const descriptor = getSkillDescriptor(category, skill);
        if (descriptor) result.push(descriptor);
      }
    }
  }
  return result;
}

export function renderSkillMarkdown(skill: SkillDescriptor): string {
  const yaml = (items: string[]) => items.map((item) => `  - ${JSON.stringify(item)}`).join("\n");
  return `---\nname: ${skill.slug}\ntitle: ${JSON.stringify(skill.title)}\ncategory: ${JSON.stringify(skill.category)}\nversion: ${skill.version}\nstatus: private\nrisk_level: ${skill.risk_level}\nrequires_approval: ${skill.requires_approval}\nallowed_tools:\n${yaml(skill.allowed_tools)}\nforbidden_tools:\n${yaml(skill.forbidden_tools)}\ninputs:\n${yaml(skill.inputs)}\noutputs:\n${yaml(skill.outputs)}\n---\n\n# Purpose\n\nPrivate skill scaffold only. This skill is not executable and remains unapproved until the owner reviews and tests it.\n\n## When to Use\nUse only for an owner-authorized task in ${skill.category}.\n\n## Inputs\n${skill.inputs.map((item) => `- ${item}`).join("\n")}\n\n## Steps\n1. Validate the task and available approved context.\n2. Apply protection and payment guards.\n3. Stop and request owner approval for risky or external actions.\n4. Produce a draft or plan; never perform a forbidden action.\n\n## Output Format\nReturn a structured draft with status, evidence, uncertainty, and approval requirements.\n\n## Safety Rules\nLocal-first. Never read secrets, run unrestricted shell commands, access private/login/paywalled sites, spend money, publish, send bulk messages, alter DNS, delete files, or clone a real person's face or voice without required owner approval and consent.\n\n## Approval Rules\nStatus is private and validation is pending. Do not activate or execute without owner approval, successful validation, and a sandbox test.\n\n## Failure Handling\nStop safely, log the failure, preserve inputs, and return a manual-review plan.\n\n## Example\nInput: an owner-approved ${skill.category.toLowerCase()} task.\nOutput: a draft plan requiring review; no external action is taken.\n`;
}

export const AGENTOS_POLICY = {
  local_first: true,
  private_agents_only: true,
  private_skills_only: true,
  public_skills_disabled: true,
  self_improvement_enabled: true,
  productivity_mode_enabled: true,
  protection_mode_enabled: true,
  payment_guard_enabled: true,
  paid_ai_api_allowed: false,
  owner_approval_required_for_new_agent: true,
  owner_approval_required_for_new_skill: true,
  owner_approval_required_for_new_workflow: true,
  owner_approval_required_for_shell_commands: true,
  owner_approval_required_for_public_publish: true,
  owner_approval_required_for_deployment: true,
  no_surprise_payment: true,
} as const;
