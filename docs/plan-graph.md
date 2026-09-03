# plan-graph: what it actually does

The dedicated reference for the `/harness:plan-graph` workflow
(`plugins/harness/workflows/plan-graph.js`). For *when to choose it* see the
[field guide](guide.md); this doc is *what happens when you run it*, what every
knob does, and exactly how it behaves when things fail.

## The idea in three sentences

Planning has two halves. The **investigation** — "what is true about this
codebase" — is decomposable, so the graph fans it out and adversarially
verifies every claimed fact. The **design** is sequential, so exactly one
strong agent does it, from verified facts only. (`/harness:plan` is the
control: same goal, specialists in prose, no verification layer. Anything one
reader can hold in context belongs there.)

## The pipeline

```
Lead ──► [validate] ──► Investigate (parallel) ──► [reduce] ──► Verify (parallel) ──► Synthesize ──► [post-pass]
```

**1. Lead** — one strong agent (default `harness:code-architect`) reads the
code and partitions the question into **2–5 briefs**: each with an objective,
a lens, boundaries, and file hints. What it deliberately left out goes in
`notPartitioned` — scope cuts are recorded, never silent.

**2. Validate (code, not a model)** — no briefs → the run ends immediately as
`partial` with an error. One brief → ends with "one investigator is not a
graph. Use /plan." Overlapping briefs are detected and warned (expect
duplicate findings), not blocked.

**3. Investigate (parallel)** — one cheap, read-only investigator per brief
(default `harness:plan-investigator`; a brief may request another agent type,
but only types on the read-only allowlist are honored — anything else falls
back to the default investigator). Every finding must carry an **anchor**: a
verbatim quote at file:line. Each investigator also reports what it covered,
so gaps are visible.

**4. Reduce (code)** — findings are deduplicated (agreement across
investigators is recorded, not double-counted), ranked by importance ×
confidence, and capped at `maxVerify` for the verify layer. Findings past the
cap are kept, labeled `past-cap`, and never silently dropped.

**5. Verify (parallel)** — per ranked finding, `votesPerFinding` fresh
refuters (default 1) that have **never seen the investigator's reasoning** —
only the claim, the file, the line, the quote. Each re-checks the anchor with
the shell (`check-quote.sh`, path supplied by the workflow). A finding dies at
`refutesToKill` refutations. The refuter's default verdict is **refuted**: a
claim it cannot re-establish does not survive.

**6. Synthesize** — one strong agent (default `harness:code-architect`)
designs the phased plan from confirmed findings only, declaring dependencies
between phases.

**7. Post-pass (code)** — the design gets checked mechanically: phase ids are
made positional (`P1..`, with `dependsOn` remapped through the rename — ids are
the vocabulary of the state, so code assigns them), dependency cycles flagged,
`dependsOn` entries naming nonexistent phases removed from the phase and
reported in `danglingDeps` under their original name, declared edges with no
shared file reported as **fake-edge** candidates, shared-file edges added, and
the finding counts reconciled (every finding must be exactly one of confirmed /
refuted / unverified / past-cap — a vanished finding is a warning, not an
adjustment).

**8. Return the state** — every path out of the script, including the early
exits, returns a `GraphState` (`plugins/harness/schemas/graph-state.schema.json`;
design: `docs/superpowers/specs/2026-09-02-graph-state-design.md`). The skill
persists it to `<workingDir>/.claude/graph-state/<run id>.json`; that file, not
the chat, is the handoff to the next graph.

## Greenfield mode

When there is no code to read, `mode: "greenfield"` swaps steps 1–5 for a
graph over the *decisions* the brief forces. Same thesis, same synthesizer;
what fans out is analysis of the brief, and what makes the fan-out mergeable
is a naming ground the lead lays before anyone designs.

```
Lead ──► [ids, skeleton] ──► Design (parallel, one per domain) ──► [merge + integrity] ──► Validate ──► Repair (once) ──► Validate ──► [settle] ──► Synthesize ──► [post-pass]
```

**Lead** reads the brief and writes 2–12 **decisions** (`D#`, each owned by
a domain — data / api / ui / auth / test / infra / other — citing acceptance
criteria by index, with `dependsOn`) and the **contract skeleton**: endpoints
`E#`, tables `T#`, routes `R#`, shared types `Y#` — ids and names only. The
lead mints every id.

**Design** — one specialist per activated domain, in parallel, fresh context.
It sees its decisions and the whole skeleton; it answers its decisions
(options, one recommendation, `cites`, `refs`) and elaborates **only the slice
it owns** (`data → T`, `api → E` and `Y`, `ui → R`; auth and test write
decisions only). That single-writer rule is frozen (F13): a write to another
slice is discarded and logged, and the need goes in a decision's `refs`.

**Merge + integrity (code)** — skeleton items keep their ids; new items are
renumbered and the specialist's own references follow the rename. Every
reference must resolve or it is removed from the object and reported in
`danglingRefs`. A dead specialist's decisions go to the human (F11).

**Validate** — a fresh `harness:code-architect` sees the decisions and the
contract *as data* (id, domain, question, recommendation, cites, refs — never
the options or the reasoning; F1) plus the criteria, and returns conflicts,
each naming the owner that must fix it, plus criteria nothing serves.

**Repair, bounded** — each owner gets exactly its conflicts and returns its
complete decisions and slice; the merge is the same code path; the validator
runs again. `maxRepairRounds` (default 1) rounds, then what remains is
`status: human`. Uncovered criteria are never sent for repair — they become
`gaps`, and one found in any round stays reported.

**Settle** — `validated`, or `human` (a surviving conflict, a dead specialist,
an answer that cites no criterion and refs no contract item), or `proposed` if
the validator returned nothing — silence validates nothing. Escalations land
in `humanDecisions` ahead of the synthesizer's own questions.

**Synthesize + post-pass** — as in existing mode, from the validated decisions
and the contract; phases `refs` the `D#`/`E#`/`T#`/`R#`/`Y#` they implement,
and a ref that names nothing is dropped and reported.

Cost: `1 (lead) + domains + validator calls (1 or 2) + repaired owners + 1
(synth)` — a four-domain brief with one repair round is ~10 calls.

## Running it

Invoke via `/harness:plan-graph <description>` — the skill gathers
requirements, calls the Workflow tool with `scriptPath:
${CLAUDE_PLUGIN_ROOT}/workflows/plan-graph.js`, and persists the returned
state to `<workingDir>/.claude/graph-state/<run id>.json`. Args:

| Arg | Default | Meaning |
|---|---|---|
| `requirements` | **required** | What to plan (the run throws without it) |
| `criteria` | `[]` | Acceptance criteria, one per entry (a newline-separated string is split); stored in `brief.criteria`, cited by index |
| `constraints` | `[]` | Stack, non-goals, hard rules; stored in `brief.constraints` |
| `workingDir` | `''` (warns) | Absolute repo root agents read — always pass it |
| `harnessRoot` | **required** | Plugin root; builds the `check-quote.sh` path for refuters. The run throws without it — the old `./.claude` fallback resolved to nothing on disk |
| `integrationBranch` | `''` | Recorded in `run.integrationBranch`; the execute-graph bases independent phases on it |
| `runId` | `''` | The skill sets `run.id` from the tool result when it persists; pass it only when re-emitting a state |
| `maxBriefs` | 5 (2–6) | Partition width |
| `maxVerify` | 25 (1–60) | Findings sent to the verify layer; the rest are `past-cap` |
| `votesPerFinding` | 1 (1–3) | Refuters per finding |
| `refutesToKill` | 1 (1–3, ≤ votes) | Refutations that kill a finding |
| `investigatorModel` / `verifierModel` | `sonnet` | Cheap-tier workers |
| `leadAgentType` / `synthAgentType` | `harness:code-architect` | The two strong seats |
| `investigatorAgentTypes` | built-in read-only list | Override the investigator allowlist |
| `mode` | `existing` | `existing` or `greenfield` — the skill's routing decision (the script cannot probe the filesystem) |
| `maxRepairRounds` | 1 (0–2) | Greenfield: how many times a conflict goes back to its owner before the human decides |
| `validatorAgentType` | `harness:code-architect` | Greenfield: the fresh consistency validator |
| `specialistAgentTypes` | `{data: db-, api: api-, ui: frontend-, auth: security-, test: test-, infra/other: code-architect}` | Greenfield: per-domain specialist, merged over the defaults (all `harness:`-qualified) |

**Cost model**: agent calls = `1 (lead) + briefs + verified-findings × votes +
1 (synth)` — defaults land around 10–30 calls. Rule of thumb from measured
runs: ~2× the tokens of `/harness:plan`.

## Failure semantics — deliberately NOT self-healing

The design doctrine is **fail-visible**: the run degrades honestly and tells
you, rather than repairing by pretending. Concretely:

| Failure | Behavior |
|---|---|
| Lead returns nothing / one brief | Run ends early; `run.partial: true`, the reason in `run.errors` — still a full `GraphState` |
| An investigator returns nothing | Counted as **missing, not agreeing** ("never count silence as agreement"); run continues, `run.partial`, `run.errors` names the briefs, and each dead brief has `coverage: null` |
| A refuter fails (infra) | Its finding is labeled `UNVERIFIED - refuter failed` — never promoted to confirmed, never counted as refuted; `run.errors` counts them |
| The whole verify layer dies | Warning with the exact recovery instructions (see below); confirmed = none, facts preserved |
| Synthesizer returns nothing | Verified facts still returned in the state; `plan` is empty, `run.partial: true`, `run.errors` says so |
| (greenfield) Lead returns nothing / one decision | Run ends early; `run.partial: true`, `run.errors` says why |
| (greenfield) A specialist returns nothing | Its decisions are `status: human` with `conflict: specialist returned nothing`; `run.partial`, `run.errors` names it |
| (greenfield) The validator returns nothing | Decisions stay `proposed` — never promoted by silence; no repairs run; `run.partial`, `run.errors` names it |
| (greenfield) A conflict survives the repair rounds | `status: human` with the conflict text, in `humanDecisions`; the run is **complete**, not partial — escalation is the designed terminal |
| (greenfield) A reference names nothing | Removed from the object, reported in `danglingRefs`; the run continues |
| Design has cycles / fake edges / unreconciled counts | Warned and surfaced; never auto-corrected |

The only autonomous "healing" is the investigator-allowlist fallback (an
unknown agent type → default investigator). There are **no automatic
retries** — that's a deliberate refusal: the rules a self-healing optimizer
would bend first are marker sentences in `plugins/harness/FROZEN.md`
(worker/verifier context separation, silence ≠ agreement, default-to-refuted,
infra failure ≠ verdict), enforced by `check-frozen.sh`.

## Recovery: resume, don't re-run

The Workflow tool caches completed `agent()` calls. If a layer dies (the
classic case: the verify layer's agent registry lagged right after install),
re-run with `resumeFromRunId: <run-id>` — the lead and investigators replay
**free from cache** and only the dead layer re-executes. The workflow prints
exactly this instruction when it detects that signature. Unknown-agent errors:
check `claude plugin list` first — in-plugin agents must be addressed as
`harness:<name>`.

## Reading the output — the `GraphState`

The return value is a `GraphState`, validated against
`plugins/harness/schemas/graph-state.schema.json` by the smoke test on every
path. Sections this graph writes:

- `run` — `partial` (trust gate), `errors` (every reason, named — never only in
  the log), `counts` (full reconciliation: briefs, investigatorsReturned,
  findingsRaw → findings → verified → confirmed/refuted/unverified/pastCap,
  phases, edge stats, agentCalls), `mode` (`existing` — greenfield mode comes
  next), `workingDir`, `harnessRoot`, `integrationBranch`, `id`.
- `brief` — `requirements`, `criteria[]` (cited by index), `constraints[]`.
- `lead` — `summary`, `notPartitioned`, `overlaps` (where the partition failed).
- `briefs[]` — each with `coverage` (`null` = the investigator returned nothing).
- `facts[]` — every finding with its status (confirmed / refuted / unverified /
  past-cap), its anchor (`file`, `line`, `quote`), `agreedBy`, and the
  refuter's `evidence` / `correction`.
- `plan`, `phases[]` (each with `refs` — the fact ids it rests on), `edges`,
  `layers`, `sharedFileEdgesAdded`, `unbackedEdges`, `danglingDeps`, `risks`
  (with `refs`), `gaps`, `humanDecisions` (a human answers before code; the
  skill writes `answer` back), `outOfScope`.

Greenfield mode writes `decisions[]` (each `D#` with `domain`, `question`,
`options`, `recommendation`, `why`, `cites`, `refs`, `status`, and `conflict`
when escalated), `contract` (an open map — `api`, `data`, `ui`, `types` in
v1 — every item with an id), and `danglingRefs[]`; `facts` and `briefs` are
empty. Existing mode writes `facts` and `briefs`; `decisions` and `contract`
are empty. Both write `danglingRefs` for phase and risk refs that named
nothing.

Present and empty until the execute-graph exists: `artifacts`, `validations`,
`repairs`.

Read `run.partial` first, `lead.notPartitioned` second, the refuted facts third
— what the graph killed is often as informative as what survived.
