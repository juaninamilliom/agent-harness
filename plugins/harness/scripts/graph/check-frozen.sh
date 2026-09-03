#!/bin/bash
# Assert every rule in FROZEN.md is still present where it must be.
#
# A frozen rule written as prose in an editable file is not frozen - it is text in a
# confident tone, and it survives until someone refactors around it. This makes removal
# fail instead of pass silently.
#
# Usage:  check-frozen.sh [plugin-root]
# Exit 0 = all rules present. Exit 1 = at least one is missing.

set -uo pipefail
# Resolve this script's own absolute path BEFORE the `cd` below - the DRIFT check near
# the end greps this file for its own `check F<n>` lines, and a relative $0 stops
# resolving the moment the cwd changes. Only the no-arg default happened to keep $0
# valid (ROOT is derived from it); an explicit relative root - the plugin's normal
# calling convention - broke it silently, reporting DRIFT with 0 rules enforced.
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
SELF="$SELF_DIR/$(basename "${BASH_SOURCE[0]:-$0}")"
ROOT="${1:-$(cd "$SELF_DIR/../.." && pwd)}"
cd "$ROOT" || { echo "no such dir: $ROOT" >&2; exit 2; }

FAIL=0
check() { # check <id> <marker> <file>
  local id="$1" marker="$2" file="$3"
  if [ ! -f "$file" ]; then
    printf '  %-4s MISSING FILE  %s\n' "$id" "$file"; FAIL=1; return
  fi
  if grep -qF "$marker" "$file"; then
    printf '  %-4s ok            %s\n' "$id" "$file"
  else
    printf '  %-4s BROKEN        %s  (marker absent: "%s")\n' "$id" "$file" "$marker"; FAIL=1
  fi
}

echo "Checking frozen rules against FROZEN.md ..."
check F1 'not seen the reasoning'         agents/finding-refuter.md
check F1 'not seen the reasoning'         agents/claim-refuter.md
check F1 'never sees the lens'            workflows/review-graph.js
check F1 'never the investigator'         workflows/plan-graph.js
check F1 'never the specialist'           workflows/plan-graph.js
check F2 'NOT an anchor'                  agents/finding-refuter.md
check F2 'NOT an anchor'                  agents/claim-refuter.md
check F2 'NOT an anchor'                  agents/plan-investigator.md
check F3 'not reintroduce keyword scoring' skills/review/SKILL.md
check F4 'Never run `npm run build`'      agents/build-validator.md
check F5 'not a pass that returned clean' skills/review/SKILL.md
check F6 'there is no graph to build'     skills/review/SKILL.md
check F7 'Default to DROP'                agents/finding-refuter.md
check F7 'Default to DROP'                agents/claim-refuter.md
check F8 'Do not report pre-existing'     workflows/review-graph.js
check F9 'is the ANCHOR'                 workflows/plan-graph.js
check F9 'is the ANCHOR'                 agents/claim-refuter.md
check F10 'is a fake edge'               workflows/plan-graph.js
check F11 'not an investigator with no findings' workflows/plan-graph.js
check F11 'Never count silence as agreement' workflows/plan-graph.js
check F11 'not a specialist with no decisions' workflows/plan-graph.js
check F13 'write to a slice it does not own is discarded' workflows/plan-graph.js
check F13 'Anything you write to a slice you do not own is' workflows/plan-graph.js

# The manifest must document every rule the checker enforces, and vice versa.
declared=$(grep -cE '^## F[0-9]+ ' FROZEN.md 2>/dev/null || echo 0)
enforced=$(grep -oE '^check F[0-9]+' "$SELF" | sort -u | wc -l | tr -d ' ')
echo
if [ "$declared" != "$enforced" ]; then
  echo "  DRIFT: FROZEN.md declares $declared rules, this script enforces $enforced"
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  echo
  echo "FROZEN RULE BROKEN."
  echo "Either restore the rule, or - if you reworded it deliberately - update the"
  echo "MARKER in FROZEN.md and this script in the SAME commit, with a note saying why."
  exit 1
fi
echo "All frozen rules present."
