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
  has identity `editor`, DOM id `customer-field` and a disabled widget. The
  `disabled` of a control follows a boolean source like any binding:
  `<Button $$id="apply" label="Apply" disabled={!page.hasSelection} />` or
  `disabled="@page.locked"`, no `If`/`Else` pair of buttons.
- One `$$id` namespace per document: a component cannot reuse the `$$id` of a
  `State`. Rename changes `$$id` only.
- A Page root may carry `label`; a component keeps its label in its header.
- Put `class` and layout properties on the first visible child of
  `Structure`, usually `PageShell`. Lifecycle blocks never go in `Structure`.
- Wrapper tags such as `Children`, `Events`, `Actions`, `Params`, `Query`,
  `Then` and `Else` are exact. Supported Svelte control blocks, event attributes and explicit
  bindings are described below. Other directives, spreads and unknown children
  are rejected, never dropped silently.
- Canonical formatting is one attribute per line: `$$` attributes first, then
  business attributes sorted alphabetically. The first write of a compact or
  unsorted file reorders all of it; expect that diff and continue from the
  returned revision (use `code-rg` extracts afterwards). A property edited
  back to its default (a literal equal to the default included) is removed
  from the source; absent means default.

## Svelte syntax that Flow accepts

The installed `svelte/compiler` parses every source before Flow checks its
contracts. Syntax errors include Svelte's message, code, line and column.
A mechanical correction is offered as `error.details.proposedPatch.edits`;
apply it to the submitted text and retry. No syntax repair is saved silently.

Inside `Structure` and visible content slots, ordinary HTML (`p`, `div`,
headings, `span`, lists, links, images, sections, `strong`, `em`, `br` and
form controls) creates native elements. Text and `{expression}` stay inline.
HTML attributes, `class`, `style`, `aria-*` and `data-*` keep their values;
unknown properties and known invalid binding paths are still refused.
Use a Flow widget for its extra behavior, such as a DataTable's typed row events.

Use `{#if condition}…{:else}…{/if}` and
`{#each items as item, index (item.id)}…{:else}…{/each}`. An each item is a
single name; destructuring, await/snippet directives and spreads are outside
this authoring subset. Existing `If` and `ForEach` blocks remain valid.

`onclick={() => page.count = page.count + 1}` and its `on:click` spelling
create the same typed event/action chain. These small handlers assign declared
State values; use `Events > OnClick > Actions` for Flow calls and longer
workflows. Event modifiers and arbitrary functions are refused. A handler's
`event` is Flow's normalized event: `event.value`, `event.checked`, `event.key`.
For input, `bind:value={page.name}` is explicit two-way binding on native
controls and bindable Flow widgets. `value={page.name}` only displays it.
`bind:checked` binds a checkbox's boolean State. Derived values are read-only.

```svelte
<script module>export const _flow = {sourceVersion: 2};</script>
<FlowComponent $$id="naturalSvelte">
  <Variables>
    <State $$id="name" value="Ada" />
    <State $$id="count" value={0} />
    <State $$id="items" value={[{id: 1, name: "Guide"}]} />
  </Variables>
  <Structure>
    <section class="summary">
      <h1>Hello {page.name}</h1>
      <Input $$id="nameInput" label="Name" bind:value={page.name} />
      <button onclick={() => page.count = page.count + 1}>Add</button>
      {#if page.count > 0}<p>Count: {page.count}</p>{/if}
      <ul>{#each page.items as item (item.id)}<li>{item.name}</li>{/each}</ul>
    </section>
  </Structure>
</FlowComponent>
```

Pure action values use the same brace syntax: `test={event.value === "save"}`,
`value={page.count + 1}`, `value={JSON.stringify([String(event.value.id)])}`.
Sources, literals, arithmetic, comparisons, boolean/nullish operators,
conditionals, arrays and `String`, `Number`, `Boolean`, `JSON.stringify`,
`Array.isArray` are lowered to typed compositions. Every source remains
schema checked. Browser globals, side effects, arbitrary function calls and
dynamic property access need a declared portable block. Keep quoted
`"@path === 'value'"` out of tests: it is ambiguous text, so Flow proposes a
patch rather than changing its meaning silently.

## Layout containers in a small page

| Widget | Purpose and useful properties |
| --- | --- |
| `PageShell` | Page frame with `maxWidth` and `padding`; owns the page's visible children. |
| `PageHeader` | One title and optional description at the top of the page. |
| `ColumnLayout` | Vertical sequence; `gap` separates children, `align` aligns them horizontally. |
| `RowLayout` | Horizontal sequence; `justify` distributes width, `align` aligns vertically, `wrap` allows another line. Use `space-between`, not `between`. |
| `GridLayout` | Repeated cards; `minColumnWidth` lets the grid choose how many columns fit. |
| `Card` | A grouped surface; put its content in `Children`. |
| `AppShell` / `PageContent` | Shared layout and page outlet; see the tested session Layout below. |

`Children` is a slot wrapper, not another visible container. Properties belong
to the container itself. Keep gaps in CSS lengths (`"16px"`), and get enum
values from `authoringContract`; inventing a `variant` or a CSS property name
on a widget does not create that behavior.

```svelte
<script module>export const _flow = {sourceVersion: 2};</script>
<FlowComponent $$id="layoutBasics">
  <Structure>
    <PageShell $$id="frame" maxWidth="960px" padding="24px"><Children>
      <ColumnLayout $$id="column" gap="16px"><Children>
        <PageHeader $$id="heading" title="Library" description="Available resources" />
        <RowLayout $$id="toolbar" justify="space-between" align="center"><Children>
          <Text $$id="total" text="2 resources" />
          <Button $$id="refresh" label="Refresh" variant="secondary" />
        </Children></RowLayout>
        <GridLayout $$id="cards" minColumnWidth="220px"><Children>
          <Card $$id="first"><Children><Text $$id="firstTitle" text="Guide" /></Children></Card>
          <Card $$id="second"><Children><Text $$id="secondTitle" text="Examples" /></Children></Card>
        </Children></GridLayout>
      </Children></ColumnLayout>
    </Children></PageShell>
  </Structure>
</FlowComponent>
```

## Avoid the remaining writing round trips

- Create navigation target Pages first. For mutually linked pages, write their
  content without navigation, then add the links after all Page ids exist.
  A missing Page is not replaced with a guessed destination.
- Declare State before reading `page.name`; read `code-get` for actual action
  results and schema paths. A `null` initial field leaves its future shape
  unknown; an explicit schema still constrains it. Do not delete a path merely
  to make a validation error disappear.
- Portable block results use `$$out="page.name"`. `SetValue`, `UpdateList`
  and `UpdateNumber` use `target`. The diagnostic offers the exact rename
  when the destination is unambiguous.
- Keep `$$id` unique in the document, including its root and Variables. Use
  `pageLoans` for the root and `loans` for its State. Only engine attributes
  have two dollars; use a catalog widget's real properties and enum variants.
- `code-patch` takes `edits: [{oldText, newText}]`. Each `oldText` must match
  exactly once in the last source read. If you have the entire replacement,
  use `code-set`; keep the current revision and inspect `code-get` after a
  stale revision. A refused source has not become the new working copy.

## Svelte documentation and licensing

The syntax explanations and small examples above adapt the official Svelte
[markup](https://svelte.dev/docs/svelte/basic-markup),
[if](https://svelte.dev/docs/svelte/if), [each](https://svelte.dev/docs/svelte/each)
and [bind](https://svelte.dev/docs/svelte/bind) documentation (Svelte Contributors,
MIT). The frontend skill adapts the official
[svelte-code-writer](https://github.com/sveltejs/ai-tools/blob/b33e0f721d57bd9a158f86082012dc45f090e6d7/tools/skills/svelte-code-writer/SKILL.md)
workflow: consult the relevant syntax documentation, validate with the installed
compiler, and exercise the result before delivery. Flow's supported subset and
contracts above still apply. The copyright and full permission notices are
shipped in `_flow/resources/licenses/svelte-MIT.txt` and
`_flow/resources/licenses/ai-tools-MIT.txt`.

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
   Build production only for deployment or an explicit production check;
   an application handed to users (acceptance criteria, links in e-mails) is
   a deployment: `frontend-svelte-action({ project, actionId:"build" })`, then
   check that `<server>/convertigo/projects/<project>/DisplayObjects/mobile/`
   serves it. Links meant for users use that URL, never the dev viewer.
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

The standard blocks present well without application CSS: a light theme in
the Convertigo blue, IBM Plex Sans or the system font, rounded bordered
surfaces with light shadows, and a dark mode. Keep that default and adjust it
with tokens in `theme.flow.css`: a primary color, a radius or a font moves
every block. `flow://lib/lib_flow_frontbuilder_svelte/frontend-design` lists
the tokens, the application blocks and the visual checklist. `app.flow.css`
is for what no block expresses (an illustration, a hero, a one-off layout),
never for rebuilding buttons, navigation, tables or badges with classes.

Use semantic layout properties for structure, the source-backed
`theme.flow.css` for tokens and the free-form `app.flow.css` plus explicit
`class` names for the remaining visual rules. A visual value computed from state (an angle,
a width, a position) goes to the common `style` property as a CSS custom
property that `app.flow.css` consumes, never to one class per value. Bind it
on the element it moves, with one named variable, so that its node shows what
drives it, and keep the CSS rule generic:
`<Text $$id="secondHand" class="hand" style={"--angle:" + page.second * 6 + "deg"} />`
with `.hand { transform: rotate(var(--angle)); }`. Do not set variables on a
parent for its children to read: the tree no longer tells which state moves
which element.
Palette and display mode are independent:

- Define each named palette in `theme.flow.css` under `@layer flow.theme`
  with `:root[data-flow-palette="name"]`, and its dark values with the same
  selector plus `[data-flow-theme="dark"]`.
- `ThemePaletteControl` is the standard style selector (it reads
  `@theme.options`); omit it when only one palette exists.
- `DisplayModeControl` is the standard Light/Dark/System control and owns its
  persistence: the page is light until the user chooses, System follows the
  device. Use `ThemeSwitch` and `BrowserPreference` only for a custom
  presentation.
- Consume semantic values in `app.flow.css` with `var(--flow-color-background)`,
  `var(--flow-color-surface)`, `var(--flow-color-text)`,
  `var(--flow-color-primary)` and related tokens; hard-coded colors are for
  artwork and local effects only.

```css
@layer flow.theme {
  :root {
    --c8o-radius-lg: 10px;
    --c8o-font-family: "Inter", ui-sans-serif, system-ui, sans-serif;
  }
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

## Application Structure

Give a business application its structure with the application blocks rather
than `Text`, `Card` and classes:

| Need | Block |
| --- | --- |
| Frame, in the root Layout | `AppShell`: `Navigation` (one `LinkButton page=` per Page, the current one highlighted), `Tools` (logout `Button variant="ghost" size="sm"`, `DisplayModeControl`), `Children` > `PageContent` |
| Top of a Page | `PageHeader` `title`, `description`, `eyebrow`, its commands in `Tools` |
| Key figures | `GridLayout minColumnWidth="200px"` > `StatCard` `label`, `value`, `tone`, `hint`, `page` |
| Records | `DataTable`: `caption`, `columns` (`format` date, number, badge with `labels` and `tones`; `template` "{first} {last}"; `emphasis`), `rowActions`, `pageSize`, `locale`, an `emptyText` |
| A status | `StatusBadge` `value` and `options` `[{ value, label, tone }]` |
| Nothing to show | `EmptyState` in the `Else` of a `ForEach` |
| Form | `Form` > `FormSection` `title`, `columns` > fields; a `RowLayout justify="flex-end"` of buttons |
| Commands | `Button` `variant`: one `primary` per area, `secondary`, `ghost`, `danger` |
| Result of a command | `Status actionId successText="Saved."` |

A Page inside an `AppShell` needs no `PageShell`: the shell owns the width
and the gutter. A `DataTable` row action with `page` and `query` (parameter to
row path) is a link; without `page` it raises `OnClick` with
`@event.value.action` and `@event.value.row`; `when` / `unless` name a row
path that shows or hides it. The table texts follow its `locale` (en, fr).

```svelte
<AppShell $$id="shell" title="Bookings" userName={layout.session.user?.firstName ?? ""}>
  <Navigation>
    <LinkButton $$id="navMine" label="My bookings" page="mine" />
    <If $$id="whenManager" test={layout.session.user?.role === "MANAGER"}><Then>
      <LinkButton $$id="navAll" label="All bookings" page="all" />
    </Then></If>
  </Navigation>
  <Tools><Button $$id="logout" label="Log out" variant="ghost" size="sm" /></Tools>
  <Children><PageContent $$id="content" /></Children>
</AppShell>
```

Load `layout.session` with the root Layout's `OnAfterNavigate` example below.
The optional user fields keep the anonymous first display safe.

```svelte
<PageHeader $$id="header" title="My bookings" description="Rooms you booked and their status." />
<GridLayout $$id="kpis" minColumnWidth="200px"><Children>
  <StatCard $$id="upcoming" label="Upcoming" value="@.MyBookings.upcoming" tone="primary" />
  <StatCard $$id="pending" label="To confirm" value="@.MyBookings.pending" tone="warning" />
</Children></GridLayout>
<DataTable $$id="bookings" caption="Bookings" source="@.MyBookings.items" pageSize={10}
  emptyText="No booking yet." columns={[{ path: "room", label: "Room", emphasis: true },
  { path: "day", label: "Day", format: "date" }, { path: "status", label: "Status", format: "badge",
  labels: { OK: "Confirmed", WAIT: "To confirm" }, tones: { OK: "success", WAIT: "warning" } }]}
  rowActions={[{ id: "open", label: "Open", page: "booking", query: { id: "id" } }]} />
```

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
- `@Project.Sequence.path`: the result of a sequence of another project, named
  as its `CallSequence` names it (`requestable="lib_OAuth.GetOAuthCredentials"`
  is read by `@lib_OAuth.GetOAuthCredentials.GoogleClientID`); `@.Sequence`
  always means the page project, and a result no `CallSequence` produces warns
  with `FRONTEND_SEQUENCE_RESULT_UNKNOWN`;
- `@<actionId>.path`: a FullSync or portable action result;
- `@page.name`, `@layout.name`, `@comp.name`: a variable (`State`, `Derived`,
  `Translations`) named by its owner, as in NGX: `page.` in a page,
  `layout.` in a layout, `comp.` in a component. A page reads the variables of
  its Layouts as `@layout.name` (the nearest Layout declaring `name`);
- `@<context>.path` and `@index` inside a `ForEach` (`@row.name` under
  `context="row"`), or the explicit `@<forEachId>.item.path` and
  `@<forEachId>.index`;
- `@event.value`, `.checked`, `.key`, `.name`, `.file`, `.files`, `.source`:
  the normalized event; `@event.target.*` and `@event.detail.*` do not exist
  (`FRONTEND_EVENT_PATH_NOT_NORMALIZED`);
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

In a source attribute, `@` belongs to a quoted binding (`value="@event.value"`),
not JavaScript braces (`value={@event.value}` is invalid Svelte). Keep quotes
balanced: `label='Livres "disponibles"'` uses different outer and inner
quotes. A comparison in a quoted attribute is not a source reference; use a
an expression such as `test={page.count > 0}` for an action test. Backslash-escaping a double quote does not escape an HTML attribute.
Read a portable computation's contract before composing client actions;
`JSON.stringify([@event.value.row.id])` is invalid JavaScript; use
`value={JSON.stringify([event.value.row.id])}`.

Create target Pages before writing a `Navigate` to their **Page id**. Use the
`authoringContract.pages` and bindings from `code-get` for actual names and
paths; do not guess state/action ids, properties or schema fields. An `If`
action's `Then`/`Else` contains actions directly, without another `Actions`.
Each `$$id` must be unique in its source.

When the provider supplies a typed correction, `code-set` now also returns
`error.details.proposedPatch` with exact `line`, `before`/`after` and
`oldText`/`newText`. Review and apply it to the refused text, then retry
`code-set`. It may fix one diagnostic while others remain; the refused text
has not replaced the previous source. See `flow://guide/search-and-edit` for
the revision rule.

Client action parameters accept the pure expressions described above; use a source, a
literal or a portable block for computation.

`Combobox` is the standard searchable choice. Its default contract is closed:
typing filters `options`, but only a proposed value is accepted. Set
`allowCustomValue={true}` when the field must also accept a new business
label; `@event.value` is then the selected value or the typed text, so one
backend Flow must resolve an existing id or create the value and reject an
empty label. Do not emulate this with `Input`, `ForEach` and buttons.

An `Input` or `Textarea` `value` only displays its binding. Use
`bind:value={page.name}` to write State on input, or an explicit event. Keep the text with an event and `@event.value`: `OnInput` runs
on each keystroke, `OnChange` when the edit is committed (leaving the field).
A free text on several lines (a comment, a description) is a `Textarea`
(`rows`, `maxlength`, `placeholder`, `required`), never a one-line `Input`;
its `@event.value` keeps the line breaks. `SearchField`, `ChatComposer`,
`Combobox` (its typed query) and `OtpInput` give `OnInput` the same
`@event.value`. To submit several fields together, place them with a
`Button type="submit"` in a `Form` and run the save from `Form` > `Events` >
`OnSubmit`, reading the page states.

An `AlertDialog` runs the confirmed command from `OnConfirm` (`@event.value`
is `"confirm"`) and a refusal from `OnCancel` (`"cancel"`, `"escape"` or
`"backdrop"`); `OnClose` runs each time it closes (`@event.value.reason`).
Bind its `open` to a page State that a Button sets to `true`: an
`AlertDialog`, `Modal`, `Drawer`, `ActionSheet` or `Popover` sets that State
back to `false` when it closes, so the next `SetValue` opens it again. A
widget runs a handler only for an event it emits (listed in its palette
entry) or a browser event of its element; any other one (an `OnConfirm` on a
`Button`) is refused with `FRONTEND_WIDGET_EVENT_UNKNOWN`.

A `DataTable` keeps its row actions on the right of a wide table and, with
`layout="auto"` (the default), shows one card per row once it is narrower
than 640px; `layout="table"` keeps the table. `selectable={true}` adds row
checkboxes and a Select all checkbox; bind `selected="@page.picked"`: the
State holds the keys (`rowKey`) of the selected rows, for a bulk action
Button, and `OnSelectionChange` gives the same keys as `@event.value`
(`@event.source` row, all or none). Select all takes the filtered rows, or
the loaded page with `serverSide={true}`. A column `format` may be a date
pattern: `dd/MM/yyyy`, `EEEE d MMMM yyyy`, `dd/MM/yyyy HH:mm`.

### Server pagination with DataTable

With `serverSide={true}`, `source` is one server page, `total` is the total
number of matching rows, `offset` is its zero-based first row index, and
`pageSize` is the requested page size. The table never slices, filters or sorts
the supplied page locally. Its **OnChange** requests a new page with
`@event.value = { offset, pageSize, query, sortKey, sortDirection }`;
`sortDirection` is `asc`, `desc` or `none`. `@event.source` is `page`,
`filter`, `clear-filter` or `sort`. A filter or sort change requests offset 0.
Capture these values before calling the Flow; there is no separate OnPage
event. `OnSelectionChange` is a different event, for the selected row keys.

This complete Page expects `.ListBookings` to return `{ items, total }` and
accept `offset`, `limit`, `query`, `sortKey` and `sortDirection`. The Flow checks
the session and allowed sort keys, and applies the filter, sort and bounded
pagination on the server. The page size must fit its declared limit.

```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "bookings" } };</script>
<FlowComponent $$id="serverBookings">
  <Variables>
    <State $$id="listing" type="object" value={{ items: [], total: 0 }} />
    <State $$id="offset" type="number" value={0} />
    <State $$id="pageSize" type="number" value={10} />
    <State $$id="query" type="string" value="" />
    <State $$id="sortKey" type="string" value="" />
    <State $$id="sortDirection" type="string" value="none" />
  </Variables>
  <Events><OnMount $$id="initialLoad"><Actions>
    <CallSequence $$id="loadInitial" requestable=".ListBookings" $$out="page.listing"><Variables>
      <Variable name="offset" value="@page.offset" /><Variable name="limit" value="@page.pageSize" />
      <Variable name="query" value="@page.query" /><Variable name="sortKey" value="@page.sortKey" />
      <Variable name="sortDirection" value="@page.sortDirection" />
    </Variables></CallSequence>
  </Actions></OnMount></Events>
  <Structure>
    <DataTable $$id="bookings" caption="Bookings" serverSide={true}
      source="@page.listing.items" total="@page.listing.total"
      offset="@page.offset" pageSize="@page.pageSize"
      columns={[{ key: "room", path: "room", label: "Room" }]}>
      <Events><OnChange $$id="pageRequest"><Actions>
        <SetValue $$id="keepOffset" target="page.offset" value="@event.value.offset" />
        <SetValue $$id="keepPageSize" target="page.pageSize" value="@event.value.pageSize" />
        <SetValue $$id="keepQuery" target="page.query" value="@event.value.query" />
        <SetValue $$id="keepSortKey" target="page.sortKey" value="@event.value.sortKey" />
        <SetValue $$id="keepSortDirection" target="page.sortDirection" value="@event.value.sortDirection" />
        <CallSequence $$id="loadPage" requestable=".ListBookings" $$out="page.listing"><Variables>
          <Variable name="offset" value="@page.offset" /><Variable name="limit" value="@page.pageSize" />
          <Variable name="query" value="@page.query" /><Variable name="sortKey" value="@page.sortKey" />
          <Variable name="sortDirection" value="@page.sortDirection" />
        </Variables></CallSequence>
      </Actions></OnChange></Events>
    </DataTable>
  </Structure>
</FlowComponent>
```

A French application sets `locale="fr-FR"` (or binds it to the language
State) on `DataTable`, `DatePicker`, `Select` and `DisplayModeControl`: their
texts left at their default follow it (the empty choice of `Select`, the
labels of `DisplayModeControl`, the announcements of `DatePicker`); a text
written in the block is kept.

A choice control keeps its choice the same way with `OnChange`; its `OnInput`
receives the same value (except a `Combobox`, whose `OnInput` gives the typed
query). `@event.value` is the chosen option value with its type (`Select`,
`RadioGroup`; `""` for the placeholder), an ISO date `YYYY-MM-DD`
(`DatePicker`), `HH:mm` (`TimePicker`), a number or `{ lower, upper }`
(`Range`), the item value as a string (`Segment`) or one value per column
(`WheelPicker`).

```svelte
<Input $$id="noteInput" label="Note" value="@page.note"><Events>
  <OnInput $$id="typed"><Actions>
    <SetValue $$id="keepNote" target="page.note" value="@event.value" />
  </Actions></OnInput>
</Events></Input>
```

## Structure And Actions

```text
FlowComponent -> Variables -> State / Derived / DerivedBy / Translations
FlowComponent -> Events -> OnMount / OnAfterNavigate / OnDestroy / Effect / PreEffect / Interval / Timeout
FlowComponent -> Structure -> PageShell
Button -> Events -> OnClick -> Actions -> CallSequence -> Variables
Input / Textarea -> Events -> OnInput / OnChange -> Actions -> SetValue / portable block
AlertDialog -> Events -> OnConfirm / OnCancel -> Actions -> CallSequence
ForEach -> Children -> Card
If -> Then / Else
Layout -> PageContent
```

The actions of an event run in order; each one waits for the previous and the
chain stops at the first error. A Flow that fails answers its error alone,
`{ error: { code, message } }`: its call ends in error, its `Status` shows the
message and the chain stops, while `@.Flow.error.message` stays readable; a
result with an `error` field among others is a business answer.

An `If` in `Actions` is one step of the chain: its `test` (a source or a
Compose, JavaScript truthiness) picks the actions of its `Then` or of its
`Else`, which run in order with the same event and variables; the first
failure ends the chain, an empty branch lets it go on. Its branches hold
actions and `If` only. A `DataGrid` `OnChange` also fires when new rows drop
the selected one (`@event.source` is `selection`): guard what needs a row.

A chain started by a user event survives the teardown of the view that
launched it: a button may hide its own panel, or a Flow component may be
unmounted, and the remaining actions still run; lifecycle work (`OnMount`,
intervals) is cancelled instead. Reentrancy policies still apply. The first
error fills `Status` and is logged in the console.

```svelte
<OnChange $$id="pickTable"><Actions>
  <If $$id="hasRow" test="@event.value.selectedRows.length"><Then>
    <CallSequence $$id="describe" requestable=".Describe" />
  </Then><Else>
    <SetValue $$id="clearDetail" target="page.detail" value={{}} />
  </Else></If>
</Actions></OnChange>
```

When an event fires again while its actions
still run, its Expert `reentrancy` decides: `drop` ignores it, `latest` cancels
the running actions, `serial` queues it (at most 16), `parallel` runs both;
Expert `debounceMs` first waits for a pause. The defaults fit the common case:
`OnClick`, `OnSubmit` and `Interval` drop, `OnChange` and `OnAfterNavigate`
keep the latest. A
control stays disabled while the actions of a `drop` event run (`OnClick`,
`OnSubmit` by default), so a double click never starts them twice; a field
whose `OnChange` or `OnInput` runs actions stays editable and keeps its focus. Set
`<OnClick reentrancy="parallel">` only for harmless repeats such as a counter,
never for an order or a payment. Lifecycle actions (`OnMount`, `Interval`,
`Timeout`) still running when their page or component is destroyed are
cancelled and publish nothing; a chain started by a user event goes on.

Use palette blocks for layout (`AppShell`, `PageHeader`, `PageShell`,
`RowLayout`, `ColumnLayout`, `GridLayout`, `Card`), display, forms and
navigation. A Layout must contain
`PageContent`. Do not hide behavior in CSS, generated code or browser
globals. To skip a block temporarily, patch `$$disabled={true}` onto it;
remove the attribute to restore it.

Page lifecycle goes in the root `Events` slot, with the Svelte meaning of each
event. `OnMount` runs when the page or component mounts: its first display,
each entry on its route and a live reload; a navigation that keeps the page
shown (other route parameters, another query) does not run it again.
`OnAfterNavigate` runs after each navigation, the first display included, as
SvelteKit `afterNavigate`: load there what depends on the address, with
`@event.to.params.id`, `@event.to.query.tab`, `@event.to.path` or
`@event.to.route`, `@event.from` (null on the first display) and `@event.type`
(`enter`, `link`, `goto`, `popstate`, `form`). A newer navigation cancels the
run of an older one still going.

```svelte
<OnAfterNavigate $$id="load"><Actions>
  <FullSyncGet $$id="readProduct" database="retail" docid="@event.to.params.id" />
</Actions></OnAfterNavigate>
```

A Layout can remain mounted across sign-in, sign-out and navigation between
pages. `OnMount` alone therefore leaves its session stale. In the root
`src/routes/+layout.flow.svelte`, refresh the session on each navigation:

```svelte
<script module>export const _flow = { sourceVersion: 2 };</script>
<FlowComponent $$id="sessionLayout">
  <Variables><State $$id="session" type="object" value={{ authenticated: false, user: null }} /></Variables>
  <Events><OnAfterNavigate $$id="refreshSession"><Actions>
    <CallSequence $$id="loadSession" requestable=".CurrentUser" $$out="layout.session" />
  </Actions></OnAfterNavigate></Events>
  <Structure>
    <AppShell $$id="shell" title="Bookings" userName={layout.session.user?.firstName ?? ""}>
      <Children><PageContent $$id="content" /></Children>
    </AppShell>
  </Structure>
</FlowComponent>
```

`.CurrentUser` returns `{ authenticated: false, user: null }` for an anonymous
session, or `{ authenticated: true, user: { firstName, role } }` from the
server session. It must allow the anonymous home page to refresh normally.
Keep login redirects outside this `OnAfterNavigate`: navigate after sign-in
or sign-out in that command's chain, or guard a protected page separately.
Redirecting to login on every navigation would undo a successful sign-in.
A group Layout at `(app)/+layout.flow.svelte` only wraps pages inside `(app)`;
put the anonymous login page outside that group when it needs no shell.

`Interval` and `Timeout` register on mount and clean up on teardown; nest them
under `OnMount` only inside a larger explicit mount chain. `OnMount once={true}`
survives route round trips but not a full reload.

Declare mutable state with `State` and computed state with `Derived` or
`DerivedBy` in `Variables`. Write a value into a state with `SetValue`
(`<SetValue $$id="setLanguage" target="page.language" value="fr" />`); only
the state actions (`SetValue`, `UpdateList`, `UpdateNumber`) take `target`.
`UpdateList` `remove` deletes every occurrence of `value`; `toggle` removes it
when present, otherwise appends it (a multiple selection). Comparison is
strict, `17` differs from `"17"`: keep stable primitive identifiers.
An action that produces a result (a Flow call, `DateFormat`, any Flow block)
writes it straight into a state with its Output, `$$out="page.hour"`, with no
extra `SetValue`; without `$$out`, the following actions read it as `@<$$id>`.
Read state with `@page.name` (`layout.` / `comp.` in a layout or a component).
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
`flow://guide/fullsync`. `Status` displays the action named by its `actionId`:
a spinner line while it runs, its error in place, and a success toast with
its `successText` (nothing without one, so a load shows no stray message;
`successDisplay="inline"` keeps the message in the page). The toast stays on
screen when the chain then navigates (`CallSequence`, then `Navigate` back to
the list): no query parameter is needed to confirm on the next page.

### Clocks And Timers

`Interval` and `Timeout` are schedulers: their callback count is not elapsed
time. For clocks and stopwatches, read wall-clock timestamps and compute from
them with `DateNow`, `DateFormat`, `NumberAdd`, `NumberSubtract`,
`NumberChoose` and `DurationFormat`; `authoringContract.portableBlocks` lists
their properties and a `wallClock` recipe. Look up one exact block (for
example `date.now`) in the palette only when its properties are absent. A
portable action writes its result with its Output `$$out="page.name"` (an
existing state), or the following actions read it as `@<$$id>`; only
`SetValue`, `UpdateList` and `UpdateNumber` take `target`. Never implement a stopwatch by counting `Interval`
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

A component tells its host what happened through events declared in the same
header, `events: { picked: { label, description, schema } }` (camelCase
names). Inside it, `<EmitEvent $$id="emitPicked" event="picked"
value="@local.choice" />` raises one from an action chain; its host handles it
on the use with `On` plus the capitalized name and reads the value, typed by
the declared `schema`, as `@event.value`:

```svelte
<Picker $$id="namePicker"><Events><OnPicked $$id="whenPicked"><Actions>
  <SetValue $$id="keep" target="page.chosen" value="@event.value.name" />
</Actions></OnPicked></Events></Picker>
```

`EmitEvent` exists only in a component (`FRONTEND_EMIT_OUTSIDE_COMPONENT`) and
only for a declared event (`FRONTEND_EMIT_EVENT_UNKNOWN`); a handler of an
undeclared event gives `FRONTEND_COMPONENT_EVENT_UNKNOWN`.

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
`references` to `flow-project-bootstrap`; its `url` (with `branch` and `path`)
sets or updates the Git URL another workspace imports the provider from, so a
published project brings its dependencies. Referenced components are read-only
library blocks: edit them in their provider project. Otherwise keep a typed,
visibly incomplete mock; never replace a requested chart with a table or fake
data. `authoring-tree` omits the catalogs by default; use the palette for
discovery.

## Known Limits

- On a server that predates bracketed paths, dynamic routes such as
  `product/[id]` fail with HTTP 400 in the dev viewer. There, use a static
  Page, pass the id with `Navigate` `Query`, and read `@route.query.id`
  (see `flow://guide/frontend-svelte-routing`).
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

Delegate a multi-step proof (sign-in, a path through several pages, a form
submitted then the list that shows the result) to a verifier sub-agent: its
clicks, snapshots and waits stay out of your context, and its vision model
also checks the rendering.

```text
subagent-run({ profile:"verifier",
  task:"Prove that a signed-in member submits two requests.",
  inputs:{ url:"<openUrl of dev.sync or dev.open>",
    paths:["Sign in as member.demo / demo", "Select two requests, submit them"],
    checks:["Both statuses become \"Submitted\""],
    hints:"demo accounts: member.demo / demo" } })
-> status:"running", runId -> subagent-run({ runId }) until the report
```

Use `browser-verify` with `checks` for one visual check of the current page,
and a Playwright evaluation only for one DOM or timing measure.

Before handing a frontend over, have the verifier or `browser-verify` apply the
visual checklist, passed as `checks` (light and dark, 1366px and 390px wide):

- an `AppShell` (or a `Header`) carries the navigation, its current page
  highlighted, and the user and logout;
- each Page starts with a `PageHeader`; one primary button per area;
- records are in a `DataTable`, not in stacked full-width cards of texts;
  dates and numbers formatted;
- every status is a badge with a semantic tone, never a colored `Text`;
- no stray status text such as "Completed."; a command reports its success
  with a toast; an empty list shows an `EmptyState` or its table `emptyText`;
- form fields grouped in `FormSection`s with labels;
- no horizontal overflow of the page at 390px; tables scroll in their surface. The verifier is
read-only: fix what it reports with the Flow tools, then run it again on the
failed paths only.

## Application locale and default component texts

Set the static application locale in the entry source metadata, for example
`export const _flow = {sourceVersion:2,app:{id:"App",title:"Application",locale:"fr-FR"}}` inside `<script module>`.
Generation sets the HTML language and supplies that locale to components whose locale was omitted. French applications
also receive French default control labels and placeholders. Authored labels, bindings, explicit component locales
and historical component defaults are preserved. Without app.locale, the translation catalog's default locale is
used, then English. A Translations variable can still select business translations dynamically; it does not change
this static application setting.
