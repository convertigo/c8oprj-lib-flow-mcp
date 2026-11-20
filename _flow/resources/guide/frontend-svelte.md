# Flow Svelte Frontend

Entry guide for Flow Svelte frontends: the nominal authoring loop, known limits and which short sub-guide to read for each topic.

Use Flow Svelte like FlowScript: write a small number of readable source files,
let MCP validate them, and never edit generated Svelte. For full-stack work,
read `flow://guide/fullstack-paperboard` first. Read
`flow://guide/frontend-svelte/routing` only for optional/rest/matched segments,
route groups or advanced layouts.

For any persisted business data with roles, add `lib_flow_entity` and read
`flow://guide/entities` then `flow://guide/multipage-entities` before wiring
the pages. Sign-in, CSV, jobs and audit do not change that data route. Only no
persisted business data or an explicit request for direct SQL selects
`flow://guide/multipage-roles`.

EntityTable and EntityForm use the application's local `EntityGateway`
(`flow-entity-model-set` with `gateway: true`);
`targetProject` is optional and selects another application only when explicit.
Use effective `describe` capabilities for custom create/edit/delete commands.
The optional `ownershipFilter` display filter never replaces server policy scope.

For an entity-backed page, choose `EntityTable`, `EntityForm`, `EntityView`, `EntityStat` or `EntityBreakdown` first; read `flow://guide/entities/widgets` for the choice and its exact drawer for configuration. After the first frontend `code-get` of the turn, call `frontend-svelte-action({project,actionId:"dev.ensure",wait:false})` before mutation. Use `reveal:true` on Studio-visible writes; run `dev.sync` once after changes and prove visible behavior in the browser.

For browser verification, read `flow://guide/frontend-svelte/proof`. `browser_wait_for.time` is in **seconds**, at most 30: use `2`, never `2000`.

The proof guide covers browser context reuse, sign-out and the development session limit.

Svelte source writes save directly, with no promotion. Before handover, require
`unsavedSources.count: 0` in `dev.sync`, build or `flow-app-progress`; resolve
remaining Flow drafts with `code-promote`, or `code-discard` to abandon them.
