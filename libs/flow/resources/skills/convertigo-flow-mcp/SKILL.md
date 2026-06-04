---
name: convertigo-flow-mcp
description: Use Convertigo Flow MCP to inspect, create, edit, test, and run Convertigo Flow projects through a compact MCP-first workflow.
---

# ConvertigoFlowMCP

Use this skill when working with the experimental Convertigo Flow engine or the Flow-native MCP server.

## Route

- Prefer the `convertigo-flow` MCP server when the task concerns Flow, FlowEngine, Flow blocks, property types, Flow schemas, or Flow-native backend authoring.
- The MCP server name uses a hyphen: `convertigo-flow`, not `convertigo_flow`.
- Start with `resources/list`, then read `flow://guide/start` when available.
- Use `tools/list` once, then prefer `flow-search`, `flow-tree`, `flow-catalog`, and targeted mutation tools over broad dumps.
- Prefer `flow-search` `kind:"sample"` matches before browsing the palette. Project search also includes visible library samples named `sample_*`.
- Before editing, inspect the current Flow with `flow-tree` or `flow-get`; after editing, validate with `flow-test` or `flow-run`.
- For project-local implementation files, prefer `flow-resource-get` then `flow-resource-patch` with the returned base hash.
- Keep responses compact: request summaries first, expand only the relevant node, block, type, or resource.
- After the first palette/catalog response, pass `hints:false` and `doc:false` unless a diagnostic is unclear.
- For a new Flow, preview a complete `definition` with `flow-block-test`, then write once with `flow-set`.
- For a new FlowScript-backed custom block, prefer `flow-block-code-set` over raw `flow-block-create` descriptor YAML.

## Authoring Rules

- Treat a Flow as a readable execution graph and a block as a reusable function with typed properties, slots, hooks, and an implementation.
- Use `input.*` for inputs and `local.*` for scratch data in Flow sources. `flow.*` and `props.*` are not expression scopes.
- Flow expressions are null-safe and support index reads such as `local.items[0]` or `current["media:thumbnail"]`; use literal properties or JSON blocks for array/object construction.
- In complete Flow definitions, put node properties directly on each node: `{id, block, requestable, out}`. Do not nest them under `props` or `properties`; `properties` is only for node mutation tools.
- For usage examples, create a private executable Flow named `sample_*`. Use comments only for subtle choices, not boilerplate.
- Prefer existing blocks from the current provider/namespace before creating new blocks.
- Create custom blocks only when the behavior is reusable or hides unavoidable low-level code. Use `flow-block-code-set` for reusable blocks implemented with FlowScript: `input.*` are typed block properties, code may be a body or `block localName({ input }) { ... }`, template literals are accepted for simple string composition, and `return value;` returns the block result.
- A `flow-block-code-set` dry run validates but does not register the block in the palette. After a clean dry run, save the block with `dry:false` before validating a Flow that calls it.
- In compact FlowScript, pass typed values naturally: `name: current.name`, `items: sorted`, `enabled: true`. Use `{{ expression }}` mainly for mixed text templates or when diagnostics ask for canonical syntax.
- Map arrays through reusable blocks with `const rows = list.map(items, custom.block({ prop: current.value }))`; the compiler lowers it to a Flow loop.
- For JSON HTTP APIs, `http.get` exposes parsed JSON under `response.body`. Use `response.text` and `json.parse` only when the response is not already native JSON.
- Keep Rhino code small and localized inside block implementations; use Flow blocks for orchestration. Declare any `ctx.lib("name")` dependency with `uses: [name]`.
- Do not edit generated or cached files unless an MCP tool explicitly returns them as writable Flow resources.
- Do not call `flow-schema-reset` unless an existing learned schema is stale.

## Local MCP Endpoint

- Expected Codex MCP server: `convertigo-flow`.
- The endpoint URL is configured in `.codex/config.toml`; this skill intentionally does not duplicate it.
- If the endpoint changes, run `lib_flow_mcp._setupCodex` again.
