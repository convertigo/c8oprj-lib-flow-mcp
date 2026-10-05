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

## Authentication

HTTP requests to `/api/flow-mcp` require the same HS256 JWT as the legacy MCP
endpoint in the `Authorization: Bearer <token>` header. Durable token metadata,
revocation records and the common signing key are kept below
`<workspace>/jwt/mcp`; raw durable tokens are returned only once. Existing
records below the former `<workspace>/mcp` location remain readable. Short-lived
managed tokens used by the integrated Assistant remain stateless and are only
passed to Agent Bridge through an opaque in-memory handle.

The project root page provides a bootstrap token administration surface. It
accepts the hidden `flow-token-status`, `flow-token-create`,
`flow-token-list`, `flow-token-revoke` and `flow-token-managed-create` MCP
operations only from a current `WEB_ADMIN` session. These operations are not
advertised to agents by `tools/list`. Configure standalone clients with the
`CONVERTIGO_MCP_TOKEN` environment variable. The same raw token and environment
variable authenticate both MCP servers in one agent process.

`tags-get` and `tags-apply` expose the common Studio tag domain with the normal
MCP bearer authentication, without an administrator browser session. See
`flow://guide/tags` for ordered sequence memberships, named Flow configurations
and explicit project Save. The legacy MCP exposes the same commands.

Runtime shape:

```text
lib_flow_mcp.McpServer
  -> _flow/flows/McpServer.flow.js
  -> high-level MCP graph blocks (mcp.batch, mcp.handle, mcp.tools.call)
  -> visible tools/call families (inspect, source, author, runtime)
  -> private mcp.* blocks
  -> reusable core/project blocks via ctx.callBlock(...)
  -> explicit low-level libraries in _flow/lib/*.js, declared with uses
  -> lib_flow_engine.Engine
```

The flow graph owns the visible protocol routing. Reusable protocol branches
that deserve a palette/catalog item are composite graph blocks in
`_flow/blocks/*.block.js`; for example `mcp.handle` routes one JSON-RPC
request, and `mcp.tools.call` groups tools by family before delegating to
small private blocks. Private native `mcp.*` blocks keep the low-level
JSON-RPC/Convertigo glue small. When reusable behavior has a clear contract,
expose it as a block and call it with `ctx.callBlock(...)`; keep
`_flow/lib/mcp.js` only for local algorithmic helpers that would add noise
to the Flow catalog, and declare that dependency with `uses: [mcp]`.

Scope naming convention for new Flow sources:

- `input.*` is the data received by the executable Flow or block implementation.
- `local.*` is the private working scope of the current execution.
- `config.*`, `current`, `result` keep their usual meanings.
- In backend FlowScript, `props.*` and `flow.*` are not expression scopes (Flow
  Svelte reads component inputs with `@props.<name>`). JS hooks/raw
  implementations can inspect the raw node with `ctx.props(node)`.

For simple MCP tools, prefer this FlowScript shape (one statement per line,
captures as assignments):

```javascript
local.response = mcp.tool.run({
  $$id: "run",
  request: input.request,
  target: "resource.search",
})
return({
  $$id: "done",
  value: local.response,
})
```

`mcp.tool.run` prepares MCP arguments, resolves the target project, calls the
target block with `ctx.callBlock(...)`, and wraps either the result or the error
as a JSON-RPC tools/call response.

The simple read/test/introspection tools use this shape and delegate to
lib_flow_engine capability blocks such as `flow.list`, `flow.test`,
`flow.outputSchema`, `flow.code.*`, `block.code.*`, `resource.*` and
`authoring.*`. Keep JavaScript wrappers only when the tool still owns
MCP-specific behavior such as workspace search or Studio DBO registration.

When adding a new operation, ask whether the underlying behavior is:

- general Flow runtime behavior: add it to `lib_flow_engine`;
- MCP authoring behavior: keep it here;
- project-specific glue: keep it in the target project, preferably private.

## Tools

`tools/list` advertises only the tools named in `PUBLIC_TOOLS`
(`_flow/blocks/mcp/tools/available.block.js`). MCP clients expose only listed
tools, so guides, skills and this README must not recommend any other tool.

| Family | Tools |
| --- | --- |
| Code | `code-get`, `code-set`, `code-patch`, `code-rg`, `code-check`, `code-run`, `code-status`, `code-discard`, `code-promote`, `code-analyze` |
| Authoring tree | `authoring-tree`, `authoring-palette`, `authoring-mutate` |
| Svelte frontend | `frontend-svelte-tree`, `frontend-svelte-mutate`, `frontend-svelte-actions`, `frontend-svelte-action`, `frontend-svelte-asset-import`, `frontend-svelte-fullsync-schema` |
| Discovery | `flow-search`, `flow-list`, `flow-catalog`, `flow-block-get`, `flow-requestable-list`, `flow-requestable-schema` |
| Schemas and tests | `flow-output-schema`, `flow-node-output-schema`, `flow-schema-reset`, `flow-test`, `flow-sync-inputs` |
| Blocks | `flow-block-mock`, `flow-block-mock-list` |
| Resources | `flow-resource-search`, `flow-resource-get`, `flow-resource-patch`, `flow-resource-delete` |
| Project | `flow-project-bootstrap`, `flow-project-reference`, `flow-project-remove`, `flow-fullsync-scaffold`, `flow-app-progress` |
| Caches | `flow-cache-clear`, `flow-cache-info` |
| Tags | `tags-get`, `tags-apply` |

Default authoring cycle for a blank agent context:

```text
resources/list
resources/read flow://guide/start
tools/list
code-set for the first FlowScript draft (FlowScript working copy)
code-run, code-patch for revision-checked edits, then code-promote once behavior is clean
flow-search only after the first draft, when a block, pattern or schema is still unknown; multi-word queries match unordered tokens
code-rg / code-get for existing FlowScript, project blocks and Flow Svelte sources
code-analyze when choosing paths or expressions
flow-output-schema when downstream nodes need the result shape
flow-node-output-schema when one HTTP/exec/parser producer needs schema inspection, adoption or removal
flow-schema-reset only for broader stale learned-schema cleanup
flow-catalog only when search/examples are insufficient; it is summary by default
authoring-palette with a parentPath returned by authoring-tree before implementing a reusable missing frontend capability locally
flow-project-reference only for explicit project-reference maintenance
code-set with block:"ns.name" and the complete _meta + implementation only when reusable vocabulary is needed
flow-resource-search / flow-resource-get / flow-resource-patch for project types, editors, libraries, fragments and resources
```

The default path is sample-first and source-first. Custom blocks are project
vocabulary, not automatic core changes.

Tag transport regressions are covered by `tests/tags-tools.js` (the real Java
domain and both MCP adapters) and `tests/tags-http-contract.mjs` (the official
MCP SDK against an owned loopback runtime). The HTTP test requires an explicit
disposable Flow project with named configurations, `TAGS_TEST_BASE_URL`,
`TAGS_TEST_PROJECT` and `MCP_SDK_ROOT` pointing to an installed SDK. It uses a
short-lived credential in memory, logs out the fixture administrator before
the MCP calls, verifies both catalogues and the shared draft/Save/Reload
contract, then removes the tags it created. Optional `TAGS_TEST_CONFIG_PROOF_FLOW`
names a fixture Flow returning its configuration; `TAGS_TEST_CONFIG_PROOF_VALUES`
contains the two expected `baserow` branches for the first two named configs.
This also checks that changing tag order changes runtime configuration before
Save. Never run it against a user project.

Project-local blocks use a canonical `*.block.js` source containing `_meta`
plus either one FlowScript function or one Rhino IIFE. Use Rhino blocks only for
JVM/Java integration code or low-level primitives. Rhino code may use Java classes
through `Packages`, but not Node.js APIs such as `require`, npm modules or
browser globals. Keep the Rhino IIFE to `run(ctx, node)` plus local helpers.
Put shared helper dependencies in `uses`; optional dynamic
`displayName(node)` / `analyze(ctx, node)` hooks stay separate from runtime code.

Executable Flows may declare request variables and reusable test inputs with a
top-level FlowScript contract:

```javascript
const _flow = {
  "sourceVersion": 2,
  "inputs": {
    "city": {
      "type": "string",
      "description": "City name.",
      "default": "Paris",
    },
  },
  "tests": {
    "checkParis": {
      "input": {
        "city": "Paris",
      },
    },
  },
}

function Weather({ input, config, result }) {
  result.city = input.city
}
```

`code-*` tools expose this as `inputDefinitions`, `inputVariables`, and
`testCases`. Explicit `_flow.inputs` are synchronized to Convertigo request
variables so Studio, SDK callers and generated test cases see the same contract.
Without `_flow.inputs`, inputs are only inferred from `input.foo` reads and
authoring tools report a warning asking for the missing declarations.

Do not use a Rhino block as a shortcut for a whole backend feature. Keep HTTP
fetches in `http.get`/`http.request`, Convertigo calls in `requestable.call`,
array transforms in `list.*`, JSON shaping in `json.*`, and response assignment
in FlowScript. If only parsing or one Java bridge is missing, create that small
primitive and compose it visibly from the Flow.

Most tools accept either:

- `project`: Convertigo project name, resolved by the live engine;
- `projectDir`: direct filesystem path, mainly for standalone tests.

When omitted, tools operate on `lib_flow_mcp` itself. Agents should pass
`project` for application work, for example `AAAProject`.

## FlowScript code tools

`code-*` is the default source surface for agents:

- `code-get({ qname | block | sourceFile })` returns `code` plus `revision`
  (bounded reads with `startLine`/`endLine`).
- `code-set({ qname, revision?, code })` writes and validates the FlowScript
  working copy; with `block` it writes a canonical project `.block.js`, with
  `sourceFile` a Flow Svelte or CSS source.
- `code-patch({ ..., revision, codepatch })` applies a revision-checked unified
  diff.
- `code-rg({ ..., pattern })` returns small revisioned extracts.
- `code-check` dry-runs a Flow, a frontend source or a browser block
  implementation (`target:"frontend"`).
- `code-run({ qname, input? })` runs the current working copy without resending
  code; `code-status`, `code-discard` and `code-analyze` inspect or cancel it.
- `code-promote({ qname, revision })` saves the working copy to the official
  Flow (`_flow/flows/<Name>.flow.js`); the revision returned by
  `code-set`/`code-patch`/`code-check` is required. Frontend sources are
  FlowEngine working copies on a loaded project (saved with the project);
  project blocks are written by `code-set`/`code-patch` directly.

The engine parses and validates FlowScript, returns line-based diagnostics
when a block or property is invalid, and writes the canonical FlowScript source
after validation succeeds.

`flow-catalog` intentionally returns summary block/type contracts by default.
Ask for `detail:"compact"` when property docs are useful.

For iterative maintenance of other project resources, patch instead of
replacing a whole file:

```text
flow-resource-search -> flow-resource-get -> flow-resource-patch(baseHash, unified diff)
```

The patch API is limited to Flow resources: `_flow/engine.yaml`,
`_flow/blocks/**/*.{block,hooks}.js`, `_flow/fragments/**/*.fragment.yaml`,
`_flow/lib/**/*.js`, `_flow/types/**/*.{type.yaml,js}`,
`_flow/types/editors/**/*.{html,css,js}`,
`_flow/frontbuilder/**/*.{flow.svelte,flow.css,uiblock.json}`,
`_flow/resources/**` and public `resources/**` text files
(`md`, `txt`, `json`, `xml`, `yaml`). It validates block/type/library resources
and parses fragment YAML by default. Unified diff line numbers may be
approximate when the surrounding context is unique.

Search is the MCP equivalent of `rg` for Flow authoring:

```json
{
  "project": "AAAProject",
  "query": "temperature",
  "kinds": ["node"],
  "context": 1,
  "limit": 10
}
```

Each node match returns `flowQName`, `nodeId` (the node `$$id`) and a canonical
JSON Pointer `path`. Use `code-rg`/`code-patch` for the edit itself and the
`path` as `nodePointer` for node output schemas. Pass `doc:false,hints:false`
once the agent has learned the tool contract.

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

MCP resources provide the same guidance to agents that cannot read this repo.
`resources/list` returns the twelve guides of `_flow/resources/guide`, each
with its one-line summary; `resources/read` returns every resource whole:

- `flow://guide/start`
- `flow://guide/authoring`
- `flow://guide/samples`
- `flow://guide/search-and-edit`
- `flow://guide/custom-blocks`
- `flow://guide/rhino-block-api`
- `flow://guide/portable-blocks`
- `flow://guide/fullstack-paperboard`
- `flow://guide/frontend-svelte`
- `flow://guide/frontend-svelte-routing`
- `flow://guide/fullsync`
- `flow://guide/tracing`

The skills `flow://skills/convertigo-flow-mcp/SKILL`,
`flow://skills/convertigo-flow-backend/SKILL` and
`flow://skills/convertigo-flow-frontend-svelte/SKILL` are not listed but are
readable with `resources/read`.
