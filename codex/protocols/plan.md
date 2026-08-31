---
description: Plan before implementing, consulting the architect council for every domain the task touches
argument-hint: [task description]
---

Plan before implementing. Input: $ARGUMENTS (a task description; ask for
requirements if empty).

1. GATE. If the task is trivial (typo, docs-only, comment, config value),
   say so and skip to implementation. Otherwise you MUST complete this
   protocol before any edit.
2. READ. Locate every file the task plausibly touches. Quote the load-
   bearing lines (file:line). No claims from memory.
3. COUNCIL. From the project AGENTS.md architect council, pick every domain
   the task touches (default: General). For each, in order, write a short
   consultation AS that architect: risks, files to touch, the approach it
   would insist on. Domains disagree? Resolve explicitly, in writing.
4. PLAN. Phased implementation plan; each phase = one commit with a stated
   boundary, its files, and its verification command.
5. CONFIRM. Present the plan and stop. Implement only after approval.
