/*
 * InspectorView — the "x-ray" of the running app.
 * Three regions: the wire (message log), model memory, diagnosis.
 * Read-only: it listens to the bus / reads ctx and only emits intents.
 */
(function (ns) {
  'use strict';

  const MAX_ROWS = 80;
  const PART_LABEL = { user: 'User', controller: 'Controller', model: 'Model', view: 'View' };

  const INFO = {
    model: {
      essence: 'The Model remembers the data and enforces the rules.',
      symptom: 'The app forgets everything. Planting, watering and uprooting find nowhere to store anything, and the garden shows an empty plot.',
      why: 'The Controller has nothing to hand the request to, so every action ends in a runtime error. Nobody is left to say "the garden is full" or "that name is taken".',
      net: 'The controller action has no data service or DbContext, so it throws a NullReferenceException. The View renders an empty template.',
    },
    view: {
      essence: 'The View turns data into something a person can see.',
      symptom: 'You see nothing. Data still changes and the rules still hold, but the screen only shows a ghost of the numbers. Nobody can see the garden.',
      why: 'The Model still notifies, but nothing is subscribed to draw it. The work happens correctly in the dark.',
      net: 'The action returns View() but the .cshtml is missing: InvalidOperationException: The view \'Index\' was not found.',
    },
    controller: {
      essence: 'The Controller listens to the user and translates it into Model calls.',
      symptom: 'Buttons still render, but clicks fall on the floor. Nothing happens and nothing complains.',
      why: 'Model and View are healthy but deaf. Nothing translates a click into a call on the Model, so the conversation never starts.',
      net: 'No controller matches the route, so the request gets 404 Not Found. The page is served, but the form posts go nowhere.',
    },
  };

  const PAIR = {
    'model+view': 'With no Model and no View there is nothing to remember and nothing to show. The Controller still hears your clicks, but it has no one to call and no one to tell.',
    'controller+model': 'With no Controller and no Model, only the View is left: a pretty screen with nothing behind it. It can show the last thing it was given, and that is all.',
    'controller+view': 'With no Controller and no View, only the Model survives. It still holds your flowers and enforces its rules, but nobody can ask it anything and nobody can look at it.',
  };
  const ALL = 'Everything is unplugged. Nobody can ask, nobody can remember, nobody can show. The user is still there, clicking at a blank wall. Plug a part back in and watch which behaviour returns first.';

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n, l) => String(n).padStart(l || 2, '0');
  const cap = (p) => PART_LABEL[p] || p;

  function fmtTime(t) {
    const d = new Date(t);
    return pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + pad(d.getMilliseconds(), 3);
  }

  class InspectorView {
    constructor(root, ctx) {
      this.root = root;
      this.ctx = ctx;
      this.mounted = false;
      this.delivered = 0;
      this.dropped = 0;
      this.lastSnap = null;
      this.lastAction = null;
      this.prevKey = new Map();
      this.offs = [];
    }

    mount() {
      if (this.mounted) return;
      this.mounted = true;
      const r = this.root;
      r.classList.add('ins');
      r.innerHTML =
        '<section class="ins-col ins-wire" aria-labelledby="ins-wire-t">' +
          '<header class="ins-head"><h3 id="ins-wire-t" class="ins-title">The wire</h3>' +
            '<div class="ins-counters"><span class="ins-count ins-count--ok" title="messages delivered"><b data-ins="ok">0</b> delivered</span>' +
            '<span class="ins-count ins-count--bad" title="messages dropped"><b data-ins="bad">0</b> dropped</span>' +
            '<button type="button" class="ins-btn" data-ins="clear">clear</button></div></header>' +
          '<p class="ins-sub">Every message between the parts, newest first.</p>' +
          '<ol class="ins-log" data-ins="log" aria-live="off"></ol>' +
        '</section>' +
        '<section class="ins-col ins-mem" aria-labelledby="ins-mem-t">' +
          '<header class="ins-head"><h3 id="ins-mem-t" class="ins-title">Model memory</h3>' +
            '<div class="ins-counters"><span class="ins-count" data-ins="cap">0 / 0</span></div></header>' +
          '<p class="ins-sub" data-ins="action">Waiting for the first snapshot.</p>' +
          '<div class="ins-memwrap" data-ins="memwrap"><div class="ins-mem-body" data-ins="mem"></div>' +
            '<div class="ins-overlay" data-ins="overlay" hidden><span class="ins-overlay__icon" aria-hidden="true">&#9211;</span>' +
            '<p>unreachable &mdash; the data still exists, but nothing can reach it</p></div></div>' +
        '</section>' +
        '<section class="ins-col ins-diag" aria-labelledby="ins-diag-t">' +
          '<header class="ins-head"><h3 id="ins-diag-t" class="ins-title">Diagnosis</h3></header>' +
          '<div class="ins-diagbody" data-ins="diag" aria-live="polite"></div>' +
        '</section>';

      const q = (k) => r.querySelector('[data-ins="' + k + '"]');
      this.el = { log: q('log'), ok: q('ok'), bad: q('bad'), clear: q('clear'), mem: q('mem'), cap: q('cap'),
        action: q('action'), overlay: q('overlay'), memwrap: q('memwrap'), diag: q('diag') };

      this.el.clear.addEventListener('click', () => { this.el.log.innerHTML = ''; });
      r.addEventListener('click', (e) => {
        const b = e.target.closest('[data-ins-plug]');
        if (b) this.ctx.bus.emit('intent:set', { part: b.dataset.insPlug, alive: true });
      });

      const bus = this.ctx.bus;
      this.offs.push(bus.on('system:log', (en) => this.addRow(en, true)));
      this.offs.push(bus.on('flow', (m) => { if (m.ok) this.delivered++; else this.dropped++; this.counters(); }));
      this.offs.push(bus.on('model:snapshot', ({ snapshot, action }) => {
        this.lastSnap = snapshot; this.lastAction = action; this.renderMem(true);
      }));
      this.offs.push(bus.on('system:changed', () => { this.renderMem(false); this.renderDiag(); }));

      this.ctx.system.entries.forEach((en) => this.addRow(en, false));
      this.counters();
      this.renderMem(false);
      this.renderDiag();
    }

    unmount() {
      this.offs.forEach((f) => f());
      this.offs = [];
      this.root.innerHTML = '';
      this.mounted = false;
    }

    counters() {
      this.el.ok.textContent = this.delivered;
      this.el.bad.textContent = this.dropped;
    }

    // ---- region 1 -------------------------------------------------------
    addRow(en, live) {
      const lvl = ['error', 'warn', 'flow', 'info'].includes(en.level) ? en.level : 'info';
      const li = document.createElement('li');
      li.className = 'ins-row ins-row--' + lvl + (live ? ' ins-row--new' : '');
      let pair = '';
      if (en.from && en.to) {
        pair = '<span class="ins-pair"><span class="ins-p ins-p--' + esc(en.from) + '">' + esc(cap(en.from)) + '</span>' +
          '<span class="ins-arrow" aria-hidden="true">&rarr;</span><span class="ins-p ins-p--' + esc(en.to) + '">' + esc(cap(en.to)) + '</span></span>';
      } else if (en.from) {
        pair = '<span class="ins-pair"><span class="ins-p ins-p--' + esc(en.from) + '">' + esc(cap(en.from)) + '</span></span>';
      } else {
        pair = '<span class="ins-pair"><span class="ins-p ins-p--sys">System</span></span>';
      }
      li.innerHTML = '<time class="ins-time">' + fmtTime(en.time) + '</time>' + pair + '<span class="ins-text">' + esc(en.text) + '</span>';
      this.el.log.insertBefore(li, this.el.log.firstChild);
      while (this.el.log.children.length > MAX_ROWS) this.el.log.removeChild(this.el.log.lastChild);
    }

    // ---- region 2 -------------------------------------------------------
    renderMem(flash) {
      const alive = this.ctx.system.isAlive('model');
      this.el.memwrap.classList.toggle('is-dead', !alive);
      this.el.overlay.hidden = alive;
      const s = this.lastSnap;
      if (!s) { this.el.mem.innerHTML = '<p class="ins-empty">No data yet.</p>'; return; }
      this.el.cap.textContent = s.count + ' / ' + s.capacity;
      this.el.action.innerHTML = 'last action <code class="ins-code">' + esc(this.lastAction || '-') + '</code>';

      const next = new Map();
      let html = '<div class="ins-json"><span class="ins-brace">flowers: [</span>';
      if (!s.flowers.length) html += '<p class="ins-empty">[ ] an empty garden</p>';
      s.flowers.forEach((f) => {
        const key = f.name + '|' + f.hue + '|' + f.bloom;
        next.set(f.id, key);
        const changed = flash && this.prevKey.get(f.id) !== key;
        let pips = '';
        for (let i = 1; i <= 5; i++) pips += '<i class="ins-pip' + (i <= f.bloom ? ' is-on' : '') + '"></i>';
        html += '<div class="ins-flower' + (changed ? ' ins-flash' : '') + '">' +
          '<span class="ins-id">#' + esc(f.id) + '</span>' +
          '<span class="ins-swatch" style="background:hsl(' + (Number(f.hue) | 0) + ' 70% 62%)"></span>' +
          '<span class="ins-fname">' + esc(f.name) + '</span>' +
          '<span class="ins-hue">h' + esc(f.hue) + '</span>' +
          '<span class="ins-pips" title="bloom ' + esc(f.bloom) + '/5">' + pips + '</span></div>';
      });
      html += '<span class="ins-brace">]</span></div>';
      this.el.mem.innerHTML = html;
      this.prevKey = next;
    }

    // ---- region 3 -------------------------------------------------------
    renderDiag() {
      const gone = this.ctx.system.removed();
      let h = '';
      if (!gone.length) {
        h = '<div class="ins-verdict ins-verdict--ok"><h4 class="ins-verdict__t">Everything flows</h4>' +
          '<p>Click, rule, notify, repaint: the whole loop is running.</p></div>' +
          '<p class="ins-nudge">Try it: plant a flower, then pull a fuse and plant another.</p><ul class="ins-essence">' +
          ['model', 'view', 'controller'].map((p) => '<li class="ins-ess ins-ess--' + p + '"><b>' + cap(p) + '</b> ' + esc(INFO[p].essence.replace(/^The \w+ /, '')) + '</li>').join('') + '</ul>';
      } else {
        const title = gone.length === 3 ? 'Total blackout' : gone.length === 2 ? 'Two parts down' : cap(gone[0]) + ' unplugged';
        h = '<div class="ins-verdict ins-verdict--bad"><h4 class="ins-verdict__t">' + esc(title) + '</h4>';
        if (gone.length === 3) h += '<p>' + ALL + '</p>';
        else if (gone.length === 2) h += '<p>' + PAIR[gone.slice().sort().join('+')] + '</p>';
        h += '</div>';
        gone.forEach((p) => {
          const i = INFO[p];
          h += '<article class="ins-card ins-card--' + p + '"><header class="ins-card__h"><b>' + cap(p) + '</b> is missing' +
            '<button type="button" class="ins-btn ins-btn--plug" data-ins-plug="' + p + '">plug it back in</button></header>' +
            '<dl><dt>Symptom</dt><dd>' + esc(i.symptom) + '</dd><dt>Why</dt><dd>' + esc(i.why) + '</dd>' +
            '<dt>In ASP.NET Core</dt><dd class="ins-net">' + esc(i.net) + '</dd></dl></article>';
        });
      }
      this.el.diag.innerHTML = h;
    }
  }

  ns.InspectorView = InspectorView;
})(window.MVCX = window.MVCX || {});
