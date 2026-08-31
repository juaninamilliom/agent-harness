---
description: Create a PR with a comprehensive description
allowed-tools: Bash(git:*), Bash(gh:*), AskUserQuestion
argument-hint: [base-branch?]
---

# Create Pull Request Workflow

Create a well-documented PR with a comprehensive description based on all commits on the branch.

## Arguments

- `$1` - Base branch to merge into (optional; see Step 2 for how it's determined)

## CRITICAL SAFETY RULES

**NEVER create PRs targeting these branches:**
- `production`
- `prod`
- `master`
- `main` (use the project's integration branch as the default target instead)

**ONLY these branches are allowed as PR targets:**
- The project's integration branch (default; see Step 2 for how it's determined)
- Feature branches (e.g., `staging`, `release/*`) if explicitly specified via `$1`

## Instructions

1. **Get current branch info**
   - Run `git branch --show-current`
   - Verify we're not on the project's integration branch (see Step 2) or `main`, `master`, `production`, or `prod`
   - If on a protected branch, STOP - user should be on a feature branch

2. **Determine base branch**
   - Use `$1` if provided (validate it's not a protected branch)
   - Otherwise, read the project CLAUDE.md for an "Integration branch" declaration and use it
   - If the CLAUDE.md declares none, detect it via `git remote show origin | sed -n '/HEAD branch/s/.*: //p'`
   - NEVER allow `production`, `prod`, `master`, or `main` as base
   - If the detected/declared branch is a production branch (`main`, `master`, `production`, `prod`) and the CLAUDE.md declares a separate integration branch, use the integration branch instead
   - If the user explicitly requests `main` (or another production branch), STOP and inform them to use the integration branch instead

3. **Analyze branch commits**
   - Run `git log <base-branch>..HEAD --oneline` to see all new commits
   - Run `git diff <base-branch>...HEAD --stat` for files changed summary
   - Run `git diff <base-branch>...HEAD` for full diff context
   - Understand the full scope of changes across ALL commits

4. **Ensure branch is pushed**
   - Check if remote tracking branch exists
   - If not, push with `git push -u origin HEAD`

5. **Compose PR title**

   Format: a concise summary of the branch's changes (e.g., derived from the branch name or the commits)

6. **Compose PR description**
   Use this structure:
   ```markdown
   ## Summary

   <2-3 sentence overview of what this PR accomplishes>

   ## Changes

   <bullet points summarizing key changes, grouped logically>

   ## Acceptance Criteria

   <if provided by the user, list them as checkboxes>
   - [ ] Criteria 1
   - [ ] Criteria 2

   <or "N/A" if none provided>

   ## Testing

   <brief notes on how to test, or "See acceptance criteria">
   ```

   **IMPORTANT:** Do NOT include:
   - "Generated with Claude Code" footer
   - Any AI/Claude attribution or references
   - Robot emojis or similar indicators

7. **Create the PR**
   - Use `gh pr create --base <base-branch> --title "<title>" --body "<body>"`
   - If PR already exists, inform user and show the existing PR URL

8. **Report success**
   - Show the PR URL
   - Summarize what was included
