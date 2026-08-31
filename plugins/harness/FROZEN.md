# Frozen Rules

Rules an optimizer would be tempted to weaken, kept off-limits precisely because they
are the ones it would bend to win.

**These are not style preferences.** Each one exists because weakening it makes some
run cheaper, faster, or tidier while quietly destroying what the run is for.

`scripts/graph/check-frozen.sh` asserts every rule below is still present where it must
be. **A failing check means one of two things:**

1. You removed a frozen rule — put it back, or
2. You reworded it — then update the `MARKER` here *deliberately*, in the same commit,
   with a note saying why.

The point is not that the words can never change. The point is that they cannot change
*by accident*, which is exactly how we lost five of them once already: the §8 skip rules
were deleted wholesale by a refactor that was only trying to make `/harness:review` tidier, and
nobody noticed until a section-by-section audit weeks later.

---

## F1 — A worker and its verifier never share a context

**MARKER:** `not seen the reasoning` — `agents/finding-refuter.md`
**MARKER:** `not seen the reasoning` — `agents/claim-refuter.md`
**MARKER:** `never sees the lens` — `workflows/review-graph.js`
**MARKER:** `never the investigator` — `workflows/plan-graph.js`

**Why frozen:** it is cheaper and simpler to hand the checker the worker's transcript,
and the output looks the same. It is not the same. A verifier that can see the argument
is agreeing with it, not checking it — a graph of agents sharing one context is a single
loop in a costume, and it fails the same way, later and pricier.

## F2 — The jest suite is never an anchor

**MARKER:** `NOT an anchor` — `agents/finding-refuter.md`
**MARKER:** `NOT an anchor` — `agents/claim-refuter.md`
**MARKER:** `NOT an anchor` — `agents/plan-investigator.md`

**Why frozen:** when a claim is behavioural and static evidence runs out, running the
tests is the obvious next move. A production suite measured at ~30% flaky lies in both
directions — it will kill true findings and confirm false ones, and the verdict will
carry the authority of "I ran it." Held 27/27 across three measured runs, including one
whose subject matter was test coverage itself.

## F3 — No keyword scoring in the risk gate

**MARKER:** `not reintroduce keyword scoring` — `skills/review/SKILL.md`

**Why frozen:** scoring changed lines for words like `state`, `role`, `amount` is the
obvious implementation and it *feels* precise. Measured: it drowned in React noise
(`useState`, `getByRole`, `isPending`) and rated a diff `markers=none` that the graph
then found three money-scope bugs in. The risk was structural; structure has no keyword.

## F4 — Never `npm run build` in a project with a hot-reloading dev server

**MARKER:** `Never run ` + `npm run build` — `agents/build-validator.md`

**Why frozen:** it is the intuitive way to check a TypeScript project compiles. It also
writes output that breaks hot reload and forces a dev server restart. This rule was
written in CLAUDE.md, named build-validator explicitly, and was still violated for
months — which is why it is here and not only there.

## F5 — A silent pass is not a clean pass

**MARKER:** `not a pass that returned clean` — `skills/review/SKILL.md`

**Why frozen:** a reviewer that returns nothing looks exactly like a reviewer that found
nothing, and the cheap reading is the happy one. Observed live: a pass signalled idle
twice without reporting; asked directly, it produced a Critical and five Warnings, every
one in code the previous pass's fixes had introduced.

## F6 — The five §8 skip rules

**MARKER:** `there is no graph to build` — `skills/review/SKILL.md`

**Why frozen:** guidance about when *not* to use a tool is the first thing trimmed when
tidying that tool's documentation. These were deleted exactly that way once.

## F7 — Default to DROP on uncertainty

**MARKER:** `Default to DROP` — `agents/finding-refuter.md`
**MARKER:** `Default to DROP` — `agents/claim-refuter.md`

**Why frozen:** a verifier that keeps what it cannot establish produces more findings,
which looks like more value. A speculative finding reaching the engineer costs trust in
every true finding after it.

## F8 — Findings are scoped to the diff

**MARKER:** `Do not report pre-existing` — `workflows/review-graph.js`

**Why frozen:** pre-existing problems in a file an agent happened to read are real
problems, and reporting them feels helpful. They bury the findings about the change
under review and make the report unusable as a merge gate.
## F9 — Every finding carries a verbatim quote, and the shell checks it

**MARKER:** `is the ANCHOR` — `workflows/plan-graph.js`
**MARKER:** `is the ANCHOR` — `agents/claim-refuter.md`

**Why frozen:** a claim with a file and a line *feels* anchored; only a verbatim quote
that `check-quote.sh` finds at that line *is*. Paraphrase is the cheap substitute and it
is how a plausible-but-wrong fact reaches the synthesizer. This is `plan-graph`'s only
anchor. (Reworded 2026-08-27 for v3: the anchor moved from "run the assumption's
check" to "find the quote" when proposals became findings.)

## F10 — An edge must name the artifact it carries

**MARKER:** `is a fake edge` — `workflows/plan-graph.js`

**Why frozen:** ordering phases by convention (foundation → API → UI) reads as sound
architecture and produces a straight chain every time. The template shipped exactly that
chain for months, including `UI depends on Payment Service` — while the repo's own git
history shows BE and FE PRs opened seconds apart. An edge with no artifact is a habit,
not a dependency.

## F11 — A missing investigator is not an investigator with no findings, and silence is not a report

**MARKER:** `not an investigator with no findings` — `workflows/plan-graph.js`
**MARKER:** `Never count silence as agreement` — `workflows/plan-graph.js`

> Markers are matched as literal substrings, so they must not span a line wrap. This one
> failed on its first run for exactly that reason — the phrase was broken across two
> lines and the checker correctly reported it absent.

**Why frozen:** a plan assembled from four of five domains looks complete and reads fine —
the absent domain is silent in exactly the way a satisfied domain is silent. And an agent
that signals idle without delivering looks exactly like one that finished. Both observed:
`/harness:review` lost a pass this way and only recovered it by asking directly, and that pass
then returned a Critical. `plan-graph` enforces it in code: an investigator that returns
null is named in the log and the payload is marked partial. (Reworded 2026-08-27 for v3:
architects became investigators.)

---

## Retired

### F12 — The domain keyword table is a floor, not a ceiling — retired 2026-08-25

It froze "at least three specialists on anything that is not a single-file change" and
"prefer inviting one too many". That floor is a large part of why `/harness:plan` produced worse
plans than before it existed: two architects, 27 checked assumptions and eight phases for
a page that renders a JSON file. The one real observation behind it — a security concern
nobody was asked for — survives as two narrow structural invites in `/harness:plan-graph` Step 2,
which are not frozen. `/harness:plan` itself is untouched. A rule that pads the fan-out is not a rule an optimizer would weaken; it
is the optimizer.
