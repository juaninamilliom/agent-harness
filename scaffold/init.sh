#!/bin/bash
# Stamp the harness project layer into a project. One-time: every stamped
# file becomes project-owned; this script never overwrites anything.
# Usage: init.sh <project-dir> [project-name]
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PROJ="${1:?usage: init.sh <project-dir> [project-name]}"
PROJ="$(cd "$PROJ" && pwd)"
NAME="${2:-$(basename "$PROJ")}"
stamped=0
stamp() { # stamp <src> <dest>
  if [ -e "$2" ]; then echo "  exists, skipped: $2"; else
    mkdir -p "$(dirname "$2")"
    sed "s/__PROJECT_NAME__/$(printf '%s' "$NAME" | sed 's/[&/\]/\\&/g')/g" "$1" > "$2"
    echo "  stamped: $2"; stamped=$((stamped+1))
  fi
}
echo "Stamping harness project layer into $PROJ (project: $NAME)"
stamp "$REPO/scaffold/CLAUDE.template.md"                       "$PROJ/CLAUDE.md"
stamp "$REPO/scaffold/settings.json"                            "$PROJ/.claude/settings.json"
stamp "$REPO/scaffold/settings.local.json"                      "$PROJ/.claude/settings.local.json"
stamp "$REPO/scaffold/agents/_domain-architect.template.md"     "$PROJ/.claude/agents/_domain-architect.template.md"
stamp "$REPO/scaffold/skills/_env-verify.template/SKILL.md"     "$PROJ/.claude/skills/_env-verify.template/SKILL.md"
stamp "$REPO/scaffold/risk-patterns.txt.example"                "$PROJ/.claude/risk-patterns.txt.example"
echo ""
echo "Done ($stamped files). Next:"
echo "  1. Fill every <!-- FILL --> in $PROJ/CLAUDE.md (components, branches, worktree table)"
echo "  2. Create domain architects from the _domain-architect template; add rows to the routing table"
echo "  3. Copy _env-verify.template per environment if you have verifiable envs"
echo "  4. Commit .claude/settings.json and CLAUDE.md so teammates get the engine too"
