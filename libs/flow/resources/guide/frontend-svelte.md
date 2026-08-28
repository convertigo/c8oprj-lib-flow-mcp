# Flow Svelte Frontend

Use Flow Svelte like FlowScript: write a small number of readable source files,
let MCP validate them, and never edit generated Svelte. For full-stack work,
read `flow://guide/fullstack-paperboard` instead. Read
`flow://guide/frontend-svelte-routing` only for optional/rest/matched segments,
route groups or advanced layouts.

## Mental Model

An application is made of Pages. A distinct business step is a Page; a small
transient state may remain in the current Page only when `If` makes the
surfaces mutually exclusive. One business Page is active at a time, including
in POC mode.

| Flow source | SvelteKit projection |
| --- | --- |
| `src/routes/+page.flow.svelte` | `/`, generated `+page.svelte` |
| `src/routes/products/+page.flow.svelte` | `/products` |
| `src/routes/product/[id]/+page.flow.svelte` | `/product/[id]` |
| `src/routes/+layout.flow.svelte` | inherited root `+layout.svelte` |
| `src/routes/(app)/...` | layout group, absent from the URL |
| `Navigate`, `GoBack` | `goto` and browser history |

Knowing SvelteKit helps understand this projection but does not permit editing
`_private/svelte`, calling `$app/navigation`, reading the URL manually, or
writing generated `+page.svelte` files.

## Authoring Loop

1. Call `code-get({ project, kind:"source" })` once. It returns the current
   source, revision, every Page (`id`, `path`, typed parameters and sourceFile),
   the compact canonical block contract, and the exact application stylesheet
   path in `authoringContract.sources.applicationStyles`.
   Immediately call `frontend-svelte-action({ project,
   actionId:"dev.ensure", wait:false })`. This idempotent preflight preserves a
   running viewer and restarts it after Studio was relaunched, so subsequent
   mutations are visible live. Do not poll it.
2. Plan the Pages and transitions. Write each complete Page with
   `code-check`, then `code-set`, addressing it by `sourceFile`. A new Page has
   no revision. Existing Pages use their returned revision.
3. Use `code-patch` only for focused later changes and `code-rg({ project,
   kind:"source", pattern })` to search every canonical frontend source. The same
   tools read and update the project application stylesheet when `sourceFile`
   is `authoringContract.sources.applicationStyles`; do not search for or
   guess that path.
4. Use one targeted tree/palette lookup only when the contract lacks a block,
   property or schema path. Apply returned picker mutations unchanged.
5. For a freshly bootstrapped UI project, call the same `dev.ensure` action
   immediately after bootstrap so npm initializes while you author. Do not
   poll or retry it: Vite and the Studio viewer open automatically
   when setup completes. Call `dev.sync` once after the final repair pass to
   regenerate the completed source; use `dev.open` only to reveal an already
   running viewer.
6. Call `flow-app-progress({ project, mode:"poc" })` once for frontend-only
   work. Add `qname` only when a real backend Flow is part of the application.
   Use the live dev viewer to prove the requested visible and interactive
   behavior and confirm referenced images load without 404 responses. Build
   production only for deployment or an explicit production check. Never claim
   a color, layout, timer, navigation or viewer state that was not observed.

## Assets

Import each supplied or generated image once with
`frontend-svelte-asset-import({ project, sourceFile,
assetPath:"resources/<name>" })`. The tool validates the file, writes it only
inside the project's `resources/` directory, synchronizes the dev projection,
and returns the canonical `resources/...` URL. Use that URL unchanged in an
Image property or in `app.flow.css`; the generator resolves it in both dev and
production. Do not copy files with shell commands, do not duplicate them under
`libs/flow/resources`, and do not edit `_private/svelte/static`.

`code-check` reports `FRONTEND_ASSET_MISSING` when a canonical source refers to
an absent project image. `flow-app-progress` is structural readiness, not
browser/network proof; the final Playwright pass must still catch 404s.

Do not assemble an application with hundreds of tree mutations. Do not guess
Ionic, NGX, CSS or HTML property names. Use semantic layout properties for
structure, the source-backed `theme.flow.css` project theme, and the free-form `app.flow.css` application stylesheet plus explicit `class` names for
visual rules that do not belong in a component contract. Source wrapper tags
such as `Children`, `Events`, `Actions`, `Params`, `Query`, `Then` and `Else`
are exact.

`FlowComponent` is the non-visual source root and accepts only `id` and
`label`. Its three authoring slots have distinct roles:

```text
FlowComponent
  Variables  -> page-local typed state
  Events     -> page lifecycle such as OnMount and Interval
  Structure  -> visible UI only
```

Put `class` and visual layout properties on the first visible child in
`Structure`, usually `PageShell`. Lifecycle blocks never belong in
`Structure`.

## Pages And Navigation

Give each Page a stable logical id in its metadata:

```svelte
<script module>
  export const _flow = {
    page: { id: "product", title: "Product" }
  };
</script>
```

Navigate by Page id, never by constructing its URL:

```svelte
<Navigate id="openProduct" page="product">
  <Params>
    <Variable name="id" value="@item.id" />
  </Params>
  <Query>
    <Variable name="tab" value="details" />
  </Query>
</Navigate>
```

The generator resolves the Page path, checks required parameters, encodes
segments and builds the query. The target Page reads:

```svelte
<FullSyncGet id="readProduct" database="retailstore"
  docid="@route.params.id" />
```

The `authoringContract.pages` returned by `code-get` is authoritative. It exposes
each parameter as `@route.params.<name>`. `Navigate.to` remains an expert
compatibility escape hatch for an external or unmodelled route; prefer `page`.
Use a visible Button with `GoBack` and a fallback for direct entry.

Static links may use `LinkButton`. When navigation follows `SetValue`,
`FullSyncGet`, `FullSyncView`, `FullSyncSync` or `CallSequence`, place Navigate
after that action in the same `Actions` slot.

## Values And Bindings

Flow Svelte preserves the three NGX SmartType intents:

- `property="News"`: literal value (TXT);
- `property={count + " items"}`: browser expression (JS);
- `property="@loadNews.news"`: typed schema-backed source (picker).

The quoted/expression distinction matters. A schema-backed value always starts
with `@`. Use the canonical bindable property of each block:
`Text.text`, `Button.label`, `Image.src`, and `ForEach.source`. The old
`source` property on Text, Button and Image is a hidden migration alias, not
authoring syntax.
Common sources are:

- `@action.path`: action, requestable or FullSync result;
- `@local.name`: a typed page-local Variable;
- `@item.path`, `@index`: lexical aliases inside ForEach;
- `@loop.item.path`, `@loop.index`: explicit iterator forms;
- `@event.value`, `.checked`, `.key`, `.name`: normalized event;
- `@route.params.id`, `@route.query.tab`: current Page route.

```svelte
<ForEach id="news" source="@loadNews.news" context="item" index="index">
  <Children>
    <Image id="image" src="@item.imageUrl" />
    <Text id="title" text="@item.title" />
    <Text id="position" text="@index" />
  </Children>
</ForEach>
```

MCP compiles these references to internal `FlowValueBinding` objects. Humans
and agents should not author those objects. Client action parameters reject
free browser expressions; use a source, a literal, or a portable dual-target
block for computation. Apply `suggestedBinding` or an exact picker mutation
when validation returns one.

Studio may compose a bindable value from ordered literal, source and explicit
code parts. This supports displays such as `index + 1 + " / " + total`, wrappers
such as `[index]`, and nullish defaults while preserving each picked source.
This is a human-facing authoring model, not another JSON syntax for agents to
hand-write. In Flow source, keep using intuitive `@source.path` references or a
concise browser expression; let MCP lower and validate the representation.

## Structure And Actions

Pages, layouts, visible blocks, directives, events and actions remain visible
in treeview and properties. Typical structures are:

```text
FlowComponent -> Variables -> State / Derived / DerivedBy
FlowComponent -> Events -> OnMount / OnDestroy / Effect / PreEffect / Interval / Timeout
FlowComponent -> Structure -> PageShell
Button -> Events -> OnClick -> Actions -> CallSequence -> Variables
ForEach -> Children -> Card
If -> Then / Else
Layout -> PageContent
```

Temporarily skip an existing block with
`frontend-svelte-mutate({ project, sourceFile, mutation:
{ op:"setEnabled", path:sourceMutationPath, enabled:false } })`, using the
`sourceMutationPath` returned by the tree. Set `enabled:true` to restore it.
A disabled frontend block and its subtree remain authorable but are omitted
from generated Svelte, including their actions and imports.

Use palette blocks for layout (`PageShell`, `RowLayout`, `ColumnLayout`,
`GridLayout`, `Card`), display, forms and navigation. Do not hide behavior in
page CSS, generated code or browser globals. A layout must contain
`PageContent`.

Use `OnMount`, `OnDestroy`, `Effect`, `PreEffect`, `Interval` or `Timeout` in
the root `Events` slot for page lifecycle. `Interval` and `Timeout` register
when the component mounts and clean their timer up automatically on teardown;
nest them under `OnMount` only when their creation is part of a larger explicit
mount chain.

Declare mutable page-local state with `State`, and computed state with
`Derived` or `DerivedBy`, in the root `Variables` slot. Write mutable state
with an action `target="local.name"` and read it through `@local.name`; the
picker exposes the declared schema. `Variable` remains the argument block for
action variables, route Params and Query values, not page-local state.
Initialize local state before long network actions. Keep provisioning,
synchronization and the first local query separate so progress and errors
remain observable. `OnMount once={true}` survives route round-trips but not a
full browser reload.

For FullSync, read `flow://guide/fullsync` and use `FullSyncGet`,
`FullSyncView`, `FullSyncSync` and `FullSyncReset`; never hand-write PouchDB or
`fs://` calls. Give Status the exact `actionId` it displays.

CallSequence identity remains stable:

```svelte
<CallSequence id="getDetail" requestable=".GetDetail" marker="cardDetail">
  <Variables><Variable name="id" value="@item.id" /></Variables>
</CallSequence>
```

`marker` is optional static NGX-compatible identity, not a business parameter.
Per-item results remain scoped to the iterator. Put business values in
Variables.

Use `SetValue`, `UpdateList` and `UpdateNumber` for explicit client state.
Their values are literals or schema-backed sources, not arbitrary browser
expressions. Use `Derived`/`DerivedBy` for pure computation from state, or a
typed frontend Flow block for reusable browser behavior. Pure dual-target Flow
blocks are inserted directly by their palette tag. `RunAxiom` is legacy
migration syntax, not authoring syntax.

### Clocks And Timers

`Interval` and `Timeout` are schedulers. Their callback count is not elapsed
time: browser throttling, a busy UI or a suspended tab can delay callbacks.
For clocks and stopwatches, read wall-clock timestamps and compute from them.

The compact `authoringContract.portableBlocks` advertises the typed Flow actions
available to source authoring. Prefer `DateNow`, `DateFormat`, `NumberAdd`,
`NumberSubtract`, `NumberChoose` and `DurationFormat` over one opaque browser
expression when they match the intent. Perform one exact palette lookup for the
chosen tag when its properties are needed. A typical refresh chain reads now,
formats or subtracts it, then publishes the typed result with `SetValue`.

Keep `Derived` and `DerivedBy` for small pure projections of already typed
state. Do not implement a stopwatch by incrementing a counter on every
`Interval` callback.

### Shared Project Components

Reusable Svelte components live in the provider project's canonical
`libs/flow/frontbuilder/svelte/components` directory. Before creating a local
component or mock, call the same contextual palette used by Studio:

```text
authoring-palette({ parentPath:"MyProject::frontends.svelte.routes...", query:"chart" })
```

Use the actual business capability as `query` and a `parentPath` returned by
`authoring-tree`. Execute the matching item's `apply` mutation unchanged. The
palette searches the current project, references and workspace and adds a
required project reference atomically. Otherwise keep a typed, visibly
incomplete mock until the missing reusable capability is implemented; do not
silently replace a requested chart with a table, summary numbers or fake data.

`authoring-tree` omits the frontend and Flow block catalogs by default so the
initial project structure stays fast. Use `authoring-palette` for contextual
block discovery. Set `includeFrontendCatalog:true` or `includeFlowCatalog:true`
only for an explicit catalog inspection.

Add an explicit Convertigo project reference from the consumer with
`flow-project-reference`, or pass `references` while bootstrapping a new
project.

Referenced components join the consumer palette as read-only library blocks.
Use them in pages and components exactly like local palette blocks. Edit the
definition in its provider project; do not copy or patch the referenced source
inside consumers. Each component instance owns its page/component-local state
unless its public contract explicitly shares state.

A provider may declare exact npm versions in
`_meta.implementation.dependencies`. The generator merges those dependencies
and rejects incompatible versions. `dev.sync` installs a changed application
dependency contract and restarts Vite only in that exceptional case. Authors
must never run npm manually or edit the generated `package.json`.

## Diagnostics

`code-check` must reject unknown blocks/properties, duplicate
ids, invalid slots, unresolved sources, unknown Page ids and missing required
Page parameters with a direct correction or one focused lookup. Do not work
around these errors with filesystem edits or raw Svelte APIs.

For a property lookup, use:

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

Set `property` to the exact bindable property returned by the block contract;
for example `text`, `label`, `src`, or `source`.

Use `authoring-palette` only at the intended qualified `parentPath` and execute
its `apply` payload unchanged. Create a typed frontend mock only when no
canonical block expresses the requirement; a POC is unfinished while the mock
remains.

## POC Acceptance

A POC proves the requested path, including its Page transitions and explicitly
requested content. It may defer exhaustive history, offline restoration,
responsive coverage and polish. It may not stack downstream business steps in
one scrolling Page.

Execute the build-provided safe Playwright plan. Prefer roles, visible text,
images and documented `data-*` attributes; low-code ids are not guaranteed DOM
ids. On failure, allow one focused browser diagnostic instead of starting an
exploratory test campaign.
