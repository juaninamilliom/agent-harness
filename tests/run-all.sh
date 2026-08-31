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
# global/hooks/ excluded from the de-beep sweep: verbatim-copied user plumbing whose AppleScript "beep" is a macOS API, not a project reference
run "de-beeped"            bash -c '! grep -rEinq "beep|justbeep|trello|solana|\bsui\b|@mysten|privy|turnkey|bluefin|hyperliquid|polymarket|\bdflow\b|kalshi|postman" plugins/ scaffold/ global/settings.fragment.json global/install.sh global/doctor.sh global/keybindings.json codex/ addons/ README.md docs/philosophy.md docs/porting.md 2>/dev/null'
run "global install test"  bash tests/test-global-install.sh
run "init test"            bash tests/test-init.sh
[ -f tests/test-codex-install.sh ] && run "codex install test" bash tests/test-codex-install.sh
[ "$FAIL" = 0 ] && echo "ALL GREEN"
exit $FAIL
