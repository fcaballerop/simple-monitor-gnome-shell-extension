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

        this._addSwitch({key: 'mem-perc', y : 0, x: 0,
            label: _('Show memory percentage')});

        let spinBLabel = new Gtk.Label({label: _('Update every (Sec)'),halign: Gtk.Align.END});
        this.attach(spinBLabel, 0, 1, 1, 1);
        let spinButton = new Gtk.SpinButton();
        spinButton.set_sensitive(true);
        spinButton.set_range(1, 10);
        spinButton.set_value(2);
        spinButton.set_increments(1, 2);
        this._settings.bind('sec-update', spinButton, 'value', Gio.SettingsBindFlags.DEFAULT);
        this.attach(spinButton, 1, 1, 1, 1)
    }

    _addSwitch(params){
        let lbl = new Gtk.Label({label: params.label,halign : Gtk.Align.END});
        this.attach(lbl, params.x, params.y, 1, 1);
        let sw = new Gtk.Switch({halign : Gtk.Align.END, valign : Gtk.Align.CENTER});
        this.attach(sw, params.x + 1, params.y, 1, 1);
        
        if(params.help){
            lbl.set_tooltip_text(params.help);
            sw.set_tooltip_text(params.help);
        }
        this._settings.bind(params.key, sw, 'active', Gio.SettingsBindFlags.DEFAULT);
    }

});

function buildPrefsWidget() {
    let w = new MonitorPrefs();
    w.show_all();
    return w;
}
