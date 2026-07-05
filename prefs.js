/* prefs.js — Settings panel for Panel Messages extension
 *
 * Accessible from: GNOME Settings → Extensions → Panel Messages
 * or: gnome-extensions prefs panel-messages@leonardo.local
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class PanelMessagesPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // ── Build page ───────────────────────────────────
        const page = new Adw.PreferencesPage({
            title: 'Panel Messages',
            iconName: 'document-edit-symbolic',
        });

        // ── Message group ────────────────────────────────
        const msgGroup = new Adw.PreferencesGroup({
            title: 'Message',
            description: 'Current text and fallback',
        });

        // Current message (read-only display)
        const currentMsg = new Adw.ActionRow({
            title: 'Current Message',
            subtitle: settings.get_string('message') || '(empty)',
        });
        msgGroup.add(currentMsg);

        // Default text
        const defaultRow = new Adw.ActionRow({
            title: 'Default text',
            subtitle: 'Placeholder when message is empty',
        });
        const defaultEntry = new Gtk.Entry({
            text: settings.get_string('default-text'),
            valign: Gtk.Align.CENTER,
        });
        defaultEntry.connect('notify::text', () => {
            settings.set_string('default-text', defaultEntry.text);
            currentMsg.subtitle = settings.get_string('message') || defaultEntry.text;
        });
        defaultRow.add_suffix(defaultEntry);
        defaultRow.activatable_widget = defaultEntry;
        msgGroup.add(defaultRow);

        page.add(msgGroup);

        // ── Appearance group ──────────────────────────────
        const appearGroup = new Adw.PreferencesGroup({
            title: 'Appearance',
            description: 'Text colour and weight',
        });

        // Color
        const colorRow = new Adw.ActionRow({
            title: 'Text colour',
            subtitle: 'CSS colour value (empty = theme default)',
        });
        const colorEntry = new Gtk.Entry({
            text: settings.get_string('color'),
            placeholder_text: 'e.g. red, #ff3333',
            valign: Gtk.Align.CENTER,
        });
        colorEntry.connect('notify::text', () => {
            settings.set_string('color', colorEntry.text);
        });
        colorRow.add_suffix(colorEntry);
        colorRow.activatable_widget = colorEntry;
        appearGroup.add(colorRow);

        // Bold toggle
        const boldRow = new Adw.ActionRow({
            title: 'Bold',
            subtitle: 'Show text in bold weight',
        });
        const boldSwitch = new Gtk.Switch({
            active: settings.get_boolean('bold'),
            valign: Gtk.Align.CENTER,
        });
        boldSwitch.connect('notify::active', () => {
            settings.set_boolean('bold', boldSwitch.active);
        });
        boldRow.add_suffix(boldSwitch);
        boldRow.activatable_widget = boldSwitch;
        appearGroup.add(boldRow);

        page.add(appearGroup);

        // ── Position group ────────────────────────────────
        const posGroup = new Adw.PreferencesGroup({
            title: 'Panel Position',
            description: 'Where the indicator sits in the GNOME panel',
        });

        // Position combo
        const posRow = new Adw.ActionRow({
            title: 'Position',
        });
        const posDropdown = Gtk.DropDown.new_from_strings([
            'far-left', 'left', 'center', 'right', 'far-right',
        ]);
        const positions = ['far-left', 'left', 'center', 'right', 'far-right'];
        const currentPos = settings.get_string('position');
        const posIdx = positions.indexOf(currentPos);
        if (posIdx >= 0)
            posDropdown.selected = posIdx;
        posDropdown.connect('notify::selected', () => {
            const idx = posDropdown.selected;
            if (idx >= 0 && idx < positions.length)
                settings.set_string('position', positions[idx]);
        });
        posRow.add_suffix(posDropdown);
        posRow.activatable_widget = posDropdown;
        posGroup.add(posRow);

        // Index spin
        const idxRow = new Adw.ActionRow({
            title: 'Index',
            subtitle: 'Ordering within the panel area',
        });
        const idxSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0, upper: 99, step_increment: 1,
            }),
            valign: Gtk.Align.CENTER,
        });
        idxSpin.value = settings.get_int('index');
        idxSpin.connect('notify::value', () => {
            settings.set_int('index', idxSpin.value);
        });
        idxRow.add_suffix(idxSpin);
        idxRow.activatable_widget = idxSpin;
        posGroup.add(idxRow);

        page.add(posGroup);

        // ── Alert group ──────────────────────────────────
        const alertGroup = new Adw.PreferencesGroup({
            title: 'Alert',
            description: 'Visual flash triggered from the CLI',
        });

        const alertColorRow = new Adw.ActionRow({
            title: 'Alert colour',
            subtitle: 'Colour flashed during alert (CSS value)',
        });
        const alertColorEntry = new Gtk.Entry({
            text: settings.get_string('alert-color'),
            placeholder_text: 'e.g. #ff3333',
            valign: Gtk.Align.CENTER,
        });
        alertColorEntry.connect('notify::text', () => {
            settings.set_string('alert-color', alertColorEntry.text);
        });
        alertColorRow.add_suffix(alertColorEntry);
        alertColorRow.activatable_widget = alertColorEntry;
        alertGroup.add(alertColorRow);

        page.add(alertGroup);

        window.add(page);
    }
}
