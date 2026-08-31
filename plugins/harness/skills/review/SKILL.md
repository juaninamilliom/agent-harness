---
description: Code review. Default is a three-pass pr-review loop. `--graph` runs the specialized multi-lens graph for wide or high-stakes diffs.
allowed-tools: Workflow, Task, Read, Grep, Glob, Bash(git:*), Bash(npx tsc:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/graph/risk-gate.sh:*)
argument-hint: [--graph] [base-ref]
---

# Review

**Default: the loop.** `--graph`: the graph. The loop is right for most diffs. The
graph is for wide or cross-surface changes and costs roughly an order of magnitude
more.

---

## Default path: three-pass review loop

Three passes of `pr-review`, **fixing between them**. That fix is what makes this a
loop rather than three blind repeats — pass N reviews code that pass N-1 changed, so
the edge between passes carries real data.

### Pass structure

For pass 1 through 3:

1. **Dispatch one `pr-review`** with the current diff. Fresh subagent, so it has not
   seen the previous pass.
2. **Tell it what changed since the last pass** — "pass 2 of 3; pass 1 flagged X and
   Y, both now fixed; do not re-report them." This is the only context that crosses
   the edge. Never pass the previous reviewer's full reasoning.
3. **Fix the Critical findings** before the next pass. Report Warnings and
   Suggestions; do not silently act on them.
4. **Stop early if a pass returns no Critical findings.** Two clean passes in a row
   means done — burning pass 3 on a clean tree buys nothing.

**A pass that returns nothing is not a pass that returned clean.** Observed on this
skill's own first run: a reviewer signalled idle twice without delivering a report,
and only produced its findings after being asked directly for them. Those findings
included a Critical.

So:

- If a pass produces no report, **ask it directly for one** before concluding
  anything. Do not count silence as a clean pass.
- If it still produces nothing after one direct request, say so in your summary —
  "pass N did not report" — and either re-dispatch or review that pass's scope
  yourself. Never let a missing pass read as a passing pass.
- A report saying "no issues found" is only usable if it also says **what was
  checked**. Ask for that if it is missing; unspecified coverage is unspecified.

Run the type anchor once, alongside pass 1. For each changed component (a directory
with its own `tsconfig.json`), run its declared type check from the project CLAUDE.md
— default: `cd <component> && npx tsc --noEmit`.

Never run `npm run build` for this — it breaks hot reload on projects that rely on one.

### Why three and not one

Each pass sees a different tree, because you fixed things. Fixes introduce new code
that has never been reviewed. Three is the point where passes stop finding new
Criticals on a typical diff.

### Why no refuter here

Measured: on the first live graph run, nine skeptics refuted **zero** of three
findings. On that evidence the verify layer has not yet earned its cost on ordinary
work, so it stays in the graph path where the stakes carry it. Revisit if the
refutation rate on graph runs turns out to be non-trivial.

---

## `--graph`: the specialized path

### 1. Check it is worth it

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/graph/risk-gate.sh <component-dir> [base-ref]
```

Run it against the component directory you're reviewing. The plugin ships this
script alongside the agents and skills.

**Advisory, not a veto.** It only rejects diffs that cannot carry a bug — tests-only,
docs/styling-only, or one or two files under sixty added lines. Everything else
passes, and it prints context (migrations, money-or-auth paths, breadth,
ui+server-in-one-diff) to inform you rather than to decide for you.

An earlier version of this gate scored risk by keyword and rejected a 22-file UI
diff as "no markers". The graph then found three money-scope bugs in it, including a
payment action that always failed with no on-screen way to recover — because the
client-side check had diverged from the server's authoritative validation. **That risk
was structural, not lexical.** Do not reintroduce keyword scoring.

### 2. Run it — by `scriptPath`, not `name`

The `name:` registry is built at session start, so a freshly installed workflow is not
resolvable by name until restart (`Workflow({name: "review-graph"})` returns
`not found. Available: deep-research`). `scriptPath` always works.

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/review-graph.js",
  args: {
    branch: "<branch>",
    workingDir: "/abs/path/to/the/checkout",   // REQUIRED when reviewing a worktree
    changedFiles: ["path/one.ts"],             // from `git diff --name-only`; real JSON array, never a string
    harnessRoot: "${CLAUDE_PLUGIN_ROOT}",      // the workflow gives skeptics the check-quote script path from it
    maxAgents: 15
  }
})
```

**`workingDir` is not optional when the branch lives in a worktree.** Measured on
a 19-file production review: without it, one skeptic resolved paths against the main
checkout (on the integration branch), found the cited line was an eslint pragma and
the function absent repo-wide, and refuted a real critical. The majority outvoted it —
but a *lens* making the same mistake reviews the wrong tree and silently reports
nothing. Pass the absolute path.

**`changedFiles` comes from `git diff --name-only <base>...HEAD` in the component
checkout — never typed by hand.** Measured on a 19-file production review: a
hand-typed list carried 17 of the PR's 19 files, and a real finding in one of the
other two was filtered out as out-of-scope. It is now returned in `outOfScope`
instead of vanishing, but the fix for an incomplete list is the complete list.

`maxAgents` is spent as `5 lenses + (cap x 3 skeptics) + 1 synthesizer`. At 15 the cap
is 3 findings verified and the rest are returned as `unverified` — **not dropped**.
Measured cost at 15, three runs:

| Diff | Tokens | Tool calls | Time |
|---|---|---|---|
| 22-file React | 1,150,200 | 348 | 13.5 min |
| 17-file backend services | 1,236,877 | 544 | 16.1 min |
| 2-file MCP tool | 850,477 | 249 | 10.2 min |

Cost scales with breadth but has a high floor: even a **two-file** diff costs ~850k
tokens, because the five lenses each read surrounding context regardless. Budget ~1M
tokens and ~13 minutes per run.

### 3. Report

Relay `report`, then the counts, then everything in `unverified`.

**`unverified` is not a leftovers bin.** It holds two different things, and neither was
judged and dismissed:

- findings past the verify cap — real findings that only ran out of budget
- findings counted in `counts.undecided` — fewer than two skeptics came back alive, so
  the vote could not be taken

Never present either as cleared.

**`outOfScope`** holds findings in files outside `changedFiles`. They were never verified.
If one of those files *is* in the diff, your list was incomplete: rerun with the full
list or review that finding by hand. If it is not, a lens ignored its brief — say so.

**If `partial` is true, say so first.** It has two independent causes, so name which:

A third cause shows up as `the verify layer is dead` in the log with every skeptic
failing on `agent type 'finding-refuter' not found`: the session started before the
agent was installed. The registry refreshes on a later turn; re-run with the
`resumeFromRunId` from the tool result and the lenses replay from cache.

| Cause | Where | Meaning |
|---|---|---|
| a lens returned nothing | layer 1, logged as `N of M lenses returned nothing` | a whole dimension of the review is missing |
| `counts.undecided > 0` | layer 3, logged as `fewer than 2 live skeptics` | some findings were never actually judged |

Show `refutedFindings` too — each entry carries `killedBy`, the skeptics' reasons. A
lens whose findings keep getting killed needs its prompt
fixed, and a refutation rate that stays at zero means the verify layer is decorative —
but read that rate against `counts.undecided`, since dead skeptics no longer inflate it
by masquerading as refutations.

---

## Anchors

`npx tsc --noEmit`, `grep`, `git diff`.

**Not the test suite** — unless the project CLAUDE.md declares it trustworthy.
Measured on a production suite: roughly 30% flaky, lying in both directions.

## When NOT to graph

All five are from the article's §8, and they are rules, not preferences. If any applies,
`--graph` is the wrong tool and costs ~1M tokens to prove it.

- **The task is small or isolated.** Adding one function, fixing one bug. The
  coordination is pure overhead; a single agent is faster and cheaper.
- **You want to approve every step.** A graph's whole point is running wide without
  you, so a tight leash works against it. (If you need a checkpoint but not a leash,
  that is a human gate at one seam — not a reason to skip the graph.)
- **You do not yet know what you are looking for.** Exploratory work wants one agent
  you can steer, not a fleet locked into a plan.
- **The steps genuinely depend on each other.** Forcing a graph onto truly sequential
  work adds cost for zero speedup.
- **The tell is the fake-edge test.** If you cannot name two jobs with no edge between
  them, there is no graph to build. It is a loop, and a loop is fine.

Note the interaction with the mandatory tier above: a wallet/funding diff still gets
the graph, because those rules are about *shape*, and the mandate is about *stakes*.
A one-file wallet change is small — and still gets graphed, because the cost of missing
it exceeds the cost of the run.

## When neither is right

One-line fixes, typos, config values: a single `pr-review`, no loop.
