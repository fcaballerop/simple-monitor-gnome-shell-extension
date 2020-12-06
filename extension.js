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

        //Counter and cpu diffs
        var i;
        var j;
        let s = new Array(4);   //Current reading
        let s_o = new Array(4); //Old reading
        let s_d = new Array(4); //Difference
        for (i = 0; i < 4; i++) {
            s[i] = 0;
            s_d[i] = 0;
            s_o[i] = 0;
        }

        //Icons
        let cpuGioIcon = Gio.icon_new_for_string(Me.path + '/icons/cpu-symbolic.svg');
        let cpuIcon = new St.Icon({
          gicon: cpuGioIcon,
          style_class: 'system-status-icon',
          x_align: Clutter.ActorAlign.CENTER,
          x_expand: true,
          y_align: Clutter.ActorAlign.CENTER,
          y_expand: true
        });
        let memGioIcon = Gio.icon_new_for_string(Me.path + '/icons/mem-symbolic.svg');
        let memIcon = new St.Icon({
          gicon: memGioIcon,
          style_class: 'system-status-icon',
          x_align: Clutter.ActorAlign.CENTER,
          x_expand: true,
          y_align: Clutter.ActorAlign.CENTER,
          y_expand: true
        });
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

        let freeCmd = "";
        let psMemCmd = "";
        let psCpuCmd = "";
        let procCmd = "";
        //let freeFull = "";
        //Main Update function
        function Update() {
          //Run free -h
          try {
            let [ex, pid, stdinFd, stdoutFd, stderrFd] =
              GLib.spawn_async_with_pipes(null, ["free", "-h"], null, GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
            let [ex2, pid2, stdinFd2, stdoutFd2, stderrFd2] =
              GLib.spawn_async_with_pipes(null, ["ps", "axch" ,"-o", "cmd:15,%cpu", "--sort=-%cpu"], null, GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
            let [ex3, pid3, stdinFd3, stdoutFd3, stderrFd3] =
              GLib.spawn_async_with_pipes(null, ["ps", "axch" ,"-o", "cmd:15,%mem", "--sort=-%mem"], null, GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
            let [ex4, pid4, stdinFd4, stdoutFd4, stderrFd4] =
              GLib.spawn_async_with_pipes(null, ["cat", "/proc/stat"], null, GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
            let stdout = new Gio.UnixInputStream({fd: stdoutFd, close_fd: true});
            let outReader = new Gio.DataInputStream({base_stream: stdout});
            let stdout2 = new Gio.UnixInputStream({fd: stdoutFd2, close_fd: true});
            let outReader2 = new Gio.DataInputStream({base_stream: stdout2});
            let stdout3 = new Gio.UnixInputStream({fd: stdoutFd3, close_fd: true});
            let outReader3 = new Gio.DataInputStream({base_stream: stdout3});
            let stdout4 = new Gio.UnixInputStream({fd: stdoutFd4, close_fd: true});
            let outReader4 = new Gio.DataInputStream({base_stream: stdout4});
            GLib.close(stdinFd); GLib.close(stdinFd2); GLib.close(stdinFd3); GLib.close(stdinFd4);

            let output = [], output2 = [], output3 = [], output4 = [];
            let [line, size] = [null, 0], [line2, size2] = [null, 0], [line3, size3] = [null, 0], [line4, size4] = [null, 0];

            while (([line, size] = outReader.read_line(null)) != null && line != null) {
                if(line) output.push(ByteArray.toString(line));
            }
            while (([line2, size2] = outReader2.read_line(null)) != null && line2 != null) {
                if(line2) output2.push(ByteArray.toString(line2));
            }
            while (([line3, size3] = outReader3.read_line(null)) != null && line3 != null) {
                if(line3) output3.push(ByteArray.toString(line3));
            }
            while (([line4, size4] = outReader4.read_line(null)) != null && line4 != null) {
                if(line4) output4.push(ByteArray.toString(line4));
            }

            stdout.close(null); stdout2.close(null); stdout3.close(null); stdout4.close(null);
            freeCmd = output;
            psCpuCmd = output2;
            psMemCmd = output3;
            procCmd = output4;
          } catch (e) {
            log(e.toString());
          }
          if (freeCmd == "" || psCpuCmd == "" || psMemCmd == "" || procCmd == "") {
            return;
          }
            let cpuusage = GLib.spawn_command_line_sync(`cat /proc/stat`)[1];
            let cpuToProc = ByteArray.toString(cpuusage).split('\n')[0];
            for (i = 0; i < 10; i++) {
              let cpuSpl = psCpuCmd[i].split(/[ ]+/);
              let cpuName = "";
              for (j = 0; j < cpuSpl.length - 1; j++) {
                cpuName += cpuSpl[j]+" ";
              }
              cpuNameLabels[i].set_text(cpuName);
              cpulLabels[i].set_text(cpuSpl[cpuSpl.length - 1]);
              let memSpl = psMemCmd[i].split(/[ ]+/);
              let memName = "";
              for (j = 0; j < cpuSpl.length - 1; j++) {
                memName += memSpl[j]+" ";
              }
              memNameLabels[i].set_text(memName);
              memlLabels[i].set_text(memSpl[memSpl.length - 1]);
            }
            let freeSpl = freeCmd[1].split(/[ ]+/);
            memPanelLabel.set_text(' '+freeSpl[2]+'/'+freeSpl[1]);
            let cpuUse = procCmd[0].split(/[ ]+/);
            let sAc = new Array(4);
            for (i = 0; i < 4; i++) {
                sAc[i] = parseFloat(cpuUse[i+1]);
                s_o[i] = s[i];
                s[i] = sAc[i];
                s_d[i] = s[i]-s_o[i];
            }
            let cpuPerc = 100*(s_d[0]+s_d[1]+s_d[2])/(s_d[0]+s_d[1]+s_d[2]+s_d[3]);
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

        Update();

        this._eventLoop = Mainloop.timeout_add_seconds(5, Lang.bind(this, function (){
            Update();
            return true;
        }));
    }

    _onDestroy(){
        Mainloop.source_remove(this._eventLoop);
        this.menu.removeAll();
        super._onDestroy();
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
