---
name: convertigo-flow-mcp
description: Use Convertigo Flow to inspect, create, edit, test, and run Convertigo Flow backends through the convertigo-flow MCP server. Prefer FlowScript code tools over raw Flow tree or YAML editing.
---

# Convertigo Flow

Use this skill when working with the experimental Convertigo Flow engine, FlowEngine, Flow blocks, property types, Flow schemas, FlowScript, or the Flow-native MCP server.

Do not use the legacy `convertigo` MCP server for Flow authoring unless the user explicitly asks to compare with legacy Convertigo MCP. If the user provides a target `project`, `qname`, or `block` and Flow MCP cannot access it, stop and report that exact blocker. Never substitute another project, never create in a "similar" project, and never use legacy MCP project discovery to work around a missing Flow MCP target.

Never edit Convertigo DBO YAML directly. `c8oProject.yaml` and
`_c8oProject/**/*.yaml` are owned by the Convertigo model save/import path, not
by Flow resource tools. If a project needs to become Flow-enabled, use
`flow-project-bootstrap({ project, ui? })`. It imports the official sequence
template when needed and adds `FlowEngine` through DBO APIs. Use `ui:true` when
the project also needs the experimental Svelte frontbuilder. If
`flow-project-bootstrap` cannot perform the setup, report the tool error; do
not patch project YAML by hand.

For FullSync provisioning, use only
`flow-fullsync-scaffold({ project, connector, designDocuments, transactions,
dryRun:true })`, inspect its plan, then repeat the same structured request with
`dryRun:false`. It creates or updates the connector, design documents, views
and supported standard transactions through Convertigo DBO APIs. Do not edit
their YAML, call CouchDB directly, or fall back to the legacy Convertigo MCP.
After scaffolding, use `flow-requestable-schema({ project, requestable,
learn:true })` on safe read transactions when runtime data is available so
bindings use the learned response schema. Keep database seeding and external
replication out of the scaffold request.
In scaffold transaction specs, use CouchDB option names such as `startkey`,
`endkey`, `include_docs`, `group` and `limit`; the scaffold canonicalizes server
read variables to Convertigo `_use_*` names. Svelte FullSync action variables
keep the plain CouchDB names expected by the client SDK.

For a scaffolded `postBulkDocuments` transaction, pass the complete document
array as `input._use_json_base` in `requestable.call`. The scaffold creates this
standard transaction parameter automatically. Do not invent a `docs` variable
or expand every document field into parallel transaction variables.

When a project owns a fixture-backed FullSync database, scaffold a
`resetDatabase` transaction and guard it with a stable seed-marker document read
through `getDocument`. Run reset, bulk writes and marker creation only when the
marker is absent. ResetDatabase creates the database and synchronizes the DBO
design documents; do not use a design-document view as the pre-seed guard.
Use `return result` inside the marker-present `if` branch: nested returns compile
to the core early-return block, while the final top-level `return result` stays
the normal implicit Flow result.

For a Svelte FullSync client, read `flow://guide/fullsync`, then insert the
operation-aware `FullSyncGet`, `FullSyncView`, `FullSyncReset` and
`FullSyncSync` palette blocks.
Do not handwrite `fs://` request strings or PouchDB code. Bind their results
through picker-provided `category:fullsync` descriptors. Associate
`schemaRequestable` with a safe learned server read transaction when domain
fields are needed, then apply the returned `schema` unchanged to the action's
`outputSchema` property. Prefer executing the exact `schemaPending`
`frontend-svelte-fullsync-schema` request returned by `flow-app-progress`; it
performs both steps without copied schema JSON. These metadata properties do
not execute the transaction from the client or from routine progress checks.
Use `FullSyncReset` only for an explicit local migration. Give it a stable
marker so each browser resets once; change that marker only when server data or
replication checkpoints become incompatible. Place it before `FullSyncSync`.
Give every client action a unique `id`, including actions that query the same
requestable with different variables. When several actions intentionally update
the same reactive result, set their common `target` and bind widgets to that
target. Never reuse one action `id` to create a shared result channel: action ids
identify execution and parameter sets, while `target` identifies result state.

## MCP Server

- MCP server: `convertigo-flow`
- Use the hyphenated name `convertigo-flow`, not `convertigo_flow`.
- Endpoint is configured in `~/.codex/config.toml`; if it changes, run `lib_flow_mcp._setupCodex`.

## Project Repositories

Use MCP project names for authoring, not filesystem paths. For Git work, the
canonical local repositories are:

- `lib_flow_engine`: `/Users/nicolas/git/lib_flow_engine`
- `lib_flow_mcp`: `/Users/nicolas/git/lib_flow_mcp`
- `lib_flow_process`: `/Users/nicolas/git/c8oprj-lib-flow-process`
- `lib_flow_k8s`: `/Users/nicolas/git/c8oprj-lib-flow-k8s`

The Studio runtime workspace can expose `lib_flow_process` and `lib_flow_k8s`
as symlinks to those `c8oprj-*` repositories. Do not edit old physical copies
under `runtime-ConvertigoStudio`; reload the MCP project if the runtime view
looks stale.

## Default Workflow

Prefer the compact code path:

1. For read-only schema audits or maintenance triage on known targets, skip the
   sample warm-up. Use `flow-output-schema({ project, qname, detail:"full" })`
   and `flow-node-output-schema` directly, with narrow `code-get` or
   `flow-search` only when a warning needs source context. Judge user-facing
   quality from `sources.effective` and top-level `warnings`, not from every
   stale or weaker `sources.learned` path. `declared:false` is acceptable when
   `effective` is inferred cleanly from `static` or `learned`.
2. Learn only the syntax from small real samples, then start coding. In a fresh
   context, especially with a smaller model, read the MCP resource
   `flow://guide/samples` with `resources/read`, then inspect the exact samples
   named there with `code-get`. Use them to learn FlowScript shape, not to find
   or copy a near-identical application Flow. Never pass `flow://...` resource
   URIs to `code-get`.
3. If the target project is missing from Flow MCP or does not expose
   `FlowEngine`, call `flow-project-bootstrap({ project })` first; call
   `flow-project-bootstrap({ project, ui:true })` for backend + Svelte frontend
   work. This is the only supported bootstrap path until Flow has a marketplace
   template. Do not create FlowEngine by editing `c8oProject.yaml`,
   `_c8oProject/flowEngine.yaml`, or other Convertigo YAML files.
   When the task also needs FullSync DBOs, call `flow-fullsync-scaffold` with
   `dryRun:true` immediately after bootstrap, review the returned plan, then
   apply the identical request with `dryRun:false`.
4. After the syntax warm-up, write the FlowScript algorithm directly, but stay
   inside the strict Flow DSL. Every block call is `block.name({ key: value })`
   with one object argument. Do not browse the full catalog first. Let
   `code-set`, `code-check` and `code-run` diagnostics guide you with block
   candidates, accepted properties and signatures.
   Put structural constants such as service base URLs, API paths, tokens,
   namespaces and timeouts under project or Flow `config.*`; do not hide them
   inside low-level blocks. For top-down design, call the high-level domain
   block you want even when it may not exist yet. If diagnostics report
   `UNKNOWN_BLOCK` and no candidate clearly matches the intent, keep the parent
   FlowScript readable and follow the diagnostic to create an explicit
   project-local mock with `flow-block-mock`, typed `properties` and typed
   `outputs`. Do not collapse the parent algorithm into low-level Rhino or
   copied HTTP calls merely to avoid a mock. Mocks must remain visible as
   unfinished work and must not be treated as completed behavior. Use
   `flow-block-mock-list` before finalizing a task; any remaining mock means the
   parent Flow is still incomplete.
   For `UNKNOWN_BLOCK`, diagnostics expose `candidateDecision.bestScore` and
   `candidateDecision.preferExistingScore`. Follow `create.tool`: below the
   threshold, create the typed mock; at or above the threshold, inspect the
   candidate with `flow-block-get` and use it only if it matches the intent.
   When the user provides external service URLs for a benchmark or integration
   task, those services are the source of truth. Do not satisfy the task by
   copying a domain dataset into a local block, project config or FlowScript
   fallback unless the user explicitly asks for an offline fixture. If an
   allowed service returns a redirect loop, deprecation payload, invalid JSON,
   rate-limit response or an incompatible schema, stop and report that blocker
   instead of masking it with baked data.
   For new project-level configuration, read `libs/flow/engine.yaml` with
   `flow-resource-get`, then update it with `flow-resource-patch` and
   `baseHash` before writing the Flow. If the MCP refuses that path, report the
   MCP feature gap instead of hard-coding service URLs or repeated domain data
   in FlowScript or reusable blocks.
   When a task needs many similar rows or external calls, do not unroll them.
   Repeated data belongs in project-level `config.*` or a small data block, and
   the Flow should iterate with `list.map`. A fresh agent should prefer a shape
   like `var countries = list.take({ items: local.countries, count:
   input.limit || 10 }); var items = list.map({ items: countries, select:
   currency.countryRate({ country: current, rates: local.rates }) })` over
   copied `http.get` calls. The per-item domain block should read shared config
   or accept simple business values such as `country`, `currency`, `amount`,
   `limit` or `rates`; do not expose transport details such as a prebuilt URL
   or query string as the block API.
   For object maps whose keys are data, use the standard object primitives:
   `object.keys({ source: local.map })`, `object.get({ source: local.map, key:
   current.code })`, `object.values({ source: local.map })`, and
   `object.firstEntry({ source: local.map })`. Do not
   create a Rhino domain block just to enumerate object keys or read
   `map[code]`.
   Treat `FLOWSCRIPT_PROPERTY_TYPE_MISMATCH` diagnostics as contract feedback:
   fix the Flow input declaration or the project-local block property type when
   the value should stay native, or explicitly convert the value before calling
   the block.
   Treat `FLOWSCRIPT_PROJECT_BLOCK_PROPERTY_UNKNOWN` and
   `FLOW_BLOCK_PROPERTY_UNKNOWN` the same way: patch the project-local block
   contract instead of leaving typed business values as `unknown`.
5. Do not call broad `flow-list`, `flow-search`, `code-rg`, `flow-catalog`,
   `flow-block-get`, `flow-resource-search`, `flow-resource-get`, or
   `flow-cache-info` before the first `code-set` unless the requested feature
   needs an unknown legacy requestable schema or the compiler diagnostics ask
   for one focused lookup. `flow-resource-*` is for project-local resource files,
   not for executable FlowScript.
6. Use `flow-requestable-list` and `flow-requestable-schema` when a legacy
   requestable shape is needed.
7. Write the editable working copy with `code-set({ project, qname, code })`.
8. Patch the working copy with `code-patch({ project, qname, revision, codepatch })` until diagnostics are clean.
9. Run/test with `code-run({ project, qname })` without sending code again.
10. Use `code-status({ project, qname })` only when dirty/revision state is unclear, or `code-discard({ project, qname })` to cancel the working copy.
11. Save executable Flows with `code-promote({ project, qname })` only after
   they work. Do not call `code-promote` for project-local blocks:
   `code-set`/`code-patch` save their `.block.js` directly.
12. If `code-run` returns `unsaved:true` or `workingCopy:true`, it proved the
   draft. If the runtime result matches the request, call `code-promote`
   immediately; do not resend code or rewrite for cosmetic changes.
13. Stop when `code-run` proves the requested result and the promotion succeeds.

## Svelte Frontend Workflow

For FlowEngine Svelte frontend authoring, read the MCP resource
`flow://guide/frontend-svelte` first. If the task includes backend and frontend
work, read `flow://guide/fullstack-paperboard` before coding. Use the
frontend-specific tools instead of raw files or generated Svelte output:

For backend + frontend work, call `flow-app-progress({ project })` after the
first paperboard and after each major refinement. Use its `progress.percent`,
remaining mocks, `nextActions` and `recommendedCalls` to avoid broad
rediscovery and to keep the user out of an invisible tunnel.
Use `frontend.bindingSuggestions[].bindings` and picker candidates to wire
`CallSequence` results. Pass the returned structured `binding` or `mutation`
unchanged; do not translate it into `items`, `item.title` or another string
path and do not construct a `FlowValueBinding` manually. String paths remain
migration input for older projects only. Resolve every
`frontend.bindingWarnings` entry before reporting completion by executing its
`fix` call directly when present, or its `inspect` call to select the missing
schema-backed candidate.

1. `frontend-svelte-tree({ project, detail:"compact", maxDepth:2 })` to inspect
   the current page/component tree and get stable `path`, `sourcePath`,
   `sourceMutationPath` and slot metadata. Re-read only the relevant branch with
   `frontend-svelte-tree({ project, detail:"inspect", focusPath:"<returned path>", maxDepth:8 })`
   before inspecting or editing a page/component subtree. For a binding
   property, select a schema-backed candidate from
   `bindings.<property>.sources[].bindings[]` and pass its `mutation` unchanged
   to `frontend-svelte-mutate`; do not reconstruct its path or descriptor.
   `detail:"inspect"` shows visible props, slots and focused binding metadata;
   do not use `flow-resource-get` just to understand normal page structure.
2. `frontend-svelte-palette({ project, focusPath })` to discover what can be
   inserted at a focus node. Use the returned `items[].insert` and
   `items[].targetSlot` payloads; do not invent component/directive JSON.
3. `frontend-svelte-mutate({ project, sourceFile, mutation })` to insert, move,
   delete or edit frontend nodes through the same contract as Studio drag/drop.
   Pass `sourceFile` from the focused tree node or palette target when it is
   available; for main-model `frontAst...` mutations, the MCP can infer it from
   `config.frontbuilder.svelte.modelPath`. Source-backed mutations write the
   updated source by default; use `dryRun:true` or `persist:false` only for
   explicit previews. For new pages, Flow UI blocks, Svelte UI blocks or client
   actions, pass the palette `items[].insert` payload containing
   `__frontendCreateSource` directly to `frontend-svelte-mutate`; do not create
   frontend files by hand. Do not use `flow-resource-patch` for Flow Svelte
   page/component tree or property edits; report the mutate error as a tooling
   gap instead.
4. Re-read `frontend-svelte-tree` to verify the tree.
5. `frontend-svelte-action({ project, actionId:"generate" })` to update
   generated Svelte source, or `actionId:"dev.sync"` while dev mode is running.
   Use `frontend-svelte-actions` to inspect enabled build/dev actions. It
   returns full menu ids such as `frontbuilder.svelte.generate`; the action
   tool accepts both those full ids and the shorter aliases documented in the
   guide.

Frontend blocks, directives, events and actions must appear in the logical tree:
`Button -> Events -> On Click -> Actions -> CallSequence`,
`If -> Then -> Text`, `ForEach -> Each -> ...`. Create new pages, UI blocks or
client actions from palette items only. Do not edit `_private/svelte` directly,
do not hard-code generated component behavior, and do not mutate library blocks
when the tree says the source is read-only. Use `LinkButton` for a static route
link that has no preceding action. When navigation must follow a client action,
insert `Navigate` after that action in the same event. Use `GoBack` for a visible
back command with a fallback route. Insert `OnMount` in page structure only for
automatic lifecycle work such as initialization, local synchronization or the
first local query; never hide external I/O in it unless the application contract
explicitly requires that I/O. Create all three from palette payloads. Do not
assume an implicit page
layout: insert explicit layout/surface blocks from the palette (`PageShell`,
`RowLayout`, `ColumnLayout`, `GridLayout`, `Card`) whenever the UI needs
spacing, responsive structure or a rounded card. Prefer visible block
properties and variants over page-local `<style>` blocks; if the palette lacks
the needed styling vocabulary, report that tooling gap instead of hiding the UI
in CSS. For directives, use the palette property names: `If` uses `test`,
`ForEach` uses `source` and `context`. Bindable properties such as
`ForEach.source`, `Text.source`, `Image.source`, `Table.source` and
`Json.source` require the structured descriptor returned by the picker. A
bindable descendant of a data-bound `ForEach` must set `source` explicitly;
use a picker iteration candidate for dynamic content or a structured literal
binding for intentionally static content. A string-path mutation is a tooling
error, not a shortcut. For Svelte snippets, use the simple tree
rule: no snippet means leaf; one `children` snippet means direct children under
the block; multiple snippets must appear as explicit slot nodes.
Read SvelteKit routes as route directories: `Routes -> ROOT / -> Page ->
Structure`, with optional `Layout` beside `Page` and child route directories
under `Children`. Do not expose duplicate page nodes or raw `+page.svelte`
filenames as the main low-code object. Generated route files should compose real
palette components with imports and tags such as `<PageShell><Card><Text
/></Card></PageShell>`; do not hide a page behind a synthetic `Home.svelte`
trampoline unless the tree explicitly uses a reusable component.
Flow Svelte source follows the SvelteKit filesystem convention:
`model/<App>/src/routes/+layout.flow.svelte`,
`model/<App>/src/routes/+page.flow.svelte`,
`model/<App>/src/routes/detail/+page.flow.svelte` and reusable UI sources under
`model/<App>/src/lib/...`. Generated output must remain a SvelteKit app under
`_private/svelte/src/routes`; do not introduce `src/App.svelte`, `src/main.ts`
or a hand-rolled SPA shell.

Avoid shell commands for routine checks. Do not run `git status`, `git diff`,
`sed`, `cat`, `pwd`, or HTTP scripts just to confirm a newly generated Flow.
If the prompt gives `project` and `qname`, trust them; do not inspect workspace
files to discover project YAML/XML. Use MCP tool results as the source of truth.
If the target project/qname is missing or inaccessible, stop and report it. Do
not call legacy `convertigo` tools such as `project_list`, and do not create the
Flow in another project.
Treat `code-run` as the test for a new Flow. Do not call `flow-test` after
saving unless the user explicitly asks to test the saved Flow. Use the runtime
URL only when the user explicitly asks for deployed HTTP validation or
`code-run` cannot prove the behavior.
Never use `flow-test` with `flowSource:"draft"` or inline `definition` for
FlowScript work. Drafts are editor buffers; `code-run` executes the current
working copy without resending code.
Do not pass `saveProject:true`, `refresh:true`, `draft`, or `dry` unless the user
explicitly asks for low-level debugging. The default FlowScript path behaves like
an editor buffer: write/check/run the working copy, then promote once to save.

For an existing Flow, call `code-get({ project, qname })`, edit the returned
FlowScript, and preserve `revision` when patching. For a narrow read, call
`code-get({ project, qname, pattern:"text" })` to get extracts like `code-rg`
without loading the whole source.

Use `codepatch` only for real unified diffs with `@@` hunks. If you are not
sure how to build that patch, call `code-patch` or `code-set` with the
full replacement `code` instead of sending an approximate patch format.

Use `flow-catalog` only when diagnostics do not identify the missing block or
property. Keep catalog requests narrow: `limit <= 10`, and after the first call
use `doc:false` and `hints:false`.

Use `flow-source-*`, `flow-tree`, and raw mutation tools only when debugging the compiler/model conversion itself.

## FlowScript Model

FlowScript is the preferred JavaScript-like source for project Flows on this
spike. It is compiled to the internal Flow node model at load/validation time;
do not edit generated YAML when FlowScript is available. It is not arbitrary
JavaScript: one function call maps to one Flow block.

Canonical block calls always use named parameters:

```javascript
var response = http.request({ method: "GET", url })
```

Shortcuts such as `http.get`, `http.post`, `http.put`, and `http.delete` are
real Flow blocks that delegate to the shared `http.request` stack. Flow block
calls are not JavaScript function calls: every block accepts exactly one object
parameter. Positional forms such as `http.get(url)`,
`http.request("GET", url)`, `list.sort(items, by)`, or `list.take(items, 5)`
are invalid.

Use this style:

```javascript
function BuildSummary({ input, config, result }) {
  var source = requestable.call({ requestable: input.sourceRequestable })

  var sortedItems = list.sort({
    items: source.items,
    by: current.label,
    direction: "asc"
  })

  var rows = list.map({
    items: sortedItems,
    select: {
      label: current.label,
      value: current.value
    }
  })

  var firstFiveRows = list.take({ items: sortedItems, count: 5 })
  result.rows = rows
  result.firstFiveRows = firstFiveRows
  result.count = rows.length
  return result
}
```

Compiler rules:

- `var name = block(...)` writes the block output to `local.name`.
- `name.child.path` becomes `local.name.child.path`.
- `result.key = value` writes the response scope.
- Prefer assigning block results to a local variable, then copying that value to
  `result.*`: `var cities = list.map({ ... }); result.cities = cities`.
  This is clearer for Flow analysis than embedding a block call directly in a
  `result.* = block(...)` assignment.
- `list.map({ items, select: { field: current.value } })` lowers to an explicit Flow loop.
- For projections, use `list.map` with an object `select` and keep it visible:
  `var cities = list.map({ items: topUsers, select: { name: current.name,
  city: current.address.city, company: current.company.name } })`. Do not
  hard-code `topUsers[0]`, `topUsers[1]`, etc. for dynamic lists.
- Block calls must use the canonical object form: `block.name({ key: value })`.
  Diagnostics for invalid signatures list accepted keys as `key`, optional
  `key?`, or optional with default `key??default`. Do not rely on positional
  JavaScript-style calls being normalized; they are validation errors.
- Real samples include comments such as `// Only call Flow blocks with one object containing named parameters.` Treat those comments as DSL constraints.
- Simple chained reads after a block call are accepted:
  `var users = http.get({ url: "https://..." }).body` lowers to `http.get` plus an
  explicit `json.select`.
- Use `list.take({ items, count: 5 })` for top-N/first-N array selection.
  `list.take(items, 5)` and `items.slice(0, 5)` are invalid.
  Do not emulate this with hard-coded `mapped[0]..mapped[4]`.
- Use `object.keys`, `object.get` and `object.firstEntry` for JSON object maps
  before creating a custom primitive. Example: `var rate = object.get({ source:
  local.rates, key: current.currency })`.
- Use either `items.length` or `length(items)` for array counts. Do not use
  `count(items)`, `Count(items)`, `len(items)`, `list.count(...)`, or a
  `list.count` block; they do not exist.
- Small string methods are valid on scope paths in expressions:
  `local.text.trim()`, `local.text.toLowerCase()`, `local.text.toUpperCase()`,
  `local.text.includes("x")`, `local.text.startsWith("x")`,
  `local.text.endsWith("x")`. For larger transformations, use or create a block.
- `function` is preferred so normal JS editors parse the file; the older `flow` keyword is tolerated.

## Flow Contract

Declare request inputs and reusable test inputs in an optional top-level
`_flow` object. The compiler preserves this metadata and `code-*` tools
report it as `inputDefinitions`, `inputVariables`, and `testCases`.

```javascript
const _flow = {
  inputs: {
    city: { type: "string", description: "City name to query.", default: "Paris" },
    limit: { type: "number", description: "Maximum items.", default: 5 }
  },
  outputs: {
    city: { type: "string" },
    count: { type: "integer" }
  },
  tests: {
    checkParis: { input: { city: "Paris", limit: 3 } }
  }
}

function CityDigest({ input, config, result }) {
  var response = http.get({ url: `https://example.test/${input.city}` })
  result.city = input.city
  result.count = input.limit
  return result
}
```

If `_flow.inputs` is absent, the tools still infer `inputVariables` from
`input.foo` reads. Prefer explicit `_flow.inputs` when a human should see labels,
types, defaults, or descriptions in Studio. Explicit inputs are synchronized to
Convertigo request variables by `code-set`, `code-promote`, and Flow loading;
missing declarations are reported as authoring diagnostics.

Flow result schemas are inferred static-first from `result.*` writes, explicit
`return` values, propagated block output schemas, and optional learned result
schemas. Ordinary `code-run` or requestable execution does not learn the final
Flow result unless an explicit record/learn flag is used. For Flow maintenance,
check `flow-output-schema({ project, qname })` before changing blocks. If
runtime returns fields missing from the schema, inspect `detail:"full"` warnings
and the producer nodes before editing any block or adopting a fixed contract.
Use `flow-output-schema({ project, qname, detail:"full" })` when you need to
compare `declared`, `static`, `learned` and `effective` sources or inspect
warnings before adopting a contract.
For read-only audits, decide from `sources.effective.summary.leafPaths` and the
top-level `warnings` array. Do not treat `unknown` in `sources.learned` as a
bug when `effective` is static or merged and has no warnings. Also do not treat
`declared:false` as a problem by itself: explicit `_flow.outputs` is optional.
Some raw schema payloads redact sensitive-looking field values such as
`secretName`; check `summary.leafPaths` before concluding that a redacted field
lost its type.
If `learned` contains fields no longer produced by the current Flow/block code,
or `unknown` array items caused by an old runtime sample, treat it as stale.
Use `flow-schema-reset({ project, flowName })` for a stale Flow-level learned
schema; use `flow-node-output-schema action:"remove"` for one stale producer.
Do not adopt a learned schema until `detail:"full"` shows it matches current
behavior better than `static`.
Optional `_flow.outputs` is the explicit result contract. Leave it absent when
static inference is correct, so new `result.*` writes keep updating requestable
schemas and value pickers. If present, it wins over static/learned inference.
To record a verified fixed contract, call `flow-output-schema({ project, qname,
action:"adopt", source:"static" })` or `source:"learned"` after a successful
run and `detail:"full"` review. To go back to inference, call
`flow-output-schema({ project, qname, action:"remove" })`. To delete stale
learned result samples without touching `_flow.outputs`, call
`flow-output-schema({ project, qname, action:"reset" })` or the older
`flow-schema-reset({ project, flowName })`. You can also pass `schema:{...}` to
adopt a hand-written contract.
For one producer node, call `flow-node-output-schema({ project, qname, nodeId,
detail:"full" })`. Use it for HTTP/exec/parser nodes whose declared block output
is generic but whose learned runtime schema is richer. If the Flow contains
duplicate node ids, pass the JSON Pointer `path` returned by `flow-search` as
`nodePointer`. To record a verified node schema, call
`flow-node-output-schema({ project, qname, nodeId, action:"adopt",
source:"learned" })`, `source:"static"`, or pass `schema:{...}`. To go back to
inference for that node output, call `action:"remove"`. Use
`flow-schema-reset` only when a stale learned schema masks current output across
broader scope.
Flow runtime caches are invalidated automatically from Flow engine and project
source fingerprints. `flow-cache-clear` is a debug tool only; do not include it
in the normal authoring workflow.
Do not loosen a block to `unknown` to fix a partial Flow result; only add block
`outputs` or hooks when the node feeding `result.*` is truly under-typed.

Minimal maintenance recipe for a fresh context:

1. Run `flow-output-schema({ project, qname, detail:"full" })`.
2. If top-level `warnings` is empty and `sources.effective` has the expected
   leaf paths, stop the schema audit.
3. If a warning points to one producer, inspect it with
   `flow-node-output-schema` and a narrow `code-get`/`flow-search`.
4. If static inference is correct, do not adopt `_flow.outputs`; keep the Flow
   dynamic. If stale learned result data is the issue, call
   `flow-output-schema({ project, qname, action:"reset" })`; if only one
   producer is stale, call `flow-node-output-schema action:"remove"`.
5. If code must change, use `code-get` with its `revision`, then
   `code-patch`, `code-check`, `code-run`, and `code-promote` for executable
   Flows. For project-local blocks, `code-set`/`code-patch` save directly.

## Authoring Rules

- Use `input.*` for request inputs, `config.*` for configuration, `local.*` for scratch data, `current.*` inside iterations, and `result.*` for output.
- Do not write `props` or `properties` wrappers in nodes or code. Put block properties directly in calls.
- Prefer `var value = block(...)` and `result.key = value` over explicit `out`, `set`, `json.object`, `json.field`, and `json.push` when compact syntax expresses the same intent.
- Pass typed values naturally: `items: sorted`, `name: current.name`, `enabled: true`.
- Use `{{ expression }}` mainly for mixed text templates or when diagnostics require canonical syntax.
- Flow expressions are null-safe and support indexes such as `items[0]`.
- For JSON HTTP APIs, `http.get({ url })` exposes parsed JSON under `response.body`; use `response.text` and `json.parse` only when needed. Use `http.request({ method: "POST", url, body, headers, query })` for advanced methods. All HTTP shortcuts share the `http.request` runtime stack for proxy, authentication, tracing and future platform configuration.
- Do not hard-code structural service URLs, API roots, namespace names, tokens,
  or environment constants inside reusable blocks. Store them under
  project/Flow config, for example `config.services.countries.regionUrl`, and
  pass simple typed inputs such as `country`, `currency`, `amount`, `limit`, or
  `apiKey` to domain blocks. A domain block API should express the low-code
  business operation, not transport plumbing: prefer
  `currency.countryRate({ country, rates })` or
  `catalog.enrichProduct({ product })` over
  `domain.fetch({ url })`.
- `_flow.config` is only for Flow-local defaults. If the project already
  exposes high-level FlowEngine config such as `config.services.*`,
  `config.countries.*`, `config.namespaces.*` or another domain collection,
  read it directly; do not copy it into `_flow.config`.
- If you notice more than three calls with the same block and shape, stop and
  refactor before promotion. Move repeated rows to `config.*` or a small data
  block, then use `list.map`/`list.take`. Code with five or more copied
  `http.get`, `http.request` or `requestable.call` calls is not a clean Flow
  solution unless each call is genuinely a different operation.
- Use `config.use({ http: {...}, sql: {...}, then: function () { ... } })` to run child nodes with temporary configuration overrides. Root keys are config branches, `then` is the reserved child slot, and nested objects are deep-merged then restored after the slot:
  `config.use({ http: { timeout: 30000, headers: { Authorization: config.github.token } }, then: function () { var page = http.get({ url: config.github.url }) } })`.
- Prefer existing blocks from the current provider/namespace before creating new ones.
- Keep the visible algorithm in FlowScript. Do not hide a complete backend feature in one custom Rhino block.
- Create custom blocks only when behavior is reusable or hides unavoidable low-level code.
- If only one operation is missing, create only that missing primitive. Example: use `http.get({ url })` in FlowScript, then a small custom `extractSomething({ html })` block if extraction cannot be expressed with existing blocks.
- Enumerating JSON object keys or reading a dynamic map key is not missing low-level code; use `object.keys`, `object.get` and `object.firstEntry`.
- HTTP and Convertigo requestable calls are never valid reasons for a Rhino custom block. Use `http.get`/`http.request` and `requestable.call` so the graph remains inspectable.
- Missing domain vocabulary is not a reason to collapse the feature into Rhino.
  First write the high-level FlowScript, then create a project-local mock block
  with `flow-block-mock({ project, name, properties, outputs })` when no
  compatible block exists. The mock keeps the parent Flow executable, but it is
  unfinished work until `mock:true` and the TODO are removed by a real
  FlowScript implementation. Call `flow-block-mock-list` before reporting done.
- Reusable per-item behavior belongs in a small FlowScript block. For example,
  a parent Flow maps over `local.countries`, while a
  `currency.countryRate({ country: current, rates: local.rates })` block handles
  one item. Do not duplicate the body of that per-item operation in the parent
  Flow, and do not pass prebuilt URLs between domain blocks.

## Custom Blocks

For a project-local FlowScript block:

1. Use `code-set({ project, block:"namespace.name", code, properties, outputs })`.
2. It writes canonical `libs/flow/blocks/<namespace>/<name>.block.js`
   directly. There is no `code-promote` step for blocks.
3. Declare `outputs` for stable shapes. Do not leave `unknown` when the result
   is knowable.
   For temporary generated blocks, `_meta.mock = true` is allowed only with an
   obvious TODO and typed outputs; parent Flows using a mock are not complete.
   For `_meta.runtime = "flow"` composite blocks, internal `input`, `local` and
   `result` scopes are private to the block. The caller sees only the returned
   value projected to the caller's `out` path, so `_meta.outputs.out` is the
   public contract. Field names such as `type` are normal business properties;
   declare them under `properties`, for example
   `{ type:"object", properties:{ type:{ type:"string" } } }`.
4. If the output depends on an input path or expression, add `hooks.file` with
   an analyzer that uses helpers such as `ctx.addSameSchema`,
   `ctx.addArraySchema`, `ctx.schemaForExpression`, `ctx.schemaForPath`,
   `ctx.itemSchema`/`ctx.itemSchemaFor`, and `ctx.addSchema`.
   For blocks with child slots that must expose output paths in pickers without
   recursively analyzing those children, add `analyzeShallow(ctx, node)` in the
   hooks file and publish the direct `out` schema there.
5. For item-scoped expression properties, set `current:"item"` and
   `sourceProperty:"items"` so `flow-context` and pickers expose typed
   `current.*` paths.
6. In block code, read typed properties from `input.*`.
7. Return the block value with `return value`.
8. Run a Flow that uses it, then patch the block if diagnostics or runtime behavior are wrong.
9. For edits, call `code-get`, preserve `revision`, then use
   `code-patch({ project, block:"namespace.name", revision, codepatch })`.
10. To locate code first, use `code-rg({ project, block:"namespace.name", pattern })`
   before falling back to `flow-resource-search`.

For a Rhino/Java primitive:

1. Read the MCP resource `flow://guide/rhino-block-api` first. It documents
   the available `ctx.*` helpers, so do not use shell `rg` over sibling repos to
   discover Rhino API examples.
2. Use `code-set` with canonical `.block.js` source: `_meta.runtime = "rhino"` followed by one IIFE returning `{ run: function (ctx, node) { ... } }`.
3. Before creating it, search the catalog for standard blocks that cover IO, requestables, list transforms, JSON, sessions, files and resources.
4. Keep Rhino code small and focused: one bridge/algorithm primitive, no end-to-end orchestration.
5. Do not reimplement standard blocks in Rhino. Use `http.get({ url })`/`http.request({ method, url })` for HTTP, `requestable.call({ requestable })` for Convertigo calls, `list.*` for iteration transforms, and `object.*`/`json.*` for object and JSON shaping.
6. Java classes are available through `Packages`; coerce Java values with `String(...)` or `Number(...)` before JavaScript operations.
7. Start Rhino examples with `// Use Rhino 1.9.0 features: https://mozilla.github.io/rhino/compat/engines.html`.
8. Keep orchestration in FlowScript.

If a web page or API needs parsing that no block can express, split it:

```javascript
function ReadExternalData({ input, config, result }) {
  var page = http.get({ url: "https://example.com/data" })
  var extracted = domain.extract({ html: page.text })
  result.items = extracted.items
  return result
}
```

The custom `domain.extract` block may parse text, but it must not open sockets, call URLs, call requestables, sort final results, or build the whole response.

Do not wrap a FlowScript block return in `{ out: ... }`. The block returns one
value; the caller's `var item = domain.enrichItem(...)` or explicit `out`
property decides where that value is written. Prefer:

```javascript
return { temperature: response.body.current.temperature_2m, unit: "C" }
```

not:

```javascript
return { out: { temperature: response.body.current.temperature_2m, unit: "C" } }
```

## Discovery

- Start with `code-*` tools.
- If Flow tools are not loaded yet, use one narrow tool discovery query:
  `code-set code-run code-promote flow-requestable-list` with
  a small limit. Do not ask for every Flow tool up front.
- Use `code-rg` for small code extracts.
- Use `code-rg` for small project-local FlowScript block extracts.
- Use `flow-resource-search/get` only for non-FlowScript resource files,
  editors, guides, or library assets. Do not use it to find executable Flows,
  blocks, or samples; use `code-get`, `code-rg`, `flow-search`, or diagnostics.
- Do not use `code-get` to learn standard blocks such as
  `http.get`, `http.request`, `requestable.call`, `list.filter`, `list.sort`,
  `list.take`, `list.map`, `json.select`, `set`, or `return`; they are already
  covered by this skill and diagnostics.
- If `code-get` reports `UNKNOWN_BLOCK`, do not probe more invented
  names. Use a returned candidate only if it matches the intent, call
  `flow-catalog` once, or create a project block for the missing concept.
- When `UNKNOWN_BLOCK` diagnostics include `candidateDecision`, compare
  `bestScore` with `preferExistingScore` and follow `create.tool`. A candidate
  below the threshold is weak evidence; prefer a typed mock for top-down domain
  vocabulary.
- Use `flow-search` to find existing Flows, samples, blocks, or resources.
- Prefer visible library samples named `sample_*` before browsing the full catalog.
- For sample-driven learning, read `flow://guide/samples`, then inspect
  `sample_blocks_flow_and_rhino`, `sample.formatGreeting`, and `sample.sha256`.
- Use `flow-requestable-list` and `flow-requestable-schema` to discover legacy sequence/transaction/Flow outputs.
- Never substitute `.void.void` or another placeholder requestable when the
  requested domain requestable is missing. Report the blockage instead.
- Use learned schemas only when safe; avoid raw samples unless the user asks.

Treat FlowScript diagnostics like compiler errors. Fix the reported line first, then retry validation.
