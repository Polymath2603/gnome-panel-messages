/* extension.js
 *
 * Panel Messages — A GNOME Shell extension with CLI control.
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
 * Indicator
 * ─────────────────────────────────────────── */
const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init(settings) {
            super._init(0.0, _('Panel Messages'));

            this._settings = settings;
            this._alertCount = settings.get_int('alert');
            this._normalStyle = '';
            this._normalColor = null;

            // Standard panel button sizing
            this.style = 'padding: 0 4px;';

            const displayText = raw =>
                raw === '' ? settings.get_string('default-text') : raw;

            // ---- Panel label ----
            this._label = new St.Label({
                text: displayText(settings.get_string('message')),
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this.add_child(this._label);

            // ---- Popup entry ----
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

            // ---- Apply persistent style ----
            this._applyStyle();
            this._cacheNormalColor();

            // ---- External GSettings watchers ----
            this._connectSignals();
        }

        _connectSignals() {
            const s = this._settings;
            this._sig = [
                s.connect('changed::message', () => {
                    const text = s.get_string('message');
                    this._label.text = this._displayText(text);
                    this._entry.text = this._displayText(text);
                }),
                s.connect('changed::default-text', () => {
                    const text = s.get_string('message');
                    this._label.text = this._displayText(text);
                    this._entry.text = this._displayText(text);
                }),
                s.connect('changed::color', () => {
                    this._applyStyle();
                    this._cacheNormalColor();
                }),
                s.connect('changed::bold', () => {
                    this._applyStyle();
                }),
                s.connect('changed::alert', () => {
                    const count = s.get_int('alert');
                    if (count !== this._alertCount) {
                        this._alertCount = count;
                        this._runAlert(
                            s.get_string('alert-color'),
                            s.get_double('alert-duration')
                        );
                    }
                }),
            ];
        }

        _displayText(raw) {
            return raw === '' ? this._settings.get_string('default-text') : raw;
        }

        _cacheNormalColor() {
            try {
                this._normalColor = this._label.clutter_text.get_color();
            } catch (e) {
                this._normalColor = null;
            }
        }

        _applyStyle() {
            const color = this._settings.get_string('color');
            const bold = this._settings.get_boolean('bold');
            const styles = [];
            if (color) styles.push(`color: ${color}`);
            if (bold) styles.push('font-weight: bold');
            this._normalStyle = styles.join('; ');
            this._label.style = this._normalStyle;
        }

        _runAlert(alertColor, durationSec) {
            const morphMs = Math.max(200, Math.min(durationSec * 150, 800));
            const holdMs = Math.max(500, Math.min(durationSec * 700, 4000));

            let targetColor;
            try {
                [, targetColor] = Clutter.Color.from_string(alertColor);
            } catch (e) {
                [, targetColor] = Clutter.Color.from_string('#ff3333');
            }

            const ct = this._label.clutter_text;
            if (!ct) return;

            const curColor = this._settings.get_string('color');
            this._label.style =
                `font-weight: bold;${curColor ? ` color: ${curColor};` : ''}`;

            ct.ease({
                color: targetColor,
                duration: morphMs,
                mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
                onComplete: () => {
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, holdMs, () => {
                        const fallback = Clutter.Color.from_string('#ffffff')[1];
                        ct.ease({
                            color: this._normalColor || fallback,
                            duration: morphMs,
                            mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
                            onComplete: () => {
                                this._label.style = this._normalStyle;
                            },
                        });
                        return GLib.SOURCE_REMOVE;
                    });
                },
            });
        }

        destroy() {
            (this._sig || []).forEach(id => {
                try { this._settings.disconnect(id); } catch (_) {}
            });
            this._sig = null;
            this._settings = null;
            super.destroy();
        }
    });

/* ───────────────────────────────────────────
 * Extension
 * ─────────────────────────────────────────── */
export default class PanelMessagesExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new Indicator(this._settings);
        this._currentPos = this._settings.get_string('position') || 'far-right';

        this._placeInPanel();

        // Position / index changes
        this._settings.connect('changed::position', () => this._placeInPanel());
        this._settings.connect('changed::index', () => this._placeInPanel());

        // Keepalive: every CLI call (changed::message) re-checks anchor.
        // If something stole our indicator from the panel, this puts it back.
        this._settings.connect('changed::message', () => this._ensureInPanel());
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._settings = null;
    }

    /* ───── Panel placement ───── */

    _placeInPanel() {
        if (!this._indicator) return;

        // Remove from old parent (if any) then insert at new position
        const parent = this._indicator.get_parent();
        if (parent) parent.remove_child(this._indicator);

        this._currentPos = this._settings.get_string('position') || 'far-right';
        const index = this._settings.get_int('index');

        switch (this._currentPos) {
            case 'far-left':
                Main.panel._leftBox.insert_child_at_index(this._indicator, 0);
                break;
            case 'left':  this._insertAt(Main.panel._leftBox, index);   break;
            case 'center':this._insertAt(Main.panel._centerBox, index); break;
            case 'right': this._insertAt(Main.panel._rightBox, index);  break;
            case 'far-right':
            default:
                Main.panel.addToStatusArea(this.uuid, this._indicator, -1, 'right');
                break;
        }

        this._indicator.show();
    }

    /** Re-anchor if the indicator was silently removed from the panel. */
    _ensureInPanel() {
        if (!this._indicator || this._indicator.get_parent()) return;

        // It's orphaned — put it back
        const parent = this._indicator.get_parent();
        const box = this._currentPos === 'center'   ? Main.panel._centerBox
                  : this._currentPos === 'far-left' || this._currentPos === 'left'
                    ? Main.panel._leftBox : Main.panel._rightBox;
        box.add_child(this._indicator);
        this._indicator.show();
    }

    _insertAt(box, index) {
        const children = box.get_children();
        if (index < 0 || index >= children.length)
            box.add_child(this._indicator);
        else
            box.insert_child_at_index(this._indicator, index);
    }
}
