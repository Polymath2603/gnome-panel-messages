# Panel Messages

A GNOME Shell extension with CLI control — show a customisable message in your top panel.

```
               ┌─────────────────────────────────────────────────────┐
    GNOME      │  Activities  File  Editor  ⋮  │  building 3/5 …  │
    Panel      │                                │      ↑ this      │
               └─────────────────────────────────────────────────────┘
                                          panel-message "building 3/5 …"
                                          your script → ─── CLI ───→ ⚡
```

**Why?** Instead of spamming notifications, your background processes (builds, tests, cron jobs) update the panel silently. One glance tells you the status.

---

## Quick start

### Install

```bash
git clone https://github.com/Polymath2603/gnome-panel-messages
cd gnome-panel-messages
./install.sh
gnome-extensions enable panel-messages@leonardo.local
```

Then restart GNOME Shell (`Alt+F2`, `r`).

### Use

```bash
panel-message "Hello world"            # set message
panel-message --alert "URGENT"         # set + flash red bold
panel-message --color=red --bold "⚠️"  # persistent styling
panel-message -c                       # clear
panel-message --help                   # full usage
```

---

## Features

| Feature | CLI | Panel (click) | Settings GUI |
|---------|:---:|:-------------:|:------------:|
| Set message text | ✅ | ✅ (popup entry) | — |
| Persistent colour + bold | ✅ | — | ✅ |
| Alert flash (red bold → fade) | ✅ | — | — |
| Panel position (5 zones) | ✅ | — | ✅ |
| Ordering index | ✅ | — | ✅ |
| Default/placeholder text | ✅ | — | ✅ |
| Quiet mode (no stdout) | ✅ | — | — |

---

## CLI reference

```
panel-message "text"                     Set message
panel-message -c, --clear                Clear message
panel-message --alert[=color] "text"     Set + flash alert
panel-message --color=red --bold "text"  Set with styling
panel-message --position=center          Change panel zone
panel-message --index=3                  Change order
panel-message --default-text="⋮"        Change placeholder
panel-message --style                    Show all settings
panel-message -q "text"                  Set silently (for scripts)
```

See [docs/guide.md](docs/guide.md) for detailed examples.

---

## Settings

Configured via **GSettings** (`org.gnome.shell.extensions.panel-messages`) or the GNOME Extensions app.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `message` | string | `""` | Current message text |
| `default-text` | string | `"—"` | Fallback when message is empty |
| `position` | string | `"far-right"` | Panel zone: `far-left`, `left`, `center`, `right`, `far-right` |
| `index` | int | `0` | Ordering within the panel zone |
| `color` | string | `""` | CSS colour (empty = theme default) |
| `bold` | bool | `false` | Bold text |
| `alert` | int | `0` | Trigger counter (incremented by CLI) |
| `alert-color` | string | `"#ff3333"` | Colour used during alert flash |
| `alert-duration` | double | `2.0` | Alert flash duration in seconds |

---

## Why not notifications?

| | Notifications | Panel Messages |
|---|---|---|
| Interrupts workflow | ✅ Yes — steals focus | ❌ No — just sits there |
| Needs dismissal | ✅ Yes | ❌ No |
| Works for cron/scripts | Requires DBus or notify-send | ✅ Native `gsettings` |
| Persistent progress | Disappears after timeout | ✅ Stays until changed |
| Visible at a glance | Need to open notification shade | ✅ Always in panel |

---

## Project structure

```
gnome-panel-messages/
├── extension.js          # GNOME Shell extension
├── metadata.json         # Extension metadata
├── prefs.js              # Settings GUI
├── stylesheet.css        # Panel popup styling
├── schemas/
│   ├── gschema.xml       # GSettings schema definition
│   └── gschemas.compiled # Compiled schema binary
├── bin/
│   └── panel-message     # CLI command
├── install.sh            # One-command installer (ext + CLI + Hermes skill)
├── docs/
│   ├── guide.md          # Usage guide
│   ├── hermes-skill.md   # Hermes Agent skill (installed automatically)
│   └── development.md    # Development notes
└── README.md
```

## Hermes Agent skill

The repo includes a Hermes skill at `docs/hermes-skill.md`. When you run `install.sh`, it's automatically placed into `~/.hermes/skills/productivity/panel-messages/SKILL.md` so Hermes knows to use `panel-message` for background-progress updates instead of sending you chat messages.

To install manually:
```bash
mkdir -p ~/.hermes/skills/productivity/panel-messages
cp docs/hermes-skill.md ~/.hermes/skills/productivity/panel-messages/SKILL.md
```

---

## Licence

GPL-2.0-or-later
