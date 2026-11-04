# Flow Full-Stack Paperboard

Backend plus Svelte application in one short loop: bootstrap, backend pass, visible paperboard, early wiring, POC proof; or a parallel build of both sides on agreed contracts.

Use this guide for a Flow task that must deliver a backend plus a Svelte
frontend, especially when the user asks for an application from a short prompt
or for a legacy Convertigo screen to be rebuilt with Flow technologies.

Choose the data route first: any persisted business data with roles uses
`lib_flow_entity` and `flow://guide/entities`, then
`flow://guide/multipage-entities`. Sign-in (real or demonstration), CSV, jobs
and audit are independent additions; their presence does not select direct
SQL. `flow://guide/multipage-roles` is reserved for no persisted business data
or an explicit user request for direct SQL.

The default goal is a runnable POC: one backend pass, one frontend application
pass, build, and one useful browser path. One application pass may contain
several Page sources. Keep each repair on a failed path (`flow://guide/frontend-svelte-proof`).
Allow one verifier run and at most two reruns after focused repairs, on failed
paths only; collecting the same `runId` is not a rerun. Report checks left
undone when that limit is reached. Exhaustive
schemas, offline/history edge cases and visual refinement belong to explicit
hardening; functional Page separation and transitions do not.

Read `flow://guide/portable-blocks` when event normalization or another pure
operation should use the same block contract on both sides. Keep HTTP,
requestables, FullSync and navigation target-specific.

## Iterative Delivery Shape

Do not start by perfecting backend parsing, CSS, or generated Svelte source.
The first useful delivery is a visible application skeleton that names the
business intent:

```text
Search form
Result table
Detail card
Load button
Status/error area
Navigation links
```

Represent those intentions with palette blocks immediately, even when the data
is mocked. Deliver in two phases:

1. POC: paperboard visible in the generated app;
2. POC: primary action wired to a backend Flow; a mock is allowed while building, but replace every mock the request needs before delivery, unless the user accepts it;
3. Hardening: backend mock replaced by real Flow/HTTP/parsing blocks;
4. Hardening: output schema reviewed so frontend pickers see real fields;
5. Hardening: visual/layout refinement using semantic layout properties and
   explicit application CSS classes.

When wiring a backend action in Flow Svelte source, use an intuitive
`@<actionId>.path` reference. If the schema path is unknown, use the schema-backed
`binding` or `mutation` returned by the picker or by `flow-app-progress` and
pass it unchanged. Do not invent bare relative paths or descriptor JSON.
Validate the complete runnable pass before calling `flow-app-progress`.

Keep value intent visible in source (Literal / Source / Compose): quoted
attributes are literals, quoted `@source.path` values are schema-backed
sources, and `{expression}` is browser-only logic. For a computation shared with backend FlowScript, use a
dual-target portable block rather than duplicating subtly different Rhino and
browser expressions.

In hardening mode, every plain-string, invalid or unknown action/schema-path warning
must be fixed before progress can reach 100%. Execute
`frontend.bindingWarnings[].fix` directly when present; for a
missing binding, execute its `inspect` call and select a returned schema-backed
candidate. Bindable descendants of a data-bound `ForEach` require an explicit
source, including a structured literal for intentionally static content.


## Drawers

- `flow://guide/fullstack-paperboard/path` — open for the ordered backend and frontend build path.
- `flow://guide/fullstack-paperboard/contract` — open to agree the paperboard contract, progress and done criteria.
- `flow://guide/fullstack-paperboard-parallel` — open when backend and frontend specialists work in parallel.
