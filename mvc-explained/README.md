# MVC, Explained — a living diagram

An interactive essay on **Model · View · Controller**. Open `index.html` in any browser
(double-click works, no server or build step).

## What you can do

- **Act I: The living triad.** Use *Night Garden*, a tiny real app: plant, water and uproot flowers.
  Every message (you → Controller → Model → View → you) flies across the diagram as a comet.
- **Pull a fuse.** Unplug the Model, View or Controller (buttons, click a diagram node, or press
  <kbd>M</kbd> / <kbd>V</kbd> / <kbd>C</kbd>). The app breaks in real time, each in its own way:
  - **No Model:** the Controller reaches for it and hits a real `TypeError`. The View shows its template with holes.
  - **No View:** the data keeps changing, but the screen shows only static and raw JSON. A raw console still reaches the Controller.
  - **No Controller:** the buttons render, but clicks fall on the floor. Nobody is listening.
  - Plug it back in (or press <kbd>R</kbd>) and it heals.
- **The inspector** shows the live message log, the Model's memory, and a diagnosis of what broke,
  including what the same failure looks like in ASP.NET Core.
- **Act II: Designing with MVC.** Responsibilities, who may talk to whom, a step-by-step ASP.NET
  Core request through the `JimMvc` project next door, a feature built from scratch, and anti-patterns.

## The page is MVC itself

```
js/
  core/EventBus.js            pub/sub the parts talk through
  models/                     data + rules, no DOM
    GardenModel.js            the demo app's domain (flowers, validation)
    SystemModel.js            which parts are plugged in + the message log
  views/                      render state, emit intents, never mutate models
    GardenView.js  GhostView.js  DiagramView.js  SwitchboardView.js  InspectorView.js  GuideView.js
  controllers/                turn input into model calls
    GardenController.js  SystemController.js
  app.js                      composition root: the only file that knows all three
```

Unplugging a part really does detach it: the Controller's DOM listeners are removed,
the View is unmounted, the Model reference becomes `null`. Nothing is faked.
`CONTRACT.md` documents the interfaces between the parts.
