---
description: Three-pass review of the current diff - correctness, adversarial re-check, sweep
argument-hint: [base-ref]
---

Three-pass review of the current diff (or $ARGUMENTS as a base ref).
Diff via: git diff <base>...HEAD (fall back to git diff HEAD).

Pass 1 - CORRECTNESS: for each changed hunk, state what could make it
wrong (inputs, state, ordering, error paths). Every finding needs an
anchor: file:line + the quoted code + the concrete failure scenario.
Pass 2 - ADVERSARIAL: re-read your Pass 1 findings as a skeptic who has
not seen your reasoning. Re-check each anchor with a command (sed -n /
grep -F). Drop any finding you cannot re-establish. Default to DROP.
Pass 3 - SWEEP: type check each changed component; scan for silent
failures (empty catch, swallowed promise, default-on-error); check the
diff against the project AGENTS.md rules.

Report: confirmed findings ranked by severity, each with anchor and
scenario; then what you checked and found clean. Pre-existing issues
outside the diff: separate section, clearly labeled.
