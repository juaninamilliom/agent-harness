#!/bin/bash
# Advisory: is this diff worth a graph review?
#
# WHY THIS IS DELIBERATELY PERMISSIVE
# ------------------------------------
# The first version of this gate scored risk by keyword (money / auth / state /
# db markers in changed lines). Measured against a real 22-file React diff it
# reported "USE THE LOOP - no markers". The graph then found three money-scope
# bugs in that same diff, including a Send button that always 400s
# SIDE_NOT_FUNDED with no control on screen able to fix it - because the
# frontend gate had diverged from the backend's unconditional escrow check.
#
# The risk was STRUCTURAL, not LEXICAL. No keyword scan can see "this UI gate no
# longer matches the server's enforcement". A keyword gate would have
# suppressed the most valuable finding of the run.
#
# So this gate no longer scores risk by keyword. It does two things:
#
#   1. MANDATORY tier - matches FILE PATHS, not words in changed lines. A path
#      like src/services/wallet.service.ts is unambiguous in a way that `state`
#      or `role` never was. Wallets, funding and provider switching are where
#      this codebase loses money, so those diffs always get the graph.
#   2. Otherwise it only rejects diffs incapable of carrying a bug, and advises
#      rather than blocks.
#
# Usage:  risk-gate.sh <component-dir> [base-ref]
# Exit 0 = run the graph. Exit 1 = trivial, the loop is enough.
# Exit 0 + "MANDATORY" = do not skip this one.

set -uo pipefail
DIR="${1:?usage: risk-gate.sh <component-dir> [base-ref]}"
cd "$DIR" || { echo "no such dir: $DIR" >&2; exit 2; }

# Default base ref, in priority order (an explicit [base-ref] argument always wins -
# see BASE below, which only falls back to this when $2 is absent). Every step here is
# LOCAL ONLY - no `git remote show origin`, which hits the network. This gate has to
# stay fast and safe to run offline.
#   (a) an "Integration branch" declared in this repo's CLAUDE.md - checked here and
#       one directory up, since a multi-repo layout keeps the project CLAUDE.md above
#       each component's own git root (the component itself rarely has its own).
#   (b) the remote's recorded default branch, read from the LOCAL remote-tracking ref
#       (`git symbolic-ref` - no network) rather than `git remote show origin`
#       (contacts the remote).
#   (c) "main".
declared_branch() { # declared_branch <claude-md-path> - prints a branch name, or nothing
  local md="$1" block name
  [ -f "$md" ] || return 0
  # A "## Integration branch" heading commonly carries the name on a LATER line
  # (a backtick block under the heading), not the matched line itself - so pull a
  # few lines of context, not just the one line that matched.
  block=$(grep -im1 -A3 'integration branch' "$md") || return 0
  name=$(printf '%s\n' "$block" | grep -oE '`[^`]+`' | head -1 | tr -d '`')
  if [ -z "$name" ]; then
    name=$(printf '%s\n' "$block" | grep -im1 'integration branch' | sed -E 's/.*[Ii]ntegration [Bb]ranch[^:]*:[[:space:]]*//' | sed -E 's/[^A-Za-z0-9_.\/-].*//')
  fi
  printf '%s' "$name"
}
GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
DEFAULT_BRANCH=""
if [ -n "$GIT_ROOT" ]; then
  DEFAULT_BRANCH="$(declared_branch "$GIT_ROOT/CLAUDE.md")"
  [ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH="$(declared_branch "$GIT_ROOT/../CLAUDE.md")"
fi
if [ -z "$DEFAULT_BRANCH" ]; then
  DEFAULT_BRANCH="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')"
fi
[ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH="main"

BASE="${2:-origin/$DEFAULT_BRANCH}"

FILES=$(git diff --name-only "$BASE"...HEAD 2>/dev/null || git diff --name-only "$BASE" 2>/dev/null)
[ -z "$FILES" ] && { echo "NO DIFF vs $BASE"; exit 1; }

NFILES=$(printf '%s\n' "$FILES" | grep -c . || true)
PROD=$(printf '%s\n' "$FILES" | grep -vE '__tests__|\.test\.|\.spec\.|__mocks__' || true)
NPROD=$(printf '%s\n' "$PROD" | grep -c . || true)
SUBSTANTIVE=$(printf '%s\n' "$PROD" | grep -vE '\.(md|css|scss|svg|png|jpe?g|ico|txt|lock)$|^docs/' || true)
NSUB=$(printf '%s\n' "$SUBSTANTIVE" | grep -c . || true)
ADDED=$(git diff "$BASE"...HEAD --numstat 2>/dev/null | awk '{s+=$1} END {print s+0}')

echo "files=$NFILES prod=$NPROD substantive=$NSUB added_lines=$ADDED"

# ---------------------------------------------------------------------------
# MANDATORY TIER - path-based. These are the surfaces that strand real funds.
# Evidence: a 22-file review of wallet-provider switching hid three fund-loss
# criticals - a wallet handed the wrong key type for its chain, deposit/withdraw
# silently skipping a required readiness check so funds stranded in the wrong
# asset, and agents funded but left unable to trade. A separate 19-file frontend
# review of a funding panel hid three money-scope bugs that a keyword scan
# scored as "no markers".
# ---------------------------------------------------------------------------
MAND=""
printf '%s\n' "$SUBSTANTIVE" | grep -qiE '(^|/)[^/]*wallet' && MAND="$MAND wallets"
printf '%s\n' "$SUBSTANTIVE" | grep -qiE 'fund|deposit|withdraw|onramp|escrow|collateral|sweep|payout|refund|invoice|charge' && MAND="$MAND funding"
printf '%s\n' "$SUBSTANTIVE" | grep -qE 'db/migrations/' && MAND="$MAND migrations"

# Project-specific mandatory-tier patterns: label<TAB>regex per line.
PATTERNS_FILE="$(git rev-parse --show-toplevel 2>/dev/null)/.claude/risk-patterns.txt"
if [ -f "$PATTERNS_FILE" ]; then
  while IFS=$'\t' read -r label regex; do
    case "$label" in ''|'#'*) continue;; esac
    printf '%s\n' "$SUBSTANTIVE" | grep -qiE "$regex" && MAND="$MAND $label"
  done < "$PATTERNS_FILE"
fi

MAND=$(echo "$MAND" | tr -s ' ' | sed 's/^ //;s/ $//')
if [ -n "$MAND" ]; then
  echo "mandatory:$MAND"
  echo "VERDICT: GRAPH MANDATORY - touches $MAND. Do not skip; this is where funds strand."
  exit 0
fi

if [ "$NPROD" -eq 0 ];  then echo "VERDICT: LOOP - tests only, no production code"; exit 1; fi
if [ "$NSUB"  -eq 0 ];  then echo "VERDICT: LOOP - docs/styling/assets only"; exit 1; fi
if [ "$NSUB"  -le 2 ] && [ "${ADDED:-0}" -le 60 ]; then
  echo "VERDICT: LOOP - $NSUB substantive file(s), $ADDED added lines; too narrow to fan out"; exit 1
fi

# Everything else: the graph can pay for itself. Report what raises the stakes,
# as CONTEXT for the reviewer - never as the thing that decides.
CTX=""
printf '%s\n' "$SUBSTANTIVE" | grep -qE 'db/migrations/' && CTX="$CTX migrations"
printf '%s\n' "$SUBSTANTIVE" | grep -qiE 'auth|wallet|treasury|charge|payout|invoice|withdraw' && CTX="$CTX money-or-auth-paths"
[ "$NSUB" -ge 10 ] && CTX="$CTX wide($NSUB-files)"
# Cross-surface changes are where FE/BE divergence bugs live - the class the
# keyword gate missed entirely.
printf '%s\n' "$SUBSTANTIVE" | grep -qE '\.(tsx|jsx)$' && printf '%s\n' "$SUBSTANTIVE" | grep -qE 'services/|routes/|controllers/' && CTX="$CTX ui+server-in-one-diff"

echo "context:${CTX:- none}"
echo "VERDICT: GRAPH WORTHWHILE"
exit 0
