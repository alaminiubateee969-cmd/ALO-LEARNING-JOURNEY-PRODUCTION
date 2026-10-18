#!/usr/bin/env python3
"""Read-only validation for generated private skill scaffolds."""
from pathlib import Path
import argparse
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
BLOCKED = [
    re.compile(r"curl\s+[^\n|]*\|\s*(?:bash|sh)|wget\s+[^\n|]*\|\s*(?:bash|sh)", re.I),
    re.compile(r"(?:read|cat|print|exfiltrate)\s+.{0,30}(?:\.env|id_rsa|\.ssh/|/etc/shadow)", re.I),
    re.compile(r"(?:bypass|circumvent).{0,30}(?:login|paywall|authentication)", re.I),
    re.compile(r"^\s*(?:ignore|override)\s+(?:all\s+)?(?:safety|system|previous instructions)", re.I | re.M),
]


def validate(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    errors = []
    for pattern in BLOCKED:
        if pattern.search(text):
            errors.append(f"blocked content matches {pattern.pattern}")
    if not re.search(r"^status:\s*private\s*$", text, re.M): errors.append("not private")
    for section in ("Purpose", "When to Use", "Inputs", "Steps", "Output Format", "Safety Rules", "Approval Rules", "Failure Handling", "Example"):
        if f"## {section}" not in text and f"# {section}" not in text: errors.append(f"missing section: {section}")
    if "requires_approval: true" not in text and "validation and owner approval" not in text:
        errors.append("approval state not described")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skills-dir", type=Path, default=ROOT / "skills/private")
    args = parser.parse_args()
    base = args.skills_dir.resolve()
    if ROOT not in base.parents:
        print("Refusing to scan path outside repository workspace", file=sys.stderr)
        return 2
    files = sorted(base.glob("*/**/SKILL.md")) if base.exists() else []
    if not files:
        print("No generated skill files found; validator did not change files.")
        return 1
    failed = 0
    for path in files:
        errors = validate(path)
        if errors:
            failed += 1
            print(f"BLOCKED {path.relative_to(base)}: {'; '.join(errors)}")
    print(f"Checked {len(files)} skills; blocked={failed}; approved=0 (validation never grants approval).")
    return 1 if failed else 0

if __name__ == "__main__":
    raise SystemExit(main())
