# Agent Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `agent-harness` repo: a Claude Code engine plugin (extracted from beep's installed `.claude/`), a project scaffold, a global `~/.claude` dotfiles layer, an add-on contract, and a Codex reduced port — then publish to the user's personal GitHub.

**Architecture:** The repo is a Claude Code plugin marketplace whose single plugin ("harness") carries the de-Beeped engine (skills, agents, graph machinery). A one-time scaffold stamps the project-owned layer (CLAUDE.md, domain-architect templates). A global installer merge-applies dotfiles into `~/.claude`. Codex gets single-context protocol files installed into `~/.codex`.

**Tech Stack:** Bash (installers, graph scripts), Node (workflow scripts + smoke tests), JSON/TOML config, Markdown (skills/agents/templates).

**Spec:** `docs/superpowers/specs/2026-08-31-agent-harness-design.md` (same repo — read it first).

## Global Constraints

- **Repo root:** `/Users/JuansMacbook/Workspace/agent-harness`. All paths below are relative to it unless absolute.
- **Extraction source:** `/Users/JuansMacbook/Workspace/beep/.claude/` (the *installed* config). NEVER read from `~/Workspace/beep-claude-config` (stale). NEVER modify anything under `~/Workspace/beep/` or `~/Workspace/beep-claude-config/`.
- **De-Beeping invariant:** after each port task, this grep over the task's files MUST return nothing:
  `grep -rEin 'beep|justbeep|trello|solana|\bsui\b|@mysten|privy|turnkey|bluefin|hyperliquid|polymarket|\bdflow\b|kalshi|postman' <files...>`
  (word-boundary on `sui` so "suite"/"pursuit" don't false-positive).
- **De-Beeping Rulebook** (applies to every ported file):
  1. **Tickets:** delete all Trello/ticket logic outright — frontmatter tool lines, argument hints, fetch steps, `[BEEP-XXX]` commit/PR title prefixes, `Trello: <url>` footers. Commit subject becomes a plain concise summary; PR title likewise. Ticketing returns later as an add-on (see `addons/README.md`).
  2. **Branch policy:** replace every hardcoded `dev` integration branch with: *read the project CLAUDE.md "Integration branch" declaration; if absent, detect via `git remote show origin | sed -n '/HEAD branch/s/.*: //p'`.*
  3. **Component paths:** replace `beep-server`/`beep-frontend`/`beep-sdk` references with "each changed component (a directory with its own `package.json`/`tsconfig.json`)" or "the components declared in the project CLAUDE.md".
  4. **War stories:** keep every lesson, anonymize the source. "beep-server PR #1122" → "a 22-file production review". Never delete the rationale a story carries.
  5. **Domain architects:** the engine references only the 13 generic agents. Where a skill routed to treasury/trading/prediction/rewards/live-trading architects, it now says: *"plus any domain architects declared in the project CLAUDE.md routing table (invoke by the name that table gives)."*
  6. **Worktrees:** parent dir convention is `<repo-parent>/<repo>-worktrees/<name>`; per-repo env-file and install commands are read from a "Worktree Setup" table in the project CLAUDE.md; fallback when absent: copy no env files (warn), install by lockfile detection (`pnpm-lock.yaml`→`pnpm install`, `yarn.lock`→`yarn`, else `npm install`).
- **Frozen rules survive:** the F1–F11 markers listed in `FROZEN.md` must remain byte-identical in the ported files. `scripts/graph/check-frozen.sh plugins/harness` must exit 0 from Task 4 onward. If an edit would touch a marker sentence, edit around it.
- **Shell scripts:** new scripts start with `set -euo pipefail`; ported scripts keep their existing `set` lines. Every script must pass `bash -n`.
- **Skill namespace:** engine skills are invoked as `/harness:<name>` (plugin-name:skill-name). Any `Skill(x)` permission entries become `Skill(harness:x)`.
- **Plugin root resolution (confirmed against docs):** `${CLAUDE_PLUGIN_ROOT}` IS expanded in skill markdown bodies and in skill-frontmatter `allowed-tools` Bash rules; it is NOT expanded in agent-frontmatter `tools:`. Therefore: skills reference plugin scripts/workflows as `${CLAUDE_PLUGIN_ROOT}/...` directly; agents that must run a plugin script get a plain `Bash` grant and receive the absolute script path in their task prompt (the workflow builds it from `args.harnessRoot`).
- **Commits:** one per task, conventional style (`feat:`/`chore:`/`docs:`), each ending with the two footer lines:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01NnL7F6gmKtXL1zQ9xJAC3P
  ```
- **YAGNI:** build nothing for the ticketing add-on beyond `addons/README.md`. No CI config in this pass.

---

### Task 1: Repo skeleton, manifests, docs

**Files:**
- Create: `.gitignore`, `README.md`, `docs/philosophy.md`, `docs/porting.md`, `.claude-plugin/marketplace.json`, `plugins/harness/.claude-plugin/plugin.json`

**Interfaces:**
- Produces: marketplace name `agent-harness`, plugin name `harness` (→ skills namespace `/harness:*`, enabledPlugins key `harness@agent-harness`). Every later task relies on these two names.

- [ ] **Step 1: Write `.gitignore`**

```gitignore
.DS_Store
*.log
node_modules/
```

- [ ] **Step 2: Write `.claude-plugin/marketplace.json`**

(Set `owner.name` from `git config --global user.name`; fall back to "Juan" if unset.)

```json
{
  "name": "agent-harness",
  "owner": { "name": "<git config --global user.name>" },
  "plugins": [
    {
      "name": "harness",
      "source": "./plugins/harness",
      "description": "Project-agnostic engine: plan/review/commit/pr/worktree skills, 16 generic agents, graph verification machinery"
    }
  ]
}
```

- [ ] **Step 3: Write `plugins/harness/.claude-plugin/plugin.json`**

```json
{
  "name": "harness",
  "displayName": "Harness",
  "version": "0.1.0",
  "description": "The engine: workflow skills, generic architects and reviewers, graph verification",
  "author": { "name": "<git config --global user.name>" }
}
```
(No component-path fields: `skills/`, `agents/`, and `workflows/` are the auto-discovery defaults, which is exactly our layout. Smoke tests live in repo `tests/`, outside the plugin, so workflow auto-discovery never sees them.)

- [ ] **Step 4: Write `README.md`**

```markdown
# agent-harness

A project-agnostic development harness for Claude Code (and, reduced, for
OpenAI Codex). Extracted from a production setup; survives any single project.

Three delivery surfaces:

| Surface | What it is | How it lands |
|---|---|---|
| **Engine** (`plugins/harness/`) | Skills (`/harness:plan`, `plan-graph`, `review`, `commit`, `pr`, `worktree`, `worktree-remove`), 16 generic agents, graph verification machinery | Claude Code plugin from this repo's marketplace; updates by version bump — no copied files, no drift |
| **Project scaffold** (`scaffold/`) | CLAUDE.md template (architect gate + routing table), domain-architect template, env-verify recipe, settings | `scaffold/init.sh <project-dir>` stamps once; the project owns the files afterwards |
| **Global layer** (`global/`) | Permissions allowlist, attention/notify hooks, keybindings, statusline | `global/install.sh` merges into `~/.claude` (never overwrites) |

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
```

- [ ] **Step 5: Write `docs/philosophy.md`**

```markdown
# The Harness Philosophy

Tool-agnostic. The Claude Code plugin implements this with subagents and
workflows; the Codex port implements it as single-context protocols. Same
discipline either way.

## 1. Read the code first

Plans argue from the code as it is, not from memory of it. A planning claim
is only admissible with an anchor: a file:line and a verbatim quote that a
shell command can re-check. "I believe the service does X" is not a finding;
`service.ts:73` with the quoted line is.

## 2. Workers and verifiers never share a context

A reviewer who watched the work get done inherits the worker's blind spots.
Verification is done by a fresh context that sees the claim and the code,
never the reasoning that produced the claim. Verifiers default to rejecting
a claim they cannot re-establish with an anchor they ran themselves.

## 3. Plan → implement → review → commit, with boundaries

Non-trivial work starts with a plan that names its commit boundaries. Each
commit passes gates before it lands: the type check is a hard block; the
simplification pass is advisory; review findings marked critical block.
Never merge the gate-runner and the gate: the thing that checks is not the
thing that wrote.

## 4. Type-check; never build during development

`tsc --noEmit` (or the project's declared equivalent) answers "is this
well-typed" without producing artifacts that break dev servers and hot
reload. Build output is for production pipelines. Flaky test suites are not
anchors — a suite lies in both directions unless the project CLAUDE.md
declares it trustworthy.

## 5. The engine knows no project

Skills and agents carry method, not facts about any codebase. Everything
project-specific — components, dev commands, integration branch, domain
architects, risky paths — lives in the project's CLAUDE.md and config files,
which the engine reads at run time. Integrations (ticketing and the like)
wrap the engine from the outside; they are never woven into it.

## 6. Frozen rules

Any rule an optimizer would be tempted to weaken — because bending it makes
a run cheaper, faster, or tidier — gets a marker sentence and a checker that
fails when the marker disappears. Prose in a confident tone is not
protection; a failing check is. See `plugins/harness/FROZEN.md`.

## 7. Parallel work uses real worktrees

`git worktree add` under `<repo-parent>/<repo>-worktrees/<name>`, cleaned up
with `git worktree remove`. Tool-invented isolation mechanisms collide with
real worktrees and leave stale registry entries; don't use them.
```

- [ ] **Step 6: Write `docs/porting.md`**

```markdown
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
```

- [ ] **Step 7: Validate and commit**

Run: `jq . .claude-plugin/marketplace.json plugins/harness/.claude-plugin/plugin.json`
Expected: both parse, no error.
Run: `claude plugin validate plugins/harness`
Expected: passes (plugin.json valid; skills/agents dirs may still be empty at this point — tolerate only "no components" style warnings, not errors).

```bash
cd /Users/JuansMacbook/Workspace/agent-harness
git add -A && git commit -m "feat: repo skeleton, plugin manifests, philosophy and porting docs"
```
(append the two footer lines from Global Constraints to this and every commit)

---

### Task 2: Engine skills port

**Files:**
- Create: `plugins/harness/skills/{plan,plan-graph,review,commit,pr,worktree,worktree-remove}/SKILL.md` (copied then edited)
- Source: `/Users/JuansMacbook/Workspace/beep/.claude/skills/<same names>/SKILL.md` — do NOT port `dev-verify`/`prod-verify` (they become a scaffold template in Task 6)

**Interfaces:**
- Consumes: plugin-root resolution rule (Global Constraints); names from Task 1.
- Produces: skill bodies that reference `scripts/graph/*.sh` and `workflows/*.js` via `<plugin-root>/...` absolute paths (Task 4 ships those files); agent references limited to the 13 generic names + "project routing table" phrasing (Task 3 ships the agents).

- [ ] **Step 1: Copy the seven skills**

```bash
cd /Users/JuansMacbook/Workspace/agent-harness
mkdir -p plugins/harness/skills
for s in plan plan-graph review commit pr worktree worktree-remove; do
  cp -R /Users/JuansMacbook/Workspace/beep/.claude/skills/$s plugins/harness/skills/$s
done
```

- [ ] **Step 2: De-Beep `commit/SKILL.md`** (422 lines; hits at 2,4,5,10,36–53,167,209–210,373,377)

Apply Rulebook §1 (tickets) and §4 (stories). Specifically:
- frontmatter `description:` → `Commit changes with quality gates and push to current branch`; delete the optional-Trello tools comment line and `argument-hint`.
- Delete "Step 2: Get Ticket Details" wholesale; renumber later steps.
- The pr-review Task prompt at old line 167: drop the clause `If Trello card [CARD_ID] is available, also validate against acceptance criteria.` — keep the rest verbatim.
- Old lines 209–210 → `Anchors are the project's type check, \`grep\`, and \`git diff\`. **Not the test suite** — unless the project CLAUDE.md declares it trustworthy, a flaky suite lies in both directions.`
- Commit-message template at old 373–377: `[BEEP-<card-short-id>] <concise summary>` → `<concise summary>`; delete the `Trello: <card-url>` line.

- [ ] **Step 3: De-Beep `plan/SKILL.md`** (509 lines)

Rulebook §1, §3, §5. Specifically:
- Delete Trello frontmatter/steps; `argument-hint: [description]`; requirements come from `$ARGUMENTS` or asking the user.
- Domain-detection table: keep the generic rows (Frontend, AI/LLM, Testing, Security, API, Database, Performance, Documentation, Android) with generic path triggers (`*.tsx`, `components/`, `app/`, `hooks/`, `*.test.ts`, `db/`, `migrations/`, `docs/`, `*.kt`); DELETE the Treasury/domain rows; append below the table: `Additionally, read the project CLAUDE.md routing table and add its domain rows — invoke those architects by the names it declares.`
- Old line 130 `Specific Solana patterns` → `Platform- or framework-specific patterns`.
- Phase-output commit lines `[BEEP-XXX] Add <what>` → `Add <what>`.

- [ ] **Step 4: De-Beep `plan-graph/SKILL.md`** (165 lines)

- Delete Trello frontmatter/branches; description-only input.
- Old line 67 `workingDir: "/abs/path/to/beep"` comment → `workingDir: "/abs/path/to/the/repo-root"` with note *the root that contains the components being planned*.
- `scriptPath: "<project>/.claude/workflows/plan-graph.js"` → `scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/plan-graph.js"` (the variable expands in skill bodies, so the model sees the real absolute path) and add: `also pass args.harnessRoot = "${CLAUDE_PLUGIN_ROOT}" — the workflow gives refuters the check-quote script path from it.`

- [ ] **Step 5: De-Beep `review/SKILL.md`** (209 lines)

- Old lines 53–54 (`cd beep-server && npx tsc --noEmit` etc.) → `For each changed component (directory with its own tsconfig.json), run its declared type check from the project CLAUDE.md — default: cd <component> && npx tsc --noEmit`.
- Old 115, 122, 182 anecdotes → Rulebook §4 anonymization (e.g. `Measured on a 22-file production review: a hand-typed file list carried…`), keeping every number and lesson.
- `allowed-tools` frontmatter: replace the two `Bash(.claude/scripts/graph/risk-gate.sh:*)` entries with the single entry `Bash(${CLAUDE_PLUGIN_ROOT}/scripts/graph/risk-gate.sh:*)` (expansion in allowed-tools is confirmed) — and old line 79's invocation → `${CLAUDE_PLUGIN_ROOT}/scripts/graph/risk-gate.sh <component-dir> [base-ref]`.
- `scriptPath` → `${CLAUDE_PLUGIN_ROOT}/workflows/review-graph.js` (+ `args.harnessRoot`, same as Step 4).
- **Do not touch** the three frozen sentences: `not reintroduce keyword scoring`, `not a pass that returned clean`, `there is no graph to build`.

- [ ] **Step 6: De-Beep `pr/SKILL.md`** (119 lines)

- Rulebook §1: delete Trello; `argument-hint: [base-branch?]`; PR title = concise summary of the branch.
- Base-branch selection (Rulebook §2): use `$1` if given; else the project CLAUDE.md "Integration branch"; else `git remote show origin | sed -n '/HEAD branch/s/.*: //p'`. Keep a warning: *if the detected branch is a production branch and the CLAUDE.md declares a separate integration branch, use the integration branch.*
- Acceptance-criteria section: `<if provided by the user, list them as checkboxes>`.

- [ ] **Step 7: De-Beep `worktree/SKILL.md` + `worktree-remove/SKILL.md`**

- All `~/Workspace/beep/<repo-dir>` paths → `<repo-parent>/<repo-dir>`; parent-dir convention row → `<repo-parent>/<repo-dir>-worktrees/`.
- Replace the per-repo table (old lines 39–41) with: `Read the "Worktree Setup" table from the project CLAUDE.md (repo → env files to copy, install command). If absent: copy no env files and say so; install by lockfile (pnpm-lock.yaml → pnpm install, yarn.lock → yarn, else npm install).`
- Old line 14 ("50+ real worktrees across beep-…") → `Real worktrees may already exist for these repos; anything not in \`git worktree list\` is not a project worktree.` Keep the never-EnterWorktree/never-Task-isolation rule verbatim minus repo names; keep the pre-commit-hook warning generic (`if the repo has a pre-commit hook that runs tests, a worktree without deps will fail to commit`).

- [ ] **Step 8: Verify and commit**

Run: `grep -rEin 'beep|justbeep|trello|solana|\bsui\b|@mysten|privy|turnkey|bluefin|hyperliquid|polymarket|\bdflow\b|kalshi|postman' plugins/harness/skills/`
Expected: no output.
Run: `grep -rn '\.claude/scripts\|\.claude/workflows' plugins/harness/skills/`
Expected: no output (all references go through `<plugin-root>`).

```bash
git add -A && git commit -m "feat: port engine skills (plan, plan-graph, review, commit, pr, worktree x2), de-Beeped"
```

---

### Task 3: Engine agents port

**Files:**
- Create: `plugins/harness/agents/*.md` — exactly these 16, copied from `/Users/JuansMacbook/Workspace/beep/.claude/agents/`:
  code-architect, frontend-architect, api-architect, db-architect, test-architect, security-architect, performance-architect, docs-architect, ai-systems-architect, android-architect, build-validator, code-simplifier, pr-review, plan-investigator, claim-refuter, finding-refuter.
  (NOT: treasury/trading-arena/prediction-markets/rewards/live-trading/agent-lifecycle architects, beep-conventions.)

**Interfaces:**
- Consumes: names from Task 1; grant mechanism note from Task 2 Step 5.
- Produces: agent files whose frozen markers Task 4's checker asserts: `not seen the reasoning` (claim-refuter, finding-refuter), `NOT an anchor` (both refuters + plan-investigator), `Never run \`npm run build\`` (build-validator), `Default to DROP` (both refuters), `is the ANCHOR` (claim-refuter).

- [ ] **Step 1: Copy the 16 agents** (one `cp` per file from the list above into `plugins/harness/agents/`)

- [ ] **Step 2: De-Beep, file by file** (hit counts from the source survey; android-architect and code-simplifier have zero — pure copies)

Apply the Rulebook to every hit; the invariant grep in Step 3 is the authority on completeness. File-specific notes:
- `build-validator.md` (11 hits): component build/check commands → `for each component directory containing tsconfig.json, run npx tsc --noEmit; use the project CLAUDE.md's declared check commands when present`. The sentence containing `Never run \`npm run build\`` stays byte-identical.
- `security-architect.md` (18): chain/key-custody specifics (Solana/Sui/Privy/Turnkey) → generic secret-management and key-custody guidance (`non-custodial key material, cloud secret managers, never plaintext credentials`), keeping every OWASP/auth/CSRF/rate-limit rule as-is.
- `docs-architect.md` (23): SDK examples naming BEEP packages → neutral names (`@example/sdk-core`); keep the documentation-quality rules unchanged.
- `pr-review.md` (17): repo-named review examples → anonymized per Rulebook §4.
- `code-architect.md` (8), `test-architect.md` (8), `performance-architect.md` (8), `frontend-architect.md` (5), `ai-systems-architect.md` (4), `api-architect.md` (3), `db-architect.md` (3): scattered example mentions — anonymize in place.
- `claim-refuter.md` (1 + tool grants): frontmatter `tools:` becomes `Read, Grep, Glob, Bash` — `${CLAUDE_PLUGIN_ROOT}` does NOT expand in agent frontmatter and the plugin's install path is not statically knowable, so the narrow per-command grants (git/grep/rg/ls/sed/cat/check-quote) collapse into plain `Bash`; the agent's charter still constrains it to read-only verification. Body references to `./.claude/scripts/graph/check-quote.sh` → `the check-quote.sh path given in your task prompt` (the workflow passes the absolute path — Task 4). Frozen sentences untouched.
- `plan-investigator.md` (1), `finding-refuter.md` (2): anonymize the hits; frozen sentences untouched.

- [ ] **Step 3: Verify and commit**

Run: the De-Beeping invariant grep over `plugins/harness/agents/`. Expected: no output.
Run: `grep -c 'not seen the reasoning' plugins/harness/agents/claim-refuter.md plugins/harness/agents/finding-refuter.md`
Expected: ≥1 in each.

```bash
git add -A && git commit -m "feat: port 16 generic engine agents, de-Beeped, frozen markers intact"
```

---

### Task 4: Graph machinery + FROZEN

**Files:**
- Create (copied then edited): `plugins/harness/FROZEN.md`, `plugins/harness/scripts/graph/{check-quote.sh,check-assumptions.sh,check-frozen.sh,risk-gate.sh}`, `plugins/harness/workflows/{plan-graph.js,review-graph.js}`, `tests/{plan-graph.smoke.mjs,review-graph.smoke.mjs}`
- Source: same-named files under `/Users/JuansMacbook/Workspace/beep/.claude/` (the smoke `.mjs` files move OUT of `workflows/` into repo `tests/` — plugin workflow auto-discovery scans `workflows/` and must only find the two real workflow scripts; the smoke runners take the workflow path as argv, so location doesn't matter to them)

**Interfaces:**
- Consumes: `args.harnessRoot` contract from Task 2 (skills pass `{ workingDir, harnessRoot }`).
- Produces: `check-frozen.sh <plugin-root>` exit 0 = harness integrity; `risk-gate.sh` reads optional `<project>/.claude/risk-patterns.txt` (format: `label<TAB>extended-regex` per line, `#` comments) for project-specific mandatory-tier scans.

- [ ] **Step 1: Copy all nine files** preserving modes (`cp -p`).

- [ ] **Step 2: Repath `plan-graph.js`**

Near the top (after the `workingDir` const at old line 151), add:
```js
const SCRIPTS = (args && args.harnessRoot ? args.harnessRoot : './.claude') + '/scripts/graph'
```
Old line 440: replace the literal `./.claude/scripts/graph/check-quote.sh` inside the refuter-prompt template with `${SCRIPTS}/check-quote.sh` (template interpolation). Search both workflow files for any other `.claude/` literal and treat it the same way.

- [ ] **Step 3: Genericize the smoke-test fixtures**

In both `*.smoke.mjs`: replace fixture path strings `beep-server/src/services/hyperliquid` → `server/src/services/exchange`, `beep-server/src/services/trading-arena` → `server/src/services/arena`, and any other `beep-*` fixture strings similarly (they are arbitrary test data; content of assertions must not change). If a smoke test asserts on the old `./.claude/scripts/graph` path in the refuter prompt, update the expectation to match Step 2 (`args.harnessRoot` set → plugin path).

- [ ] **Step 4: De-Beep `risk-gate.sh`**

- Keep the generic mandatory greps (wallet, `fund|deposit|withdraw|onramp|escrow|collateral|sweep|payout|refund|invoice|charge`, `db/migrations/`, auth) — these are concept-level, not project-level.
- Delete the project-identifier scan lines (`privy|turnkey|signer|subaccount…`, `WalletProviderType|AGENT_CREATE_PRIVATE_WALLET|…`) and the beep-named evidence comment (anonymize per Rulebook §4 — keep the "risk is STRUCTURAL, not LEXICAL" story).
- In their place, load project patterns:
```bash
# Project-specific mandatory-tier patterns: label<TAB>regex per line.
PATTERNS_FILE="$(git rev-parse --show-toplevel 2>/dev/null)/.claude/risk-patterns.txt"
if [ -f "$PATTERNS_FILE" ]; then
  while IFS=$'\t' read -r label regex; do
    case "$label" in ''|'#'*) continue;; esac
    printf '%s\n' "$SUBSTANTIVE" | grep -qiE "$regex" && MAND="$MAND $label"
  done < "$PATTERNS_FILE"
fi
```

- [ ] **Step 5: Adjust `check-frozen.sh` + `FROZEN.md`**

- `check-frozen.sh` usage default already resolves `ROOT` relative to itself (`../..` from `scripts/graph/` = plugin root) — verify that still holds in the plugin layout; update the usage comment to `check-frozen.sh [plugin-root]`.
- `FROZEN.md`: de-Beep prose per the Rulebook (the §8-skip-rules origin story stays, anonymized). The MARKER lines and file paths stay as-is — all referenced files exist in the plugin (verified against the full check list: only agents/, skills/review/, workflows/ paths).

- [ ] **Step 6: Verify and commit**

```bash
bash -n plugins/harness/scripts/graph/*.sh
node tests/plan-graph.smoke.mjs plugins/harness/workflows/plan-graph.js
node tests/review-graph.smoke.mjs plugins/harness/workflows/review-graph.js
plugins/harness/scripts/graph/check-frozen.sh plugins/harness
```
Expected: syntax clean; both smoke suites report 0 failures; check-frozen prints all `ok` and exits 0.
Run the De-Beeping invariant grep over `plugins/harness/scripts plugins/harness/workflows plugins/harness/FROZEN.md`. Expected: no output.

```bash
git add -A && git commit -m "feat: port graph machinery and FROZEN rules; risk-gate reads project patterns; smoke tests green"
```

---

### Task 5: Global layer

**Files:**
- Create: `global/settings.fragment.json`, `global/install.sh`, `global/doctor.sh`, `global/keybindings.json` (copy of `~/.claude/keybindings.json`), `global/hooks/{clear-attention.sh,jump-to-attention.sh,lib-attention.sh,notify-ready.sh}` (verbatim copies from `~/.claude/hooks/`), `tests/test-global-install.sh`

**Interfaces:**
- Consumes: names from Task 1 (`harness@agent-harness`).
- Produces: `install.sh [target-dir]` (default `~/.claude`), idempotent; `doctor.sh [target-dir]` exit 0 = healthy. Both take the target as `$1` so tests run against a sandbox.

- [ ] **Step 1: Copy hooks and keybindings verbatim**

```bash
mkdir -p global/hooks tests
cp -p ~/.claude/hooks/{clear-attention.sh,jump-to-attention.sh,lib-attention.sh,notify-ready.sh} global/hooks/
cp ~/.claude/keybindings.json global/keybindings.json
```
Then run the De-Beeping grep over `global/hooks global/keybindings.json`; fix any hit (none expected — they are attention/notification plumbing).

- [ ] **Step 2: Write `global/settings.fragment.json`** — the curated, de-Beeped allowlist plus hooks/statusline. Exact content:

```json
{
  "permissions": {
    "allow": [
      "Skill(harness:commit)",
      "Skill(harness:plan)",
      "Skill(harness:pr)",
      "Skill(harness:worktree)",
      "Bash(git add:*)",
      "Bash(git fetch:*)",
      "Bash(git stash:*)",
      "Bash(git checkout:*)",
      "Bash(git worktree:*)",
      "Bash(git ls-tree:*)",
      "Bash(gh pr:*)",
      "Bash(gh api:*)",
      "Bash(gh run view:*)",
      "Bash(npm test:*)",
      "Bash(npm run lint)",
      "Bash(npm run lint:*)",
      "Bash(npm run format:*)",
      "Bash(npm ls:*)",
      "Bash(npm show:*)",
      "Bash(npm info:*)",
      "Bash(npm view:*)",
      "Bash(npm audit:*)",
      "Bash(npm install)",
      "Bash(npm install:*)",
      "Bash(npx tsc:*)",
      "Bash(./node_modules/.bin/tsc:*)",
      "Bash(npx jest:*)",
      "Bash(npx eslint:*)",
      "Bash(npx prettier:*)",
      "Bash(npx tsx:*)",
      "Bash(pnpm install:*)",
      "Bash(pnpm test:*)",
      "Bash(pnpm lint:*)",
      "Bash(pnpm build:*)",
      "Bash(pnpm audit:*)",
      "Bash(yarn lint:*)",
      "Bash(node:*)",
      "Bash(python3:*)",
      "Bash(grep:*)",
      "Bash(find:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(echo:*)",
      "Bash(jq:*)",
      "Bash(tee:*)",
      "Bash(xargs:*)",
      "Bash(curl:*)",
      "Bash(docker ps:*)",
      "Bash(claude update:*)",
      "WebSearch",
      "WebFetch(domain:github.com)",
      "WebFetch(domain:www.npmjs.com)",
      "TaskCreate",
      "TaskUpdate",
      "TaskGet",
      "TaskList"
    ],
    "deny": [
      "Bash(git commit --no-verify:*)",
      "Bash(git commit * --no-verify:*)",
      "Bash(git commit*--no-verify*)"
    ]
  },
  "hooks": {
    "Stop": [
      { "hooks": [ { "type": "command", "command": "$HOME/.claude/hooks/notify-ready.sh" } ] }
    ],
    "Notification": [
      { "hooks": [ { "type": "command", "command": "$HOME/.claude/hooks/notify-ready.sh" } ] }
    ],
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "$HOME/.claude/hooks/clear-attention.sh" } ] }
    ]
  },
  "statusLine": {
    "type": "command",
    "command": "input=$(cat); name=$(echo \"$input\" | jq -r '.model.display_name'); dir=$(echo \"$input\" | jq -r '.workspace.current_dir'); base=$(basename \"$dir\"); branch=$(git --no-optional-locks -C \"$dir\" branch --show-current 2>/dev/null); used=$(echo \"$input\" | jq -r '.context_window.used_percentage // empty'); out=\"[$name] 📁 $base\"; [ -n \"$branch\" ] && out=\"$out 🌿 $branch\"; if [ -n \"$used\" ]; then pct=$(printf '%.0f' \"$used\"); out=\"$out | ${pct}% ctx\"; fi; echo \"$out\""
  }
}
```

(Deliberately dropped from the live allowlist: all `mcp__trello__*`/`mcp__postman__*`/`mcp__figma__*` grants, project WebFetch domains, `pnpm --filter @beep-it/*`, gradle/JAVA_HOME entries, `npm run create-auto-migration`, `npm run check-models-consistency`, `docker exec`. Users re-approve per machine as needed; ticket-MCP grants return with the ticketing add-on.)

- [ ] **Step 3: Write the failing test `tests/test-global-install.sh`**

```bash
#!/bin/bash
# Sandbox test for global/install.sh + doctor.sh. No network, never touches real ~/.claude.
set -euo pipefail
cd "$(dirname "$0")/.."
SB=$(mktemp -d); trap 'rm -rf "$SB"' EXIT
fail=0; chk() { if eval "$2"; then echo "  ok  $1"; else echo "  FAIL $1"; fail=1; fi; }

# Seed a fake existing ~/.claude with one user permission and a stray agent
mkdir -p "$SB/claude/agents"
printf '{"permissions":{"allow":["Bash(mycmd:*)"],"deny":[]},"model":"opus"}' > "$SB/claude/settings.json"
touch "$SB/claude/agents/code-architect.md"

./global/install.sh "$SB/claude" > "$SB/install.log" 2>&1

chk "settings backup created"           'ls "$SB"/claude/settings.json.bak-* >/dev/null 2>&1'
chk "user permission preserved"         'jq -e ".permissions.allow | index(\"Bash(mycmd:*)\")" "$SB/claude/settings.json" >/dev/null'
chk "fragment permission merged"        'jq -e ".permissions.allow | index(\"Bash(npx tsc:*)\")" "$SB/claude/settings.json" >/dev/null'
chk "deny merged"                       'jq -e ".permissions.deny | length == 3" "$SB/claude/settings.json" >/dev/null'
chk "user model key untouched"          'jq -e ".model == \"opus\"" "$SB/claude/settings.json" >/dev/null'
chk "hooks config present"              'jq -e ".hooks.Stop" "$SB/claude/settings.json" >/dev/null'
chk "plugin enabled"                    'jq -e ".enabledPlugins[\"harness@agent-harness\"] == true" "$SB/claude/settings.json" >/dev/null'
chk "hook files linked"                 'test -L "$SB/claude/hooks/notify-ready.sh" && test -x "$SB/claude/hooks/notify-ready.sh"'
chk "keybindings installed"             'test -f "$SB/claude/keybindings.json"'
chk "stray agent flagged not deleted"   'test -f "$SB/claude/agents/code-architect.md" && grep -q "stray agent" "$SB/install.log"'

./global/install.sh "$SB/claude" > "$SB/install2.log" 2>&1
chk "idempotent: no duplicate allow"    '[ "$(jq -r ".permissions.allow | index(\"Bash(npx tsc:*)\")" "$SB/claude/settings.json")" != "null" ] && [ "$(jq "[.permissions.allow[] | select(. == \"Bash(npx tsc:*)\")] | length" "$SB/claude/settings.json")" = "1" ]'

./global/install.sh --prune "$SB/claude" > /dev/null 2>&1
chk "prune removes stray agent"         '! test -f "$SB/claude/agents/code-architect.md"'

./global/doctor.sh "$SB/claude" > "$SB/doctor.log" 2>&1
chk "doctor healthy after install"      '[ $? -eq 0 ] || grep -q "healthy" "$SB/doctor.log"'

exit $fail
```

Run: `bash tests/test-global-install.sh`
Expected: FAIL (install.sh doesn't exist yet).

- [ ] **Step 4: Write `global/install.sh`**

```bash
#!/bin/bash
# Merge the harness global layer into a Claude Code home dir. Never overwrites
# user state: permissions are unioned, config keys set only if absent, hooks
# are symlinked, settings.json is backed up first.
# Usage: install.sh [--prune] [target-dir]   (default target: ~/.claude)
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PRUNE=0
if [ "${1:-}" = "--prune" ]; then PRUNE=1; shift; fi
TARGET="${1:-$HOME/.claude}"
mkdir -p "$TARGET/hooks"
SETTINGS="$TARGET/settings.json"
[ -f "$SETTINGS" ] || printf '{}' > "$SETTINGS"
cp "$SETTINGS" "$SETTINGS.bak-$(date +%Y%m%d-%H%M%S)"

python3 - "$SETTINGS" "$REPO/global/settings.fragment.json" "$REPO" <<'PY'
import json, sys
settings_path, fragment_path, repo = sys.argv[1], sys.argv[2], sys.argv[3]
s = json.load(open(settings_path)); f = json.load(open(fragment_path))
perms = s.setdefault("permissions", {})
for key in ("allow", "deny"):
    have = perms.setdefault(key, [])
    for entry in f["permissions"].get(key, []):
        if entry not in have:
            have.append(entry)
# hooks / statusLine: set only if the user has none (never clobber their config)
for key in ("hooks", "statusLine"):
    if key in f and key not in s:
        s[key] = f[key]
# enabledPlugins is a map on current installs but documented as an array - handle both
ep = s.get("enabledPlugins")
if isinstance(ep, list):
    if "harness@agent-harness" not in ep:
        ep.append("harness@agent-harness")
else:
    s.setdefault("enabledPlugins", {})["harness@agent-harness"] = True
json.dump(s, open(settings_path, "w"), indent=2)
print("settings merged")
PY

# Marketplace registration: the CLI writes the canonical settings shape, so use it
# for the real config; sandbox targets (tests) skip it.
if [ "$TARGET" = "$HOME/.claude" ] && command -v claude >/dev/null 2>&1; then
  claude plugin marketplace add "$REPO" || true   # no-op/err if already known
  claude plugin install harness@agent-harness || true
else
  echo "sandbox target: skipped marketplace registration (CLI writes real config only)"
fi

for h in "$REPO"/global/hooks/*.sh; do
  name="$(basename "$h")"
  dest="$TARGET/hooks/$name"
  if [ -e "$dest" ] && [ ! -L "$dest" ]; then mv "$dest" "$dest.bak"; fi
  ln -sfn "$h" "$dest"
done
[ -f "$TARGET/keybindings.json" ] || cp "$REPO/global/keybindings.json" "$TARGET/keybindings.json"

# Stray user-level agents that duplicate the plugin's (would shadow/confuse)
for a in code-architect.md ai-systems-architect.md; do
  if [ -f "$TARGET/agents/$a" ]; then
    if [ "$PRUNE" = 1 ]; then rm "$TARGET/agents/$a"; echo "pruned stray agent: $a"
    else echo "stray agent (duplicate of plugin agent) - rerun with --prune to remove: $a"; fi
  fi
done
echo "global layer installed into $TARGET"
```

- [ ] **Step 5: Write `global/doctor.sh`**

```bash
#!/bin/bash
# Report drift between this repo's global layer and an installed ~/.claude.
# Usage: doctor.sh [target-dir]   Exit 0 = healthy.
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-$HOME/.claude}"
FAIL=0
say() { printf '  %-7s %s\n' "$1" "$2"; }
bad() { say "DRIFT" "$1"; FAIL=1; }

[ -f "$TARGET/settings.json" ] || { echo "no settings.json in $TARGET"; exit 1; }
while IFS= read -r entry; do
  jq -e --arg e "$entry" '.permissions.allow | index($e)' "$TARGET/settings.json" >/dev/null 2>&1 \
    || bad "allow entry missing: $entry"
done < <(jq -r '.permissions.allow[]' "$REPO/global/settings.fragment.json")
jq -e '.enabledPlugins["harness@agent-harness"] == true' "$TARGET/settings.json" >/dev/null 2>&1 \
  || bad "harness plugin not enabled"
for h in "$REPO"/global/hooks/*.sh; do
  name="$(basename "$h")"
  [ "$(readlink "$TARGET/hooks/$name" 2>/dev/null)" = "$h" ] || bad "hook not linked to repo: $name"
done
[ -f "$TARGET/keybindings.json" ] || bad "keybindings.json missing"
for a in code-architect.md ai-systems-architect.md; do
  [ -f "$TARGET/agents/$a" ] && bad "stray agent duplicates plugin agent: $a"
done
[ "$FAIL" = 0 ] && echo "healthy: $TARGET matches the repo's global layer"
exit $FAIL
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `bash -n global/install.sh global/doctor.sh && bash tests/test-global-install.sh`
Expected: all `ok`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: global layer - settings fragment, hooks, keybindings, merge installer, doctor"
```

---

### Task 6: Project scaffold + add-on contract

**Files:**
- Create: `scaffold/init.sh`, `scaffold/CLAUDE.template.md`, `scaffold/agents/_domain-architect.template.md`, `scaffold/skills/_env-verify.template/SKILL.md`, `scaffold/settings.json`, `scaffold/settings.local.json`, `scaffold/risk-patterns.txt.example`, `addons/README.md`, `tests/test-init.sh`

**Interfaces:**
- Consumes: plugin/marketplace names (Task 1); `risk-patterns.txt` format (Task 4).
- Produces: `init.sh <project-dir> [project-name]` — stamps `CLAUDE.md` at the project root and `.claude/{settings.json,settings.local.json,agents/,skills/,risk-patterns.txt.example}`; refuses to overwrite any existing file.

- [ ] **Step 1: Write the failing test `tests/test-init.sh`**

```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
SB=$(mktemp -d); trap 'rm -rf "$SB"' EXIT
fail=0; chk() { if eval "$2"; then echo "  ok  $1"; else echo "  FAIL $1"; fail=1; fi; }

mkdir -p "$SB/proj"; git -C "$SB/proj" init -q
./scaffold/init.sh "$SB/proj" "My Project" > "$SB/init.log" 2>&1

chk "CLAUDE.md stamped"            'test -f "$SB/proj/CLAUDE.md"'
chk "project name substituted"     'grep -q "My Project" "$SB/proj/CLAUDE.md"'
chk "hard gate present"            'grep -q "STOP: Read This First" "$SB/proj/CLAUDE.md"'
chk "fill markers present"         'grep -q "<!-- FILL" "$SB/proj/CLAUDE.md"'
chk "settings enable plugin"       'jq -e ".enabledPlugins[\"harness@agent-harness\"] == true" "$SB/proj/.claude/settings.json" >/dev/null'
chk "settings.local stamped"       'test -f "$SB/proj/.claude/settings.local.json"'
chk "domain template stamped"      'test -f "$SB/proj/.claude/agents/_domain-architect.template.md"'
chk "env-verify template stamped"  'test -f "$SB/proj/.claude/skills/_env-verify.template/SKILL.md"'
chk "risk patterns example"        'test -f "$SB/proj/.claude/risk-patterns.txt.example"'

echo "user edit" >> "$SB/proj/CLAUDE.md"
./scaffold/init.sh "$SB/proj" "My Project" > "$SB/init2.log" 2>&1 || true
chk "never overwrites owned files" 'grep -q "user edit" "$SB/proj/CLAUDE.md" && grep -qi "exists" "$SB/init2.log"'
exit $fail
```

Run: `bash tests/test-init.sh` — Expected: FAIL (init.sh missing).

- [ ] **Step 2: Write `scaffold/CLAUDE.template.md`**

```markdown
# CLAUDE.md

This file provides guidance to Claude Code when working with code in this
repository: __PROJECT_NAME__.

## ⚠️ STOP: Read This First - Architect Requirement

**BEFORE YOU DO ANYTHING ELSE**, determine if this task requires architect consultation:

### Does This Task Require an Architect?

**YES - Invoke architect FIRST** if the task involves:
- New features or functionality (beyond trivial changes)
- API changes (new endpoints, request/response shapes, auth)
- Database changes (models, schema, relationships)
- New UI components or state management changes
- Domain-critical operations (list yours here) <!-- FILL: e.g. payments, billing, auth -->
- Refactoring that touches more than 2-3 files
- Bug fixes affecting core business logic or security

**NO - Proceed directly** only for:
- Single-line typo/bug fixes
- Documentation-only changes
- Adding comments to existing code
- Simple config value changes
- Test additions that don't change implementation

**How:** `/harness:plan [description]` auto-invokes the right architects
based on domain detection. For a single consultation, use the Task tool with
the agent name from the routing table below.

**VIOLATION**: Proceeding with major work without architect consultation
breaks project requirements.

### Architect Routing Table

| Agent | Domain | Triggers |
|-------|--------|----------|
| `code-architect` | General | **DEFAULT** - use when unsure |
| `frontend-architect` | UI/React/CSS | components, hooks, styling, `*.tsx` |
| `api-architect` | REST/API design | endpoints, request/response shapes, routes |
| `db-architect` | Database | models, schema, migrations, SQL |
| `security-architect` | Auth/security | auth, encryption, OWASP, secrets |
| `test-architect` | Testing | tests, coverage, mocks, `*.test.*` |
| `performance-architect` | Performance | optimization, cache, bundle, slow |
| `docs-architect` | Documentation | docs, README, JSDoc, guides |
| `ai-systems-architect` | AI/LLM/MCP | agents, prompts, MCP, `.claude/` |
| `android-architect` | Android/Kotlin | `*.kt`, Android Studio, Gradle |
<!-- FILL: add one row per domain architect you create from
     .claude/agents/_domain-architect.template.md, e.g.:
| `billing-architect` | Payments/billing | invoices, subscriptions, src/billing/** | -->

## Project Overview

<!-- FILL: 3-6 sentences - what this project is, its components, primary stack -->

## Components

<!-- FILL: one row per component (a directory with its own package.json/tsconfig):
| Component | Path | Dev command | Type check | Test command | Trustworthy suite? |
|---|---|---|---|---|---|
| server | server/ | npm run dev | npx tsc --noEmit | npm test | no (flaky) |
-->

## Git Structure

- **Integration branch:** <!-- FILL: e.g. dev - PRs target this, never push to it directly -->
- Protected branches: <!-- FILL: e.g. main, dev -->
<!-- FILL if multi-repo: list each component's repo root; git commands run inside them -->

## Worktree Setup

<!-- FILL: used by /harness:worktree - one row per repo:
| Repo | Env files to copy | Install command |
|---|---|---|
| server | .env | npm install |
-->

## Development Rules

### ⚠️ NEVER Run `npm run build` During Development
Dev servers hot-reload; build output breaks them. Validate types with the
type check commands above instead. Only build for production or when
explicitly asked. <!-- FILL or delete if this project has no dev server -->

<!-- FILL: project-specific conventions, environment notes, read-only dirs -->
```

- [ ] **Step 3: Write `scaffold/agents/_domain-architect.template.md`**

```markdown
---
name: __DOMAIN__-architect
description: >
  Use this agent for __DOMAIN__ features and debugging: <list the concrete
  surfaces - services, flows, directories it owns>. Covers everything in
  <dir>/ .

  Examples:
  <example>
  Context: <a realistic task in this domain>
  user: "<the request>"
  assistant: "This involves __DOMAIN__ <mechanics>. Let me consult the __DOMAIN__-architect."
  </example>
  <example>
  Context: <a realistic bug in this domain>
  user: "<the symptom>"
  assistant: "This is a __DOMAIN__ issue. Let me use the __DOMAIN__-architect to investigate."
  </example>
tools: Read, Grep, Glob, Bash(git:*)
---

You are the principal architect for __DOMAIN__ in this codebase.

# Ground truth
Read the code before answering; cite file:line for every load-bearing claim.
Your domain: <directories>. Adjacent but NOT yours: <directories owned by
other architects - name them so callers get routed correctly>.

# What you know
<Bullet the invariants, state machines, money/data flows, and known traps of
this domain. This section is the agent's value - keep it current.>

# How you answer
- Architecture questions: name the files to touch, the order, and the commit
  boundaries.
- Debugging: trace the actual path in code; name the first place the
  observed behavior diverges from the intended one.
- Always flag changes that touch <the domain's dangerous surface>.
```

- [ ] **Step 4: Write `scaffold/skills/_env-verify.template/SKILL.md`**

```markdown
---
name: env-verify
description: >
  Read and verify the __ENV_NAME__ environment - its logs, its database, its
  endpoints. Use for ANY request to check, read, tail, search, query,
  inspect, debug, verify or prove something on __ENV_NAME__, however short.
  <If you have several environments, copy this skill per environment and
  make the DEFAULT (no environment named) the safest one.>
---

# Verify __ENV_NAME__

Rename this directory (drop `_` and `.template`) and fill in the three
access paths. Delete paths that don't exist rather than inventing them.

## Access paths (exhaustive - there is no other way in)
1. **Logs**: <command or script, e.g. gcloud/kubectl/ssh tail with filters>
2. **Database**: <read-only connection command; state the read-only-ness>
3. **Endpoints**: <curl base URL + auth; omit entirely for prod>

## Rules
- READ-ONLY unless this section explicitly lists a write path.
- Every command states which environment it targets before running.
- Findings report: what was checked, the exact command, what came back.
```

- [ ] **Step 5: Write the three small config files**

`scaffold/settings.json` — the GitHub login is `juaninamilliom` (user-provided repo: https://github.com/juaninamilliom/agent-harness.git); this file ships with it baked in — it is what makes a fresh clone of a scaffolded project pull the engine from GitHub:

```json
{
  "extraKnownMarketplaces": {
    "agent-harness": {
      "source": { "source": "github", "repo": "juaninamilliom/agent-harness" }
    }
  },
  "enabledPlugins": {
    "harness@agent-harness": true
  }
}
```

`scaffold/settings.local.json`:
```json
{
  "permissions": {
    "allow": [],
    "deny": []
  }
}
```

`scaffold/risk-patterns.txt.example`:
```
# Project-specific mandatory-review patterns for the harness risk gate.
# Rename to risk-patterns.txt to activate. Format: label<TAB>extended-regex
# Example (payments project):
# provider-switching	ProviderType|getProviderId|switchProvider
# billing	subscription|invoice|proration
```

- [ ] **Step 6: Write `addons/README.md`**

```markdown
# Add-ons

The engine is integration-free by design (philosophy §5). Anything that
talks to an external system - a ticket tracker, a deploy platform, an
analytics stack - is an add-on that wraps the engine from the outside. Two
sanctioned shapes:

## a) A sibling plugin in this marketplace

`plugins/<addon>/` with its own skills. To extend an engine skill, ship an
UNNAMESPACED wrapper: a project (or the add-on's docs) defines a skill named
e.g. `plan` that does its integration work (fetch the ticket, resolve the
sprint) and then invokes `/harness:plan` with the gathered context. Bare
`/plan` wins for the user; the engine stays untouched.

## b) A scaffold overlay

Files stamped into a project's own `.claude/` (skills, agents, MCP config,
permissions for the integration's tools). The project owns them afterwards,
same as everything `scaffold/init.sh` stamps.

## Planned

- **Ticketing** (first): re-adds what the harness's ancestor had woven in -
  fetch ticket on /plan, ticket-ref in commit messages and PR titles,
  acceptance-criteria validation in review. One wrapper per tracker
  (trello, jira, linear, github-issues), each shape (a).

An add-on may add MCP servers and permission grants; it must not patch,
fork, or depend on the internals of engine skills - only on their names and
the project CLAUDE.md contract.
```

- [ ] **Step 7: Write `scaffold/init.sh`**

```bash
#!/bin/bash
# Stamp the harness project layer into a project. One-time: every stamped
# file becomes project-owned; this script never overwrites anything.
# Usage: init.sh <project-dir> [project-name]
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PROJ="${1:?usage: init.sh <project-dir> [project-name]}"
PROJ="$(cd "$PROJ" && pwd)"
NAME="${2:-$(basename "$PROJ")}"
stamped=0
stamp() { # stamp <src> <dest>
  if [ -e "$2" ]; then echo "  exists, skipped: $2"; else
    mkdir -p "$(dirname "$2")"
    sed "s/__PROJECT_NAME__/$(printf '%s' "$NAME" | sed 's/[&/\]/\\&/g')/g" "$1" > "$2"
    echo "  stamped: $2"; stamped=$((stamped+1))
  fi
}
echo "Stamping harness project layer into $PROJ (project: $NAME)"
stamp "$REPO/scaffold/CLAUDE.template.md"                       "$PROJ/CLAUDE.md"
stamp "$REPO/scaffold/settings.json"                            "$PROJ/.claude/settings.json"
stamp "$REPO/scaffold/settings.local.json"                      "$PROJ/.claude/settings.local.json"
stamp "$REPO/scaffold/agents/_domain-architect.template.md"     "$PROJ/.claude/agents/_domain-architect.template.md"
stamp "$REPO/scaffold/skills/_env-verify.template/SKILL.md"     "$PROJ/.claude/skills/_env-verify.template/SKILL.md"
stamp "$REPO/scaffold/risk-patterns.txt.example"                "$PROJ/.claude/risk-patterns.txt.example"
echo ""
echo "Done ($stamped files). Next:"
echo "  1. Fill every <!-- FILL --> in $PROJ/CLAUDE.md (components, branches, worktree table)"
echo "  2. Create domain architects from the _domain-architect template; add rows to the routing table"
echo "  3. Copy _env-verify.template per environment if you have verifiable envs"
echo "  4. Commit .claude/settings.json and CLAUDE.md so teammates get the engine too"
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `bash -n scaffold/init.sh && bash tests/test-init.sh`
Expected: all `ok`, exit 0.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: project scaffold (CLAUDE template, domain-architect + env-verify templates, init.sh) and add-on contract"
```

---

### Task 7: End-to-end verification + test runner

**Files:**
- Create: `tests/run-all.sh`
- Modify: anything the end-to-end run flags (fixes land in this task's commit)

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: `tests/run-all.sh` exit 0 = the whole repo is structurally sound.

- [ ] **Step 1: Write `tests/run-all.sh`**

```bash
#!/bin/bash
# Structural + behavioral checks for the whole harness repo.
set -uo pipefail
cd "$(dirname "$0")/.."
FAIL=0
run() { echo "== $1"; shift; if "$@"; then echo "   ok"; else echo "   FAIL"; FAIL=1; fi; }

run "manifests parse"      jq -e . .claude-plugin/marketplace.json plugins/harness/.claude-plugin/plugin.json
run "shell syntax"         bash -c 'for f in $(find . -name "*.sh" -not -path "./.git/*"); do bash -n "$f" || exit 1; done'
run "plan-graph smoke"     node tests/plan-graph.smoke.mjs plugins/harness/workflows/plan-graph.js
run "review-graph smoke"   node tests/review-graph.smoke.mjs plugins/harness/workflows/review-graph.js
run "frozen rules"         plugins/harness/scripts/graph/check-frozen.sh plugins/harness
run "de-beeped"            bash -c '! grep -rEinq "beep|justbeep|trello|solana|\bsui\b|@mysten|privy|turnkey|bluefin|hyperliquid|polymarket|\bdflow\b|kalshi|postman" plugins/ scaffold/ global/ codex/ addons/ README.md docs/philosophy.md docs/porting.md 2>/dev/null'
run "global install test"  bash tests/test-global-install.sh
run "init test"            bash tests/test-init.sh
[ -f tests/test-codex-install.sh ] && run "codex install test" bash tests/test-codex-install.sh
[ "$FAIL" = 0 ] && echo "ALL GREEN"
exit $FAIL
```

Run: `bash tests/run-all.sh` — Expected: ALL GREEN (codex test skipped until Task 8).

- [ ] **Step 2: Live plugin load check**

```bash
claude plugin validate plugins/harness
claude plugin marketplace add /Users/JuansMacbook/Workspace/agent-harness
claude plugin install harness@agent-harness
claude plugin list --enabled | grep harness
```
Expected: validate passes; install succeeds at user scope; the list shows `harness@agent-harness`. (This is the desired end state on this machine, not just a probe — leave it installed. The local-path marketplace is fine here: this checkout IS the dev copy; other machines use the GitHub source that `scaffold/settings.json` ships.)
Then: `claude -p "Invoke the harness:worktree skill and report only the worktree parent-directory convention it declares. Create nothing." --max-turns 3 --allowedTools "Skill"` (headless mode auto-denies unmatched permissions; without the grant the skill invocation is refused)
Expected: the reply names `<repo-parent>/<repo>-worktrees/<name>`. If the skill fails to load, fix and re-run before committing.

- [ ] **Step 3: Scaffold live check**

```bash
SB=/private/tmp/claude-501/-Users-JuansMacbook-Workspace-beep/f13fbef1-84a3-45ce-9096-5d82f4d67b5a/scratchpad/e2e-proj
mkdir -p "$SB" && git -C "$SB" init -q && ./scaffold/init.sh "$SB" "E2E Probe"
```
Expected: stamps cleanly; spot-read the stamped CLAUDE.md for correct substitution.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: repo-wide test runner; e2e plugin + scaffold verification fixes"
```

---

### Task 8: Codex tree

**Files:**
- Create: `codex/install.sh`, `codex/AGENTS.global.md`, `codex/AGENTS.template.md`, `codex/config.suggested.toml`, `codex/protocols/{plan.md,review.md,commit.md,pr.md,worktree.md}`, `tests/test-codex-install.sh`

**Interfaces:**
- Consumes: `docs/philosophy.md` (AGENTS.global.md restates it), `scaffold/CLAUDE.template.md` (AGENTS.template.md mirrors it).
- Produces: `install.sh [codex-home]` (default `~/.codex`); protocols land in `<codex-home>/prompts/<name>.md` (and additionally `<codex-home>/skills/harness-<name>/SKILL.md` if the docs check confirms skills support).

- [ ] **Step 1: Verify current Codex formats against live docs**

WebFetch the official Codex docs (start at `https://developers.openai.com/codex` and the `openai/codex` GitHub README). Confirm: (a) custom prompts at `~/.codex/prompts/*.md` and their frontmatter, (b) whether Agent Skills (`SKILL.md`) are supported and at what path — the machine's `~/.codex/skills/` dir suggests yes at v0.98, (c) current `config.toml` keys for approval policy and sandbox. Record the three answers as a comment block at the top of `codex/install.sh`. If prompts are NOT `~/.codex/prompts/*.md`, adapt the install destination accordingly and note it in `docs/porting.md`.

- [ ] **Step 2: Write `codex/AGENTS.global.md`** — global guidance, installed as `<codex-home>/AGENTS.md`:

```markdown
# Global working agreement

## Discipline (the harness, single-context form)
- Read the code first. Every load-bearing claim carries file:line and a
  verbatim quote you re-checked with a command this session.
- Non-trivial work: run the /plan protocol before editing. Bug reports and
  questions get findings, not unrequested fixes.
- Before any commit: run the /commit protocol (type check hard-blocks;
  review criticals block).
- Type-check, never build, during development (`npx tsc --noEmit` or the
  project AGENTS.md equivalent). Don't trust a test suite the project
  hasn't declared trustworthy.
- Self-review in a second pass: re-read your diff as if someone else wrote
  it, hunting the claim you didn't verify. You have no fresh-context
  verifier here - be your own harshest one.

## Communication
- Plainspoken; lead with the outcome; no flattery.
- Report failures verbatim; never claim verified when you haven't run it.
```

- [ ] **Step 3: Write `codex/AGENTS.template.md`** — mirror of `scaffold/CLAUDE.template.md` with: same STOP gate and YES/NO lists verbatim; routing table replaced by an **Architect Council** list (the same 10 generic domains as lenses, no Task tool); same FILL sections (Overview, Components, Git Structure, Worktree Setup, Development Rules); "How:" line → `Run the /plan protocol - it walks the council for the domains the task touches.`

- [ ] **Step 4: Write the five protocols** (each is a complete prompt file; frontmatter per Step 1's confirmed format, body as follows)

`codex/protocols/plan.md`:
```markdown
Plan before implementing. Input: $ARGUMENTS (a task description; ask for
requirements if empty).

1. GATE. If the task is trivial (typo, docs-only, comment, config value),
   say so and skip to implementation. Otherwise you MUST complete this
   protocol before any edit.
2. READ. Locate every file the task plausibly touches. Quote the load-
   bearing lines (file:line). No claims from memory.
3. COUNCIL. From the project AGENTS.md architect council, pick every domain
   the task touches (default: General). For each, in order, write a short
   consultation AS that architect: risks, files to touch, the approach it
   would insist on. Domains disagree? Resolve explicitly, in writing.
4. PLAN. Phased implementation plan; each phase = one commit with a stated
   boundary, its files, and its verification command.
5. CONFIRM. Present the plan and stop. Implement only after approval.
```

`codex/protocols/review.md`:
```markdown
Three-pass review of the current diff (or $ARGUMENTS as a base ref).
Diff via: git diff <base>...HEAD (fall back to git diff HEAD).

Pass 1 - CORRECTNESS: for each changed hunk, state what could make it
wrong (inputs, state, ordering, error paths). Every finding needs an
anchor: file:line + the quoted code + the concrete failure scenario.
Pass 2 - ADVERSARIAL: re-read your Pass 1 findings as a skeptic who has
not seen your reasoning. Re-check each anchor with a command (sed -n /
grep -F). Drop any finding you cannot re-establish. Default to DROP.
Pass 3 - SWEEP: type check each changed component; scan for silent
failures (empty catch, swallowed promise, default-on-error); check the
diff against the project AGENTS.md rules.

Report: confirmed findings ranked by severity, each with anchor and
scenario; then what you checked and found clean. Pre-existing issues
outside the diff: separate section, clearly labeled.
```

`codex/protocols/commit.md`:
```markdown
Quality-gated commit. Never commit on a protected branch (see project
AGENTS.md; branch first if needed).

1. git status + git diff - review what is actually staged/unstaged; stage
   deliberately (no git add -A without reading the list).
2. TYPE CHECK (hard block): run each changed component's declared type
   check. Failures stop this protocol - fix first.
3. LINT (if declared): run it; fix or justify.
4. SELF-REVIEW: run the /review protocol on the staged diff. Critical
   findings block; fix and restart from step 2.
5. COMMIT: concise subject line stating the change, body only when the
   why isn't obvious. Push only to the current feature branch.
```

`codex/protocols/pr.md`:
```markdown
Create a PR for the current branch. Base branch: $ARGUMENTS if given, else
the project AGENTS.md "Integration branch", else the remote HEAD branch
(git remote show origin). Never target a production branch when an
integration branch is declared.

1. git log <base>..HEAD - read every commit; the PR describes the branch,
   not the last commit.
2. Title: concise summary of the whole change.
3. Body: Summary (what and why) / Changes (grouped by area) / Testing (what
   was run, verbatim results) / Notes (migrations, flags, follow-ups).
4. gh pr create --base <base> - then report the URL.
```

`codex/protocols/worktree.md`:
```markdown
Create a real git worktree for parallel work. Input: $ARGUMENTS = <name>
[base-branch].

1. Convention: <repo-parent>/<repo>-worktrees/<name>, branched off the
   project AGENTS.md integration branch unless a base is given.
2. git worktree add <path> -b <name> <base> - never a tool's built-in
   isolation feature; only git worktree.
3. Copy the env files the project AGENTS.md "Worktree Setup" table lists
   (they are untracked and will not follow the checkout). None declared:
   copy nothing and say so.
4. Install deps per the table, else by lockfile (pnpm-lock.yaml -> pnpm
   install, yarn.lock -> yarn, else npm install).
5. Cleanup later is git worktree remove - never rm -rf (stale registry).
```

- [ ] **Step 5: Write `codex/config.suggested.toml`** — NOT auto-applied (the installer prints it; Codex config is too personal to merge blindly):

```toml
# Suggested ~/.codex/config.toml additions for the harness workflow.
# Review and paste what you want - codex/install.sh does not touch config.toml.
# (Verify keys against Step 1's docs check before publishing.)

# Ask before escalating; sandboxed writes inside the workspace.
approval_policy = "on-request"
sandbox_mode = "workspace-write"

# Per-project trust is set the first time you run codex in a repo.
```

- [ ] **Step 6: Write the failing test `tests/test-codex-install.sh`**

```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
SB=$(mktemp -d); trap 'rm -rf "$SB"' EXIT
fail=0; chk() { if eval "$2"; then echo "  ok  $1"; else echo "  FAIL $1"; fail=1; fi; }

./codex/install.sh "$SB/codex" > "$SB/install.log" 2>&1
chk "prompts installed"        'test -f "$SB/codex/prompts/plan.md" && test -f "$SB/codex/prompts/worktree.md"'
chk "AGENTS.md installed"      'test -s "$SB/codex/AGENTS.md" && grep -q "Read the code first" "$SB/codex/AGENTS.md"'
chk "config not touched"       '! test -f "$SB/codex/config.toml"'

printf 'my own agents file\n' > "$SB/codex/AGENTS.md"
./codex/install.sh "$SB/codex" > "$SB/install2.log" 2>&1
chk "existing AGENTS.md kept"  'grep -q "my own agents file" "$SB/codex/AGENTS.md" && grep -qi "kept" "$SB/install2.log"'
exit $fail
```

Run: `bash tests/test-codex-install.sh` — Expected: FAIL (install.sh missing).

- [ ] **Step 7: Write `codex/install.sh`**

```bash
#!/bin/bash
# Install the harness Codex port into a Codex home (default ~/.codex).
# Docs check (Task 8 Step 1 findings): <record (a) prompts path, (b) skills
# support yes/no + path, (c) config keys verified, with date>
# Usage: install.sh [codex-home]
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-$HOME/.codex}"
mkdir -p "$TARGET/prompts"
for p in "$REPO"/codex/protocols/*.md; do
  cp "$p" "$TARGET/prompts/$(basename "$p")"
done
echo "protocols installed: $(ls "$REPO"/codex/protocols/*.md | wc -l | tr -d ' ') prompts"
# If Step 1 confirmed skills support, ALSO install as skills:
#   mkdir -p "$TARGET/skills/harness-<name>" and copy each protocol as SKILL.md
# with the frontmatter the docs prescribe. Remove this comment either way.
if [ -s "$TARGET/AGENTS.md" ] && ! grep -q "Read the code first" "$TARGET/AGENTS.md"; then
  echo "existing AGENTS.md kept - merge $REPO/codex/AGENTS.global.md by hand"
else
  cp "$REPO/codex/AGENTS.global.md" "$TARGET/AGENTS.md"
  echo "AGENTS.md installed"
fi
echo ""
echo "config.toml is never modified - review codex/config.suggested.toml and paste what you want"
```
Adapt the skills-support block per Step 1's findings before finishing this step.

- [ ] **Step 8: Run tests and commit**

Run: `bash -n codex/install.sh && bash tests/test-codex-install.sh && bash tests/run-all.sh`
Expected: all green.

```bash
git add -A && git commit -m "feat: codex reduced port - protocols, AGENTS templates, installer"
```

---

### Task 9: Publish to GitHub

**Files:** none new (repo state as of Task 8).

- [ ] **Step 1: Preflight**

Run: `cd /Users/JuansMacbook/Workspace/agent-harness && git status --porcelain && bash tests/run-all.sh`
Expected: clean tree, ALL GREEN.
Run: `gh auth status`
Expected: logged in as `juaninamilliom`.

- [ ] **Step 2: Reconcile with the existing remote and push**

The repo already exists at https://github.com/juaninamilliom/agent-harness.git with one stub commit on `main` (observed head `ae3259b`). The user provided this URL as the destination.

```bash
git remote add origin https://github.com/juaninamilliom/agent-harness.git
git fetch origin
git log --stat origin/main   # inspect the remote history
```
If the remote history is only init stubs (README/LICENSE/.gitignore, no substantive content): merge it beneath our history, keeping our content wherever both sides define a file, then push:
```bash
git merge --allow-unrelated-histories -X ours origin/main -m "Merge remote init stub"
git push -u origin main
```
If the remote holds ANY substantive content (real files beyond init stubs): STOP and ask the user how to reconcile — do not force-push and do not discard remote content.

- [ ] **Step 3: Verify**

Run: `gh repo view juaninamilliom/agent-harness --json name,visibility,defaultBranchRef && git ls-remote origin main | head -1`
Expected: name `agent-harness`, default branch main, remote head equals local `git rev-parse main`. Report the visibility as found (the user created the repo; visibility is theirs — do not change it).

- [ ] **Step 4: Install the harness on this machine for real**

```bash
./global/install.sh          # real ~/.claude: merge settings, link hooks, register marketplace
./global/install.sh --prune  # second pass removes the two stray duplicate agents
./global/doctor.sh           # expect: healthy
./codex/install.sh           # real ~/.codex: protocols + AGENTS.md (config.toml untouched)
```
Expected: doctor exits 0. Report to the user: what was merged into `~/.claude/settings.json` (backup path included), which hooks are now symlinks, that the harness plugin is installed user-wide, and that `~/.codex` gained the five protocols (plus the AGENTS.md outcome — installed, or kept-existing with a manual-merge note).

---

## Self-Review Notes

- Spec coverage: engine plugin → Tasks 1–4; scaffold → Task 6; global layer → Task 5; add-on contract → Task 6 Step 6; Codex → Task 8; publish + real install → Task 9; e2e test drive → Task 7; "beep untouched" → Global Constraints.
- Type consistency spot-checks: plugin name `harness` / marketplace `agent-harness` / enabledPlugins key `harness@agent-harness` used identically in Tasks 1, 5, 6, 7; `args.harnessRoot` contract identical in Tasks 2 and 4; `risk-patterns.txt` format identical in Tasks 4 and 6; smoke tests at `tests/*.smoke.mjs` in Tasks 4 and 7.
