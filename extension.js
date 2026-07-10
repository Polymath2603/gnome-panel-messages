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
 * Indicator — the panel button + popup
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

            this._label = new St.Label({
                text: displayText(settings.get_string('message')),
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this.add_child(this._label);

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

            this._applyStyle();
            this._cacheNormalColor();
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
        this._indicator = new Indicator(this._settings);
        this._registerInPanel();

        this._settings.connect('changed::position', () => this._replaceIndicator());
        this._settings.connect('changed::index', () => this._replaceIndicator());

        // Keepalive: on every CLI call, verify the indicator's container
        // is still anchored in a panel box.  If not, replace cleanly.
        this._settings.connect('changed::message', () => this._ensureInPanel());
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy(); // auto-cleans statusArea via destroy handler
            this._indicator = null;
        }
        this._settings = null;
    }

    /* ───── Register via addToStatusArea wherever possible ───── */

    _registerInPanel() {
        const pos = this._settings.get_string('position') || 'far-right';
        const idx = this._settings.get_int('index');

        switch (pos) {
            case 'far-left':
                // addToStatusArea doesn't support "before everything",
                // so insert index 0 directly using the .container
                Main.panel._leftBox.insert_child_at_index(
                    this._indicator.container, 0);
                break;
            case 'left':
                Main.panel.addToStatusArea(this.uuid, this._indicator,
                    idx < 0 ? -1 : idx, 'left');
                break;
            case 'center':
                Main.panel.addToStatusArea(this.uuid, this._indicator,
                    idx < 0 ? -1 : idx, 'center');
                break;
            case 'right':
                Main.panel.addToStatusArea(this.uuid, this._indicator,
                    idx < 0 ? -1 : idx, 'right');
                break;
            case 'far-right':
            default:
                Main.panel.addToStatusArea(this.uuid, this._indicator, -1, 'right');
                break;
        }
    }

    /* ───── Destroy + recreate (hijridate pattern) ───── */

    _replaceIndicator() {
        // Destroying the indicator fires its auto-cleanup handler
        // which does `delete this.statusArea[this.uuid]`.
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._indicator = new Indicator(this._settings);
        this._registerInPanel();
    }

    /* ───── Keepalive ───── */

    _ensureInPanel() {
        if (!this._indicator)
            return;

        // The indicator is inside a St.Bin (.container).
        // That Bin is what gets added to the panel box.
        // If the Bin has no parent, we're orphaned.
        const container = this._indicator.container;
        if (container && container.get_parent())
            return; // still anchored

        // Orphaned — replace cleanly
        this._replaceIndicator();
    }
}
