# Building your own architects

Architects are advisory subagents: the `/harness:plan` skill routes work to
them, and you can consult one directly with the Task tool. The harness ships
19 generic ones; the ones that make it *yours* are the ones you add.

**You don't write architects by hand — Claude writes them.** The best
architects in this harness's lineage were all LLM-written. Your job is
three things: pick which kind you need, feed the LLM the right context, and
judge the output against the mandatory sections below. This doc gives you
the copy-paste prompts for both — or run `/harness:make-architect`, which
walks the same flow interactively (context gathering, investigate-first for
domains, the contract check, file write, routing registration).

**Compatibility:** the `/harness:make-architect` skill and the dispatch/
routing of finished architects require Claude Code (terminal CLI, desktop
app, or IDE extension — anywhere the plugin is installed). Prompt A and
Prompt B below are portable: paste them into any capable LLM and you get a
valid architect file. The file itself is a Claude Code subagent — Codex has
no subagent dispatch (see `docs/porting.md`), though its content works as
reference material anywhere.

## The two kinds — decide which you're building

**A craft (stack) architect** knows a *language or framework's* traps —
true in every codebase using that stack. The LLM already has this knowledge;
your context is just the stack, version, and your conventions. The harness
ships pre-built ones for React, Vue, Angular, and Android; for anything else
(C++, Go, Python, embedded, …) generate your own with Prompt A.

**A domain architect** knows *your codebase's* rules — invariants the LLM
cannot know without investigating your code and hearing your war stories.
Generated with Prompt B, which makes the LLM read the domain first. Before
building one, skim "Carving your domains" at the top of
`scaffold/agents/_domain-architect.template.md`: a domain earns an architect
when it has burned you twice, and it must own a directory whose non-owned
neighbors it can name.

## The mandatory sections (the output contract)

Every architect file MUST have all of these. Reject any draft missing one.

| # | Section | What it must contain |
|---|---|---|
| 1 | Frontmatter `name` | `<stack-or-domain>-architect`, kebab-case, bare (no `harness:` prefix — that's only for plugin-shipped agents) |
| 2 | Frontmatter `description` | One routing paragraph PLUS 2–3 `<example>` blocks quoting requests the way users actually type them. **This field is the router — vague descriptions never fire.** |
| 3 | Frontmatter `tools` | Exactly `Read, Grep, Glob, Bash(git:*)` — architects advise, they never edit |
| 4 | Ground truth / What you know | The value section. Craft: a first-principles *model* plus trap classes with diagnostic order. Domain: distilled invariants NOT derivable from reading one file, each stated as a rule ("never X", "Y must conserve Z") |
| 5 | Adjacencies | The ground it does NOT own and who does (other architects by name) — this is what makes routing self-correcting |
| 6 | Operating principles | How it answers: cite file:line (or the standard), severity triage, smallest safe change, name the tool/test that proves it |

Kind-specific mandatory additions: **craft** → a "tooling as anchors" bullet
("a claim about \<property\> carries a \<tool\> run, not confidence");
**domain** → a "dangerous surface" line naming the changes it must always
flag.

The stamped templates (`.claude/agents/_craft-architect.template.md`,
`_domain-architect.template.md`) encode this same contract as skeletons —
hand them to the LLM as the required output shape.

## Prompt A — generate a craft architect

Paste this to Claude in your project, edited where bracketed:

```
Write a craft architect agent file for [C++20 / Go 1.23 / ...] at
.claude/agents/[cpp]-architect.md.

Output shape: follow .claude/agents/_craft-architect.template.md exactly
(delete its guidance header; fill every placeholder). All six mandatory
sections, including the tooling-as-anchors bullet.

Requirements for the content:
- Reason from the stack's underlying model (memory/ownership, concurrency,
  build), so the agent can derive answers, not recite rules.
- Trap classes as symptom → short known cause list → diagnostic order.
- Our conventions, which the agent must defer to: [error handling style,
  build system, formatter/linter, anything you enforce].
- Adjacencies: other architects in this project are [list, or "none yet"];
  harness-shipped ones must be referenced as harness:<name>.
- Realistic trigger examples: things my team actually asks, e.g.
  "[paste one or two real questions from your chat/tickets]".

Quality bar: every bullet must be something a good generalist engineer
would NOT already do. If a bullet would survive s/[C++]/anything/, cut it.
Then self-review the draft against the six mandatory sections and fix any
gap before showing me.
```

## Prompt B — generate a domain architect

The critical difference: the LLM must **investigate before writing**, and
you must **feed it the tribal knowledge it cannot see**.

```
Write a domain architect agent file for our [protocol] domain at
.claude/agents/[protocol]-architect.md.

FIRST, investigate — do not write anything until you have:
- Read the domain's code under [src/protocol/] (entry points, state
  machines, the data types that cross its boundary).
- Read git log for that directory and skimmed the fix/revert commits —
  every fix is a candidate invariant.
- Listed, with file:line evidence, the rules the code enforces implicitly.

Context you can't get from the code (this is why the section will be
true): [paste your war stories — the incident where old clients broke,
the rule you learned the hard way, the postmortem bullet points, "we
never do X because Y happened"].

Output shape: follow .claude/agents/_domain-architect.template.md exactly
(delete its guidance header). All six mandatory sections plus the
dangerous-surface line.

Quality bar for "What you know": only rules NOT derivable from reading a
single file — invariants, ordering constraints, compatibility rules,
things that conserve or must never be backfilled. A restated directory
listing is a rejected draft. Ownership must be exact: name the owned
directories AND the adjacent ones that belong to [other architects /
nobody yet].

Then self-review against the mandatory sections and fix gaps before
showing me.
```

**What context to gather before running Prompt B** (five minutes that
decide the quality): the domain's directory path; one or two incident
stories; any "we always/never" rules that live in team folklore; the names
of neighboring domains. The LLM supplies structure and code-reading; only
you can supply the folklore.

## Judging the output

Reject the draft when:
- Any mandatory section is missing or thin (the LLM was told to self-check;
  hold it to that).
- The knowledge section is generic — the test: if the content would fit any
  project, it's a slower `harness:code-architect` and adds nothing.
- Trigger examples are categories ("memory questions") instead of requests
  ("segfault only in release builds after the buffer refactor").
- A domain draft's invariants aren't ones you recognize as true. **You are
  the only verifier of tribal facts** — this is the one review the LLM
  cannot do for you.

Reference outputs: the harness's own shipped stack agents
(`plugins/harness/agents/react-architect.md`, `vue-architect.md`,
`angular-architect.md`) are what Prompt A's result should look like at full
depth.

## Register it, then prove it routes

1. Add one row to your project CLAUDE.md's routing table (bare name):
   `| cpp-architect | C++ craft | ownership, UB, lifetimes, CMake, *.cpp |`
2. Prove the direct path: ask Claude to *"consult the cpp-architect about
   <real question>"* — it should dispatch via the Task tool.
3. Prove the routing path: run `/harness:plan` on a task in that territory
   and confirm the plan's consultation list includes your architect.

If it doesn't fire, the `description` is almost always why — regenerate
just that field with sharper real-request examples.

## Keep them alive

An architect is a living file. When a domain burns you again, add the new
invariant (one sentence, with the why); when a stale rule misleads a
review, delete it. The cheapest way: after an incident, prompt Claude —
"add what we just learned to [protocol]-architect.md's What-you-know,
one bullet, with the why."

## Optional: contributing a craft architect to the harness itself

A domain architect is always project-local. A generated *craft* architect
good enough to reuse can be promoted into the harness: add it under
`plugins/harness/agents/`, reference it as `harness:<name>-architect` in
harness files, add the name to the qualified-names check in
`tests/run-all.sh`, update the roster counts (README, marketplace,
porting), bump the plugin version, run `bash tests/run-all.sh`.
