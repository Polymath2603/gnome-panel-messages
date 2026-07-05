#!/bin/bash
# install.sh — Install Panel Messages GNOME extension and CLI command.
# Run from anywhere:  ~/Workplace/gnome-panel-messages/install.sh

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
EXT_UUID="panel-messages@leonardo.local"
EXT_TARGET="$HOME/.local/share/gnome-shell/extensions/$EXT_UUID"
SCHEMA_TARGET="$HOME/.local/share/glib-2.0/schemas"
CLI_TARGET="$HOME/.local/bin/panel-message"

echo "=== Panel Messages — Install ==="

# 1) GSettings schema (for gsettings CLI to find it)
echo "[1/4] Installing GSettings schema …"
mkdir -p "$SCHEMA_TARGET"
cp "$REPO_DIR/schemas/org.gnome.shell.extensions.panel-messages.gschema.xml" "$SCHEMA_TARGET/"
glib-compile-schemas "$SCHEMA_TARGET/"

# 2) Symlink extension (edits in repo are live after shell restart)
echo "[2/4] Installing extension (symlink) …"
rm -f "$EXT_TARGET" 2>/dev/null; rm -rf "$EXT_TARGET" 2>/dev/null
ln -s "$REPO_DIR" "$EXT_TARGET"

# 3) CLI command
echo "[3/4] Installing CLI …"
cp "$REPO_DIR/bin/panel-message" "$CLI_TARGET"
chmod +x "$CLI_TARGET"

# 4) Verify
echo "[4/4] Verifying …"
echo -n "  Schema: "
gsettings list-schemas | grep -q panel-messages && echo "✓" || echo "✗"
echo -n "  CLI:    "
which panel-message &>/dev/null && echo "✓" || echo "✗"
echo -n "  Ext:    "
[ -L "$EXT_TARGET" ] && echo "✓ Symlinked → $REPO_DIR" || echo "✗"

echo ""
echo "✅ Panel Messages installed!"
echo ""
echo "To enable:     gnome-extensions enable $EXT_UUID"
echo "To configure:  gnome-extensions prefs $EXT_UUID"
echo "To test:       panel-message \"Hello\""
echo ""
echo "ℹ️  After enabling you may need to restart GNOME Shell (Alt+F2, r)"
