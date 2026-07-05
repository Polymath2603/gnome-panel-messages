# Panel Messages — Usage Guide

## Setting the message

```bash
# Basic
panel-message "Hello from the panel!"
panel-message -q "Silent update (no stdout)"

# Read current
panel-message

# Clear
panel-message --clear
panel-message -c
```

## Styling

```bash
# Persistent colour and weight
panel-message --color=red "Red text"
panel-message --color=#00ff00 --bold "Green bold text"
panel-message --no-bold "Normal weight again"

# Just change style, keep message
panel-message --color=blue
panel-message --bold

# View current settings
panel-message --style
```

## Alert flash

Flash the message in a colour, then fade back to normal:

```bash
panel-message --alert "Something important!"
panel-message --alert=#ff8800 "Warning: disk almost full"
panel-message --alert -q "Silent alert"
```

The sequence:
1. Text turns red (or custom colour) + bold instantly
2. Holds for ~1.2 s
3. Fades out over ~0.8 s
4. Normal style restored, fades back in

## Panel position

Place the indicator anywhere in the top panel:

```bash
panel-message --position=center
panel-message --position=far-left
panel-message --position=right
panel-message --position=far-right
```

| Value | Location |
|-------|----------|
| `far-left` | Left edge (before Activities) |
| `left` | Left box, after app menu |
| `center` | Centre of the panel |
| `right` | Right box, before status icons |
| `far-right` | Far right edge (default) |

Order among items in the same zone with `--index`:

```bash
panel-message --position=center --index=2
```

## Using from background processes

The `-q` flag makes the CLI totally silent, perfect for scripts:

```bash
#!/bin/bash
# In your build script …
panel-message -q "Building: step 1 of 5"
make step1
panel-message -q "Building: step 2 of 5" --alert  # flash on failure risk
make step2
panel-message -q "Build complete ✓" --color=green
```

### With cron

```bash
# ~/.local/bin/my-cron-job.sh
panel-message -q "⏰ Cron job running"
# ... do work ...
panel-message -q "✅ Cron job done" --color=green
```

### With Hermes Agent (background delegations)

When a subagent finishes, call panel-message to update the panel:

```bash
panel-message -q "📄 Fact extraction done: $uuid"
```

## Resetting

```bash
# Clear everything back to defaults
gsettings reset org.gnome.shell.extensions.panel-messages message
gsettings reset org.gnome.shell.extensions.panel-messages color
gsettings reset org.gnome.shell.extensions.panel-messages bold
gsettings reset org.gnome.shell.extensions.panel-messages position
gsettings reset org.gnome.shell.extensions.panel-messages index
```
