#!/bin/bash
# install.sh — Install Panel Messages GNOME extension, CLI, and Hermes skill.
# Run:  ./install.sh
#       or from anywhere: ~/Workplace/gnome-panel-messages/install.sh

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
EXT_UUID="panel-messages@leonardo.local"
EXT_TARGET="$HOME/.local/share/gnome-shell/extensions/$EXT_UUID"
SCHEMA_TARGET="$HOME/.local/share/glib-2.0/schemas"
CLI_TARGET="$HOME/.local/bin/panel-message"
SKILL_SOURCE="$REPO_DIR/docs/hermes-skill.md"

echo "=== Panel Messages — Install ==="

# 1) GSettings schema
echo "[1/4] Installing GSettings schema …"
mkdir -p "$SCHEMA_TARGET"
cp "$REPO_DIR/schemas/org.gnome.shell.extensions.panel-messages.gschema.xml" "$SCHEMA_TARGET/"
glib-compile-schemas "$SCHEMA_TARGET/"

# 2) Symlink extension
echo "[2/4] Installing extension (symlink) …"
rm -f "$EXT_TARGET" 2>/dev/null; rm -rf "$EXT_TARGET" 2>/dev/null
ln -s "$REPO_DIR" "$EXT_TARGET"

# 3) CLI command
echo "[3/4] Installing CLI …"
cp "$REPO_DIR/bin/panel-message" "$CLI_TARGET"
chmod +x "$CLI_TARGET"

# 4) Hermes skill (if Hermes is available)
echo "[4/4] Installing Hermes skill …"
SKILL_DIR="$HOME/.hermes/skills/productivity/panel-messages"
if command -v hermes &>/dev/null; then
    mkdir -p "$SKILL_DIR"
    cp "$SKILL_SOURCE" "$SKILL_DIR/SKILL.md"
    echo "  ✓ Skill installed at $SKILL_DIR"
else
    echo "  — Hermes not found, skill kept at $SKILL_SOURCE"
    echo "    Install later: hermes skill install $SKILL_SOURCE"
fi

# Verify
echo ""
echo "── Verification ──"
echo -n "  Schema: "; gsettings list-schemas | grep -q panel-messages && echo "✓" || echo "✗"
echo -n "  CLI:    "; which panel-message &>/dev/null && echo "✓" || echo "✗"
echo -n "  Ext:    "; [ -L "$EXT_TARGET" ] && echo "✓ Symlinked" || echo "✗"
echo -n "  Skill:  "; [ -f "$SKILL_DIR/SKILL.md" ] && echo "✓" || echo "—"

echo ""
echo "✅ Panel Messages installed!"
echo ""
echo "Enable extension:  gnome-extensions enable $EXT_UUID"
echo "Reload (no restart): gnome-extensions disable $EXT_UUID && gnome-extensions enable $EXT_UUID"
echo "Settings GUI:       gnome-extensions prefs $EXT_UUID"
echo "Test CLI:           panel-message \"Hello\""
echo ""
