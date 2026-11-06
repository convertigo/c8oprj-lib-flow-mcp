# Flow Start Rules

Project layout, design rules, drafts and Save, tool hygiene, authentication add-ons, project switches and friction reports.

Sub-guide of `flow://guide/start`: read that guide first.

## Authentication and add-ons

These additions are independent of the data route:

- Session and actor provider: `flow://guide/entities-auth`, Authentication section.
- Demo login, CSV, jobs and audit: `flow://guide/multipage-entities-access` and `flow://guide/multipage-entities-pages`, matching sections.

A password-free demo login requires `String(config.demo.login) === "true"`;
bootstrap declares `<project>.demo.login` false by default. Enable it only for a
demo, never production. Identity and roles come from the server. CSV reuses read
permissions/filters; jobs are private and bounded, without a browser session;
mutation and allowlisted audit share a transaction. Never journal secrets.

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
- For sign-in, CSV, jobs and audit, see Authentication and add-ons above.
- Keep a Flow `private` unless a frontend or an external client calls it:
  `const _flow = { accessibility: "private", ... }`. Private Flows run for
  Flow→Flow calls, the MCP and administrators only; `hidden` is callable but
  not listed, `public` is listed. A server, and a recent Studio, refuse a
  private one over HTTP to anyone but an administrator (an older Studio still
  ran it for an anonymous call): prove access control with a session that is
  not an administrator. Exploration, authoring, test and
  qualification Flows are always private.
- `throw { code, message }` what must interrupt the caller: the
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
  {...}, tests: {...} }`; `code-set`/`code-check` report `inputDefinitions`,
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

After each tool, read `result.error` and its `message` before retrying.
Ordinary clients flag `isError:true`; Vibe returns that error with
`isError:false`. Relayed tools retain the legacy response.

- After reading a tool contract once, pass `doc:false,hints:false`.
- Flow libraries are already loaded in this workspace, not on the marketplace.
  Find them with `flow-catalog` / `project-list` and their guides under
  `flow://lib/<library>/<guide>`; never import marketplace Flow capabilities.
- Discovery tools are paginated (`limit`, `cursor`). `flow-catalog`,
  `flow-resource-search` and `flow-search` may return `partial:true` with a
  `nextCursor`; a partial result never proves that nothing else matches.
- `flow-app-progress` defaults to the POC goal; use `mode:"hardening"` only
  when a complete assessment is requested.
- A tool a guide names but the list lacks runs through
  `tools-more({name:"flow-resource-patch", arguments:{...}})`; `tools-more({})`
  lists them, `tools-more({name})` gives one input schema. `browser-verify`
  and `subagent-run` are not among them: without them in your list, prove
  pages with the browser tools of your host (Playwright).
- Read block contracts with `flow-block-get({project,name})` (longDescription
  included) or `authoring-palette`. Never grep/sed/cat library or workspace
  sources. A call diagnostic includes its `contract`.
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

## Non-secret project switches

Use `flow-project-symbol-set({project:"App",key:"App.demo.login",value:true})`
for non-secret switches. Keys stay under `<project>.*`; only booleans or finite
numbers are accepted, never credentials or strings. The manager applies them
immediately, including to warm runtimes, without an admin session/config edit.
`effective:true` proves memory, not separately disk persistence. Restore the
previous boolean/number value to undo.

## Friction reports

If advertised, use relayed `report-create` for at most one product friction per
turn, including a missing capability or workaround. Give expected/observed
behavior and a minimal reproduction without secrets or personal data. Honor
server feedback consent. If absent or refused, mention it in the final answer;
never enable reporting, write an agent-local file or use another endpoint to
bypass consent.
