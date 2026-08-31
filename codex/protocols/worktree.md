---
description: Create a real git worktree for parallel work, never a tool-invented isolation mechanism
argument-hint: <name> [base-branch]
---

Create a real git worktree for parallel work. Input: $ARGUMENTS = <name>
[base-branch].

1. Convention: <repo-parent>/<repo>-worktrees/<name>, branched off the
   project AGENTS.md integration branch unless a base is given.
2. git worktree add <path> -b <name> <base> - never a tool's built-in
   isolation feature; only git worktree.
3. Copy the env files the project AGENTS.md "Worktree Setup" table lists
   (they are untracked and will not follow the checkout). None declared:
   copy nothing and say so.
4. Install deps per the table, else by lockfile (pnpm-lock.yaml -> pnpm
   install, yarn.lock -> yarn, else npm install).
5. Cleanup later is git worktree remove - never rm -rf (stale registry).
