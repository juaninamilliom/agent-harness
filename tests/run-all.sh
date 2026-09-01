#!/bin/bash
# Structural + behavioral checks for the whole harness repo.
set -uo pipefail
cd "$(dirname "$0")/.."
FAIL=0
run() { echo "== $1"; shift; if "$@"; then echo "   ok"; else echo "   FAIL"; FAIL=1; fi; }

run "manifests parse"      jq -e . .claude-plugin/marketplace.json plugins/harness/.claude-plugin/plugin.json
run "shell syntax"         bash -c 'for f in $(find . -name "*.sh" -not -path "./.git/*"); do bash -n "$f" || exit 1; done'
run "plan-graph smoke"     node tests/plan-graph.smoke.mjs plugins/harness/workflows/plan-graph.js
run "review-graph smoke"   node tests/review-graph.smoke.mjs plugins/harness/workflows/review-graph.js
run "frozen rules"         plugins/harness/scripts/graph/check-frozen.sh plugins/harness
# Every in-plugin agent name the harness itself dispatches or documents dispatching must
# be harness:-qualified: a bare name (e.g. 'code-architect') only resolves inside this
# plugin's own repo, never for a plugin consumer's session (verified by a live probe).
# The delimiter-adjacency in this pattern is what does the exclusion: `harness:code-architect`
# has a colon, not a quote/backtick, immediately before the name, so it never matches; only a
# bare delimited literal does. Covers code literals ('/") AND prose mentions (backticks), and
# scans the consumer-facing docs outside the plugin too. Agent frontmatter `name:` fields are
# unquoted and stay bare, so they never match. Revert any one fix to prove this fails.
run "in-plugin agent names qualified" bash -c '! grep -rnE "('\''|\"|\`)(plan-investigator|claim-refuter|finding-refuter|pr-review|code-architect|frontend-architect|api-architect|db-architect|test-architect|security-architect|performance-architect|docs-architect|ai-systems-architect|android-architect|build-validator|code-simplifier)\1" plugins/harness README.md scaffold/CLAUDE.template.md scaffold/agents docs/philosophy.md docs/porting.md docs/guide.md | grep -v "pr-review-toolkit"'
# global/hooks/ excluded from the de-beep sweep: verbatim-copied user plumbing whose AppleScript "beep" is a macOS API, not a project reference
run "de-beeped"            bash -c '! grep -rEinq "beep|justbeep|trello|solana|\bsui\b|@mysten|privy|turnkey|bluefin|hyperliquid|polymarket|\bdflow\b|kalshi|postman" plugins/ scaffold/ global/settings.fragment.json global/install.sh global/doctor.sh global/keybindings.json codex/ addons/ README.md docs/philosophy.md docs/porting.md 2>/dev/null'
run "global install test"  bash tests/test-global-install.sh
run "init test"            bash tests/test-init.sh
[ -f tests/test-codex-install.sh ] && run "codex install test" bash tests/test-codex-install.sh
[ "$FAIL" = 0 ] && echo "ALL GREEN"
exit $FAIL
