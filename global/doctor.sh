#!/bin/bash
# Report drift between this repo's global layer and an installed ~/.claude.
# Usage: doctor.sh [target-dir]   Exit 0 = healthy.
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-$HOME/.claude}"
FAIL=0
say() { printf '  %-7s %s\n' "$1" "$2"; }
bad() { say "DRIFT" "$1"; FAIL=1; }

[ -f "$TARGET/settings.json" ] || { echo "no settings.json in $TARGET"; exit 1; }
while IFS= read -r entry; do
  jq -e --arg e "$entry" '.permissions.allow | index($e)' "$TARGET/settings.json" >/dev/null 2>&1 \
    || bad "allow entry missing: $entry"
done < <(jq -r '.permissions.allow[]' "$REPO/global/settings.fragment.json")
jq -e '.enabledPlugins["harness@agent-harness"] == true' "$TARGET/settings.json" >/dev/null 2>&1 \
  || bad "harness plugin not enabled"
for h in "$REPO"/global/hooks/*.sh; do
  name="$(basename "$h")"
  [ "$(readlink "$TARGET/hooks/$name" 2>/dev/null)" = "$h" ] || bad "hook not linked to repo: $name"
done
[ -f "$TARGET/keybindings.json" ] || bad "keybindings.json missing"
for a in code-architect.md ai-systems-architect.md; do
  [ -f "$TARGET/agents/$a" ] && bad "stray agent duplicates plugin agent: $a"
done
[ "$FAIL" = 0 ] && echo "healthy: $TARGET matches the repo's global layer"
exit $FAIL
