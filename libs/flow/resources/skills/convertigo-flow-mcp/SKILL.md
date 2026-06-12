---
name: convertigo-flow-mcp
description: Use Convertigo Flow to inspect, create, edit, test, and run Convertigo Flow backends through the convertigo-flow MCP server. Prefer FlowScript code tools over raw Flow tree or YAML editing.
---

# Convertigo Flow

Use this skill when working with the experimental Convertigo Flow engine, FlowEngine, Flow blocks, property types, Flow schemas, FlowScript, or the Flow-native MCP server.

Do not use the legacy `convertigo` MCP server for Flow authoring unless the user explicitly asks to compare with legacy Convertigo MCP.

## MCP Server

- MCP server: `convertigo-flow`
- Use the hyphenated name `convertigo-flow`, not `convertigo_flow`.
- Endpoint is configured in `~/.codex/config.toml`; if it changes, run `lib_flow_mcp._setupCodex`.

## Default Workflow

Prefer the compact code path:

1. For a new Flow, write fresh compact FlowScript first; do not inspect/copy
   existing Flows unless this is a maintenance task or the user asks to reuse a
   nearby pattern.
   Do not call `flow-list`, `flow-code-get`, `flow-code-rg`, or `flow-catalog`
   just to learn conventions for a straightforward new Flow; use the syntax in
   this skill, then let diagnostics guide corrections.
2. Use `flow-requestable-list` and `flow-requestable-schema` when a legacy
   requestable shape is needed.
3. Write the editable working copy with `flow-code-set({ project, qname, code })`.
4. Patch the working copy with `flow-code-patch({ project, qname, revision, codepatch })` until diagnostics are clean.
5. Run/test with `flow-code-run({ project, qname })` without sending code again.
6. Use `flow-code-status({ project, qname })` only when dirty/revision state is unclear, or `flow-code-discard({ project, qname })` to cancel the working copy.
7. Save with `flow-code-promote({ project, qname })` only after it works.
8. Stop when `flow-code-run` proves the requested result and the promotion succeeds.

Avoid shell commands for routine checks. Do not run `git status`, `git diff`,
`sed`, `cat`, `pwd`, or HTTP scripts just to confirm a newly generated Flow.
If the prompt gives `project` and `qname`, trust them; do not inspect workspace
files to discover project YAML/XML. Use MCP tool results as the source of truth.
Treat `flow-code-run` as the test for a new Flow. Do not call `flow-test` after
saving unless the user explicitly asks to test the saved Flow. Use the runtime
URL only when the user explicitly asks for deployed HTTP validation or
`flow-code-run` cannot prove the behavior.
Do not pass `saveProject:true`, `refresh:true`, `draft`, or `dry` unless the user
explicitly asks for low-level debugging. The default FlowScript path behaves like
an editor buffer: write/check/run the working copy, then promote once to save.

For an existing Flow, call `flow-code-get({ project, qname })`, edit the returned
FlowScript, and preserve `revision` when patching.

Use `codepatch` only for real unified diffs with `@@` hunks. If you are not
sure how to build that patch, call `flow-code-patch` or `flow-code-set` with the
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
- `list.map({ items, select: { field: current.value } })` lowers to an explicit Flow loop.
- Block calls must use the canonical object form: `block.name({ key: value })`.
  Diagnostics for invalid signatures list accepted keys as `key`, optional
  `key?`, or optional with default `key??default`.
- Simple chained reads after a block call are accepted:
  `var users = http.get({ url: "https://..." }).body` lowers to `http.get` plus an
  explicit `json.select`.
- Use `list.take({ items, count: 5 })` for top-N/first-N array selection.
  `list.take(items, 5)` and `items.slice(0, 5)` are invalid.
  Do not emulate this with hard-coded `mapped[0]..mapped[4]`.
- Use either `items.length` or `length(items)` for array counts. Do not use
  `count(items)`, `Count(items)`, `len(items)`, `list.count(...)`, or a
  `list.count` block; they do not exist.
- `function` is preferred so normal JS editors parse the file; the older `flow` keyword is tolerated.

## Flow Contract

Declare request inputs and reusable test inputs in an optional top-level
`_flow` object. The compiler preserves this metadata and `flow-code-*` tools
report it as `inputDefinitions`, `inputVariables`, and `testCases`.

```javascript
const _flow = {
  inputs: {
    city: { type: "string", description: "City name to query.", default: "Paris" },
    limit: { type: "number", description: "Maximum items.", default: 5 }
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
types, defaults, or descriptions in Studio.

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

1. Use `flow-block-code-set({ project, name, code, properties, outputs })`.
2. It writes canonical `libs/flow/blocks/<namespace>/<name>.block.js`.
3. In block code, read typed properties from `input.*`.
4. Return the block value with `return value`.
5. Run a Flow that uses it, then patch the block if diagnostics or runtime behavior are wrong.
6. For edits, call `flow-block-code-get`, preserve `revision`, then use
   `flow-block-code-patch({ project, name, revision, codepatch })`.
7. To locate code first, use `flow-block-code-rg({ project, pattern, name? })`
   before falling back to `flow-resource-search`.

For a Rhino/Java primitive:

1. Use `flow-block-code-set` with canonical `.block.js` source: `_meta.runtime = "rhino"` followed by one IIFE returning `{ run: function (ctx, node) { ... } }`.
2. Before creating it, search the catalog for standard blocks that cover IO, requestables, list transforms, JSON, sessions, files and resources.
3. Keep Rhino code small and focused: one bridge/algorithm primitive, no end-to-end orchestration.
4. Do not reimplement standard blocks in Rhino. Use `http.get({ url })`/`http.request({ method, url })` for HTTP, `requestable.call({ requestable })` for Convertigo calls, `list.*` for iteration transforms, and `json.*` for JSON shaping.
5. Java classes are available through `Packages`; coerce Java values with `String(...)` or `Number(...)` before JavaScript operations.
6. Keep orchestration in FlowScript.

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

- Start with `flow-code-*` tools.
- If Flow tools are not loaded yet, use one narrow tool discovery query:
  `flow-code-set flow-code-run flow-code-promote flow-requestable-list` with
  a small limit. Do not ask for every Flow tool up front.
- Use `flow-code-rg` for small code extracts.
- Use `flow-block-code-rg` for small project-local FlowScript block extracts.
- Do not use `flow-block-code-get` to learn standard blocks such as
  `http.get`, `http.request`, `requestable.call`, `list.filter`, `list.sort`,
  `list.take`, `list.map`, `json.select`, `set`, or `return`; they are already
  covered by this skill and diagnostics.
- If `flow-block-code-get` reports `UNKNOWN_BLOCK`, do not probe more invented
  names. Use a returned candidate only if it matches the intent, call
  `flow-catalog` once, or create a project block for the missing concept.
- Use `flow-search` to find existing Flows, samples, blocks, or resources.
- Prefer visible library samples named `sample_*` before browsing the full catalog.
- Use `flow-requestable-list` and `flow-requestable-schema` to discover legacy sequence/transaction/Flow outputs.
- Never substitute `.void.void` or another placeholder requestable when the
  requested domain requestable is missing. Report the blockage instead.
- Use learned schemas only when safe; avoid raw samples unless the user asks.

Treat FlowScript diagnostics like compiler errors. Fix the reported line first, then retry validation.
