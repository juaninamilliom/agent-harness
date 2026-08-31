#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
SB=$(mktemp -d); trap 'rm -rf "$SB"' EXIT
fail=0; chk() { if eval "$2"; then echo "  ok  $1"; else echo "  FAIL $1"; fail=1; fi; }

mkdir -p "$SB/proj"; git -C "$SB/proj" init -q
./scaffold/init.sh "$SB/proj" "My Project" > "$SB/init.log" 2>&1

chk "CLAUDE.md stamped"            'test -f "$SB/proj/CLAUDE.md"'
chk "project name substituted"     'grep -q "My Project" "$SB/proj/CLAUDE.md"'
chk "hard gate present"            'grep -q "STOP: Read This First" "$SB/proj/CLAUDE.md"'
chk "fill markers present"         'grep -q "<!-- FILL" "$SB/proj/CLAUDE.md"'
chk "settings enable plugin"       'jq -e ".enabledPlugins[\"harness@agent-harness\"] == true" "$SB/proj/.claude/settings.json" >/dev/null'
chk "settings.local stamped"       'test -f "$SB/proj/.claude/settings.local.json"'
chk "domain template stamped"      'test -f "$SB/proj/.claude/agents/_domain-architect.template.md"'
chk "env-verify template stamped"  'test -f "$SB/proj/.claude/skills/_env-verify.template/SKILL.md"'
chk "risk patterns example"        'test -f "$SB/proj/.claude/risk-patterns.txt.example"'

echo "user edit" >> "$SB/proj/CLAUDE.md"
./scaffold/init.sh "$SB/proj" "My Project" > "$SB/init2.log" 2>&1 || true
chk "never overwrites owned files" 'grep -q "user edit" "$SB/proj/CLAUDE.md" && grep -qi "exists" "$SB/init2.log"'
exit $fail
