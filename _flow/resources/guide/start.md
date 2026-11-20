# Flow MCP Start

Start here: which guide to read next, the source contract in five rules and the default backend loop; project rules are in `flow://guide/start/rules`.

For browser verification, `browser_wait_for.time` is in **seconds**, at most 30: use `2`, never `2000`.

## Which guide next

For persisted business data with roles, entities are the simplest compliant option: a short model and a few lines of access policy
replace hand-written SQL schemas, migrations and access checks. "Simplest" or "minimal" is not an explicit SQL request.
Direct SQL and generated CRUD require one.

| Task | Read |
| --- | --- |
| Backend FlowScript syntax, run, promote, schemas | `flow://guide/authoring`; collections and loops: `flow://guide/authoring/collections` |
| Unclear syntax: two real samples | `flow://guide/samples` |
| Project blocks, block contract, defaults, icons | `flow://guide/custom-blocks` |
| One pure block for backend and frontend | `flow://guide/portable-blocks` |
| Any persisted business data with roles: add the `lib_flow_entity` project reference | `flow://guide/entities`, then `flow://guide/multipage-entities`. Read `flow://guide/entities/widgets` before writing pages; `flow://guide/entities/widgets/stat` covers dashboards; `flow://guide/entities/widgets/view` covers records. |
| Backend plus Svelte application, parallel build | `flow://guide/fullstack-paperboard/contract`, then `flow://guide/fullstack-paperboard/path` |
| No persisted business data, or an explicit request for direct SQL | `flow://guide/multipage-roles/data` |
| Svelte-only frontend | `flow://guide/frontend-svelte/loop` |
| Dynamic segments, layouts, route groups | `flow://guide/frontend-svelte/routing` |
| FullSync server DBOs and client actions | `flow://guide/fullsync` |
| Locate and patch existing code | `flow://guide/search-and-edit` |
| Tool hygiene, design rules (CORS, secrets, config), drafts and Save, project layout, demo login, switches, friction reports | `flow://guide/start/rules/tools`; secrets/config: `flow://guide/start/rules/design`; Save: `flow://guide/start/rules/workspace` |

An imposed HTTP contract (Flow names, error codes, JSON keys) keeps
entities: see Your own HTTP contract over entities in `flow://guide/entities`.

Accounts, sign-in and roles: reference `lib_UserManager` and read
`flow://lib/lib_UserManager/user-manager`; never a password check of your own.

## Source contract in five rules

1. Every block call is `block.name({ key: value })` with one object argument.
   Positional calls such as `http.get(url)` or `requestable.call(".GetFeed")`
   are invalid; diagnostics show the accepted keys.
2. Capture a block result in a declaration: `const feed = requestable.call({
   requestable: ".GetFeed" })`. Write one statement per line; never join two
   Flow statements with `;` on one line.
3. Names are implicit; a JavaScript label names an instruction explicitly.
   `$$id` remains readable. `$$comment`, `$$disabled`, `$$out` and slots such as `$$then` are
   engine attributes. Plain names (`id`, `disabled`, `out`, `comment`) are
   ordinary business properties.
4. Source headers hold static literals only: `_flow` describes an executable
   Flow, a Page, a Layout or a Flow component; `_meta` describes a block or a
   Svelte UI block. Backend Flow sources declare `sourceVersion: 3` (FlowScript
   v3, JavaScript); every `.flow.svelte` file must declare `sourceVersion: 2`.
5. `input.*` holds Flow or block inputs, `const`/`let` locals (stored in
   `local.*`) scratch data, `return { … }` or `result.*` the response,
   `config.*` configuration. In backend FlowScript `flow` only offers
   `flow.import`, `flow.default` and the call forms, and `props.*` is not an
   expression scope (in Flow Svelte, `@props.<name>` reads component inputs).

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
   An application from a specification first writes its acceptance table
   (criterion, path, seen), then fills it on the screen.
5. Use `flow-search` only after the first draft, when a block or pattern is
   still unknown (`GetFeed requestable call sort`); `kind:"sample"` matches
   are private `sample_*` Flows.
6. Use `flow-requestable-list` / `flow-requestable-schema` only when a legacy
   sequence or transaction shape is needed.
