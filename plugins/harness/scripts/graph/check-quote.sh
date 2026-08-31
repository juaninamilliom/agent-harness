#!/bin/bash
# check-quote.sh <file> <line> <quote>
#
# The mechanical anchor for plan-graph's verify layer. A finding says "this VERBATIM
# quote is at file:line". The shell answers whether it is, so the refuter's verdict
# rests on something that cannot argue back.
#
#   FOUND      <file>:<line>                 quote is on the claimed line
#   NEAR       <file>:<n> (claimed <line>)   quote is within +-WINDOW lines (default 20)
#   ELSEWHERE  <file>:<n> (claimed <line>)   quote is in the file, but not near the claimed line
#   MISSING    <file>:<line>                 quote is not in the file, or the file does not exist
#
# Exit 0 for FOUND / NEAR / ELSEWHERE (the quote is real), 1 for MISSING.
# Whitespace is collapsed on both sides, so a quote that spans line-wraps or was
# copied with different indentation still matches. Nothing else is normalized: a
# paraphrase is MISSING, which is the point.
#
# Usage from a refuter (single-quote the quote; if it contains a single quote, put it
# in a variable via a heredoc first):
#   ./scripts/graph/check-quote.sh server/src/x.ts 73 'const getKeyFromRequest ='
#   Q=$(cat <<'EOF'
#   it's here
#   EOF
#   ); ./scripts/graph/check-quote.sh path 12 "$Q"
set -uo pipefail

FILE="${1:-}"; LINE="${2:-}"; QUOTE="${3:-}"; WINDOW="${WINDOW:-20}"

if [ -z "$FILE" ] || [ -z "$LINE" ] || [ -z "$QUOTE" ]; then
  echo "usage: check-quote.sh <file> <line> <quote>" >&2; exit 2
fi
if [ ! -f "$FILE" ]; then echo "MISSING $FILE:$LINE (no such file)"; exit 1; fi
case "$LINE" in ''|*[!0-9]*) echo "usage: <line> must be a positive integer" >&2; exit 2;; esac

norm() { tr -s '[:space:]' ' ' | sed 's/^ //; s/ $//'; }
Q=$(printf '%s' "$QUOTE" | norm)
if [ -z "$Q" ]; then echo "MISSING $FILE:$LINE (empty quote)"; exit 1; fi

# 1. the claimed line itself
L=$(sed -n "${LINE}p" "$FILE" | norm)
if [[ "$L" == *"$Q"* ]]; then echo "FOUND $FILE:$LINE"; exit 0; fi

# 2. a window around it, joined - catches multi-line quotes and off-by-a-few lines
S=$(( LINE > WINDOW ? LINE - WINDOW : 1 )); E=$(( LINE + WINDOW ))
W=$(sed -n "${S},${E}p" "$FILE" | norm)
if [[ "$W" == *"$Q"* ]]; then
  # locate the first line of the quote inside the window, best effort
  FIRST=$(printf '%s' "$QUOTE" | norm | cut -c1-60)
  N=$(awk -v s="$S" -v e="$E" -v needle="$FIRST" 'NR>=s && NR<=e { line=$0; gsub(/[[:space:]]+/, " ", line); if (index(line, needle)) { print NR; exit } }' "$FILE")
  echo "NEAR $FILE:${N:-?} (claimed $LINE)"; exit 0
fi

# 3. anywhere in the file
ALL=$(norm < "$FILE")
if [[ "$ALL" == *"$Q"* ]]; then
  FIRST=$(printf '%s' "$QUOTE" | norm | cut -c1-60)
  N=$(awk -v needle="$FIRST" '{ line=$0; gsub(/[[:space:]]+/, " ", line); if (index(line, needle)) { print NR; exit } }' "$FILE")
  echo "ELSEWHERE $FILE:${N:-?} (claimed $LINE)"; exit 0
fi

echo "MISSING $FILE:$LINE"; exit 1
