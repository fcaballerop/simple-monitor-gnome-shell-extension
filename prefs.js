const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

const modelColumn = {
    label: 0,
    separator: 1
}

function init() {
    ExtensionUtils.initTranslations();
}

var MonitorPrefs = new GObject.registerClass(class SimpleMonitorPrefs extends Gtk.Grid {

    _init() {
        super._init();
        this.margin = this.row_spacing = this.column_spacing = 20;

        this._settings = ExtensionUtils.getSettings();

        this._addSwitch({
            key: 'mem-perc', y: 0, x: 0,
            label: _('Show memory percentage'),
            help: _('If on, memory usage is shown as percentage of total. If off, it is shown as used GiB')
        });

        this._addButtons({
            key: 'top-or-ps', y: 1, x: 0,
            label: _('Get processes CPU usage from \'top\''),
            help: _('If on, top is used, if of, ps is used. Top gets usage in a short period of time, ps gets cumulative usage since process started')
        });

        let spinBLabel = new Gtk.Label({ label: _('Update every (Sec)'), halign: Gtk.Align.END });
        this.attach(spinBLabel, 0, 2, 1, 1);
        let spinButton = new Gtk.SpinButton();
        spinButton.set_sensitive(true);
        spinButton.set_range(1, 10);
        spinButton.set_value(2);
        spinButton.set_increments(1, 2);
        this._settings.bind('sec-update', spinButton, 'value', Gio.SettingsBindFlags.DEFAULT);
        this.attach(spinButton, 1, 2, 1, 1)
    }

    _addSwitch(params) {
        let lbl = new Gtk.Label({ label: params.label, halign: Gtk.Align.END });
        this.attach(lbl, params.x, params.y, 1, 1);
        let sw = new Gtk.Switch({ halign: Gtk.Align.END, valign: Gtk.Align.CENTER });
        this.attach(sw, params.x + 1, params.y, 1, 1);

        if (params.help) {
            lbl.set_tooltip_text(params.help);
            sw.set_tooltip_text(params.help);
        }
        this._settings.bind(params.key, sw, 'active', Gio.SettingsBindFlags.DEFAULT);
    }

    _addButtons(params) {
        let lbl = new Gtk.Label({ label: params.label, halign: Gtk.Align.END });
        this.attach(lbl, params.x, params.y, 1, 1);
        let btn = new Gtk.Switch({halign:Gtk.Align.END, valign: Gtk.Align.CENTER });
        this.attach(btn, params.x+1, params.y, 1, 1);

        if (params.help) {
            lbl.set_tooltip_text(params.help);
            btn.set_tooltip_text(params.help);
        }
        this._settings.bind(params.key, btn, 'active', Gio.SettingsBindFlags.DEFAULT);
    }

});

function buildPrefsWidget() {
    let w = new MonitorPrefs();
    try {
        w.show_all();
    } catch (e) {

    }
    return w;
}
