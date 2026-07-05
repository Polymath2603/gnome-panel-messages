/* extension.js
 *
 * Panel Messages — A GNOME Shell extension that shows a message in the panel.
 * The message can be updated interactively via the popup entry OR from the
 * command line with `panel-message "new text"`.
 *
 * Features:
 *   - Popup entry for interactive editing
 *   - CLI control via `panel-message` command
 *   - Configurable position (far-left, left, center, right, far-right)
 *   - Text styling (color, bold) from settings or CLI
 *   - Alert flash (red bold → fade back) triggered from CLI
 *   - All settings live-reload — no shell restart needed
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/* ───────────────────────────────────────────
 * Position constants
 * ─────────────────────────────────────────── */
const POSITIONS = ['far-left', 'left', 'center', 'right', 'far-right'];

/* ───────────────────────────────────────────
 * Indicator — the panel button + popup
 * ─────────────────────────────────────────── */
const Indicator = GObject.registerClass(
    class Indicator extends GObject.Object {
        _init(settings) {
            super._init();

            this._settings = settings;
            this._alertCount = settings.get_int('alert');
            this._normalStyle = '';

            // ---- Build the panel button ----
            this.button = new St.Button({
                style_class: 'panel-button',
                reactive: true,
                can_focus: true,
                track_hover: true,
                x_expand: false,
                y_expand: true,
            });

            // ---- Panel label ----
            this._label = new St.Label({
                text: this._displayText(settings.get_string('message')),
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
                x_align: Clutter.ActorAlign.CENTER,
            });
            this.button.add_child(this._label);

            // ---- Popup menu ----
            this._menu = new PopupMenu.PopupMenu(this.button, St.Side.TOP);
            this._menu.actor.add_style_class_name('panel-messages-menu');

            // ---- Popup entry ----
            this._entry = new St.Entry({
                text: this._displayText(settings.get_string('message')),
                can_focus: true,
                track_hover: true,
            });
            this._entry.set_primary_icon(new St.Icon({
                icon_name: 'document-edit-symbolic',
                style_class: 'popup-menu-icon',
            }));

            // Entry text-changed → update GSettings + label
            this._entry.clutter_text.connect('text-changed', () => {
                let text = this._entry.get_text();
                settings.set_string('message', text);
                this._label.text = this._displayText(text);
            });

            let popupSection = new PopupMenu.PopupMenuSection();
            popupSection.actor.add_child(this._entry);
            this._menu.addMenuItem(popupSection);
            this._menu.actor.add_style_class_name('panel-message-entry');

            // Button click → toggle popup
            this.button.connect('button-release-event', () => {
                this._menu.toggle();
            });

            // ---- Apply persistent style ----
            this._applyStyle();

            // ---- Watch GSettings changes ----
            this._signalHandles = [];

            this._signalHandles.push(settings.connect('changed::message', () => {
                let newText = settings.get_string('message');
                this._label.text = this._displayText(newText);
                this._entry.text = this._displayText(newText);
            }));

            this._signalHandles.push(settings.connect('changed::default-text', () => {
                this._label.text = this._displayText(settings.get_string('message'));
                this._entry.text = this._displayText(settings.get_string('message'));
            }));

            this._signalHandles.push(settings.connect('changed::color', () => {
                this._applyStyle();
            }));

            this._signalHandles.push(settings.connect('changed::bold', () => {
                this._applyStyle();
            }));

            // Alert trigger — run flash animation
            this._signalHandles.push(settings.connect('changed::alert', () => {
                const count = settings.get_int('alert');
                if (count !== this._alertCount) {
                    this._alertCount = count;
                    this._runAlert(settings.get_string('alert-color'),
                                   settings.get_double('alert-duration'));
                }
            }));
        }

        /* ───── Helper: display text with fallback ───── */
        _displayText(raw) {
            if (raw === '')
                return this._settings.get_string('default-text');
            return raw;
        }

        /* ───── Apply persistent color + bold ───── */
        _applyStyle() {
            const color = this._settings.get_string('color');
            const bold = this._settings.get_boolean('bold');
            let styles = [];
            if (color)
                styles.push(`color: ${color}`);
            if (bold)
                styles.push('font-weight: bold');
            this._normalStyle = styles.join('; ');
            this._label.style = this._normalStyle;
        }

        /* ───── Alert flash animation ───── */
        _runAlert(alertColor, durationMs) {
            // Cap duration
            durationMs = Math.min(durationMs * 1000, 10000);

            const holdMs = Math.min(durationMs * 0.6, 3000);
            const fadeMs = Math.min(durationMs * 0.4, 2000);

            // 1) Apply alert style
            this._label.style = `color: ${alertColor}; font-weight: bold;`;

            // 2) Hold, then ease opacity to 0
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, holdMs, () => {
                this._label.ease({
                    opacity: 0,
                    duration: fadeMs / 2,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => {
                        // 3) Restore normal style, then fade back in
                        this._label.style = this._normalStyle;
                        this._label.set_opacity(0);
                        this._label.ease({
                            opacity: 255,
                            duration: fadeMs / 2,
                            mode: Clutter.AnimationMode.EASE_IN_QUAD,
                        });
                    },
                });
                return GLib.SOURCE_REMOVE;
            });
        }

        /* ───── Clean up ───── */
        destroy() {
            this._signalHandles.forEach(id => {
                if (id) {
                    try { this._settings.disconnect(id); } catch (e) { /* already gone */ }
                }
            });
            this._signalHandles = null;

            if (this._menu) {
                this._menu.destroy();
                this._menu = null;
            }
            if (this.button) {
                this.button.destroy();
                this.button = null;
            }

            super.destroy();
        }
    });

/* ───────────────────────────────────────────
 * Extension entry point
 * ─────────────────────────────────────────── */
export default class PanelMessagesExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new Indicator(this._settings);
        this._position = this._settings.get_string('position');

        this._addToPanel();

        // Reposition on setting change
        this._posSignal = this._settings.connect('changed::position', () => {
            const newPos = this._settings.get_string('position');
            if (newPos !== this._position) {
                this._position = newPos;
                this._removeFromPanel();
                this._addToPanel();
            }
        });

        // Re-index (if position uses index)
        this._idxSignal = this._settings.connect('changed::index', () => {
            this._removeFromPanel();
            this._addToPanel();
        });
    }

    disable() {
        if (this._posSignal) {
            this._settings.disconnect(this._posSignal);
            this._posSignal = null;
        }
        if (this._idxSignal) {
            this._settings.disconnect(this._idxSignal);
            this._idxSignal = null;
        }

        this._removeFromPanel();

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        if (this._settings) {
            this._settings = null;
        }
    }

    /* ───── Insert into the right panel box ───── */
    _addToPanel() {
        const position = this._position || 'far-right';
        const index = this._settings.get_int('index');

        switch (position) {
            case 'far-left':
                Main.panel._leftBox.insert_child_at_index(this._indicator.button, 0);
                break;
            case 'left':
                this._insertAtIndex(Main.panel._leftBox, index);
                break;
            case 'center':
                this._insertAtIndex(Main.panel._centerBox, index);
                break;
            case 'right':
                this._insertAtIndex(Main.panel._rightBox, index);
                break;
            case 'far-right':
            default:
                Main.panel._rightBox.add_child(this._indicator.button);
                break;
        }

        // Ensure the indicator shows above other panel children
        this._indicator.button.show();
    }

    _removeFromPanel() {
        if (!this._indicator || !this._indicator.button)
            return;

        // Remove from whatever parent it's attached to
        const parent = this._indicator.button.get_parent();
        if (parent)
            parent.remove_child(this._indicator.button);
    }

    _insertAtIndex(box, index) {
        const children = box.get_children();
        if (index < 0 || index >= children.length) {
            box.add_child(this._indicator.button);
        } else {
            box.insert_child_at_index(this._indicator.button, index);
        }
    }
}
