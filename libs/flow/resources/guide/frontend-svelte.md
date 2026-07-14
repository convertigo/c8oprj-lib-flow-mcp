# Flow Svelte Frontend Authoring

Use this guide when the task targets the experimental Svelte frontbuilder under
FlowEngine. The mental model is the same as FlowScript backend authoring: a
human-readable tree, a context palette, then small mutations through MCP. Do not
edit generated Svelte output directly.

If the task includes both backend Flow and frontend Svelte work, read
`flow://guide/fullstack-paperboard` first. This guide remains the reference for
tree, palette and mutation details, but the full-stack guide defines the
paperboard-first order, mock debt checks and progress reporting.

## Default Loop

1. Read the current UI model with `frontend-svelte-tree({ project,
   detail:"compact", maxDepth:2 })`.
   Pass the target Convertigo `project` name, not a filesystem path. The paths
   returned by the tree are the stable addresses for future edits.
2. Re-read only the relevant branch with `frontend-svelte-tree({ project,
   detail:"inspect", focusPath:"<path returned above>", maxDepth:8 })` before
   inspecting a page, component, slot or action subtree. For a binding
   property, choose from `bindings.<property>.sources[].bindings[]` and pass
   its `mutation` unchanged to `frontend-svelte-mutate`. `detail:"inspect"`
   keeps visible block props, slot names and focused binding metadata. Do not
   use `flow-resource-get` just to understand normal page structure.
3. Pick a focus node and call `frontend-svelte-palette`.
   Use the palette item returned by the tool as the source of truth:
   `items[].id`, `items[].insert`, `items[].targetSlot.sourceMutationPath` and
   `items[].targetSlot.index` tell you what can be inserted and where.
4. Apply changes with `frontend-svelte-mutate`.
   For source-backed Flow Svelte files, pass `sourceFile` from the focused node
   or palette target and a `mutation` using the palette-provided payload. For
   the main builder model, `frontAst...` mutations can also omit `sourceFile`:
   the MCP resolves it from `config.frontbuilder.svelte.modelPath`.
   Source-backed mutations persist the updated source by default. Use
   `dryRun:true` or `persist:false` only when you explicitly want a preview.
5. Re-read with `frontend-svelte-tree` to verify the tree changed.
6. Run `frontend-svelte-action` with `actionId:"generate"` to update generated
   Svelte sources. If dev mode is running, use `actionId:"dev.sync"` after a
   mutation so Vite/HMR sees the new source. Use `frontend-svelte-actions` to
   inspect enabled dev/build actions.

## Authoring Rules

- Flow Svelte source files follow the SvelteKit filesystem, with `.flow.svelte`
  authoring files in the project model and ordinary generated SvelteKit files in
  `_private/svelte`:

```text
libs/flow/frontbuilder/svelte/model/<App>/src/routes/+layout.flow.svelte
libs/flow/frontbuilder/svelte/model/<App>/src/routes/+page.flow.svelte
libs/flow/frontbuilder/svelte/model/<App>/src/routes/detail/+page.flow.svelte
libs/flow/frontbuilder/svelte/model/<App>/src/lib/components/<Block>.flow.svelte

_private/svelte/src/routes/+layout.svelte
_private/svelte/src/routes/+page.svelte
_private/svelte/src/routes/detail/+page.svelte
_private/svelte/src/lib/...
```

- Do not create or edit a synthetic `src/App.svelte`, `src/main.ts` or root
  `index.html` app shell. SvelteKit routes are the application shell.
- Read the route tree as SvelteKit route directories. A route directory can
  contain one `Layout`, one `Page`, later `Error`/`Server`, and child route
  directories. The tree should look like `Routes -> ROOT / -> Page -> Structure`
  and `Routes -> ROOT / -> Children -> detail -> Page`, not like duplicate page
  nodes or raw `+page.svelte` filenames. Technical files and generated paths are
  implicit read-only projection details.
- Treat frontend blocks like backend Flow blocks: they come from the palette,
  have a small editable property facade, and are arranged in the same tree as
  pages, components, events and actions.
- A route/page/component structure should mostly compile to component tags from
  the palette with clear properties, for example
  `<CountryPanel title={...} source={...}>`. Avoid hidden hard-coded behavior in
  the generator when a reusable block or action belongs in the tree.
- Generated route files should be readable SvelteKit files composed from real
  component imports, for example `<PageShell><Card><Text /></Card></PageShell>`.
  Do not create opaque route trampolines to synthetic `Home.svelte` files unless
  the low-code tree explicitly contains a reusable component.
- Layout is explicit low-code vocabulary, not a generator default. If a page
  needs spacing, columns, a responsive grid or a constrained shell, insert
  palette blocks such as `PageShell`, `RowLayout`, `ColumnLayout` or
  `GridLayout`. If content needs a rounded bordered surface, insert a `Card`
  block. Do not rely on hidden page wrappers, generated panels or CSS classes
  that are absent from the tree.
- Visual styling should normally be expressed through visible block properties
  and variants, for example `Card variant="dark"`, `Card variant="sky"` or
  `Button fullWidth="true"`. Do not rely on a page-local `<style>` block as the
  main authoring mechanism: if the palette lacks the styling vocabulary needed
  for a task, report the tooling gap or create an explicit project-local UI
  block instead of hiding behavior in CSS.
- Svelte snippets are the child contract. No snippet means the block is a leaf.
  A single snippet named `children` means children are edited directly under
  the block. Multiple snippets are shown as explicit slot nodes such as
  `lead`, `children` and `tail`; insert under the intended slot node.
- Directives are palette blocks too. Put them in the logical structure:
  `If -> Then -> Text`, `ForEach -> Each -> Row`, `Await -> Pending/Then/Catch`.
  Do not model directives as detached metadata folders.
- Use directive property names from the palette: `If` uses `test`, `ForEach`
  uses `source` and `context`. If the tree shows an older alias such as
  `condition`, prefer patching it to `test` before generation.
- Events and actions live under the owning block. A button click should look
  like `Button -> Events -> On Click -> Actions -> CallSequence`, not like a
  global action magically referenced by a string.
- Data sources produced by a `CallSequence` use structured
  `FlowValueBinding` descriptors. Select the schema path from
  `propertyDefinitions.<name>.bindingSources[].bindings` or
  `flow-app-progress.frontend.bindingSuggestions[].bindings`, then pass its
  `binding` or `mutation` unchanged. Do not translate the candidate into
  `items`, `item.title`, action-prefixed paths or hand-built JSON. String paths
  are accepted only as migration input and are reported in
  `frontend.bindingWarnings`; execute the returned `fix` directly, or inspect
  the reported block to select a missing candidate. Under a data-bound
  `ForEach`, every bindable descendant must set `source`: choose an iteration
  candidate for dynamic content or a structured literal binding for
  intentionally static content.
- SvelteKit navigation is a native link. Use the `LinkButton` palette block
  when a route link should look like a button; do not create a `Button` with an
  empty click event for navigation.
- Local action variables belong under the action that owns them. Shared actions
  are for reusable behavior only.
- Do not create frontend source files by filesystem guessing. Use the palette
  creation items, especially for pages, Flow UI blocks, Svelte UI blocks and
  client actions.
- Do not mutate library-provided blocks. If the tree or palette says a source
  is not writable, create or edit a project-local block instead.
- Do not browse every project or every catalog entry. Start from the given
  project, read the tree, then query the palette only at the intended focus.

## Mutations

The palette usually returns an `insert` payload ready for mutation. Preserve it
and add only the placement details:

```json
{
  "project": "MyProject",
  "sourceFile": "<sourcePath from tree or palette target>",
  "mutation": {
    "op": "insert",
    "path": "frontAst.slots.structure.children",
    "index": 0,
    "value": { "...": "palette item insert payload" }
  }
}
```

For property edits, mutate the node's `sourceMutationPath`:

```json
{
  "project": "MyProject",
  "sourceFile": "<sourcePath from tree node>",
  "mutation": {
    "op": "merge",
    "path": "frontAst.slots.structure.children[0].props",
    "value": { "text": "Hello" }
  }
}
```

The engine also accepts the node path without the final `.props` when a
`merge`/`replace` payload contains only properties. Prefer the explicit path
returned by the tree, but an omitted `.props` must not become a silent no-op.

Do not use `flow-resource-patch` to edit Flow Svelte page/component structure
or properties. If `frontend-svelte-mutate` cannot apply a tree/property edit,
report the exact focused node, `sourceMutationPath`, payload and error as a
tooling gap.

For new source-backed pages, Flow UI blocks, Svelte UI blocks or client
actions, pass the palette item's `insert` payload directly. It contains
`__frontendCreateSource`; do not write files by hand:

```json
{
  "project": "MyProject",
  "focusPath": "frontends.svelte.catalog.MyProject.project.uiBlocks",
  "mutation": {
    "op": "insert",
    "value": { "...": "palette item insert payload" }
  }
}
```

For moves, use the source node path and a target array path:

```json
{
  "project": "MyProject",
  "sourceFile": "<same source file when moving inside one file>",
  "mutation": {
    "op": "move",
    "from": "frontAst.slots.structure.children[2]",
    "path": "frontAst.slots.structure.children[0].slots.then.children",
    "index": 0
  }
}
```

When unsure, call `frontend-svelte-palette` on the target branch first. Empty
palettes include diagnostics and fallback hints; follow them instead of
inventing an insertion path.

## Actions

Use `frontend-svelte-action` for build/dev operations:

- `actionId:"generate"`: update generated Svelte source under the private app.
- `actionId:"build"`: generate and build production assets.
- `actionId:"openBuilt"`: open the production frontend.
- `actionId:"dev.start"`: generate, install if needed, and start Vite.
- `actionId:"dev.stop"`: stop the Vite dev server.
- `actionId:"dev.open"`: open the running dev server.
- `actionId:"dev.sync"`: regenerate sources while dev mode is running.

`frontend-svelte-actions` returns full menu action ids such as
`frontbuilder.svelte.generate` and `frontbuilder.svelte.dev.sync`. The action
tool accepts both those full ids and the shortcuts listed above. Prefer the
shortcut in examples, but reuse the full id when it comes directly from an
actions response.

Do not start or stop npm directly from Codex. The action tool uses the same
engine state and Studio browser integration as the right-click menu.
