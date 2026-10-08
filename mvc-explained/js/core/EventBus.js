/*
 * EventBus — the tiny pub/sub nervous system every part talks through.
 * Classic script (no modules) so index.html opens straight from disk.
 */
(function (ns) {
  'use strict';

  class EventBus {
    constructor() {
      this.handlers = new Map();
    }

    /** Subscribe. Returns an unsubscribe function. */
    on(type, fn) {
      if (!this.handlers.has(type)) this.handlers.set(type, new Set());
      this.handlers.get(type).add(fn);
      return () => this.handlers.get(type).delete(fn);
    }

    emit(type, payload) {
      const set = this.handlers.get(type);
      if (!set) return;
      for (const fn of [...set]) {
        try { fn(payload); } catch (err) { console.error(`[bus:${type}]`, err); }
      }
    }
  }

  ns.EventBus = EventBus;
})(window.MVCX = window.MVCX || {});
