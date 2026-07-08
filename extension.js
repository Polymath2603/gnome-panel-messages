/* extension.js
 *
 * Panel Messages — A GNOME Shell extension with CLI control.
 * Uses hijridate's proven pattern: destroy+recreate on reposition,
 * always register via addToStatusArea, never manually remove_child.
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

            // ---- Watch GSettings for external changes ----
            this._connectSignals();
        }

        _connectSignals() {
            const s = this._settings;

            this._sigLabel = s.connect('changed::message', () => {
                const text = s.get_string('message');
                this._label.text = this._displayText(text);
                this._entry.text = this._displayText(text);
            });
            this._sigDefault = s.connect('changed::default-text', () => {
                const text = s.get_string('message');
                this._label.text = this._displayText(text);
                this._entry.text = this._displayText(text);
            });
            this._sigColor = s.connect('changed::color', () => {
                this._applyStyle();
                this._cacheNormalColor();
            });
            this._sigBold = s.connect('changed::bold', () => {
                this._applyStyle();
            });
            this._sigAlert = s.connect('changed::alert', () => {
                const count = s.get_int('alert');
                if (count !== this._alertCount) {
                    this._alertCount = count;
                    this._runAlert(
                        s.get_string('alert-color'),
                        s.get_double('alert-duration')
                    );
                }
            });
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
            for (const id of [this._sigLabel, this._sigDefault, this._sigColor,
                               this._sigBold, this._sigAlert]) {
                try { this._settings.disconnect(id); } catch (_) {}
            }
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
        this._currentPos = this._settings.get_string('position') || 'far-right';
        this._currentIdx = this._settings.get_int('index');

        this._indicator = new Indicator(this._settings);
        this._registerInPanel();

        // Reposition: follow hijridate's proven pattern
        // (destroy from statusArea + destroy actor + create fresh + register)
        this._sigPos = this._settings.connect('changed::position', () => {
            this._replaceIndicator();
        });
        this._sigIdx = this._settings.connect('changed::index', () => {
            this._replaceIndicator();
        });

        // Keepalive: if something externally orphaned the indicator,
        // the next CLI call re-anchors it.
        this._sigKeepalive = this._settings.connect('changed::message', () => {
            this._ensureInPanel();
        });
    }

    disable() {
        for (const id of [this._sigPos, this._sigIdx, this._sigKeepalive]) {
            try { this._settings.disconnect(id); } catch (_) {}
        }
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._settings = null;
    }

    /* ───── Register via addToStatusArea (the ONLY placement method) ───── */

    _registerInPanel() {
        this._currentPos = this._settings.get_string('position') || 'far-right';
        this._currentIdx = this._settings.get_int('index');

        const pos = this._currentPos;
        const idx = this._currentIdx;

        // Box & index: pass to addToStatusArea.
        // For center: register in right box first, then move to center.
        // For all others: addToStatusArea handles it.
        if (pos === 'far-left' || pos === 'left') {
            Main.panel.addToStatusArea(this.uuid, this._indicator, idx, 'left');
        } else if (pos === 'center') {
            // addToStatusArea only supports 'left'/'right', so we register
            // with 'right' then immediately move to center.
            Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'right');
            // Move to center using proper index
            const centerBox = Main.panel._centerBox;
            const children = centerBox.get_children();
            const targetIdx = Math.min(idx, children.length);
            if (targetIdx < children.length)
                centerBox.insert_child_at_index(this._indicator, targetIdx);
            else
                centerBox.add_child(this._indicator);
        } else {
            // right / far-right
            Main.panel.addToStatusArea(this.uuid, this._indicator,
                pos === 'far-right' ? -1 : idx, 'right');
        }
    }

    /* ───── Hijridate-style replace: clean slate, no stale bookkeeping ───── */

    _replaceIndicator() {
        // Step 1: Wipe from statusArea so shell bookkeeping is clean
        if (Main.panel.statusArea[this.uuid]) {
            Main.panel.statusArea[this.uuid].destroy();
        }
        // Step 2: Destroy our reference
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        // Step 3: Create fresh indicator with existing settings
        this._indicator = new Indicator(this._settings);
        // Step 4: Register at new position
        this._registerInPanel();
    }

    /* ───── Keepalive: re-anchor if the indicator was orphaned ───── */

    _ensureInPanel() {
        if (!this._indicator || this._indicator.get_parent())
            return;

        // The indicator has no parent — something removed it.
        // Re-register cleanly via same path.
        this._replaceIndicator();
    }
}
