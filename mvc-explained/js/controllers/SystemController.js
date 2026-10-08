/*
 * SystemController — turns user intent about the architecture
 * (unplug / replug a part) into changes on the SystemModel.
 *
 * Views never touch the SystemModel directly; they emit intents:
 *   bus.emit('intent:toggle', { part })
 *   bus.emit('intent:set',    { part, alive })
 *   bus.emit('intent:restore')
 * Keyboard: M / V / C toggle a part, R restores everything.
 */
(function (ns) {
  'use strict';

  const KEYS = { m: 'model', v: 'view', c: 'controller' };

  class SystemController {
    constructor(ctx) {
      this.ctx = ctx;
      this.offs = [];
      this.onKey = this.onKey.bind(this);
    }

    attach() {
      const { bus, system } = this.ctx;
      this.offs.push(
        bus.on('intent:toggle', ({ part }) => system.toggle(part)),
        bus.on('intent:set', ({ part, alive }) => system.set(part, alive)),
        bus.on('intent:restore', () => system.restoreAll()),
      );
      document.addEventListener('keydown', this.onKey);
    }

    detach() {
      this.offs.forEach((off) => off());
      this.offs = [];
      document.removeEventListener('keydown', this.onKey);
    }

    onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (KEYS[key]) { this.ctx.system.toggle(KEYS[key]); e.preventDefault(); }
      else if (key === 'r') { this.ctx.system.restoreAll(); e.preventDefault(); }
    }
  }

  ns.SystemController = SystemController;
})(window.MVCX = window.MVCX || {});
