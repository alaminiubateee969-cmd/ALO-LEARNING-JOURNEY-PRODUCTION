#!/usr/bin/env python3
"""Generate local AgentOS catalog scaffolds. No tools are granted or executed.

By default this writes an agent registry plus 20,000 private SKILL.md scaffold
files. It refuses to overwrite anything and requires --confirm-generation.
Generated skills remain private and pending owner approval/validation.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROLES = ["manager", "planner", "executor", "quality-assurance", "reporter",
         "automation-planner", "safety-reviewer", "memory-curator",
         "productivity-analyst", "owner-approval-coordinator"] + [f"specialist-{i:02d}" for i in range(1, 11)]
SKILL_ACTIONS = ["analyze-request", "build-plan", "gather-approved-context", "draft-output",
                 "review-quality", "check-safety", "check-permissions", "prepare-report",
                 "prepare-approval-request", "record-audit", "create-checklist", "summarize-evidence",
                 "identify-risks", "prepare-template", "validate-input", "verify-output",
                 "handoff-to-owner", "suggest-improvement", "prepare-workflow", "archive-result"]
FORBIDDEN = ["unrestricted_shell", "secret_read", "paid_api", "bulk_send", "dns_change",
             "delete_files", "public_publish", "private_login_scrape", "nonconsensual_identity_clone"]


def slug(text: str) -> str:
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", text.lower()))


def departments() -> list[str]:
    source = (ROOT / "src/lib/departments.ts").read_text(encoding="utf-8")
    names = re.findall(r'^\s*\{\s*name:\s*"([^"]+)"', source, re.MULTILINE)
    if len(names) != 100 or len(set(names)) != 100:
        raise SystemExit(f"Expected exactly 100 unique departments in src/lib/departments.ts; found {len(names)}")
    return names


def agent_records(depts: list[str]) -> list[dict]:
    records = []
    for d_idx, dept in enumerate(depts, 1):
        for r_idx, role in enumerate(ROLES):
            n = (d_idx - 1) * len(ROLES) + r_idx + 1
            records.append({
                "id": f"AGENT-{n:04d}", "name": f"{dept} {role.replace('-', ' ').title()}",
                "slug": f"{slug(dept)}-{role}", "department_id": f"DEPT-{d_idx:03d}",
                "department_name": dept, "purpose": f"Scaffold for {role} support in {dept}; not an active worker.",
                "allowed_skills": [], "forbidden_skills": ["unapproved", "quarantined", "public", "paid-api", "unsafe"],
                "allowed_tools": [], "forbidden_tools": FORBIDDEN,
                "input_schema": {"type": "object", "required": ["owner_command"], "additionalProperties": False},
                "output_schema": {"type": "object", "required": ["status", "summary", "approval_required"]},
                "workflow_steps": ["validate", "protect", "request approval when required", "return draft"],
                "protection_rules": ["local-first", "private-skills-only", "no-secrets", "no-unrestricted-shell"],
                "approval_rules": ["owner approval required before activation or external action"],
                "handoff_rules": ["handoff risky or unsupported work to owner"],
                "quality_checklist": ["validate input", "report uncertainty", "do not claim unexecuted work"],
                "self_improvement_rules": ["suggest only; never self-modify"],
                "productivity_rules": ["reuse approved knowledge; do not create capabilities automatically"],
                "status": "planned", "version": "0.1.0-scaffold",
            })
    return records


def skill_markdown(dept: str, category_idx: int, skill_idx: int) -> str:
    action = SKILL_ACTIONS[skill_idx % len(SKILL_ACTIONS)]
    skill_name = f"{slug(dept)}-{action}-{skill_idx + 1:03d}"
    category = f"{dept} Skills"
    risk = "low" if skill_idx < 120 else "medium" if skill_idx < 180 else "high"
    requires = "true"  # every new skill requires owner approval before activation
    return f'''---
name: {skill_name}
title: "{dept}: {action.replace('-', ' ').title()} {skill_idx + 1}"
category: "{category}"
version: 1.0.0
status: private
risk_level: {risk}
requires_approval: {requires}
allowed_tools:
  - local_ai
  - memory_read
  - memory_write
  - file_output
forbidden_tools:
  - unrestricted_shell
  - secret_read
  - paid_api
  - bulk_send
  - dns_change
  - delete_files
  - public_publish
  - private_login_scrape
  - real_person_clone_without_consent
  - celebrity_voice_clone
  - copyrighted_music_copy
  - copyrighted_website_copy
inputs:
  - owner_command
  - task_context
outputs:
  - skill_output
---

# Purpose
Private skill scaffold only. It is not executable and is pending validation and owner approval.

## When to Use
Only for an owner-authorized task in {category}.

## Inputs
- owner_command
- task_context

## Steps
1. Validate the request and use only approved private context.
2. Apply protection and payment guards.
3. Stop and request owner approval before risky or external actions.
4. Return a draft or plan; never perform a forbidden action.

## Output Format
Return status, draft, evidence, uncertainty, and required approvals.

## Safety Rules
Local-first. Never access secrets, run unrestricted shell, bypass login or paywalls, scrape private data, spend money, publish, send bulk messages, change DNS, delete files, copy protected works, or clone a real person's face or voice without consent.

## Approval Rules
Keep private and pending. Do not activate or execute before validation, sandbox testing, and explicit owner approval.

## Failure Handling
Stop safely, log the failure, preserve inputs, and return a manual-review plan.

## Example
Input: owner-approved {category.lower()} request. Output: reviewed draft plan only; no external action.
'''


def ensure_fresh(path: Path) -> None:
    if path.exists():
        if any(path.iterdir()) if path.is_dir() else True:
            raise SystemExit(f"Refusing to overwrite existing non-empty path: {path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirm-generation", action="store_true", help="confirm creating 2,000 agent records and 20,000 skill files")
    parser.add_argument("--skills-dir", type=Path, default=ROOT / "skills/private")
    parser.add_argument("--registry", type=Path, default=ROOT / "storage/agentos/agent_registry_2000.json")
    args = parser.parse_args()
    depts = departments()
    if not args.confirm_generation:
        print(f"Dry run: would generate {len(depts) * len(ROLES):,} planned agent records and {len(depts) * 200:,} private skill scaffold files.")
        print("No files written. Review disk usage, then re-run with --confirm-generation.")
        return
    skills_dir = args.skills_dir.resolve()
    registry_path = args.registry.resolve()
    if ROOT not in skills_dir.parents or ROOT not in registry_path.parents:
        raise SystemExit("Output paths must remain inside this repository workspace")
    ensure_fresh(skills_dir)
    if registry_path.exists():
        raise SystemExit(f"Refusing to overwrite existing registry: {registry_path}")
    records = agent_records(depts)
    if len(records) != 2000:
        raise SystemExit(f"Internal catalog error: expected 2,000 agents, got {len(records)}")
    skills_dir.mkdir(parents=True, exist_ok=True)
    for d_idx, dept in enumerate(depts):
        category = skills_dir / slug(dept)
        category.mkdir(parents=True, exist_ok=False)
        for s_idx in range(200):
            skill = category / f"{slug(dept)}-{SKILL_ACTIONS[s_idx % 20]}-{s_idx + 1:03d}"
            skill.mkdir()
            (skill / "SKILL.md").write_text(skill_markdown(dept, d_idx, s_idx), encoding="utf-8")
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    registry_path.write_text(json.dumps({"status": "planned_scaffolds", "departments": len(depts), "agents": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(records)} planned agent descriptors and {len(depts) * 200} private skill scaffolds.")
    print("None are active, validated, or approved. Generated output remains local and is not included in Git.")

if __name__ == "__main__":
    main()
