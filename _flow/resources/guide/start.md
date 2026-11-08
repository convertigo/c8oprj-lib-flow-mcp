# Flow MCP Start

Start here: which guide to read next, the source contract in five rules and the default backend loop; project rules are in `flow://guide/start-rules`.

## Which guide next

For persisted business data with roles, entities are the simplest compliant option: a short model and a few lines of access policy
replace hand-written SQL schemas, migrations and access checks. "Simplest" or "minimal" is not an explicit SQL request.
Direct SQL and generated CRUD require one.

| Task | Read |
| --- | --- |
| Backend FlowScript syntax, run, promote, schemas | `flow://guide/authoring` (15.6 KB) |
| Unclear syntax: two real samples | `flow://guide/samples` (2.1 KB) |
| Project blocks, block contract, defaults, icons | `flow://guide/custom-blocks` (8.5 KB) |
| Java/JVM primitive in Rhino | `flow://guide/rhino-block-api` (4.0 KB) |
| One pure block for backend and frontend | `flow://guide/portable-blocks` (4.4 KB) |
| Any persisted business data with roles: add the `lib_flow_entity` project reference | `flow://guide/entities` (11.6 KB), then `flow://guide/multipage-entities` (11.7 KB) |
| Backend plus Svelte application, parallel build | `flow://guide/fullstack-paperboard` (13.3 KB) |
| No persisted business data, or an explicit request for direct SQL | `flow://guide/multipage-roles` (14.1 KB) |
| Svelte-only frontend | `flow://guide/frontend-svelte` (7.6 KB) |
| Dynamic segments, layouts, route groups | `flow://guide/frontend-svelte-routing` (5.3 KB) |
| FullSync server DBOs and client actions | `flow://guide/fullsync` (7.5 KB) |
| Locate and patch existing code | `flow://guide/search-and-edit` (9.5 KB) |
| MCP JSONL tracing | `flow://guide/tracing` (1.1 KB) |
| Ordered tags and named project configurations | `flow://guide/tags` (4.4 KB) |
| Tool hygiene (cleanup, removal, metadata), design rules (CORS, secrets, config), drafts and Save, project layout, demo login and add-ons, project switches, friction reports | `flow://guide/start-rules` (10.8 KB) |

An imposed HTTP contract (Flow names, error codes, JSON keys) keeps
entities: see Your own HTTP contract over entities in `flow://guide/entities`.

Read each guide once. Use `resources/read`, or
`flow-resource-get({uri,format:"text"})` for guide/library/skill URIs without a
project. In Vibe `run_typescript`, print the returned Markdown with
`console.log(await tools.mcp_convertigo_flow.flow_resource_get({uri,format:"text"}))`.
Returning or JSON-stringifying it escapes newlines. Each guide is short enough to
be read whole; its size follows its name. Structured mode keeps the document in `text`
(under `structuredContent` in an MCP envelope).

## Source contract in five rules

1. Every block call is `block.name({ key: value })` with one object argument.
   Positional calls such as `http.get(url)` or `requestable.call(".GetFeed")`
   are invalid; diagnostics show the accepted keys.
2. Capture a block result with an assignment: `local.feed = requestable.call({
   requestable: ".GetFeed" })`. Write one statement per line; never join two
   Flow statements with `;` on one line.
3. Names are implicit; a JavaScript label names an instruction explicitly.
   `$$id` remains readable. `$$comment`, `$$disabled`, `$$out` and slots such as `$$then` are
   engine attributes. Plain names (`id`, `disabled`, `out`, `comment`) are
   ordinary business properties.
4. Source headers hold static literals only: `_flow` describes an executable
   Flow, a Page, a Layout or a Flow component; `_meta` describes a block or a
   Svelte UI block. Backend sources default to `sourceVersion: 2`; every
   `.flow.svelte` file must declare `sourceVersion: 2`.
5. `input.*` holds Flow or block inputs, `local.*` scratch data, `result.*`
   the response, `config.*` configuration. In backend FlowScript `flow.*` and
   `props.*` are not expression scopes (in Flow Svelte, `@props.<name>` reads
   component inputs).

`flow://guide/authoring` gives the full backend dialect with examples.

## Default backend loop

1. Draft compact FlowScript with `code-set` before catalog browsing or copying
   Flows. Let `code-set` / `code-run` diagnostics name blocks and properties;
   read at most two samples if syntax is unclear.
2. If the requested `project`, `qname` or `block` is not accessible through
   Flow MCP, stop and report that blocker. Never fall back to another project
   or to legacy MCP discovery.
3. `code-patch`, `code-run`, then `code-promote` when clean. `unsaved:true` or
   `workingCopy:true` means promote before stopping. `code-status` shows
   drafts; `code-discard` cancels them.
4. Stop after a successful run plus promotion unless deployed HTTP validation
   was requested. Do not call `flow-test` when `code-run` already proved it.
5. Use `flow-search` only after the first draft, when a block or pattern is
   still unknown (`GetFeed requestable call sort`); `kind:"sample"` matches
   are private `sample_*` Flows.
6. Use `flow-requestable-list` / `flow-requestable-schema` only when a legacy
   sequence or transaction shape is needed.

Address executable Flows with `qname:"Project.Flow"`, project blocks with
`block:"ns.name"`, and Flow Svelte or CSS sources with `sourceFile`. Never
encode a block in `qname`.

## Frontend entry

Choose the task guide from the table above before coding. For Svelte, use `code-get` / `code-set` on `sourceFile`, then
`authoring-tree`, `authoring-palette` and `authoring-mutate` as needed. Run the
viewer through `frontend-svelte-action`. Pages live under
`_flow/frontbuilder/svelte/model/<App>/src/routes`; never edit generated Svelte.
