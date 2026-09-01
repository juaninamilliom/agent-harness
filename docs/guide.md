# Field Guide

Which command, when, and what each one actually needs. If you read nothing
else, read the first two tables.

## The 30-second version

| I want to… | Use | Don't use |
|---|---|---|
| Fix a typo, a comment, a config value | Just do it, commit by hand | Any skill — the gates are ceremony at this size |
| Build a feature or fix a real bug | `/harness:plan` first, then implement | Winging it (the CLAUDE.md gate exists for a reason) |
| Plan something whose *facts* span several services | `/harness:plan-graph` | — (see the comparison below) |
| Check my diff before committing | `/harness:review` | Re-reading your own code and calling it a review |
| Review a wide or money/auth/migration-touching diff | `/harness:review --graph` | The default loop (the risk gate will tell you) |
| Commit non-trivial work | `/harness:commit` | Raw `git commit` (you skip three quality gates) |
| Commit trivial work | `git commit` by hand | `/harness:commit` (three subagent gates on a typo is waste) |
| Open a PR | `/harness:pr` | Hand-written one-line PR descriptions |
| Work on two things in parallel | `/harness:worktree` | Branch-switching in one checkout, or any tool's built-in "isolation" feature |

## What each command needs

| Command | Needs | Does NOT need |
|---|---|---|
| `/harness:plan`, `/harness:plan-graph` | Nothing beyond the plugin | A filled-in CLAUDE.md helps (domain routing) but isn't required |
| `/harness:review` (both modes) | `git`; your project's type-check command (default `npx tsc --noEmit`) | GitHub CLI |
| `/harness:commit` | `git` with a push-able remote (it ends with `git push origin HEAD`) | **GitHub CLI — not needed.** No `gh`, no GitHub account requirement |
| `/harness:pr` | **GitHub CLI**: `gh` installed and logged in (`gh auth login`), plus a GitHub remote | — |
| `/harness:worktree` | `git` | — |
| `--graph` review, full lens coverage | The `pr-review-toolkit` plugin (claude-plugins-official) for 2 of 5 lenses | Without it those two lenses skip gracefully and the result is marked partial |
| `global/install.sh` | macOS-ish environment (the hooks use AppleScript), `jq`, `python3` | Skip it entirely on Linux — the engine works without it |
| `codex/install.sh` | OpenAI Codex ≥ 0.98 | — |

One sentence to remember: **only `/harness:pr` touches the GitHub CLI.**
Everything else is plain git.

## Planning: `/harness:plan` vs `/harness:plan-graph`

**Default to `/harness:plan`.** It routes your task to the right architects
(generic ones built in, plus whatever domain architects your project's
CLAUDE.md declares), has them collaborate, and synthesizes a phased plan with
commit boundaries. This is the workhorse.

**`/harness:plan-graph` is the experiment, kept on purpose as a separate
command.** It fans out cheap read-only investigators across the codebase,
anchors every finding on a verbatim quote at file:line, adversarially
re-verifies each finding in a fresh context, and only then has one strong
agent design. Reach for it when the *investigation* is the hard part —
"what is actually true about this codebase" spans several subsystems and a
wrong assumption would sink the plan.

Full mechanics — pipeline, every knob, failure semantics, recovery — live in
the dedicated reference: [docs/plan-graph.md](plan-graph.md).

Honest guidance from measured runs: it costs roughly **2× the tokens**, and
on normal-sized tasks the plain `/harness:plan` has matched or beaten it.
Use the graph when facts span subsystems and the cost of a false assumption
is high; otherwise don't. Running both on the same task and comparing is a
legitimate move — that's why they're separate commands.

**Neither, for trivial work.** The CLAUDE.md gate's own list applies:
typo/one-line fixes, docs-only changes, comments, simple config values need
no plan at all.

## Reviewing: the loop vs `--graph`

**Default: `/harness:review`.** Three passes of `harness:pr-review` with
fixes between passes — pass N reviews what pass N−1 changed. Cheap, fast,
right for most diffs.

**`/harness:review --graph`** runs parallel review lenses with a mechanical
reduce and skeptic verification. It costs **roughly an order of magnitude
more** than the loop. Use it for wide or cross-surface diffs, and treat it
as mandatory when the risk gate says so — it path-matches wallets, funding,
migrations, and auth surfaces, plus whatever your project adds via
`.claude/risk-patterns.txt`. The gate is advisory by design; run
`${plugin}/scripts/graph/risk-gate.sh <component-dir>` if you want its
opinion explicitly.

**One-line fixes:** a single `harness:pr-review`, no loop. The skill says
this itself.

## Committing: `/harness:commit` vs doing it yourself

What `/harness:commit` buys you, per cycle (max 3 cycles):

1. **Type check** via `harness:build-validator` — a **hard block**, never
   overridable, and it type-checks without building (dev servers stay alive).
2. **Simplification pass** via `harness:code-simplifier` — advisory; you can
   decline its suggestions.
3. **Code review** via `harness:pr-review` — findings are independently
   re-verified before they reach you; **critical findings block**, warnings
   are overridable.

Then a structured commit message and `git push origin HEAD`.

**Use it** for anything you'd want a second pair of eyes on: features, bug
fixes, refactors, anything touching logic. **Skip it** for the same list the
architect gate exempts: docs, comments, config values, single-line mechanical
fixes — hand-commit those. If you hand-commit real work, you're choosing to
skip the gates; do it knowingly, not habitually.

It never invents a ticket reference: ticket linking is deliberately absent
from the engine (it returns as an add-on — see `addons/README.md`).

## PRs

`/harness:pr [base-branch]` reads **every commit on the branch** (not just
the last one) and writes a real description: summary, grouped changes,
testing evidence, notes. Base branch resolution: your argument → the
CLAUDE.md `Integration branch:` declaration → the repo's default branch.
Prerequisite reminder: this is the one command that needs `gh` authenticated.

## Worktrees

`/harness:worktree <name> [base]` creates a **real git worktree** at
`<repo-parent>/<repo>-worktrees/<name>`, copies the env files your CLAUDE.md
"Worktree Setup" table declares (untracked files don't follow a checkout),
and installs deps by lockfile. Clean up with `/harness:worktree-remove` —
never `rm -rf`, which leaves a stale registry entry. Never use an agent
tool's built-in isolation feature; it collides with real worktrees.

## FAQ

**Do I need the GitHub CLI?** Only for `/harness:pr`. Everything else is
plain git.

**Does `/harness:commit` push?** Yes, to the current branch
(`git push origin HEAD`). It will not commit on a protected branch — it
tells you to branch first.

**I don't have a CLAUDE.md — do the skills work?** Yes, degraded: PR base
falls back to the repo default branch, worktrees fall back to lockfile
detection with no env-file copying, and planning uses only the generic
architects. Filling in the scaffold's CLAUDE.md is what makes the engine
smart about *your* project.

**What are "domain architects" and do I need them?** Project-owned expert
agents the plan skill routes to. You don't need any on day one — and you
don't write them by hand: Claude generates them from your context. The
prompts, mandatory sections, and quality bar — including craft architects
for stacks the harness doesn't ship (C++, Go, Python, …) — are in
[docs/building-architects.md](building-architects.md).

**Something says an agent type is unknown.** Run `claude plugin list` and
check the harness plugin is enabled; in-plugin agents are addressed as
`harness:<name>`. Project-created agents (your domain architects) are
addressed by their bare names.

**How do I update the engine?** `claude plugin marketplace update
agent-harness` — projects and machines consuming the GitHub marketplace get
the new version; nothing is ever re-copied into your project.
