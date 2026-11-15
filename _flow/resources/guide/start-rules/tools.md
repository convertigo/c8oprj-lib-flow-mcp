# Flow MCP tool hygiene

Read for tool discipline, switches, friction reports and guide reading.

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
- A test Flow never promoted is only a working copy: `code-discard({project,name})`
  deletes it; `flow-object-remove` deletes saved objects only. On
  `PROJECT_HAS_UNSAVED_CHANGES`, retry with `saveProject:false` and ask for
  **Save project**; on `SOURCE_WORKING_COPY`, edit that file with
  `code-get`/`code-set`, or `code-discard({project,sourceFile})` first.

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

## Reading guides

Read each guide once. Use `resources/read`, or
`flow-resource-get({uri,format:"text"})` for guide/library/skill URIs without a
project. In Vibe `run_typescript`, print the returned Markdown with
`console.log(await tools.mcp_convertigo_flow.flow_resource_get({uri,format:"text"}))`.
Returning or JSON-stringifying it escapes newlines. Each guide is short enough to
be read whole; its size follows its name. Structured mode keeps the document in `text`
(under `structuredContent` in an MCP envelope).

## Frontend entry

Choose the task guide from the table above before coding. For Svelte, use `code-get` / `code-set` on `sourceFile`, then
`authoring-tree`, `authoring-palette` and `authoring-mutate` as needed. Run the
viewer through `frontend-svelte-action`. Pages live under
`_flow/frontbuilder/svelte/model/<App>/src/routes`; never edit generated Svelte.
