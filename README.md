# lib_flow_mcp

Flow-native MCP server for Convertigo Flow authoring.

This project intentionally keeps MCP tooling outside `lib_flow_engine`.
`lib_flow_engine` remains the standard runtime vocabulary; this library owns the
MCP surface and any blocks specific to Flow authoring automation.

HTTP entry point:

```text
http://localhost:18080/convertigo/api/flow-mcp
```

The UrlMapper path is `/flow-mcp`; the trailing-slash variant `/flow-mcp/` is
also mapped to the same requestable. The legacy Convertigo MCP project keeps
`/mcp`.

Runtime shape:

```text
lib_flow_mcp.McpServer
  -> libs/flows/McpServer.flow.yaml
  -> high-level MCP graph blocks (mcp.batch, mcp.handle, mcp.tools.call)
  -> visible tools/call families (inspect, source, author, runtime)
  -> private mcp.* blocks
  -> reusable core/project blocks via ctx.callBlock(...)
  -> explicit low-level libraries in libs/flow/lib/*.js, declared with uses
  -> lib_flow_engine.Engine
```

The flow graph owns the visible protocol routing. Reusable protocol branches
that deserve a palette/catalog item are composite graph blocks in
`libs/flow/blocks/*.block.yaml`; for example `mcp.handle` routes one JSON-RPC
request, and `mcp.tools.call` is implemented with `mcp.tool.identify` and one
branch per tool family. Private native `mcp.*` blocks keep the low-level
JSON-RPC/Convertigo glue small. When reusable behavior has a clear contract,
expose it as a block and call it with `ctx.callBlock(...)`; keep
`libs/flow/lib/mcp.js` only for local algorithmic helpers that would add noise
to the Flow catalog, and declare that dependency with `uses: [mcp]`.

Scope naming convention for new Flow sources:

- `input.*` is the data received by the executable Flow or block implementation.
- `local.*` is the private working scope of the current execution.
- `config.*`, `current`, `result` keep their usual meanings.
- `props.*` and `flow.*` are not expression scopes. JS hooks/raw implementations
  can inspect the raw node with `ctx.props(node)`.

For simple MCP tools, prefer this graph shape:

```yaml
nodes:
  - id: run
    block: mcp.tool.run
    request: input.request
    target: resource.search
    out: local.response
  - id: done
    block: return
    value: "{{ local.response }}"
```

`mcp.tool.run` prepares MCP arguments, resolves the target project, calls the
target block with `ctx.callBlock(...)`, and wraps either the result or the error
as a JSON-RPC tools/call response.

The simple read/test/introspection tools now use this shape and delegate to
core capability blocks such as `flow.list`, `flow.get`, `flow.run`,
`flow.test`, `flow.tree`, `flow.context`, `flow.outputSchema`, `flow.apply`,
`resource.*`, `block.*` and `type.*`. Keep JavaScript wrappers only when the
tool still owns MCP-specific behavior such as workspace search or Studio DBO
registration after writing a Flow.

When adding a new operation, ask whether the underlying behavior is:

- general Flow runtime behavior: add it to `lib_flow_engine`;
- MCP authoring behavior: keep it here;
- project-specific glue: keep it in the target project, preferably private.

Default authoring cycle for a blank agent context:

```text
resources/list
resources/read flow://guide/start
tools/list
flow-search to find flows, nodes, catalog entries and schemas; multi-word queries match unordered tokens
flow-tree / flow-get only for the narrow target
flow-context when choosing paths or expressions
flow-output-schema when downstream nodes need the result shape
flow-schema-reset before rerunning an HTTP learn scenario when the output changed
flow-get.definition -> edit object -> flow-set.definition for broad model edits
flow-node-add / flow-node-edit / flow-node-move / flow-node-delete / flow-node-duplicate
flow-apply / flow-edit for lower-level mutations
flow-test
flow-catalog only when search/examples are insufficient; it is summary by default
flow-block-get / flow-type-get only for source-level authoring
flow-block-create / flow-block-duplicate / flow-block-edit / flow-type-create only when the catalog is insufficient
flow-resource-search / flow-resource-get / flow-resource-patch for maintenance patches on project JS/YAML/HTML/CSS resources and Flow libraries
```

The default path remains catalog-first and sidecar-first. Custom blocks are
project vocabulary, not automatic core changes.

Project-local blocks use a `*.block.yaml` descriptor. Their implementation is
declared by `implementation.runtime`: usually `flow` for a graph made of blocks,
or `rhino` with a peer `*.js` file for JVM/Java integration code. Rhino code may
use Java classes through `Packages`, but not Node.js APIs such as `require`, npm
modules or browser globals. Keep the runtime file to `run(ctx, node)` plus local
helpers. Put shared helper dependencies in `uses`, static metadata in
`*.block.yaml`, and optional dynamic
`displayName(node)` / `analyze(ctx, node)` hooks in a separate `hooks.file`.

Most tools accept either:

- `project`: Convertigo project name, resolved by the live engine;
- `projectDir`: direct filesystem path, mainly for standalone tests.

When omitted, tools operate on `lib_flow_mcp` itself. Agents should pass
`project` for application work, for example `AAAProject`.

Mutation tools accept semantic node targets first. Prefer this shape after
`flow-search` returns a `nodeId`:

```json
{
  "name": "WeatherAlert",
  "mutation": {
    "op": "replace",
    "nodeId": "setMessage",
    "property": "value",
    "value": "Done"
  }
}
```

Use `afterNodeId`, `beforeNodeId` or `parentNodeId + slot` to insert nodes
without hard-coding array indexes:

```json
{
  "name": "WeatherAlert",
  "mutation": {
    "op": "insert",
    "afterNodeId": "setMessage",
    "value": {
      "id": "logDone",
      "block": "log",
      "message": "Done"
    }
  }
}
```

Low-level mutations can still use the same JSON Pointer syntax as the Flow
virtual tree:

```json
{
  "name": "WeatherAlert",
  "mutation": {
    "op": "insert",
    "path": "/nodes",
    "index": "end",
    "value": {
      "id": "setMessage",
      "block": "set",
      "path": "result.message",
      "value": "Done"
    }
  }
}
```

Use `flow-apply` to preview the updated YAML source. Use `flow-edit` to apply
the same mutation to a named project Flow sidecar.

For a broader edit, use the tree-like model round trip instead of inventing a
new command:

1. `flow-get` returns `source` and `definition`.
2. Modify `definition` as a JSON object.
3. Send it back with `flow-set` using the same `definition` property.

`flow-run`, `flow-test`, `flow-tree`, `flow-apply`, `flow-output-schema` and
`flow-block-test` also accept this `definition` shape. This is the preferred
KISS alternative to multiplying CRUD aliases such as create/update/replace.

`flow-catalog` intentionally returns summary block/type contracts by default.
Ask for `detail:"compact"` when property docs are useful. Ask for
`detail:"full"` only when icon paths, type usage lists or full descriptor
resources are useful.

When `flow-set` or `flow-edit` receives a live `project`, it also registers the
named sidecar as a minimal Flow DBO by default, saves the project, and refreshes
the Studio tree when Studio is available. Pass `register:false`, `autoSave:false`
or `refresh:false` only for deliberate tooling cases. With `projectDir` only,
registration is skipped and the tool stays a pure filesystem sidecar writer.

The common node wrappers are preferred when they fit:

- `flow-node-add`: add a node near another node or inside a parent slot.
- `flow-node-edit`: replace one property or merge several properties.
- `flow-node-move`: move a node by `nodeId`.
- `flow-node-delete`: delete a node by `nodeId`.
- `flow-node-duplicate`: duplicate a node and optionally patch the new copy.

`flow-node-add` requires a stable `id`. `flow-node-duplicate` requires `newId`
or `properties.id` to avoid creating duplicate ids.

Block authoring is intentionally explicit:

- `flow-block-get` reads any visible block source.
- `flow-block-create` writes a new project-local block.
- `flow-block-duplicate` copies a core/shared/project block to a new
  project-local name.
- `flow-block-edit` replaces the source of an existing project-local block.

Core and shared blocks are read-only through this MCP surface. Duplicate them
first when an agent needs a custom variant.

## FlowScript spike tools

On the `spike-flowscript` branch, the MCP also exposes an experimental source
view for agents:

```text
flow-code-get
flow-code-set
flow-code-patch
flow-code-rg

flow-source-get
flow-source-validate
flow-source-patch
```

Prefer `flow-code-*` for normal agent work:

- `flow-code-get({qname})` returns only FlowScript `code` plus `revision`.
- `flow-code-set({qname, revision?, code, dry?})` validates and optionally writes.
- `flow-code-patch({qname, revision, codepatch|code, dry?})` applies a revision-checked edit.
- `flow-code-rg({qname?, pattern})` returns small FlowScript extracts.

The engine parses and validates the FlowScript, returns line-based diagnostics
when a block/property is invalid, and writes the regular Flow YAML sidecar only
after validation succeeds.

Keep `flow-source-*` for compiler/debug work where canonical definitions, YAML
or full analysis are intentionally needed.

This is a research path to measure whether agents transpose code instincts more
efficiently than direct block/tree MCP editing.

For iterative maintenance, prefer patching the project-local resource instead
of replacing a whole source file:

```text
flow-resource-search -> flow-resource-get -> flow-resource-patch(baseHash, unified diff)
```

The patch API is limited to `libs/flow/blocks/**/*.js`,
`libs/flow/blocks/**/*.block.yaml`, `libs/flow/fragments/**/*.fragment.yaml`,
`libs/flow/lib/**/*.js`, `libs/flow/types/**/*.{type.yaml,js}` and
`libs/flow/types/editors/**/*.{html,css,js}`. It validates block/type/library
resources and parses Flow/fragment YAML by default.
Unified diff line numbers may be approximate when the surrounding context is
unique.

Search is the MCP equivalent of `rg` for Flow authoring:

```json
{
  "project": "AAAProject",
  "query": "temperature",
  "kinds": ["node"],
  "context": 1,
  "limit": 20
}
```

Each node match returns `flowQName`, `nodeId` and a canonical JSON Pointer
`path`. Use `nodeId` for semantic edits and `path` for low-level mutations.
Pass `doc:false,hints:false` once the agent has learned the tool contract.

MCP responses are sanitized before they are sent to agents: internal `__flow*`
fields are removed, empty metadata fields such as `mode:""` are omitted, and
filesystem paths are shortened to project-relative paths or `engine:...`
references. Studio-only icon/resource paths may still exist in internal Flow
tree data, but they should not leak through the MCP JSON-RPC result payload.

Optional JSONL tracing can write one line per MCP request and response. Enable
it with the Convertigo symbol:

```text
flow.mcp.traceJsonl=true
flow.mcp.traceJsonl=/path/to/flow-mcp.jsonl
flow.mcp.traceJsonl.maxChars=30000
```

When set to `true`, the default file is
`<lib_flow_mcp project>/_private/flow-mcp-trace.jsonl`. Tracing is best-effort
and never fails the MCP request path. Each JSONL line includes a sanitized
payload plus a compact `summary`, `payloadChars`, `payloadTruncated` and, for
responses, `durationMs`. The optional `maxChars` symbol limits large payloads
while preserving their summary. Standalone tests may also pass
`config.mcp.traceJsonl` and `config.mcp.traceJsonlMaxChars`, but production
configuration should use symbols.

MCP resources provide the same guidance to agents that cannot read this repo:

- `flow://guide/start`
- `flow://guide/authoring`
- `flow://guide/search-and-edit`
- `flow://guide/custom-blocks`
- `flow://guide/tracing`
