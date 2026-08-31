---
description: Commit changes with quality gates and push to current branch
allowed-tools: Bash(git:*), Task, AskUserQuestion, TaskList, TaskUpdate, TaskGet
---

# Commit and Push Workflow

Create a well-structured commit for the current changes and push to the current branch.

## CRITICAL SAFETY RULES

**NEVER push to these protected branches:**
- `dev`
- `develop`
- `development`
- `production`
- `prod`
- `main`
- `master`

If the current branch is any of these, **STOP IMMEDIATELY** and inform the user they must create a feature branch first.

**NEVER commit with `--no-verify`. It can easily break the build and affect other people's code.

---

## Instructions

### Step 1: Check Current Branch Safety

- Run `git branch --show-current`
- If on a protected branch, STOP and tell the user to create/switch to a feature branch

### Step 2: Check for Active Plan (Plan→Commit Integration)

**This step links the `/harness:plan` command output to commit validation.**

**Detection Method 1: TaskList-based (preferred)**

1. Call `TaskList` to check for tasks with subjects matching `"Phase N:"` pattern
2. If matching tasks found:
   - These were created by `/harness:plan` Step 6
   - Filter to pending and in_progress tasks (skip completed)
   - Present as phase options to the user via AskUserQuestion:
     ```
     {
       "question": "Which commit phase are you implementing?",
       "header": "Phase",
       "options": [
         {
           "label": "[Task subject, e.g. Phase 1: Add payment service]",
           "description": "[First line of task description]"
         },
         ... (list pending/in_progress tasks) ...
         {
           "label": "Not following a plan",
           "description": "This commit isn't part of any planned phases"
         }
       ]
     }
     ```
   - If user selects a phase: call `TaskGet` on the task ID to get full description (files, scope, domain)
   - Mark the task as `in_progress` via `TaskUpdate` (will be completed in Step 8a)
   - Store the task ID for completion in Step 8a

**Detection Method 2: File-based (fallback)**

If no tasks with `"Phase N:"` subjects are found, fall back to file-based detection:

1. **Check if a recent plan exists:**
   - Look for plan files in `.claude/plans/` directory
   - Use `ls -t .claude/plans/*.md | head -5` to get 5 most recent plans
   - Read the most recent 1-2 plans to see if they're related to current work

2. **If a relevant plan is found:**
   - Display to user: "Found recent plan: [Plan filename]"
   - Extract commit boundaries from the plan (look for "Phase 1:", "Phase 2:", etc.)
   - Ask user via AskUserQuestion:
     ```
     {
       "question": "Which commit phase from the plan are you implementing?",
       "header": "Phase",
       "options": [
         {
           "label": "Phase 1: [Phase 1 title from plan]",
           "description": "[Brief description from plan]"
         },
         {
           "label": "Phase 2: [Phase 2 title from plan]",
           "description": "[Brief description from plan]"
         },
         ... (list all phases) ...
         {
           "label": "Not following this plan",
           "description": "This commit isn't part of the planned phases"
         }
       ]
     }
     ```

**For either detection method, if user selects a phase:**
   - Extract the expected files and scope for that phase from the plan/task
   - Pass this information to the **pr-review** agent in Step 4c:
     ```
     prompt="Review the staged changes for code quality...

     ADDITIONAL CONTEXT: User indicated this commit implements Phase N from plan:
     - Expected scope: [Files and changes from plan]
     - Commit boundary: [Why this is a separate commit from plan]

     Please validate:
     1. Changes match the planned scope for Phase N
     2. No out-of-scope changes that should be in a different phase
     3. All planned changes for this phase are included"
     ```
   - Store the selected phase for the commit message composition in Step 5

**If user selects "Not following this/a plan" OR no plan found:**
   - Continue normal commit workflow without plan validation
   - Do not pass plan context to pr-review agent

### Step 3: Analyze Changes

- Run `git status` to see all modified/untracked files
- Run `git diff --staged` for staged changes
- Run `git diff` for unstaged changes
- Summarize what was changed and why

---

## Step 4: Quality Gate Loop

Run the following quality gates before allowing the commit. This loop runs a maximum of **3 cycles**.

### 4a: Run All Quality Gates in Parallel

**CRITICAL**: All three agents run **EVERY cycle**, even if "no changes detected since last cycle". User may have made changes offline between cycles.

Invoke **all three agents in a single message** with multiple Task calls (parallel execution):

```
// Send ALL THREE in one message for parallel execution:

Task(subagent_type="harness:build-validator", prompt="Validate that the project's declared type checks pass. Run the type check command for any components with changes (e.g. `npx tsc --noEmit`) - never `npm run build`. Report status.")

Task(subagent_type="harness:code-simplifier", prompt="Review the staged/modified code for complexity. Identify opportunities to simplify: long functions, deep nesting, duplication, overly complex logic. Focus on changes only, not entire files.")

Task(subagent_type="harness:pr-review", prompt="Review the staged changes for code quality. Check: security issues, code smells, best practices, documentation. [PLAN_CONTEXT if phase selected in Step 2]. Output your findings in the standard review format.")
```

### 4b: Evaluate Results (Build First)

After all three agents complete:

1. **Check build-validator result FIRST**
   - If build **FAILED**: This is a HARD BLOCK - discard code-simplifier and pr-review results
   - Display only the build errors (other reviews are irrelevant until build passes)
   - Ask user: "Fix build errors and retry?" or "Abort commit?"
   - If user fixes, increment cycle count and **restart from 4a**
   - If abort, end the workflow

2. **If build PASSED**: Proceed to 4b-verify with code-simplifier and pr-review results

### 4b-verify: Refute Findings Before Reporting

Before compiling anything for the user, every finding from code-simplifier and
pr-review must survive an independent verifier.

Dispatch **finding-refuter once per finding, all in a single message** so they run
in parallel.

```
// one Task per finding, ALL in one message:
Task(subagent_type="harness:finding-refuter", prompt="Finding to refute:\n**Location**: <file:line>\n**Claim**: <the claim>\n**Proposed fix**: <the fix>")
```

**Each refuter gets the finding only.** Do not pass the producing agent's
reasoning, its full report, your summary of it, or which agent produced it. A
verifier that can see the argument is agreeing with it, not checking it.

Then:

- Keep only `VERDICT: KEEP`. Discard every `DROP`.
- Report the counts: `N findings -> M verified (K refuted)`.
- Carry `MONEY_SCOPE: yes` forward as a hard flag - those need explicit user
  sign-off regardless of severity and are never auto-applied.
- Cap at 10 refuters. If more than 10 findings exist, verify the 10 highest
  severity and list the rest under "Not verified" - never drop them silently.

Anchors are the project's type check, `grep`, and `git diff`. **Not the test suite** — unless the project CLAUDE.md declares it trustworthy, a flaky suite lies in both directions.

### 4c: Code Quality Results

Collect results from both code-simplifier and pr-review:
- Simplification suggestions from code-simplifier
- Issues categorized as Critical, Warnings, or Suggestions from pr-review

### 4c-alt: Detect Agent Conflicts (NEW)

After collecting reports from all three agents, check for contradictions between their recommendations.

**Common conflict patterns to detect:**
1. **Simplification vs Security**: code-simplifier suggests refactoring code that pr-review marked as security-critical or must remain atomic
2. **Simplification vs Complexity**: code-simplifier suggests extracting logic that pr-review says adds unnecessary indirection
3. **Build vs Review**: build-validator passes but pr-review found architectural issues that might require build changes

**Verify first.** Most apparent conflicts dissolve in 4b-verify: if the refuter
dropped one side's finding, there is no conflict left to resolve. Only escalate to
the user when **both** sides survived verification.

**If a conflict survives verification:**

Display to user:
```
⚠️ AGENT CONFLICT DETECTED

The agents have made contradictory recommendations:

Agent A (code-simplifier) suggests:
  → [Recommendation from code-simplifier]

Agent B (pr-review) recommends:
  → [Conflicting recommendation from pr-review]

These recommendations conflict because: [Brief explanation]
```

Ask user via AskUserQuestion:
```
{
  "question": "Which agent's recommendation should take priority?",
  "header": "Conflict",
  "options": [
    {
      "label": "Follow pr-review (prioritize security/correctness)",
      "description": "Security and correctness concerns typically override simplification"
    },
    {
      "label": "Follow code-simplifier (prioritize maintainability)",
      "description": "Code simplicity concerns override other considerations"
    },
    {
      "label": "Request manual review",
      "description": "Pause automation and ask team member to decide"
    },
    {
      "label": "Ignore both and proceed",
      "description": "Continue with current implementation despite conflicts"
    }
  ]
}
```

**Based on user's choice:**
- If "Follow pr-review": Remove conflicting code-simplifier suggestions from report
- If "Follow code-simplifier": Downgrade conflicting pr-review issues to Suggestions
- If "Request manual review": Display instructions to user and pause workflow
- If "Ignore both": Proceed to 4d with both recommendations noted

**If no conflicts detected:**
- Continue to 4d

### 4d: Display Consolidated Report

Present a summary to the user:
```
## Quality Gate Results - Cycle N/3

### Build Status: PASS/FAIL

### Code Review Summary
- Critical Issues: N (blocks commit)
- Warnings: N (should fix)
- Suggestions: N (optional)

### Simplification Opportunities: N

[Details of each issue...]
```

### 4e: Decision Point

**Determine current cycle count** (initialized at 1, incremented each time user fixes and retries).

---

**If build failed:**
- Cannot proceed. User must fix and retry.
- Increment cycle count after user attempts fix

**If Critical issues found:**
- Cannot proceed until resolved.

**If Cycle Count = 1 (First attempt):**
- Ask: "Fix critical issues and retry?" / "Abort?"

**If Cycle Count = 2 (Second attempt - ESCALATION AVAILABLE):**
- Display: "⚠️ Two cycles completed. One more attempt available before hitting limit."
- Ask via AskUserQuestion:
  ```
  {
    "question": "What would you like to do?",
    "header": "Action",
    "options": [
      {
        "label": "Fix issues and retry (Cycle 3)",
        "description": "Attempt to resolve issues one more time"
      },
      {
        "label": "Request manual review",
        "description": "Pause automation and notify team for help"
      },
      {
        "label": "Abort commit",
        "description": "Stop the commit workflow entirely"
      }
    ]
  }
  ```
- If "Request manual review": Display instructions ("Please ask a team member to review [files]. Workflow paused.") and end workflow
- If "Fix and retry": Continue to next cycle
- If "Abort": End workflow

**If Cycle Count = 3 (Limit reached):**
- Display: "🛑 Maximum 3 cycles reached."
- If still has Critical issues: "Critical issues remain. You MUST fix these or abort. Cannot commit."
  - Options: "Fix and restart from Cycle 1" / "Abort"
- If only Warnings/Suggestions: "Only warnings/suggestions remain. You can commit with acknowledgment."
  - Options: "Commit anyway" / "Request manual review" / "Abort"

---

**If only Warnings/Suggestions (no Critical):**

**Cycle Count 1 or 2:**
- Ask user: "Fix issues and retry?" / "Commit anyway with acknowledgment?" / "Request manual review?" / "Abort?"

**Cycle Count 3 (Limit reached):**
- Ask user: "Commit with current issues acknowledged?" / "Request manual review?" / "Abort?"
- If "Commit anyway": Note in commit message footer: "Quality gates: N warnings acknowledged"

---

**If all clear (no issues):**
- Proceed to Step 5 immediately

---

### Step 5: Compose Commit Message

```
<concise summary>

<bullet points of key changes>

Plan: Phase N - [Phase title] (if plan phase was selected in Step 2)
```

**Note on Plan reference:**
- Include "Plan: Phase N" footer ONLY if user selected a specific phase in Step 2
- Omit if user selected "Not following this plan" or no plan was found
- This creates traceability between planning and implementation

**IMPORTANT:** Do NOT include:
- `Co-Authored-By` tags
- "Generated with Claude Code" or similar attribution
- Any AI/Claude references in the commit message

### Step 6: Stage and Commit

- Stage relevant files (ask user if unsure what to include)
- Create the commit

### Step 7: Push to Current Branch

- Verify again we're NOT on a protected branch
- Push with `git push origin HEAD`
- If branch doesn't exist on remote, use `git push -u origin HEAD`

### Step 8: Report Success

- Show the commit hash
- Show the remote URL if available
- Confirm quality gates passed (or which were overridden)

### Step 8a: Complete Plan Task (if applicable)

If a plan phase was selected in Step 2 AND the phase was detected via TaskList:
1. Mark the task as `completed` via `TaskUpdate(taskId="<stored-task-id>", status="completed")`
2. Display: "Marked Phase N task as completed."
3. Call `TaskList` to show remaining pending phases (if any exist)
