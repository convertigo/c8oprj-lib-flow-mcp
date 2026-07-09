# Flow Svelte Frontend Authoring

Use this guide when the task targets the experimental Svelte frontbuilder under
FlowEngine. The mental model is the same as FlowScript backend authoring: a
human-readable tree, a context palette, then small mutations through MCP. Do not
edit generated Svelte output directly.

## Default Loop

1. Read the current UI model with `frontend-svelte-tree`.
   Pass the target Convertigo `project` name, not a filesystem path. The paths
   returned by the tree are the stable addresses for future edits.
2. Pick a focus node and call `frontend-svelte-palette`.
   Use the palette item returned by the tool as the source of truth:
   `items[].id`, `items[].insert`, `items[].targetSlot.sourceMutationPath` and
   `items[].targetSlot.index` tell you what can be inserted and where.
3. Apply changes with `frontend-svelte-mutate`.
   For source-backed Flow Svelte files, pass `sourceFile` from the focused node
   or palette target and a `mutation` using the palette-provided payload.
   Source-backed mutations persist the updated source by default. Use
   `dryRun:true` or `persist:false` only when you explicitly want a preview.
4. Re-read with `frontend-svelte-tree` to verify the tree changed.
5. Run `frontend-svelte-action` with `actionId:"generate"` to update generated
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
- Treat frontend blocks like backend Flow blocks: they come from the palette,
  have a small editable property facade, and are arranged in the same tree as
  pages, components, events and actions.
- A route/page/component structure should mostly compile to component tags from
  the palette with clear properties, for example
  `<CountryPanel title={...} source={...}>`. Avoid hidden hard-coded behavior in
  the generator when a reusable block or action belongs in the tree.
- Layout is explicit low-code vocabulary, not a generator default. If a page
  needs spacing, columns, a responsive grid or a constrained shell, insert
  palette blocks such as `PageShell`, `RowLayout`, `ColumnLayout` or
  `GridLayout`. If content needs a rounded bordered surface, insert a `Card`
  block. Do not rely on hidden page wrappers, generated panels or CSS classes
  that are absent from the tree.
- Svelte snippets are the child contract. No snippet means the block is a leaf.
  A single snippet named `children` means children are edited directly under
  the block. Multiple snippets are shown as explicit slot nodes such as
  `lead`, `children` and `tail`; insert under the intended slot node.
- Directives are palette blocks too. Put them in the logical structure:
  `If -> Then -> Text`, `ForEach -> Each -> Row`, `Await -> Pending/Then/Catch`.
  Do not model directives as detached metadata folders.
- Events and actions live under the owning block. A button click should look
  like `Button -> Events -> On Click -> Actions -> CallSequence`, not like a
  global action magically referenced by a string.
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

Do not start or stop npm directly from Codex. The action tool uses the same
engine state and Studio browser integration as the right-click menu.
