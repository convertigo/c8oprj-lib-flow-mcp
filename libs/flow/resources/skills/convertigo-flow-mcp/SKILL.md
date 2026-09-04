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
  `flow://guide/frontend-svelte` once.
- Full-stack work: use both specialists and read
  `flow://guide/fullstack-paperboard` once.
- Read routing, FullSync, custom-block or Rhino guides only when the requested
  feature needs them. Do not load every guide pre-emptively.

Keep one specialist role through repair passes. Do not spawn a replacement
specialist merely to continue the same application.

## Non-Negotiable Boundaries

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
- Treat Flow as available only when Convertigo is at least 8.4.0 and both
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

The bootstrap target and starter contract already identify `home`. Do not call
`project-list`, `frontend-svelte-tree`, `flow-list`, `flow-search` or a catalog
to rediscover facts already returned by bootstrap or `code-get`.

`code-set` validates before its atomic frontend write. Use `code-check` only
for an intentional dry-run, not as a mandatory preflight. If a block or
property is absent from the starter contract, make one contextual, exact-id
`authoring-palette` call at the qualified parent path; a tree call is not a
prerequisite. Preferred portable actions already include compact property
contracts and recipes in `code-get`; use those directly without a palette call.

`dev.sync` is the final generation barrier and may already return the viewer.
Do not call `dev.open` when that viewer is present. `flow-app-progress` is
optional on this fast path; call it only when a consolidated readiness report
would answer an unresolved question.

For a simple reactive browser proof, prefer one evaluation that captures the
initial value, waits, and verifies the changed value. List/select tabs only
when the viewer target is ambiguous; do not split one assertion across
`browser_find` and several evaluations.

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
a Studio restart recovers the viewer. For later focused changes use
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
- `authoring-palette` is contextual discovery for one parent path.
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

POC completion means the requested business path runs and the representative
visible behavior is proved. Do not add production builds, exhaustive browser
matrices, schema adoption or unrelated hardening unless requested. Report
remaining mocks, unavailable browser control or runtime warnings honestly.
