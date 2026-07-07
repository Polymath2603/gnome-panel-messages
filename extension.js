/* extension.js
 *
 * Panel Messages — A GNOME Shell extension that shows a message in the panel.
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

            // ---- Panel label with padding via style ----
            this._label = new St.Label({
                text: displayText(settings.get_string('message')),
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
                style: 'padding: 0 6px;',
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
            this.menu.actor.add_style_class_name('panel-message-entry');

            // ---- Apply persistent style ----
            this._applyStyle();
            this._cacheNormalColor();

            // ---- External GSettings watchers ----
            this._sigMessage = settings.connect('changed::message', () => {
                const text = settings.get_string('message');
                this._label.text = displayText(text);
                this._entry.text = displayText(text);
            });
            this._sigDefault = settings.connect('changed::default-text', () => {
                const text = settings.get_string('message');
                this._label.text = displayText(text);
                this._entry.text = displayText(text);
            });
            this._sigColor = settings.connect('changed::color', () => {
                this._applyStyle();
                this._cacheNormalColor();
            });
            this._sigBold = settings.connect('changed::bold', () => {
                this._applyStyle();
            });
            this._sigAlert = settings.connect('changed::alert', () => {
                const count = settings.get_int('alert');
                if (count !== this._alertCount) {
                    this._alertCount = count;
                    this._runAlert(
                        settings.get_string('alert-color'),
                        settings.get_double('alert-duration')
                    );
                }
            });
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
            const styles = ['padding: 0 6px;'];
            if (color) styles.push(`color: ${color}`);
            if (bold) styles.push('font-weight: bold');
            this._normalStyle = styles.join(' ');
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

            // 1) Bold on, keep current colour
            const curColor = this._settings.get_string('color');
            this._label.style = `padding: 0 6px; font-weight: bold;${curColor ? ` color: ${curColor};` : ''}`;

            // 2) Morph colour → alert
            ct.ease({
                color: targetColor,
                duration: morphMs,
                mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
                onComplete: () => {
                    // 3) Hold
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, holdMs, () => {
                        // 4) Morph colour → normal
                        const fallback = Clutter.Color.from_string('#ffffff')[1];
                        ct.ease({
                            color: this._normalColor || fallback,
                            duration: morphMs,
                            mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
                            onComplete: () => {
                                // 5) Restore normal style
                                this._label.style = this._normalStyle;
                            },
                        });
                        return GLib.SOURCE_REMOVE;
                    });
                },
            });
        }

        destroy() {
            const s = this._settings;
            if (!s) return;
            for (const id of [this._sigMessage, this._sigDefault, this._sigColor,
                               this._sigBold, this._sigAlert]) {
                try { s.disconnect(id); } catch (_) {}
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

        // Use the panel's official API — it handles bookkeeping internally
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        // Listen for position/index changes.  Instead of repositioning the
        // indicator ourselves (which can cause race conditions with the
        // panel's own bookkeeping), we store the desired state and
        // re-apply it via addToStatusArea.
        this._posChanged = this._settings.connect('changed::position', () => {
            this._reposition();
        });
        this._idxChanged = this._settings.connect('changed::index', () => {
            this._reposition();
        });
    }

    disable() {
        for (const id of [this._posChanged, this._idxChanged]) {
            try { this._settings.disconnect(id); } catch (_) {}
        }
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._settings = null;
    }

    /** Move the indicator to its configured position.
     *
     *  We always remove-then-reinsert.  Clutter actors that are already
     *  children of a container are silently moved when added/inserted
     *  into another container, so there is no risk of duplicates.
     */
    _reposition() {
        if (!this._indicator) return;

        const parent = this._indicator.get_parent();
        if (parent) parent.remove_child(this._indicator);

        const position = this._settings.get_string('position') || 'far-right';
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
            case 'far-right':
            default:
                Main.panel.addToStatusArea(this.uuid, this._indicator,
                    position === 'right' ? index : -1, 'right');
                break;
        }

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
