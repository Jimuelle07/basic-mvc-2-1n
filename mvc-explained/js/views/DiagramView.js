/*
 * DiagramView — the hero visual: the MVC triad as a living constellation.
 * Pure presentation. Listens to the bus ('flow', 'system:changed', 'fault'),
 * draws messages as comets travelling the wires, and turns clicks on a node
 * into an 'intent:toggle'. It never touches a model.
 */
(function (ns) {
  'use strict';

  const SVGNS = 'http://www.w3.org/2000/svg';
  const W = 600, H = 548, CX = 300, CY = 262;
  const TRIM = 56;          // edges stop this far from a node centre
  const STAGGER = 380;      // ms between relayed particles
  const MAX_QUEUE = 12;
  const TRAIL = 6;          // trail beads per comet

  const NODES = {
    user:       { x: 300, y: 438, name: 'User',       role: 'you',               glyph: null, tilt: 0,
                  label: { anchor: 'middle', dx: 0, dy: 86 } },
    controller: { x: 112, y: 262, name: 'Controller', role: 'listens & directs', glyph: 'C', tilt: -7,
                  label: { anchor: 'end', dx: 34, dy: 90 } },
    model:      { x: 300, y: 88,  name: 'Model',      role: 'remembers & rules', glyph: 'M', tilt: 5,
                  label: { anchor: 'middle', dx: 0, dy: 86 } },
    view:       { x: 488, y: 262, name: 'View',       role: 'shows',             glyph: 'V', tilt: 7,
                  label: { anchor: 'start', dx: -34, dy: 90 } },
  };
  const TOGGLEABLE = ['controller', 'model', 'view'];

  // bend > 0 bows along the left-hand normal of from→to (outward for the clockwise loop)
  const EDGES = [
    { from: 'user',       to: 'controller', bend: 46, step: '1' },
    { from: 'controller', to: 'model',      bend: 46, step: '2' },
    { from: 'model',      to: 'view',       bend: 46, step: '3' },
    { from: 'view',       to: 'user',       bend: 46, step: '4' },
    { from: 'model',      to: 'controller', bend: 30, label: 'rejected',   secondary: true },
    { from: 'controller', to: 'view',       bend: -40, label: 'show error', secondary: true },
  ];

  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function seeded(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const f1 = (n) => n.toFixed(1);

  function trim(px, py, tx, ty, d) {
    const dx = tx - px, dy = ty - py, len = Math.hypot(dx, dy) || 1;
    return [px + (dx / len) * d, py + (dy / len) * d];
  }

  class DiagramView {
    constructor(root, ctx) {
      this.root = root;
      this.ctx = ctx;
      this.nodes = {};
      this.edges = {};
      this.edgeList = [];
      this.particles = [];
      this.sparks = [];
      this.queue = [];
      this.lastStart = -1e9;
      this.lastT = 0;
      this.raf = null;
      this.dirty = true;
      this.timers = new WeakMap();
      this.reduced = false;
      if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.reduced = mq.matches;
        const onChange = (e) => { this.reduced = e.matches; };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
      }
    }

    // ------------------------------------------------------------------ mount
    mount() {
      this.root.classList.add('dg');
      this.root.textContent = '';

      const wrap = document.createElement('div');
      wrap.className = 'dg-wrap';
      this.root.appendChild(wrap);

      const svg = el('svg', {
        class: 'dg-svg',
        viewBox: `0 0 ${W} ${H}`,
        role: 'group',
        'aria-label': 'The MVC triad: you, the Controller, the Model and the View. Activate a part to unplug it or plug it back in.',
      }, wrap);
      this.svg = svg;

      this.buildDefs(svg);
      this.buildSky(el('g', { class: 'dg-sky', 'aria-hidden': 'true' }, svg));
      this.edgeLayer = el('g', { class: 'dg-edges', 'aria-hidden': 'true' }, svg);
      this.nodeLayer = el('g', { class: 'dg-nodes' }, svg);
      this.fxLayer = el('g', { class: 'dg-fx', 'aria-hidden': 'true' }, svg);

      EDGES.forEach((def, i) => this.buildEdge(def, i));
      Object.keys(NODES).forEach((p) => this.buildNode(p));

      const caption = document.createElement('p');
      caption.className = 'dg-caption';
      caption.setAttribute('aria-hidden', 'true');
      caption.innerHTML = '<span class="dg-caption__idle">waiting for a message… try planting a flower</span>';
      wrap.appendChild(caption);
      this.caption = caption;

      // initial state, no animation
      const parts = (this.ctx.system && this.ctx.system.parts) || {};
      TOGGLEABLE.forEach((p) => this.applyState(p, parts[p] !== false, false));
      this.updateGeometry();

      const bus = this.ctx.bus;
      bus.on('flow', (msg) => this.onFlow(msg));
      bus.on('system:changed', (e) => {
        if (e && e.part) this.applyState(e.part, !!e.alive, true);
        else TOGGLEABLE.forEach((p) => this.applyState(p, this.ctx.system.isAlive(p), true));
      });
      bus.on('fault', (e) => {
        const n = e && this.nodes[e.part];
        if (n) this.pulseClass(n.g, 'dg-node--fault', 950);
      });

      this.kick();
    }

    buildDefs(svg) {
      const defs = el('defs', null, svg);

      const glow = el('filter', { id: 'dg-glow', x: '-150%', y: '-150%', width: '400%', height: '400%' }, defs);
      el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '3.2', result: 'b' }, glow);
      const m1 = el('feMerge', null, glow);
      el('feMergeNode', { in: 'b' }, m1);
      el('feMergeNode', { in: 'SourceGraphic' }, m1);

      const wide = el('filter', {
        id: 'dg-glow-wide', filterUnits: 'userSpaceOnUse',
        x: -40, y: -40, width: W + 80, height: H + 80,
      }, defs);
      el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '2.4', result: 'b' }, wide);
      const m2 = el('feMerge', null, wide);
      el('feMergeNode', { in: 'b' }, m2);
      el('feMergeNode', { in: 'SourceGraphic' }, m2);

      const stops = (g, list) => list.forEach(([off, cls, op]) =>
        el('stop', { offset: off, class: `dg-stop--${cls}`, 'stop-opacity': op }, g));

      Object.keys(NODES).forEach((p) => {
        const orb = el('radialGradient', { id: `dg-orb-${p}`, cx: '.5', cy: '.5', r: '.5', fx: '.36', fy: '.32' }, defs);
        stops(orb, [['0', 'paper', '.95'], ['.32', p, '1'], ['.78', p, '.72'], ['1', p, '.28']]);
        const halo = el('radialGradient', { id: `dg-halo-${p}` }, defs);
        stops(halo, [['0', p, '.42'], ['.45', p, '.13'], ['1', p, '0']]);
      });
      const off = el('radialGradient', { id: 'dg-orb-off', cx: '.5', cy: '.5', r: '.5', fx: '.4', fy: '.36' }, defs);
      stops(off, [['0', 'muted', '.42'], ['.7', 'muted', '.16'], ['1', 'muted', '.06']]);
      this.defs = defs;
    }

    buildSky(g) {
      const rnd = seeded(20240611);
      el('circle', { class: 'dg-orbit', cx: CX, cy: CY, r: 206 }, g);
      el('circle', { class: 'dg-orbit dg-orbit--inner', cx: CX, cy: CY, r: 120 }, g);
      for (let i = 0; i < 46; i++) {
        const s = el('circle', {
          class: 'dg-star',
          cx: f1(rnd() * W), cy: f1(rnd() * H), r: f1(0.4 + rnd() * 1.1),
        }, g);
        s.style.animationDuration = f1(3 + rnd() * 6) + 's';
        s.style.animationDelay = '-' + f1(rnd() * 8) + 's';
      }
      for (let i = 0; i < 6; i++) {
        const x = 30 + rnd() * (W - 60), y = 20 + rnd() * (H - 40), r = 2.5 + rnd() * 2.5;
        const sp = el('path', {
          class: 'dg-sparkle',
          d: `M${f1(x)} ${f1(y - r * 2)} Q${f1(x)} ${f1(y)} ${f1(x + r * 2)} ${f1(y)} Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y + r * 2)} Q${f1(x)} ${f1(y)} ${f1(x - r * 2)} ${f1(y)} Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y - r * 2)}Z`,
        }, g);
        sp.style.animationDelay = '-' + f1(rnd() * 6) + 's';
      }
      const tints = ['user', 'model', 'view', 'controller'];
      for (let i = 0; i < 8; i++) {
        const d = el('circle', {
          class: `dg-dust dg-c-${tints[i % 4]}`,
          cx: f1(rnd() * W), cy: f1(rnd() * H), r: f1(1.1 + rnd() * 1.4),
        }, g);
        d.style.animationDuration = f1(16 + rnd() * 16) + 's';
        d.style.animationDelay = '-' + f1(rnd() * 20) + 's';
      }
    }

    buildEdge(def, i) {
      const key = `${def.from}>${def.to}`;
      const gid = `dg-eg-${i}`;
      const grad = el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse' }, this.defs);
      el('stop', { offset: '0', class: `dg-stop--${def.from}` }, grad);
      el('stop', { offset: '1', class: `dg-stop--${def.to}` }, grad);

      const g = el('g', { class: 'dg-edge' + (def.secondary ? ' dg-edge--secondary' : '') }, this.edgeLayer);
      const ghost = el('path', { class: 'dg-edge__ghost', stroke: `url(#${gid})` }, g);
      const wire = el('path', { class: 'dg-edge__wire', stroke: `url(#${gid})`, filter: 'url(#dg-glow-wide)' }, g);
      const flow = el('path', { class: 'dg-edge__flow', stroke: `url(#${gid})` }, g);
      const flash = el('path', { class: 'dg-edge__flash', filter: 'url(#dg-glow-wide)' }, g);

      const fray = el('g', { class: 'dg-fray' }, g);
      el('line', { x1: 0, y1: 0, x2: 7, y2: -4.5 }, fray);
      el('line', { x1: 0, y1: 0, x2: 8.5, y2: 0.5 }, fray);
      el('line', { x1: 0, y1: 0, x2: 6, y2: 5 }, fray);
      el('circle', { cx: 10, cy: -1, r: 1.5 }, fray);
      el('circle', { cx: 8, cy: 5, r: 1, class: 'dg-fray__late' }, fray);

      let label = null;
      if (def.step) {
        label = el('g', { class: 'dg-badge' }, g);
        el('circle', { r: 9 }, label);
        const t = el('text', { y: 0.5 }, label);
        t.textContent = def.step;
      } else if (def.label) {
        label = el('text', { class: 'dg-edge__label' }, g);
        label.textContent = def.label;
      }

      const e = Object.assign({}, def, {
        key, g, grad, ghost, wire, flow, flash, fray, label,
        d: '', L: 1, droop: 0, droopV: 0, droopT: 0, cut: null, deadEnd: null,
      });
      this.edges[key] = e;
      this.edgeList.push(e);
    }

    buildNode(p) {
      const def = NODES[p];
      const toggle = TOGGLEABLE.includes(p);
      const g = el('g', { class: `dg-node dg-node--${p} dg-c-${p}` }, this.nodeLayer);
      if (toggle) {
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'button');
        g.setAttribute('aria-pressed', 'true');
        g.setAttribute('aria-label', `Unplug ${def.name}`);
      } else {
        g.setAttribute('role', 'img');
        g.setAttribute('aria-label', 'You, the user. Always plugged in.');
      }

      const body = el('g', { class: 'dg-node__body' }, g);
      el('circle', { class: 'dg-node__halo', r: 78, fill: `url(#dg-halo-${p})` }, body);
      el('circle', { class: 'dg-ring dg-ring--outer', r: 60 }, body);
      el('circle', { class: 'dg-ring dg-ring--inner', r: 49 }, body);
      const orb = el('circle', { class: 'dg-node__orb', r: 36, fill: `url(#dg-orb-${p})`, filter: 'url(#dg-glow)' }, body);
      el('circle', { class: 'dg-node__rim', r: 36 }, body);
      if (def.glyph) {
        const t = el('text', { class: 'dg-node__glyph', y: 12 }, body);
        t.textContent = def.glyph;
      } else {
        const person = el('g', { class: 'dg-node__person' }, body);
        el('circle', { cx: 0, cy: -9, r: 8 }, person);
        el('path', { d: 'M-15 18 Q-15 2 0 2 Q15 2 15 18 Z' }, person);
      }
      el('circle', { class: 'dg-node__bloom', r: 38 }, body);
      el('circle', { class: 'dg-node__fault', r: 44 }, body);
      el('circle', { class: 'dg-node__focus', r: 68 }, body);
      el('circle', { class: 'dg-node__hit', r: 64 }, body);

      if (toggle) {
        const tag = el('g', { class: 'dg-node__tag', 'aria-hidden': 'true' }, body);
        el('rect', { x: -46, y: -10, width: 92, height: 20, rx: 3 }, tag);
        const tt = el('text', { y: 0.5 }, tag);
        tt.textContent = 'UNPLUGGED';
      }

      const lab = def.label;
      const name = el('text', { class: 'dg-node__name', x: lab.dx, y: lab.dy, 'text-anchor': lab.anchor }, g);
      name.textContent = def.name;
      const role = el('text', { class: 'dg-node__role', x: lab.dx, y: lab.dy + 18, 'text-anchor': lab.anchor }, g);
      role.textContent = def.role;

      if (toggle) {
        const fire = () => this.ctx.bus.emit('intent:toggle', { part: p });
        g.addEventListener('click', fire);
        g.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            e.stopPropagation();
            fire();
          }
        });
      }

      const n = {
        id: p, def, g, orb, alive: true,
        hx: def.x, hy: def.y, x: def.x, y: def.y, rot: 0,
        tx: def.x, ty: def.y, trot: 0, vx: 0, vy: 0, vr: 0, k: 0.16, damp: 0.74,
        tf: '',
      };
      this.nodes[p] = n;
      this.setTransform(n);
    }

    // ------------------------------------------------------------------ state
    isAlive(p) {
      return p === 'user' || !!(this.nodes[p] && this.nodes[p].alive);
    }

    applyState(part, alive, animate) {
      const n = this.nodes[part];
      if (!n || part === 'user') return;
      const was = n.alive;
      n.alive = alive;
      n.g.classList.toggle('dg-node--off', !alive);
      n.g.setAttribute('aria-pressed', String(alive));
      n.g.setAttribute('aria-label', (alive ? 'Unplug ' : 'Plug in ') + n.def.name);
      n.orb.setAttribute('fill', alive ? `url(#dg-orb-${part})` : 'url(#dg-orb-off)');

      if (alive) {
        n.tx = n.hx; n.ty = n.hy; n.trot = 0; n.k = 0.17; n.damp = 0.72;
      } else {
        const dx = n.hx - CX, dy = n.hy - CY, len = Math.hypot(dx, dy) || 1;
        n.tx = n.hx + (dx / len) * 16;
        n.ty = n.hy + (dy / len) * 16 + 12;
        n.trot = n.def.tilt;
        n.k = 0.022; n.damp = 0.9;
      }

      if (animate && alive && was === false) {
        this.pulseClass(n.g, 'dg-node--bloom', 950);
        // a little kick so the spring overshoots into place: the "snap"
        n.vx += (n.hx - n.x) * 0.25;
        n.vy += (n.hy - n.y) * 0.25;
      }
      if (animate && !alive && was) this.pulseClass(n.g, 'dg-node--crack', 700);

      this.edgeList.forEach((e) => {
        if (e.from !== part && e.to !== part) return;
        const df = !this.isAlive(e.from), dt = !this.isAlive(e.to);
        e.cut = df && dt ? 0.5 : dt ? 0.62 : df ? 0.38 : null;
        e.deadEnd = dt ? 'to' : df ? 'from' : null;
        e.droopT = e.cut == null ? 0 : (e.secondary ? 22 : 30);
        e.g.classList.toggle('dg-edge--cut', e.cut != null);
        if (!animate || this.reduced) { e.droop = e.droopT; e.droopV = 0; }
      });

      if (!animate || this.reduced) {
        n.x = n.tx; n.y = n.ty; n.rot = n.trot; n.vx = n.vy = n.vr = 0;
        this.setTransform(n);
      }
      this.dirty = true;
      this.kick();
    }

    setTransform(n) {
      const tf = `translate(${f1(n.x)} ${f1(n.y)}) rotate(${f1(n.rot)})`;
      if (tf !== n.tf) { n.g.setAttribute('transform', tf); n.tf = tf; }
    }

    pulseClass(node, cls, ms) {
      let map = this.timers.get(node);
      if (!map) { map = {}; this.timers.set(node, map); }
      clearTimeout(map[cls]);
      node.classList.remove(cls);
      void node.getBoundingClientRect(); // restart the CSS animation
      node.classList.add(cls);
      map[cls] = setTimeout(() => node.classList.remove(cls), ms);
    }

    // ------------------------------------------------------------------ geometry
    updateGeometry() {
      for (const e of this.edgeList) {
        const a = this.nodes[e.from], b = this.nodes[e.to];
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        const nx = dy / len, ny = -dx / len;
        const cx = (a.x + b.x) / 2 + nx * e.bend;
        const cy = (a.y + b.y) / 2 + ny * e.bend + e.droop;
        const s = trim(a.x, a.y, cx, cy, TRIM);
        const t = trim(b.x, b.y, cx, cy, TRIM);
        const d = `M${f1(s[0])} ${f1(s[1])} Q${f1(cx)} ${f1(cy)} ${f1(t[0])} ${f1(t[1])}`;

        if (d !== e.d) {
          e.d = d;
          e.wire.setAttribute('d', d);
          e.ghost.setAttribute('d', d);
          e.flow.setAttribute('d', d);
          e.flash.setAttribute('d', d);
          e.L = e.wire.getTotalLength() || 1;
          e.grad.setAttribute('x1', f1(s[0])); e.grad.setAttribute('y1', f1(s[1]));
          e.grad.setAttribute('x2', f1(t[0])); e.grad.setAttribute('y2', f1(t[1]));
        }

        if (e.label) {
          const mx = 0.25 * s[0] + 0.5 * cx + 0.25 * t[0];
          const my = 0.25 * s[1] + 0.5 * cy + 0.25 * t[1];
          const sg = e.bend >= 0 ? 1 : -1;
          const off = e.secondary ? 13 : 0;
          const lx = mx + nx * sg * off, ly = my + ny * sg * off + (e.secondary && sg < 0 ? 4 : 0);
          e.label.setAttribute('transform', `translate(${f1(lx)} ${f1(ly)})`);
        }

        const L = e.L;
        if (e.cut != null) {
          const c = e.cut * L;
          if (e.deadEnd === 'to' && e.cut === 0.5) e.wire.style.strokeDasharray = `0 ${f1(L)}`;
          else if (e.deadEnd === 'to') e.wire.style.strokeDasharray = `${f1(c)} ${f1(L)}`;
          else e.wire.style.strokeDasharray = `0 ${f1(c)} ${f1(L - c)} ${f1(L)}`;
          const P = e.wire.getPointAtLength(c);
          const Q = e.deadEnd === 'to'
            ? e.wire.getPointAtLength(Math.min(L, c + 2))
            : e.wire.getPointAtLength(Math.max(0, c - 2));
          const ang = Math.atan2(Q.y - P.y, Q.x - P.x) * 180 / Math.PI;
          e.fray.setAttribute('transform', `translate(${f1(P.x)} ${f1(P.y)}) rotate(${f1(ang)})`);
        } else if (e.wire.style.strokeDasharray) {
          e.wire.style.strokeDasharray = '';
        }
      }
    }

    // ------------------------------------------------------------------ loop
    kick() {
      if (!this.raf) this.raf = requestAnimationFrame((t) => this.tick(t));
    }

    tick(now) {
      this.raf = null;
      const dt = this.lastT ? Math.min(50, now - this.lastT) : 16.667;
      this.lastT = now;
      const f = dt / 16.667;

      const moving = this.stepSprings(f);
      if (moving || this.dirty) { this.updateGeometry(); this.dirty = false; }
      this.pumpQueue(now);
      this.stepParticles(now);
      this.stepSparks(dt, f);

      if (moving || this.queue.length || this.particles.length || this.sparks.length) this.kick();
      else this.lastT = 0;
    }

    stepSprings(f) {
      let moving = false;
      for (const p in this.nodes) {
        const n = this.nodes[p];
        const damp = Math.pow(n.damp, f);
        n.vx = (n.vx + (n.tx - n.x) * n.k * f) * damp;
        n.vy = (n.vy + (n.ty - n.y) * n.k * f) * damp;
        n.vr = (n.vr + (n.trot - n.rot) * n.k * f) * damp;
        n.x += n.vx * f; n.y += n.vy * f; n.rot += n.vr * f;
        const rest = Math.abs(n.tx - n.x) + Math.abs(n.ty - n.y) + Math.abs(n.trot - n.rot) +
                     Math.abs(n.vx) + Math.abs(n.vy) + Math.abs(n.vr);
        if (rest < 0.03) { n.x = n.tx; n.y = n.ty; n.rot = n.trot; n.vx = n.vy = n.vr = 0; }
        else moving = true;
        this.setTransform(n);
      }
      for (const e of this.edgeList) {
        const damp = Math.pow(0.86, f);
        e.droopV = (e.droopV + (e.droopT - e.droop) * 0.05 * f) * damp;
        e.droop += e.droopV * f;
        if (Math.abs(e.droopT - e.droop) + Math.abs(e.droopV) < 0.03) { e.droop = e.droopT; e.droopV = 0; }
        else moving = true;
      }
      return moving;
    }

    // ------------------------------------------------------------------ messages
    onFlow(msg) {
      if (!msg || !msg.from || !msg.to) return;
      this.queue.push(msg);
      while (this.queue.length > MAX_QUEUE) this.queue.shift();
      this.kick();
    }

    pumpQueue(now) {
      if (this.queue.length && now - this.lastStart >= STAGGER) {
        this.lastStart = now;
        this.launch(this.queue.shift(), now);
      }
    }

    findEdge(from, to) {
      const fwd = this.edges[`${from}>${to}`];
      if (fwd) return { e: fwd, rev: false };
      const back = this.edges[`${to}>${from}`];
      if (back) return { e: back, rev: true };
      return null;
    }

    pointAt(e, rev, u) {
      const L = e.L;
      return e.wire.getPointAtLength(clamp(rev ? L * (1 - u) : L * u, 0, L));
    }

    launch(msg, now) {
      this.setCaption(msg);
      const hit = this.findEdge(msg.from, msg.to);
      if (!hit) return;
      const { e, rev } = hit;
      const ok = msg.ok !== false;

      if (this.reduced) {
        this.pulseClass(e.g, ok ? 'dg-edge--pulse' : 'dg-edge--flash', 700);
        const target = this.nodes[ok ? msg.to : (this.isAlive(msg.to) ? msg.from : msg.to)];
        if (ok && target) this.pulseClass(target.g, 'dg-node--recv', 500);
        return;
      }

      const srcDead = !this.isAlive(msg.from);
      const dstDead = !this.isAlive(msg.to);
      let endU = 1;
      if (!ok) endU = srcDead && dstDead ? 0.5 : srcDead ? 0.38 : 0.62;

      if (!ok && srcDead && !dstDead) {
        // the sender is gone: the message never really leaves; it fizzles at the cut
        this.shatter(e, this.pointAt(e, rev, endU), msg.from);
        return;
      }

      const g = el('g', { class: `dg-particle dg-c-${msg.from}` + (ok ? '' : ' dg-particle--doomed') }, this.fxLayer);
      const trail = [];
      for (let i = TRAIL; i >= 1; i--) {
        trail.unshift(el('circle', {
          class: 'dg-particle__trail',
          r: f1(3.6 * (1 - i / (TRAIL + 1)) + 0.6),
          opacity: f1(0.55 * (1 - i / (TRAIL + 1))),
        }, g));
      }
      const head = el('g', { class: 'dg-particle__head' }, g);
      el('circle', { r: 5.5, filter: 'url(#dg-glow)' }, head);
      el('circle', { class: 'dg-particle__core', r: 2.2 }, head);
      const label = el('text', { class: 'dg-particle__label' }, g);
      const txt = String(msg.label == null ? '' : msg.label);
      label.textContent = txt.length > 30 ? txt.slice(0, 29) + '…' : txt;

      const travel = e.L * endU;
      this.particles.push({
        msg, e, rev, ok, g, trail, head, label, endU,
        t0: now, dur: clamp(travel * 2.5, 520, 1100),
      });
    }

    stepParticles(now) {
      if (!this.particles.length) return;
      const keep = [];
      for (const p of this.particles) {
        const k = clamp((now - p.t0) / p.dur, 0, 1);
        const eased = p.ok ? easeInOut(k) : Math.pow(k, 1.7);
        const u = eased * p.endU;
        const pos = this.pointAt(p.e, p.rev, u);
        p.head.setAttribute('transform', `translate(${f1(pos.x)} ${f1(pos.y)})`);

        const step = 7 / p.e.L;
        for (let i = 0; i < p.trail.length; i++) {
          const q = this.pointAt(p.e, p.rev, Math.max(0, u - (i + 1) * step));
          p.trail[i].setAttribute('cx', f1(q.x));
          p.trail[i].setAttribute('cy', f1(q.y));
        }

        const lo = k < 0.12 ? k / 0.12 : k > 0.82 ? (1 - k) / 0.18 : 1;
        p.label.setAttribute('transform', `translate(${f1(pos.x)} ${f1(pos.y - 15 - k * 7)})`);
        p.label.setAttribute('opacity', f1(clamp(lo, 0, 1)));

        if (k >= 1) {
          p.g.remove();
          if (p.ok) {
            const n = this.nodes[p.msg.to];
            if (n) this.pulseClass(n.g, 'dg-node--recv', 520);
          } else {
            this.shatter(p.e, pos, p.msg.from);
          }
        } else keep.push(p);
      }
      this.particles = keep;
    }

    shatter(e, pos, from) {
      this.pulseClass(e.g, 'dg-edge--flash', 750);
      const burst = el('g', { class: 'dg-burst-wrap', transform: `translate(${f1(pos.x)} ${f1(pos.y)})` }, this.fxLayer);
      el('circle', { class: 'dg-burst', r: 9 }, burst);
      el('circle', { class: 'dg-burst dg-burst--late', r: 6 }, burst);
      setTimeout(() => burst.remove(), 800);

      const count = 18;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const sp = 0.05 + Math.random() * 0.17;
        const life = 420 + Math.random() * 480;
        const r = 0.9 + Math.random() * 1.7;
        const c = el('circle', {
          class: 'dg-spark ' + (i % 3 === 0 ? `dg-c-${from}` : 'dg-spark--danger'),
          cx: f1(pos.x), cy: f1(pos.y), r: f1(r),
        }, this.fxLayer);
        this.sparks.push({ el: c, x: pos.x, y: pos.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.04, age: 0, life, r });
      }
      this.kick();
    }

    stepSparks(dt, f) {
      if (!this.sparks.length) return;
      const keep = [];
      const drag = Math.pow(0.985, f);
      for (const s of this.sparks) {
        s.age += dt;
        if (s.age >= s.life) { s.el.remove(); continue; }
        s.vy += 0.00032 * dt;
        s.vx *= drag; s.vy *= drag;
        s.x += s.vx * dt; s.y += s.vy * dt;
        const k = 1 - s.age / s.life;
        s.el.setAttribute('cx', f1(s.x));
        s.el.setAttribute('cy', f1(s.y));
        s.el.setAttribute('r', f1(s.r * (0.4 + 0.6 * k)));
        s.el.setAttribute('opacity', f1(k));
        keep.push(s);
      }
      this.sparks = keep;
    }

    // ------------------------------------------------------------------ caption
    setCaption(msg) {
      const c = this.caption;
      c.textContent = '';
      const span = (cls, text) => {
        const s = document.createElement('span');
        s.className = cls;
        s.textContent = text;
        c.appendChild(s);
      };
      const name = (p) => (NODES[p] ? NODES[p].name : String(p));
      span(`dg-caption__who dg-c-${msg.from}`, name(msg.from));
      span('dg-caption__arrow', ' → ');
      span(`dg-caption__who dg-c-${msg.to}`, name(msg.to));
      span('dg-caption__sep', ' · ');
      span(`dg-caption__label dg-c-${msg.from}`, String(msg.label == null ? '' : msg.label));
      const failed = msg.ok === false;
      if (failed) span('dg-caption__fail', ' ✕ lost in the gap');
      c.classList.toggle('dg-caption--fail', failed);
      c.classList.remove('dg-caption--new');
      void c.offsetWidth;
      c.classList.add('dg-caption--new');
    }
  }

  ns.DiagramView = DiagramView;
})(window.MVCX = window.MVCX || {});
