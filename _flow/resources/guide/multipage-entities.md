# Multi-Page Application with Roles by Entities

Build an equipment application from a declarative model, real account sessions and reusable entity widgets, with separate user and administrator pages.

This recipe complements `flow://guide/multipage-roles`; it interprets the model
instead of generating application CRUD code. Start with a contract agreed
between backend and frontend specialists, as described in
`flow://guide/fullstack-paperboard`.

1. Bootstrap the exact target with `flow-project-bootstrap({project,ui:true})`.
   Add the referenced entity, data, SQL, user manager and Svelte providers with
   `flow-project-reference`, starting with `dryRun:true`. Read
   `flow://guide/entities`, `flow://guide/authoring` and
   `flow://guide/frontend-svelte` before writing sources.
2. Read the real user manager sign-in/session contracts with `flow-block-get`.
   Configure its storage independently of the equipment storage. Sign-in checks
   credentials; the entity actor and roles are resolved from the application
   session. The responsible-person relation uses the imported account directory,
   never an assumed table name. Do not create a demonstration user picker.
3. Read `flow-entity-model-get`; check a model with `flow-entity-model-check`;
   inspect diagnostics; write with `flow-entity-model-set` and that revision.
   Model Equipment with Activable, Horodaté, Possédé and Révisé. Its verification
   date must not be in the future. Use Échéance for the six-calendar-month
   reminder. An administrator-only internal note must be hidden by the server.
   Declare only directory fields needed by the relation. Restrict its options
   to active ordinary users. Keep secrets outside the model and journal.
4. Configure the SQL connection using secret symbols and the entity entry point
   according to their installed contracts. Use `code-set`, `code-run`, then
   `code-promote` for the explicit private setup Flow calling `entity.initialize`.
   Initializing twice must preserve a user's edits. A model write never runs a
   migration or resets data implicitly.
5. Create home/sign-in, my equipment and administration pages before navigation
   links. Use `code-get`, `frontend-svelte-action` with `actionId:"dev.ensure"`
   and `wait:false`, then revisioned `code-set`/`code-patch` writes. Add the
   `EntityTable` and `EntityForm` palette entries; keep named cell, field and
   action snippets for business presentation. The user page requests its own
   perimeter; the admin page requests all rows. The server checks both requests.
6. Build a shared Layout with session refresh on navigation, role-dependent
   links, PageContent and sign-out. The Flow Svelte syntax and session lifecycle
   are in `flow://guide/multipage-roles`; use the real user manager logout here.
   Mark protected facades with the required accessibility/session settings.
7. Prove the model revision conflict and invalid-write refusal; then sign in as
   two ordinary users and an administrator. Test own and foreign rows, hidden
   JSON fields, an invalid responsible user, future date, stale revision and
   any installed delete/immutable/journal behavior. Verify user and admin pages
   with `frontend-svelte-action` `actionId:"dev.open"` and the relayed verifier.
   Preserve the tool-call count separately from protocol/resource requests.

Before handing the exercise to another agent, record the model revision, saved
Flow/page sources, actual role test results and remaining mocks from
`flow-block-mock-list`. Keep initialization, authentication administration and
journal mutation private. Do not claim production readiness from this recipe:
qualify the configured database and session provider and review audit retention.
