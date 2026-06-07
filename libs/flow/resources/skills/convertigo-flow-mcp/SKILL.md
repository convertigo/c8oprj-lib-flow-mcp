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
2. Use `flow-requestable-list` and `flow-requestable-schema` when a legacy
   requestable shape is needed.
3. Validate with `flow-code-set({ project, qname, revision, code, dry:true })`.
4. Run/test with `flow-code-run`.
5. Save with `flow-code-set({ project, qname, revision, code, dry:false })` only after diagnostics are clean. This is a fast FlowScript write by default; pass `saveProject:true` only when a full Convertigo project export is required, and `refresh:true` only when the Studio UI must refresh immediately.
6. Stop when `flow-code-run` proves the requested result and the save succeeds.

Avoid shell commands for routine checks. Do not run `git status`, `git diff`,
`sed`, `cat`, `pwd`, or HTTP scripts just to confirm a newly generated Flow.
If the prompt gives `project` and `qname`, trust them; do not inspect workspace
files to discover project YAML/XML. Use MCP tool results as the source of truth.
Treat `flow-code-run` as the test for a new Flow. Do not call `flow-test` after
saving unless the user explicitly asks to test the saved Flow. Use the runtime
URL only when the user explicitly asks for deployed HTTP validation or
`flow-code-run` cannot prove the behavior.

For an existing Flow, call `flow-code-get({ project, qname })`, edit the returned
FlowScript, and preserve `revision` when patching.

Use `flow-catalog` only when diagnostics do not identify the missing block or
property. Keep catalog requests narrow: `limit <= 10`, and after the first call
use `doc:false` and `hints:false`.

Use `flow-source-*`, `flow-tree`, and raw mutation tools only when debugging the compiler/model conversion itself.

## FlowScript Model

FlowScript is the preferred JavaScript-like source for project Flows on this
spike. It is compiled to the internal Flow node model at load/validation time;
do not edit generated YAML when FlowScript is available. It is not arbitrary
JavaScript: one function call maps to one Flow block.

Use this style:

```javascript
function BuildSummary({ input, config, result }) {
  var source = requestable.call(input.sourceRequestable)

  var sortedItems = list.sort(source.items, {
    by: current.label,
    direction: "asc"
  })

  var rows = list.map(sortedItems, {
    label: current.label,
    value: current.value
  })

  result.rows = rows
  result.count = rows.length
  return result
}
```

Compiler rules:

- `var name = block(...)` writes the block output to `local.name`.
- `name.child.path` becomes `local.name.child.path`.
- `result.key = value` writes the response scope.
- `list.map(items, { field: current.value })` lowers to an explicit Flow loop.
- `function` is preferred so normal JS editors parse the file; the older `flow` keyword is tolerated.

## Authoring Rules

- Use `input.*` for request inputs, `config.*` for configuration, `local.*` for scratch data, `current.*` inside iterations, and `result.*` for output.
- Do not write `props` or `properties` wrappers in nodes or code. Put block properties directly in calls.
- Prefer `var value = block(...)` and `result.key = value` over explicit `out`, `set`, `json.object`, `json.field`, and `json.push` when compact syntax expresses the same intent.
- Pass typed values naturally: `items: sorted`, `name: current.name`, `enabled: true`.
- Use `{{ expression }}` mainly for mixed text templates or when diagnostics require canonical syntax.
- Flow expressions are null-safe and support indexes such as `items[0]`.
- For JSON HTTP APIs, `http.get` exposes parsed JSON under `response.body`; use `response.text` and `json.parse` only when needed.
- Prefer existing blocks from the current provider/namespace before creating new ones.
- Keep the visible algorithm in FlowScript. Do not hide a complete backend feature in one custom Rhino block.
- Create custom blocks only when behavior is reusable or hides unavoidable low-level code.
- If only one operation is missing, create only that missing primitive. Example: use `http.get` in FlowScript, then a small custom `extractSomething({ html })` block if extraction cannot be expressed with existing blocks.
- HTTP and Convertigo requestable calls are never valid reasons for a Rhino custom block. Use `http.get`/`http.request` and `requestable.call` so the graph remains inspectable.

## Custom Blocks

For a project-local FlowScript block:

1. Use `flow-block-code-set({ project, name, code, properties, outputs, dry:true })`.
2. It writes canonical `libs/flow/blocks/<namespace>/<name>.block.js`.
3. In block code, read typed properties from `input.*`.
4. Return the block value with `return value`.
5. Save with `dry:false` only after validation is clean.
6. For edits, call `flow-block-code-get`, preserve `revision`, then use
   `flow-block-code-patch({ project, name, revision, codepatch })`.
7. To locate code first, use `flow-block-code-rg({ project, pattern, name? })`
   before falling back to `flow-resource-search`.

For a Rhino/Java primitive:

1. Use `flow-block-code-set` with canonical `.block.js` source: `_meta.runtime = "rhino"` followed by one IIFE returning `{ run: function (ctx, node) { ... } }`.
2. Before creating it, search the catalog for standard blocks that cover IO, requestables, list transforms, JSON, sessions, files and resources.
3. Keep Rhino code small and focused: one bridge/algorithm primitive, no end-to-end orchestration.
4. Do not reimplement standard blocks in Rhino. Use `http.get`/`http.request` for HTTP, `requestable.call` for Convertigo calls, `list.*` for iteration transforms, and `json.*` for JSON shaping.
5. Java classes are available through `Packages`; coerce Java values with `String(...)` or `Number(...)` before JavaScript operations.
6. Keep orchestration in FlowScript.

If a web page or API needs parsing that no block can express, split it:

```javascript
function ReadExternalData({ input, config, result }) {
  var page = http.get("https://example.com/data")
  var extracted = domain.extract({ html: page.text })
  result.items = extracted.items
  return result
}
```

The custom `domain.extract` block may parse text, but it must not open sockets, call URLs, call requestables, sort final results, or build the whole response.

## Discovery

- Start with `flow-code-*` tools.
- Use `flow-code-rg` for small code extracts.
- Use `flow-block-code-rg` for small project-local FlowScript block extracts.
- Use `flow-search` to find existing Flows, samples, blocks, or resources.
- Prefer visible library samples named `sample_*` before browsing the full catalog.
- Use `flow-requestable-list` and `flow-requestable-schema` to discover legacy sequence/transaction/Flow outputs.
- Use learned schemas only when safe; avoid raw samples unless the user asks.

Treat FlowScript diagnostics like compiler errors. Fix the reported line first, then retry validation.
