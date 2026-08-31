#!/bin/bash
# Sandbox test for global/install.sh + doctor.sh. No network, never touches real ~/.claude.
set -euo pipefail
cd "$(dirname "$0")/.."
SB=$(mktemp -d); trap 'rm -rf "$SB"' EXIT
fail=0; chk() { if eval "$2"; then echo "  ok  $1"; else echo "  FAIL $1"; fail=1; fi; }

# Seed a fake existing ~/.claude with one user permission and a stray agent
mkdir -p "$SB/claude/agents"
printf '{"permissions":{"allow":["Bash(mycmd:*)"],"deny":[]},"model":"opus"}' > "$SB/claude/settings.json"
touch "$SB/claude/agents/code-architect.md"

./global/install.sh "$SB/claude" > "$SB/install.log" 2>&1

chk "settings backup created"           'ls "$SB"/claude/settings.json.bak-* >/dev/null 2>&1'
chk "user permission preserved"         'jq -e ".permissions.allow | index(\"Bash(mycmd:*)\")" "$SB/claude/settings.json" >/dev/null'
chk "fragment permission merged"        'jq -e ".permissions.allow | index(\"Bash(npx tsc:*)\")" "$SB/claude/settings.json" >/dev/null'
chk "deny merged"                       'jq -e ".permissions.deny | length == 3" "$SB/claude/settings.json" >/dev/null'
chk "user model key untouched"          'jq -e ".model == \"opus\"" "$SB/claude/settings.json" >/dev/null'
chk "hooks config present"              'jq -e ".hooks.Stop" "$SB/claude/settings.json" >/dev/null'
chk "plugin enabled"                    'jq -e ".enabledPlugins[\"harness@agent-harness\"] == true" "$SB/claude/settings.json" >/dev/null'
chk "hook files linked"                 'test -L "$SB/claude/hooks/notify-ready.sh" && test -x "$SB/claude/hooks/notify-ready.sh"'
chk "keybindings installed"             'test -f "$SB/claude/keybindings.json"'
chk "stray agent flagged not deleted"   'test -f "$SB/claude/agents/code-architect.md" && grep -q "stray agent" "$SB/install.log"'

./global/install.sh "$SB/claude" > "$SB/install2.log" 2>&1
chk "idempotent: no duplicate allow"    '[ "$(jq -r ".permissions.allow | index(\"Bash(npx tsc:*)\")" "$SB/claude/settings.json")" != "null" ] && [ "$(jq "[.permissions.allow[] | select(. == \"Bash(npx tsc:*)\")] | length" "$SB/claude/settings.json")" = "1" ]'

./global/install.sh --prune "$SB/claude" > /dev/null 2>&1
chk "prune removes stray agent"         '! test -f "$SB/claude/agents/code-architect.md"'

./global/doctor.sh "$SB/claude" > "$SB/doctor.log" 2>&1
chk "doctor healthy after install"      '[ $? -eq 0 ] || grep -q "healthy" "$SB/doctor.log"'

exit $fail
