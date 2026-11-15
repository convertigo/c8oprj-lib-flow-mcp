# Multi-Page Business Application by Entities

Role-based multi-page application by entities: quick path and declarations; access rules and pages, exports, jobs and proof in sub-guides.

For the simplest compliant start with persisted business data and roles, use **Short path** in `flow://guide/entities`, then follow this recipe.

## Quick path: contract first, details below

Before writing pages that display, create or edit entity data, read `flow://guide/entities-widgets`. Use `EntityTable`, `EntityForm`, `EntityView`, `EntityStat` and `EntityBreakdown`; `flow://guide/entities-widgets/stat` covers dashboards and `flow://guide/entities-widgets/view` covers record views. Build custom tables, forms or KPIs only when these widgets cannot cover the need.

1. Bootstrap with `flow-project-bootstrap` and direct references to
   `lib_flow_entity`, `lib_flow_sql`, `lib_flow_crud_data`; set `ui:true` when
   a Svelte application is needed. Do not generate CRUD sources.
2. Read **Your own HTTP contract over entities** in `flow://guide/entities/http`
   first when Flow names, JSON keys or error codes are imposed. They do not
   require direct SQL: ordinary public Flows wrap `entity.*`.
3. Configure one SQL connection and declare Room/Reservation once with
   `flow-entity-model-check` then `flow-entity-model-set` using its revision,
   with `gateway: true` because step 10 uses EntityTable/EntityForm.
   Keep IDs/revisions as text and dates as ISO; no duplicate business schema.
4. Install the private `app.actor` from the entities guide. It reads only the
   authenticated server session and the server directory; never client roles.
5. For a demo, install `DemoLogin`, `CurrentUser` (`me`) and `Logout` of `flow://guide/multipage-entities-access`.
   Prepare only neutral demo accounts; leave the demo switch off by default.
   Prefer `lib_UserManager` for real accounts/passwords, not for a demo picker.
6. Edit scaffolded `app.entityAccess` with the policy of `flow://guide/multipage-entities-access`: USER sees their
   rows (with `Possédé`), MANAGER/ADMIN sees all. `publicRead` explicitly
   opens selected entities. Writes stay closed until this application decision.
7. Declare the typed entity demo seed below and call the private Studio `demo_reset`
   through internal tooling before demo sign-in. An HTTP entry point must require ADMIN.
   Its guard belongs to the application; the library imposes none.
8. Add the private BookingRule hook of `flow://guide/multipage-entities-access`. It locks the room, checks overlap
   across all owners, and throws on refusal; data and audit roll back together.
   For an imposed 409, use HttpBookingRule from the entities guide instead.
9. Expose only the named Flows your HTTP contract needs: guard the session,
   validate inputs, call entity.list/read/save/delete with checkAccess:true,
   translate known errors, then return exact keys. A refusal answers 200 with an `ENTITY_*` code; a hidden and an absent row answer the same 404 `ENTITY_NOT_FOUND`.
10. Add EntityTable/EntityForm without targetProject: they use this application
    EntityGateway. Put New in its Toolbar, guarded by context.permissions.create;
    wire select to the form and saved/deleted to refresh, as in `flow://guide/multipage-entities/pages`.
11. Add CSV through the same authorized entity list, Journalisé with an
    allowlist, and a private scheduled worker as independent additions.
    No fabricated browser actor for jobs; keep their switch off by default.
12. Verify anonymous, USER and MANAGER paths, a foreign row, invalid input,
    overlap, stale revision, deletion and logout. Promote the verified Flows.

The detail follows. Keep app.entityAccess as the unique application policy;
only the small HTTP facade adapts names, error codes and response keys.

Use this route for persisted business data with roles. Authentication, exports
and scheduled work are additions, not a reason to choose direct SQL. This
recipe uses a small project account table for a **demo disabled by default**;
replace that provider with `lib_UserManager` for real accounts and passwords.
It extends the entity recipe rather than replacing the explicit SQL escape
hatch in `flow://guide/multipage-roles`.

A refusal by a policy, model ACL or authorization slot, including on a relation target needed by options or validation, triggers no DDL (a refused target only omits labels); a refusal depending on data or a hook can occur after schema creation.


## Drawers

- `flow://guide/multipage-entities/setup` — open for the model, connection, seed and private demo reset.
- `flow://guide/multipage-entities-access` — open for demo login, me/logout, access policy and hook.
- `flow://guide/multipage-entities/pages` — open for pages and event wiring.
- `flow://guide/multipage-entities/operations` — open for CSV, jobs and audit.
- `flow://guide/multipage-entities/proof` — open for final proof and delivery.

The proof guide covers browser context reuse, sign-out and the development session limit.
