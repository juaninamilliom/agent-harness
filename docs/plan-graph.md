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

Present and empty until their graphs exist: `decisions`, `contract`
(greenfield mode), `artifacts`, `validations`, `repairs` (execute-graph).

Read `run.partial` first, `lead.notPartitioned` second, the refuted facts third
— what the graph killed is often as informative as what survived.
