# Panel Messages — Development

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                  GNOME Shell Process                    │
│                                                         │
│  ┌─────────────────┐    ┌───────────────────────────┐  │
│  │   extension.js   │◄───│   GSettings (dconf)       │  │
│  │                  │    │   org.gnome.shell.ext.     │  │
│  │  St.Label (panel)│    │   panel-messages          │  │
│  │  St.Entry (popup)│    └──────────┬────────────────┘  │
│  │  Clutter anim.   │               │                   │
│  └─────────────────┘               │                   │
└────────────────────────────────────┼───────────────────┘
                                     │ gsettings CLI
                                     ▼
                          ┌────────────────────┐
                          │  bin/panel-message  │
                          │  (bash script)      │
                          └────────────────────┘
```

The extension communicates with the CLI **entirely through GSettings/dconf** — no D-Bus, no files, no IPC plumbing.

## Layout

```
gnome-panel-messages/
├── extension.js          # Main extension code
├── metadata.json         # UUID, shell versions, schema ref
├── prefs.js              # Adw preferences window
├── stylesheet.css        # Popup min-width
├── schemas/
│   ├── org.gnome.shell.extensions.panel-messages.gschema.xml
│   └── gschemas.compiled
├── bin/
│   └── panel-message     # CLI script
├── install.sh            # Installer
├── docs/
│   ├── guide.md          # User guide
│   └── development.md    # This file
└── README.md
```

## Key concepts

### GSettings as IPC

The CLI writes GSettings values; the extension watches `changed::*` signals.  
For one-shot actions (alerts) we use a **monotonic counter** — the CLI increments `alert`, the extension diffs it against the last seen value and runs the animation.

### Positioning

`enable()` reads the `position` key and places the indicator button into the appropriate `Main.panel._*Box`:

| Position | Box | Insertion |
|----------|-----|-----------|
| `far-left` | `_leftBox` | index 0 |
| `left` | `_leftBox` | user index |
| `center` | `_centerBox` | user index |
| `right` | `_rightBox` | user index |
| `far-right` | `_rightBox` | add_child (end) |

### Alert animation

1. `_runAlert()` sets `this._label.style` to red + bold instantly
2. `GLib.timeout_add()` holds for 60% of the duration
3. `Clutter.ease()` fades opacity → 0 over 20% of duration
4. On complete: restores normal style, eases opacity → 1

## Testing after changes

1. Edit files in `~/Workplace/gnome-panel-messages/`
2. Re-compile schema: `glib-compile-schemas schemas/`
3. Restart GNOME Shell: `Alt+F2` → `r`
4. Test CLI: `panel-message "test"`

Changes to `bin/panel-message` take effect immediately (no restart needed).

## GNOME Shell version support

| Shell version | Status |
|---------------|--------|
| 45, 46, 47 | Supported (original Panel Note range) |
| 48, 49, 50 | Added |
| 51+ | Untested |
