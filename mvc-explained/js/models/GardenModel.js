/*
 * GardenModel — the domain model of the demo app, "Night Garden".
 * It owns the data AND the rules. It knows nothing about the DOM,
 * nothing about Views, nothing about Controllers. It only notifies
 * whoever subscribed that something changed.
 *
 * Flower = { id, name, hue (0-359), bloom (1-5), plantedAt }
 * Snapshot = { flowers: Flower[], count, capacity }
 */
(function (ns) {
  'use strict';

  class ValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ValidationError';
    }
  }

  const CAPACITY = 9;
  const MAX_BLOOM = 5;

  class GardenModel {
    constructor() {
      this.flowers = [];
      this.nextId = 1;
      this.listeners = new Set();
      [['Moonpetal', 268], ['Emberlily', 18], ['Tidebell', 176]].forEach(([n, h], i) => {
        this.flowers.push({ id: this.nextId++, name: n, hue: h, bloom: 2 + i, plantedAt: Date.now() });
      });
    }

    static get CAPACITY() { return CAPACITY; }
    static get MAX_BLOOM() { return MAX_BLOOM; }

    // ---- observation -------------------------------------------------
    subscribe(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }

    notify(action) {
      const snap = this.snapshot();
      this.listeners.forEach((fn) => fn(snap, action));
    }

    snapshot() {
      return {
        flowers: this.flowers.map((f) => ({ ...f })),
        count: this.flowers.length,
        capacity: CAPACITY,
      };
    }

    // ---- business rules ----------------------------------------------
    plant(name, hue) {
      const clean = String(name ?? '').trim();
      if (!clean) throw new ValidationError('A flower needs a name.');
      if (clean.length > 16) throw new ValidationError('Names must be 16 characters or fewer.');
      if (this.flowers.length >= CAPACITY) throw new ValidationError(`The garden is full (${CAPACITY} flowers max).`);
      if (this.flowers.some((f) => f.name.toLowerCase() === clean.toLowerCase())) {
        throw new ValidationError(`"${clean}" already grows here.`);
      }
      const h = ((Math.round(Number(hue)) % 360) + 360) % 360 || 0;
      const flower = { id: this.nextId++, name: clean, hue: h, bloom: 1, plantedAt: Date.now() };
      this.flowers.push(flower);
      this.notify('plant');
      return { ...flower };
    }

    water(id) {
      const f = this.find(id);
      if (f.bloom >= MAX_BLOOM) throw new ValidationError(`${f.name} is already in full bloom.`);
      f.bloom += 1;
      this.notify('water');
      return { ...f };
    }

    uproot(id) {
      const f = this.find(id);
      this.flowers = this.flowers.filter((x) => x !== f);
      this.notify('uproot');
      return { ...f };
    }

    clear() {
      this.flowers = [];
      this.notify('clear');
    }

    find(id) {
      const f = this.flowers.find((x) => x.id === Number(id));
      if (!f) throw new ValidationError(`No flower with id ${id}.`);
      return f;
    }
  }

  ns.ValidationError = ValidationError;
  ns.GardenModel = GardenModel;
})(window.MVCX = window.MVCX || {});
