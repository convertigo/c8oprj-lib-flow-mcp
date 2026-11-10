# Flow MCP Start

Start here: which guide to read next, the source contract in five rules and the default backend loop; project rules are in `flow://guide/start-rules`.

> **JavaScript → FlowScript** (before the first `code-set`; details in `flow://guide/authoring-data`)
> `for (const item of items)` → `forEach({ items: input.items, $$nodes() { ... } })`; use `current` inside.
> `try { JSON.parse(x) }` → `local.parsed = json.safeParse({ text: input.text })`; check `local.parsed.ok`, then use `.value`.
> `/re/.test(x)` → `local.match = text.match({ text: input.code, pattern: "re" })`; check `local.match.matched`.
> `arr.push(x)` → declare `json.array({ path: "local.arr", itemType: { type: "number" } })` (items' type), then `json.push({ path: "local.arr", value: input.value })`.
> `arr.map/filter/some(cb)` → `list.map({ items: input.items, select: { id: current.id } })` / `list.filter({ items: input.items, where: current.ok })`; for `some`, test the filtered list's `.length`.
> `JSON.*` calls → catalogued `json.*` blocks; for example `JSON.stringify(x)` → `json.stringify({ value: input.value })`.
> `if (block.name({ ... }))` → assign `local.value = block.name({ ... })` first, then test `if (local.value)`.

## Which guide next

For persisted business data with roles, entities are the simplest compliant option: a short model and a few lines of access policy
replace hand-written SQL schemas, migrations and access checks. "Simplest" or "minimal" is not an explicit SQL request.
Direct SQL and generated CRUD require one.

| Task | Read |
| --- | --- |
| Backend FlowScript syntax, run, promote, schemas | `flow://guide/authoring` (15.8 KB) |
| Unclear syntax: two real samples | `flow://guide/samples` (2.1 KB) |
| Project blocks, block contract, defaults, icons | `flow://guide/custom-blocks` (8.5 KB) |
| Java/JVM primitive in Rhino | `flow://guide/rhino-block-api` (4.0 KB) |
| One pure block for backend and frontend | `flow://guide/portable-blocks` (4.4 KB) |
| Any persisted business data with roles: add the `lib_flow_entity` project reference | `flow://guide/entities` (13.2 KB), then `flow://guide/multipage-entities` (11.9 KB) |
| Backend plus Svelte application, parallel build | `flow://guide/fullstack-paperboard` (13.3 KB) |
| No persisted business data, or an explicit request for direct SQL | `flow://guide/multipage-roles` (14.1 KB) |
| Svelte-only frontend | `flow://guide/frontend-svelte` (7.9 KB) |
| Dynamic segments, layouts, route groups | `flow://guide/frontend-svelte-routing` (5.8 KB) |
| FullSync server DBOs and client actions | `flow://guide/fullsync` (7.5 KB) |
| Locate and patch existing code | `flow://guide/search-and-edit` (9.5 KB) |
| MCP JSONL tracing | `flow://guide/tracing` (1.1 KB) |
| Ordered tags and named project configurations | `flow://guide/tags` (4.4 KB) |
| Tool hygiene (cleanup, removal, metadata), design rules (CORS, secrets, config), drafts and Save, project layout, demo login and add-ons, project switches, friction reports | `flow://guide/start-rules` (12.0 KB) |

An imposed HTTP contract (Flow names, error codes, JSON keys) keeps
entities: see Your own HTTP contract over entities in `flow://guide/entities`.

Resource reading details: `flow://guide/start-rules`.

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
   When one Flow calls another with `requestable.call`, write both, promote the
   called Flow first, then run the caller with `code-run`.
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
