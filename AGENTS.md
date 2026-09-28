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
  `_flow/blocks/**/*.block.js` whenever possible. Keep shared JavaScript helpers in
  `_flow/lib/mcp.js` only for low-level local details that are not useful as
  Flow blocks, and declare those helpers with `uses` on each block that calls
  `ctx.lib(...)`.
- Keep the single-request router in `_flow/blocks/mcp/handle.block.js`
  (block `mcp.handle`), so batch and request routing both expose their Flow
  implementation in the catalog tree.
- Keep `tools/call` routing visible too: `_flow/blocks/mcp/tools/call.block.js`
  (block `mcp.tools.call`) should group tools by intent before delegating to
  small private blocks.
- For tools that only prepare MCP arguments, call one Flow capability and wrap
  the response, prefer a composite block using `mcp.tool.run` instead of a
  custom JavaScript wrapper.
- Use `/convertigo/api/flow-mcp` as the HTTP entry point. Do not use
  `/convertigo/api/mcp`, which belongs to the legacy Convertigo MCP project.
- Require the same HS256 bearer JWT as the legacy MCP for every external
  `/api/flow-mcp` request. Keep the shared token state under
  `<workspace>/jwt/mcp`, return durable raw tokens only once, and never trace
  or expose managed token secrets.
- Keep token administration operations private from `tools/list` and require
  the current `WEB_ADMIN` session. Integrated agents receive only an opaque
  server-memory handle; Agent Bridge injects the common
  `CONVERTIGO_MCP_TOKEN` into the child process.
- For Git work on Flow library projects, treat
  `/Users/nicolas/git/c8oprj-lib-flow-process` and
  `/Users/nicolas/git/c8oprj-lib-flow-k8s` as canonical. The Studio runtime
  workspace may expose them as `lib_flow_process` and `lib_flow_k8s` symlinks;
  continue using those project names in MCP calls.
- Keep generated or one-off helper blocks private when they are not intended for
  projects referencing this library.
- Use `input.*` for executable/block inputs and `local.*` for scratch state in
  all new FlowScript and generated Flow models. In backend FlowScript `flow.*`
  and `props.*` are not expression scopes (Flow Svelte reads component inputs
  with `@props.<name>`); JS hooks/raw implementations can inspect the raw node
  with `ctx.props(node)`.
- Block and component icons are SVG project sources under
  `_flow/icons/iconify/<set>/` with the set's `LICENSE.json`; never commit PNG
  renderings and never put icons under `_flow/blocks`.
- Guides in `_flow/resources/guide/*.md` start with an H1 and a one-line
  summary (it becomes the `resources/list` description), name only tools
  advertised by `tools/list` (`_flow/blocks/mcp/tools/available.block.js`
  `PUBLIC_TOOLS`), and show only verified FlowScript v2 / Flow Svelte
  examples. `tests/mcp-resources-contract.js` checks these rules.

Authoring loop for a blank agent context:

```text
resources/list, then resources/read flow://guide/start (guides are served whole)
resources/read flow://guide/authoring before writing FlowScript
resources/read flow://guide/samples, then code-get sample_blocks_flow_and_rhino, sample_list_filter_sort_map, sample_json_object_output, block:sample.formatGreeting / block:sample.sha256 only when syntax is unclear
resources/read flow://guide/rhino-block-api before writing Rhino blocks
tools/list
write the first FlowScript draft with code-set before broad discovery: block.name({ key: value }) with one object argument, one statement per line, captures as local.x = block({...})
code-run (code-analyze for scopes) to let compiler/runtime diagnostics guide the next edit
if a high-level domain block is missing, create an explicit project-local mock with flow-block-mock and typed properties/outputs; do not hide the feature in Rhino
if code-run returns unsaved:true or workingCopy:true, call code-promote before stopping
flow-search only after the first draft when a block, pattern or schema is still unknown
code-rg, then the smallest code-patch with the returned revision, for maintenance of Flows, project blocks and Flow Svelte sources (kind:"source" for project-wide frontend rg)
flow-output-schema before wiring downstream nodes; detail:full to compare declared/static/learned sources; action:adopt|remove|reset for the _flow.outputs contract and learned samples
flow-node-output-schema for one HTTP/exec/parser/list node; action:adopt to keep a verified node schema, action:remove to drop a stale one
flow-schema-reset only for broader stale learned-schema cleanup
flow-cache-clear once after lib_flow_engine or frontbuilder code changed outside the Studio; otherwise caches follow source fingerprints
code-promote once executable Flow behavior is clean; never promote project-local blocks (code-set/code-patch save them)
flow-catalog / flow-block-get only when diagnostics and samples are insufficient
authoring-tree for structure; authoring-palette with the parentPath returned by authoring-tree when code diagnostics cannot resolve a reusable frontend capability; execute items[].apply unchanged
flow-project-reference only for explicit project-reference maintenance
for Studio-visible frontend writes, pass reveal:true so the virtual tree is reconciled and the modified source node is selected
after the first frontend code-get of every turn, call frontend-svelte-action with actionId dev.ensure and wait:false before mutation
import local or generated images with frontend-svelte-asset-import and reuse the returned resources/... URL unchanged
before Playwright, call frontend-svelte-action with actionId dev.open and require browserControlReady:true
code-set with block:"ns.name" and the complete _meta + implementation only when reusable vocabulary is needed
flow-resource-search / flow-resource-get / flow-resource-patch for project types, editors, libraries, fragments and other resources
```

For custom block outputs, prefer a real schema over `unknown`. Use static
`outputs` for stable result shapes. If the shape depends on an input path or
expression, add a `hooks.file` analyzer that calls helpers such as
`ctx.addSameSchema`, `ctx.addArraySchema`, `ctx.schemaForExpression`,
`ctx.schemaForPath`, `ctx.itemSchema`/`ctx.itemSchemaFor`, and finally
`ctx.addSchema(outPath, schema)`. For item-scoped properties, declare
`current:"item"` and `sourceProperty:"items"` so `code-analyze` and pickers
expose typed `current.*` paths.

Prefer editing Flow sources (`_flow/flows/<Name>.flow.js`) over adding custom
blocks. Prefer project-local
custom blocks over changing the shared core library. A Rhino block must be a
small primitive, not a hidden backend feature. Use FlowScript and standard
blocks for HTTP, requestables, list/JSON transforms and response mapping.
Positional JavaScript-style calls such as `http.get(url)`,
`list.sort(items, by)`, or `requestable.call(".GetFeed")` are invalid in
FlowScript even when a compiler diagnostic can suggest the canonical object
form.
For array projections, write one statement per line:

```javascript
local.mapped = list.map({
  items: input.items,
  select: { field: current.field },
})
result.mapped = local.mapped
```

Do not hard-code fixed indexes for dynamic lists. Core and shared blocks are
read-only through MCP: read one with `code-get({ project, block })` and write
a project-local variant under a new name with `code-set`.

For external HTTP APIs, prefer a reusable typed FlowScript sub-block instead of
inlining provider details in the main executable Flow. The sub-block should
expose simple `input.*` properties such as `city`, `latitude`, `longitude`,
`apiKey` or `limit`, call `http.get` / `http.request`, and return a small typed
object. The executable Flow should call that block and shape `result.*`.
Store structural service constants such as base URLs, API paths, namespaces,
tokens and timeouts in project or Flow `config.*`; do not hard-code them in
low-level block code.

When designing top-down, it is acceptable to call a missing domain block in the
first FlowScript draft. Once diagnostics prove it is missing, create it with
`flow-block-mock` so the parent Flow remains executable and the missing
implementation is visible through `mock:true`, TODO source and MCP warnings.
Do not consider a parent Flow complete while it still calls a mock block. Use
`flow-block-mock-list` to audit remaining mocks before reporting completion.

When FlowScript reads `input.foo`, treat `foo` as a request input that should be
visible to users and tests. If Flow MCP tools report `inputVariables`, use it as
the list of request variables/test inputs to create or document.
Prefer explicit top-level `const _flow = { inputs: {...}, tests: {...} }` when
the Flow has human-facing request variables, comments/defaults, or reusable test
inputs. `code-*` tools report this contract as `inputDefinitions`,
`inputVariables`, and `testCases`.
Executable Flows may also declare optional `_flow.outputs`. When present, it is
the explicit result contract used by `flow-output-schema`, requestable schemas
and value pickers. When absent, static analysis plus optional learned schemas
infer the result and remain dynamic as new `result.*` writes are added. Ordinary
`code-run` or requestable execution does not learn the final Flow result unless
an explicit record/learn flag is used. Use `flow-output-schema` with
`action:"adopt"` and `source:"static"|"learned"` after a verified run and
`detail:"full"` review to write `_flow.outputs`; use `action:"remove"` to
delete it.
Use `flow-output-schema({ project, qname, detail:"full" })` to compare
declared/static/learned/effective sources and warnings before adopting. For a
single node, use `flow-node-output-schema({ project, qname, nodeId })`; this is
especially useful after an HTTP, exec or parser node learned a richer runtime
schema than its generic block declaration. If `nodeId` is ambiguous, reuse the
JSON Pointer `path` returned by `flow-search` as `nodePointer`.
When `learned` contains fields no longer produced by current code, or `unknown`
array items from old/empty runtime samples, treat it as stale instead of
adopting it. Use `flow-schema-reset({ project, flowName })` for a stale
Flow-level learned schema, and `flow-node-output-schema action:"remove"` for a
single stale producer.

When maintaining an existing FlowScript block, prefer
`code-rg`, `code-get`, then `code-patch` with
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

Prefer targeted edits over rewriting a whole Flow source. Use:

- `flow-search` to get `flowQName`, `nodeId` and a compact context;
- `code-rg` then `code-patch` for existing FlowScript;
- `code-set` to update the FlowScript working copy before run/promote;
- `authoring-tree` for a compact structural view.

Create project property types (`_flow/types/*.type.yaml`) only for real
project vocabulary, with `flow-resource-patch`. Do not create custom types
when a core type such as `text`, `path`, `value`, `template`, `expression`,
`literal` or `requestable` already fits.

Prefer `flow-search` before broad reads. Multi-word queries match unordered
tokens, so a query like `GetFeed requestable call` should find a node whose
requestable is `AAAProject.GetFeed` and whose block is `requestable.call`. It returns compact matches with
`flowQName`, `nodeId`, canonical JSON Pointer `path`, `summary`, `snippet`, and
optional `context`. Start with `doc:true,hints:true`, then pass
`doc:false,hints:false` for repeated calls.

MCP resources mirror this guide for clients that do not read repo files.
`resources/list` returns the twelve guides: `flow://guide/start`,
`flow://guide/authoring`, `flow://guide/samples`,
`flow://guide/search-and-edit`, `flow://guide/custom-blocks`,
`flow://guide/rhino-block-api`, `flow://guide/portable-blocks`,
`flow://guide/fullstack-paperboard`, `flow://guide/frontend-svelte`,
`flow://guide/frontend-svelte-routing`, `flow://guide/fullsync` and
`flow://guide/tracing`. The skills `flow://skills/convertigo-flow-mcp/SKILL`,
`flow://skills/convertigo-flow-backend/SKILL` and
`flow://skills/convertigo-flow-frontend-svelte/SKILL` are not listed but are
readable with `resources/read`. `resources/read` returns every resource
whole.

Prefer demonstration by example over broad theory for blank agents. Keep sample
Flows and sample blocks small, executable/readable through MCP, and commented
only when the comment teaches a DSL rule, for example:
`// Only call Flow blocks with one object containing named parameters.`
Rhino sample blocks should start with:
`// Use Rhino 1.9.0 features: https://mozilla.github.io/rhino/compat/engines.html`.
