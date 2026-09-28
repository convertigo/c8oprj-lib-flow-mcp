# Flow Svelte Frontend

Flow Svelte frontends: source documents, the authoring loop, bindings, actions, components, themes and known limits.

Use Flow Svelte like FlowScript: write a small number of readable source files,
let MCP validate them, and never edit generated Svelte. For full-stack work,
read `flow://guide/fullstack-paperboard` first. Read
`flow://guide/frontend-svelte-routing` only for optional/rest/matched segments,
route groups or advanced layouts.

## Mental Model

An application is made of Pages. A distinct business step is a Page; a small
transient state may remain in the current Page only when `If` makes the
surfaces mutually exclusive. One business Page is active at a time, including
in POC mode.

Sources live in `_flow/frontbuilder/svelte/model/<App>/src/`:

| Flow source | SvelteKit projection |
| --- | --- |
| `src/routes/+page.flow.svelte` | `/`, generated `+page.svelte` |
| `src/routes/products/+page.flow.svelte` | `/products` |
| `src/routes/+layout.flow.svelte` | inherited root `+layout.svelte` |
| `src/routes/(app)/...` | layout group, absent from the URL |
| `src/lib/components/<Name>.flow.svelte` | application component `<Name>` |
| `src/theme.flow.css`, `src/app.flow.css`, `src/i18n/<locale>.json` | theme, free CSS, translations |
| `Navigate`, `GoBack` | `goto` and browser history |

Pages and Layouts outside `src/routes` are refused
(`FLOW_ROUTES_ROOT_REQUIRED`). Knowing SvelteKit helps, but never edit
`_private/svelte`, call `$app/navigation`, read the URL manually or write
generated `+page.svelte` files.

## Source Documents

A Page, Layout or component is one `.flow.svelte` file: a module header, then
one `<FlowComponent>` root whose children are the slots `Variables` (typed
state), `Events` (lifecycle) and `Structure` (visible UI only):

```svelte
<script module>
  export const _flow = {
    sourceVersion: 2,
    page: { id: "product", title: "Product" }
  };
</script>

<FlowComponent $$id="product" label="Product">
  <Structure>
    <Text $$id="tab" text="@route.query.tab" />
  </Structure>
</FlowComponent>
```

- Every file declares `sourceVersion: 2` in its `_flow` (or `_meta`) header,
  otherwise `FLOW_SOURCE_VERSION_REQUIRED`. Headers hold static literals only;
  writers update the existing `<script module>` and never add a second one.
- `$$id` is the node identity (Name). `$$comment` is a note and
  `$$disabled={true}` removes the node and its subtree from rendering and
  execution; enabled nodes omit it. Plain attributes are widget or business
  properties: `<Input $$id="editor" id="customer-field" disabled={true} />`
  has identity `editor`, DOM id `customer-field` and a disabled widget.
- One `$$id` namespace per document: a component cannot reuse the `$$id` of a
  `State`. Rename changes `$$id` only.
- A Page root may carry `label`; a component keeps its label in its header.
- Put `class` and layout properties on the first visible child of
  `Structure`, usually `PageShell`. Lifecycle blocks never go in `Structure`.
- Wrapper tags such as `Children`, `Events`, `Actions`, `Params`, `Query`,
  `Then` and `Else` are exact. Spreads, directives and unknown children are
  rejected, never dropped silently.
- Canonical formatting is one attribute per line: `$$` attributes first, then
  business attributes sorted alphabetically. The first write of a compact or
  unsorted file reorders all of it; expect that diff and continue from the
  returned revision (use `code-rg` extracts afterwards). A property edited
  back to its default (a literal equal to the default included) is removed
  from the source; absent means default.

## Authoring Loop

For a fresh, simple single-Page application, use this fast path and do not add
inspection calls between its steps:

```text
flow-project-bootstrap(ui:true) -> dev.ensure(wait:false) -> code-get
-> code-set(reveal:true) -> app.flow.css set if needed
-> dev.sync once -> one browser proof -> dev.open only if no viewer was returned
```

`dev.ensure`, `dev.sync` and `dev.open` are `actionId` values of
`frontend-svelte-action`. The bootstrap `studioTarget` and
`code-get.authoringContract` are sufficient to address the initial Page. Do
not call `frontend-svelte-tree` merely to rediscover it. When a portable block
property contract is missing, make one focused `authoring-palette` call with
the exact qualified `parentPath` returned by `code-get` or `authoring-tree`;
never compose that path from the logical Page id. After a successful
`code-set(reveal:true)`, use the authored `$$id` and source path as the reveal
target.

When bootstrap returns `existing:true`, treat the sequence as an existing
project, not as a creation. If the one `dev.ensure` response is already active
(`pending:false`, with `browser` and `openUrl`) and `code-get` proves that the
source already satisfies the request, stop and answer: this is a successful
no-op. Do not repeat `dev.ensure`, and do not call `code-check`, `code-set`,
`dev.sync` or `flow-app-progress` for unchanged source. `code-check` is for an
explicit dry-run or a changed draft; `dev.sync` follows a mutation or completes
a pending preparation, never an unchanged active viewer.

1. Call `code-get({ project, kind:"source" })` once. It returns the current
   source, revision, every Page (`id`, `path`, typed parameters, sourceFile),
   the compact block contract and the application stylesheet path in
   `authoringContract.sources.applicationStyles`. Then call
   `frontend-svelte-action({ project, actionId:"dev.ensure", wait:false })`
   once: it preserves a running viewer and restarts it after a Studio
   relaunch. Do not poll or repeat it.
2. Plan the Pages and transitions. Write each complete Page with `code-set`
   and `sourceFile`; it validates before the atomic write. Write target Pages
   before the Pages that navigate to them (`FRONTEND_NAVIGATE_PAGE_UNKNOWN`
   otherwise). A new Page has no revision; existing Pages use theirs.
3. For later changes, `code-rg({ project, kind:"source", pattern })`: a unique
   match carries the `sourceFile` and `revision` for the smallest
   `code-patch`. Use a bounded `code-get` range only when context is missing.
   The same tools edit the stylesheet at
   `authoringContract.sources.applicationStyles`; do not guess that path.
4. Use one targeted palette lookup only when the contract lacks a block,
   property or schema path, and a focused tree only when a source target is
   genuinely unknown. Apply returned picker mutations unchanged.
5. For a freshly bootstrapped UI project, `dev.ensure` right after bootstrap
   lets npm initialize while you author; Vite and the Studio viewer open when
   setup completes. Call `dev.sync` once after the final repair pass; use
   `dev.open` only to reveal an already running viewer.
6. `flow-app-progress` is optional on the fast path; add `qname` only when a
   real backend Flow is part of the application. Prove the requested visible
   and interactive behavior in the live viewer, including images without 404.
   Build production only for deployment or an explicit production check.
   Never claim a color, layout, timer, navigation or viewer state that was
   not observed.

On a project loaded in Convertigo, MCP writes are working copies like Studio
edits (`draft:true`, `dirty:true`): they are previewed and checked at once and
written to disk by **Save project**. Standalone runs write the files.

## Assets

Import each image once with `frontend-svelte-asset-import({ project,
sourceFile, assetPath:"resources/<name>" })`. It writes inside the project's
`resources/` directory and returns the canonical `resources/...` URL; use it
unchanged in an Image property or in `app.flow.css`. Do not shell-copy files,
duplicate them under `_flow`, or edit `_private/svelte/static`. `code-check`
reports `FRONTEND_ASSET_MISSING` for an absent image; the final browser pass
must still catch 404s.

For repeated UI patterns, validate one pilot, propagate with small
revisioned patches, then check each changed source once. Do not assemble an
application with hundreds of tree mutations, and do not guess Ionic, NGX,
CSS or HTML property names.

## Themes And Palettes

Use semantic layout properties for structure, the source-backed
`theme.flow.css` for tokens and the free-form `app.flow.css` plus explicit
`class` names for visual rules. Palette and display mode are independent:

- Define each named palette in `theme.flow.css` under `@layer flow.theme`
  with `:root[data-flow-palette="name"]`, and its dark values with the same
  selector plus `[data-flow-theme="dark"]`.
- `ThemePaletteControl` is the standard style selector (it reads
  `@theme.options`); omit it when only one palette exists.
- `DisplayModeControl` is the standard System/Light/Dark control and owns its
  persistence. Use `ThemeSwitch` and `BrowserPreference` only for a custom
  presentation.
- Consume semantic values in `app.flow.css` with `var(--flow-color-background)`,
  `var(--flow-color-surface)`, `var(--flow-color-text)`,
  `var(--flow-color-primary)` and related tokens; hard-coded colors are for
  artwork and local effects only.

```css
@layer flow.theme {
  :root[data-flow-palette="ocean"] {
    --flow-color-background: #eff6ff;
    --flow-color-primary: #0369a1;
  }
  :root[data-flow-palette="ocean"][data-flow-theme="dark"] {
    --flow-color-background: #082f49;
    --flow-color-primary: #38bdf8;
  }
}

.page {
  background: var(--flow-color-background);
  color: var(--flow-color-text);
}
```

`code-check` warns with `FLOW_THEME_TOKENS_UNUSED` (many literal colors, no
semantic token) and `FLOW_THEME_PRIVATE_TOKENS`. Test every named palette in
light and dark mode: browser proof must observe `data-flow-palette`,
`data-flow-theme`, a changed computed token, a visible change and restoration
after reload. A tree with only `Themes > Default` means no named palette was
authored.

Custom fonts are project sources in `_flow/fonts/<provider>/<family>/`
(`font.json` with its license, plus `*.woff2`). A theme token such as
`--c8o-font-family: "Inter", system-ui, sans-serif;` naming a carried family
makes generation embed the files. No tool downloads fonts yet. Icons are SVG
sources under `_flow/icons/iconify/<set>/` (see
`flow://guide/custom-blocks`).

## Pages And Navigation

Give each Page a stable logical id in `_flow.page.id` and navigate by that id,
never by constructing a URL:

```svelte
<Navigate $$id="openProduct" page="product">
  <Query>
    <Variable name="id" value="@item.id" />
    <Variable name="tab" value="details" />
  </Query>
</Navigate>
```

The generator resolves the Page path, checks required parameters and encodes
segments and query. `Params` fills route parameters of a `[param]` Page
(`flow://guide/frontend-svelte-routing`). The target Page reads
`@route.query.<name>` (and `@route.params.<name>`):

```svelte
<FullSyncGet $$id="readProduct" database="retailstore" docid="@route.query.id" />
```

`authoringContract.pages` from `code-get` is authoritative for ids, paths and
parameters. `Navigate.to` is an expert escape hatch for an external route.
Use a visible Button with `GoBack` and a fallback for direct entry. Static
links use `<LinkButton $$id="toProduct" label="Product" page="product" />`;
the fallback syntax `~/help` is rooted at the deployed application base,
`/help` at the web origin. When navigation follows `SetValue`,
`FullSyncGet`, `FullSyncView`, `FullSyncSync` or `CallSequence`, place
`Navigate` after that action in the same `Actions` slot.

## Values And Bindings

A bindable property has three human modes, as in the Studio picker:

- **Literal:** `label="News"` (or `value={true}` for non-strings);
- **Source:** `text="@.GetNews.news"`, a schema-backed reference that always
  starts with `@`;
- **Compose:** ordered literal, source and expression parts
  (`expression.parts`) such as `index + 1 + " / " + total`; a source framed by
  text is Compose, not Source.

A raw `{expression}` stays available for advanced browser-only logic. Write
`@source.path` references or concise expressions in source; never hand-write
the internal `FlowValueBinding` JSON, and apply `suggestedBinding` or an exact
picker mutation when validation returns one. A source path can always be
typed; schema paths are suggestions. Use the canonical bindable property of
each block: `Text.text`, `Button.label`, `Image.src`, `ForEach.source`.

Sources:

- `@.Sequence.path` (or `@.Sequence#marker.path`): the last result of that
  sequence, as in NGX, wherever a `CallSequence` ran it on the page;
- `@<actionId>.path`: a FullSync or portable action result;
- `@page.name`, `@layout.name`, `@comp.name`: a variable (`State`, `Derived`,
  `Translations`) named by its owner, as in NGX: `page.` in a page,
  `layout.` in a layout, `comp.` in a component. A page reads the variables of
  its Layouts as `@layout.name` (the nearest Layout declaring `name`);
- `@<context>.path` and `@index` inside a `ForEach` (`@row.name` under
  `context="row"`), or the explicit `@<forEachId>.item.path` and
  `@<forEachId>.index`;
- `@event.value`, `.checked`, `.key`, `.name`: the normalized event;
- `@route.path`, `@route.params.id`, `@route.query.tab`: current route;
- `@props.<name>`: a component input (inside a component);
- `@theme.available`, `@theme.options`, `@theme.default`: application themes.

```svelte
<ForEach $$id="news" source="@.GetNews.news" context="item" index="index">
  <Children>
    <Image $$id="image" src="@item.imageUrl" />
    <Text $$id="title" text="@item.title" />
    <Text $$id="position" text="@news.index" />
  </Children>
</ForEach>
```

Client action parameters reject free browser expressions; use a source, a
literal or a portable block for computation.

`Combobox` is the standard searchable choice. Its default contract is closed:
typing filters `options`, but only a proposed value is accepted. Set
`allowCustomValue={true}` when the field must also accept a new business
label; `@event.value` is then the selected value or the typed text, so one
backend Flow must resolve an existing id or create the value and reject an
empty label. Do not emulate this with `Input`, `ForEach` and buttons.

## Structure And Actions

```text
FlowComponent -> Variables -> State / Derived / DerivedBy / Translations
FlowComponent -> Events -> OnMount / OnDestroy / Effect / PreEffect / Interval / Timeout
FlowComponent -> Structure -> PageShell
Button -> Events -> OnClick -> Actions -> CallSequence -> Variables
Input -> Events -> OnChange -> Actions -> portable block
ForEach -> Children -> Card
If -> Then / Else
Layout -> PageContent
```

Use palette blocks for layout (`PageShell`, `RowLayout`, `ColumnLayout`,
`GridLayout`, `Card`), display, forms and navigation. A Layout must contain
`PageContent`. Do not hide behavior in CSS, generated code or browser
globals. To skip a block temporarily, patch `$$disabled={true}` onto it;
remove the attribute to restore it.

Page lifecycle goes in the root `Events` slot. `Interval` and `Timeout`
register on mount and clean up on teardown; nest them under `OnMount` only
inside a larger explicit mount chain. `OnMount once={true}` survives route
round trips but not a full reload.

Declare mutable state with `State` and computed state with `Derived` or
`DerivedBy` in `Variables`. Write state with an action `target="page.name"`
(`<SetValue $$id="setLanguage" target="page.language" value="fr" />`) and
read it with `@page.name` (`layout.` / `comp.` in a layout or a component).
The former `local.name` is still read and rewritten on save.

Inside an event, an action's Output may instead declare a variable of that
event, as a `let` in JavaScript: `$$out="local.probe"` keeps the result for the
following actions of the same run only (`value="@local.probe.message"`). It is
not visible in the page structure nor to earlier actions, and every run of the
event starts without it.

```svelte
<OnMount $$id="mount"><Actions>
  <CallSequence $$id="callProbe" $$out="local.probe" requestable=".LiveProbe" />
  <SetValue $$id="keep" target="page.message" value="@local.probe.message" />
</Actions></OnMount>
``` `Variable` is the argument block of actions,
Params and Query, not page state. Initialize local state before long network
actions, and keep provisioning, synchronization and the first query separate
so progress and errors remain observable.

```svelte
<CallSequence $$id="getDetail" marker="cardDetail" requestable=".GetDetail">
  <Variables><Variable name="id" value="@item.id" /></Variables>
</CallSequence>
```

`marker` is an optional static identity that keeps a separate result per
marker (`@.GetDetail#cardDetail.name`), not a business parameter; per-item
results stay scoped to the iterator. Use `SetValue`,
`UpdateList` and `UpdateNumber` for explicit client state, `Derived` /
`DerivedBy` for pure projections, and portable blocks (inserted by their
palette tag, never `RunAxiom`) for reusable browser logic. For FullSync, read
`flow://guide/fullsync`. `Status` displays the action named by its `actionId`.

### Clocks And Timers

`Interval` and `Timeout` are schedulers: their callback count is not elapsed
time. For clocks and stopwatches, read wall-clock timestamps and compute from
them with `DateNow`, `DateFormat`, `NumberAdd`, `NumberSubtract`,
`NumberChoose` and `DurationFormat`; `authoringContract.portableBlocks` lists
their properties and a `wallClock` recipe. Look up one exact block (for
example `date.now`) in the palette only when its properties are absent. A
portable action's `target` is optional: omit it and bind `@<$$id>`, or write
an existing `page.name`. Never implement a stopwatch by counting `Interval`
callbacks.

## Components And Inputs

A reusable Flow component is a `<FlowComponent>` whose header declares
`kind: "component"` and its inputs in `props`; inside it, `@props.<name>`
reads an input:

```svelte
<script module>
  export const _flow = {
    sourceVersion: 2,
    kind: "component",
    id: "greeting",
    label: "Greeting",
    props: {
      title: { label: "Title", type: "string", default: "Hi", description: "Heading text." }
    }
  };
</script>

<FlowComponent $$id="greeting">
  <Structure>
    <Text $$id="text" text="@props.title" />
  </Structure>
</FlowComponent>
```

Saved as `src/lib/components/Greeting.flow.svelte`, it is used by its tag;
each input is a bindable property: `<Greeting $$id="hello" title="@route.path" />`.
Its label lives in the header (no `label` attribute on its root), and each
instance owns its own state. An unknown input path gives
`FRONTEND_BINDING_PATH_UNKNOWN`.

Shared components live in the builder root
`_flow/frontbuilder/svelte/components/<namespace>/<Tag>.flow.svelte` of the
defining project (older libraries stay flat under `components/`). Studio shows
them under **Catalog > Components** in two forms:

- **Flow UI block:** a `<FlowComponent>` with an `_flow` header, edited as a
  tree (Variables / Events / Structure) like the example above;
- **Svelte UI block:** Svelte code described by an `export const _meta`
  header (`sourceVersion: 2`, `id: "<namespace>.<name>"`, `tag`, `kind`,
  `runtime: "flow-svelte"`, `props`, `slots`, `targetKinds`, `icon`,
  `description`), edited through Open source. Read an existing one with
  `code-get` before writing a new one.

A `<Tag>.flow.css` beside a component is its CSS. A provider may declare
exact npm versions in `_meta.implementation.dependencies`; `dev.sync`
installs them. Never run npm manually or edit the generated `package.json`.

Before creating a local component or mock, query the contextual palette:
`authoring-palette({ project, parentPath, query:"chart" })` with a
`parentPath` returned by `authoring-tree` and the business capability as
`query`. Execute the matching item's `apply` unchanged; the palette searches
the project, its references and the workspace and adds a required project
reference. `flow-project-reference` adds a reference explicitly, or pass
`references` to `flow-project-bootstrap`. Referenced components are read-only
library blocks: edit them in their provider project. Otherwise keep a typed,
visibly incomplete mock; never replace a requested chart with a table or fake
data. `authoring-tree` omits the catalogs by default; use the palette for
discovery.

## Known Limits

- Dynamic routes such as `product/[id]` fail with HTTP 400 in the dev viewer
  behind the Studio gateway. Use a static Page, pass the id with
  `Navigate` `Query`, and read `@route.query.id`.
- `Await` announces a `pending` slot that the model refuses (`Undeclared slot
  "pending"`); show progress with `Status` instead.
- A literal containing braces was reported to break project-wide validation
  without naming the file; keep braces inside `{expression}` values.

## Diagnostics

`code-check` rejects unknown blocks or properties, duplicate `$$id`s, invalid
slots, unresolved sources, unknown Page ids and missing required Page
parameters with a direct correction or one focused lookup. Do not work around
them with filesystem edits or raw Svelte APIs.

For one property picker, use:

```text
frontend-svelte-tree({
  project,
  detail:"inspect",
  focusPath,
  maxDepth:0,
  property:"text",
  sourceId
})
```

Set `property` to the exact bindable property of the block contract (`text`,
`label`, `src`, `source`). Create a typed frontend mock only when no
canonical block expresses the requirement; a POC is unfinished while the mock
remains.

## POC Acceptance

A POC proves the requested path, including its Page transitions and requested
content. It may defer exhaustive history, offline restoration, responsive
coverage and polish. It may not stack downstream business steps in one
scrolling Page.

Execute the build-provided safe Playwright plan. Prefer roles, visible text,
images and documented `data-*` attributes; `$$id`s are not DOM ids. On
failure, allow one focused browser diagnostic instead of an exploratory test
campaign. Do not infer that a network-backed component works from its
container size: for maps, confirm one tile image has `naturalWidth > 0`, and
apply the equivalent resource check to other visualizations.
