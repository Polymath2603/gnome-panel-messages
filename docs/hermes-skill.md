---
name: panel-messages
description: Update the GNOME panel label from background tasks instead of sending the user a notification or chat message.
category: productivity
trigger: When a background process finishes, a build step completes, or you want to show progress without interrupting the user.
---

# Panel Messages

A CLI command `panel-message` that sets a text label in the GNOME top panel. Use it instead of sending the user a chat message — they see it at a glance without being interrupted.

## When to use

- Long builds, tests, or pipelines → `panel-message -q "step 2/5"`
- Background subagent finishes → `panel-message -q "✅ extraction done" --color=green`
- cron job progress → `panel-message -q "⏰ job running"`
- Important event → `panel-message --alert "check this"`

## Commands (run via terminal)

```bash
panel-message "text"                          # Set message
panel-message -q "text"                       # Quiet (no stdout, for scripts)
panel-message -c                              # Clear
panel-message --alert "text"                  # Set + red flash
panel-message --color=green --bold "done ✓"   # Styled
panel-message --position=center               # Move panel position
panel-message --style                         # Show current settings
```
