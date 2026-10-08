/*
 * app.js — the composition root.
 * The only file that knows about every part. It builds the parts, wires
 * them together, and re-wires them whenever a part is unplugged or
 * plugged back in.
 *
 * The shared context object (ctx) handed to every View / Controller:
 *   ctx.bus                 EventBus
 *   ctx.system              SystemModel
 *   ctx.model               GardenModel, or null while the Model is unplugged
 *   ctx.flow(from,to,label) emit a message travelling between parts; returns ok (bool)
 *                           parts: 'user' | 'controller' | 'model' | 'view'
 *   ctx.log(level,text,meta)
 *   ctx.fault(part, err)    record a real runtime error raised inside `part`
 */
(function (ns) {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  function boot() {
    const bus = new ns.EventBus();
    const system = new ns.SystemModel(bus);
    const garden = new ns.GardenModel();

    const ctx = {
      bus,
      system,
      get model() { return system.isAlive('model') ? garden : null; },

      flow(from, to, label) {
        const ok = system.isAlive(from) && system.isAlive(to);
        const dead = !system.isAlive(to) ? to : from;
        bus.emit('flow', { from, to, label, ok, time: Date.now() });
        system.log(ok ? 'flow' : 'error',
          ok ? label : `${label} — but the ${dead} is unplugged`,
          { from, to });
        return ok;
      },

      log(level, text, meta) { return system.log(level, text, meta); },

      fault(part, err) {
        const text = `${err && err.name ? err.name : 'Error'}: ${err && err.message ? err.message : err}`;
        bus.emit('fault', { part, error: err, text });
        return system.log('error', text, { from: part });
      },
    };

    // ---- parts ---------------------------------------------------------
    const demoRoot = $('#demo');
    const gardenView = new ns.GardenView(demoRoot, ctx);
    const ghostView = new ns.GhostView(demoRoot, ctx);
    const gardenController = new ns.GardenController(demoRoot, ctx, gardenView);

    const diagramView = new ns.DiagramView($('#diagram'), ctx);
    const switchboardView = new ns.SwitchboardView($('#switchboard'), ctx);
    const inspectorView = new ns.InspectorView($('#inspector'), ctx);
    const guideView = new ns.GuideView($('#guide'), ctx);
    const systemController = new ns.SystemController(ctx);

    // ---- Model → View observation (the heart of MVC) --------------------
    garden.subscribe((snapshot, action) => {
      bus.emit('model:snapshot', { snapshot, action });
      ctx.flow('model', 'view', `notify("${action}")`);
      if (system.isAlive('view')) {
        gardenView.render(snapshot);
        ctx.flow('view', 'user', 'repaint the garden');
      } else {
        ghostView.update(snapshot);
      }
    });

    // ---- a click with no Controller listening falls on the floor --------
    demoRoot.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target || system.isAlive('controller')) return;
      e.preventDefault();
      ctx.flow('user', 'controller', `click "${target.dataset.action}"`);
      bus.emit('demo:deadclick', { action: target.dataset.action, x: e.clientX, y: e.clientY });
    }, true);

    // ---- re-wiring when the architecture changes ------------------------
    function present() {
      const snap = system.isAlive('model') ? garden.snapshot() : null;
      if (system.isAlive('view')) {
        if (ghostView.mounted) ghostView.unmount();
        if (!gardenView.mounted) gardenView.mount();
        if (snap) gardenView.render(snap); else gardenView.renderOrphan();
      } else {
        if (gardenView.mounted) gardenView.unmount();
        if (!ghostView.mounted) ghostView.mount();
        ghostView.update(snap);
      }
    }

    bus.on('system:changed', ({ part, alive }) => {
      const name = part[0].toUpperCase() + part.slice(1);
      ctx.log(alive ? 'info' : 'warn', `${name} ${alive ? 'plugged back in' : 'unplugged'}.`, { from: part });
      if (part === 'controller') {
        if (alive) gardenController.attach(); else gardenController.detach();
      }
      present();
    });

    // ---- first paint ------------------------------------------------------
    diagramView.mount();
    switchboardView.mount();
    inspectorView.mount();
    guideView.mount();
    systemController.attach();
    gardenController.attach();
    present();
    bus.emit('model:snapshot', { snapshot: garden.snapshot(), action: 'boot' });
    ctx.log('info', 'All three parts plugged in. The garden is listening.');

    ns.app = {
      ctx, garden,
      parts: { gardenView, ghostView, gardenController, diagramView, switchboardView, inspectorView, guideView, systemController },
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.MVCX = window.MVCX || {});
