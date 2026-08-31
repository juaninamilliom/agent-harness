# Agent Harness — Design

**Date:** 2026-08-31
**Status:** Approved

## Purpose

A project-agnostic development harness, extracted from the Beep-era Claude Code
setup, that survives a post-Beep world. It splits into a **system harness**
(global, follows the user onto any machine and into any directory) and a
**project harness scaffold** (stamped into each project, then owned and
customized by that project). A reduced port of the same workflow discipline
ships for OpenAI Codex.

## Decisions (settled during brainstorming)

1. **Home:** a new repo under the user's personal GitHub account (working name
   `agent-harness`), not the beep-it org.
2. **Delivery:** the generic engine ships as a **Claude Code plugin** served
   from this repo acting as a plugin marketplace; the per-project layer is a
   **one-time scaffold stamp**. This replaces beep-claude-config's copy-script
   model, whose drift (installed `.claude/` ahead of the repo) motivated the
   change.
3. **Purity:** the engine has **zero integration awareness**. Ticket systems
   (Trello today, anything tomorrow) arrive later as **add-ons** that wrap the
   engine; the add-on contract is documented now, nothing is built.
4. **Enforcement posture:** the scaffold's CLAUDE.md template keeps the hard
   "⚠️ STOP — architect consultation required" gate **verbatim**.
5. **Codex:** same repo, `codex/` tree, sharing a tool-agnostic philosophy doc.

## Extraction source

The **installed** `/Users/JuansMacbook/Workspace/beep/.claude/` — not the
beep-claude-config repo, which is stale (5 skills vs 9 installed; missing the
graph workflows, refuter agents, and graph scripts).

## Repo layout

```
agent-harness/
├─ README.md                          # what this is, quickstart per surface
├─ docs/
│  ├─ philosophy.md                   # workflow discipline, written once, tool-agnostic
│  ├─ porting.md                      # what maps Claude ↔ Codex and what doesn't
│  └─ superpowers/specs/              # this spec, future specs
├─ .claude-plugin/marketplace.json    # repo doubles as a plugin marketplace
├─ plugins/harness/                   # THE ENGINE (Claude Code plugin)
│  ├─ .claude-plugin/plugin.json
│  ├─ skills/                         # plan, plan-graph, review, commit, pr,
│  │                                  # worktree, worktree-remove
│  ├─ agents/                         # 13 generic architects/gates + graph crew
│  ├─ scripts/graph/                  # check-quote.sh, check-assumptions.sh,
│  │                                  # check-frozen.sh, risk-gate.sh
│  └─ workflows/                      # plan-graph.js, review-graph.js + smoke tests
├─ scaffold/                          # project-layer template + init.sh
├─ global/                            # ~/.claude dotfiles + installer + doctor
├─ addons/                            # empty; README fixes the contract
└─ codex/                             # reduced port for OpenAI Codex
```

## Engine plugin (`plugins/harness/`)

**Skills:** `plan`, `plan-graph`, `review` (incl. `--graph`), `commit`, `pr`,
`worktree`, `worktree-remove`. De-Beeping rules:

- All Trello/ticket logic removed entirely.
- Protected branches and PR base: read from project CLAUDE.md if declared,
  else detect the repo's default branch. (Beep hardcodes `dev`.)
- Worktree parent-dir convention configurable; default `<repo>-worktrees/<name>`.
- All beep/sui/solana/GCP references stripped or replaced with placeholders
  that read from project CLAUDE.md.

**Agents:** code-architect, frontend-architect, api-architect, db-architect,
test-architect, security-architect, performance-architect, docs-architect,
ai-systems-architect, android-architect, build-validator, code-simplifier,
pr-review — plus the graph crew: plan-investigator, claim-refuter,
finding-refuter. build-validator keeps the "type-check, never `npm run build`"
doctrine but reads the project's actual check commands from its CLAUDE.md.

**Graph machinery:** `scripts/graph/*.sh` and the two workflow scripts with
their smoke tests. **Main mechanical port risk:** hardcoded
`.claude/scripts/graph/...` paths must become `${CLAUDE_PLUGIN_ROOT}`-relative,
including inside agent frontmatter tool grants (e.g. claim-refuter's
`Bash(.claude/scripts/graph/check-quote.sh:*)`). The smoke tests are the
safety net and must pass against the plugin layout.

**Namespacing and extension point:** engine skills arrive as `/harness:plan`
etc. A project wanting bare `/plan` — or project glue around the engine —
ships a thin unnamespaced skill that delegates to the namespaced one. This is
the documented seam the ticketing add-on will use.

## Project scaffold (`scaffold/`)

`init.sh <project-dir>` stamps files the **project owns**; harness updates
never touch them (engine updates flow through the plugin version instead —
this is the fix for the drift problem).

- `CLAUDE.template.md` — hard architect gate verbatim; domain→architect
  routing table (generic rows pre-filled, domain rows as placeholders);
  `<!-- FILL -->` sections for components, dev commands, git structure; the
  never-`npm run build` doctrine as an optional block.
- `agents/_domain-architect.template.md` — how to write a domain architect
  (frontmatter shape, trigger examples, read-only tool grants), distilled from
  beep's treasury/trading/prediction architects.
- `skills/_env-verify.template/` — the dev-verify/prod-verify pattern
  genericized: env-scoped, read-only defaults, "no environment named = dev".
- `settings.local.json` starter + a **committed** `.claude/settings.json`
  registering the marketplace and enabling the harness plugin, so a fresh
  clone of a scaffolded project gets the engine automatically.

## Global layer (`global/`)

Captures what lives un-versioned in `~/.claude/` today; `install.sh` applies it.

- `settings.json` fragment: genericized permissions allowlist (drop
  `pond.dflow.net`, Telegram, Trello/Postman MCP grants — the MCP grants move
  to the future ticketing add-on) plus user-level marketplace registration and
  plugin enablement so the engine is available in every directory. Installer
  **merges** with jq (Claude Code appends to settings.json at runtime;
  overwrite would lose live-approved permissions).
- `hooks/`: attention + notify-ready scripts, **symlinked** (repo stays the
  source of truth).
- `keybindings.json`: copied only if absent.
- `doctor.sh`: reports drift between repo and installed global.
- Cleanup: installer flags and removes the two stray `~/.claude/agents/`
  files (code-architect, ai-systems-architect) that would duplicate the
  plugin's agents.

## Add-on contract (`addons/`)

README only. An add-on is either **(a)** another plugin in this same
marketplace (e.g. `plugins/trello/` shipping MCP config plus an unnamespaced
`/plan` wrapper that fetches the ticket then delegates to `/harness:plan`), or
**(b)** a scaffold overlay stamped into a project's own `.claude/`. The engine
never grows integration awareness; add-ons wrap it.

## Codex tree (`codex/`)

Honest reduced port — Codex has no plugins, subagents, or hooks.

- `install.sh` → `~/.codex/`: `config.toml` (approval policy, sandbox,
  profiles, MCP section), global `AGENTS.md` (communication style + workflow
  discipline rendered from `docs/philosophy.md`), `prompts/*.md`.
- `prompts/`: skills reborn as single-shot structured prompts — `/plan` walks
  the architect council sequentially in one context (the hard gate becomes
  "work through this council before coding"), `/review` is the three-pass
  review as a self-review protocol, `/commit` is the quality-gate checklist
  (type-check-don't-build, lint, diff review, message format), `/pr`,
  `/worktree`.
- `AGENTS.template.md`: project scaffold mirroring `CLAUDE.template.md`.
- **Doesn't port** (recorded in `docs/porting.md`): plan-graph/review-graph,
  agents-as-processes, hooks, keybindings, memory.
- Current Codex config/prompt formats must be verified against live docs
  during implementation; training data may lag.

## Build order and verification

1. Repo skeleton + docs; this spec is the first commit.
2. Port engine from beep's installed `.claude/` → de-Beep → repath to
   `${CLAUDE_PLUGIN_ROOT}` → run smoke tests against the plugin layout.
3. Global layer; then scaffold + `init.sh`.
4. Test drive: scaffold a throwaway project (scratchpad), add the marketplace
   from the local path, run `/harness:plan` and `/harness:review` on toy code.
5. Codex tree (with live-docs check).
6. `gh repo create` under the personal account; push.

## Out of scope

- Any change to beep's installed `.claude/` or to beep-claude-config. Beep is
  untouched; optionally, later, beep-claude-config becomes a marketplace
  consumer plus domain overlays.
- Building the ticketing add-on (contract documented only).
- Porting graph orchestration to Codex.
