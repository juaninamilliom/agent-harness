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
