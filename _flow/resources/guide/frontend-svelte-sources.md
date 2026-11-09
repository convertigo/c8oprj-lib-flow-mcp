# Flow Svelte Sources And Syntax

Where Flow Svelte sources live, the .flow.svelte document shape, the Svelte syntax Flow accepts, write round trips to avoid and diagnostics.

Sub-guide of `flow://guide/frontend-svelte`: read that entry guide first for the authoring loop.

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

The folder is the route of a Page: `src/routes/items/[id]/` is `/items/[id]`,
for links, navigation and prerendering. Omit `route` in the Page header; the
same route in another syntax (`/items/:id`) draws a warning, and another route
is refused (`FRONTEND_PAGE_ROUTE_FOLDER_MISMATCH`): move the source instead.

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
