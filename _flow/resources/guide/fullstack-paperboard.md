# Flow Full-Stack Paperboard

Backend plus Svelte application in one short loop: bootstrap, backend pass, visible paperboard, early wiring, POC proof; or a parallel build of both sides on agreed contracts.

Use this guide for a Flow task that must deliver a backend plus a Svelte
frontend, especially when the user asks for an application from a short prompt
or for a legacy Convertigo screen to be rebuilt with Flow technologies.

The default goal is a runnable POC: one backend pass, one frontend application
pass, build, and one useful browser path. One application pass may contain
several Page sources. Stop after at most two focused repairs. Exhaustive
schemas, offline/history edge cases and visual refinement belong to explicit
hardening; functional Page separation and transitions do not.

Read `flow://guide/portable-blocks` when event normalization or another pure
operation should use the same block contract on both sides. Keep HTTP,
requestables, FullSync and navigation target-specific.

## Parallel Build

For an application of several Flows and pages, build the backend and the
frontend at the same time instead of one after the other: the main agent sets
the contract, two specialists build one side each, the main agent integrates.

1. **Contract first (main agent).** Golden Path steps 1 to 3, then the data
   model (entities, ids, fields; the `schema.json` of `lib_flow_sql` for SQL
   data) and every Flow a page calls: its `_flow.inputs`, the fields of its
   result and a minimal body that returns demo-shaped data with those exact
   names and types. `code-run` then `code-promote` each one so the frontend
   pickers see its fields. Write the contracts, the pages with the Flows they
   call, the owner of each area and the lots in `docs/generated/PROGRESS.md`
   (`flow-resource-patch` with `content`).
2. **Two specialists at once**, each with its skill, the contracts and one lot:

   | Specialist | Owns | Never writes |
   |---|---|---|
   | backend | `_flow/flows`, project blocks, `engine.yaml` (`config.*`), backend resources, tests | frontend sources |
   | frontend | `_flow/frontbuilder` sources, theme, assets | Flows, `engine.yaml` |

   The backend fills the bodies without changing the agreed inputs and
   fields. The frontend binds to the contracts as they are: a missing or wrong
   field goes back to the main agent, who hands it to the backend; never a
   hard-coded value, a mock Flow or a renamed binding. Writes are
   revision-checked (`revision`, `baseHash`): on a conflict, read again and
   redo the change on the new revision. Only the main agent writes
   `PROGRESS.md`, saves the project and runs the browser proofs; it writes
   neither side while the specialists run.
3. **Integrate (main agent).** Read the two handoffs, hand the missing fields
   to the backend as a small lot and then the binding to the frontend,
   `dev.sync`, prove the paths with the verifier, `project-save`, and update
   `PROGRESS.md` (lots done with their proof, open issues, next step).

Starting the specialists:

- Claude Code or Codex (write-capable sub-agents of their own): two sub-agents
  started together, each told the project, its side and what it owns, the
  skill to read (`convertigo-flow-backend` or `convertigo-flow-frontend-svelte`),
  the contracts, its lot and the handoff wanted. Start both in the foreground
  in one call and wait for both reports before ending your turn: some hosts
  stop a background sub-agent when the turn ends.
- Vibe (its `task` sub-agents are read-only): the relayed
  `subagent-run({profile:"constructor", task, inputs:{project, scope:"backend"}, waitSec:5})`,
  then the same with `scope:"frontend"`; collect each with
  `subagent-run({runId})` alone until its report comes. A constructor works
  with the `convertigo-flow` tools only, one per scope and project; the MCP
  refuses its writes outside its scope, its saves and its browser proofs.

Stay sequential for a small application (one or two Flows, one or two pages),
on a host with neither, or when the constructor call is refused (no agent key,
no Vibe home): one agent then alternates lots, a page bound to the contracts
while the next backend lot fills them.

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

## Golden Path

1. Bootstrap the exact target project with `flow-project-bootstrap({ project,
   ui:true })` when FlowEngine or the Svelte builder is missing. Never edit
   `c8oProject.yaml`, `_c8oProject/**/*.yaml`, `_private/svelte` or
   `DisplayObjects` directly. Immediately call
   `frontend-svelte-action({ project, actionId:"dev.ensure", wait:false })`
   after a successful UI bootstrap so dependency setup overlaps backend and
   frontend authoring.
2. Extract a small plan from the prompt:
   - backend requestables or service operations;
   - frontend Pages and transitions;
   - visible layout intentions such as `input form`, `result table`, `detail
     card`, `status area`, `navigation`, `media list`;
   - external service URLs and structural config values.
   When cloning a legacy Convertigo application, treat public sequences as the
   application contract by default. Inspect connector transactions only to
   understand or replace their implementation. Do not rebuild against a raw
   connector response unless the user explicitly asks for the connector-level
   API.
   A distinct business step is a Page. Keep only one Page or mutually exclusive
   surface active; never expose an empty downstream list or detail before its
   required selection. For dynamic segments, layouts or route groups, read
   `flow://guide/frontend-svelte-routing`.
   Before multiplying CRUD Pages, write the smallest domain contract that can
   answer the primary user intent: entities, stable ids, relationships,
   required fields, create/update rules and deletion semantics. Model one user
   command as one backend Flow. For example, `SaveOpportunity` should resolve
   an existing company/contact or create a typed custom label itself; the Page
   must not branch between several persistence Flows based on partially filled
   ids. Use runtime timestamps or explicit inputs, never fixture dates in
   production writes.
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
   - `AppShell` in the root Layout (navigation, user, `PageContent`), or
     `PageShell` for a single Page;
   - `PageHeader`, `Card`, `RowLayout`, `ColumnLayout`, `GridLayout` for
     structure;
   - `StatCard`, `DataTable`, `StatusBadge`, `EmptyState`, `FormSection`,
     `Text`, `Image`, `Button`, `LinkButton`, `Status` for visible intent;
   - `ForEach` and `If` for data-driven structure (the `Await` `pending` slot
     is currently refused; show progress with `Status`).
   - `OnMount`, `OnAfterNavigate`, `Navigate` and `GoBack` for explicit
     lifecycle and route transitions when the workflow cannot be expressed by a
     static link. `OnMount` runs when the page mounts; `OnAfterNavigate` after
     each navigation, to load what depends on the address
     (`@event.to.params.id`). Put `GoBack` below a visible Button event action
     chain, and use `OnMount once={true}` only for bootstrap state that must
     survive a route round trip.
   Keep the default theme and adjust its tokens in `theme.flow.css`; use the
   application CSS source plus explicit `class` values only for gradients,
   illustrations and one-off rules. Do not expand every UI block into a CSS
   property matrix and do not put behavior or data wiring in CSS.
7. Wire at least one visible action to the backend early, even if the backend
   still returns mock data. A user should see a working button, status, and a
   placeholder result before detailed refinement begins.
   Prove one complete representative create/read relationship before copying
   the pattern to sibling entities. If the shell, form, card or relation picker
   repeats, turn the proven pattern into an application component with typed
   inputs (`_flow.props`, `@props.<name>`; see "Components And Inputs" in
   `flow://guide/frontend-svelte`) instead of duplicating markup and action
   chains. Remove obsolete demo Flows once the
   real command replaces them so agents cannot choose between parallel data
   paths with different validation rules.
8. On an existing project where dev mode was not started during bootstrap,
   start it after this first complete paperboard with `wait:false`. Continue
   the two allowed focused repair passes while dependencies install. Do not
   poll: Vite and the Studio viewer open automatically when setup completes.
   Run `dev.sync` once after the final repair to regenerate the completed
   source. Use `dev.open` only to reveal an already running viewer.
9. Hardening only: replace mocks one by one with real FlowScript or small Rhino primitives.
    Keep orchestration visible in FlowScript; Rhino is only for unavoidable
    low-level parsing or JVM bridges.
10. Prove the POC with a short check:
    - `code-run` for backend behavior;
    - `flow-output-schema` when downstream pickers or requestable schemas
      matter;
    - browser smoke in the live dev viewer for the requested visible workflow:
      a multi-step workflow (sign-in, several pages, a form) through one
      relayed `subagent-run` with `profile:"verifier"` and the viewer
      `openUrl`, one visual check through `browser-verify`;
    - production build only for deployment or an explicit production check.
      An application handed to users (acceptance criteria, links in e-mails,
      a URL to share) is a deployment: its definition of done runs
      `frontend-svelte-action({ project, actionId:"build" })`, checks that
      `<server>/convertigo/projects/<project>/DisplayObjects/mobile/` serves
      it and points user links there, keeps the demo sign-in off by default
      and `corsOrigin` on its same-origin default.
    For temporal requirements, sample the relevant visible value twice at
    least one second apart. For visual requirements, inspect the rendered
    computed style instead of inferring it from source.

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

For Svelte route pages, use the normal SvelteKit tree (sources under
`<App>/src/routes/`, each Page a `<FlowComponent $$id="…">` with
`sourceVersion: 2` in its header):

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
look nicer. If rows, columns or responsive behavior matter, insert explicit
layout blocks with visible semantic properties. If gradients, typography or a
cohesive theme matter, use explicit classes and the source-backed application
CSS rail rather than duplicating general CSS properties on every block.

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
