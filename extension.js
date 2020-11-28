/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

const GETTEXT_DOMAIN = 'example';

const { GObject, St } = imports.gi;
const Util = imports.misc.util;

const Clutter = imports.gi.Clutter;

const GLib = imports.gi.GLib;

const Gio = imports.gi.Gio;
const Lang = imports.lang;
const ByteArray = imports.byteArray;

const Mainloop = imports.mainloop;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Gettext = imports.gettext;
Gettext.textdomain('example');
Gettext.bindtextdomain('example',Me.dir.get_child('locale').get_path());

const _ = Gettext.gettext;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('Simple Monitor'));

        //Just a counter
        var i;
        //Icons
        let cpuGioIcon = Gio.icon_new_for_string(Me.path + '/icons/cpu-symbolic.svg');
        let cpuIcon = new St.Icon({gicon: cpuGioIcon, style_class: 'system-status-icon', x_align: Clutter.ActorAlign.CENTER, x_expand: true, y_align: Clutter.ActorAlign.CENTER, y_expand: true});
        let memGioIcon = Gio.icon_new_for_string(Me.path + '/icons/mem-symbolic.svg');
        let memIcon = new St.Icon({gicon: memGioIcon, style_class: 'system-status-icon', x_align: Clutter.ActorAlign.CENTER, x_expand: true, y_align: Clutter.ActorAlign.CENTER, y_expand: true});

        //Boxes
        let box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        let cputbox = new St.BoxLayout({ height: 25.0, style_class: 'popup-status-menu-box' });
        let memtbox = new St.BoxLayout({ height: 25.0, style_class: 'popup-status-menu-box' });
        let cpuBoxes = new Array(10);
        let memBoxes = new Array(10);
        let cpuNameLabels = new Array(10);
        let cpulLabels = new Array(10);
        let memNameLabels = new Array(10);
        let memlLabels = new Array(10);
        for (i = 0; i < 10; i++) {
            cpuBoxes[i] = new St.BoxLayout({ height: 20.0, style_class: 'popup-status-menu-box' });
            memBoxes[i] = new St.BoxLayout({ height: 20.0, style_class: 'popup-status-menu-box' });
            cpuNameLabels[i] = new St.Label({text: 'temp', x_expand: true, x_align: Clutter.ActorAlign.START, translation_x: 24.0});
            cpulLabels[i] = new St.Label({text: 'temp', x_expand: true, x_align: Clutter.ActorAlign.END, translation_x: -24.0});
            memNameLabels[i] = new St.Label({text: 'temp', x_expand: true, x_align: Clutter.ActorAlign.START, translation_x: 24.0});
            memlLabels[i] = new St.Label({text: 'temp', x_expand: true, x_align: Clutter.ActorAlign.END, translation_x: -24.0});
        }

        //Labels
        let cpuPanelLabel = new St.Label({text: 'temp', x_expand: true, x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER, y_expand: true});
        let memPanelLabel = new St.Label({text: 'temp', x_expand: true, x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER, y_expand: true});
        let procLabel = new St.Label({text: _("Process"), x_expand: true, x_align: Clutter.ActorAlign.START, translation_x: 24.0});
        let procMLabel = new St.Label({text: _("Process"), x_expand: true, x_align: Clutter.ActorAlign.START, translation_x: 24.0});
        let cpuLabel = new St.Label({text: _("Cpu%"), x_expand: true, x_align: Clutter.ActorAlign.END, translation_x: -24.0});
        let memLabel = new St.Label({text: _("Mem%"), x_expand: true, x_align: Clutter.ActorAlign.END, translation_x: -24.0});

        //Buttons
        let refreshButton = new PopupMenu.PopupBaseMenuItem();
        refreshButton.actor.add_child(new St.Label({ text: _("Refresh"), x_align: Clutter.ActorAlign.CENTER, x_expand: true }));
        refreshButton.connect('activate', function () {
            Update();
        });

        //Main Update function
        function Update() {
            let cpuR = GLib.spawn_command_line_sync(`ps axch -o cmd:15,%cpu --sort=-%cpu`)[1];
            let memR = GLib.spawn_command_line_sync(`ps axch -o cmd:15,%mem --sort=-%mem`)[1];
            let freeFull = GLib.spawn_command_line_sync(`free -h`)[1];
            let cpuusage = GLib.spawn_command_line_sync(`cat /proc/stat`)[1];
            let freeStr = ByteArray.toString(freeFull);
            let freeArr = freeStr.split('\n')[1];
            let strcpu = ByteArray.toString(cpuR);
            let strmem = ByteArray.toString(memR);
            let cpuToProc = ByteArray.toString(cpuusage).split('\n')[0];
            for (i = 0; i < 10; i++) {
                let substr = strcpu.substring(21*i,21*(i+1)-1).split(' ');
                cpuNameLabels[i].set_text(substr[0]);
                cpulLabels[i].set_text(substr[substr.length - 1]);
                let substrM = strmem.substring(21*i,21*(i+1)-1).split(' ');
                memNameLabels[i].set_text(substrM[0]);
                memlLabels[i].set_text(substrM[substrM.length - 1]);
            }
            let totMem = "";
            let useMem = "";
            let freeSplt = freeArr.split(' ');
            let totFound = 0;
            for (i = 1; i < freeSplt.length; i++) {
                if (freeSplt[i] != '')
                {
                    if (totFound == 0) {
                        totFound = 1;
                        totMem = freeSplt[i];
                    }
                    else {
                        useMem = freeSplt[i];
                        break;
                    }
                }
            }
            memPanelLabel.set_text(' '+useMem+'/'+totMem);
            let cpuArr = cpuToProc.split(' ');
            let sAc = new Array(4);
            let counter = 0;
            for (i = 1; i < cpuArr.length; i++) {
                if (cpuArr[i] != '')
                {
                    sAc[counter] = parseFloat(cpuArr[i]);
                    counter += 1;
                    if (counter == 4) {
                        break;
                    }
                }
            }
            let cpuPerc = 100*(sAc[0]+sAc[1]+sAc[2])/(sAc[0]+sAc[1]+sAc[2]+sAc[3]);
            let toPrint = ('  '+cpuPerc.toFixed(1)+'%').slice(-6);
            cpuPanelLabel.set_text(toPrint);
        }

        //Layouts
        //Panel button layout
        box.add_child(cpuIcon);
        cpuPanelLabel.set_width(50);
        box.add_child(cpuPanelLabel);
        box.add_child(memIcon);
        box.add_child(memPanelLabel);
        this.add_child(box);

        //Click menu layout
        cputbox.add(procLabel);
        cputbox.add(cpuLabel);
        this.menu.box.add(cputbox);
        for (i = 0; i < 10; i++) {
            cpuBoxes[i].add(cpuNameLabels[i]);
            cpuBoxes[i].add(cpulLabels[i]);
            this.menu.box.add(cpuBoxes[i]);
        }
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        memtbox.add(procMLabel);
        memtbox.add(memLabel);
        this.menu.box.add(memtbox);
        for (i = 0; i < 10; i++) {
            memBoxes[i].add(memNameLabels[i]);
            memBoxes[i].add(memlLabels[i]);
            this.menu.box.add(memBoxes[i]);
        }
        this.menu.addMenuItem(refreshButton);
        
        //Begin
        //We don't wait for a first update
        Update();

        //Add timer to main event loop
        this._eventLoop = Mainloop.timeout_add_seconds(5, Lang.bind(this, function (){
            Update();
            return true;
        }));
    }

    _onDestroy(){
        Mainloop.source_remove(this._eventLoop);
        this.menu.removeAll();
    }
});

class Extension {
    constructor(uuid) {
        this._uuid = uuid;

        ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
    }

    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}

function init(meta) {
    return new Extension(meta.uuid);
}
