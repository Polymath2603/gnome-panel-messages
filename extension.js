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
 *   - Text styling (colour, bold) from settings or CLI
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
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/* ───────────────────────────────────────────
 * Indicator — the panel button + popup
 * ─────────────────────────────────────────── */
const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init(settings) {
            super._init(0.0, _('Panel Messages'));

            this._settings = settings;
            this._alertCount = settings.get_int('alert');
            this._normalStyle = '';

            // Helper: show default-text when message is empty
            const displayText = (raw) =>
                raw === '' ? settings.get_string('default-text') : raw;

            // ---- Panel label ----
            this._label = new St.Label({
                text: displayText(settings.get_string('message')),
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this.add_child(this._label);

            // ---- Popup entry for interactive editing ----
            this._entry = new St.Entry({
                text: displayText(settings.get_string('message')),
                can_focus: true,
                track_hover: true,
            });
            this._entry.set_primary_icon(new St.Icon({
                icon_name: 'document-edit-symbolic',
                style_class: 'popup-menu-icon',
            }));

            this._entry.clutter_text.connect('text-changed', () => {
                const text = this._entry.get_text();
                settings.set_string('message', text);
                this._label.text = displayText(text);
            });

            const popupSection = new PopupMenu.PopupMenuSection();
            popupSection.actor.add_child(this._entry);
            this.menu.addMenuItem(popupSection);
            this.menu.actor.add_style_class_name('panel-message-entry');

            // ---- Apply persistent style ----
            this._applyStyle();

            // ---- Watch GSettings changes ----
            this._signalHandles = [];

            this._signalHandles.push(settings.connect('changed::message', () => {
                const text = settings.get_string('message');
                this._label.text = displayText(text);
                this._entry.text = displayText(text);
            }));

            this._signalHandles.push(settings.connect('changed::default-text', () => {
                const text = settings.get_string('message');
                this._label.text = displayText(text);
                this._entry.text = displayText(text);
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
                    this._runAlert(
                        settings.get_string('alert-color'),
                        settings.get_double('alert-duration')
                    );
                }
            }));
        }

        /* ───── Apply persistent colour + bold ───── */
        _applyStyle() {
            const color = this._settings.get_string('color');
            const bold = this._settings.get_boolean('bold');
            const styles = [];
            if (color) styles.push(`color: ${color}`);
            if (bold) styles.push('font-weight: bold');
            this._normalStyle = styles.join('; ');
            this._label.style = this._normalStyle;
        }

        /* ───── Alert flash animation ───── */
        _runAlert(alertColor, durationSec) {
            const holdMs = Math.min(durationSec * 600, 3000);
            const fadeMs = Math.min(durationSec * 400, 2000);

            // 1) Apply alert style instantly
            this._label.style = `color: ${alertColor}; font-weight: bold;`;

            // 2) Hold, then ease opacity to 0
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, holdMs, () => {
                this._label.ease({
                    opacity: 0,
                    duration: fadeMs / 2,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => {
                        // 3) Restore normal style, fade back in
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
            (this._signalHandles || []).forEach(id => {
                try { this._settings.disconnect(id); } catch (e) { /* ok */ }
            });
            this._signalHandles = null;
            this._settings = null;
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
                this._reposition();
            }
        });

        this._idxSignal = this._settings.connect('changed::index', () => {
            this._reposition();
        });
    }

    disable() {
        [this._posSignal, this._idxSignal].forEach(id => {
            if (id) { try { this._settings.disconnect(id); } catch (e) { /* ok */ } }
        });
        this._posSignal = null;
        this._idxSignal = null;

        this._removeFromPanel();

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._settings = null;
    }

    /* ───── Insert into the right panel box ───── */
    _addToPanel() {
        const position = this._position || 'far-right';
        const index = this._settings.get_int('index');

        switch (position) {
            case 'far-left':
                Main.panel._leftBox.insert_child_at_index(this._indicator, 0);
                break;
            case 'left':
                this._insertAt(Main.panel._leftBox, index);
                break;
            case 'center':
                this._insertAt(Main.panel._centerBox, index);
                break;
            case 'right':
                this._insertAt(Main.panel._rightBox, index);
                break;
            case 'far-right':
            default:
                Main.panel._rightBox.add_child(this._indicator);
                break;
        }

        this._indicator.show();
    }

    _removeFromPanel() {
        if (!this._indicator) return;
        const parent = this._indicator.get_parent();
        if (parent)
            parent.remove_child(this._indicator);
    }

    _reposition() {
        this._removeFromPanel();
        this._addToPanel();
    }

    _insertAt(box, index) {
        const children = box.get_children();
        if (index < 0 || index >= children.length)
            box.add_child(this._indicator);
        else
            box.insert_child_at_index(this._indicator, index);
    }
}
