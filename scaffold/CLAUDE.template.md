# CLAUDE.md

This file provides guidance to Claude Code when working with code in this
repository: __PROJECT_NAME__.

## ⚠️ STOP: Read This First - Architect Requirement

**BEFORE YOU DO ANYTHING ELSE**, determine if this task requires architect consultation:

### Does This Task Require an Architect?

**YES - Invoke architect FIRST** if the task involves:
- New features or functionality (beyond trivial changes)
- API changes (new endpoints, request/response shapes, auth)
- Database changes (models, schema, relationships)
- New UI components or state management changes
- Domain-critical operations (list yours here) <!-- FILL: e.g. payments, billing, auth -->
- Refactoring that touches more than 2-3 files
- Bug fixes affecting core business logic or security

**NO - Proceed directly** only for:
- Single-line typo/bug fixes
- Documentation-only changes
- Adding comments to existing code
- Simple config value changes
- Test additions that don't change implementation

**How:** `/harness:plan [description]` auto-invokes the right architects
based on domain detection. For a single consultation, use the Task tool with
the agent name from the routing table below.

**VIOLATION**: Proceeding with major work without architect consultation
breaks project requirements.

### Architect Routing Table

| Agent | Domain | Triggers |
|-------|--------|----------|
| `code-architect` | General | **DEFAULT** - use when unsure |
| `frontend-architect` | UI/React/CSS | components, hooks, styling, `*.tsx` |
| `api-architect` | REST/API design | endpoints, request/response shapes, routes |
| `db-architect` | Database | models, schema, migrations, SQL |
| `security-architect` | Auth/security | auth, encryption, OWASP, secrets |
| `test-architect` | Testing | tests, coverage, mocks, `*.test.*` |
| `performance-architect` | Performance | optimization, cache, bundle, slow |
| `docs-architect` | Documentation | docs, README, JSDoc, guides |
| `ai-systems-architect` | AI/LLM/MCP | agents, prompts, MCP, `.claude/` |
| `android-architect` | Android/Kotlin | `*.kt`, Android Studio, Gradle |
<!-- FILL: add one row per domain architect you create from
     .claude/agents/_domain-architect.template.md, e.g.:
| `billing-architect` | Payments/billing | invoices, subscriptions, src/billing/** | -->

## Project Overview

<!-- FILL: 3-6 sentences - what this project is, its components, primary stack -->

## Components

<!-- FILL: one row per component (a directory with its own package.json/tsconfig):
| Component | Path | Dev command | Type check | Test command | Trustworthy suite? |
|---|---|---|---|---|---|
| server | server/ | npm run dev | npx tsc --noEmit | npm test | no (flaky) |
-->

## Git Structure

- Integration branch: <!-- FILL: e.g. dev - PRs target this, never push to it directly -->
- Protected branches: <!-- FILL: e.g. main, dev -->
<!-- FILL if multi-repo: list each component's repo root; git commands run inside them -->

## Worktree Setup

<!-- FILL: used by /harness:worktree - one row per repo:
| Repo | Env files to copy | Install command |
|---|---|---|
| server | .env | npm install |
-->

## Development Rules

### ⚠️ NEVER Run `npm run build` During Development
Dev servers hot-reload; build output breaks them. Validate types with the
type check commands above instead. Only build for production or when
explicitly asked. <!-- FILL or delete if this project has no dev server -->

<!-- FILL: project-specific conventions, environment notes, read-only dirs -->
