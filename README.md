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

## Stable results

Some answers stay the same while nothing they are computed from changes:
`tools/list` (relayed tools included), the guides and skills (`resources/read`,
and `flow-resource-get` of a `flow://guide|lib|skills` uri), `flow-catalog` and
`authoring-palette`. Their result is kept as JSON text for every runtime of the
server and answered again in the envelope of the new request, with its id
(stable results in `_flow/lib/mcp.js`, block `mcp.stable` for `tools/list` and
`resources/read`, `mcp.tool.run` for the two tools). Some agent hosts (Vibe)
call `tools/list` before each tool call: the relayed catalog alone costs a
round trip to the legacy endpoint.

- Only after authentication: every key starts with the caller
  `jwt.guardRequest` records on the HTTP request (kind, scope, user and token
  id; never the token), a server-side attribute a client cannot send. A refused
  request, or an expired leased token let through for its handshake, is neither
  answered from the store nor kept.
- The key holds what the result depends on: the request headers it may read
  (agent provider and profile, guidance version, user agent, host...), the
  revision of the block catalog the request runs with
  (`blocks.__flowCatalogFingerprint`), this library and the cache generation of
  the server. `tools/list` adds the relayed headers (the bearer included), the
  legacy project as loaded and the feedback consent inputs that list
  `report-create` (`mcp.report.mode`, `assistant.feedback.policy`,
  `agents/feedback/settings.json`, the server feedback key); a guide adds the
  hash of its content; the two tools add their prepared arguments (target
  project, working copies, tag context) and the data revision of the projects.
- Invalidation: a revision that changes is another key; any `tools/call` of a
  tool that may write (anything but the read tools of `STABLE_READ_TOOLS`)
  drops the kept tool answers; `flow-cache-clear` drops everything. A
  time-to-live bounds what no revision tells (files changed outside Convertigo,
  the legacy endpoint): 2 min for `tools/list`, 30 s for the tools, 10 min for
  a guide. At most 256 entries and 8M characters, the oldest leaving first.
- Never kept: errors, partial answers (`partial`, `responseBudget`), an answer
  carrying an `operatorNote`, a call with its own `answerBefore`, and every
  other method or tool (mutations, runs, logs).

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
flow-resource-search / flow-resource-get / flow-resource-patch for project types, editors, libraries, fragments, resources and Java sources (libs/src)
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

When omitted, reading tools operate on `lib_flow_mcp` itself. Agents should
pass `project` for application work, for example `AAAProject`. Writing tools
require it and refuse to write into `lib_flow_mcp`, the project serving the
endpoint (`projectDir` stays available for standalone tests).

## Relayed Convertigo MCP tools

The endpoint also lists and calls a fixed set of Convertigo MCP
(`lib_ConvertigoMCP`) tools that apply to Flow projects: scheduling,
`requestable-execute` (with `authenticatedUser`), logs, symbols, marketplace,
security audit, image description, documentation search and read-only
database object tools (`LEGACY_RELAY_TOOLS` in `_flow/lib/mcp.js`). Calls go
back to the server's `/api/mcp` over HTTP with the client's token and Convertigo
headers; the two endpoints share their tokens. Without `lib_ConvertigoMCP` the
list only holds the Flow tools. `-Dconvertigo.flow.mcp.legacyRelay=false`
disables the relay.

`report-create` is also relayed when the legacy catalog advertises it. The
legacy endpoint owns consent, validation and feedback storage; the relay never
enables reporting or sends feedback externally. A `tools/list` is kept for its
caller, its relayed headers and the feedback consent inputs (see Stable
results): a consent change, another caller or another provider is listed again
from the legacy endpoint at the next `tools/list`. Each relayed `tools/call`
remains one HTTP hop.
The relay asks the legacy endpoint for `jsonOnly=true` answers, which carry
`structuredContent` only on success; it adds the `content` summary a
`CallToolResult` requires, or MCP clients that validate it (the MCP Python SDK
of Vibe) reject the answer as a transport failure.
On a server, a shared bearer alone does not establish the No Code user identity
required by Tigo feedback. If the legacy endpoint omits the tool, it stays absent;
`nocode-report-create` is not exposed through this endpoint.

`browser-verify` and `subagent-run` hand browser proofs to a vision sub-agent
of the legacy endpoint, which drives the Studio viewer of the conversation (its
`X-Convertigo-Viewer-Debug-Port` and `X-Convertigo-Conversation-Id` headers are
relayed). A long run answers `status:"running"` with a `runId` (a
`verificationId` for `browser-verify`), and the same tool called with it alone
waits again; the relayed text content says so, since some clients show the text
alone. `subagent-run` is offered with its `verifier` profile and with the
`constructor` of the Flow pack, for one side of a parallel build
(`flow://guide/fullstack-paperboard`): the relay requires `inputs.project` and
`inputs.scope` (`backend` or `frontend`) and always forwards `inputs.pack:"flow"`,
so lib_ConvertigoMCP runs that Vibe session with the `convertigo-flow` server
alone (the same token and headers), one constructor per scope and project. A
constructor without scope (`SUBAGENT_SCOPE_REQUIRED`), started from a
constructor session (`SUBAGENT_NESTED`) or another profile
(`SUBAGENT_PROFILE_NOT_RELAYED`) is refused before any hop. A constructor
session sends `X-Convertigo-Subagent-Scope`: the `tools/call` dispatcher refuses
its writes to the other side and the main agent's operations (`project-save`,
browser proofs, sub-agents, `docs/generated/PROGRESS.md`, bootstrap and removal)
with `SUBAGENT_SCOPE` (`subagentScopeRefusal`); without that header nothing
changes.

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

`flow-block-get` is the contract of a block for an agent, which must never read
library sources to learn it: its compact answer keeps the `longDescription` of
the block (errors, examples, guide), which the compact descriptor of
lib_flow_engine leaves out, and a property named `password` or `token` in a
contract stays a readable descriptor (its literal sample values hidden, a
`${...}` symbol default shown). A `code-check`/`code-set` diagnostic on a block
call (unknown property, type mismatch, call signature, unknown block with a
candidate) carries `contract`, the `flow-block-get` call to make, also appended
to its `next`.

For iterative maintenance of other project resources, patch the text read, or
send it whole with `content` and `baseHash`:

```text
flow-resource-search -> flow-resource-get -> flow-resource-patch(baseHash, unified diff or whole content)
```

The patch API is limited to Flow resources: `_flow/engine.yaml`,
`_flow/blocks/**/*.{block,hooks}.js`, `_flow/fragments/**/*.fragment.yaml`,
`_flow/lib/**/*.js`, `_flow/types/**/*.{type.yaml,js}`,
`_flow/types/editors/**/*.{html,css,js}`,
`_flow/frontbuilder/**/*.{flow.svelte,flow.css,uiblock.json}`,
`_flow/resources/**` and public `resources/**` text files
(`md`, `txt`, `json`, `xml`, `yaml`). It validates block/type/library resources
and parses fragment YAML by default.

`flow-resource-patch` applies a unified patch itself (`_flow/lib/patch.js`):
hunks in order, each located in the text read at its numbered line, then where
its lines match once (numbers off, or counted on the new file), `--- a/` /
`+++ b/` headers, code fences and empty context lines that lost their space
accepted, unchanged lines kept as the resource has them when only trailing
spaces differ. It refuses an ambiguous match (`PATCH_CONTEXT_AMBIGUOUS`), a
mismatch with the expected and actual lines around (`PATCH_CONTEXT_MISMATCH`),
and an insertion without context whose two line numbers disagree
(`PATCH_INSERT_AMBIGUOUS`): lib_flow_engine alone inserted `@@ -N,0 +N,1 @@`
after line N, outside the parent block the agent meant. The computed text then
goes to lib_flow_engine as one replacement hunk with the hash read, so its path
rules, validation and working copy guard still apply and the file is written
line for line; the answer gives `hash`, the next `baseHash`, and
`appliedHunks` (line, match, offset).

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
- `flow://guide/crud`

The skills `flow://skills/convertigo-flow-mcp/SKILL`,
`flow://skills/convertigo-flow-backend/SKILL` and
`flow://skills/convertigo-flow-frontend-svelte/SKILL` are not listed but are
readable with `resources/read`.

A client without `resources/read` (Vibe lists MCP tools only) reads the same
resources with `flow-resource-get` and their `uri`, its text in
`structuredContent.text` (`mcpResourceThroughTool` in
`_flow/blocks/mcp/tools/call.block.js`). A `flow://guide/`, `flow://lib/` or
`flow://skills/` uri needs no project: without one the MCP resource answers at
once, so an agent reads the start guide before creating its project. With a
project, a project resource of that uri keeps precedence, and the MCP resource
answers when the project has none or does not answer (a project not created
yet). A project resource (`path`, or another uri) still requires `project`.

ACE experience is carried by each library in `_flow/resources/ace/<drawer>.md`.
The project receives `lib_flow_engine`'s `common` drawer and the drawers of its
own and referenced libraries (including transitive references), never the
drawers of unrelated workspace projects. No production advice is bundled yet;
the offline fixtures use only orders and customers. Files follow the ACE
playbook line format, with optional indented trigger declarations:

```text
## STRATEGIES & INSIGHTS
[sql-00001] helpful=8 harmful=1 :: Check the orders key before writing.
    @codes: ORDERS_KEY_MISSING, ORDERS_KEY_INVALID
    @blocks: sql.table, data.write, sql.*
    A complete snippet may continue on indented lines.
```

At the `tools/call` boundary, the private `mcp.experience` block adds advice
after normal result projection and stable caching. Backend `code-set`,
`code-patch` and `code-check` detect block calls; patch/check inspect the
resulting saved source or Studio working copy. Comments and string literals
do not count. Flow Svelte gestures select `front`, scheduler calls select
`jobs`, and CRUD calls select `sql` and `front`. The first gesture also selects
`common`. A drawer is pushed once per session; entries rank by
`helpful - harmful`. Explicit `@blocks` restrict an entry to matching calls
and can map a namespace to a differently named drawer. A namespace trigger
also matches its children; `*` matches any suffix.

Matching diagnostic/error codes take priority, with at most two entries per
response. An entry can return after more than ten intervening tool-call
positions (call number difference greater than ten). Successful business
results with a field named `code` do not count as diagnostics. Error pushes
do not consume a drawer's first gesture. Already delivered entries are not
repeated by that drawer's first gesture.

Both channels carry the same advice: `structuredContent.experience` is
`{reason, drawer, entries:[{id,text}]}`, and a final text content item starts
with `[Flow ACE: ...]`. Reasons are `first-domain` and `error`; `drawer` is a
comma-separated string when a call selects several drawers. Trigger metadata
is omitted from advice. The total serialized additions across both channels
are limited to 2,000 characters, approximately 500 tokens using the prototype's
characters/4 estimate. Complete entries that do not fit are skipped, including
oversize snippets; the full drawer remains readable on demand.

Set the global symbol `flow.mcp.experience` or Flow configuration
`config.mcp.experience` to `off`, `errors-only`, or `on` (default). The symbol
takes precedence. Session identity uses the authenticated caller plus
`X-Convertigo-Conversation-Id` (Bridge), `Mcp-Session-Id`,
`config.mcp.experienceSession`, or the HTTP session, in that order, and the
subagent run when present. With none of these identifiers, calls share the
authenticated caller's session; stateless clients sharing one token should
send a distinct conversation/session identifier. Internal callers can use
`config.mcp.experienceSession` too. State is shared across Flow runtimes in
the servlet context, expires after 24 hours of inactivity, and is limited to
1,024 sessions. Restarting the JVM resets it.

Each push appends session hash, tool, reason, ids, library provenance, time
and estimated added tokens to `<workspace>/ace/experience-push.jsonl`.
No tool arguments or raw credentials are logged. Standalone tests write this
under the MCP checkout's `_private/ace/`. Advice/log failures never change
the tool outcome. Drawers and standalone reference declarations are read
once into a shared cache, reloaded on modification time (including subsecond
precision), size or file identity changes. A file replacement preserving all
of these attributes is outside that invalidation contract. The cache is
bounded to 512 files.

`resources/list` additionally exposes `flow://ace` (drawers, entry counts,
code/block triggers) and `flow://ace/<library>/<drawer>` (whole drawer).
These resources remain available when pushing is off and can also be read
with `flow-resource-get`. The resource index covers loaded workspace
libraries; pushes always use the target project's reference closure. A
scheduler call without a target project can only draw on core `common`.
Clients ignoring structured content still receive advice in text; clients
discarding or compacting early tool results can lose either channel.

Offline verification, with the Convertigo dependency/engine jars on the
classpath and no running server or container:

```sh
CONVERTIGO_TEST_CLASSPATH='/path/to/convertigo/lib/*' node tests/run-rhino.cjs tests/experience-push.js /path/to/lib_flow_engine/_flow .
CONVERTIGO_TEST_CLASSPATH='/path/to/convertigo/lib/*' node tests/run-rhino.cjs tests/experience-cost.js /path/to/lib_flow_engine/_flow .
```

The cost test alternates `off`/`on`, measures the real block and public
router, verifies zero unchanged-drawer reads, and measures first pushes
including the journal write. It prints timing/token estimates and keeps its
neutral fixture and raw measurements under `_private/`.

The local CRUD authoring tool accepts legacy-shaped entity models with `flow-crud-upsert`.
The model is stored in `_flow/data/model.yaml`; preview returns the required `planHash`
for application. Generated Flows and resources belong to that model.
`flow-crud-proof` verifies the applied model, generated artifacts and read-only SQL plan.
See `_flow/resources/data/model.schema.json` and `tests/fixtures/legacy-crud`.
The preview lists the references the generated code needs and apply adds them;
a failed SQL plan returns its underlying diagnostics (code, line, block, fix).
`flow://guide/crud` is the agent guide: the model format, the preview/apply/proof
loop and how business Flows, pages (`ui.navigation`), exports and jobs combine
with the generated parts.

Pages use the Svelte 0.2.6 AppShell, PageHeader, DataTable, FormSection,
StatCard and StatusBadge components; application styling uses theme.flow.css.
Tables request server sorting/pagination. Forms preserve exact decimal/int64 text,
wait for the initial read and derive their actions from server permissions.

Optional common model extensions are `permissions` per entity/operation,
`revision` (absent means native unversioned SQL writes), `fields[].enum` (server
validation; labels in `ui.fieldOptions`), `indexes`, `database.schemaPolicy`
(`managed` or schema-observing `observe`) and import `provenance`.
`generate` per entity (`full`, or `data`: no pages nor generic writes), root
`ui.generate: none`, and the owner form of `rowPolicy` (server-side owner filter,
other forms refused) shape what is generated. Index declarations are preserved
but block application until their generic implementation exists. SQL `TIMESTAMP` maps to portable
`timestamp`: a local date-time without timezone, to the millisecond, in JSON
`yyyy-MM-dd'T'HH:mm:ss[.SSS]` (canonical reads include `.SSS`). Offset values and
`TIMESTAMP WITH TIME ZONE` are explicitly refused. It is never reduced to DATE.
The legacy normalizer has no automatic timestamp notation. The optional common
extension `entities[].fields[].auto` is `create` (creation
only) or `update` (creation and every update). It applies only to TIMESTAMP;
the SQL provider fills it from the server clock and refuses client values.
Automatic fields are read-only in generated forms. Manual fields use the shared
Input's native `datetime-local` control with `step=0.001`; Text and the existing
DataTable `format: "datetime"` localize display without application CSS.
Inclusive interval filters use `{field:"closed_at",op:"between",value:[from,to]}`;
sorting remains server-side. Required additive columns need a literal typed
`default` to backfill existing rows; `auto` alone is not a migration default.
Only HSQLDB is qualified through the complete HTTP/browser CRUD application.
Foreign keys can be added after columns through Querydsl; destructive schema
changes remain refused. Applying files, Flows and DDL has no global transaction;
the model-owned manifest journals pending application and supports resumption.
