#!/bin/bash
# Merge the harness global layer into a Claude Code home dir. Never overwrites
# user state: permissions are unioned, config keys set only if absent, hooks
# are symlinked, settings.json is backed up first.
# Usage: install.sh [--prune] [target-dir]   (default target: ~/.claude)
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PRUNE=0
if [ "${1:-}" = "--prune" ]; then PRUNE=1; shift; fi
TARGET="${1:-$HOME/.claude}"
mkdir -p "$TARGET/hooks"
SETTINGS="$TARGET/settings.json"
[ -f "$SETTINGS" ] || printf '{}' > "$SETTINGS"
cp "$SETTINGS" "$SETTINGS.bak-$(date +%Y%m%d-%H%M%S)"

python3 - "$SETTINGS" "$REPO/global/settings.fragment.json" "$REPO" <<'PY'
import json, sys
settings_path, fragment_path, repo = sys.argv[1], sys.argv[2], sys.argv[3]
s = json.load(open(settings_path)); f = json.load(open(fragment_path))
perms = s.setdefault("permissions", {})
for key in ("allow", "deny"):
    have = perms.setdefault(key, [])
    for entry in f["permissions"].get(key, []):
        if entry not in have:
            have.append(entry)
# hooks / statusLine: set only if the user has none (never clobber their config)
for key in ("hooks", "statusLine"):
    if key in f and key not in s:
        s[key] = f[key]
# enabledPlugins is a map on current installs but documented as an array - handle both
ep = s.get("enabledPlugins")
if isinstance(ep, list):
    if "harness@agent-harness" not in ep:
        ep.append("harness@agent-harness")
else:
    s.setdefault("enabledPlugins", {})["harness@agent-harness"] = True
json.dump(s, open(settings_path, "w"), indent=2)
print("settings merged")
PY

# Marketplace registration: the CLI writes the canonical settings shape, so use it
# for the real config; sandbox targets (tests) skip it.
if [ "$TARGET" = "$HOME/.claude" ]; then
  if command -v claude >/dev/null 2>&1; then
    claude plugin marketplace add "$REPO" || true   # no-op/err if already known
    claude plugin install harness@agent-harness || true
  else
    echo "claude CLI not found - marketplace registration skipped; install the CLI and re-run"
  fi
else
  echo "sandbox target: skipped marketplace registration (CLI writes real config only)"
fi

for h in "$REPO"/global/hooks/*.sh; do
  name="$(basename "$h")"
  dest="$TARGET/hooks/$name"
  if [ -e "$dest" ] && [ ! -L "$dest" ]; then mv "$dest" "$dest.bak"; fi
  ln -sfn "$h" "$dest"
done
[ -f "$TARGET/keybindings.json" ] || cp "$REPO/global/keybindings.json" "$TARGET/keybindings.json"

# Stray user-level agents that duplicate the plugin's (would shadow/confuse)
for a in code-architect.md ai-systems-architect.md; do
  if [ -f "$TARGET/agents/$a" ]; then
    if [ "$PRUNE" = 1 ]; then rm "$TARGET/agents/$a"; echo "pruned stray agent: $a"
    else echo "stray agent (duplicate of plugin agent) - rerun with --prune to remove: $a"; fi
  fi
done
echo "global layer installed into $TARGET"
