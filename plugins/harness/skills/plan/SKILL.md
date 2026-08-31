---
description: Plan implementation with commit boundaries
allowed-tools: Task, Read, Grep, Glob, Bash(git:*), AskUserQuestion, TaskCreate, TaskList
argument-hint: [description]
---

# Plan Implementation with Commit Boundaries

Use specialized agents to create a detailed implementation plan with clear commit phases.

## Input

$ARGUMENTS - a description of what to implement

---

## CRITICAL REQUIREMENTS

**YOU MUST FOLLOW THESE RULES - NO EXCEPTIONS:**

1. **ALWAYS invoke the `code-architect` agent** via the Task tool. This is MANDATORY for every plan, regardless of complexity.
2. **When domains are detected**, invoke specialist agents (e.g. frontend-architect, ai-systems-architect, and any other domain architects the requirements touch) to collaborate on the plan. The specialists don't just provide "insights" - they contribute architectural decisions for their domain.
3. **DO NOT** generate plans yourself. The agents generate the plan collaboratively.
4. **DO NOT** skip agent invocation even if the task seems simple.

**Collaborative Planning Model:**
- When specialists are involved, the plan is a **joint effort** - not just code-architect's plan with specialist input
- Specialists define the approach for their domain; code-architect synthesizes into a cohesive plan with commit boundaries
- The final plan should reflect contributions from all involved architects

If you do not invoke the code-architect agent, you are violating this command's requirements.

---

## Instructions

### Step 1: Gather Requirements

**If $ARGUMENTS is provided:**
- Use the description as the requirements
- Optionally ask for acceptance criteria if not included

**If $ARGUMENTS is NOT provided:**
- Use AskUserQuestion to prompt:
  - "Enter feature description:"
  - "Enter acceptance criteria (one per line, or 'none'):"
- Use these as the source of requirements

### Step 2: Detect Domains (Auto-Agent Selection)

Analyze the requirements to detect which specialist domains are relevant. Check BOTH keywords AND file paths mentioned.

#### Domain Detection Rules

| Domain | Keywords (case-insensitive) | File Patterns |
|--------|----------------------------|---------------|
| **Frontend** | react, component, UI, CSS, tailwind, next.js, hook, page, layout, client, render, style, button, form, modal | `*.tsx`, `*.css`, `components/`, `app/`, `hooks/` |
| **AI/LLM** | agent, LLM, prompt, embedding, RAG, inference, context, model, AI, MCP, tool, orchestrat | `*agent*`, `*llm*`, `*ai*`, `*mcp*`, `.claude/` |
| **Testing** | test, testing, spec, unit test, integration test, coverage, jest, assertion, mock, fixture, test case | `*.test.ts`, `*.spec.ts`, `__tests__/`, `tests/`, `test/` |
| **Security** | security, auth, authentication, authorization, encryption, vulnerability, OWASP, XSS, injection, SQL injection, CSRF, secure | `*auth*`, `*security*`, `apiKey*` |
| **API** | API, endpoint, route, REST, request, response, schema, OpenAPI, swagger, JSON-RPC, MCP server | `*routes*`, `*api*`, `*endpoints*`, `swagger*`, `openapi*` |
| **Database** | database, migration, schema, model, SQL, query, index, sequelize, postgres, table, foreign key | `*migration*`, `*models*`, `db/`, `migrations/`, `database/` |
| **Performance** | performance, optimization, optimize, slow, latency, bundle, cache, caching, N+1, query optimization, rendering | N/A |
| **Documentation** | documentation, docs, README, JSDoc, guide, example, tutorial, API reference, changelog | `README.md`, `*.md`, `docs/`, `examples/` |
| **Android** | android, kotlin, jetpack compose, gradle, activity, fragment, viewmodel, room, retrofit | `*.kt`, `*.kts`, `build.gradle*`, `AndroidManifest.xml` |

Additionally, read the project CLAUDE.md routing table and add its domain rows — invoke those architects by the names it declares.

**Detection Process:**
1. Scan the requirements (from the argument or manual input) for keywords
2. Check if any file paths are mentioned in the requirements
3. If the requirements reference existing files, check their paths
4. Build a list of detected domains

### Step 3: Invoke Specialist Agents for Domain Planning (In Parallel)

For each detected domain, invoke the corresponding specialist agent to **define the architectural approach for their domain**. Specialists are collaborators, not just advisors.

**Frontend detected → Invoke frontend-architect:**
```
Task(subagent_type="harness:frontend-architect", prompt="You are collaborating on an implementation plan for: [REQUIREMENTS].

Your role: Define the frontend architecture for this feature.

Please provide:
1. **Component architecture** - What components are needed and how they compose
2. **State management approach** - How data flows and where state lives
3. **Suggested implementation phases** - How you'd break down the frontend work into commits
4. **Technical decisions** - Specific patterns, libraries, or approaches to use
5. **Risks or concerns** - Frontend-specific issues to watch for

Your decisions will be incorporated into the final plan by the code-architect.")
```

**AI/LLM detected → Invoke ai-systems-architect:**
```
Task(subagent_type="harness:ai-systems-architect", prompt="You are collaborating on an implementation plan for: [REQUIREMENTS].

Your role: Define the AI/LLM architecture for this feature.

Please provide:
1. **Agent/prompt architecture** - How agents, prompts, or LLM interactions should be structured
2. **Context management** - How context flows and is optimized
3. **Suggested implementation phases** - How you'd break down the AI work into commits
4. **Technical decisions** - Specific patterns, tools, or approaches to use
5. **Risks or concerns** - AI-specific issues to watch for

Your decisions will be incorporated into the final plan by the code-architect.")
```

**Testing detected → Invoke test-architect:**
```
Task(subagent_type="harness:test-architect", prompt="You are collaborating on an implementation plan for: [REQUIREMENTS].

Your role: Define the testing strategy for this feature.

Please provide:
1. **Test strategy** - What levels of testing (unit, integration, E2E) and why
2. **Critical test scenarios** - Must-test cases for this feature
3. **Mock strategy** - What to mock and what to use real implementations for
4. **Suggested test phases** - How you'd break down test writing into commits
5. **Coverage targets** - What coverage is needed for critical paths

Your decisions will be incorporated into the final plan by the code-architect.")
```

**Security detected → Invoke security-architect:**
```
Task(subagent_type="harness:security-architect", prompt="You are collaborating on an implementation plan for: [REQUIREMENTS].

Your role: Define the security requirements and approach for this feature.

Please provide:
1. **Security requirements** - Authentication, authorization, data protection needs
2. **Threat analysis** - OWASP Top 10 considerations for this feature
3. **Security patterns** - Specific security patterns to implement
4. **Validation requirements** - Input validation, sanitization needs
5. **Security testing** - What security tests are required

Your decisions will be incorporated into the final plan by the code-architect.")
```

**API detected → Invoke api-architect:**
```
Task(subagent_type="harness:api-architect", prompt="You are collaborating on an implementation plan for: [REQUIREMENTS].

Your role: Define the API design for this feature.

Please provide:
1. **Endpoint design** - URLs, methods, request/response schemas
2. **Validation rules** - Input validation and error responses
3. **API consistency** - How this fits with existing API patterns
4. **Documentation requirements** - What API docs are needed
5. **Suggested implementation phases** - How you'd break down API work into commits

Your decisions will be incorporated into the final plan by the code-architect.")
```

**Database detected → Invoke db-architect:**
```
Task(subagent_type="harness:db-architect", prompt="You are collaborating on an implementation plan for: [REQUIREMENTS].

Your role: Define the database design for this feature.

Please provide:
1. **Schema design** - Tables, columns, constraints, relationships
2. **Migration plan** - Safe migration approach with rollback
3. **Index strategy** - What indexes are needed and why
4. **Query patterns** - How data will be accessed
5. **Suggested migration phases** - How you'd break down DB work into commits

Your decisions will be incorporated into the final plan by the code-architect.")
```

**Performance detected → Invoke performance-architect:**
```
Task(subagent_type="harness:performance-architect", prompt="You are collaborating on an implementation plan for: [REQUIREMENTS].

Your role: Define the performance optimization approach for this feature.

Please provide:
1. **Performance targets** - Response times, bundle size, render performance goals
2. **Optimization strategy** - Caching, query optimization, code splitting, etc.
3. **Bottleneck identification** - Where performance issues are likely
4. **Monitoring approach** - How to measure and track performance
5. **Suggested optimization phases** - How you'd break down perf work into commits

Your decisions will be incorporated into the final plan by the code-architect.")
```

**Documentation detected → Invoke docs-architect:**
```
Task(subagent_type="harness:docs-architect", prompt="You are collaborating on an implementation plan for: [REQUIREMENTS].

Your role: Define the documentation requirements for this feature.

Please provide:
1. **Documentation scope** - What docs are needed (API, SDK, guides, examples)
2. **Example requirements** - What code examples should be provided
3. **API documentation** - OpenAPI/JSDoc requirements
4. **Integration guides** - What step-by-step guides are needed
5. **Suggested documentation phases** - How you'd break down docs work into commits

Your decisions will be incorporated into the final plan by the code-architect.")
```

**Android detected → Invoke android-architect:**
```
Task(subagent_type="harness:android-architect", prompt="You are collaborating on an implementation plan for: [REQUIREMENTS].

Your role: Define the Android architecture for this feature.

Please provide:
1. **Component architecture** - Activities, fragments, composables, and how they compose
2. **State management approach** - How data flows and where state lives (ViewModel, etc.)
3. **Suggested implementation phases** - How you'd break down the Android work into commits
4. **Technical decisions** - Specific patterns, libraries, or approaches to use
5. **Risks or concerns** - Android-specific issues to watch for

Your decisions will be incorporated into the final plan by the code-architect.")
```

**Domain architects declared in the project CLAUDE.md routing table:** invoke each by the name that table gives, following the same collaborative pattern as above.

**Multiple domains detected:**
- Invoke all relevant specialists IN PARALLEL (single message, multiple Task calls)
- Each specialist contributes their domain's architecture

**No specific domain detected:**
- Proceed directly to code-architect without specialist collaboration

### Step 4: Invoke Code Architect to Synthesize Plan (MANDATORY)

**THIS STEP IS NOT OPTIONAL.** You MUST invoke the code-architect agent via the Task tool.

The code-architect's role is to **synthesize the collaborative plan** - taking specialist contributions and weaving them into a cohesive implementation plan with proper commit boundaries and sequencing.

**When specialists were involved:**
```
Task(subagent_type="harness:code-architect", prompt="Synthesize a cohesive implementation plan for: [REQUIREMENTS].

Acceptance Criteria:
[CRITERIA]

## Specialist Contributions

The following specialists have defined the architecture for their domains. Your job is to synthesize their contributions into a unified plan with proper commit boundaries and sequencing.

### Frontend Architect's Plan:
[FRONTEND ARCHITECT OUTPUT - if applicable]

### AI Systems Architect's Plan:
[AI SYSTEMS ARCHITECT OUTPUT - if applicable]

### [Other Detected Domain] Architect's Plan:
[OUTPUT - one section per other detected domain, including any domain architects declared in the project CLAUDE.md routing table]

Please provide:
1. **Unified architectural approach** - How all the pieces fit together
2. **Implementation phases with commit boundaries** - Sequence the work across domains logically
3. **Cross-domain dependencies** - Where one domain's work depends on another
4. **Consolidated risk assessment** - Combine specialist concerns with overall risks")
```

**When no specialists were involved:**
```
Task(subagent_type="harness:code-architect", prompt="Create a detailed implementation plan for: [REQUIREMENTS].

Acceptance Criteria:
[CRITERIA]

Please provide:
- Architectural approach
- Phased implementation with commit boundaries
- Risk assessment")
```

### Step 5: Present the Plan

Output should include:
- **Overview** of the feature
- **Contributing architects** (who collaborated on this plan)
- **Domain-specific architectural decisions** (from each specialist)
- **Numbered phases**, each with:
  - Proposed commit message
  - Files to change
  - Domain owner (which architect's work this phase covers)
  - Why this is a separate commit
- **Cross-domain dependencies** (how domains interact)
- **Consolidated risks** from all architects

---

## Output Format

```markdown
# Implementation Plan: [Feature Name]

## Contributing Architects
- **Code Architect** - Overall synthesis and commit boundaries
- **Frontend Architect** - Component and state architecture
- **Database Architect** - Schema and migration design

## Architectural Decisions

### Frontend (by Frontend Architect)
- Component structure: [decision]
- State management: [decision]
- Key patterns: [decision]

### Database (by Database Architect)
- Schema design: [decision]
- Migration approach: [decision]
- Key patterns: [decision]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Implementation Phases

### Phase 1: [Foundation]
**Commit:** `Add <what>`
**Domain:** Backend/Shared
**Files:**
- `path/to/file1.ts` - description
- `path/to/file2.ts` - description
**Why separate:** [explanation]

### Phase 2: [Database Migration]
**Commit:** `Implement <what>`
**Domain:** Database
**Files:**
- ...
**Why separate:** [explanation]
**Depends on:** Phase 1

### Phase 3: [UI Components]
**Commit:** `Add <what>`
**Domain:** Frontend
**Files:**
- ...
**Why separate:** [explanation]
**Depends on:** Phase 2

[... more phases ...]

## Cross-Domain Dependencies
| From | To | Dependency |
|------|-----|------------|
| Frontend | Database | Needs schema and query endpoints |
| ... | ... | ... |

## Risks & Considerations
| Risk | Source | Likelihood | Impact | Mitigation |
|------|--------|------------|--------|------------|
| Migration timeout | Database Architect | Medium | High | Add retry logic |
| ... | ... | ... | ... | ... |
```

---

## Example Usage

```
/harness:plan "Add webhook support for payment confirmations"
```

---

### Step 6: Create Tracked Tasks (Optional)

After the plan is presented and the user approves it, offer to create tracked tasks for the plan phases.

1. **Ask the user** via AskUserQuestion:
   ```json
   {
     "questions": [{
       "question": "Create tracked tasks for plan phases? Tasks survive context compaction and are visible via Ctrl+T.",
       "header": "Task tracking",
       "multiSelect": false,
       "options": [
         {
           "label": "Yes, create tasks (Recommended)",
           "description": "Creates tasks with dependencies for each phase. Enables /harness:commit to auto-detect phases."
         },
         {
           "label": "No, skip task creation",
           "description": "Proceed without tasks. Plan phases can still be tracked via .claude/plans/ files."
         }
       ]
     }]
   }
   ```

2. **If yes**, parse the approved plan phases and create tasks in dependency order:
   - Create root phases (no dependencies) first
   - Subject format: `"Phase N: [phase title]"` (this convention is used by `/harness:commit` for lookup)
   - Description should include: commit message, files list, domain owner
   - Use `addBlockedBy` to wire dependencies based on "Depends on" annotations in the plan
   - Example:
     ```
     TaskCreate(subject="Phase 1: Add data model", description="Commit: Add data model foundation\nFiles: src/services/example.ts, src/models/example.ts\nDomain: Database")
     TaskCreate(subject="Phase 2: Add API endpoints", description="Commit: Add API routes\nFiles: src/routes/example.ts\nDomain: API\nDepends on: Phase 1")
     TaskUpdate(taskId="<phase-2-id>", addBlockedBy=["<phase-1-id>"])
     ```

3. **Display summary** after creation:
   ```
   Created N tasks for plan phases. View with Ctrl+T.
   Dependencies wired: Phase 2 blocked by Phase 1, etc.
   ```

4. **If no**, proceed without tasks (backward compatible).

---

## After Approval

1. User implements phase by phase
2. After each phase, user runs `/harness:commit` to commit that phase
3. Quality gates run automatically during commit
4. If tasks were created, `/harness:commit` auto-detects pending phases via TaskList
5. Clean git history achieved!

---

## REMINDER: Agent Collaboration is MANDATORY

Before completing this command, verify:
- [ ] Did you detect relevant domains and invoke specialist agents for them?
- [ ] Did you invoke the `code-architect` agent via the Task tool?
- [ ] Did the agents (not you) collaboratively generate the implementation plan?
- [ ] Does the final plan attribute decisions to the contributing architects?

If any answer is NO, you must invoke the appropriate agents NOW before responding to the user.
