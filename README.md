# agent-harness

A project-agnostic development harness for Claude Code (and, reduced, for
OpenAI Codex). Extracted from a production setup; survives any single
project. Works in any Claude Code surface — terminal CLI, desktop app, or
IDE extension — wherever the plugin is installed.

What you get: workflow skills (`/harness:plan` → `/harness:review` →
`/harness:commit` → `/harness:pr`, plus worktrees, graph-verified planning,
and architect generation), 19 generic expert agents, and a scaffold that
teaches the engine your project's specifics.

## Where to go

| You want to… | Read |
|---|---|
| **Learn which command to use when, and what each needs** | [docs/guide.md](docs/guide.md) — the field guide. Start here. (Short prerequisites answer: only `/harness:pr` needs the GitHub CLI) |
| **Install it** (machine or project) | [Getting started](#getting-started--pick-your-path), just below |
| **Create expert agents for your stack or your domains** | [docs/building-architects.md](docs/building-architects.md) — Claude generates them; you supply context and judge. Or just run `/harness:make-architect` |
| **Understand the graph-verified planner in depth** | [docs/plan-graph.md](docs/plan-graph.md) — pipeline, every knob, failure semantics, recovery |
| **Understand the thinking behind the harness** | [docs/philosophy.md](docs/philosophy.md) — the workflow discipline, tool-agnostic |
| **Use OpenAI Codex** | `codex/install.sh`, and [docs/porting.md](docs/porting.md) for what maps and what doesn't |
| **Add an integration** (ticketing etc.) | [addons/README.md](addons/README.md) — integrations wrap the engine, never enter it |
| **Contribute / understand the internals** | [plugins/harness/FROZEN.md](plugins/harness/FROZEN.md) (rules that must not decay) and `tests/run-all.sh` (the gate — keep it ALL GREEN) |

## The three surfaces

| Surface | What it is | How it lands |
|---|---|---|
| **Engine** (`plugins/harness/`) | The skills, 19 generic agents, graph verification machinery | Claude Code plugin from this repo's marketplace; updates by version bump — no copied files, no drift |
| **Project scaffold** (`scaffold/`) | CLAUDE.md template (architect gate + routing table), architect output-contract templates, env-verify recipe, settings | `scaffold/init.sh <project-dir>` stamps once; the project owns the files afterwards |
| **Global layer** (`global/`) | Permissions allowlist, attention/notify hooks, keybindings, statusline | `global/install.sh` merges into `~/.claude` (never overwrites) |

## Getting started — pick your path

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

## Principles (short form)

Read the code first. Claims carry anchors (a file:line and a command that
proves them). Workers and verifiers never share a context. Type-check,
never build, during development. The engine knows no project; projects
declare themselves in CLAUDE.md and the engine reads it. Architects are
LLM-generated; humans supply context and judge. Full version:
[docs/philosophy.md](docs/philosophy.md).
