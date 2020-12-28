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

/**
 * Function taken from Andy Holmes @ andyholmes[dot]ca
* Execute a command asynchronously and return the output from `stdout` on
* success or throw an error with output from `stderr` on failure.
*
* If given, @input will be passed to `stdin` and @cancellable can be used to
* stop the process before it finishes.
*
* @param {string[]} argv - a list of string arguments
* @param {string} [input] - Input to write to `stdin` or %null to ignore
* @param {Gio.Cancellable} [cancellable] - optional cancellable object
* @returns {Promise<string>} - The process output
*/
async function execCommunicate(argv, input = null, cancellable = null) {
  let cancelId = 0;
  let flags = (Gio.SubprocessFlags.STDOUT_PIPE |
               Gio.SubprocessFlags.STDERR_PIPE);

  if (input !== null)
      flags |= Gio.SubprocessFlags.STDIN_PIPE;

  let proc = new Gio.Subprocess({
      argv: argv,
      flags: flags
  });
  proc.init(cancellable);
  
  if (cancellable instanceof Gio.Cancellable) {
      cancelId = cancellable.connect(() => proc.force_exit());
  }

  return new Promise((resolve, reject) => {
      proc.communicate_utf8_async(input, null, (proc, res) => {
          try {
              let [, stdout, stderr] = proc.communicate_utf8_finish(res);
              let status = proc.get_exit_status();

              if (status !== 0) {
                  throw new Gio.IOErrorEnum({
                      code: Gio.io_error_from_errno(status),
                      message: stderr ? stderr.trim() : GLib.strerror(status)
                  });
              }

              resolve(stdout.trim());
          } catch (e) {
              reject(e);
          } finally {
              if (cancelId > 0) {
                  cancellable.disconnect(cancelId);
              }
          }
      });
  });
}

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('Simple Monitor'));

        let _settings = ExtensionUtils.getSettings();

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
        //Main Update function
        function Update() {

          let cpuOut = execCommunicate(['cat', '/proc/stat']);
          cpuOut.then(function(result) {
            let cpuUse = result.split(/[ ]+/);
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
          });

          let memOut = execCommunicate(['free']);
          memOut.then(function(result) {
            let lines = result.split("\n");
            let freeSpl = lines[1].split(/[ ]+/);
            let lblStr = '';
            if (_settings.get_boolean('mem-perc')) {
                let percmem = parseFloat(freeSpl[2])*100.0/parseFloat(freeSpl[1]);
                lblStr = ('  '+percmem.toFixed(1)+'%').slice(-6);
            }
            else {
                lblStr = ('  ' + (parseFloat(freeSpl[2])/2**20).toFixed(1) + '/' + (parseFloat(freeSpl[1])/2**20).toFixed(0) + 'Gb').slice(-10);
            }
            memPanelLabel.set_text(lblStr);
          });

          let cpuPOut = execCommunicate(['ps', 'axch' ,'-o', 'cmd:15,%cpu', '--sort=-%cpu']);
          cpuPOut.then(function(result) {
            let procs = result.split("\n");
            for (i = 0; i < 10; i++) {
              let cpuSpl = procs[i].split(/[ ]+/);
              let cpuName = "";
              for (j = 0; j < cpuSpl.length - 1; j++) {
                cpuName += cpuSpl[j]+" ";
              }
              cpuNameLabels[i].set_text(cpuName);
              cpulLabels[i].set_text(cpuSpl[cpuSpl.length - 1]);
            }
          });

          let memPOut = execCommunicate(['ps', 'axch' ,'-o', 'cmd:15,%mem', '--sort=-%mem']);
          memPOut.then(function(result) {
            let procs = result.split("\n");
            for (i = 0; i < 10; i++) {
              let cpuSpl = procs[i].split(/[ ]+/);
              let cpuName = "";
              for (j = 0; j < cpuSpl.length - 1; j++) {
                cpuName += cpuSpl[j]+" ";
              }
              memNameLabels[i].set_text(cpuName);
              memlLabels[i].set_text(cpuSpl[cpuSpl.length - 1]);
            }
          });
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

    _settingsChanged() {
        this.Update();
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
