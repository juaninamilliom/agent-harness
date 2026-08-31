---
description: Quality-gated commit - type check hard-blocks, self-review before committing
---

Quality-gated commit. Never commit on a protected branch (see project
AGENTS.md; branch first if needed).

1. git status + git diff - review what is actually staged/unstaged; stage
   deliberately (no git add -A without reading the list).
2. TYPE CHECK (hard block): run each changed component's declared type
   check. Failures stop this protocol - fix first.
3. LINT (if declared): run it; fix or justify.
4. SELF-REVIEW: run the /review protocol on the staged diff. Critical
   findings block; fix and restart from step 2.
5. COMMIT: concise subject line stating the change, body only when the
   why isn't obvious. Push only to the current feature branch.
