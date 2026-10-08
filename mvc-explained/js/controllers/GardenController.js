/*
 * GardenController — the only part of Night Garden that listens to input.
 *
 * It reads what the user typed/clicked, translates it into a call on the
 * Model, and reports rejections back to the View. It never repaints the
 * garden on success: the Model notifies its observers and app.js hands the
 * new snapshot to whichever View is plugged in.
 *
 * Note: ctx.model is deliberately used WITHOUT a null check. When the Model
 * is unplugged, ctx.model is null and the browser raises a real TypeError
 * ("Cannot read properties of null (reading 'plant')"). That error is the
 * lesson, so we catch it and report it rather than hiding it.
 */
(function (ns) {
  'use strict';

  const ACTIONS = ['plant', 'water', 'uproot', 'clear'];

  class GardenController {
    constructor(root, ctx, view) {
      this.root = root;
      this.ctx = ctx;
      this.view = view;
      this.attached = false;
      this.onClick = this.onClick.bind(this);
      this.onKey = this.onKey.bind(this);
    }

    attach() {
      if (this.attached) return;
      this.root.addEventListener('click', this.onClick);
      this.root.addEventListener('keydown', this.onKey);
      this.attached = true;
    }

    detach() {
      if (!this.attached) return;
      this.root.removeEventListener('click', this.onClick);
      this.root.removeEventListener('keydown', this.onKey);
      this.attached = false;
    }

    // ---- input ---------------------------------------------------------
    onClick(e) {
      const target = e.target.closest && e.target.closest('[data-action]');
      if (!target || !this.root.contains(target)) return;
      const action = target.dataset.action;
      if (!ACTIONS.includes(action)) return;
      e.preventDefault();
      this.handle(action, target.dataset.id, `click "${action}"`);
    }

    onKey(e) {
      if (e.key !== 'Enter' || e.isComposing) return;
      const t = e.target;
      if (!t || !t.matches || !t.matches('[data-field="name"]')) return;
      e.preventDefault();
      this.handle('plant', undefined, 'press Enter → "plant"');
    }

    /** Read straight from the DOM: works for GardenView and GhostView alike. */
    readInput() {
      const nameEl = this.root.querySelector('[data-field="name"]');
      const hueEl = this.root.querySelector('[data-field="hue"]');
      const name = nameEl ? nameEl.value.trim() : '';
      const hue = hueEl ? Number(hueEl.value) : Math.floor(Math.random() * 360);
      return { name, hue: Number.isFinite(hue) ? hue : 0 };
    }

    // ---- dispatch ------------------------------------------------------
    handle(action, rawId, gesture) {
      const { ctx, view } = this;
      ctx.flow('user', 'controller', gesture);

      let call;
      let run;
      if (action === 'plant') {
        const { name, hue } = this.readInput();
        call = `plant(${JSON.stringify(name)}, ${hue})`;
        run = () => ctx.model.plant(name, hue);
      } else if (action === 'water') {
        const id = Number(rawId);
        call = `water(${id})`;
        run = () => ctx.model.water(id);
      } else if (action === 'uproot') {
        const id = Number(rawId);
        call = `uproot(${id})`;
        run = () => ctx.model.uproot(id);
      } else {
        call = 'clear()';
        run = () => ctx.model.clear();
      }

      ctx.flow('controller', 'model', call);

      try {
        run();
        // Success: no render here. The Model notifies; app.js repaints the View.
        if (action === 'plant' && view.mounted) view.clearInput();
      } catch (err) {
        if (err && err.name === 'ValidationError') {
          ctx.flow('model', 'controller', `rejected: ${err.message}`);
          if (view.mounted) {
            ctx.flow('controller', 'view', 'showFault');
            view.showFault(err.message);
          } else {
            ctx.log('warn', `Rejected by the Model, but no View to tell the user: ${err.message}`, { from: 'controller' });
          }
        } else {
          ctx.fault('controller', err);
          if (view.mounted) {
            ctx.flow('controller', 'view', 'showFault');
            view.showFault('The Controller reached for the Model… and found nothing.');
          }
        }
      }
    }
  }

  ns.GardenController = GardenController;
})(window.MVCX = window.MVCX || {});
