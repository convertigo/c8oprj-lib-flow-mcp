# Fullstack golden path

Read for the ordered backend and frontend implementation path.

## Golden Path

1. Bootstrap the exact target project with `flow-project-bootstrap({ project,
   ui:true })` when FlowEngine or the Svelte builder is missing. For persisted
   business data with roles, include `references:["lib_flow_entity","lib_flow_sql","lib_flow_crud_data"]` or add
   that reference with `flow-project-reference` before writing drafts. Never edit
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
   `flow://guide/frontend-svelte/routing`.
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
6. For entity-backed pages, read `flow://guide/entities/widgets` before choosing blocks: use `EntityTable`, `EntityForm`, `EntityView`, `EntityStat` or `EntityBreakdown` where their contracts fit; use generic blocks for unsupported views. Build the first frontend paperboard from palette blocks. Use real layout
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
     chain, and load the state of a page on every mount (a plain `OnMount`): `once` is only for work whose result lives outside the page (`flow://guide/frontend-svelte/actions`).
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
   `flow://guide/frontend-svelte/components`) instead of duplicating markup and action
   chains. Remove obsolete demo Flows once the
   real command replaces them so agents cannot choose between parallel data
   paths with different validation rules.
8. On an existing project where dev mode was not started during bootstrap,
   start it after this first complete paperboard with `wait:false`. Continue the focused repairs while dependencies install. Do not
   poll: Vite and the Studio viewer open automatically when setup completes.
   Run `dev.sync` once after the final repair to regenerate the completed
   source. Use `dev.open` only to reveal an already running viewer.
9. Replace mocks one by one with real FlowScript or small Rhino primitives, before delivery (`flow://guide/start/rules`).
    Keep orchestration visible in FlowScript; Rhino is only for unavoidable
    low-level parsing or JVM bridges.
10. Prove the POC with a short check:
    - `code-run` for backend behavior;
    - `flow-output-schema` when downstream pickers or requestable schemas
      matter;
    - browser smoke in the live dev viewer for the requested visible workflow:
      a multi-step workflow (sign-in, several pages, a form) through one
      relayed `subagent-run` with `profile:"verifier"` and the viewer
      `openUrl`, one visual check through `browser-verify` when listed,
      otherwise one screenshot through the Playwright of your host;
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
