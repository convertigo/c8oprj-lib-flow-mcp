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
   Wait for the target runtime and authentication provider to finish initializing
   before acceptance; TCP readiness alone does not prove that a sign-in Flow is
   ready. Configure its storage independently of the equipment storage. Sign-in checks
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
   according to their installed contracts. Use `code-set` and `code-promote` for an explicit hidden setup Flow calling
   `entity.initialize`, with a real ADMIN check and authenticated context. An
   MCP authoring bearer is not an application account: do not impersonate an
   actor or assume that `code-run` inherits the browser session. Sign in through
   the real application, then invoke setup with that ADMIN cookie jar.
   Initializing twice must preserve a user's edits. A model write never runs a
   migration or resets data implicitly.
5. Create home/sign-in, my equipment and administration pages before navigation
   links. Use `code-get`, `frontend-svelte-action` with `actionId:"dev.ensure"`
   and `wait:false`, then revisioned `code-set`/`code-patch` writes. Add the
   `EntityTable` and `EntityForm` palette entries; keep named cell, field and
   action snippets for business presentation. Bind OnSelect to page row state
   and EntityForm.row; OnCancel clears/closes the editor; OnSaved/OnDeleted
   clear the row and change the table's
   refreshKey. Use a separate New command to open an empty form. Increment refreshKey with the existing
   UpdateNumber action, operation:"increment", step:1. Do not execute free
   browser expressions inside SetValue. The user page requests its own
   perimeter; the admin page requests all rows. The server checks both requests.
6. Build a shared Layout with session refresh on navigation, role-dependent
   links, PageContent and sign-out. The Flow Svelte syntax and session lifecycle
   are in `flow://guide/multipage-roles`; use the real user manager logout here. Display a Status bound to the sign-in
   CallSequence action, for example `<Status $$id="loginStatus"
   actionId="signInCall" />`. CallSequence transport/Flow failures live in action
   error state and may not write its $$out; binding only page.login.error hides
   them. Keep a separate result message for normal business-error responses. After successful sign-in, send ADMIN to
   administration and USER to their own equipment.
   Mark protected facades with the required accessibility/session settings.
   CurrentSession must answer authenticated:false normally for anonymous callers,
   resolve active-account roles on every authenticated call, and never accept
   roles from a parameter. Guard the user page before mounting its table; guard
   the admin page with the returned admin permission. Recheck after navigation;
   the server still enforces every data operation.
7. Prove the model revision conflict and invalid-write refusal; then sign in as
   two ordinary users and an administrator. Test own and foreign rows, hidden
   JSON fields, an invalid responsible user, future date, stale revision and
   any installed delete/immutable/journal behavior. Verify user and admin pages
   with `frontend-svelte-action` `actionId:"dev.open"` and the relayed verifier.
   Preserve the tool-call count separately from protocol/resource requests.

The scripted construction fixture in this library uses only MCP tools to write
application sources. Its optional deployment step uses a separate real ADMIN
session to initialize twice, then signs out; those HTTP calls are counted
separately. Build and publish the production output with
`frontend-svelte-action` `actionId:"build"`. Prove the actual published URL
returned by the action, with host/port adapted to the server's public endpoint.
A successful build is not an interaction test: sign in as USER and ADMIN in
separate browser sessions, select an existing row, edit, save, observe the table
refresh, reproduce a revision conflict, reload, delete as permitted and sign out.

Before handing the exercise to another agent, record the model revision, saved
Flow/page sources, actual role test results and remaining mocks from
`flow-block-mock-list`. Keep initialization restricted to ADMIN; keep authentication administration and
journal mutation private. Do not claim production readiness from this recipe:
qualify the configured database and session provider and review audit retention.
