---
name: convertigo-flow-mcp
description: Use Convertigo Flow to inspect, create, edit, test, and run Flow backends and Svelte frontends through the convertigo-flow MCP server.
---

# Convertigo Flow

Use this skill for FlowEngine, FlowScript, Flow blocks, schemas, portable blocks,
and the experimental Svelte frontbuilder. Author through the `convertigo-flow`
MCP server. Keep the workflow source-first. Draft once, then use only
diagnostic candidates, or one focused lookup when none is returned; never probe
guessed synonyms.

## POC First

Unless the user explicitly requests production hardening, optimize for the
first useful preview. A POC is a runnable business path, not an exhaustive
acceptance campaign.

- Target 15 minutes and stop after the first useful preview.
- Write one backend draft and one complete frontend application pass. One pass
  may contain several Page sources; it never means stacking distinct business
  steps in one route.
- Allow at most two focused repair passes after those drafts.
- For a newly bootstrapped UI project, call
  `frontend-svelte-action({ project, actionId:"dev.start", wait:false })`
  immediately after bootstrap so dependency setup overlaps authoring. For an
  existing project, start it after the first frontend read; do not poll.
- Call `flow-app-progress({ project, mode:"poc" })` once, synchronize and open
  the dev viewer, prove the requested behavior, then build production once.
- Keep one Page or mutually exclusive surface active at each business step.
  Functional Page transitions are part of the POC; only exhaustive history,
  offline, responsive and visual checks are deferred.

Use `flow-app-progress({ project, mode:"hardening" })` only when the user asks
for fiabilisation, production readiness or exhaustive validation. Never use
`flow-resource-get/patch` to edit Flow Svelte models or their source-backed
`app.flow.css`; use `frontend-svelte-code-get/set/check/patch`.

## Boundaries

- Never edit `c8oProject.yaml`, `_c8oProject/**/*.yaml`, generated Svelte, or
  Convertigo DBO YAML. The Convertigo model owns those files.
- Never use the legacy Convertigo MCP as a Flow authoring fallback.
- Never substitute another project when the requested target is unavailable.
- Use MCP project names, not filesystem paths. `projectDir` is only for
  standalone tests explicitly using a filesystem fixture.
- Preserve user-supplied service URLs byte-for-byte. Do not replace a failing
  external source with remembered endpoints or baked fixtures.
- Do not hide application behavior in Rhino, generated code, CSS, or informal
  binding objects. Keep orchestration visible in FlowScript and Flow Svelte.
  CSS is for visual rules only and remains explicit through the application
  CSS source plus block `class` properties.

## Read Only What Is Needed

This skill is the default workflow. Do not list all resources or reread it in
chunks after it has been loaded. Read each specialized MCP guide at most once
per task, and only when its feature is required:

- `flow://guide/samples`: fresh FlowScript syntax warm-up.
- `flow://guide/frontend-svelte`: Svelte frontend authoring.
- `flow://guide/frontend-svelte-routing`: optional SvelteKit route segments,
  parameters, layouts and route groups. Read it only for dynamic or advanced
  routing, or when the compact mapping in the frontend guide is insufficient.
- `flow://guide/fullstack-paperboard`: backend plus frontend architecture. When
  this is read, do not reread `frontend-svelte`; use diagnostics for details.
- `flow://guide/fullsync`: FullSync provisioning or client use.
- `flow://guide/portable-blocks`: one block shared by backend and frontend.
- `flow://guide/rhino-block-api`: only before creating a Rhino/JVM primitive.

In a fresh context, read `samples` and inspect at most two relevant samples
before the first draft. Do not browse the full catalog first. Existing
diagnostics should replace speculative guide and catalog reads.

## Bootstrap And Configuration

If a project is missing or has no FlowEngine, call:

```text
flow-project-bootstrap({ project })
flow-project-bootstrap({ project, ui:true })  # backend plus Svelte
```

Call bootstrap once. If it succeeds, continue directly; do not probe or call it
again. After `ui:true`, immediately start `dev.start` with `wait:false`, then
continue backend and frontend authoring while dependencies initialize. For
project configuration, read `libs/flow/engine.yaml` with
`flow-resource-get`, then update it with `flow-resource-patch` and `baseHash`.
Put structural service constants, URLs, namespaces, tokens and timeouts under
`config.*`, not inside low-level blocks.

## Backend Workflow

Use the compact FlowScript loop:

1. `code-set({ project, qname, code })` writes and checks one complete draft.
2. Fix only returned diagnostics with `code-patch` and its `revision`. Apply
   writes to one Flow or frontend source sequentially; do not patch one
   revision concurrently.
3. `code-run({ project, qname })` runs the draft without resending code.
4. If the result is correct and `workingCopy`/`unsaved` is true, immediately
   call `code-promote({ project, qname, revision })`.
5. Stop editing when the proven result is promoted.

Every block call uses one object argument:

```javascript
function LoadData({ input, config, result }) {
  var response = http.get({ url: config.services.feedUrl })
  var rows = list.map({ items: response.body.items, select: {
    title: current.title,
    link: current.link
  } })
  result.rows = rows
  result.count = rows.length
  return result
}
```

Flow metadata is a top-level `const _flow` before the function. Output schemas
use JSON Schema objects, never shorthand strings, arrays of example values or
`FunctionName._flow` assignments:

```javascript
const _flow = {
  outputs: {
    rows: { type: "array", items: { type: "object", properties: {
      title: { type: "string" }
    } } },
    count: { type: "number" }
  }
}
```

Use `input.*` for request values, `config.*` for configuration, `local.*` for
scratch values, `current` inside list transforms, and `result.*` for public
output. Declare `_flow.inputs`, `_flow.outputs`, and `_flow.tests` when their
contracts are stable and useful.

Use standard blocks for HTTP, requestables, lists, objects, JSON, sessions,
files and resources. Useful object primitives include `object.keys`,
`object.get`, `object.values`, and `object.firstEntry`. Do not create a custom
block just to access ordinary object/list data.

To temporarily skip an existing Flow node without deleting it, call
`authoring-mutate` with the node `sourceMutationPath` and
`{ op:"setEnabled", path:sourceMutationPath, enabled:false }`. Use
`enabled:true` to restore it. Disabled nodes do not execute and do not
contribute to schemas or picker data.

For backend fixtures, `asset.read` takes a project-relative
`libs/flow/resources/...` path and returns raw text. `flow-resource-get` is an
MCP inspection tool and returns an envelope; pass its `content` field to a text
consumer such as `xml.parse`, never the whole envelope. Frontend rendered asset
URLs use `resources/...`.

When a block is unknown, use the ranked diagnostic candidate or one focused
catalog search. Do not probe synonyms with repeated `flow-block-get` calls. Use
an existing block only when its contract matches. Otherwise create a typed
project-local mock with `flow-block-mock`, then implement it. A task is not
complete while `flow-block-mock-list` reports a mock.

## Project Blocks

Create readable reusable FlowScript blocks with:

```text
code-set({ project, block:"namespace.name", code, properties, outputs })
```

Project blocks save directly and do not use `code-promote`. Give properties and
outputs stable types. Keep a parent Flow business-oriented; move only reusable
per-item behavior or a missing primitive into a project block.

Use Rhino only for a small Java/JVM or parsing primitive that standard blocks
cannot express. Read `flow://guide/rhino-block-api` first. A Rhino block must
not perform end-to-end orchestration, duplicate HTTP/requestable/list blocks,
or use Node/browser APIs. Start its implementation with the Rhino compatibility
comment required by the guide.

## Schema Workflow

- Use `flow-output-schema({ project, qname, detail:"full" })` to inspect a
  public Flow contract before wiring consumers.
- Use `flow-node-output-schema` for one producer when its runtime shape is the
  question.
- Treat declared/static/effective schemas as authoritative when clean.
- Learn runtime schemas only through safe reads. Do not request full traces or
  full payloads unless a compact result cannot diagnose the issue.
- Fix property type diagnostics in the Flow or block contract; do not leave
  known business values typed as `unknown`.

## Svelte Frontend Workflow

Read `flow://guide/frontend-svelte` once for a frontend-only task, or
`flow://guide/fullstack-paperboard` once for a full-stack task. Build the
application as explicit Pages through Flow Svelte source, not hundreds of tree
mutations. A complete pass may write several Page sources:

1. Derive the logical Pages and transitions from the requested workflow before
   writing markup. Each distinct business step is a Page unless it is a small,
   mutually exclusive state of the current Page.
2. `frontend-svelte-code-get({ project })` returns the configured source,
   revision, the application Page index and a compact `authoringContract`.
   Navigate by logical Page id with `Params`/`Query`; target Pages read typed
   values through `@route.params.name`. Use `sourceFile` to read another Page.
3. Write every Page needed by the complete application pass. Do not guess CSS,
   Ionic or NGX property names that are absent from the contract. Contract
   `slots` are exact source wrapper tags such as `Children`, `Events`, `Then`
   and `Else`; never omit a listed wrapper around nested blocks.
4. `frontend-svelte-code-check({ project, sourceFile, code })` validates each
   Page. `frontend-svelte-code-set({ project, sourceFile, code, revision })`
   persists it and can create a new canonical route source when no revision
   exists.
5. Use `frontend-svelte-code-patch` for later focused changes.
6. If dev mode was not already started after bootstrap, call
   `frontend-svelte-action({ project, actionId:"dev.start", wait:false })`
   after the first frontend read. Continue the focused repair passes while npm
   and Vite initialize. Do not poll. Run `dev.sync` once after the final repair,
   then `dev.open`.
7. Call `flow-app-progress({ project, qname, mode:"poc" })` once. Prove the
   requested visible and interactive behavior in the dev viewer, then call
   `frontend-svelte-action` with `build`; production build already generates
   the sources.

Flow Pages map to SvelteKit routes, but authors do not edit generated SvelteKit
files or call `$app/navigation` directly. Static links use `LinkButton`.
Transitions use `<Navigate page="pageId"><Params>...</Params></Navigate>`;
required parameters come from `authoringContract.pages`, not URL guesses.
Back controls use `GoBack` with a fallback. Read
`flow://guide/frontend-svelte-routing` only for optional/rest parameters,
matchers, nested layouts or route groups.

If `frontend-svelte-code-check` reports an unknown property, block, scope or
picker candidate, make one focused `frontend-svelte-tree` or
`frontend-svelte-palette` lookup. Execute returned mutations unchanged. Do not
reconstruct an application with unit `frontend-svelte-mutate` calls. Never
request `detail:"full"` from the tree: use `detail:"inspect"` with an exact
`focusPath`, `maxDepth:0`, the property name and `sourceId` when known. Full
tree responses are bounded by the MCP because they duplicate definitions and
schemas without helping authoring.

Pages and components must remain explicit in the tree: layout blocks, visible
widgets, events and actions. Events live below their owner, for example:

```text
Button -> Events -> OnClick -> Actions -> CallSequence
```

Use semantic layout properties for structure. Use explicit `class` values and
the application CSS source for gradients, typography and visual rules that do
not belong in a reusable component contract. Do not invent CSS-like properties
that are absent from the authoring contract and do not encode behavior in CSS.

For a temporary frontend skip, call `frontend-svelte-mutate` with
`{ op:"setEnabled", path:sourceMutationPath, enabled:false }`; set
`enabled:true` to restore the node. Disabled subtrees stay visible to authoring
but are omitted from generated Svelte.

Use palette property names exactly. On `FRONTEND_PROPERTY_UNKNOWN`, choose from
`acceptedProperties`. On `FRONTEND_BLOCK_UNKNOWN`, use a ranked equivalent or
an explicit typed mock. Do not guess synonyms.

## Bindings And SmartType Intent

Flow Svelte preserves three NGX-like intents:

- `text="literal"`: literal text.
- `value={expression}`: browser expression.
- `source="@producer.path"`: schema-backed source.

Use intuitive references in source:

- `@loadNews.news` for a requestable action result.
- `@item.title` and `@index` inside `ForEach`.
- `@event.value` inside events.
- FullSync action ids for FullSync results.

The compiler lowers these to `FlowValueBinding`. Authors and LLMs must never
write the internal object. Bare dotted paths without `@` are invalid migration
input. If `code-check` returns a correction, apply it directly. If a source or
schema path is genuinely ambiguous, perform one focused picker inspection for
that property and source id. Intuitive `@source.path` is authoring syntax; use
picker-returned structured bindings when validation requires them, and a
structured literal for intentionally static iterator content.

Properties declare which SmartType intents they support. Do not put an `@`
reference in a literal-only property. Validation should reject that shape; if
it does not, use a clear literal and report the tooling gap.

For a POC, execute the bounded browser smoke and at most one focused interaction
for the requested workflow. Verify every explicit user-visible requirement
before reporting it. For a timer or live value, read it twice at least one
second apart. For a color, gradient, spacing or layout requirement, inspect
the rendered computed style. For explicit hardening, execute all returned
`acceptance.calls` unchanged and in order. Use safe Playwright only; never
substitute an unsafe runner.

Flow `id` values are stable authoring identities, not guaranteed DOM `id`
attributes; repeated blocks could not safely emit duplicate DOM ids. In browser
assertions prefer roles, visible text, images, semantic rendered classes and
documented `data-*` attributes. Do not wait on `#flowObjectId` or
`[id="flowObjectId"]` unless the rendered DOM has explicitly proved it exists.

Give every action a unique `id`. Use `target` only when separate actions should
update one shared reactive result. Use `Status.actionId` for lifecycle state.
Marker distinguishes repeated executions or templated results; it does not
replace action identity.

## FullSync

Read `flow://guide/fullsync` once. Provision server objects only with:

```text
flow-fullsync-scaffold({ project, connector, designDocuments, transactions, dryRun:true })
flow-fullsync-scaffold({ project, connector, designDocuments, transactions, dryRun:false })
```

Inspect the dry-run plan and treat warnings as blocking. Do not edit YAML, call
CouchDB directly, or fall back to legacy MCP. Use standard CouchDB option names
in the scaffold. After provisioning, learn safe read schemas with
`flow-requestable-schema` so frontend bindings expose domain fields.

On the client use only `FullSyncGet`, `FullSyncView`, `FullSyncReset`, and
`FullSyncSync` palette blocks. Do not handwrite `fs://` strings or PouchDB code.
Use `frontend-svelte-fullsync-schema` when `flow-app-progress` returns that exact
repair. For a dynamic Get, fill only its requested `sampleDocId`. Give actions
unique ids and use schema-backed FullSync sources. Reset local data only for an
explicit migration with a stable marker.

## Portable Blocks

For pure logic shared by backend and frontend, read
`flow://guide/portable-blocks`. Author one canonical block id with shared
properties, outputs and tests plus target implementations. Use
`code-get/check/set/patch({ project, block, target:"frontend" })` for the browser
implementation. In Flow Svelte, insert the canonical block directly. Never
expose or author the legacy `RunAxiom` adapter.

Portable values are JSON. Browser events expose normalized JSON, not DOM
objects. Sequential frontend effects are awaited by generated code; explicit
parallelism must remain visible.

## Discovery And Response Budgets

Do not call broad `flow-list`, `flow-search`, `flow-catalog`, resource search,
or cache tools before the first draft unless a legacy requestable schema is
required. Let diagnostics request one focused lookup.

Search/catalog tools and `flow-app-progress` apply response budgets
automatically. Do not tune timeout or size parameters routinely. If a response
is `partial:true`, use its opaque `nextCursor` only when the first page is not
enough. A partial response cannot prove absence or completion.

## Hardening Validation

Only when hardening was explicitly requested:

- backend result matches the live source and required schema;
- working copies are promoted;
- `flow-block-mock-list` is empty;
- `flow-app-progress({ mode:"hardening" })` is `complete:true` and 100 percent;
- production build passes;
- safe Playwright proves the real user workflow at desktop and mobile widths;
- required offline behavior is proven, or explicitly remains unverified when
  safe offline control is unavailable;
- visible images have `naturalWidth > 0` and no horizontal overflow exists.

Keep browser validation compact: navigate, perform the workflow, then run one
bounded assertion that returns counts and failures. Do not retrieve a complete
network response body when DOM counts and the backend `code-run` already prove
the contract. Ignore only clearly non-functional asset noise such as a missing
favicon; report every application, HTTP or console failure.
