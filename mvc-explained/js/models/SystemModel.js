/*
 * SystemModel — the state of the *architecture itself*.
 * Which of the three parts are plugged in, plus the running message log.
 *
 * Events emitted on the bus:
 *   'system:changed' { parts, part, alive }
 *   'system:log'     LogEntry
 *
 * LogEntry = { id, time, level: 'info'|'flow'|'warn'|'error', from?, to?, text }
 */
(function (ns) {
  'use strict';

  const PARTS = ['model', 'view', 'controller'];
  const MAX_LOG = 200;

  class SystemModel {
    constructor(bus) {
      this.bus = bus;
      this.parts = { model: true, view: true, controller: true };
      this.entries = [];
      this.seq = 0;
    }

    static get PARTS() { return PARTS; }

    /** 'user' is always present — you can't unplug the person using the app. */
    isAlive(part) {
      return part === 'user' ? true : !!this.parts[part];
    }

    isHealthy() {
      return PARTS.every((p) => this.parts[p]);
    }

    removed() {
      return PARTS.filter((p) => !this.parts[p]);
    }

    set(part, alive) {
      if (!PARTS.includes(part) || this.parts[part] === !!alive) return;
      this.parts[part] = !!alive;
      this.bus.emit('system:changed', { parts: { ...this.parts }, part, alive: !!alive });
    }

    toggle(part) {
      this.set(part, !this.parts[part]);
    }

    restoreAll() {
      PARTS.forEach((p) => this.set(p, true));
    }

    log(level, text, meta = {}) {
      const entry = { id: ++this.seq, time: Date.now(), level, text, ...meta };
      this.entries.push(entry);
      if (this.entries.length > MAX_LOG) this.entries.shift();
      this.bus.emit('system:log', entry);
      return entry;
    }
  }

  ns.SystemModel = SystemModel;
})(window.MVCX = window.MVCX || {});
