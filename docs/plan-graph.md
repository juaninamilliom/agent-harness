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

**7. Post-pass (code)** — the design gets checked mechanically: dependency
cycles flagged, `dependsOn` entries naming nonexistent phases flagged (**fake
edges**), phase edges compared against shared files, and the finding counts
reconciled (every finding must be exactly one of confirmed / refuted /
unverified / past-cap — a vanished finding is a warning, not an adjustment).

## Running it

Invoke via `/harness:plan-graph <description>` — the skill gathers
requirements and calls the Workflow tool with `scriptPath:
${CLAUDE_PLUGIN_ROOT}/workflows/plan-graph.js`. Args:

| Arg | Default | Meaning |
|---|---|---|
| `requirements` | **required** | What to plan (the run throws without it) |
| `criteria` | `''` | Acceptance criteria, passed to lead + synthesizer |
| `workingDir` | `''` (warns) | Absolute repo root agents read — always pass it |
| `harnessRoot` | `./.claude` fallback | Plugin root; builds the `check-quote.sh` path for refuters |
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
| Lead returns nothing / one brief | Run ends early, `partial: true`, explicit error |
| An investigator returns nothing | Counted as **missing, not agreeing** ("never count silence as agreement"); run continues, output stamped `partial` and says which briefs died |
| A refuter fails (infra) | Its finding is labeled `UNVERIFIED - refuter failed` — never promoted to confirmed, never counted as refuted |
| The whole verify layer dies | Warning with the exact recovery instructions (see below); confirmed = none, findings preserved |
| Synthesizer returns nothing | Verified findings still returned in the payload; `plan` is empty, `partial: true` |
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

## Reading the output

Top-level: `partial` (trust gate — a partial plan is missing investigators,
verification, or synthesis and says which in the log), `plan` (the synthesized
design), `findings` (every finding with its status: confirmed / refuted /
unverified / past-cap), `counts` (full reconciliation: briefs,
investigatorsReturned, findingsRaw → deduped → verified → confirmed/refuted/
unverified/pastCap, phases, edge stats, agentCalls), plus `lead.summary`,
`lead.notPartitioned`, per-brief `coverage`, and `overlaps`.

Read `partial` first, `notPartitioned` second, `refuted` third — what the
graph killed is often as informative as what survived.
