---
name: convertigo-flow-mcp
description: Use Convertigo Flow to inspect, create, edit, test, and run Flow backends and Svelte frontends through the convertigo-flow MCP server.
---

# Convertigo Flow MCP Router

Use the named `convertigo-flow` MCP server for every Convertigo Flow model
operation. This skill is the short router; the specialist skill and live MCP
guide own the detailed workflow.

## Route Once

- Backend FlowScript, schemas, HTTP, FullSync or runtime work: read
  `skills/convertigo-flow-backend/SKILL.md`, then only the live guide it names.
- Svelte pages, components, bindings, styling, assets or viewer work: read
  `skills/convertigo-flow-frontend-svelte/SKILL.md`, then
  `flow://guide/frontend-svelte` once from the server named exactly
  `convertigo-flow`, never from the Legacy server named `convertigo`.
- Full-stack work: use both specialists and read
  `flow://guide/fullstack-paperboard` once. For several Flows and pages,
  follow its Parallel Build: you set the contract (data model, each Flow
  with its inputs, outputs and a demo-shaped body, `docs/generated/PROGRESS.md`),
  then a backend and a frontend specialist build at the same time, each
  owning its files, and you integrate and prove. Run them as your own
  write-capable sub-agents (Claude Code, Codex), or in Vibe as two relayed
  `subagent-run` constructors with `inputs.scope` `backend` and `frontend`.
  A small app, or no such sub-agent: stay sequential.
- Several pages with sign-in, roles, a per-user data perimeter, an export or
  a scheduled job: then read `flow://guide/multipage-roles` once.
- Read routing, FullSync, custom-block or Rhino guides only when the requested
  feature needs them. Do not load every guide pre-emptively.
- Record every successfully read guide URI for the current turn. Never read the
  same URI again after a successful response, including after compaction.
- Without MCP `resources/read` in your client (Vibe lists tools only), read a
  guide with `flow-resource-get` and its `uri` (`flow://guide/<name>` or
  `flow://lib/<library>/<guide>`), without `project`: it needs none, so read
  `flow://guide/start` before creating the project. The text is in
  `structuredContent.text`.

Keep one specialist role through repair passes. Do not spawn a replacement
specialist merely to continue the same application.

## Non-Negotiable Boundaries

After every tool call, check `result.error` in the structured result and read its `message` before retrying; ordinary clients receive `isError:true`, while Vibe receives the same readable error with `isError:false`. Relayed tools keep the legacy MCP response.

- Address every tool call with an explicit `project` (or `projectDir` only in
  standalone tests). The MCP host project is not the target project.
- Never hand-edit Convertigo YAML, generated Svelte, `_private/svelte`, build
  output or Studio metadata. Use the MCP source and model tools.
- Do not use shell/file tools to mutate a Convertigo project. Source files are
  still MCP-owned even when their paths are visible.
- Never fall back to the Legacy Convertigo MCP after a Flow tool error. Fix the
  owning Flow capability or report the configuration problem.
- External `/api/flow-mcp` calls use the shared Legacy/Flow bearer token from
  `CONVERTIGO_MCP_TOKEN`. Never print, persist or copy that secret.
- Treat Flow as available only when Convertigo is at least 8.5.0 and both
  `lib_flow_engine` and `lib_flow_mcp` are loaded.

## Fast POC Path

Optimize for the first useful preview unless the user explicitly asks for
hardening. Start with the smallest complete source, let diagnostics guide one
focused repair, and avoid broad discovery before the first draft.

For a fresh frontend-only, single-Page application:

```text
flow-project-bootstrap(ui:true)
-> frontend-svelte-action(dev.ensure, wait:false)
-> code-get(kind:"source")
-> code-set(sourceFile, revision, code, reveal:true)
-> frontend-svelte-action(dev.sync)
-> one bounded browser proof when requested or materially useful
```

Start `dev.ensure(wait:false)` immediately after bootstrap, before `code-get`,
so dependency preparation overlaps source inspection and authoring.

Inspect bootstrap's `existing` flag before claiming a project was created. If
it returns `existing:true`, the one successful `dev.ensure` also counts as the
existing-project preflight. When that response is active (`pending:false`, with
`browser` and `openUrl`) and `code-get` shows that the requested behavior is
already present, stop and answer. Do not repeat `dev.ensure` or call
`code-check`, `code-set`, `dev.sync` or `flow-app-progress` for this unchanged
no-op path.

The bootstrap target and starter contract already identify `home`. Do not call
`project-list`, `frontend-svelte-tree`, `flow-list`, `flow-search` or a catalog
to rediscover facts already returned by bootstrap or `code-get`.

`code-set` validates before its atomic frontend write. Use `code-check` only
for an intentional dry-run or changed draft, never to revalidate an unchanged
`code-get` result. If a block or
property is absent from the starter contract, make one contextual, exact-id
`authoring-palette` call at the qualified parent path; a tree call is not a
prerequisite. Preferred portable actions already include compact property
contracts and recipes in `code-get`; use those directly without a palette call.

`dev.sync` is the final generation barrier and may already return the viewer.
When its successful response contains `browser` and `openUrl`, use that viewer
and do not call `dev.open`. Otherwise call `dev.open` once. `flow-app-progress`
is optional on this fast path; call it only when a consolidated readiness
report would answer an unresolved structural question. Never claim visible or
runtime readiness when its proof says `runtime:false` or `browserRequired:true`.

For a simple reactive browser proof, prefer one evaluation that captures the
initial value, waits, and verifies the changed value. List/select tabs only
when the viewer target is ambiguous; do not split one assertion across
`browser_find` and several evaluations.

## Browser Proofs

Keep long Playwright sequences out of your context: each snapshot, click and
wait stays in it for the rest of the task.

- A multi-step proof (sign in, go through several pages, fill and submit a
  form, check a list after a write) goes to one relayed
  `subagent-run({profile:"verifier", task, inputs:{url, paths, checks,
  hints}})`. `url` is the `openUrl` returned by `dev.sync` or `dev.open`;
  `paths` lists the user journeys in plain language, `checks` the exact
  expected texts, `hints` the demo accounts and values. A vision model drives
  the Studio viewer and returns a short report (verdict, checks, defects,
  screenshots). While it answers `status:"running"`, call `subagent-run`
  again with its `runId` alone; never start a second run meanwhile. Keep the
  default `waitSec`.
- One visual check of the current page (layout, a rendered image, a label)
  is one relayed `browser-verify` call with its `checks`. For a Svelte
  frontend, include the visual checklist of `flow://guide/frontend-svelte`
  (POC Acceptance) in the `checks`.
- When your tool list has no `subagent-run` or `browser-verify` (an agent
  host whose own model sees images, such as Claude), give the multi-step proof
  to a sub-agent of your own host with the same `url`, `paths`, `checks` and
  `hints`, and ask it for the same short report; check one page yourself
  with a screenshot. The rule is the same: no long click sequence in your own
  context.
- Use Playwright yourself only for one quick evaluation of DOM state or
  timing; never a `browser_snapshot` per step.
- The verifier is read-only: fix what it reports with the Flow tools, then
  run it again on the failed paths only.

## Backend Source Loop

Use FlowScript code tools, not Flow tree/YAML editing:

```text
code-get -> code-set -> code-run -> code-promote
```

For a blank Flow, write the first draft with `code-set` before discovery.
`code-set` creates a checked working copy; `code-run` executes that draft and
`code-promote` saves it. If `code-run` reports `unsaved:true` or
`workingCopy:true`, do not stop before promotion.

Use `code-patch` for a focused revision-checked maintenance edit. Use
`flow-search` only after diagnostics leave a block, path or schema unknown.
Use `flow-catalog` only when search/examples are insufficient. Flow block calls
always use one object argument: `block.name({ key: value })`.

Project-local blocks are saved directly by `code-set`/`code-patch`; they have
no promote step. Prefer standard blocks, then a project-local FlowScript block.
Use Rhino only for Java integration or a genuinely low-level primitive.

## Frontend Source Loop

On an existing frontend, start with one `code-get`. Immediately call
`dev.ensure` with `wait:false` so authoring overlaps dependency preparation and
a Studio restart recovers the viewer. Call it at most once per project per
turn; a post-bootstrap call already counts. For later focused changes use
`code-rg`, then the smallest revision-checked `code-patch`; request a bounded
`code-get` range only when the match context is insufficient.

For Studio-visible writes, pass `reveal:true`. Import supplied or generated
images only with `frontend-svelte-asset-import` and reuse its returned
`resources/...` URL unchanged. Never copy assets into generated static folders.

Use `frontend-svelte-tree` only when an existing source target is genuinely
unknown. Its default compact response intentionally omits catalogs. Use
`detail:"inspect"`, an exact `focusPath`, `maxDepth:0` and one property for a
picker. Set `contractDetail:"full"` or request a large tree only for explicit
diagnostics.

Before browser automation, call `dev.open` only if necessary and require
`browserControlReady:true`. If the managed viewer remains unavailable after
one readiness check, report the limitation instead of bypassing Studio CDP.

## Discovery and Contracts

- `code-get`, `code-rg`, `code-set` and `code-patch` are the normal source path.
- Writing tools always take `project:"<target project>"`; they refuse to write
  without it or into `lib_flow_mcp`, the project serving this endpoint.
- Work only through the MCP tools: read sources with `code-get`/`code-rg` and
  the authoring trees, write them with `code-set`/`code-patch`. Never read or
  write project files, generated code (`_private`, build output) or payload
  files with shell or file tools: a server agent has no local file system. When
  the generated application does not do what the source says, report it as a
  friction with the source and the observed behavior instead of reading the
  generated code.
- `authoring-palette` is contextual discovery for one parent path.
- The contract of a block (inputs, outputs, errors, examples) comes from
  `flow-block-get({ project, name })` or `authoring-palette`, never from
  library sources or other folders: do not `grep`, `sed` or `cat` a library
  or workspace folder to learn how to call a block. A diagnostic on a block
  call gives that call in `contract`; the library guide
  (`flow://lib/<library>/<guide>`) gives its configuration.
- This endpoint also relays Convertigo MCP tools that apply to Flow projects:
  `scheduler-list`/`scheduler-apply` (schedule a Flow), `requestable-execute`
  (run a Flow or transaction, `authenticatedUser` to run it as a signed-in
  user), `log-view`, `project-list-symbols`, `project-save` (saves the frontend sources
  and tags of a project), `marketplace-*`,
  `project-security-audit`, `image-describe`, `rag-query` and read-only
  `databaseobject-*`, `browser-verify` (a vision model checks a page of the
  viewer: the way to prove the rendering for a model without vision) and
  `subagent-run` with `profile:"verifier"` (a vision sub-agent walks
  multi-step paths in the viewer and reports, see Browser Proofs) or
  `profile:"constructor"` (a write-capable Flow sub-agent for one side of a
  parallel build). Use them instead of a workaround.
- Flow libraries are not on the marketplace yet: the ones you can use are
  already in this workspace (`flow-catalog`, `project-list`). Do not search or
  import the marketplace for Flow capabilities.
- `flow-output-schema` and `flow-node-output-schema` inspect or adopt verified
  contracts; do not adopt stale learned schemas.
- `flow-resource-*` is for bounded non-FlowScript project resources, never for
  canonical Flow Svelte sources.
- `flow-tree`, `flow-get` and raw mutations are model-conversion debugging
  tools, not the normal authoring workflow.

For public request inputs, declare explicit `_flow.inputs`; add `_flow.outputs`
only after reviewing a verified static or learned result contract. Keep domain
service details in reusable typed sub-blocks and structural constants in
`config.*`, not hidden in Rhino or duplicated across application Flows.

## Completion

When `tools/list` advertises `report-create`, report at most one concise, reproducible
product friction per turn through that relayed tool. Missing capabilities and workarounds
count even without a tool error. Omit secrets and personal data. The legacy
endpoint owns feedback consent and storage: never enable reporting or bypass a
refusal. If unavailable, describe the friction in the final answer instead of
writing an agent-local feedback file.

POC completion means the requested business path runs and the representative
visible behavior is proved. Do not add production builds, exhaustive browser
matrices, schema adoption or unrelated hardening unless requested. Report
remaining mocks, unavailable browser control or runtime warnings honestly.

Native bean writes refuse invalid scalar values; inspect `fixes` and `normalizations` (property, before, after) before continuing. Never rely on an invalid value becoming zero, false or the first enum constant.
