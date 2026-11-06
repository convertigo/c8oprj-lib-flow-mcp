# Flow Generated CRUD

Generate CRUD only on an explicit request: the model, the generation modes, preview and proof; business logic on top in a sub-guide.

Use this generated path only when the user explicitly requests generated
CRUD. For any persisted business data with roles, the default is interpreted
entities: `flow://guide/entities`, then `flow://guide/multipage-entities`.
Authentication, CSV export and scheduled jobs do not select generated CRUD
or direct SQL (`flow://guide/start`).

## When to use it

When the user explicitly requests generated CRUD, use this guide before
writing generated CRUD Flows or pages. It suits a set of entities with list,
detail and form screens:
reference data managed by an administrator, records with a status, relations
between them, roles that may read or change each entity. One model gives the
SQL schema and seed, the secured Flows, the session and the pages in seconds;
your own work then goes to the business rules the model cannot express.

Do not use it for an application without tables of records (an API relay, a
FullSync application, a calculator): follow `flow://guide/start` instead.

## The model

`spec` uses the legacy Convertigo CRUD format. Everything but `entities` is
optional: `project` defaults to the target project (another name is refused
with its fix), a missing `database` is the HSQLDB development database of the
project, `facade.prefix` defaults to `crud`, `seed` to two sample rows per
entity, `security` to no role map (every signed-in user has the role
`authenticated`), `ui` to every field.

```json
{
  "facade": {"prefix": "desk"},
  "database": {"mode": "hsqldb", "database": "desk", "connection": "desk"},
  "security": {"principals": {"ada": "agent", "max": "manager"}, "demoLogin": true},
  "entities": [
    {"name": "teams", "label": "Teams",
     "fields": [
       {"name": "Id", "type": "INTEGER", "primary": true},
       {"name": "Name", "type": "VARCHAR(80)", "required": true, "unique": true},
       {"name": "Email", "type": "VARCHAR(120)"}],
     "permissions": {"list": ["agent", "manager"], "read": ["agent", "manager"], "count": ["agent", "manager"], "save": ["manager"], "delete": ["manager"]}},
    {"name": "tickets", "label": "Tickets",
     "fields": [
       {"name": "Id", "type": "INTEGER", "primary": true},
       {"name": "Title", "type": "VARCHAR(120)", "required": true},
       {"name": "Status", "type": "VARCHAR(16)", "required": true, "enum": ["open", "in_progress", "resolved"], "default": "open"},
       {"name": "TeamId", "column": "team_id", "type": "INTEGER", "required": true},
       {"name": "Assignee", "type": "VARCHAR(40)"},
       {"name": "OpenedAt", "column": "opened_at", "type": "TIMESTAMP", "required": true, "auto": "create"},
       {"name": "UpdatedAt", "column": "updated_at", "type": "TIMESTAMP", "required": true, "auto": "update"},
       {"name": "ResolvedAt", "column": "resolved_at", "type": "TIMESTAMP"}],
     "permissions": {"list": ["agent", "manager"], "read": ["agent", "manager"], "count": ["agent", "manager"], "create": ["agent", "manager"], "update": ["agent", "manager"], "delete": ["manager"]},
     "ui": {
       "listFields": ["title", "status", "team_id", "assignee", "updated_at"],
       "detailFields": ["title", "status", "team_id", "assignee", "opened_at", "updated_at", "resolved_at"],
       "formFields": ["title", "status", "team_id", "assignee", "resolved_at"],
       "fieldLabels": {"team_id": "Team", "opened_at": "Opened", "updated_at": "Updated", "resolved_at": "Resolved"},
       "fieldOptions": {"status": [{"value": "open", "label": "Open"}, {"value": "in_progress", "label": "In progress"}, {"value": "resolved", "label": "Resolved"}]}}},
    {"name": "events", "label": "Events", "readOnly": true,
     "fields": [
       {"name": "Id", "type": "INTEGER", "primary": true},
       {"name": "TicketId", "column": "ticket_id", "type": "INTEGER", "required": true},
       {"name": "Kind", "type": "VARCHAR(16)", "required": true, "enum": ["created", "resolved"]},
       {"name": "Actor", "type": "VARCHAR(40)", "required": true},
       {"name": "LoggedAt", "column": "logged_at", "type": "TIMESTAMP", "required": true, "auto": "create"}],
     "permissions": {"list": ["manager"], "read": ["manager"], "count": ["manager"]}}
  ],
  "relations": [
    {"name": "ticket_team", "type": "many-to-one", "fromEntity": "tickets", "fromField": "team_id", "toEntity": "teams", "toField": "id", "required": true, "label": "Team"},
    {"name": "event_ticket", "type": "many-to-one", "fromEntity": "events", "fromField": "ticket_id", "toEntity": "tickets", "toField": "id", "required": true, "label": "Ticket"}
  ],
  "seed": {"enabled": true, "data": {
    "teams": [{"id": 1, "name": "Hardware", "email": "hardware@example.com"}, {"id": 2, "name": "Software"}],
    "tickets": [{"id": 1, "title": "Laptop does not start", "status": "open", "team_id": 1, "assignee": "ada"},
                {"id": 2, "title": "License renewal", "status": "in_progress", "team_id": 2, "assignee": "max"}]}},
  "ui": {"title": "Service desk", "language": "en",
         "navigation": [{"page": "my_tickets", "label": "My tickets", "permission": "tickets.list"}]}
}
```

- Entity names: the format names an entity by its plural, as the legacy
  Convertigo CRUD did. A name that does not end in `s` takes one (`y` gives
  `ies`): `order_line` generates the table, the Flows
  (`<prefix>_order_lines_list`...), the pages and the route `/order-lines`.
  The preview lists the generated names in `names` and says when it renamed
  an entity; name it in the plural, or add `"plural": "order_line"` to keep
  the given name.
- Fields: `name`, optional `column` (default: the name in lower case,
  `TeamId` becomes `teamid`; set `"column": "team_id"` for another), `type` (`VARCHAR(n)`, `TEXT`, `INTEGER`,
  `BIGINT`, `DECIMAL(p,s)`, `BOOLEAN`, `DATE`, `TIMESTAMP`), `required`,
  `unique`, `default`, `label` (shown in forms and tables; default: the
  relation label for a foreign key, else the name humanized, `TeamId` becomes
  `Team id`). Every other name in the model (ui lists, relations,
  seed rows, permissions) uses the column name.
- Key: one `INTEGER` field `Id` with `primary: true`, generated by the database.
- `TIMESTAMP` is a local time to the millisecond. `auto: "create"` stamps it
  at creation, `auto: "update"` at creation and every update, on the server;
  callers and forms cannot set it, seeds leave it to the server.
  `TIMESTAMP WITH TIME ZONE` is refused.
- `enum` lists the allowed values, checked by the generated save Flow;
  `ui.fieldOptions.<column>` gives their labels (badges take the tones info,
  warning, success, neutral in order).
- Relations are many-to-one, to the key of the target; the label shown is the
  first text field of the target, or `ui.relationFields.<column>.optionLabelField`.
- `seed.data` rows are keyed by column, with explicit ids; without `data`,
  `rowsPerEntity` sample rows. A replayed seed never overwrites user writes.
- `permissions.<operation>` (`list`, `read`, `count`, `create`, `update`,
  `delete`, or `save` for the writes not listed) is a role list, or `false`.
  Default: reads for `authenticated`, `reader`, `editor`; writes for
  `authenticated`, `editor` (none for a `generate: "data"` entity).
  `readOnly: true` generates no write Flow nor form.
- `security.principals` maps each user name to its role. The role comes
  from this map only (see Limits).
- `security.demoLogin: true` (off by default) generates `desk_demo_login`:
  one anonymous call opens a session as any of these accounts, an admin
  included. Keep it for demos; it is never generated without the generated
  sign-in page (`ui.loginPage: false`, `ui.generate: "none"`).
- `security.accounts: {"entity": "members", "login": "login", "active": "active"}`
  binds users to an entity: every generated Flow and the demo sign-in refuse
  an unknown account, or one whose `active` field is not true.
- `revision: "revision"` on an entity adds optimistic concurrency; omitted,
  the last write wins.

## Preview, apply, prove

1. `flow-project-bootstrap({project, ui: true})` for a new project.
2. `flow-crud-upsert({project, spec, dryRun: true})`. Read `status`,
   `diagnostics` (each with `code`, `message` and, when known, `line`,
   `block`, `fix`), `names` (per entity: its Flows, pages and route),
   `references.missing` and `sql.plan.statements`.
   `blocked`: fix each error diagnostic and preview again.
3. `flow-crud-upsert({project, spec, planHash})` with the `planHash` of the
   preview. Apply adds the missing references (`lib_flow_sql`,
   `lib_flow_crud_data`, `lib_flow_frontbuilder_svelte`), writes the model to
   `_flow/data/model.yaml`, the Flows and pages, creates or migrates the
   database and seeds it. `FLOW_CRUD_PLAN_STALE`: preview again.
4. `flow-crud-proof({project})`: every generated file matches the model and
   nothing is left to apply. Then prove rights over HTTP: sign in with each
   demo account in its own cookie jar (`<prefix>_demo_login` with `user`) and
   call the Flows; an anonymous call is refused.
5. Build the pages with `frontend-svelte-action`.

Without `spec`, both tools use the stored `_flow/data/model.yaml`.

## Evolve the model

Change the model and preview again; `schemaVersion` increases by itself.
The database plan is additive: new entities, relations, and fields that are
nullable or have a `default` (`ALTER TABLE ... ADD COLUMN ... DEFAULT`). A
removed or renamed field is refused (`SQL_SCHEMA_MIGRATION_UNSUPPORTED`), and
so is a removed entity (`FLOW_CRUD_REMOVAL_UNSUPPORTED`; `generate: "data"`
drops its pages instead): add a new field and
stop using the old one. A new required field on a filled table needs a
`default`.

## Before delivery

- `flow-crud-proof` is ok, and each demo account was proven over HTTP.
- No generated screen offers an operation that a business rule forbids:
  sign in with each role and open every generated list, detail and form.

## Limits

- Roles come only from `security.principals` (or `authenticated` for every
  signed-in user when it is empty); they cannot come from `lib_UserManager`
  or another identity provider yet. Outside a demo, sign in with that
  provider and list its user names in `principals`.
- `rowPolicy` is the owner form only. For a restricted role, the generated
  list has no search or caller filter (the owner filter takes its one
  predicate), and the read hides the labels of related rows under a row
  policy.
- Keys are one generated integer; no composite or text key.
- Indexes are refused (`SQL_PORTABLE_INDEX_NOT_IMPLEMENTED`); relations are
  many-to-one only, without cycles.
- Removals and renames are not migrated.
- Generated texts follow `ui.language`: French by default, English for
  `en` and any other language, whose number and date formats still apply.

## Sub-guides

The rest of this guide is in focused sub-guides; read one only when the task needs it, once.

| Sub-guide (size) | Read it |
| --- | --- |
| `flow://guide/crud-modes` (5.3 KB) | choosing `generate` (full, data, flows) and entities with business rules |
| `flow://guide/crud-business` (14.2 KB) | after generation: owned files, business Flows, transactions, per-user data, own pages, CSV, jobs |
