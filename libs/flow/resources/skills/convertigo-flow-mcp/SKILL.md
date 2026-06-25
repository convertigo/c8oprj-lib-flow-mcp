---
name: convertigo-flow-mcp
description: Use Convertigo Flow to inspect, create, edit, test, and run Convertigo Flow backends through the convertigo-flow MCP server. Prefer FlowScript code tools over raw Flow tree or YAML editing.
---

# Convertigo Flow

Use this skill when working with the experimental Convertigo Flow engine, FlowEngine, Flow blocks, property types, Flow schemas, FlowScript, or the Flow-native MCP server.

Do not use the legacy `convertigo` MCP server for Flow authoring unless the user explicitly asks to compare with legacy Convertigo MCP. If the user provides a target `project`, `qname`, or `block` and Flow MCP cannot access it, stop and report that exact blocker. Never substitute another project, never create in a "similar" project, and never use legacy MCP project discovery to work around a missing Flow MCP target.

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
3. After the syntax warm-up, write the FlowScript algorithm directly, but stay
   inside the strict Flow DSL. Every block call is `block.name({ key: value })`
   with one object argument. Do not browse the full catalog first. Let
   `code-set`, `code-check` and `code-run` diagnostics guide you with block
   candidates, accepted properties and signatures.
4. Do not call broad `flow-list`, `flow-search`, `code-rg`, `flow-catalog`,
   `flow-block-get`, `flow-resource-search`, `flow-resource-get`, or
   `flow-cache-info` before the first `code-set` unless the requested feature
   needs an unknown legacy requestable schema or the compiler diagnostics ask
   for one focused lookup. `flow-resource-*` is for project-local resource files,
   not for executable FlowScript.
5. Use `flow-requestable-list` and `flow-requestable-schema` when a legacy
   requestable shape is needed.
6. Write the editable working copy with `code-set({ project, qname, code })`.
7. Patch the working copy with `code-patch({ project, qname, revision, codepatch })` until diagnostics are clean.
8. Run/test with `code-run({ project, qname })` without sending code again.
9. Use `code-status({ project, qname })` only when dirty/revision state is unclear, or `code-discard({ project, qname })` to cancel the working copy.
10. Save executable Flows with `code-promote({ project, qname })` only after
   they work. Do not call `code-promote` for project-local blocks:
   `code-set`/`code-patch` save their `.block.js` directly.
11. If `code-run` returns `unsaved:true` or `workingCopy:true`, it proved the
   draft. If the runtime result matches the request, call `code-promote`
   immediately; do not resend code or rewrite for cosmetic changes.
12. Stop when `code-run` proves the requested result and the promotion succeeds.

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
After editing shared Flow engine JavaScript (`Engine.js`, modules, blocks or
hooks), call `flow-cache-clear({ project })`; the next MCP/Studio call uses a
fresh bridge runtime without restarting the whole Convertigo engine.
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
- Use `config.use({ http: {...}, sql: {...}, then: function () { ... } })` to run child nodes with temporary configuration overrides. Root keys are config branches, `then` is the reserved child slot, and nested objects are deep-merged then restored after the slot:
  `config.use({ http: { timeout: 30000, headers: { Authorization: config.github.token } }, then: function () { var page = http.get({ url: config.github.url }) } })`.
- Prefer existing blocks from the current provider/namespace before creating new ones.
- Keep the visible algorithm in FlowScript. Do not hide a complete backend feature in one custom Rhino block.
- Create custom blocks only when behavior is reusable or hides unavoidable low-level code.
- If only one operation is missing, create only that missing primitive. Example: use `http.get({ url })` in FlowScript, then a small custom `extractSomething({ html })` block if extraction cannot be expressed with existing blocks.
- HTTP and Convertigo requestable calls are never valid reasons for a Rhino custom block. Use `http.get`/`http.request` and `requestable.call` so the graph remains inspectable.

## Custom Blocks

For a project-local FlowScript block:

1. Use `code-set({ project, block:"namespace.name", code, properties, outputs })`.
2. It writes canonical `libs/flow/blocks/<namespace>/<name>.block.js`
   directly. There is no `code-promote` step for blocks.
3. Declare `outputs` for stable shapes. Do not leave `unknown` when the result
   is knowable.
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
5. Do not reimplement standard blocks in Rhino. Use `http.get({ url })`/`http.request({ method, url })` for HTTP, `requestable.call({ requestable })` for Convertigo calls, `list.*` for iteration transforms, and `json.*` for JSON shaping.
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
value; the caller's `var weather = weather.openMeteo(...)` or explicit `out`
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
- Use `flow-search` to find existing Flows, samples, blocks, or resources.
- Prefer visible library samples named `sample_*` before browsing the full catalog.
- For sample-driven learning, read `flow://guide/samples`, then inspect
  `sample_blocks_flow_and_rhino`, `sample.formatGreeting`, and `sample.sha256`.
- Use `flow-requestable-list` and `flow-requestable-schema` to discover legacy sequence/transaction/Flow outputs.
- Never substitute `.void.void` or another placeholder requestable when the
  requested domain requestable is missing. Report the blockage instead.
- Use learned schemas only when safe; avoid raw samples unless the user asks.

Treat FlowScript diagnostics like compiler errors. Fix the reported line first, then retry validation.
