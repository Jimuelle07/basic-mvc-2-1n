/*
 * GardenView — the face of "Night Garden".
 *
 * Pure presentation. It turns a GardenModel snapshot into glowing SVG
 * flowers and never touches the model. It does NOT handle app input:
 * the buttons and fields it draws carry data-action / data-field hooks,
 * and the GardenController (if one is plugged in) listens for them.
 *
 * Purely cosmetic behaviour is allowed to live in a View: the live hue
 * swatch next to the slider and the "dead click" ripple are decoration,
 * they change no data and call no model.
 */
(function (ns) {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const PETALS = [0, 0, 5, 6, 7, 8];

  /** Inline SVG art for one flower. bloom 1 = bud … 5 = full luminous bloom. */
  function flowerArt(f) {
    const h = ((Number(f.hue) % 360) + 360) % 360;
    const b = Math.max(1, Math.min(5, Number(f.bloom) || 1));
    const cy = 56 - b * 4;                 // head rises as it grows
    const gid = `gd-glow-${f.id}`;
    const petal = `hsl(${h}, 88%, ${62 + b * 2}%)`;
    const petalDeep = `hsl(${h}, 80%, 48%)`;
    const coreCol = `hsl(${(h + 45) % 360}, 95%, 78%)`;
    const stem = 'hsl(145, 38%, 34%)';

    let head;
    if (b === 1) {
      head = `
        <path d="M40 ${cy + 6} C33 ${cy} 34 ${cy - 9} 40 ${cy - 15} C46 ${cy - 9} 47 ${cy} 40 ${cy + 6} Z"
              fill="${petal}" stroke="${petalDeep}" stroke-width="1"/>
        <path d="M40 ${cy + 7} C35 ${cy + 4} 34 ${cy - 1} 35 ${cy - 4} M40 ${cy + 7} C45 ${cy + 4} 46 ${cy - 1} 45 ${cy - 4}"
              stroke="hsl(145, 40%, 42%)" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    } else {
      const n = PETALS[b];
      const len = 6 + b * 3.6;
      const w = len * 0.42;
      let outer = '';
      for (let i = 0; i < n; i++) {
        outer += `<ellipse cx="40" cy="${(cy - len / 2 - 1.5).toFixed(1)}" rx="${w.toFixed(1)}" ry="${(len / 2).toFixed(1)}"
          transform="rotate(${(i * 360 / n).toFixed(1)} 40 ${cy})"/>`;
      }
      let inner = '';
      if (b >= 4) {
        const l2 = len * 0.62;
        for (let i = 0; i < n; i++) {
          inner += `<ellipse cx="40" cy="${(cy - l2 / 2 - 1).toFixed(1)}" rx="${(l2 * 0.4).toFixed(1)}" ry="${(l2 / 2).toFixed(1)}"
            transform="rotate(${(i * 360 / n + 180 / n).toFixed(1)} 40 ${cy})"/>`;
        }
      }
      head = `
        <g class="gd-petals" fill="${petal}" stroke="${petalDeep}" stroke-width=".8" fill-opacity=".92">${outer}</g>
        ${inner ? `<g fill="hsl(${h}, 95%, 82%)" fill-opacity=".85">${inner}</g>` : ''}
        <circle cx="40" cy="${cy}" r="${(2 + b * 0.9).toFixed(1)}" fill="${coreCol}"/>
        <circle cx="40" cy="${cy}" r="${(0.8 + b * 0.3).toFixed(1)}" fill="#fff" fill-opacity=".85"/>`;
    }

    const glowR = 10 + b * 6;
    const glowA = (0.12 + b * 0.1).toFixed(2);
    return `
      <svg class="gd-art" viewBox="0 0 80 110" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="${gid}">
            <stop offset="0" stop-color="hsl(${h}, 100%, 70%)" stop-opacity="${glowA}"/>
            <stop offset="1" stop-color="hsl(${h}, 100%, 60%)" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <g class="gd-sway">
          <circle class="gd-glow" cx="40" cy="${cy}" r="${glowR}" fill="url(#${gid})"/>
          <path d="M40 110 C38 ${92 - b} 43 ${cy + 26} 40 ${cy + 4}" stroke="${stem}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
          <path d="M40 ${cy + 34} C${30 - b} ${cy + 28} ${27 - b} ${cy + 34} ${30 - b} ${cy + 38} C34 ${cy + 40} 38 ${cy + 38} 40 ${cy + 34} Z" fill="${stem}"/>
          ${b >= 3 ? `<path d="M40 ${cy + 22} C${50 + b} ${cy + 16} ${53 + b} ${cy + 22} ${50 + b} ${cy + 26} C46 ${cy + 28} 42 ${cy + 26} 40 ${cy + 22} Z" fill="${stem}"/>` : ''}
          ${head}
        </g>
      </svg>`;
  }

  /** Grey, wilted outline flower used while the Model is unplugged. */
  function wiltedArt(i) {
    return `
      <svg class="gd-art gd-art--wilted" viewBox="0 0 80 110" aria-hidden="true" focusable="false">
        <g fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="3 3" stroke-linecap="round">
          <path d="M40 110 C40 84 44 66 52 56 C58 50 60 56 58 62"/>
          <g transform="rotate(${150 + i * 12} 57 66)">
            <ellipse cx="57" cy="56" rx="4" ry="9"/>
            <ellipse cx="57" cy="56" rx="4" ry="9" transform="rotate(60 57 66)"/>
            <ellipse cx="57" cy="56" rx="4" ry="9" transform="rotate(-60 57 66)"/>
            <circle cx="57" cy="66" r="3"/>
          </g>
          <path d="M41 92 C33 92 30 98 32 102"/>
        </g>
      </svg>`;
  }

  function pips(bloom, hue) {
    let s = '';
    for (let i = 1; i <= 5; i++) s += `<i class="gd-pip${i <= bloom ? ' is-on' : ''}"></i>`;
    return `<span class="gd-pips" style="--h:${hue}" aria-label="bloom ${bloom} of 5">${s}</span>`;
  }

  const DROP = '<svg viewBox="0 0 12 14" aria-hidden="true" focusable="false"><path d="M6 1 C6 1 1.5 6.5 1.5 9.2 A4.5 4.5 0 0 0 10.5 9.2 C10.5 6.5 6 1 6 1 Z" fill="currentColor"/></svg>';

  function cardInner(f) {
    const name = esc(f.name);
    return `
      ${flowerArt(f)}
      <span class="gd-name">${name}</span>
      ${pips(f.bloom, f.hue)}
      <span class="gd-acts">
        <button type="button" class="gd-act gd-act--water" data-action="water" data-id="${f.id}"
                aria-label="Water ${name}" title="water">${DROP}</button>
        <button type="button" class="gd-act gd-act--uproot" data-action="uproot" data-id="${f.id}"
                aria-label="Uproot ${name}" title="uproot">&times;</button>
      </span>`;
  }

  class GardenView {
    constructor(root, ctx) {
      this.root = root;
      this.ctx = ctx;
      this.mounted = false;
      this.el = null;
      this.cards = new Map();     // id -> { el, bloom, name, hue }
      this.orphan = false;
      this.toastTimer = null;
      this.firstPaint = true;
      // Presentation only: show where a click fell when nobody was listening.
      ctx.bus.on('demo:deadclick', (p) => { if (this.mounted) this.ripple(p); });
    }

    mount() {
      if (this.mounted) return;
      const hue = Math.floor(Math.random() * 360);
      const el = document.createElement('div');
      el.className = 'gd';
      el.innerHTML = `
        <div class="gd-plant">
          <input class="gd-input" data-field="name" type="text" maxlength="24" autocomplete="off"
                 spellcheck="false" placeholder="name a flower" aria-label="Flower name">
          <label class="gd-hue" style="--h:${hue}">
            <span class="gd-sr">Petal colour</span>
            <input class="gd-range" data-field="hue" type="range" min="0" max="359" value="${hue}">
            <span class="gd-swatch" aria-hidden="true"></span>
          </label>
          <button type="button" class="gd-btn" data-action="plant">Plant</button>
        </div>
        <div class="gd-meta">
          <span class="gd-count" aria-live="polite"></span>
          <button type="button" class="gd-clear" data-action="clear">clear garden</button>
        </div>
        <div class="gd-bed">
          <div class="gd-toast" role="alert" aria-live="assertive"></div>
          <div class="gd-flies" aria-hidden="true">
            ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<i class="gd-fly" style="--i:${i}"></i>`).join('')}
          </div>
          <ul class="gd-plots" aria-label="Flowers"></ul>
          <p class="gd-empty" hidden>bare soil, plant something</p>
          <p class="gd-note" hidden>The View still has its template&hellip; but no Model to fill it.</p>
          <div class="gd-soil" aria-hidden="true"></div>
        </div>`;
      this.root.appendChild(el);
      this.el = el;
      this.$plots = el.querySelector('.gd-plots');
      this.$count = el.querySelector('.gd-count');
      this.$toast = el.querySelector('.gd-toast');
      this.$empty = el.querySelector('.gd-empty');
      this.$note = el.querySelector('.gd-note');
      this.$bed = el.querySelector('.gd-bed');

      // Cosmetic: live hue preview. Changes no data; the Controller reads the value later.
      const range = el.querySelector('[data-field="hue"]');
      const wrap = el.querySelector('.gd-hue');
      range.addEventListener('input', () => wrap.style.setProperty('--h', range.value));

      this.cards.clear();
      this.orphan = false;
      this.firstPaint = true;
      this.mounted = true;
    }

    unmount() {
      if (!this.mounted) return;
      clearTimeout(this.toastTimer);
      if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
      this.el = null;
      this.cards.clear();
      this.mounted = false;
    }

    /** Redraw the bed + counter only; inputs and focus are left alone. */
    render(snapshot) {
      if (!this.mounted || !snapshot) return;
      this.el.classList.remove('is-orphan');
      if (this.orphan) {
        this.$plots.innerHTML = '';
        this.cards.clear();
        this.orphan = false;
      }
      this.$note.hidden = true;
      this.$count.innerHTML = `<b>${snapshot.count}</b> / ${snapshot.capacity} flowers`;
      this.$empty.hidden = snapshot.count > 0;
      this.el.classList.toggle('is-full', snapshot.count >= snapshot.capacity);

      const seen = new Set();
      snapshot.flowers.forEach((f, i) => {
        seen.add(f.id);
        const prev = this.cards.get(f.id);
        if (!prev) {
          const li = document.createElement('li');
          li.className = 'gd-flower gd-flower--new';
          li.dataset.flower = f.id;
          li.style.setProperty('--h', f.hue);
          li.style.setProperty('--d', `${(f.id * 0.73) % 3}s`);
          if (this.firstPaint) li.style.animationDelay = `${i * 90}ms`;
          li.innerHTML = cardInner(f);
          li.addEventListener('animationend', (e) => {
            if (e.target === li && e.animationName === 'gd-grow') {
              li.classList.remove('gd-flower--new');
              li.style.animationDelay = '';
            }
          });
          this.$plots.appendChild(li);
          this.cards.set(f.id, { el: li, bloom: f.bloom, name: f.name, hue: f.hue });
        } else if (prev.bloom !== f.bloom || prev.name !== f.name || prev.hue !== f.hue) {
          const grew = f.bloom > prev.bloom;
          prev.el.innerHTML = cardInner(f);
          prev.el.classList.toggle('is-full', f.bloom >= 5);
          if (grew) {
            prev.el.classList.remove('gd-flower--watered');
            void prev.el.offsetWidth;            // restart the pulse
            prev.el.classList.add('gd-flower--watered');
          }
          Object.assign(prev, { bloom: f.bloom, name: f.name, hue: f.hue });
        }
        const card = this.cards.get(f.id);
        card.el.classList.toggle('is-full', f.bloom >= 5);
      });

      // Uprooted: let them fade into the soil, then remove.
      this.cards.forEach((card, id) => {
        if (seen.has(id)) return;
        this.cards.delete(id);
        card.el.classList.add('gd-flower--gone');
        card.el.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        setTimeout(() => card.el.remove(), 520);
      });
      this.firstPaint = false;
    }

    /** View alive, Model unplugged: the template with nothing to fill it. */
    renderOrphan() {
      if (!this.mounted) return;
      this.orphan = true;
      this.cards.clear();
      this.el.classList.add('is-orphan');
      this.$count.textContent = 'undefined / undefined';
      this.$empty.hidden = true;
      this.$note.hidden = false;
      let html = '';
      for (let i = 0; i < 3; i++) {
        html += `
          <li class="gd-flower gd-flower--orphan" style="--d:${i * 0.8}s">
            ${wiltedArt(i)}
            <span class="gd-name gd-name--hole">${i === 0 ? '{{ flower.name }}' : 'undefined'}</span>
            <span class="gd-pips gd-pips--hole">NaN</span>
            <span class="gd-acts">
              <button type="button" class="gd-act gd-act--water" data-action="water" data-id="undefined" aria-label="Water undefined">${DROP}</button>
              <button type="button" class="gd-act gd-act--uproot" data-action="uproot" data-id="undefined" aria-label="Uproot undefined">&times;</button>
            </span>
          </li>`;
      }
      this.$plots.innerHTML = html;
    }

    showFault(message) {
      if (!this.mounted) return;
      const t = this.$toast;
      t.textContent = message;
      t.classList.remove('is-shown');
      void t.offsetWidth;
      t.classList.add('is-shown');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        t.classList.remove('is-shown');
      }, 3500);
    }

    readInput() {
      if (!this.mounted) return { name: '', hue: 0 };
      return {
        name: this.el.querySelector('[data-field="name"]').value,
        hue: Number(this.el.querySelector('[data-field="hue"]').value),
      };
    }

    clearInput() {
      if (!this.mounted) return;
      this.el.querySelector('[data-field="name"]').value = '';
    }

    /** Cosmetic: a click that nobody heard, fizzling out where it landed. */
    ripple({ x, y }) {
      if (!this.el || typeof x !== 'number') return;
      const r = this.el.getBoundingClientRect();
      const dot = document.createElement('span');
      dot.className = 'gd-ripple';
      dot.style.left = `${x - r.left}px`;
      dot.style.top = `${y - r.top}px`;
      dot.innerHTML = '<i></i><i></i><em>no controller listening</em>';
      this.el.appendChild(dot);
      setTimeout(() => dot.remove(), 1700);
    }
  }

  ns.GardenView = GardenView;
})(window.MVCX = window.MVCX || {});
