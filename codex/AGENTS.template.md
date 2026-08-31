# AGENTS.md

This file provides guidance to Codex when working with code in this
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

**How:** Run the /plan protocol - it walks the council for the domains the task touches.

**VIOLATION**: Proceeding with major work without architect consultation
breaks project requirements.

### Architect Council

Codex has no subagent tool, so there is no one to hand these off to - the
/plan protocol has you write each consultation yourself, in order, inside
the same context: risks, files to touch, the approach that architect would
insist on.

| Architect | Domain | Triggers |
|-------|--------|----------|
| General architect | General | **DEFAULT** - use when unsure |
| Frontend architect | UI/React/CSS | components, hooks, styling, `*.tsx` |
| API architect | REST/API design | endpoints, request/response shapes, routes |
| Database architect | Database | models, schema, migrations, SQL |
| Security architect | Auth/security | auth, encryption, OWASP, secrets |
| Test architect | Testing | tests, coverage, mocks, `*.test.*` |
| Performance architect | Performance | optimization, cache, bundle, slow |
| Docs architect | Documentation | docs, README, JSDoc, guides |
| AI systems architect | AI/LLM/MCP | agents, prompts, MCP, `.codex/` |
| Android architect | Android/Kotlin | `*.kt`, Android Studio, Gradle |
<!-- FILL: add one row per domain architect this project needs, e.g.:
| Billing architect | Payments/billing | invoices, subscriptions, src/billing/** | -->

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

<!-- FILL: used by the /worktree protocol - one row per repo:
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
