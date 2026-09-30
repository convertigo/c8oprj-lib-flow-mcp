# Flow Svelte Routing

Optional Flow Svelte routing: dynamic, optional, rest and matched segments, nested layouts and route groups.

Read this optional guide only when a Flow Svelte application needs dynamic
segments, optional or rest parameters, matchers, nested layouts, route groups
or layout resets. The main `flow://guide/frontend-svelte` guide is sufficient
for ordinary static Pages.

## Mental Model

Flow authoring exposes Pages, Layouts and navigation actions. SvelteKit supplies
the generated filesystem router:

- a Flow `Page` source projects to `+page.svelte`;
- a Flow `Layout` source projects to `+layout.svelte`;
- route directories define URL segments;
- `LinkButton`, `Navigate` and `GoBack` project to SvelteKit-aware navigation.

The route tree and Page/Layout properties remain visible in Convertigo
treeview and properties. Never edit generated `_private/svelte` files or use
raw `$app/navigation`, browser globals or hand-written router code in Flow
source.

## Paths And Parameters

The Flow source path below `_flow/frontbuilder/svelte/model/<App>/src/routes/`
mirrors the SvelteKit route. Pages and Layouts outside `src/routes` are refused
(`FLOW_ROUTES_ROOT_REQUIRED`).

| Route intent | Source under `<App>/src/routes/` | URL example |
| --- | --- | --- |
| static | `products/+page.flow.svelte` | `/products` |
| required | `product/[id]/+page.flow.svelte` | `/product/42` |
| optional | `[[lang]]/home/+page.flow.svelte` | `/home`, `/fr/home` |
| rest | `files/[...path]/+page.flow.svelte` | `/files/a/b.txt` |
| matcher | `item/[id=integer]/+page.flow.svelte` | `/item/42` |

A directory that is only a route node (segment, group `(x)` or parameter
`[x]` without its own Page) carries a `.flow-route.json` marker; the Studio
route palette creates it, do not hand-write it.

The production build is static and served by Convertigo: each route with
required or optional parameters is prerendered with `_` in their place and the
server answers `/product/42/` with that page, so the application keeps its
relative paths. Rest parameters and matchers make the whole application a
single-page application on an absolute base instead: prefer required or
optional parameters. The dev viewer loads each Page source by its path,
brackets included: a server that predates this support answers HTTP 400 for a
bracketed Page. There, prefer a static Page such as `product/+page.flow.svelte`,
pass the id in the `Navigate` `Query`, and read `@route.query.id`.

Required parameters match one segment. Optional parameters use double brackets.
Rest parameters match zero or more segments and should be validated before use.
A matcher narrows a parameter to values accepted by the named matcher. Prefer
palette-provided matchers and typed parameter sources; do not create matcher
code outside Flow authoring.

The Page source path defines its route. Give the Page a stable logical
`_flow.page.id` next to `sourceVersion: 2` in its header; `code-get` returns that value in `authoringContract.pages` with its
id, path, parameters and source file. Every parameter is exposed on the target
Page as `@route.params.<name>`. If that source is absent, stop rather than
reading `$app/state` or the URL directly.

## Layouts

A root `+layout.flow.svelte` applies to every Page below it. A nested Layout
applies to Pages in its route directory and descendants. Layouts must expose
their `PageContent` insertion point so child Pages remain visible in treeview.

Use a route group such as `(app)` or `(marketing)` to assign different Layout
families without adding the group name to the URL. Layout resets and advanced
`+page@` or `+layout@` selection are expert cases: use a focused route-tree
palette operation and keep the resulting Page/Layout relationship explicit.
Do not simulate Layout inheritance with duplicated headers or hidden generated
wrappers.

## Navigation

Use `LinkButton` for a static Page link and set its `page` property to the
logical Page id. For an application-root fallback use `~/path`; do not use
`/path` unless origin-root navigation is explicitly intended. When navigation follows an action such
as `FullSyncGet`, `FullSyncView`, `SetValue` or `CallSequence`, place
`Navigate` after that action in the same event chain. Target the Page by id and
supply values through `Params` and `Query`:

```svelte
<Navigate $$id="openProduct" page="product">
  <Params><Variable name="id" value="@item.id" /></Params>
  <Query><Variable name="tab" value="details" /></Query>
</Navigate>
```

Write the target Page before the Page that navigates to it; a `Navigate` to a
Page that does not exist yet fails with `FRONTEND_NAVIGATE_PAGE_UNKNOWN`.

The generator resolves and encodes the URL. Do not interpolate paths.

Use a visible Button with `GoBack` for history navigation and set a fallback
Page for direct entry. Complete browser-history restoration, scroll restoration
and offline return paths may be deferred from a POC, but the requested Page
transition itself may not.

## POC Invariant

Every business step requested by the user must be represented by a Page or a
mutually exclusive local state. A downstream Page or surface is not visible
before its required selection. A successful POC proves the requested
transitions, not merely that all data eventually appears somewhere in one
scrolling document.
