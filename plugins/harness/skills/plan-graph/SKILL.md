---
description: Graph plan. A strong lead partitions the codebase questions into 2-5 briefs; cheap read-only investigators return findings anchored on verbatim quotes; code dedupes, ranks and caps; one fresh refuter per finding checks the quote with the shell; one strong agent designs the plan; code checks its phases for fake edges. For work whose facts span several subsystems. /harness:plan is the control.
allowed-tools: Workflow, Read, Grep, Glob, Bash(git:*), AskUserQuestion, TaskCreate, TaskList, TaskUpdate
argument-hint: [description]
---

# Plan Graph

`/harness:plan` is the control: specialists in prose, synthesized by `harness:code-architect`. This is the
experiment, rebuilt on what the evidence says a graph is for.

**Graph the investigation. Design once.** A graph buys breadth on decomposable work and
loses on sequential work (Kim et al. 2025: +80% on decomposable analysis, −40 to −70% on
sequential planning, negative on SWE-bench for every multi-agent variant). Planning is
both: the *investigation* — what is true about this codebase — is decomposable and is
where `/harness:plan`'s specialists earned their keep; the *design* is sequential and belongs in
one context. So the graph gathers and verifies facts in parallel, and one strong agent
designs from them. Version 2 fanned out designers and lost twice.

It is a separate command on purpose. Nothing here changes `/harness:plan` or any architect file.
Run the same task through both and compare.

Full reference (pipeline, args, failure semantics, resume):
https://github.com/juaninamilliom/agent-harness/blob/main/docs/plan-graph.md

## Input

$ARGUMENTS - a description of what to implement

---

## Step 1: Gather requirements

Same as `/harness:plan`:

- **If $ARGUMENTS is provided:** use it as the requirements; ask for acceptance
  criteria if none.
- **If $ARGUMENTS is NOT provided:** ask for the description and acceptance criteria
  via `AskUserQuestion`.

Write the requirements as the brief the **lead** will read: the current state with
`file:line` where you know it, the goal, the acceptance criteria. A stale premise is
survivable — investigators find the truth and the synthesizer corrects the briefing —
but do not invent facts to fill gaps; the lead reads the code before it partitions.

## Step 2: Is this a graph at all?

There is no domain table. Ask one question: **are the facts a right plan needs spread
across two or more subsystems that one reader would not hold at once?** Entry path and
fill pipeline and copy-trading and the test harness — yes. One file cluster, one
service, one bug — no: `/harness:plan`, or just read the code.

Do not run the workflow for a one-cluster task. The lead refuses with fewer than two
briefs anyway, and a two-brief run still costs a lead, two investigators, up to 25
refuters and a synthesizer.

## Step 3: Run the graph

By `scriptPath`, never by name (the name registry is built at session start):

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/plan-graph.js",
  args: {
    requirements: "<the requirements, verbatim>",
    criteria: "<acceptance criteria, or empty>",
    workingDir: "/abs/path/to/the/repo-root",   // the root that contains the components being planned
    harnessRoot: "${CLAUDE_PLUGIN_ROOT}",       // the workflow gives refuters the check-quote script path from it
    maxBriefs: 5,                       // 2-6; the lead may write fewer
    maxVerify: 25                       // findings verified, ranked by importance
  }
})
```

Optional: `investigatorModel` / `verifierModel` (default `sonnet`), `leadAgentType` /
`synthAgentType` (default `harness:code-architect`), `votesPerFinding` / `refutesToKill` (default
1/1 — one anchored refuter; a vote of identical models is consensus, not evidence),
`investigatorAgentTypes` (the read-only architects a brief may name; the workflow rejects
anything else).

What the script does, so you can read its logs:

1. **Lead** — one strong agent reads the code and writes 2–5 briefs: one question each,
   a lens, boundaries, disjoint file hints. Code validates them and warns when two briefs
   share ground.
2. **Investigate** — one read-only investigator per brief, on Sonnet, in parallel. Up to
   15 findings each, every one a claim with a **verbatim quote at file:line**, plus what
   it found outside its brief and what it could not establish.
3. **Reduce** (code) — dedupe by file:line + claim similarity (agreement merges into
   `agreedBy`), rank by importance / kind / agreement, cap at `maxVerify`. Out-of-scope
   findings are kept.
4. **Verify** — one fresh `harness:claim-refuter` per ranked finding: is the quote there
   (`check-quote.sh`), does the claim follow, is it current. Three outcomes: confirmed /
   refuted (with the correction) / unverified (the refuter failed — never counted as
   refuted).
5. **Synthesize** — one strong agent designs the plan from the verified facts, cites
   `[Fn]`, escalates decisions, names `gaps` rather than guessing, and returns phases
   with files and `dependsOn`. Code then adds a shared-file edge between phases that
   write one file with no edge, reports declared edges with no shared file as fake-edge
   candidates, and computes layers.

## Step 4: Present

In this order:

1. **If `partial` is true, say so first** and name why: the lead returned nothing; an
   investigator returned nothing (its brief is missing from the fact base — the log
   names it); a refuter failed (`unverified`); the synthesizer returned nothing. Never
   present a partial plan as complete.
2. **Corrections to the briefing** — the plan's opening section. Where verified findings
   contradicted the requirements, that is the first thing the user needs.
3. **`plan`** — verbatim.
4. **`decisions`** — product and money-scope questions a human must answer before code,
   with the synthesizer's recommendation.
5. **Refuted findings, with corrections** — what the investigators got wrong and what
   the code actually says. This is the verify layer's receipt; if it is empty every run,
   say so, because that means either the investigators are accurate or the refuters are
   not refuting.
6. **Unverified** — past the cap, or the refuter failed. Kept in the plan, not vouched
   for.
7. **`gaps`** — facts the synthesizer needed and did not get. Each is a candidate brief
   for a second run, or a question for the user.
8. **Phases** — `layers`, `sharedFileEdgesAdded` (two phases were ordered for a file, not
   an artifact), and **`unbackedEdges`** — declared dependencies between phases that share
   no file. Each must name the artifact it carries; if it cannot, it is a fake edge and
   the phases can run in parallel. Ask.
9. **`overlaps`** and `coverage` — where the lead's partition failed and what each
   investigator could not establish.

## Step 5: Human gate, then tasks

Wait for approval. Then offer tracked tasks exactly as `/harness:plan` Step 6 does, from
`phases`: all of Layer 0 first, `addBlockedBy` from `edges` (declared and shared-file).
Confirm each unbacked edge with the user before wiring it — re-adding a fake edge turns
the graph back into the chain it started as.

## Measuring the experiment

**The bar is `/harness:plan`.** Kim et al.'s baseline paradox: once a single agent already clears
~45% on a task, adding agents is net negative unless the architecture is right. `/harness:plan`
clears that bar on these tasks, so the graph has to win on **findings recall at lower
cost**, not on a vibe read of one plan. On the same brief, both commands, compare:

| claim | evidence |
|---|---|
| the graph finds what the specialists found | verified findings cover the control's critical findings (recall) |
| cheap investigators + a checker beat strong specialists without one | `refuted` > 0 with the investigators on Sonnet — the checker earns its keep; 0 on every run means either the investigators are accurate (trim the verify layer) or the refuters are not refuting (read their evidence) |
| the design is as good with pre-verified facts | the plan, side by side — same synthesizer, so this tests the input |
| coordination is cheaper | tokens and session context vs the control |
| the partition holds | `overlaps` = 0, `agreed` small, `gaps` short |

Run it on about ten real briefs before judging. One run is an anecdote in either direction.

## Cost

1 lead + ≤5 investigators + ≤25 refuters + 1 synthesizer ≈ 32 agents, with the
investigators and refuters on Sonnet. Expect 0.4–0.8M tokens. Run one scoped brief
first, read the refuters' evidence, then widen.

## Failure signature

Every refuter or investigator failing with `agent type 'harness:claim-refuter' not found`
(or `'harness:plan-investigator'`) — **check first whether the name is missing or
unqualified**: run `claude plugin list` and confirm the harness plugin is installed and
the agent type matches exactly (in-plugin agents dispatch as `harness:<name>`, never
bare — a plan consumer's session cannot resolve the bare form at all). Only once the name
is confirmed correct does this mean the session's agent registry predates the install:
agents added to a running session become visible on a later turn (skills hot-reload;
agents lag). Re-run with the `resumeFromRunId` from the tool result — the lead and
investigators replay from cache.
