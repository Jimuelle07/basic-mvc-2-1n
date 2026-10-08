/*
 * GhostView — what is left on screen while the real View is unplugged.
 *
 * A dead monitor: no garden, no petals, only the raw model snapshot as
 * JSON. It still carries a crude "raw console" (an input + a button with
 * the same data-field / data-action hooks) so you can poke the Controller
 * directly, like curl against an API with no front end. The Controller and
 * Model keep working; the result only ever shows up as text.
 */
(function (ns) {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Tiny JSON syntax colouring (mono, no libs). */
  function prettyJSON(value) {
    const json = esc(JSON.stringify(value, null, 2));
    return json.replace(
      /(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi,
      (m, str, colon, lit, num) => {
        if (str) return colon ? `<span class="gd-ghost-k">${str}</span>${colon}` : `<span class="gd-ghost-s">${str}</span>`;
        if (lit) return `<span class="gd-ghost-l">${lit}</span>`;
        return `<span class="gd-ghost-n">${num}</span>`;
      });
  }

  class GhostView {
    constructor(root, ctx) {
      this.root = root;
      this.ctx = ctx;
      this.mounted = false;
      this.el = null;
      this.last = undefined;
    }

    mount() {
      if (this.mounted) return;
      const el = document.createElement('div');
      el.className = 'gd-ghost';
      el.innerHTML = `
        <div class="gd-ghost-screen">
          <div class="gd-ghost-noise" aria-hidden="true"></div>
          <div class="gd-ghost-scan" aria-hidden="true"></div>
          <div class="gd-ghost-copy">
            <p class="gd-ghost-tag">NO SIGNAL &middot; view: null</p>
            <h3 class="gd-ghost-title">No View.</h3>
            <p class="gd-ghost-sub">The data is still here. It just has no face.</p>
          </div>
        </div>
        <div class="gd-ghost-raw">
          <div class="gd-ghost-rawhead"><span>model.snapshot()</span><span class="gd-ghost-live">live</span></div>
          <pre class="gd-ghost-json" aria-live="polite"></pre>
        </div>
        <div class="gd-ghost-console">
          <label class="gd-ghost-prompt" for="gd-ghost-cmd">&gt; plant</label>
          <input id="gd-ghost-cmd" class="gd-ghost-input" data-field="name" type="text" maxlength="24"
                 autocomplete="off" spellcheck="false" placeholder="&quot;Nightshade&quot;">
          <button type="button" class="gd-ghost-run" data-action="plant">run &crarr;</button>
        </div>
        <p class="gd-ghost-hint">raw console: talks straight to the Controller. No View will draw the result.</p>`;
      this.root.appendChild(el);
      this.el = el;
      this.$json = el.querySelector('.gd-ghost-json');
      this.$sub = el.querySelector('.gd-ghost-sub');
      this.last = undefined;
      this.mounted = true;
    }

    unmount() {
      if (!this.mounted) return;
      if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
      this.el = null;
      this.mounted = false;
    }

    update(snapshot) {
      if (!this.mounted) return;
      const dead = snapshot == null;
      this.el.classList.toggle('is-void', dead);
      this.$sub.textContent = dead
        ? 'No View, no Model. Nothing to show, and nothing to show it with.'
        : 'The data is still here. It just has no face.';
      const text = dead ? 'null' : JSON.stringify(snapshot);
      if (text === this.last) return;
      const changed = this.last !== undefined;
      this.last = text;
      this.$json.innerHTML = dead ? '<span class="gd-ghost-l">null</span>' : prettyJSON(snapshot);

      if (changed) {
        this.$json.classList.remove('is-flash');
        void this.$json.offsetWidth;
        this.$json.classList.add('is-flash');
      }

      // Cosmetic tidy-up: once the typed name shows up in the data, empty the prompt.
      const input = this.el.querySelector('[data-field="name"]');
      if (!dead && input && input.value.trim()) {
        const typed = input.value.trim().toLowerCase();
        if ((snapshot.flowers || []).some((f) => String(f.name).toLowerCase() === typed)) input.value = '';
      }
    }
  }

  ns.GhostView = GhostView;
})(window.MVCX = window.MVCX || {});
