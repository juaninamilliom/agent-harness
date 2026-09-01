---
description: Generate a project architect agent — craft (a language/framework expert, e.g. C++, Go) or domain (an expert in one subsystem of THIS codebase, built by investigating it first). Gathers context, drafts to the mandatory-sections contract, self-checks, writes the file, registers the routing row, and verifies dispatch. Use when the user wants to create, build, or generate an architect/expert agent.
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(ls:*), Write, Edit, AskUserQuestion, Task
argument-hint: [stack (e.g. c++) or domain (e.g. billing, src/protocol/)]
---

# Make Architect

Generate an architect agent for this project. Full background:
https://github.com/juaninamilliom/agent-harness/blob/main/docs/building-architects.md

$ARGUMENTS — a stack name (craft) or a domain/subsystem (domain). Ambiguous
or empty: ask.

## Step 1 — Kind and subject

Decide from $ARGUMENTS: a language/framework/platform → **craft**; a
subsystem of this codebase (a directory, a product area) → **domain**. If
unclear, ask (AskUserQuestion) with the one-line distinction: *craft = the
stack's traps, written from expertise; domain = THIS codebase's rules,
written from investigation + your war stories.*

## Step 2 — Project context (both kinds)

1. Read the project CLAUDE.md: conventions, the architect routing table,
   declared components.
2. `ls .claude/agents/` — existing architects are the Adjacencies material.
3. Read the output contract: `.claude/agents/_craft-architect.template.md`
   or `_domain-architect.template.md` (stamped by the harness scaffold). If
   absent, use the embedded contract in Step 4 — do not stop.

## Step 3a — Craft context

- Detect the stack version and toolchain from the repo (CMakeLists/
  conanfile, go.mod, pyproject/uv.lock, Cargo.toml, package.json, …).
- Ask the user for one or two REAL questions their team has actually asked
  in this stack — these become the routing `<example>` blocks and matter
  more than anything else in the frontmatter. If the user declines,
  synthesize realistic ones and say so.

## Step 3b — Domain context (investigate BEFORE writing)

1. Confirm the owning directory with the user if not obvious.
2. Map it: entry points, state machines, the types that cross its boundary.
3. `git log --oneline -- <dir>` and skim the fix/revert commits — every fix
   is a candidate invariant. Collect candidates WITH file:line evidence.
4. **Pause and ask the user for war stories** (the incident that taught a
   rule, "we always/never X because Y", postmortem bullets). This is
   mandatory: it is the only content you cannot derive, and it is what
   makes the What-you-know section true. If they have none, say the section
   will be code-derived only and thinner for it.
5. Ask which adjacent directories are explicitly NOT this domain's, and who
   owns them.

## Step 4 — Draft to the contract

Every architect file MUST contain all six; a draft missing one is not done:

1. Frontmatter `name`: `<subject>-architect`, kebab-case, bare (no
   `harness:` prefix — that is only for plugin-shipped agents).
2. Frontmatter `description`: one routing paragraph + 2–3 `<example>`
   blocks quoting requests as users actually type them. This field is the
   router.
3. Frontmatter `tools`: exactly `Read, Grep, Glob, Bash(git:*)`.
4. Ground truth / What you know — the value section.
   - Craft: a first-principles model of the stack, then trap classes as
     symptom → short known cause list → diagnostic order, plus a
     **tooling-as-anchors** bullet ("a claim about <property> carries a
     <tool> run, not confidence").
   - Domain: distilled invariants NOT derivable from reading one file, each
     as a rule, each carrying its why; plus a **dangerous-surface** line
     naming the changes it must always flag.
5. Adjacencies: the ground it does NOT own and who does — existing
   architects by name (`harness:`-qualified only for harness-shipped ones).
6. Operating principles: cite file:line (or the standard), severity triage
   (critical bug vs anti-pattern vs preference), smallest safe change, name
   the tool or test that proves it.

Quality bar — reject your own draft when: a bullet would survive replacing
the stack/domain name with any other (generic filler); a domain bullet
restates what one file read shows; a trigger example is a category
("memory questions") instead of a request ("segfault only in release after
the buffer refactor").

## Step 5 — Self-review

Check the draft against the six sections and the quality bar. Fix every
gap before writing the file.

## Step 6 — Write the file

`.claude/agents/<name>-architect.md`. If a file with that name exists, show
the user what exists and ask before touching it — never overwrite silently.

## Step 7 — Register

Add one row to the project CLAUDE.md routing table (bare name, domain
column, trigger keywords/globs). If the CLAUDE.md has no routing table,
print the row and tell the user where it belongs.

## Step 8 — Verify

Dispatch the new agent once via the Task tool with a one-line question from
its territory. If the agent type is unknown, the registry picks up new
project agents on a later turn — tell the user, and give the manual proof:
ask Claude to consult it by name, then run `/harness:plan` on a task in its
territory and confirm it appears in the consultation list.

## Report

File path written, the routing row added, the verification outcome, and —
for domain architects — which invariants came from the code vs from the
user's war stories (so the user knows what only they have vouched for).
