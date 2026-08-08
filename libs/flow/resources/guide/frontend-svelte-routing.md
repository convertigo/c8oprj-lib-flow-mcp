# Flow Svelte Routing

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

The project-relative Flow source path mirrors the SvelteKit route:

| Route intent | Flow source directory | URL example |
| --- | --- | --- |
| static | `products/+page.flow.svelte` | `/products` |
| required | `product/[id]/+page.flow.svelte` | `/product/42` |
| optional | `[[lang]]/home/+page.flow.svelte` | `/home`, `/fr/home` |
| rest | `files/[...path]/+page.flow.svelte` | `/files/a/b.txt` |
| matcher | `item/[id=integer]/+page.flow.svelte` | `/item/42` |

Required parameters match one segment. Optional parameters use double brackets.
Rest parameters match zero or more segments and should be validated before use.
A matcher narrows a parameter to values accepted by the named matcher. Prefer
palette-provided matchers and typed parameter sources; do not create matcher
code outside Flow authoring.

The Page source path defines its route. Give the Page a stable logical
`_flow.page.id`; `code-get` returns that value in `authoringContract.pages` with its
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

Use `LinkButton` for a static Page link. When navigation follows an action such
as `FullSyncGet`, `FullSyncView`, `SetValue` or `CallSequence`, place
`Navigate` after that action in the same event chain. Target the Page by id and
supply values through `Params` and `Query`:

```svelte
<Navigate id="openProduct" page="product">
  <Params><Variable name="id" value="@item.id" /></Params>
  <Query><Variable name="tab" value="details" /></Query>
</Navigate>
```

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
