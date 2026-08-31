---
description: Create a PR for the current branch against the project's declared integration branch
argument-hint: [base-branch]
---

Create a PR for the current branch. Base branch: $ARGUMENTS if given, else
the project AGENTS.md "Integration branch", else the remote HEAD branch
(git remote show origin). Never target a production branch when an
integration branch is declared.

1. git log <base>..HEAD - read every commit; the PR describes the branch,
   not the last commit.
2. Title: concise summary of the whole change.
3. Body: Summary (what and why) / Changes (grouped by area) / Testing (what
   was run, verbatim results) / Notes (migrations, flags, follow-ups).
4. gh pr create --base <base> - then report the URL.
