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
 *   - Alert flash (smooth colour morph → hold → morph back) triggered from CLI
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
            this._normalColor = null; // cached Clutter.Color

            // Helper: show default-text when message is empty
            const displayText = raw =>
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
            // Cache the original color from the style
            this._cacheNormalColor();

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
                this._cacheNormalColor();
            }));

            this._signalHandles.push(settings.connect('changed::bold', () => {
                this._applyStyle();
            }));

            // Alert trigger — run colour morph animation
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

        /* ───── Cache current text colour from ClutterText ───── */
        _cacheNormalColor() {
            try {
                const ct = this._label.clutter_text;
                this._normalColor = ct.get_color();
            } catch (e) {
                this._normalColor = null;
            }
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

        /* ───── Alert animation: morph to red bold, hold, morph back ───── */
        _runAlert(alertColor, durationSec) {
            const morphMs = Math.max(200, Math.min(durationSec * 150, 800));
            const holdMs = Math.max(500, Math.min(durationSec * 700, 4000));

            // Parse the target alert colour
            let targetColor;
            try {
                [, targetColor] = Clutter.Color.from_string(alertColor);
            } catch (e) {
                [, targetColor] = Clutter.Color.from_string('#ff3333');
            }

            const ct = this._label.clutter_text;
            if (!ct) return;

            // 1) Turn bold on (instant). Colour is still normal.
            this._label.style = `font-weight: bold; ${this._settings.get_string('color') ? `color: ${this._settings.get_string('color')}` : ''}`;

            // 2) Animate colour from normal → alert
            ct.ease({
                color: targetColor,
                duration: morphMs,
                mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
                onComplete: () => {
                    // 3) Hold at red bold
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, holdMs, () => {
                        // 4) Animate colour back to normal
                        const fallback = Clutter.Color.from_string('#ffffff')[1];
                        ct.ease({
                            color: this._normalColor || fallback,
                            duration: morphMs,
                            mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
                            onComplete: () => {
                                // 5) Restore normal style (removes bold)
                                this._label.style = this._normalStyle;
                            },
                        });
                        return GLib.SOURCE_REMOVE;
                    });
                },
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

        // Reposition when the user changes position or index
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

    /* ───── Insert into / remove from the panel ─────
     *
     * We use plain box insertion for ALL positions instead of
     * addToStatusArea(), because that API does internal bookkeeping
     * that conflicts with repeated repositioning.  Direct
     * add/remove is fully reliable.                        */

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
