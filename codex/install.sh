#!/bin/bash
# Install the harness Codex port into a Codex home (default ~/.codex).
#
# Docs check (Task 8 Step 1 findings, verified 2026-08-31 against
# developers.openai.com/codex, which 308-redirects to learn.chatgpt.com/docs,
# and openai/codex on GitHub):
#   (a) Custom prompts live at <codex-home>/prompts/*.md (top-level files
#       only, no subdirectories scanned). Frontmatter: `description:` and
#       `argument-hint:`. Body placeholders: $1..$9 positional, $ARGUMENTS
#       for all args, $NAME for KEY=value named args, $$ for a literal `$`.
#       Invoked as /prompts:<name>. Source: developers.openai.com/codex/custom-prompts.
#       NOTE: this page also states "Custom prompts are deprecated. Use
#       skills for reusable prompts" - prompts still work and are installed
#       below since the sandbox test requires <codex-home>/prompts/*.md, but
#       skills (below) are the currently-recommended surface.
#   (b) Agent Skills (SKILL.md) ARE supported. Minimal frontmatter is
#       `name:` + `description:` only (no argument-hint - skills are
#       triggered by name/description matching, not positional args).
#       Confirmed search path is $HOME/.agents/skills for user-level skills
#       (repo-level: .agents/skills walked from cwd to repo root; admin:
#       /etc/codex/skills) - NOT <codex-home>/skills. This machine's
#       ~/.codex/skills/ (empty) is not a path the current docs recognize;
#       treated as vestigial, not the real skills directory. Source:
#       developers.openai.com/codex/skills. Because the real skills path is
#       $HOME-relative rather than codex-home-relative, this installer
#       derives it as the ".agents/skills" directory that sits next to
#       whatever directory was passed as [codex-home] - i.e. dirname of the
#       codex-home argument - so a sandboxed install (temp dir as
#       codex-home) never writes outside that temp dir, while the real
#       default ($HOME/.codex) resolves to the real $HOME/.agents/skills.
#   (c) config.toml: `approval_policy` accepts "untrusted" | "on-request" |
#       "never" | a granular object; `sandbox_mode` accepts "read-only" |
#       "workspace-write" | "danger-full-access"; per-project trust is
#       `projects."<path>".trust_level` = "trusted" | "untrusted" (this key
#       matches what this machine's real ~/.codex/config.toml already has).
#       Source: developers.openai.com/codex/config-file/config-reference.
#       codex/config.suggested.toml uses on-request/workspace-write, both
#       confirmed current and valid.
#
# Usage: install.sh [codex-home]
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-$HOME/.codex}"
mkdir -p "$TARGET/prompts"
for p in "$REPO"/codex/protocols/*.md; do
  cp "$p" "$TARGET/prompts/$(basename "$p")"
done
echo "protocols installed: $(ls "$REPO"/codex/protocols/*.md | wc -l | tr -d ' ') prompts"

# Skills support confirmed (see docs check above): also install each
# protocol as a skill, at $HOME/.agents/skills (a sibling of codex-home, not
# a child of it - see finding (b)). Frontmatter is rewritten from the
# prompt's description/argument-hint pair down to the SKILL.md minimum of
# name + description; the argument-hint line and $ARGUMENTS-style body
# placeholders are left as-is in the body text since they still read fine
# as instructions even though skills have no positional-arg mechanism.
strip_frontmatter() { # prints a file's body after its closing --- line
  awk 'BEGIN{n=0} /^---$/{n++; next} n<2{next} {print}' "$1"
}
SKILLS_HOME="$(dirname "$TARGET")/.agents/skills"
mkdir -p "$SKILLS_HOME"
skills_installed=0
for p in "$REPO"/codex/protocols/*.md; do
  name="$(basename "$p" .md)"
  desc="$(sed -n 's/^description: *//p' "$p" | head -1)"
  skill_dir="$SKILLS_HOME/harness-$name"
  mkdir -p "$skill_dir"
  {
    echo "---"
    echo "name: harness-$name"
    echo "description: $desc"
    echo "---"
    strip_frontmatter "$p"
  } > "$skill_dir/SKILL.md"
  skills_installed=$((skills_installed + 1))
done
echo "skills installed: $skills_installed (at $SKILLS_HOME)"

if [ -s "$TARGET/AGENTS.md" ] && ! grep -q "Read the code first" "$TARGET/AGENTS.md"; then
  echo "existing AGENTS.md kept - merge $REPO/codex/AGENTS.global.md by hand"
else
  cp "$REPO/codex/AGENTS.global.md" "$TARGET/AGENTS.md"
  echo "AGENTS.md installed"
fi
echo ""
echo "config.toml is never modified - review codex/config.suggested.toml and paste what you want"
