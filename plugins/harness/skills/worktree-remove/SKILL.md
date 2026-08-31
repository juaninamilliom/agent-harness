---
description: Remove a git worktree safely - checks for uncommitted and unpushed work first, then prunes the registry.
allowed-tools: Bash(git:*), Bash(ls:*), Bash(du:*), AskUserQuestion
argument-hint: <repo-dir> [name] (omit name to list)
---

# Remove Worktree

Never `rm -rf` a worktree directory. That leaves a stale entry in `git worktree list`
and the branch stays checked out as far as git is concerned, so the next
`git worktree add` for that branch fails.

## Arguments

- `$0` **repo-dir** (required): the repository's directory name under `<repo-parent>`
- `$1` **name** (optional): omit to list what exists

## 1. List

```bash
cd <repo-parent>/<repo-dir>
git worktree list
```

With no name argument, show this and stop. Include disk usage if the user is
clearing space:

```bash
du -sh <repo-parent>/<repo-dir>-worktrees/*/ 2>/dev/null | sort -h
```

## 2. Safety check - always, before removing

```bash
cd <repo-parent>/<repo-dir>-worktrees/<name>
git status --short
git log --oneline @{u}.. 2>/dev/null || echo "NO UPSTREAM - nothing pushed"
```

**Stop and ask the user** if either shows anything:

- uncommitted changes -> work would be destroyed
- unpushed commits, or no upstream -> commits exist only here

Do not proceed on your own judgement. Report exactly what would be lost.

## 3. Remove

```bash
cd <repo-parent>/<repo-dir>
git worktree remove <repo-dir>-worktrees/<name>
```

If git refuses because the tree is dirty and the user has explicitly confirmed the
loss, `--force` is available. Confirm first, every time.

## 4. Prune and verify

```bash
git worktree prune
git worktree list
```

## 5. The branch

Removing a worktree does **not** delete its branch. Ask before deleting:

```bash
git branch -d <branch>    # -D only if the user confirms unmerged work is expendable
```

If the branch has an open PR, leave it alone and say so.

## Stale directories

A path under `<repo-dir>-worktrees/` that does **not** appear in `git worktree list`
is not a worktree - it is a leftover directory or an old full clone. `git worktree
remove` will not touch it. Report it and let the user decide; do not delete it
yourself.
