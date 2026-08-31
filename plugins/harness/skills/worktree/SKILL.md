---
description: Create a real git worktree for parallel development. Uses `git worktree add` - never EnterWorktree or Task isolation, which collide.
allowed-tools: Bash(git:*), Bash(npm:*), Bash(pnpm:*), Bash(yarn:*), Bash(ls:*), Bash(cp:*), Bash(mkdir:*), Read, AskUserQuestion
argument-hint: <repo-dir> <name> [base-branch]
---

# Create Worktree

**Real `git worktree add` is the only supported mechanism in this project.**

Do **not** use the `EnterWorktree` tool, and do **not** pass `isolation: "worktree"`
to the Task tool. Both create their own worktrees outside the project's naming
convention and collide with the ones already registered here. Real worktrees may
already exist for these repos; anything not in `git worktree list` is not a project
worktree.

## Arguments

Parse `$ARGUMENTS`:
- `$0` **repo-dir** (required): the repository's directory name under `<repo-parent>`
- `$1` **name** (required): short directory name, e.g. `jest-flake`
- `$2` **base-branch** (optional): defaults to the project's integration branch (see `/harness:pr` for how it's determined)

Ask if either required argument is missing.

## Conventions - do not deviate

| | |
|---|---|
| Parent directory | `<repo-parent>/<repo-dir>-worktrees/` |
| **Never** | invent a new parent folder, or nest worktrees inside the main checkout |
| Base branch | the project's integration branch (not `main`, not `production`) |
| Branch name | `feature/<name>` or `fix/<name>` - ask which if it is not obvious from the name |

Repo mapping: read the "Worktree Setup" table from the project CLAUDE.md (repo → env
files to copy, install command). If absent: copy no env files and say so; install by
lockfile (`pnpm-lock.yaml` → `pnpm install`, `yarn.lock` → `yarn`, else `npm install`).

## Steps

### 1. Check it does not already exist

```bash
cd <repo-parent>/<repo-dir>
git worktree list | grep -i "<name>" || echo "free"
ls -d <repo-parent>/<repo-dir>-worktrees/<name> 2>/dev/null || echo "path free"
```

If the path exists but is **not** in `git worktree list`, it is a stale directory
or a leftover clone. Stop and tell the user - do not overwrite it.

### 2. Create the worktree

```bash
cd <repo-parent>/<repo-dir>
git fetch origin <base-branch>
git worktree add ../<repo-dir>-worktrees/<name> -b <feature|fix>/<name> origin/<base-branch>
```

To check out an **existing** branch instead of creating one, drop `-b`:

```bash
git worktree add ../<repo-dir>-worktrees/<name> <existing-branch>
```

### 3. Copy the env file(s)

The worktree shares git history, not untracked files. Env files are untracked, so
a fresh worktree has none and the app will not start without one.

```bash
cp <repo-parent>/<repo-dir>/<env-file> <repo-parent>/<repo-dir>-worktrees/<name>/<env-file>
```

Use the env file(s) named in the CLAUDE.md's "Worktree Setup" table for this repo.
If the table is absent, copy no env files and say so.

### 4. Install dependencies - only if the user needs to run or test

`node_modules` is not shared between worktrees. A full install is slow and costs
disk, so **skip it for review-only or read-only work** and say that you skipped it.

Install when the user will run the dev server, run tests, or commit (if the repo has
a pre-commit hook that runs tests, a worktree without deps will fail to commit):

```bash
cd <repo-parent>/<repo-dir>-worktrees/<name> && <install command from the Worktree Setup table, or lockfile detection>
```

### 5. Confirm

```bash
cd <repo-parent>/<repo-dir> && git worktree list
```

Report the path, the branch, its base, and whether you installed dependencies.

## Notes

- If the repo has a pre-commit hook that runs tests, a worktree without deps will
  fail to commit. `--no-verify` is not an approved workaround.
- If `<repo-parent>` itself is not a git repo, every git command must run inside the
  specific repo directory, not the parent.
- Clean up with `/harness:worktree-remove` - never `rm -rf` a worktree directory, which leaves
  a stale entry in `git worktree list`.
