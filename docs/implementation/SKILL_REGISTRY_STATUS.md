# Skill registry status — 2026-10-18

| Registry category | Registered/planned | Implemented | Tested | Approved/enabled |
|---|---:|---:|---:|---:|
| Existing code utilities/kits | Several code-based utilities | Partial; app-specific paths | Existing project tests | Not a unified skill registry |
| AgentOS virtual descriptors | 20,000 templates (100 categories × 200) | 0 executable skill bindings | Catalog shape/count and draft validator tests | 0 approved/enabled |
| Generated `SKILL.md` files | 0 generated in this checkout | Not applicable | Generator dry run and Python syntax only | 0 |

The generator requires explicit `--confirm-generation`, refuses overwrites, and writes ignored local files. A generated markdown file is still a scaffold, not a working skill. The validator is heuristic and not a security sandbox. Full operational skills require individually reviewed implementation bindings, permissions, tests, owner approval and rollback.
