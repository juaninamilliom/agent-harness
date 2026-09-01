# agent-harness

A project-agnostic development harness for Claude Code (and, reduced, for
OpenAI Codex). Extracted from a production setup; survives any single project.

Three delivery surfaces:

| Surface | What it is | How it lands |
|---|---|---|
| **Engine** (`plugins/harness/`) | Skills (`/harness:plan`, `plan-graph`, `review`, `commit`, `pr`, `worktree`, `worktree-remove`), 19 generic agents, graph verification machinery | Claude Code plugin from this repo's marketplace; updates by version bump — no copied files, no drift |
| **Project scaffold** (`scaffold/`) | CLAUDE.md template (architect gate + routing table), craft- and domain-architect templates, env-verify recipe, settings | `scaffold/init.sh <project-dir>` stamps once; the project owns the files afterwards |
| **Global layer** (`global/`) | Permissions allowlist, attention/notify hooks, keybindings, statusline | `global/install.sh` merges into `~/.claude` (never overwrites) |

The `--graph` path of `/harness:review` (`workflows/review-graph.js`) runs five review
lenses; two of them — `silent-failure` and `tests` — default to agents from the separate
`pr-review-toolkit` plugin (claude-plugins-official), not to anything shipped in
`harness` itself. Without `pr-review-toolkit` installed, those two lenses degrade
gracefully (a `WARNING: ... lenses returned nothing` is logged and the result is marked
`partial`, never blocked). Pass `args.lensAgentTypes` on the `Workflow` call to
substitute in-plugin agents instead, e.g.
`{ 'silent-failure': 'harness:pr-review', tests: 'harness:test-architect' }` — unlisted
lens keys keep their default.

## Getting started — pick your path

**New here? Read [docs/guide.md](docs/guide.md)** — which command to use
when, and what each one needs (short answer on prerequisites: only
`/harness:pr` needs the GitHub CLI; everything else is plain git).

**Path 1 — teammate of a project that already uses the harness: do nothing.**
Clone the project, open Claude Code, accept the one-time marketplace/plugin
prompt (the project's committed `.claude/settings.json` carries it). Done —
`/harness:*` works.

**Path 2 — just the engine, any machine, two commands:**

```bash
claude plugin marketplace add juaninamilliom/agent-harness
claude plugin install harness@agent-harness
```

`/harness:*` now works in every directory. Skills degrade gracefully without
a scaffolded CLAUDE.md (repo-default branches, lockfile-detected installs,
generic architects only).

**Path 3 — full adoption (your machine + your projects):**

```bash
git clone https://github.com/juaninamilliom/agent-harness.git && cd agent-harness

# 1. Global layer + engine everywhere (macOS-oriented: hooks use AppleScript;
#    Linux users should skip this and take Path 2)
./global/install.sh && ./global/doctor.sh

# 2. Per project, once
./scaffold/init.sh ~/code/my-project "My Project"
# then fill every <!-- FILL --> in the stamped CLAUDE.md — the 15 minutes
# that make the engine smart about YOUR project — and commit CLAUDE.md +
# .claude/settings.json so teammates land on Path 1

# 3. Codex (reduced port), optional
./codex/install.sh
```

Forking instead of consuming this marketplace? Re-point one line:
`scaffold/settings.json`'s `extraKnownMarketplaces` repo.

When a domain of your project earns its own expert agent, see **"Carving
your domains"** at the top of `scaffold/agents/_domain-architect.template.md`.

## Layout

- `docs/guide.md` — the field guide: which command when, prerequisites, FAQ
- `docs/plan-graph.md` — the plan-graph workflow reference: pipeline, knobs, failure semantics, recovery
- `docs/building-architects.md` — how to write your own craft and domain architects (worked C++ examples)
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
