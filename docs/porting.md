# Porting map: Claude Code ↔ Codex

| Capability | Claude Code | Codex |
|---|---|---|
| Workflow entry points | Plugin skills `/harness:plan`, `review`, `commit`, `pr`, `worktree`(-`remove`) | Protocol files installed as custom prompts (and as skills where supported) — same names, single-context |
| Architect consultation | Subagents (13 generic + project-declared domain architects) | The `/plan` protocol walks the architect council sequentially in one context |
| Graph verification (`plan-graph`, `review --graph`) | Workflow scripts orchestrating investigator/refuter subagents | **Does not port.** No orchestration primitive. The `/review` protocol keeps the anchor discipline (quotes + commands) without fresh-context verifiers |
| Project self-description | CLAUDE.md (gate, routing table, components, branch, worktree table) | AGENTS.md, same sections minus subagent routing |
| Global config | `~/.claude/settings.json`, hooks, keybindings | `~/.codex/config.toml` (no hook/keybinding equivalent) |
| Frozen-rule enforcement | `check-frozen.sh` in the plugin | Not enforced; `FROZEN.md` principles are inlined as prose in the protocols |
| Memory | Claude Code auto-memory | None — AGENTS.md carries only durable, hand-curated facts |

Rule of thumb: content ports, orchestration doesn't. Anything that depends
on two contexts not sharing history (philosophy §2) has no Codex equivalent
and is only approximated.
