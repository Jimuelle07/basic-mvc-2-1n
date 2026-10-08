/*
 * GuideView — Act II, "Designing with MVC".
 * A View: it renders static teaching content and emits intents ('intent:set')
 * to the rest of the page. It never mutates a model.
 *
 * Presentational state (which tab / step / card is open) lives here, in the
 * View. Domain state (which parts are plugged in, the flowers) belongs to
 * the Model and is never touched from this file.
 */
(function (ns) {
  'use strict';

  // ---------------------------------------------------------------- helpers
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const CS_KW = 'using namespace public private protected internal class record struct interface static readonly const void return new var if else foreach for while in out is not null true false string int bool async await throw this get set init override virtual abstract sealed partial nameof';
  const JS_KW = 'const let var function return if else for while of in new class this null true false undefined async await typeof throw try catch';
  const kw = (list) => '\\b(?:' + list.split(' ').join('|') + ')\\b';

  // One combined regex per language; groups: 1 comment, 2 string, 3 keyword, 4 razor/attr, 5 type, 6 number, 7 tag
  const LANGS = {
    cs: new RegExp('(\\/\\/[^\\n]*)|("(?:\\\\.|[^"\\\\\\n])*")|(' + kw(CS_KW) + ')|(\\[[A-Z]\\w*)|(\\b[A-Z]\\w*\\b)|(\\b\\d+\\b)', 'g'),
    js: new RegExp('(\\/\\/[^\\n]*)|("(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\'|`[^`]*`)|(' + kw(JS_KW) + ')|()()(\\b\\d+\\b)', 'g'),
    cshtml: new RegExp('(@\\*[\\s\\S]*?\\*@|&lt;!--[\\s\\S]*?--&gt;)|("(?:[^"\\n])*")|(' + kw(CS_KW) + ')|(@[A-Za-z]+)|(\\b[A-Z]\\w*\\b)|(\\b\\d+\\b)|(&lt;\\/?[a-z][\\w-]*)', 'g'),
  };
  const CLS = ['', 'c', 's', 'k', 'a', 't', 'n', 'g'];

  function highlight(code, lang) {
    const re = LANGS[lang];
    const safe = esc(code);
    if (!re) return safe;
    return safe.replace(re, function () {
      const m = arguments;
      for (let i = 1; i <= 7; i++) {
        if (m[i]) return '<span class="guide-tok-' + CLS[i] + '">' + m[i] + '</span>';
      }
      return m[0];
    });
  }

  const codeBlock = (code, lang, file) =>
    '<figure class="guide-code">' +
    (file ? '<figcaption class="guide-code__file">' + esc(file) + '</figcaption>' : '') +
    '<pre tabindex="0"><code>' + highlight(code.replace(/^\n/, '').replace(/\s+$/, ''), lang) + '</code></pre></figure>';

  const PART = { model: 'Model', view: 'View', controller: 'Controller', user: 'User' };
  const badge = (p, text) => '<span class="guide-badge guide-badge--' + p + '">' + (text || PART[p]) + '</span>';

  // ---------------------------------------------------------------- content
  const ROLES = [
    {
      part: 'model', essence: 'remembers & rules',
      is: ['Holds the data and the truth about it', 'Enforces the rules: validation, limits, invariants', 'Announces "I changed" to anyone listening'],
      isnt: ['Knows nothing about HTTP, buttons or HTML', 'Never calls the View or the Controller', 'Never formats text for display'],
      smell: ['It imports HTTP, DOM or UI types', 'It returns ready-made HTML strings', 'You cannot unit-test it without a web server'],
    },
    {
      part: 'view', essence: 'shows',
      is: ['Turns a Model into something a person can see', 'Loops, branches on presentation, formats', 'Emits user intents (clicks, form posts)'],
      isnt: ['Never changes the Model', 'Never decides business rules', 'Never fetches its own data'],
      smell: ['It does arithmetic or prices', 'It runs queries or calls services', 'An if-statement decides what is allowed'],
    },
    {
      part: 'controller', essence: 'listens & directs',
      is: ['Receives input and checks it is well-formed', 'Calls the Model to do the work', 'Picks which View answers, and redirects'],
      isnt: ['Never renders HTML itself', 'Never holds the rules it enforces', 'Never keeps state between requests'],
      smell: ['An action is longer than ~30 lines of if/else', 'It contains calculations', 'It talks to the database directly'],
    },
  ];

  const MATRIX_PARTS = ['user', 'controller', 'model', 'view'];
  // [from][to] -> {k: 'allow'|'indirect'|'forbid'|'self', tag, text}
  const M = {
    user: {
      user: { k: 'self' },
      controller: { k: 'allow', tag: 'acts', text: 'The user clicks, taps and submits. Every intent goes through the Controller. In ASP.NET Core that is the HTTP request landing on an action.' },
      model: { k: 'forbid', tag: 'never', text: 'Nobody reaches into the data directly. If a user could edit the Model without the Controller, no rule would ever be checked.' },
      view: { k: 'allow', tag: 'sees', text: 'The user looks at the View. It is the only part that is ever visible, a portrait of the Model.' },
    },
    controller: {
      user: { k: 'indirect', tag: 'via view', text: 'A Controller does not answer the user itself. It chooses a View, and the View answers. In the project: return View(model) or RedirectToAction.' },
      controller: { k: 'self' },
      model: { k: 'allow', tag: 'its job', text: 'Yes, this is its job. The Controller translates input into calls on the Model: garden.TryPlant(flower), garden.Water(id).' },
      view: { k: 'allow', tag: 'chooses', text: 'The Controller picks the View and hands it a Model to show. It never builds the HTML itself.' },
    },
    model: {
      user: { k: 'forbid', tag: 'never', text: 'The Model has no idea a human exists. It has no screen to draw on and no ears to hear with.' },
      controller: { k: 'forbid', tag: 'never', text: 'Never. Models don\'t know who calls them. Today it is a Controller, tomorrow a unit test or a background job.' },
      model: { k: 'self' },
      view: { k: 'indirect', tag: 'announces', text: 'Never directly. The Model only announces "I changed"; whoever subscribed (the View) listens and repaints. That is the Observer pattern. (ASP.NET Core\'s request cycle re-renders the View on the next request instead.)' },
    },
    view: {
      user: { k: 'allow', tag: 'renders', text: 'The View paints pixels for the user: HTML in the response, or the live garden on this page.' },
      controller: { k: 'indirect', tag: 'intents', text: 'A View never calls the Controller\'s code. It emits an intent (a form post, a link, a data-action) and the framework routes it to a Controller.' },
      model: { k: 'allow', tag: 'read only', text: 'Read only, never write. The View may read what the Model gives it (@Model.Flowers) but must never change it, or two Views could silently disagree.' },
      view: { k: 'self' },
    },
  };

  const STEPS = [
    {
      who: 'user', node: 0, pos: 0, title: 'The browser asks',
      text: 'You type an address or click a link. The browser sends one plain-text HTTP request. No MVC yet, just a verb and a path.',
      lang: 'js', file: 'HTTP request',
      code: 'GET /Home/Index HTTP/1.1\nHost: localhost:5001\nAccept: text/html',
    },
    {
      who: 'controller', node: 1, pos: 25, title: 'Routing picks a Controller',
      text: 'Kestrel hands the request to the middleware pipeline. UseRouting() reads the URL and MapControllerRoute matches /Home/Index against the pattern, so controller = Home and action = Index. The {id?} part is optional.',
      lang: 'cs', file: 'Program.cs',
      code: 'app.UseRouting();\n\napp.MapControllerRoute(\n    name: "default",\n    pattern: "{controller=Home}/{action=Index}/{id?}")\n    .WithStaticAssets();',
    },
    {
      who: 'controller', node: 2, pos: 50, title: 'The action runs',
      text: 'The framework creates a HomeController and calls Index(). The Controller is thin: it decides what happens next and little else.',
      lang: 'cs', file: 'Controllers/HomeController.cs',
      code: 'public class HomeController : Controller\n{\n    public IActionResult Index()\n    {\n        return View();\n    }\n}',
    },
    {
      who: 'model', node: 3, pos: 75, title: 'The Model is built',
      text: 'If the page needs data, the Model is the thing that holds it. Index() has none yet, but the Error action in the same controller builds one, and that is exactly the shape a real Model takes.',
      lang: 'cs', file: 'Models/ErrorViewModel.cs',
      code: 'public class ErrorViewModel\n{\n    public string? RequestId { get; set; }\n\n    public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);\n}\n\n// in HomeController.Error():\nvar model = new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier };',
    },
    {
      who: 'controller', node: 2, pos: 62, title: 'return View(model)',
      text: 'The Controller hands the Model to the View. It returns an IActionResult, a description of the answer rather than the answer itself. By convention View() looks for a view named after the action.',
      lang: 'cs', file: 'Controllers/HomeController.cs',
      code: '[ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]\npublic IActionResult Error()\n{\n    return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });\n}',
    },
    {
      who: 'view', node: 4, pos: 100, title: 'Razor finds the View and the Layout',
      text: 'The Razor engine looks for Views/Home/Index.cshtml, renders it, then pours the result into Views/Shared/_Layout.cshtml at @RenderBody(). The navbar and footer come from the layout, so every page shares them.',
      lang: 'cshtml', file: 'Views/Shared/_Layout.cshtml',
      code: '<div class="container">\n    <main role="main" class="pb-3">\n        @RenderBody()   @* Views/Home/Index.cshtml lands here *@\n    </main>\n</div>',
    },
    {
      who: 'user', node: 0, pos: 0, title: 'HTML goes home',
      text: 'The finished page is just text: a 200 response with HTML in the body. The browser paints it and the View has done its one job.',
      lang: 'js', file: 'HTTP response',
      code: 'HTTP/1.1 200 OK\nContent-Type: text/html; charset=utf-8\n\n<!DOCTYPE html>\n<html lang="en"> ... <h1 class="display-4">Welcome</h1> ...',
    },
  ];
  const TRACK = [['user', 'Browser'], ['controller', 'Routing'], ['controller', 'Controller'], ['model', 'Model'], ['view', 'View']];

  const RECIPE = [
    {
      n: 'Name the nouns', part: 'model', tab: 'Models/Flower.cs', lang: 'cs',
      why: 'Nouns are the things your app remembers: a Flower, a Garden. Each becomes a Model class, together with the rules about it. The rules live here, not in a Controller.',
      code: `using System.ComponentModel.DataAnnotations;

namespace JimMvc.Models;

public record Flower
{
    public Guid Id { get; init; } = Guid.NewGuid();

    [Required, StringLength(24, MinimumLength = 2)]
    public string Name { get; init; } = "";

    [Range(1, 5)]
    public int Thirst { get; init; } = 3;
}

// what the Garden page needs, bundled for the View
public record GardenPage(IReadOnlyList<Flower> Flowers, Flower NewFlower);

// the business rules: no HTTP anywhere in sight
public class GardenService
{
    public const int MaxFlowers = 12;
    private readonly List<Flower> _flowers = new();
    private readonly object _gate = new();

    public IReadOnlyList<Flower> All
    {
        get { lock (_gate) return _flowers.ToList(); }
    }

    public bool TryPlant(Flower flower, out string? error)
    {
        lock (_gate)
        {
            if (_flowers.Count >= MaxFlowers)
            {
                error = "The garden is full.";
                return false;
            }
            if (_flowers.Any(f => string.Equals(f.Name, flower.Name, StringComparison.OrdinalIgnoreCase)))
            {
                error = $"There is already a {flower.Name}.";
                return false;
            }
            _flowers.Add(flower);
            error = null;
            return true;
        }
    }
}`,
    },
    {
      n: 'Name the screens', part: 'view', tab: 'Views/Garden/Index.cshtml', lang: 'cshtml',
      why: 'Screens are the ways a person looks at the nouns. One screen becomes one View, a cshtml file that only loops, formats and shows. No rules in here.',
      code: `@model GardenPage
@{
    ViewData["Title"] = "Garden";
}

<h1>The garden</h1>

<ul>
@foreach (var flower in Model.Flowers)
{
    <li>@flower.Name <small>thirst @flower.Thirst / 5</small></li>
}
</ul>

<form asp-action="Plant" method="post">
    <div asp-validation-summary="ModelOnly" class="text-danger"></div>

    <label asp-for="NewFlower.Name"></label>
    <input asp-for="NewFlower.Name" class="form-control" />
    <span asp-validation-for="NewFlower.Name" class="text-danger"></span>

    <label asp-for="NewFlower.Thirst"></label>
    <input asp-for="NewFlower.Thirst" type="number" min="1" max="5" class="form-control" />
    <span asp-validation-for="NewFlower.Thirst" class="text-danger"></span>

    <button type="submit" class="btn btn-primary">Plant</button>
</form>

@* GardenPage comes from the @using JimMvc.Models in Views/_ViewImports.cshtml *@`,
    },
    {
      n: 'Name the verbs', part: 'controller', tab: 'Controllers/GardenController.cs', lang: 'cs',
      why: 'Verbs are what people do: look, plant. Each becomes one Controller action. An action checks input, calls the Model, and chooses a response. Nothing more.',
      code: `using JimMvc.Models;
using Microsoft.AspNetCore.Mvc;

namespace JimMvc.Controllers;

public class GardenController(GardenService garden) : Controller
{
    [HttpGet]
    public IActionResult Index() =>
        View(new GardenPage(garden.All, new Flower()));

    [HttpPost, ValidateAntiForgeryToken]
    public IActionResult Plant([Bind(Prefix = nameof(GardenPage.NewFlower))] Flower flower)
    {
        if (!ModelState.IsValid)                       // attributes on the Model said no
            return View(nameof(Index), new GardenPage(garden.All, flower));

        if (!garden.TryPlant(flower, out var error))   // the Model's own rules said no
        {
            ModelState.AddModelError($"{nameof(GardenPage.NewFlower)}.{nameof(Flower.Name)}", error!);
            return View(nameof(Index), new GardenPage(garden.All, flower));
        }

        return RedirectToAction(nameof(Index));        // Post/Redirect/Get
    }
}`,
    },
    {
      n: 'Wire the route', part: 'controller', tab: 'Program.cs', lang: 'cs',
      why: 'Almost nothing to do: the conventional route already maps /Garden/Index to GardenController.Index(). You only register the Model service so the Controller can ask for it.',
      code: `using JimMvc.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.AddSingleton<GardenService>();   // one garden for the whole app

var app = builder.Build();
// ...
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")   // /Garden  ->  GardenController.Index()
    .WithStaticAssets();

app.Run();`,
    },
    {
      n: 'Test the Model alone', part: 'model', tab: 'GardenServiceTests.cs', lang: 'cs',
      why: 'The proof that your Model is clean: you can test it with no web server, no browser and no Controller. If you can\'t, something leaked.',
      code: `using JimMvc.Models;
using Xunit;

public class GardenServiceTests
{
    [Fact]
    public void TryPlant_rejects_a_duplicate_name()
    {
        var garden = new GardenService();

        Assert.True(garden.TryPlant(new Flower { Name = "Tulip" }, out _));
        Assert.False(garden.TryPlant(new Flower { Name = "tulip" }, out var error));

        Assert.Contains("already", error);
        Assert.Single(garden.All);
    }
}`,
    },
  ];

  const SMELLS = [
    {
      name: 'Fat Controller', part: 'controller',
      symptom: 'One action runs 80 lines: it validates, calculates a discount, queries the database, builds an email and then picks a View.',
      hurts: 'Rules are trapped behind HTTP. You cannot reuse or test them without faking a request, and every new feature makes the action fatter.',
      fix: 'Move the rules into a Model or service (GardenService.TryPlant). The action shrinks to: check input, call the Model, choose the response.',
    },
    {
      name: 'Smart View', part: 'view',
      symptom: 'The cshtml computes totals, checks permissions with nested ifs, or even calls a repository.',
      hurts: 'Business logic is now hidden in markup. It is untestable, duplicated across screens, and a designer\'s tweak can break a rule.',
      fix: 'Compute in the Model, hand the View a ready-to-show value (Model.Total), and let it only loop, format and display.',
    },
    {
      name: 'Anemic Model', part: 'model',
      symptom: 'The classes are just bags of getters and setters. All the real behaviour lives in Controllers or "Manager" classes.',
      hurts: 'Nothing protects the data. Any code can set it to an invalid state, and the same rule gets rewritten in several places.',
      fix: 'Put behaviour next to the data: validation attributes, methods like TryPlant, invariants. The Model defends itself.',
    },
    {
      name: 'God Model', part: 'model',
      symptom: 'One huge class knows about users, orders, emails, PDFs and the HTTP context, so everything depends on it.',
      hurts: 'Any change ripples everywhere, tests need the whole world, and it starts importing HTTP, which breaks the one rule a Model has.',
      fix: 'Split it by noun: small cohesive Models (Flower, Garden) and services with one reason to change. Keep every one free of UI and HTTP.',
    },
  ];

  // ---------------------------------------------------------------- view
  class GuideView {
    constructor(root, ctx) {
      this.root = root;
      this.ctx = ctx;
      this.mounted = false;
      // presentational state — belongs to the View, not the Model
      this.ui = { cell: null, step: 0, recipe: 0, flipped: new Set(), playing: false };
      this._timer = null;
    }

    mount() {
      if (this.mounted || !this.root) return;
      this.root.innerHTML = [this.rolesHTML(), this.matrixHTML(), this.stepperHTML(), this.recipeHTML(), this.smellsHTML(), this.quoteHTML()].join('');
      this.root.addEventListener('click', (e) => this.onClick(e));
      this.root.addEventListener('keydown', (e) => this.onKey(e));
      this.root.addEventListener('focusin', (e) => {
        const c = e.target.closest && e.target.closest('.guide-cell[data-from]');
        if (c) this.selectCell(c.dataset.from, c.dataset.to, false);
      });
      this.mounted = true;
      this.renderStep();
      this.renderRecipe();
    }

    // ----- section 1
    rolesHTML() {
      const list = (items) => '<ul>' + items.map((i) => '<li>' + esc(i) + '</li>').join('') + '</ul>';
      return '<section class="guide-sec" aria-labelledby="guide-roles-t">' +
        this.head('01', 'guide-roles-t', 'Three roles', 'Every class you write should be able to answer one question: <em>which of these three am I?</em>') +
        '<div class="guide-roles">' + ROLES.map((r) =>
          '<article class="guide-role guide-role--' + r.part + '">' +
          '<h4 class="guide-role__name">' + PART[r.part] + '</h4>' +
          '<p class="guide-role__essence">' + esc(r.essence) + '</p>' +
          '<h5>Is</h5>' + list(r.is) +
          '<h5>Is not</h5>' + list(r.isnt) +
          '<h5>Smells wrong when</h5>' + list(r.smell) +
          '<button type="button" class="guide-try" data-unplug="' + r.part + '">Try it: unplug the ' + PART[r.part] + '</button>' +
          '</article>').join('') + '</div></section>';
    }

    head(num, id, title, lede) {
      return '<header class="guide-head"><span class="guide-head__num">' + num + '</span>' +
        '<h3 id="' + id + '" class="guide-head__title">' + title + '</h3><p class="guide-head__lede">' + lede + '</p></header>';
    }

    // ----- section 2
    matrixHTML() {
      let h = '<section class="guide-sec" aria-labelledby="guide-mx-t">' +
        this.head('02', 'guide-mx-t', 'Who may talk to whom', 'Read each row as "from" and each column as "to". Select a cell for the reason.') +
        '<div class="guide-matrix-wrap"><div class="guide-matrix" role="grid" aria-label="Allowed conversations between MVC parts">' +
        '<div class="guide-matrix__corner" role="presentation">from \\ to</div>';
      MATRIX_PARTS.forEach((p) => { h += '<div class="guide-matrix__col guide-matrix__col--' + p + '" role="columnheader">' + PART[p] + '</div>'; });
      MATRIX_PARTS.forEach((from) => {
        h += '<div class="guide-matrix__row guide-matrix__row--' + from + '" role="rowheader">' + PART[from] + '</div>';
        MATRIX_PARTS.forEach((to) => {
          const c = M[from][to];
          if (c.k === 'self') { h += '<div class="guide-cell guide-cell--self" role="gridcell" aria-label="' + PART[from] + ' to itself, not applicable"></div>'; return; }
          const word = { allow: 'allowed', indirect: 'indirect', forbid: 'forbidden' }[c.k];
          h += '<button type="button" class="guide-cell guide-cell--' + c.k + '" role="gridcell" data-from="' + from + '" data-to="' + to + '" aria-label="' +
            PART[from] + ' to ' + PART[to] + ': ' + word + '"><span class="guide-cell__mark" aria-hidden="true">' + { allow: '&rarr;', indirect: '&#8943;', forbid: '&times;' }[c.k] + '</span><span class="guide-cell__tag">' + c.tag + '</span></button>';
        });
      });
      h += '</div></div><div class="guide-legend"><span class="guide-key guide-key--allow">allowed</span><span class="guide-key guide-key--indirect">indirect, via events</span><span class="guide-key guide-key--forbid">forbidden</span></div>' +
        '<div class="guide-explain" id="guide-explain" aria-live="polite"><p class="guide-explain__hint">Pick a cell, for instance <b>Model &rarr; View</b>.</p></div></section>';
      return h;
    }

    selectCell(from, to, focus) {
      this.ui.cell = from + '>' + to;
      const c = M[from][to];
      this.root.querySelectorAll('.guide-cell[data-from]').forEach((b) => b.classList.toggle('is-on', b.dataset.from === from && b.dataset.to === to));
      const word = { allow: 'Allowed', indirect: 'Indirect', forbid: 'Forbidden' }[c.k];
      this.root.querySelector('#guide-explain').innerHTML =
        '<p class="guide-explain__head">' + badge(from) + '<span class="guide-explain__arrow">&rarr;</span>' + badge(to) + '<span class="guide-verdict guide-verdict--' + c.k + '">' + word + '</span></p>' +
        '<p class="guide-explain__body">' + esc(c.text) + '</p>';
      if (focus) { const b = this.root.querySelector('.guide-cell[data-from="' + from + '"][data-to="' + to + '"]'); if (b) b.focus(); }
    }

    // ----- section 3
    stepperHTML() {
      return '<section class="guide-sec" aria-labelledby="guide-st-t">' +
        this.head('03', 'guide-st-t', 'One request, step by step', 'Follow <code>GET /Home/Index</code> through this very project, from browser to browser.') +
        '<div class="guide-stepper" tabindex="0" role="group" aria-label="Request walkthrough. Use left and right arrow keys.">' +
        '<div class="guide-track" aria-hidden="true"><div class="guide-track__line"></div>' +
        TRACK.map((t, i) => '<div class="guide-track__node guide-track__node--' + t[0] + '" data-node="' + i + '" style="left:' + i * 25 + '%"><i></i><span>' + t[1] + '</span></div>').join('') +
        '<div class="guide-track__pulse" id="guide-pulse"></div></div>' +
        '<div class="guide-controls"><button type="button" class="guide-btn" data-step="prev">&larr; Prev</button>' +
        '<button type="button" class="guide-btn guide-btn--play" data-step="play" id="guide-play">&#9654; Play</button>' +
        '<button type="button" class="guide-btn" data-step="next">Next &rarr;</button>' +
        '<div class="guide-dots" role="tablist" aria-label="Steps">' + STEPS.map((s, i) =>
          '<button type="button" role="tab" class="guide-dot" data-goto="' + i + '" aria-label="Step ' + (i + 1) + ': ' + esc(s.title) + '"></button>').join('') + '</div></div>' +
        '<div class="guide-step" id="guide-step" aria-live="polite"></div></div></section>';
    }

    renderStep() {
      const i = this.ui.step;
      const s = STEPS[i];
      this.root.querySelector('#guide-step').innerHTML =
        '<p class="guide-step__meta"><span class="guide-step__n">' + (i + 1) + ' / ' + STEPS.length + '</span>' + badge(s.who) + '</p>' +
        '<h4 class="guide-step__title">' + esc(s.title) + '</h4><p class="guide-step__text">' + esc(s.text) + '</p>' +
        codeBlock(s.code, s.lang, s.file);
      this.root.querySelectorAll('.guide-dot').forEach((d, k) => {
        d.classList.toggle('is-on', k === i); d.classList.toggle('is-past', k < i); d.setAttribute('aria-selected', k === i ? 'true' : 'false');
      });
      this.root.querySelectorAll('.guide-track__node').forEach((n) => n.classList.toggle('is-on', +n.dataset.node === s.node));
      const pulse = this.root.querySelector('#guide-pulse');
      pulse.style.left = s.pos + '%';
      pulse.className = 'guide-track__pulse guide-track__pulse--' + s.who;
      this.root.querySelector('[data-step="prev"]').disabled = i === 0;
      this.root.querySelector('[data-step="next"]').disabled = i === STEPS.length - 1;
    }

    go(i, keepPlaying) {
      this.ui.step = Math.max(0, Math.min(STEPS.length - 1, i));
      if (!keepPlaying) this.stop();
      this.renderStep();
    }

    play() {
      if (this.ui.playing) { this.stop(); return; }
      if (this.ui.step >= STEPS.length - 1) this.ui.step = 0;
      this.ui.playing = true;
      this.renderStep();
      this.setPlayLabel();
      this._timer = setInterval(() => {
        if (this.ui.step >= STEPS.length - 1) { this.stop(); return; }
        this.go(this.ui.step + 1, true);
      }, 3200);
    }

    stop() {
      clearInterval(this._timer);
      this._timer = null;
      this.ui.playing = false;
      this.setPlayLabel();
    }

    setPlayLabel() {
      const b = this.root.querySelector('#guide-play');
      if (b) b.innerHTML = this.ui.playing ? '&#10073;&#10073; Pause' : '&#9654; Play';
    }

    // ----- section 4
    recipeHTML() {
      return '<section class="guide-sec" aria-labelledby="guide-rc-t">' +
        this.head('04', 'guide-rc-t', 'Design a feature from scratch', 'Five moves, in this order, to add a <em>Garden</em> page to JimMvc. Pick a step to see its code.') +
        '<div class="guide-recipe"><ol class="guide-recipe__list" role="tablist" aria-label="Recipe steps">' + RECIPE.map((r, i) =>
          '<li><button type="button" role="tab" class="guide-rstep guide-rstep--' + r.part + '" data-recipe="' + i + '"><span class="guide-rstep__n">' + (i + 1) + '</span><span class="guide-rstep__t">' + r.n + '</span><span class="guide-rstep__p">' + PART[r.part] + '</span></button></li>').join('') +
        '</ol><div class="guide-recipe__panel" id="guide-recipe-panel" role="tabpanel" aria-live="polite"></div></div></section>';
    }

    renderRecipe() {
      const r = RECIPE[this.ui.recipe];
      this.root.querySelectorAll('.guide-rstep').forEach((b, k) => { b.classList.toggle('is-on', k === this.ui.recipe); b.setAttribute('aria-selected', k === this.ui.recipe ? 'true' : 'false'); });
      this.root.querySelector('#guide-recipe-panel').innerHTML =
        '<p class="guide-recipe__why">' + badge(r.part) + ' ' + esc(r.why) + '</p>' + codeBlock(r.code, r.lang, r.tab);
    }

    // ----- section 5
    smellsHTML() {
      return '<section class="guide-sec" aria-labelledby="guide-sm-t">' +
        this.head('05', 'guide-sm-t', 'Anti-patterns', 'Four ways the roles blur. Select a card to turn it over.') +
        '<div class="guide-smells">' + SMELLS.map((s, i) =>
          '<article class="guide-smell guide-smell--' + s.part + '"><button type="button" class="guide-smell__btn" data-smell="' + i + '" aria-expanded="false">' +
          '<span class="guide-smell__part">' + PART[s.part] + ' gone wrong</span><span class="guide-smell__name">' + s.name + '</span>' +
          '<span class="guide-smell__cue" aria-hidden="true">+</span></button>' +
          '<div class="guide-smell__body"><div class="guide-smell__inner">' +
          '<h5>Symptom</h5><p>' + esc(s.symptom) + '</p><h5>Why it hurts</h5><p>' + esc(s.hurts) + '</p><h5>The fix</h5><p>' + esc(s.fix) + '</p>' +
          '</div></div></article>').join('') + '</div></section>';
    }

    quoteHTML() {
      return '<blockquote class="guide-quote"><p><span class="guide-q-m">The Model is the truth.</span> <span class="guide-q-v">The View is a portrait of it.</span> <span class="guide-q-c">The Controller is the hand that changes it.</span></p>' +
        '<footer>Keep the three apart, and each one stays easy to change.</footer></blockquote>';
    }

    // ----- events
    onClick(e) {
      const t = e.target.closest('button');
      if (!t || !this.root.contains(t)) return;
      if (t.dataset.unplug) {
        // intent only: the SystemController decides what to do with it
        this.ctx.bus.emit('intent:set', { part: t.dataset.unplug, alive: false });
        const target = document.getElementById('living');
        if (target) target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      } else if (t.dataset.from) {
        this.selectCell(t.dataset.from, t.dataset.to, false);
      } else if (t.dataset.step === 'prev') this.go(this.ui.step - 1);
      else if (t.dataset.step === 'next') this.go(this.ui.step + 1);
      else if (t.dataset.step === 'play') this.play();
      else if (t.dataset.goto !== undefined) this.go(+t.dataset.goto);
      else if (t.dataset.recipe !== undefined) { this.ui.recipe = +t.dataset.recipe; this.renderRecipe(); }
      else if (t.dataset.smell !== undefined) {
        const card = t.closest('.guide-smell');
        const open = !card.classList.contains('is-open');
        card.classList.toggle('is-open', open);
        t.setAttribute('aria-expanded', open ? 'true' : 'false');
        t.querySelector('.guide-smell__cue').textContent = open ? '−' : '+';
      }
    }

    onKey(e) {
      const stepper = e.target.closest && e.target.closest('.guide-stepper');
      if (stepper && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.target.closest('pre')) {
        e.preventDefault();
        this.go(this.ui.step + (e.key === 'ArrowRight' ? 1 : -1));
        return;
      }
      const cell = e.target.closest && e.target.closest('.guide-cell[data-from]');
      if (cell && e.key.indexOf('Arrow') === 0) {
        e.preventDefault();
        let r = MATRIX_PARTS.indexOf(cell.dataset.from), c = MATRIX_PARTS.indexOf(cell.dataset.to);
        const dr = { ArrowDown: 1, ArrowUp: -1 }[e.key] || 0, dc = { ArrowRight: 1, ArrowLeft: -1 }[e.key] || 0;
        for (let n = 0; n < 4; n++) {
          r += dr; c += dc;
          if (r < 0 || r > 3 || c < 0 || c > 3) return;
          if (M[MATRIX_PARTS[r]][MATRIX_PARTS[c]].k !== 'self') { this.selectCell(MATRIX_PARTS[r], MATRIX_PARTS[c], true); return; }
        }
      }
    }
  }

  ns.GuideView = GuideView;
})(window.MVCX = window.MVCX || {});
