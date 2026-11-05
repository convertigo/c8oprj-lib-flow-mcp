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
| Any persisted business data with roles: add the `lib_flow_entity` project reference | `flow://guide/entities`, then `flow://guide/multipage-entities` |
| Backend plus Svelte application, parallel build | `flow://guide/fullstack-paperboard` |
| No persisted business data, or an explicit request for direct SQL | `flow://guide/multipage-roles` |
| Svelte-only frontend | `flow://guide/frontend-svelte` |
| Dynamic segments, layouts, route groups | `flow://guide/frontend-svelte-routing` |
| FullSync server DBOs and client actions | `flow://guide/fullsync` |
| Locate and patch existing code | `flow://guide/search-and-edit` |
| MCP JSONL tracing | `flow://guide/tracing` |
| Ordered tags and named project configurations | `flow://guide/tags` |

The data route takes precedence: any persisted business data with roles uses
entities by default, including when the application also needs sign-in, a CSV
export, a scheduled job or an audit journal. These are independent additions,
not reasons to replace the entity model with direct SQL. Use
`flow://guide/multipage-roles` only when there is no persisted business data or
the user explicitly requests direct SQL. Generated CRUD is reserved for an
explicit request for generated CRUD.

Read each guide once per task. Use `resources/read`, or
`flow-resource-get({uri,format:"text"})` for `flow://guide/`, `flow://lib/`
and `flow://skills/` URIs without a project. This returns plain Markdown.
In Vibe `run_typescript`, print the returned string with
`console.log(await tools.mcp_convertigo_flow.flow_resource_get({uri,format:"text"}))`;
returning it or JSON-stringifying it escapes newlines. If the client truncates,
read its saved output instead of fetching the guide again. Old calls without
`format` keep the structured result: the document field is `text` (directly
on the unwrapped result in Vibe, under `structuredContent` in an MCP envelope).

If `tools/list` advertises `report-create`, use that relayed tool for at most one
concise product friction per turn: a missing capability or a workaround also counts, even when
no tool failed. Give the expected behavior, observed behavior and a minimal
reproduction without secrets or personal data. The server's existing feedback
consent applies. If the tool is absent or refuses reporting, mention the friction
in the final answer; do not enable reporting, write an agent-local file or call
another endpoint to bypass consent.

## Authentication and add-ons

Choose the data route above first. Authentication, exports, jobs and auditing
can be added to either route; needing one of them does not select direct SQL.

- Authentication: `flow://guide/entities` describes the session
  and actor-provider contract for entities, with real account providers or an
  explicitly requested demonstration session. Client-supplied roles never
  establish an identity.
- Demonstration sign-in: `flow://guide/multipage-entities`. A Flow
  that opens a session without a password runs only when
  `String(config.demo.login) === "true"`. Bootstrap declares this as the
  global symbol `<project>.demo.login`, false by default; enable it only on a
  demo server or in the Studio. A demo sign-in does not require direct SQL.
- CSV export: `flow://guide/multipage-entities`. Reuse the same
  server-side permissions and filters as the entity read.
- Scheduled work: `flow://guide/multipage-entities`. A private,
  bounded service Flow has an explicit server-side contract and does not rely
  on a browser session.
- Audit: `flow://guide/multipage-entities`. Keep the authorized mutation
  and its permitted audit fields in the same transaction; never log secrets.

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
  `${...}` in a config string is a symbol reference. A development HSQLDB
  may keep its default user, but its password is such a reference too.
- Keep the CORS policy of the bootstrap (empty `corsOrigin`: same origin; the
  dev viewer and the production build are served by Convertigo). Never set
  `=Origin` or `*` on an application with a session cookie: any site could
  call it in the name of a signed-in user. List the origins (`#`) when a
  separate front end needs them.
- For sign-in and the independent CSV, job and audit additions, use
  `flow://guide/start`; keep the chosen data route.
- Keep a Flow `private` unless a frontend or an external client calls it:
  `const _flow = { accessibility: "private", ... }`. Private Flows run for
  Flow→Flow calls, the MCP and administrators only; `hidden` is callable but
  not listed, `public` is listed. A server, and a recent Studio, refuse a
  private one over HTTP to anyone but an administrator (an older Studio still
  ran it for an anonymous call): prove access control with a session that is
  not an administrator. Exploration, authoring, test and
  qualification Flows are always private.
- `throw { code, message, status }` what must interrupt the caller: the
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

- Add references before drafts: persisted business data with roles needs
  `lib_flow_entity`; its storage/transaction layer and explicit direct SQL use
  `lib_flow_sql` and `lib_flow_crud_data`.
  On `PROJECT_HAS_STUDIO_DRAFTS`, retain Flow code with `code-get`, then
  `code-promote` valid drafts. For drafts needing the reference: retain code,
  `code-discard`, add the reference, then restore with `code-set`.
- Studio edits are in-memory working copies: the Properties **Apply** button
  changes a draft, **Save project** writes files, Reload discards drafts.
- MCP reads and previews share Studio working copies (`draft:true`), including
  frontend, Catalog and palette-created sources. Ask for **Save project** when
  done; `saveProject` refuses while other unsaved Studio work exists.
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
- Flow libraries are not published on the marketplace yet: every Flow
  library you can use is already loaded in this workspace. Find them with
  `flow-catalog` and `project-list`, and their guides with
  `flow://lib/<library>/<guide>`; do not search or import the marketplace for
  Flow capabilities.
- Discovery tools are paginated (`limit`, `cursor`). `flow-catalog`,
  `flow-resource-search` and `flow-search` may return `partial:true` with a
  `nextCursor`; a partial result never proves that nothing else matches.
- `flow-app-progress` defaults to the POC goal; use `mode:"hardening"` only
  when a complete assessment is requested.
- Mutation tools and `flow-block-get` answer compactly; use `code-get` or
  `authoring-tree` for focused inspection.
- The contract of a block (inputs, outputs, errors, examples) comes from
  `flow-block-get({ project, name })` (its `longDescription` included) or
  `authoring-palette`, never from library sources or other folders: no
  `grep`, `sed` or `cat` in library or workspace folders. A diagnostic on a
  block call gives that call in `contract`.
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
- Delete a Flow, connector, transaction or Flow item with
  `flow-object-remove({project,qname})`: review its dry-run plan, then use
  `dryRun:false`. Save other unsaved Studio work first; discard or promote
  a Flow's own draft before deleting it. The tool removes sources and schemas
  and saves the project; `saveProject:false` defers that save and name reuse.
  Orphan sources use their `qname` too. Never delete source files or edit
  project YAML instead. See `flow://guide/search-and-edit` for details.
- Tracing: Convertigo symbol `flow.mcp.traceJsonl`, see `flow://guide/tracing`.

## Frontend entry

Choose the task guide from the table above before coding. Business apps with
persisted business data and roles need the `lib_flow_entity` project reference
and both entity guides, including with demonstration sign-in, CSV or jobs.
For Svelte, use `code-get` / `code-set` on `sourceFile`, then
`authoring-tree`, `authoring-palette` and `authoring-mutate` as needed. Run the
viewer through `frontend-svelte-action`. Pages live under
`_flow/frontbuilder/svelte/model/<App>/src/routes`; never edit generated Svelte.

## Non-secret project switches

Use `flow-project-symbol-set({project:"App",key:"App.demo.login",value:true})` for a non-secret project switch.
Keys are confined to `<project>.*`, values to booleans or finite numbers; credentials and strings are refused.
The symbol manager applies the setting immediately, including to warm Flow runtimes. No Studio configuration edit or
admin session is needed. The manager persists symbols through its normal API; `effective:true` confirms memory,
not a separate guarantee of disk persistence. Restore a switch by setting its previous boolean/number value.
