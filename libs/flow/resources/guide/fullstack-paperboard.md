# Flow Full-Stack Paperboard

Use this guide for a Flow task that must deliver a backend plus a Svelte
frontend, especially when the user asks for an application from a short prompt
or for a legacy Convertigo screen to be rebuilt with Flow technologies.

The default goal is a runnable POC: one backend pass, one frontend pass, build,
and one useful browser path. Stop after at most two focused repairs. Mock
replacement, exhaustive schemas, offline/history coverage and visual
refinement belong to explicit hardening.

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
2. POC: primary action wired to a backend Flow, mock acceptable but explicit;
3. Hardening: backend mock replaced by real Flow/HTTP/parsing blocks;
4. Hardening: output schema reviewed so frontend pickers see real fields;
5. Hardening: visual/layout refinement using explicit layout and style properties.

When wiring a backend action in Flow Svelte source, use an intuitive
`@action.path` reference. If the schema path is unknown, use the schema-backed
`binding` or `mutation` returned by the picker or by `flow-app-progress` and
pass it unchanged. Do not invent bare relative paths or descriptor JSON.
Validate the complete runnable pass before calling `flow-app-progress`.

Keep value intent visible in source: quoted attributes are literals,
`{expression}` is browser-only logic, and quoted `@source.path` values are
schema-backed sources. For a computation shared with backend FlowScript, use a
dual-target portable block rather than duplicating subtly different Rhino and
browser expressions.

In hardening mode, every legacy, invalid or unknown action/schema-path warning
must be fixed before progress can reach 100%. Execute
`frontend.bindingWarnings[].fix` directly when present; for a
missing binding, execute its `inspect` call and select a returned schema-backed
candidate. Bindable descendants of a data-bound `ForEach` require an explicit
source, including a structured literal for intentionally static content.

## Golden Path

1. Bootstrap the exact target project with `flow-project-bootstrap({ project,
   ui:true })` when FlowEngine or the Svelte builder is missing. Never edit
   `c8oProject.yaml`, `_c8oProject/**/*.yaml`, `_private/svelte` or
   `DisplayObjects` directly.
2. Extract a small plan from the prompt:
   - backend requestables or service operations;
   - frontend pages;
   - visible layout intentions such as `input form`, `result table`, `detail
     card`, `status area`, `navigation`, `media list`;
   - external service URLs and structural config values.
   When cloning a legacy Convertigo application, treat public sequences as the
   application contract by default. Inspect connector transactions only to
   understand or replace their implementation. Do not rebuild against a raw
   connector response unless the user explicitly asks for the connector-level
   API.
3. Store structural service constants in project FlowEngine `config.*`, not in
   low-level block code. Keep internal builder config private; do not expose it
   as application configuration.
4. Write the main backend FlowScript top-down with `code-set`. Use readable
   domain block names even when they do not exist yet. Let diagnostics decide
   between an existing block and a mock.
5. When a backend domain block is missing, create a typed project-local mock
   with `flow-block-mock`. The mock must keep the parent Flow executable and
   must remain visible in `flow-block-mock-list`.
6. Build the first frontend paperboard from palette blocks. Use real layout
   blocks and visible placeholders:
   - `PageShell` for the shell;
   - `Card`, `RowLayout`, `ColumnLayout`, `GridLayout` for structure;
   - `Text`, `Image`, `Button`, `LinkButton`, `Status`, `Table`, `JSON` for
     visible intent;
   - `ForEach`, `If`, `Await` for data-driven structure.
   - `OnMount`, `Navigate` and `GoBack` for explicit lifecycle and route
     transitions when the workflow cannot be expressed by a static link. Put
     `GoBack` below a visible Button event action chain, and use
     `OnMount once={true}` only for bootstrap state that must survive a route
     round trip.
7. Wire at least one visible action to the backend early, even if the backend
   still returns mock data. A user should see a working button, status, and a
   placeholder result before detailed refinement begins.
8. Run `frontend-svelte-action({ project, actionId:"dev.sync" })` while
   iterating. Use `dev.start` only through MCP or the Studio menu.
9. Hardening only: replace mocks one by one with real FlowScript or small Rhino primitives.
    Keep orchestration visible in FlowScript; Rhino is only for unavoidable
    low-level parsing or JVM bridges.
10. Hardening only: prove each layer with a short check:
    - `code-run` for backend behavior;
    - `flow-output-schema` when downstream pickers or requestable schemas
      matter;
    - `frontend-svelte-action` build for production, or `dev.sync` while
      iterating;
    - browser smoke for a user-facing workflow.

## Paperboard Contract

A paperboard is not throwaway generated code. It is the first real low-code tree
that will be refined. Every visible region must be represented by a block in
the tree, even if its data source is still mocked.

Use placeholder labels that describe intent, not implementation:

```text
PageShell
  Card "Search"
    Text "Search form"
    Button "Load"
  Card "Results"
    Status for load action
    Table for result rows
  Card "Detail"
    Text "Select a row"
```

For Svelte route pages, use the normal SvelteKit tree:

```text
Routes
  ROOT /
    Layout
    Page
      Structure
        PageShell
          ...
    Children
      detail
        Page
```

Do not create hidden layout defaults in the generator to make the paperboard
look nicer. If spacing, cards, rows, columns, or responsive behavior matter,
insert explicit blocks with visible properties.

## Progress Signals

Use `flow-app-progress` to collect stable signals for the Studio chatbot or an
agent status update:

- FlowEngine can be read;
- executable Flows exist;
- the requested Flow exists when `qname` is provided;
- explicit project-local mocks remain or not;
- Svelte frontend builder/tree is readable;
- route/page structure exists;
- frontend build/dev actions are available.

The response includes `recommendedCalls`: exact MCP calls for the next audit
loop, such as `flow-output-schema`, `code-run`,
`frontend-svelte-tree detail:"inspect"` and `frontend-svelte-action generate`.
Use those calls instead of rediscovering broad catalogs or reading generated
files.

Progress is a delivery gauge, not a quality score. A project can be 80% on the
gauge and still need visual polish, schema refinement, performance work, or
mock replacement.

## Chatbot Status Style

Show user-facing work states, not raw hidden reasoning:

- "I created the first paperboard page with form, result table and detail
  placeholders."
- "The backend Flow runs with one typed mock: `feed.fetchItems`."
- "I wired the `Load` button to the backend action and generated the Svelte
  app."
- "Next I will replace the mock with the real HTTP Flow and keep the UI tree
  unchanged."

Keep MCP calls collapsible and attach important results: diagnostics, mock
count, build status, browser smoke status, and the next action.

## Done Criteria

For a small full-stack Flow application, done means:

- no explicit mocks remain unless the user accepted them;
- backend `code-run` proves the requestable result;
- output schema is static/effective enough for pickers;
- frontend tree contains explicit layout and data blocks;
- generated Svelte compiles through MCP actions;
- a visible runtime smoke proves the primary workflow.
