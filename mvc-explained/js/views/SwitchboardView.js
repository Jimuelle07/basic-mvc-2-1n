/*
 * SwitchboardView — three fuses you can pull. Pure presentation:
 * renders SystemModel state, and turns clicks into intents.
 */
(function (ns) {
  'use strict';

  const META = {
    model:      { letter: 'M', name: 'Model',      role: 'remembers & rules' },
    view:       { letter: 'V', name: 'View',       role: 'shows' },
    controller: { letter: 'C', name: 'Controller', role: 'listens & directs' },
  };

  class SwitchboardView {
    constructor(root, ctx) {
      this.root = root;
      this.ctx = ctx;
    }

    mount() {
      const parts = ns.SystemModel.PARTS;
      this.root.innerHTML = `
        <div class="fuses" role="group" aria-label="Plug or unplug each part">
          ${parts.map((p) => `
            <button type="button" class="fuse fuse--${p}" data-part="${p}" aria-pressed="true">
              <span class="fuse__letter">${META[p].letter}</span>
              <span class="fuse__text">
                <span class="fuse__name">${META[p].name}</span>
                <span class="fuse__role">${META[p].role}</span>
              </span>
              <span class="fuse__state"></span>
              <kbd class="fuse__key">${META[p].letter}</kbd>
            </button>`).join('')}
        </div>
        <div class="switchboard__status">
          <span class="pulse" aria-hidden="true"></span>
          <span class="switchboard__msg" aria-live="polite"></span>
          <button type="button" class="restore" data-restore>Plug everything back in <kbd>R</kbd></button>
        </div>`;

      this.root.addEventListener('click', (e) => {
        const fuse = e.target.closest('[data-part]');
        if (fuse) return this.ctx.bus.emit('intent:toggle', { part: fuse.dataset.part });
        if (e.target.closest('[data-restore]')) this.ctx.bus.emit('intent:restore');
      });

      this.ctx.bus.on('system:changed', () => this.render());
      this.render();
    }

    render() {
      const { system } = this.ctx;
      this.root.querySelectorAll('[data-part]').forEach((btn) => {
        const alive = system.isAlive(btn.dataset.part);
        btn.setAttribute('aria-pressed', String(alive));
        btn.classList.toggle('is-off', !alive);
        btn.querySelector('.fuse__state').textContent = alive ? 'plugged in' : 'unplugged';
      });
      const removed = system.removed();
      this.root.classList.toggle('is-broken', removed.length > 0);
      this.root.querySelector('.switchboard__msg').textContent = removed.length === 0
        ? 'All three parts connected. Try unplugging one.'
        : removed.length === 3
          ? 'Nothing left. Just a user, clicking into the void.'
          : `${removed.map((p) => META[p].name).join(' and ')} unplugged. The app is broken: try using it.`;
    }
  }

  ns.SwitchboardView = SwitchboardView;
})(window.MVCX = window.MVCX || {});
