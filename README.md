# agent-harness

A project-agnostic development harness for Claude Code (and, reduced, for
OpenAI Codex). Extracted from a production setup; survives any single project.

Three delivery surfaces:

| Surface | What it is | How it lands |
|---|---|---|
| **Engine** (`plugins/harness/`) | Skills (`/harness:plan`, `plan-graph`, `review`, `commit`, `pr`, `worktree`, `worktree-remove`), 16 generic agents, graph verification machinery | Claude Code plugin from this repo's marketplace; updates by version bump — no copied files, no drift |
| **Project scaffold** (`scaffold/`) | CLAUDE.md template (architect gate + routing table), domain-architect template, env-verify recipe, settings | `scaffold/init.sh <project-dir>` stamps once; the project owns the files afterwards |
| **Global layer** (`global/`) | Permissions allowlist, attention/notify hooks, keybindings, statusline | `global/install.sh` merges into `~/.claude` (never overwrites) |

The `--graph` path of `/harness:review` (`workflows/review-graph.js`) runs five review
lenses; two of them — `silent-failure` and `tests` — default to agents from the separate
`pr-review-toolkit` plugin (claude-plugins-official), not to anything shipped in
`harness` itself. Without `pr-review-toolkit` installed, those two lenses degrade
gracefully (a `WARNING: ... lenses returned nothing` is logged and the result is marked
`partial`, never blocked). Pass `args.lensAgentTypes` on the `Workflow` call to
substitute in-plugin agents instead, e.g.
`{ 'silent-failure': 'pr-review', tests: 'test-architect' }` — unlisted lens keys keep
their default.

## Quickstart

```bash
# 1. Global layer + engine everywhere
./global/install.sh

# 2. New project
./scaffold/init.sh ~/code/my-project "My Project"
# then fill every <!-- FILL --> in the stamped CLAUDE.md

# 3. Codex (reduced port)
./codex/install.sh
```

## Layout

- `docs/philosophy.md` — the workflow discipline, tool-agnostic
- `docs/porting.md` — what maps between Claude Code and Codex
- `plugins/harness/FROZEN.md` — rules that must not decay; `scripts/graph/check-frozen.sh` enforces
- `addons/README.md` — how integrations (ticketing etc.) wrap the engine without entering it
- `tests/run-all.sh` — structural checks, smoke tests, installer tests

## Principles (short form)

Read the code first. Claims carry anchors (a file:line and a command that
proves them). Workers and verifiers never share a context. Type-check,
never build, during development. The engine knows no project; projects
declare themselves in CLAUDE.md and the engine reads it.
