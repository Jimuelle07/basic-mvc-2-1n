# Build contract (for everyone writing a file in this folder)

A static site, **no build step, no frameworks, no ES modules**. Every JS file is a classic
script wrapped in an IIFE that attaches its class to the shared namespace:

```js
(function (ns) {
  'use strict';
  class Thing { /* ... */ }
  ns.Thing = Thing;
})(window.MVCX = window.MVCX || {});
```

`index.html` must open by double-click (file://). Only external resource allowed: the Google Fonts
already linked. No CDNs, no images from the web (inline SVG / CSS only).

## Already written (read, don't rewrite)
- `js/core/EventBus.js` — `bus.on(type, fn) -> off`, `bus.emit(type, payload)`
- `js/models/SystemModel.js` — which parts are plugged in + log
- `js/models/GardenModel.js` — demo domain model (flowers) + `ValidationError`
- `js/controllers/SystemController.js`, `js/views/SwitchboardView.js`
- `js/app.js` — composition root, **read it first**: it shows exactly how your class is constructed and called
- `index.html` — page structure and slots, `css/theme.css` — design tokens

## The ctx object every View / Controller receives
```
ctx.bus                   EventBus
ctx.system                SystemModel  (isAlive(part), parts, removed(), isHealthy(), entries)
ctx.model                 GardenModel, or null while the Model is unplugged
ctx.flow(from, to, label) emits bus 'flow' {from,to,label,ok,time} + logs; returns ok
ctx.log(level, text, meta) level: 'info'|'flow'|'warn'|'error'
ctx.fault(part, err)      emits bus 'fault' {part,error,text} + logs an error
```
Parts are the strings `'user' | 'controller' | 'model' | 'view'`.

## Bus events
| event | payload | emitted by |
|---|---|---|
| `system:changed` | `{ parts, part, alive }` | SystemModel |
| `system:log` | `{ id, time, level, text, from?, to? }` | SystemModel |
| `flow` | `{ from, to, label, ok, time }` | ctx.flow |
| `fault` | `{ part, error, text }` | ctx.fault |
| `model:snapshot` | `{ snapshot, action }` (action: 'boot'/'plant'/'water'/'uproot'/'clear') | app.js |
| `demo:deadclick` | `{ action, x, y }` (viewport coords) | app.js, when a click hits a `[data-action]` with no Controller |
| `intent:toggle` | `{ part }` | any View → SystemController |
| `intent:set` | `{ part, alive }` | any View → SystemController |
| `intent:restore` | — | any View → SystemController |

## Palette & type (from css/theme.css — use the variables, never hard-code)
`--ink` page bg, `--ink-2` / `--ink-3` raised surfaces, `--paper` text, `--muted`, `--faint`, `--line`
`--model` amber, `--view` teal, `--controller` rose, `--user` lavender, `--danger`, `--ok`
`--font-display` Fraunces (serif, expressive, use italics), `--font-body` Inter, `--font-mono` JetBrains Mono
`--radius`, `--radius-sm`, `--ease` (springy), `--shadow`
Dark, inky, night-sky aesthetic — art-directed, not "admin dashboard". Prefer CSS/SVG motion, honour `prefers-reduced-motion`.
Must work at 360px wide (no horizontal page scroll).

## Rules of the page (it is MVC itself)
- Views render and emit intents; they never mutate models.
- Controllers handle input and call models; they never build DOM beyond reading inputs.
- Models never touch the DOM.
- Prefix every CSS class with your component name (`.dg-`, `.gd-`, `.ins-`, `.guide-`) to avoid collisions.
