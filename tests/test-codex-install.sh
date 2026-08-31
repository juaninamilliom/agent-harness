#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
SB=$(mktemp -d); trap 'rm -rf "$SB"' EXIT
fail=0; chk() { if eval "$2"; then echo "  ok  $1"; else echo "  FAIL $1"; fail=1; fi; }

./codex/install.sh "$SB/codex" > "$SB/install.log" 2>&1
chk "prompts installed"        'test -f "$SB/codex/prompts/plan.md" && test -f "$SB/codex/prompts/worktree.md"'
chk "AGENTS.md installed"      'test -s "$SB/codex/AGENTS.md" && grep -q "Read the code first" "$SB/codex/AGENTS.md"'
chk "config not touched"       '! test -f "$SB/codex/config.toml"'

printf 'my own agents file\n' > "$SB/codex/AGENTS.md"
./codex/install.sh "$SB/codex" > "$SB/install2.log" 2>&1
chk "existing AGENTS.md kept"  'grep -q "my own agents file" "$SB/codex/AGENTS.md" && grep -qi "kept" "$SB/install2.log"'
exit $fail
