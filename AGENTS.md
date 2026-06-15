# Flow MCP Authoring Guide

This project is the Flow-native MCP server. Keep it separate from
`lib_flow_engine`.

Rules:

- Do not add general runtime blocks here; put them in `lib_flow_engine`.
- Put MCP protocol routing, Flow authoring tools and agent-only helpers here.
- Prefer a small MCP tool that calls reusable blocks with `ctx.callBlock(...)`
  over a large block that duplicates engine logic. Promote reusable behavior to
  `lib_flow_engine` when it is not MCP-specific.
- Keep high-level JSON-RPC routing visible in the public `McpServer` Flow and
  promote reusable branches to FlowScript blocks in
  `libs/flow/blocks/**/*.block.js` whenever possible. Keep shared JavaScript helpers in
  `libs/flow/lib/mcp.js` only for low-level local details that are not useful as
  Flow blocks, and declare those helpers with `uses` on each block that calls
  `ctx.lib(...)`.
- Keep the single-request router in `mcp.handle.block.js` once migrated, so batch and
  request routing both expose their Flow implementation in the catalog tree.
- Keep `tools/call` routing visible too: `mcp.tools.call.block.js` should
  group tools by intent before delegating to small private blocks.
- For tools that only prepare MCP arguments, call one Flow capability and wrap
  the response, prefer a composite block using `mcp.tool.run` instead of a
  custom JavaScript wrapper.
- Use `/convertigo/api/flow-mcp` as the HTTP entry point. Do not use
  `/convertigo/api/mcp`, which belongs to the legacy Convertigo MCP project.
- Keep generated or one-off helper blocks private when they are not intended for
  projects referencing this library.
- Use `input.*` for executable/block inputs and `local.*` for scratch state in
  all new FlowScript and generated Flow models. `flow.*` and `props.*` are not expression scopes; JS
  hooks/raw implementations can inspect the raw node with `ctx.props(node)`.

Authoring loop for a blank agent context:

```text
resources/list
resources/read flow://guide/start
resources/read flow://guide/samples
flow-code-get sample_blocks_flow_and_rhino and flow-block-code-get sample.formatGreeting/sample.sha256 to learn real DSL shape
tools/list
flow-search to find flows, nodes, catalog entries and schemas; multi-word queries match unordered tokens
flow-code-rg / flow-code-get for FlowScript source
flow-tree / flow-get only for model-conversion debugging
flow-context when choosing paths or expressions
flow-output-schema before wiring downstream nodes
flow-schema-reset before rerunning an HTTP learn scenario when the output changed
flow-code-set for broad Flow edits; it writes the FlowScript working copy
flow-code-patch for revision-checked maintenance edits on that working copy
flow-code-check / flow-code-run, then flow-code-promote once behavior is clean
flow-catalog only when search/examples are insufficient; it is summary by default
flow-block-code-rg / flow-block-code-get / flow-block-code-patch for project-local FlowScript blocks
flow-block-code-set only when reusable vocabulary is needed
flow-block-create / flow-block-duplicate / flow-block-edit / flow-type-create only for Rhino/native/type compatibility cases
flow-resource-search / flow-resource-get / flow-resource-patch for project JS/HTML/CSS/library/type/resource maintenance patches
```

Prefer editing Flow sidecars over adding custom blocks. Prefer project-local
custom blocks over changing the shared core library. A Rhino block must be a
small primitive, not a hidden backend feature. Use FlowScript and standard
blocks for HTTP, requestables, list/JSON transforms and response mapping.
Core and shared blocks are read-only through MCP: use `flow-block-duplicate`
to create a project-local variant, then `flow-block-edit` to replace its
source.

For external HTTP APIs, prefer a reusable typed FlowScript sub-block instead of
inlining provider details in the main executable Flow. The sub-block should
expose simple `input.*` properties such as `city`, `latitude`, `longitude`,
`apiKey` or `limit`, call `http.get` / `http.request`, and return a small typed
object. The executable Flow should call that block and shape `result.*`.

When FlowScript reads `input.foo`, treat `foo` as a request input that should be
visible to users and tests. If Flow MCP tools report `inputVariables`, use it as
the list of request variables/test inputs to create or document.
Prefer explicit top-level `const _flow = { inputs: {...}, tests: {...} }` when
the Flow has human-facing request variables, comments/defaults, or reusable test
inputs. `flow-code-*` tools report this contract as `inputDefinitions`,
`inputVariables`, and `testCases`.

When maintaining an existing FlowScript block, prefer
`flow-block-code-rg`, `flow-block-code-get`, then `flow-block-code-patch` with
the returned `revision`. For libraries, editors, type descriptors and other
resources, use `flow-resource-search`, `flow-resource-get`, then
`flow-resource-patch` with the returned `baseHash`.

Custom blocks use a canonical `*.block.js` file containing `_meta` and one
implementation body. Use Rhino runtime only for JVM/Java integration or
low-level algorithmic code. Rhino code may use Java classes through `Packages`,
but not Node.js APIs such as `require`, npm modules or browser globals.

Most tools accept `project` or `projectDir`. Use `project` for real Convertigo
workspaces and reserve `projectDir` for standalone tests. Never assume the MCP
host project is the project being edited.

Prefer targeted mutations over rewriting a whole Flow source. Use:

- `flow-search` to get `flowQName`, `nodeId` and a compact context;
- `flow-code-get` then `flow-code-patch` for existing FlowScript;
- `flow-code-set` to update the FlowScript working copy before run/promote;
- `flow-tree`, `flow-node-*`, `flow-apply` and `flow-edit` only for low-level
  model inspection or compiler debugging.

Use `flow-type-create` only for real project vocabulary. Do not create custom
types when a core type such as `text`, `path`, `value`, `template`,
`expression`, `literal` or `requestable` already fits.

Prefer `flow-search` before broad reads. Multi-word queries match unordered
tokens, so a query like `GetFeed requestable call` should find a node whose
requestable is `AAAProject.GetFeed` and whose block is `requestable.call`. It returns compact matches with
`flowQName`, `nodeId`, canonical JSON Pointer `path`, `summary`, `snippet`, and
optional `context`. Start with `doc:true,hints:true`, then pass
`doc:false,hints:false` for repeated calls.

MCP resources mirror this guide for clients that do not read repo files:
`flow://guide/start`, `flow://guide/authoring`,
`flow://guide/search-and-edit`, `flow://guide/custom-blocks`, and
`flow://guide/samples`.

Prefer demonstration by example over broad theory for blank agents. Keep sample
Flows and sample blocks small, executable/readable through MCP, and commented
only when the comment teaches a DSL rule, for example:
`// Only call Flow blocks with one object containing named parameters.`
Rhino sample blocks should start with:
`// Use Rhino 1.9.0 features: https://mozilla.github.io/rhino/compat/engines.html`.
