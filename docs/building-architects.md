# Building your own architects

Architects are advisory subagents: the `/harness:plan` skill routes work to
them, and you can consult one directly with the Task tool. The harness ships
19 generic ones; the ones that make it *yours* are the ones you write. This
is the complete how-to. Examples below use a C++ codebase, but nothing here
is C++-specific.

## The two kinds — decide which you're building

**A craft (stack) architect** knows a *language or framework's* traps —
things that are true in every codebase using that stack. The harness ships
these for React, Vue, Angular, and Android, but the *pattern* is fully
stack-agnostic: the shipped ones are just pre-filled instances of
`scaffold/agents/_craft-architect.template.md`, which `init.sh` stamps into
your project. There is deliberately no `cpp-architect`, `go-architect`, or
`python-architect` in the box — copy the template and build the one you
need, from expertise, in an afternoon. Its content comes from knowledge of
the stack, not from reading your code.

**A domain architect** knows *your codebase's* rules — the invariants,
state machines, and traps of one subsystem, which no amount of language
expertise supplies. Its content comes from your code and your incidents.
Before building one, read **"Carving your domains"** at the top of
`scaffold/agents/_domain-architect.template.md` — when a domain earns an
architect (it has burned you twice), granularity (it owns a directory and
can name the adjacent ones it does NOT own), and why starting at zero beats
ten shallow ones.

## Where the file lives

```
<your-project>/.claude/agents/<name>-architect.md
```

That's all — no plugin work, no install step. Project agents load
automatically and are addressed by their **bare name** (`cpp-architect`).
Only agents shipped inside the harness plugin need the `harness:` prefix.

## Anatomy of the file

````markdown
---
name: cpp-architect
description: "One paragraph saying when to use it, then 2-3 realistic
  <example> blocks quoting the kind of request users actually make.
  THIS FIELD IS THE ROUTER - vague descriptions never get invoked."
tools: Read, Grep, Glob, Bash(git:*)
---

You are... (identity, one paragraph)

## Expertise / Ground truth   <- the entire value lives here
## Adjacencies                <- what is explicitly NOT yours, and who owns it
## Operating principles       <- how it reviews and answers
````

Three rules that make the difference:

1. **The `description` does the routing.** Write the trigger examples as
   real requests ("segfault after refactoring the buffer pool", not
   "memory questions"). If it wouldn't match what your teammate actually
   types, it won't fire.
2. **Read-only tools.** Architects advise; they never edit. Keep
   `Read, Grep, Glob, Bash(git:*)`.
3. **The knowledge section is the product.** An architect whose expertise
   section is generic is just a slower `harness:code-architect`. Every
   bullet should be something a good generalist would NOT already do.

## Start from the template

Both kinds have a stamped, fill-in template in your project after `init.sh`:

```bash
cp .claude/agents/_craft-architect.template.md  .claude/agents/cpp-architect.md   # craft
cp .claude/agents/_domain-architect.template.md .claude/agents/protocol-architect.md  # domain
```

Open the copy, delete the guidance block above the `---`, and fill the
placeholders. The template's five "worth having" criteria (first-principles
model, trap classes with diagnostics, tooling as anchors, convention
deference, handoffs) are the checklist for whether it's done.

## Worked example A — the craft template filled in for C++

A condensed `cpp-architect` (expand each area to taste):

````markdown
---
name: cpp-architect
description: "Use this agent for C++ work: ownership and lifetime design,
  undefined-behavior and memory-safety review, move semantics, template and
  ABI decisions, CMake structure, sanitizer triage.
  <example>user: 'Crash only in release builds after the buffer refactor'
  assistant: 'Classic UB territory - consulting cpp-architect.'</example>
  <example>user: 'Should this factory return unique_ptr or a value?'
  assistant: 'Ownership design - cpp-architect call.'</example>"
tools: Read, Grep, Glob, Bash(git:*)
---

You are a principal C++ architect. You reason from the object and memory
model, not from folklore.

## Ground truth
- **Ownership**: RAII everywhere; rule of zero first, rule of five only when
  a class manages a resource directly. `unique_ptr` is the default owning
  type; `shared_ptr` is a design decision to justify, not a convenience;
  raw pointers and references mean "non-owning, outlives me" - say so.
- **Lifetime traps**: `string_view`/`span` into temporaries; references
  invalidated by container growth; iterator invalidation rules per
  container; lambda captures outliving their frame.
- **UB radar**: signed overflow, ODR violations across TUs, data races,
  uninitialized reads, out-of-range shifts. A claim of memory safety
  carries a sanitizer run (ASan/UBSan/TSan), not confidence.
- **Moves and copies**: when moves happen implicitly, when RVO makes
  `std::move` a pessimization, sink parameters by value.
- **Error convention**: exceptions vs `expected`/status codes - match the
  codebase's declared convention (check CLAUDE.md); never mix per-file.
- **Build**: CMake targets-first - usage requirements on targets
  (`target_link_libraries` PUBLIC/PRIVATE), no directory-global flags;
  warnings-as-errors with the project's chosen set; clang-tidy findings
  are review input, not noise.
- **If it's a library**: ABI stability is an interface promise - flag any
  change to exported class layout, inline functions in public headers,
  or default arguments.

## Adjacencies
Build-system ownership questions beyond CMake structure, packaging, and CI
belong to the project's declared owners; product-domain invariants belong
to the domain architects in the CLAUDE.md routing table.

## Operating principles
Cite the standard or a file:line for every load-bearing claim. Distinguish
critical bugs (UB, races, lifetime) from anti-patterns from preferences.
Recommend the smallest safe change; name the sanitizer or test that would
prove it.
````

## Worked example B — a domain architect in a C++ codebase

Craft knowledge doesn't know that *your* protocol parser has rules. A
domain architect does:

````markdown
---
name: protocol-architect
description: "Use for wire-protocol work: framing, versioning,
  serialization in src/protocol/**.
  <example>user: 'Old clients disconnect after the new field landed'
  assistant: 'Protocol compatibility - consulting protocol-architect.'</example>"
tools: Read, Grep, Glob, Bash(git:*)
---
Ground truth - owns src/protocol/; NOT yours: src/transport/ (network-architect).
What you know - frames are length-prefixed little-endian; new fields append
only, never reorder (old clients skip unknown tail fields); version
negotiation happens once at handshake, never per-message; every parser
change reruns the fuzz corpus before merge.
Dangerous surface - anything touching frame layout or the version handshake.
````

## Register it, then prove it routes

1. Add one row to your project CLAUDE.md's routing table (bare name):
   `| cpp-architect | C++ craft | ownership, UB, lifetimes, CMake, *.cpp |`
2. Prove the direct path: ask Claude to *"consult the cpp-architect about
   <real question>"* — it should dispatch via the Task tool.
3. Prove the routing path: run `/harness:plan` on a task in that territory
   and confirm the plan's consultation list includes your architect.

If it doesn't fire, the `description` is almost always the reason — sharpen
the trigger examples until they match real requests.

## Optional: contributing a craft architect to the harness itself

A project-local architect is right for domain agents, always. A *craft*
agent (like `cpp-architect`) is general enough to live in the harness: add
it under `plugins/harness/agents/`, reference it as `harness:cpp-architect`
everywhere the harness's own files mention it, add the name to the
qualified-names check in `tests/run-all.sh`, update the roster counts in
README/marketplace/porting docs, bump the plugin version, and run
`bash tests/run-all.sh`. Project-local first is still the recommended path —
promote it once it has proven its worth.
