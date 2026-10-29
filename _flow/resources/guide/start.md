# Flow MCP Start

Start here: the default Flow authoring route, the source contract, the project layout and which guide to read next.

## Which guide next

| Task | Read |
| --- | --- |
| Backend FlowScript syntax, run, promote, schemas | `flow://guide/authoring` |
| Unclear syntax: two real samples | `flow://guide/samples` |
| Project blocks, block contract, defaults, icons | `flow://guide/custom-blocks` |
| Java/JVM primitive in Rhino | `flow://guide/rhino-block-api` |
| One pure block for backend and frontend | `flow://guide/portable-blocks` |
| Backend plus Svelte application | `flow://guide/fullstack-paperboard` |
| Svelte-only frontend | `flow://guide/frontend-svelte` |
| Dynamic segments, layouts, route groups | `flow://guide/frontend-svelte-routing` |
| FullSync server DBOs and client actions | `flow://guide/fullsync` |
| Locate and patch existing code | `flow://guide/search-and-edit` |
| MCP JSONL tracing | `flow://guide/tracing` |
| Ordered tags and named project configurations | `flow://guide/tags` |

Guides are served whole by `resources/read`; read each one once per task.

If `tools/list` advertises `report-create`, use that relayed tool for at most one
concise product friction per turn: a missing capability or a workaround also counts, even when
no tool failed. Give the expected behavior, observed behavior and a minimal
reproduction without secrets or personal data. The server's existing feedback
consent applies. If the tool is absent or refuses reporting, mention the friction
in the final answer; do not enable reporting, write an agent-local file or call
another endpoint to bypass consent.

## Source contract in five rules

1. Every block call is `block.name({ key: value })` with one object argument.
   Positional calls such as `http.get(url)` or `requestable.call(".GetFeed")`
   are invalid; diagnostics show the accepted keys.
2. Capture a block result with an assignment: `local.feed = requestable.call({
   requestable: ".GetFeed" })`. Write one statement per line; never join two
   Flow statements with `;` on one line.
3. `$$id`, `$$comment`, `$$disabled`, `$$out` and slots such as `$$then` are
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

## Project layout

Flow sources live only under `<project>/_flow/`, which `.httpignore` keeps
private (`/_flow/`). Public files live outside it (project `resources/`, app
`static/`).

| Path | Content |
| --- | --- |
| `_flow/engine.yaml` | project Flow `config` and frontbuilder settings |
| `_flow/flows/<Name>.flow.js` | executable Flow (FlowScript) |
| `_flow/blocks/<ns>/<name>.block.js` | block: `_meta` then FlowScript function or Rhino IIFE |
| `…/<name>.hooks.js`, `…/<name>.browser.js` | analysis hooks, browser implementation |
| `…/<name>.block.defaults.json` | optional defaults history |
| `_flow/types/*.type.yaml`, `_flow/types/editors/*.html` | property types and their editors |
| `_flow/schemas/<Flow>/<node>.out.schema.json` | learned or adopted output schemas |
| `_flow/fragments/*.fragment.yaml` | fragments used by `fragment.use` |
| `_flow/icons/iconify/<set>/<name>.svg` + `LICENSE.json` | icons (SVG only) |
| `_flow/fonts/<provider>/<family>/font.json` + `*.woff2` | custom fonts |
| `_flow/dependencies.json` | definer versions, written on save |
| `_flow/frontbuilder/svelte/model/<App>/src/routes/**` | Pages and Layouts (`+page.flow.svelte`, `+layout.flow.svelte`) |
| `_flow/frontbuilder/svelte/model/<App>/src/{lib,theme.flow.css,app.flow.css,i18n}` | app components, theme, CSS, translations |
| `_flow/frontbuilder/svelte/components/<ns>/<Tag>.flow.svelte` | shared (Catalog) components |

Generated output (`_private/svelte`, `DisplayObjects/mobile`) is never edited.

## Default backend loop

1. For a new Flow, write compact FlowScript with `code-set` first. Do not
   browse the catalog or copy application Flows first; let `code-set` and
   `code-run` diagnostics name blocks and properties. Read at most two
   samples when syntax is unclear.
2. If the requested `project`, `qname` or `block` is not accessible through
   Flow MCP, stop and report that blocker. Never fall back to another project
   or to legacy MCP discovery.
3. Patch with `code-patch`, run with `code-run`, then `code-promote` once
   diagnostics and behavior are clean. `unsaved:true` or `workingCopy:true`
   in a `code-run` response means the Flow is still a draft: promote it
   before stopping. `code-status` shows dirty state, `code-discard` cancels.
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

## Design rules

- Keep structural constants (service URLs, API paths, namespaces, timeouts)
  in `config.*` or the project `_flow/engine.yaml`, not in block code. Reuse
  existing project config instead of copying it into `_flow.config`.
- Never write a secret (password, token, API key) in a configuration or a
  source: reference a Convertigo global symbol whose name ends with `.secret`,
  declared with a default, `password: "${<project>.<usage>.<name>.secret=}"`.
  The server resolves it for the running Flow only (stored encrypted, set in
  the Global symbols page); traces and schemas show the reference. Every
  `${...}` in a config string is a symbol reference.
- Keep a Flow `private` unless a frontend or an external client calls it:
  `const _flow = { accessibility: "private", ... }`. Private Flows run for
  Flow→Flow calls, the MCP and administrators only; `hidden` is callable but
  not listed, `public` is listed. The Studio runs every requestable over HTTP,
  private ones included (Studio mode): an anonymous call that succeeds in the
  Studio is refused on a server, so prove access control on the server or by
  the accessibility you declare, not by an anonymous Studio call. Exploration, authoring, test and
  qualification Flows are always private.
- `throw({ code, message, status })` what must interrupt the caller: the
  answer is the error alone and a frontend call fails and stops its chain.
  Return a normal result (`ok: false` with a reason) for an outcome the caller
  handles, such as a wrong password or nothing found.
- For repeated external work, model one item and iterate with `list.map` over
  a config collection or a small data block. Five or more copied `http.get` /
  `requestable.call` nodes must be refactored before promotion.
- Reusable domain blocks take business values (`country`, `city`, `product`)
  and read endpoints from `config.*`; prefer `currency.countryRate({ country:
  current, rates: local.rates })` over passing a prebuilt URL.
- For object maps whose keys are data, use `object.keys`, `object.get` and
  `object.firstEntry`; never write a Rhino block just to read `map[code]`.
- Keep the algorithm visible in FlowScript. Rhino is for one missing JVM
  primitive; project Rhino blocks that open URLs or call requestables are
  rejected.
- Top-down: call the domain block you want even if it does not exist yet.
  When `UNKNOWN_BLOCK` has no matching candidate (follow
  `candidateDecision`), create a typed mock with `flow-block-mock({ project,
  name, properties, outputs })`. A Flow using a mock is unfinished; check
  `flow-block-mock-list` before reporting completion.
- For request inputs and reusable tests, declare `const _flow = { inputs:
  {...}, tests: {...} }`; `code-*` tools report `inputDefinitions`,
  `inputVariables` and `testCases`, and inputs are synchronized to Convertigo
  request variables.

## Drafts, Save and caches

- Studio edits are in-memory working copies: the Properties **Apply** button
  changes a draft, **Save project** writes files, Reload discards drafts.
- On a project loaded in Convertigo, MCP shares those working copies:
  frontend sources, Catalog components and sources created from palette
  items are written as FlowEngine drafts (`draft:true`), and `code-get`,
  trees, checks and the dev preview read them. Tell the user to **Save
  project** when the work is done; a tool `saveProject` is refused while
  other unsaved Studio work exists.
- `code-set` / `code-patch` on a Flow update its working copy (the Studio
  shows it unsaved); `code-promote` with the returned `revision` saves it.
  Project `.block.js` sources are written directly by `code-set`, which is
  refused while the Studio has unsaved changes to that block.
- Runtime caches follow project source fingerprints automatically. Exception:
  after lib_flow_engine or frontbuilder code changed outside the Studio (git
  pull, disk edit), call `flow-cache-clear` once for the project, then retry.
- The first `authoring-tree`, palette or `code-get` on a cold project can
  take several seconds; do not retry it.

## Tool hygiene

After every tool call, check `result.error` in the structured result and read its `message` before retrying; ordinary clients receive `isError:true`, while Vibe receives the same readable error with `isError:false`. Relayed tools keep the legacy MCP response.

- After reading a tool contract once, pass `doc:false,hints:false`.
- Discovery tools are paginated (`limit`, `cursor`). `flow-catalog`,
  `flow-resource-search` and `flow-search` may return `partial:true` with a
  `nextCursor`; a partial result never proves that nothing else matches.
- `flow-app-progress` defaults to the POC goal; use `mode:"hardening"` only
  when a complete assessment is requested.
- Mutation tools and `flow-block-get` answer compactly; use `code-get` or
  `authoring-tree` for focused inspection.
- Do not run shell commands (`git status`, `sed`, `cat`, HTTP scripts) to
  confirm a generated Flow. Trust given `project`/`qname`; MCP results are the
  source of truth.
- Do not call `flow-schema-reset` during normal authoring;
  `flow://guide/authoring` owns the schema lifecycle.
- Project version and description: `flow-project-metadata({ project })` reads
  them, `version` and/or `description` set them (the Save of the project writes
  it, or `saveProject:true`). Never edit the project YAML for them.
- Workspace cleanup: `flow-project-remove({ project, dryRun:true })` first;
  `action:"delete"` only after `safe:true`; never `force:true` without
  reviewing every blocker.
- Delete one object of a project (a Flow, a connector, a transaction, a Flow
  item) as the Studio Delete does: `flow-object-remove({ project, qname })`
  lists what goes with it (a Flow takes its source and learned schemas), then
  `dryRun:false` deletes it and saves the project, so that a Flow can then take
  its name. It is refused while the project holds unsaved Studio work (listed
  by the dry run in `unsavedChanges`, Flow drafts included): ask the user to
  save first. A Flow with its own unsaved draft is never deleted
  (`FLOW_HAS_UNSAVED_DRAFT`): `code-discard` or `code-promote` it first.
  `saveProject:false` only deletes in the loaded project, for the next Save;
  creating a Flow with the name of a sequence whose deletion is not saved is
  refused (`FLOW_NAME_DELETION_UNSAVED`). A `.flow.js` left without its Flow
  (`type:"OrphanFlowSource"`) goes the same way with its `qname`. Never delete
  a `.flow.js` or edit project YAML instead.
- Tracing: Convertigo symbol `flow.mcp.traceJsonl`, see `flow://guide/tracing`.

## Frontend entry

For backend plus Svelte work, read `flow://guide/fullstack-paperboard` before
coding. For Svelte-only work, read `flow://guide/frontend-svelte` and use
`code-get` / `code-set` on `sourceFile`, with `authoring-tree`,
`authoring-palette`, `authoring-mutate`, `frontend-svelte-actions` and
`frontend-svelte-action`. Pages live under
`_flow/frontbuilder/svelte/model/<App>/src/routes`; generated Svelte is never
edited.
