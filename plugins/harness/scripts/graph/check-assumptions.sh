#!/bin/bash
# Run the assumption checks an architect declared, mechanically.
#
# This is /plan's ANCHOR. Architects propose; this decides whether what they assumed
# actually exists. No model judgment - the shell answers.
#
# Input: JSON array on stdin or in a file:
#   [ { "id": "A1", "claim": "Account has a decimals column",
#       "check": "grep -q decimalsPlaces server/src/db/models/Account.ts" } ]
#
# SAFETY: `check` strings are AGENT-GENERATED. Only read-only commands are permitted;
# anything else is refused, not run. An architect cannot make its own assumption pass
# by writing the file it claims to find.
#
# Usage:  check-assumptions.sh [file.json] [repo-root]
# Exit 0 = all assumptions hold. 1 = at least one fails or was refused.

set -uo pipefail
SRC="${1:--}"; ROOT="${2:-$(pwd)}"
# A leading `!` is negation, not a command - `! grep -q x file` is still read-only.
ALLOWED='^[[:space:]]*!?[[:space:]]*(grep|rg|ls|test|git (ls-files|grep|log|show|diff)|find)[[:space:]]'

json=$([ "$SRC" = "-" ] && cat || cat "$SRC")
cd "$ROOT" || { echo "no such dir: $ROOT" >&2; exit 2; }

FAIL=0; N=0
while IFS=$'\t' read -r id claim check; do
  [ -z "${id:-}" ] && continue
  N=$((N+1))
  if ! printf '%s' "$check" | grep -qE "$ALLOWED"; then
    printf '  %-5s REFUSED   %s\n' "$id" "$claim"
    printf '        not a read-only command: %s\n' "$check"
    FAIL=1; continue
  fi
  # Run in a subshell with `set +u`: a check is AGENT-WRITTEN and may reference an
  # unset variable or be malformed. Under `set -u` that killed the whole run after the
  # last passing check, silently truncating the report - a check that cannot run must
  # fail ITSELF, never take the others with it.
  if ( set +u +o pipefail; eval "$check" ) >/dev/null 2>&1; then
    printf '  %-5s HOLDS     %s\n' "$id" "$claim"
  else
    printf '  %-5s FAILS     %s\n' "$id" "$claim"
    printf '        check did not hold (non-zero, or unrunnable): %s\n' "$check"
    FAIL=1
  fi
done < <(printf '%s' "$json" | python3 -c '
import json,sys
try: a=json.load(sys.stdin)
except Exception as e: sys.exit(f"bad JSON: {e}")
for x in a: print("\t".join([str(x.get("id","?")), str(x.get("claim",""))[:70], str(x.get("check",""))]))
')

echo
if [ "$FAIL" -ne 0 ]; then
  echo "ASSUMPTIONS BROKEN — this plan rests on things that are not there."
  echo "Do not synthesize until every failing assumption is corrected or dropped."
  exit 1
fi
echo "All $N assumptions hold."
