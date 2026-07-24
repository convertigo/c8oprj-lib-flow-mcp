# Flow Svelte Frontend Authoring

Use this guide when the task targets the experimental Svelte frontbuilder under
FlowEngine. The mental model is the same as FlowScript backend authoring: edit
one intuitive, human-readable source in a few complete passes, then let the MCP
parser validate and project it. Tree, palette and unit mutations remain the
discovery and repair path, not the default way to assemble a whole application.
Do not edit generated Svelte output directly.

If the task includes both backend Flow and frontend Svelte work, use
`flow://guide/fullstack-paperboard` instead of this guide.
For logic shared with backend FlowScript, also read
`flow://guide/portable-blocks`.

## Default Loop

1. Read the complete authoring model with `frontend-svelte-code-get({ project })`.
   It returns the configured `.flow.svelte` source, a `revision` and a compact
   `authoringContract`. Use the contract's standard tags, exact properties,
   SmartType intents and slots directly. Slot names are exact source wrapper
   tags (`Children`, `Events`, `Then`, `Else`, and so on); do not omit them or
   translate remembered Ionic,
   NGX, CSS or HTML property names. Pass the target Convertigo project name,
   not a filesystem path. For a new route or component, obtain its canonical
   source path from one focused palette call.
2. Compose the screen or workflow directly in Flow Svelte source using that
   contract. Validate the complete draft
   with `frontend-svelte-code-check({ project, code })`; this catches parser
   errors, duplicate low-code ids and noncanonical bindings without writing.
   This complete check is the first frontend operation after `code-get` for a
   whole-screen pass. Do not browse tree/palette or issue unit mutations first
   for blocks already described by the source contract.
3. Persist a complete pass with `frontend-svelte-code-set({ project, code,
   revision })`. Use `frontend-svelte-code-patch({ project, revision,
   codepatch })` for subsequent compact unified diffs. A stale revision is
   rejected; re-read instead of overwriting concurrent work.
4. Use `frontend-svelte-tree({ project, detail:"inspect", focusPath, maxDepth:8 })`
   and `frontend-svelte-palette({ project, focusPath })` only when a canonical
   block, slot, property or schema-backed binding is unknown. Execute returned
   picker mutations unchanged through `frontend-svelte-mutate`; do not invent
   binding paths or descriptors.
   For `FRONTEND_BINDING_INVALID`, apply `suggestedBinding` unchanged when the
   diagnostic supplies it. Otherwise inspect only the named property and
   source id. Informal action/context objects and dotted binding strings are
   migration input, never authoring output.

## Intuitive Data References

Flow Svelte has the same three value intents as the NGX SmartType, expressed
with ordinary Svelte syntax:

- `label="News"` is a literal value (NGX TXT);
- `label={count + " items"}` is a browser expression (NGX JS);
- `source="@loadNews.news"` is a schema-backed source (NGX picker).

The quoted/expression distinction is significant. Do not quote an expression,
and do not omit `@` from a source path. Flow Svelte source uses one compact
reference syntax for dynamic JSON data:

```svelte
<ForEach id="feedItems" source="@loadNews.news" context="item" index="index">
  <Children>
    <Image id="image" source="@item.imageUrl" />
    <Text id="title" source="@item.title" />
    <Text id="position" source="@index" />
  </Children>
</ForEach>
```

`@action.path` resolves an action, requestable or FullSync result. Inside a
`ForEach`, `@item.path` and `@index` resolve the declared lexical aliases;
`@feedItems.item.path` and `@feedItems.index` are stable explicit forms.
Inside events, use `@event.value`, `@event.checked`, `@event.key` or
`@event.name`. `@index` is zero-based. Array indexes are supported, for example
`@load.rows[0].name`.

The compiler lowers these references to the canonical schema-backed
`FlowValueBinding`. That object is an internal tree/properties and picker
contract, not source syntax for humans or LLMs. Use a focused picker only when
the producer or schema path is unknown. Conditions remain ordinary readable
expressions, such as `<If test={index % 2 === 0}>`.

FlowScript and Flow Svelte share typed JSON values, paths, schemas and lexical
iteration scopes, but they do not pretend that Rhino and the browser are the
same runtime. FlowScript reads `input/local/current/result` directly. Flow
Svelte uses `@action`, `@item`, `@index` and `@event` for reactive sources and
uses `{...}` only for browser expressions. Prefer a dual-target portable block
when a computation must run identically on both sides.

Visible components may use browser expressions where their property contract
allows them. Client action parameters do not execute free expressions:
`count={index + 1}` is rejected. Bind `count="@index"` directly when zero-based
semantics fit, or compute the value with a portable block and bind its result.

## CallSequence Identity And Marker

```svelte
<CallSequence id="getCardDetail" requestable=".GetDetail" marker="cardDetail">
  <Variables><Variable name="id" value="@item.id" /></Variables>
</CallSequence>
```

`id` identifies this action execution, `target` optionally identifies the
reactive result channel, and `marker` is the optional stable NGX-compatible
source marker appended to the SDK requestable. The marker is not a business
parameter and is never a browser expression. Put per-card values in Variables.
Bindings continue to use the action id or target, for example
`@getCardDetail.product`. When a marked CallSequence executes inside a
`ForEach`, the runtime retains its result under that lexical item identity;
bindings in the same item read that scoped result before the last global
result. This preserves the NGX templated-card behavior without exposing a
runtime key in source.

`frontend-svelte-code-check` rejects a dynamic marker with
`FRONTEND_CALLSEQUENCE_MARKER_STATIC_REQUIRED` and an applicable literal fix.
It rejects a free browser expression in a client action Variable with
`FRONTEND_ACTION_EXPRESSION_NOT_PORTABLE`; use its suggested `@` reference, or
insert a dual-target portable block when real computation is required.
## Compact Browser Acceptance

After a successful production build, execute the returned `acceptance.calls`
unchanged and in order. This bounded safe Playwright plan navigates once,
checks desktop and mobile DOM health, reads console errors and closes the page.
Never substitute an unsafe runner. Add one focused interaction only when a
required business workflow is not covered by the returned probes. If offline
or persistent-profile controls are unavailable, report that capability as
unverified instead of probing unrelated browser tools.

On failure, use at most one focused browser diagnostic for the failed field.
Screenshots are for a requested visual review, not routine proof. This keeps
the browser phase deterministic and prevents a successful UI from triggering
an exploratory second authoring pass.

Low-code `id` values identify objects in Flow authoring and the Studio tree.
They are not guaranteed to become DOM `id` attributes, especially below an
iterator where that would create invalid duplicates. Browser acceptance should
use roles, visible text, images, semantic rendered classes and documented
`data-*` attributes instead of assuming `#lowCodeId` exists.

This loop deliberately allows intuitive low-code source editing. The MCP owns
parsing, canonical projection, id checks and revision safety. It does not allow
arbitrary generated Svelte code or hand-built binding objects.

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
- Pure Flow blocks that declare a browser implementation are inserted directly
  with their palette tag, for example `<TextTrim text={...}
  target="trimmed" />`. Their canonical `_meta` defines the same properties and
  outputs for backend and frontend; the generator imports only the browser
  functions used by the application. `RunAxiom` is a legacy migration format,
  not an authoring block.
- When source validation reports `FRONTEND_BLOCK_UNKNOWN`, inspect its ranked
  palette candidates. If none expresses the intended operation, execute the
  returned `flow-block-mock` request with typed properties and outputs. A
  project-local frontend mock is immediately visible in palette, tree and
  properties, but remains explicitly unfinished until its browser
  implementation and `mock:true` marker are replaced.
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
- For client-local FullSync, read `flow://guide/fullsync`. Use the palette
  `FullSyncGet`, `FullSyncView`, `FullSyncReset` and `FullSyncSync` blocks; never write `fs://`
  SDK strings or PouchDB calls by hand. Their outputs are structured
  `category: fullsync` binding sources and their Variable children use
  `FlowValueBinding` values.
- Data sources produced by a `CallSequence` use `@action.path` in intuitive
  source. When the path is unknown, select it from
  `propertyDefinitions.<name>.bindingSources[].bindings` or
  `flow-app-progress.frontend.bindingSuggestions[].bindings`, then either use
  the equivalent `@` reference or pass its `binding`/`mutation` unchanged.
  Do not write hand-built descriptor JSON. Bare paths are accepted only as migration input and are reported in
  `frontend.bindingWarnings`; execute the returned `fix` directly, or inspect
  the reported block to select a missing candidate. Under a data-bound
  `ForEach`, every bindable descendant must set `source`: choose an iteration
  candidate for dynamic content or a structured literal binding for
  intentionally static content.
- Use `LinkButton` when a static route link should look like a button. When a
  route transition must happen after `SetValue`, `FullSyncGet`,
  `FullSyncView`, `FullSyncSync` or `CallSequence`, put a palette-provided
  `Navigate` action after it in the same event. A back control is a visible
  `Button` containing `Events -> OnClick -> Actions -> GoBack`; `GoBack` itself
  is not a visual block. Set its fallback route for direct page entry. Action
  targets are application-scoped and can feed another route. Prefer a separate
  route for history-backed detail; `location`, URL queries and browser globals
  are not reactive Flow state.
- Use a palette-provided `OnMount` event under page structure for automatic
  lifecycle actions. Initialize shared list/number/value state before long
  requestable or FullSync actions. Keep initialization, synchronization and the
  first local query as separate actions so their progress and errors remain
  observable. Set `once={true}` only when that bootstrap must survive route
  round trips; it runs again after a full browser reload.
- Give `Status.actionId` the exact stable id of the action it represents. Set
  action-specific loading/success labels; FullSync replication progress is
  rendered from the same action state.
- Use `UpdateList` (`set`, `append`, `truncate`, `clear`) for navigation trails
  and other small client lists. Use `UpdateNumber` (`set`, `increment`,
  `decrement`) for bounded numeric state. Both expose their `target` as an
  ordinary structured `category: action` binding source.
- Button labels can use an intuitive `source="@action.label"`. Text can apply `number`,
  `decimal` or `currency` formatting and an optional numeric `multiplier`;
  use `@` references for both values instead of writing lookup expressions.
- Local action variables belong under the action that owns them and their
  values must be picker-provided structured bindings or literal bindings. Shared actions
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

Never use Playwright execution to access `fs`, `process`, `child_process` or to
edit project/generated files. Browser tooling validates the rendered app only;
all authoring must remain in Flow source tools. A missing source operation is a
tooling gap, not permission to escape the model.

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

To group existing sibling blocks under one container without a sequence of
delete/insert calls, use one transactional `wrap` mutation. It preserves each
block's id and bindings:

```json
{
  "mutation": {
    "op": "wrap",
    "paths": [
      "frontAst.slots.structure.children[1]",
      "frontAst.slots.structure.children[2]"
    ],
    "slot": "children",
    "value": { "id": "catalogSurface", "kind": "card", "tag": "Card" }
  }
}
```

Prefer one `mutations` batch per source file and `wrap` for structural grouping;
do not decompose an already known transformation into repeated MCP calls.

When unsure, call `frontend-svelte-palette` on the target branch first. Empty
palettes include diagnostics and fallback hints; follow them instead of
inventing an insertion path.

## Actions

Use `frontend-svelte-action` for build/dev operations:

- `actionId:"generate"`: update generated Svelte source under the private app.
- `actionId:"build"`: generate and build production assets.
- `actionId:"openBuilt"`: open the production frontend.

The `openBuilt` URL is runtime-declared and can contain an internal host or
port. Browser tests must retain its project path but use the public runtime
origin provided by the local, CI or deployed environment. Do not start several
Playwright calls after one navigation has already stalled.

Each `ForEach` publishes schema-backed `item` and integer `index` picker
sources. Use `item` for domain fields and `index` for position-aware behavior.
Visual alternation belongs in the frontend model, for example an `If` condition
using `index % 2 === 0`; it must not require a backend block that mutates every
domain item with a presentation-only flag.
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
