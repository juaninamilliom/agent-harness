# Graph State — Design

**Date:** 2026-09-02
**Status:** Approved — the spine of the graph-engineering program; everything else hangs off it. The three open questions were answered by the owner on 2026-09-02 (see "Decisions" at the end).

## Purpose

Today every harness graph returns a payload into the session chat, a human reads
it, and the next step starts from the chat. The planner → worker → validator →
repair chain crosses through the one thread that graph engineering exists to
avoid. This document defines **one typed state object** that crosses between
graphs as data (`args.state` in, returned state out), is persisted by the skill,
and is the only thing a node is handed — a *projection* of it, never the whole,
never the transcript.

Three properties it must have, from the framing we adopted:

1. **It is the ground truth, not a log.** It holds the current verified state of
   the effort — verified facts, validated decisions, a contract everyone names
   against, phases and their artifacts, validation verdicts, repair outcomes.
2. **Ids are the vocabulary.** Every cross-reference is an id (`F3`, `D2`, `E4`,
   `P1`). v2 failed because independent agents "named the same artifact
   differently"; the contract section is what they name against now, and
   referential integrity is checked **in code** at every fan-in before any agent
   validator runs.
3. **Three outcomes everywhere.** Every verdict is `pass` / `fail` /
   `unverified`. `unverified` is never promoted to either — a rate limit is not a
   refutation (F11, the three-outcome rule).

## The state

Written as a typed listing. The canonical JSON Schema lives at
`plugins/harness/schemas/graph-state.schema.json` (Task: create it from this
listing). Workflow scripts cannot import, so each script embeds the slices it
enforces at its own `agent()` boundaries; a test asserts each embedded slice
matches the canonical file.

```
GraphState
├ version: 1
├ run
│   id: string                          // the Workflow run id of the graph that last wrote
│   graph: 'plan-graph' | 'execute-graph'
│   mode: 'existing' | 'greenfield'     // chosen by the router: is there code to read?
│   workingDir: string                  // absolute repo root
│   harnessRoot: string                 // plugin root
│   integrationBranch: string
│   partial: boolean                    // any node missing, any verdict unverified
│   errors: string[]                    // named, never silent
│   counts: { [name]: integer }         // reconciliation: briefs, findingsRaw -> findings -> verified -> confirmed/refuted/unverified/pastCap, phases, edges, agentCalls
│
├ brief
│   requirements: string
│   criteria: string[]                  // acceptance criteria, one per entry — validators cite them by index
│   constraints: string[]               // stack, non-goals, hard rules from CLAUDE.md
│
├ lead                                  // existing mode only
│   summary: string
│   notPartitioned: string[]
│   overlaps: [{ a: B#, b: B#, files[] }]   // brief pairs whose filesHint share ground — the partition failed there
├ briefs: Brief[]                       // existing mode only — { id B#, title, objective, lens, boundaries, filesHint[], agentType,
│                                       //   coverage: string | null }  null = the investigator returned nothing (missing ≠ empty)
│
├ facts: Finding[]                      // existing mode: investigated and verified
│   { id: F#, claim, file, line, quote, kind, importance, confidence, why?,
│     agreedBy: B#[], outOfScope: boolean,
│     status: 'confirmed' | 'refuted' | 'unverified' | 'past-cap', evidence?, correction? }
│
├ decisions: Decision[]                 // greenfield mode: design decisions the brief forces
│   { id: D#, domain: 'data' | 'api' | 'ui' | 'auth' | 'test' | 'infra' | 'other',
│     question: string, options: [{ name, tradeoffs }], recommendation: string, why: string,
│     dependsOn: D#[], cites: number[]  /* brief.criteria indexes */,
│     status: 'proposed' | 'validated' | 'conflict' | 'human',
│     conflict?: string                 /* set by the consistency validator; cleared by repair */ }
│
├ contract                              // the shared naming ground — what v2 lacked. An OPEN MAP of named slices;
│                                       // v1 ships these four, sized for web applications (the tool's premise).
│   api: Endpoint[]    { id: E#, method, path, auth: 'none' | 'session', request: string, response: string, errors: string[], reads: T#[], writes: T#[], phase?: P# }
│   data: Table[]      { id: T#, name, columns: [{ name, type, nullable, ref?: T# }], indexes: string[], phase?: P# }
│   ui: Route[]        { id: R#, path, purpose, components: string[], reads: E#[], writes: E#[], phase?: P# }
│   types: Shared[]    { id: Y#, name, shape: string, usedBy: (E# | R#)[] }
│   [slice: string]: { id, ... }[]      // future: a project may declare its own (infra, mobile, cli). The integrity
│                                       // check needs only `id` and id-typed refs, so it works on any slice unchanged.
│
├ plan: string                          // the synthesizer's markdown; cites ids throughout
├ phases: Phase[]
│   { id: P#, title, commit, files: string[], dependsOn: P#[], owner, moneyScope?: boolean,
│     refs: (F# | D# | E# | T# | R# | Y#)[], notes? }
├ edges: [{ from: P#, to: P#, reason: 'declared' | 'shared-file', files?: string[] }]
├ layers: P#[][]
├ sharedFileEdgesAdded, unbackedEdges, danglingDeps      // the post-pass, unchanged
├ risks: [{ risk, likelihood?, impact?, mitigation, refs: (F# | D#)[] }]
├ gaps: string[]                        // facts the synthesizer needed and did not get
├ humanDecisions: [{ question, recommendation, why?, answer?: string }]   // today's `decisions` — renamed; a human answers before code
├ outOfScope: string[]                  // what the synthesizer deliberately left out
│
├ artifacts: { [P#]: Artifact }         // execute-graph. The graph NEVER merges — `pr-open` is terminal.
│   { status: 'pending' | 'blocked' | 'in-progress' | 'implemented' | 'validated' | 'pr-open' | 'failed' | 'escalated',
│     base: string                       /* 'dev' for an independent phase; the parent phase's branch for a stacked one */,
│     worktree?: string, branch?: string, commit?: string, filesWritten: string[], attempts: number,
│     pr?: { number: number, url: string, base: string },
│     blockedOn?: P#[]                   /* deps in two different stacks: wait for their PRs to merge, then base on dev */ }
├ validations: Validation[]             // append-only
│   { id: V#, phase: P#, node: 'build' | 'review' | 'simplify' | 'simulate', attempt: number,
│     verdict: 'pass' | 'fail' | 'unverified',
│     findings: [{ id, file?, line?, severity, claim, fix?, refuted: boolean, evidence }],
│     evidence: string                   /* the command run and what it printed */ }
└ repairs: Repair[]                     // append-only
    { id: X#, phase: P#, validation: V#, attempt: number, changed: string[],
      verdict: 'fixed' | 'unfixed' | 'escalated', evidence: string }
```

## Who reads what, who writes what

| Node | Receives (projection) | Writes |
|---|---|---|
| **Router** (code) | `brief`, `run.workingDir` — and a shell probe: is there source under the components CLAUDE.md declares? | `run.mode` |
| **Lead** (existing mode) | `brief` | `lead`, `briefs` |
| **Investigators / refuters** | one brief / one finding | `facts[]` (status per finding) |
| **Domain specialists** (greenfield) | `brief`, the current `contract`, the `decisions` in their domain's `dependsOn` closure | their `decisions[]`, their `contract` slice |
| **Integrity check** (code) | `decisions`, `contract`, `phases` | `run.errors[]` for dangling ids; blocks the fan-in until clean or escalated |
| **Consistency validator** (fresh agent) | `contract` + `brief.criteria` only | `decisions[].status = conflict` + `conflict` text, or `validated` |
| **Synthesizer** | `brief`, `facts` or `decisions` + `contract`, `gaps` so far | `plan`, `phases`, `risks`, `gaps`, `humanDecisions` |
| **Post-pass** (code) | `phases` | `edges`, `layers`, `sharedFileEdgesAdded`, `unbackedEdges`, `danglingDeps` |
| **Implementer** (one per phase) | its `phase`, the `contract` items its `refs` name, the `facts`/`decisions` its `refs` name, `brief.constraints` | `artifacts[P#]` |
| **Validation nodes** | the phase's diff + the `contract` items it should satisfy; `simulate` also gets `brief.criteria` and the CLAUDE.md components table | `validations[]` |
| **Fix node** (fresh) | its phase, the failing `validation`'s confirmed findings, the `contract` items named — **never the implementer's transcript** | `repairs[]`, `artifacts[P#].attempts` |
| **PR node** (code + `gh`) | the phase's branch, its `base`, its `commit` message, the `validations` that passed | `artifacts[P#].pr`, `status = pr-open` |
| **Human** (the operator) | `humanDecisions[]` via the skill's `AskUserQuestion`; the open PRs | `humanDecisions[].answer`; merges — the only writer of merges |

A node never receives the whole state. A node never receives another node's
transcript. That is F1 generalized.

## Transitions and edges

- **Fixed:** router → lead/specialists → integrity → validator → synthesizer → post-pass. Execute: layer *n* implementers → barrier → validation chain → PR node → layer *n+1*.
- **PR stacking — the graph never merges.** Every phase ends at `pr-open`; the operator reviews and merges. The stack topology *is* the plan's edges: a phase with no `dependsOn` branches off `dev` and gets an independent PR; a phase that depends on another branches off **that phase's branch** and its PR uses that branch as base — a stacked PR, so the cascading case (API → UI) reads as a chain of PRs each showing only its own diff. Stacks are chains: a phase whose dependencies sit in two different stacks cannot base on both, so it is marked `blocked` with `blockedOn` and waits until those PRs merge, then bases on `dev`. Reported, never guessed. This makes the fake-edge post-pass load-bearing twice: an unbacked edge would force an unnecessary stack.
- **Conditional:** `run.mode` picks investigation vs decision partition. `validations[].verdict` picks merge vs repair vs escalate. Early exits (no briefs, no findings, no decisions) end the run `partial` with a named `error`.
- **Cyclic — bounded, on confirmed failure only:**
  - Planning: a `decision` marked `conflict` goes back to its domain specialist **once** with the conflict text; still conflicting → `status: human`, into `humanDecisions`.
  - Execution: a `fail` verdict with ≥1 confirmed finding spawns a **fresh** fix node; `maxRepairs` (default 2) per phase; then `artifacts[P#].status = escalated` and the run stops at that layer, `partial`.
  - Never on `unverified`. An infra failure re-runs via the Workflow tool's resume, not via a repair edge.

## Persistence

Scripts cannot touch the filesystem. The **skill** that invoked the graph writes
the returned state to `<workingDir>/.claude/graph-state/<run.id>.json` and passes
it as `args.state` to the next graph. The Workflow tool's own resume cache
covers re-running a dead layer inside one graph; the state file covers crossing
between graphs and surviving a session. `.claude/graph-state/` is gitignored by
the scaffold.

## Doctrine, reconciled

| Rule | Status under this design |
|---|---|
| F1 worker ≠ verifier context | Generalized: every node gets a projection, never a transcript; the fix node is fresh. |
| F2 the suite is never an anchor | Unchanged for refuters. The `simulate` node runs a component's suite only where CLAUDE.md's Components table says **Trustworthy suite? yes**; otherwise boot + endpoints + browser only. |
| F7 default DROP | Unchanged; validators' findings carry `refuted` from a refuter pass before any repair is spawned. |
| F9 verbatim quote is the anchor | Unchanged in existing mode. Greenfield mode's anchor is `brief.criteria` by index + the `contract` ids — a decision that cites no criterion and no contract item is dropped in code. |
| F10 an edge must name its artifact | Unchanged; `unbackedEdges` still reported, never deleted. |
| F11 silence ≠ agreement; three outcomes | Unchanged and now structural: `unverified` is a first-class verdict in `validations`, never promoted. |
| "No automatic retries" (docs/plan-graph.md) | Narrowed to what it meant: no retry on silence or infra. Bounded repair on confirmed findings is a conditional edge on verified state. |
| Worktrees | Implementers create real worktrees by the harness convention (`<repo-parent>/<repo-dir>-worktrees/<P#>`), never the tool's `isolation` flag. |
| `/harness:pr` never targets `main`; humans merge | Preserved and extended: the execute-graph opens PRs (independent or stacked) and **never merges**. The operator is the only writer of merges. |

## What this unlocks, in order

1. **plan-graph today** emits ~40% of this (`facts`, `phases`, `edges`, `layers`, the post-pass fields). First change: it emits a `GraphState` and the skill persists it. No behavior change.
2. **plan-graph greenfield mode**: the router, domain specialists writing `decisions` + `contract`, the integrity check, the consistency validator, the one repair edge, the same synthesizer and post-pass.
3. **execute-graph**: consumes `layers` and `edges`; implementers, barrier, validation chain, bounded repair, then one PR per phase — independent off `dev`, or stacked on the parent phase's branch. Never merges.
4. **The `simulate` node**: boot the dev command from the components table, hit every `E#` the phase owns, snapshot every `R#` it owns, run the suite where trusted.

## Decisions (answered by the owner, 2026-09-02)

- **Contract granularity.** v1 ships `api` / `data` / `ui` / `types` — the tool's premise is web applications (frontend, backend API, data, UI). `contract` is an open map so the granularity can grow as real projects show what they need; nobody knows the right slices for other domains until they are used. **README follow-up, when the contract ships in code:** a line saying that projects outside the web-app premise (infra, mobile, CLI) may need to declare their own contract slices.
- **`humanDecisions` are answered by the human in the loop** — whoever runs the harness. The skill asks via `AskUserQuestion` and writes the answer into the state so the execute-graph reads it from state, never from the chat.
- **Nothing is merged by the graph.** Every phase ends in PR state, never merge state. Independent phases get independent PRs off `dev`; cascading phases (API → UI) get **stacked PRs**, each based on the branch of the phase it depends on. The operator merges. See "PR stacking" under Transitions.
