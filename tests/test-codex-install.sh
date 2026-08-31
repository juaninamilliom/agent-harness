#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
SB=$(mktemp -d); trap 'rm -rf "$SB"' EXIT
fail=0; chk() { if eval "$2"; then echo "  ok  $1"; else echo "  FAIL $1"; fail=1; fi; }

# Containment baseline: the real $HOME/.agents directory (a sibling of ~/.codex) must be
# unaffected by a sandboxed install - captured before any install.sh call, compared after.
# Guarded (count, not existence) so this still passes on a machine where ~/.agents
# legitimately exists already.
real_agents_before=$(ls ~/.agents 2>/dev/null | wc -l | tr -d ' ') || real_agents_before=0

./codex/install.sh "$SB/codex" > "$SB/install.log" 2>&1
chk "prompts installed"        'test -f "$SB/codex/prompts/plan.md" && test -f "$SB/codex/prompts/worktree.md"'
chk "AGENTS.md installed"      'test -s "$SB/codex/AGENTS.md" && grep -q "Read the code first" "$SB/codex/AGENTS.md"'
chk "config not touched"       '! test -f "$SB/codex/config.toml"'
chk "skills installed"         'test -f "$SB/.agents/skills/harness-plan/SKILL.md"'
chk "all five protocol skills" '[ "$(find "$SB/.agents/skills" -name SKILL.md | wc -l | tr -d " ")" = "5" ]'

printf 'my own agents file\n' > "$SB/codex/AGENTS.md"
./codex/install.sh "$SB/codex" > "$SB/install2.log" 2>&1
chk "existing AGENTS.md kept"  'grep -q "my own agents file" "$SB/codex/AGENTS.md" && grep -qi "kept" "$SB/install2.log"'

real_agents_after=$(ls ~/.agents 2>/dev/null | wc -l | tr -d ' ') || real_agents_after=0
chk "real ~/.agents untouched" '[ "$real_agents_before" = "$real_agents_after" ]'

exit $fail
