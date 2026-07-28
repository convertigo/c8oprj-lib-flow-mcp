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

1. Call `frontend-svelte-code-get({ project })` once. It returns the current
   source, revision, every Page (`id`, `path`, typed parameters and sourceFile),
   and the compact canonical block contract.
2. Plan the Pages and transitions. Write each complete Page with
   `frontend-svelte-code-check`, then `frontend-svelte-code-set`. A new Page has
   no revision. Existing Pages use their returned revision.
3. Use `frontend-svelte-code-patch` only for focused later changes.
4. Use one targeted tree/palette lookup only when the contract lacks a block,
   property or schema path. Apply returned picker mutations unchanged.
5. Call `flow-app-progress({ project, mode:"poc" })` once, build once, then run
   the returned bounded smoke call and at most one required business path.

Do not assemble an application with hundreds of tree mutations. Do not guess
Ionic, NGX, CSS or HTML property names. Source wrapper tags such as `Children`,
`Events`, `Actions`, `Params`, `Query`, `Then` and `Else` are exact.

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

`frontend-svelte-code-get.authoringContract.pages` is authoritative. It exposes
each parameter as `@route.params.<name>`. `Navigate.to` remains an expert
compatibility escape hatch for an external or unmodelled route; prefer `page`.
Use a visible Button with `GoBack` and a fallback for direct entry.

Static links may use `LinkButton`. When navigation follows `SetValue`,
`FullSyncGet`, `FullSyncView`, `FullSyncSync` or `CallSequence`, place Navigate
after that action in the same `Actions` slot.

## Values And Bindings

Flow Svelte preserves the three NGX SmartType intents:

- `label="News"`: literal text (TXT);
- `label={count + " items"}`: browser expression (JS);
- `source="@loadNews.news"`: typed schema-backed source (picker).

The quoted/expression distinction matters. A source always starts with `@`.
Common sources are:

- `@action.path`: action, requestable or FullSync result;
- `@item.path`, `@index`: lexical aliases inside ForEach;
- `@loop.item.path`, `@loop.index`: explicit iterator forms;
- `@event.value`, `.checked`, `.key`, `.name`: normalized event;
- `@route.params.id`, `@route.query.tab`: current Page route.

```svelte
<ForEach id="news" source="@loadNews.news" context="item" index="index">
  <Children>
    <Image id="image" source="@item.imageUrl" />
    <Text id="title" source="@item.title" />
    <Text id="position" source="@index" />
  </Children>
</ForEach>
```

MCP compiles these references to internal `FlowValueBinding` objects. Humans
and agents should not author those objects. Client action parameters reject
free browser expressions; use a source, a literal, or a portable dual-target
block for computation. Apply `suggestedBinding` or an exact picker mutation
when validation returns one.

## Structure And Actions

Pages, layouts, visible blocks, directives, events and actions remain visible
in treeview and properties. Typical structures are:

```text
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

Use `OnMount` for lifecycle actions. Initialize local state before long network
actions. Keep provisioning, synchronization and the first local query separate
so progress and errors remain observable. `once={true}` survives route
round-trips but not a full browser reload.

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
Pure dual-target Flow blocks are inserted directly by their palette tag.
`RunAxiom` is legacy migration syntax, not authoring syntax.

## Diagnostics

`frontend-svelte-code-check` must reject unknown blocks/properties, duplicate
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
  property:"source",
  sourceId
})
```

Use `frontend-svelte-palette` only at the intended insertion point and execute
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
