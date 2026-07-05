---
name: panel-messages
description: Use the Panel Messages GNOME extension to display progress/status in the top panel from background tasks, builds, cron jobs, and subagent delegations.
category: productivity
trigger: When you need to show a user what a background process is doing without interrupting them with a notification.
---

# Panel Messages — Hermes Agent Skill

The user has a **GNOME Shell extension** called **Panel Messages** at `~/Workplace/gnome-panel-messages/` that shows a customisable text label in the top GNOME panel. It's controlled by a CLI command `panel-message`.

## When to use this

**Instead of** sending a chat message saying "task X is done", call `panel-message` to update the panel. The user sees it at a glance without being interrupted.

Good for:
- Long-running builds or tests
- Background subagent delegations (`delegate_task`)
- cron jobs that need to signal progress
- Any multi-step pipeline where you want to show "step N of M"

## CLI Usage

```bash
panel-message "text"                          # Set message
panel-message -q "text"                       # Set silently (no stdout)
panel-message -c                              # Clear
panel-message --alert "text"                  # Set + flash red bold
panel-message --alert=#ff8800 "warning text"  # Alert with custom colour
panel-message --color=green --bold "done ✓"   # Persistent style
panel-message --position=center               # Move panel indicator
panel-message --index=5                       # Change ordering
panel-message --style                         # Show current settings
```

## Patterns

### Pipeline progress (step-by-step from a single task)

```bash
panel-message -q "🔧 Step 1/3: preparing…"
do_step_1
panel-message -q "🔧 Step 2/3: processing…"
do_step_2
panel-message -q "🔧 Step 3/3: finishing…"
do_step_3
panel-message -q "✅ Done" --color=green
```

### From a background subagent

After dispatching a `delegate_task`, the parent can leave a panel message so the user knows something is running:

```bash
panel-message -q "📄 Extracting facts from 6 files…"
delegate_task goal="fact extraction" ...
panel-message -q "✅ Extraction complete" --color=green
```

### From a cron job

In a cron job's prompt, include a `panel-message` call in the final instruction so the panel updates when the job runs.

## Extension details

- **Location**: `~/Workplace/gnome-panel-messages/`
- **UUID**: `panel-messages@leonardo.local`
- **GSettings schema**: `org.gnome.shell.extensions.panel-messages`
- The extension watches GSettings `changed::*` signals — any `panel-message` call updates the panel live, no shell restart needed for message/style changes
- Using `--alert` increments a counter; the extension detects the delta and runs a Clutter fade animation

## Troubleshooting

- If the panel shows nothing: call `panel-message "test"` — the default is empty and placeholder only shows `—`
- If gsettings schema not found: run `glib-compile-schemas ~/.local/share/glib-2.0/schemas/`
- If the CLI command isn't found: `cp ~/Workplace/gnome-panel-messages/bin/panel-message ~/.local/bin/panel-message`
