# Flow CRUD Fast Path

Build a data application from an entity model with flow-crud-upsert, then add hand-written business Flows and pages on top of what it generates.

## When to use it

Use it first, before writing any CRUD Flow or page by hand, when the
application is mostly a set of entities with list, detail and form screens:
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

## Choose a generation mode

| Application kind | Model |
|---|---|
| reference data / back office | `generate: "full"` (default) |
| business application, own Flows and pages | `"schema"` for the entities your Flows read and write with `data.read` / `data.write` or `sql.*`; `"data"` when a page needs the generated `list` / `read` / `options`; `"full"` only for admin reference tables |
| business workflow on generated reads | `"data"` for workflow entities, `rowPolicy` for owner perimeters, `ui.homePage` / `ui.loginPage` to business pages |

A business application uses `"schema"` or `"data"`, never `"full"` for its
business entities: the generated `list|read|save` Flows do not carry business
rules, and copying them costs more than calling the data sources directly.

- `"full"`: table, seed, sources, the Flows `list|read|count|options|save|delete`,
  pages (list, detail, form) and a shell entry.
- `"data"`: table, seed, sources `<entity>_read` / `<entity>_write`, and
  `list|read|count|options`. No page, no shell entry, no `save` / `delete`
  unless `permissions` names the roles. Business Flows own the mutations.
- `"schema"`: table, seed and sources `<entity>_read` / `<entity>_write`
  only. No Flow, no page, no shell entry, no session permission. Business
  Flows call `data.read({source:"<entity>_read", filter, orderBy, limit})`,
  `data.write({source:"<entity>_write", operation, key, revision, patch})` or
  `sql.*`. A generated form cannot list the options of a `"schema"` entity:
  relate a `"full"` entity to it only with `ui.generate: "none"`, or make the
  target `"data"`.
- root `ui.generate: "none"`: no shell, sign-in, home or page at all; your
  pages call the generated Flows and `desk_session`.
- `flow-crud-upsert` previews `names[]` and `next` list the Flows each
  entity generates: read them before writing code.

Example, assets assigned to owners, with check-ins and reminders:

```json
"security": {"principals": {"ada": "member", "max": "admin"},
             "accounts": {"entity": "members", "login": "login", "active": "active"}},
"ui": {"homePage": "my_assets", "loginPage": "sign_in",
       "navigation": [{"page": "my_assets", "label": "My assets"}]},
"entities": [
 {"name": "categories", "permissions": {"list": ["member", "admin"], "read": ["member", "admin"], "save": ["admin"]}},
 {"name": "members", "generate": "data", "permissions": {"list": ["admin"], "read": ["admin"]}},
 {"name": "assets", "generate": "data", "permissions": {"list": ["member", "admin"], "read": ["member", "admin"], "count": ["member", "admin"]},
  "rowPolicy": {"field": "owner_id", "equals": "account.id", "unrestricted": ["admin"]}},
 {"name": "checkins", "generate": "data", "permissions": {"list": ["member", "admin"], "read": ["member", "admin"]},
  "rowPolicy": {"field": "member_id", "equals": "account.id", "unrestricted": ["admin"]}},
 {"name": "reminders", "generate": "data", "permissions": {"list": ["admin"], "read": ["admin"]}}]
```

(fields omitted). `categories` keeps its generated back office; check-in,
assignment and the reminder job are business Flows that write through
`checkins_write` / `assets_write`.

Switching an applied entity from `full` to `data` (or `readOnly: true`,
`ui.generate: "none"`, the demo sign-in off) is additive: a Flow the model no
longer generates stays owned and refuses every call (`GONE`, 410); a page
stays on disk, unlinked from the generated ones, and the preview reports it
released (`FLOW_CRUD_FILE_RELEASED`): delete it or keep it as your own.

## Entities with business rules

When the writes of an entity follow business rules (state changes, an audit
trail, constraints across tables), the generic save and delete bypass them.
Declare them off, route every write through a business Flow, and link the
business pages in the shell:

```json
{"name": "tickets", "label": "Tickets", "fields": ["..."],
 "permissions": {"list": ["agent", "manager"], "read": ["agent", "manager"], "count": ["agent", "manager"], "save": false, "delete": false},
 "ui": {"navigation": false}}
```

and at the root of the model
`"ui": {"navigation": [{"page": "ticket_desk", "label": "Tickets", "permission": "tickets.list"}]}`.

- `desk_tickets_save` and `desk_tickets_delete` refuse every role, and no
  generated page offers New, Edit or Delete; the list and detail stay,
  read-only. `ui.navigation: false` drops the generic list from the shell,
  where `ticket_desk` takes its place.
- `permissions.tickets.update` of the session is now `false`: your business
  Flows check the role (`local.session.role`), then apply the rules and
  write the audit row in the same transaction (below).
- `generate: "data"` goes further: no generic page at all.

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

## What is generated and owned

Every generated file starts with an `@generated` comment and belongs to the
model: never edit it with `code-set` (refused) or by patching; change the model
and apply again. A hand edit makes the next apply fail with
`FLOW_CRUD_GENERATED_CONFLICT` and the proof report it.

| Flow (prefix `desk`) | Inputs | Result |
| --- | --- | --- |
| `desk_<entity>_list` | `offset`, `limit` (1-200), `search`, `filter`, `orderBy`, `direction`, `includeResource` (default false) | `page.rows[]` (`key`, `values`, `displayValues` with relation labels, `canRead`, `canUpdate`, `canDelete`), `page.total`; `resource` only with `includeResource: true` |
| `desk_<entity>_read` | `id` | `row` (`key`, `values`, `displayValues` with relation labels); 404 when absent |
| `desk_<entity>_count` | none | `rows[0].total` |
| `desk_<entity>_options` | `labelField` | `rows[]` (`value`, `label`), at most 200 |
| `desk_<entity>_save` | `id` (empty to create), `revision`, `patch` (object) | the data write result |
| `desk_<entity>_delete` | `id`, `revision` | the data write result |
| `desk_session` | none | `authenticated`, `user`, `role`, `permissions.<entity>.<operation>` |
| `desk_demo_login`, `desk_logout` | `user` / none | sign in (demo only) / sign out |
| `desk_initialize`, `desk_runtime_proof` | none | private: schema and seed / read-only checks |

A list resolves the labels of its relations with one `data.read` per
relation over the keys of the page (`filter: {field, op: "in", value: keys}`,
at most 200), then looks each row up in a map. A business Flow that shows
related labels does the same: never one read per row.

Each generated Flow carries in its `_flow.config` only the connection, named
queries, writes, data sources and `crud` settings its body names;
`_flow/data/config.generated.json` keeps the whole configuration. A business
Flow that calls `data.read` / `sql.query` on a generated source or query
declares that entry in its own `config` (copy it from
`config.generated.json`), or the project carries it once in `engine.yaml`
`config` (inherited by every Flow of the project).

Each entity Flow checks the session and the role on the server, whatever
calls it. Pages: `+layout.flow.svelte` (an `AppShell` with one link per
entity, unless its `ui.navigation` is `false`, and the root `ui.navigation`), the dashboard (`crud_dashboard`, or a redirection
to `ui.homePage`), `login` (`crud_login`; `ui.loginPage` replaces it as the
sign-in the pages lead to) and, per entity, `<entity>` (`<entity>_list`),
`<entity>/detail` and `<entity>/form`. SQL lives in
`_flow/resources/sql/crud` (`schema.json`, `data.json`, the HSQLDB database).

## Evolve the model

Change the model and preview again; `schemaVersion` increases by itself.
The database plan is additive: new entities, relations, and fields that are
nullable or have a `default` (`ALTER TABLE ... ADD COLUMN ... DEFAULT`). A
removed or renamed field is refused (`SQL_SCHEMA_MIGRATION_UNSUPPORTED`), and
so is a removed entity (`FLOW_CRUD_REMOVAL_UNSUPPORTED`; `generate: "data"`
drops its pages instead): add a new field and
stop using the old one. A new required field on a filled table needs a
`default`.

## Add business logic

Hand-written Flows and pages live next to the generated ones under their own
names; apply never touches them.

### Call the generated Flows

A business Flow reuses the model rights by calling the generated Flows in the
same session: `requestable.call` returns their result.

```javascript
local.session = requestable.call({ requestable: ".desk_session" })
if (!local.session.permissions.tickets.update) {
  throw({ code: "FORBIDDEN", message: "Role denied", status: 403 })
}
local.ticket = requestable.call({ requestable: ".desk_tickets_read", input: { id: input.id } })
```

The generated data sources (`tickets_read`, `tickets_write`) and named SQL
live in the `_flow.config` of each generated Flow: your Flows do not inherit
them, so `data.read({ source: "tickets_read" })` fails in a business Flow.
Copy the connection instead (next section).

### Business actions in a transaction

For an operation over several tables, declare in the business Flow's own
`_flow.config` the connection of `_flow/data/config.generated.json`
(`sql.connections.<connection>`, same name and values) and your own named
writes, with names of your own. `auto` stamps timestamps on the server here too.

```javascript
const _flow = {
  sourceVersion: 2,
  accessibility: "hidden",
  authenticatedContextRequired: true,
  inputs: { id: { type: "string" } },
  config: {
    sql: {
      connections: {
        desk: { url: "jdbc:hsqldb:file:.//_flow/resources/sql/crud/database/desk;shutdown=false", dialect: "hsqldb", driverClass: "org.hsqldb.jdbc.JDBCDriver", user: "root", password: "", nativeRead: true, nativeWrite: true },
      },
      writes: {
        ticket_resolve_update: {
          connection: "desk", operation: "update", minAffectedRows: 1, maxAffectedRows: 1,
          sql: "UPDATE \"PUBLIC\".\"tickets\" SET \"status\"='resolved', \"resolved_at\"=:resolved_at, \"updated_at\"=:updated_at WHERE \"id\"=:id AND \"status\"<>'resolved'",
          parameters: [{ name: "resolved_at", type: "timestamp", auto: "update" }, { name: "updated_at", type: "timestamp", auto: "update" }, { name: "id", type: "int64" }],
        },
        ticket_resolve_event: {
          connection: "desk", operation: "insert", minAffectedRows: 1, maxAffectedRows: 1, generatedKey: { column: "id", type: "int64" },
          sql: "INSERT INTO \"PUBLIC\".\"events\" (\"ticket_id\", \"kind\", \"actor\", \"logged_at\") VALUES (:ticket_id, 'resolved', :actor, :logged_at)",
          parameters: [{ name: "ticket_id", type: "int64" }, { name: "actor", type: "string" }, { name: "logged_at", type: "timestamp", auto: "create" }],
        },
      },
    },
  },
}

function ticket_resolve({ input, config, result }) {
  local.session = requestable.call({ requestable: ".desk_session" })
  if (local.session.role !== "agent" && local.session.role !== "manager") {
    throw({ code: "FORBIDDEN", message: "Role denied", status: 403 })
  }
  local.ticket = requestable.call({ requestable: ".desk_tickets_read", input: { id: input.id } })
  local.done = sql.transaction({ steps: [
    { id: "ticket", statement: "ticket_resolve_update", parameters: { id: input.id } },
    { id: "event", statement: "ticket_resolve_event", parameters: { ticket_id: input.id, actor: local.session.user } },
  ] })
  result.resolved = local.done.committed
}
```

Tables are `"PUBLIC"."<entity>"` on HSQLDB, columns the model column names,
quoted. A second resolve fails with `SQL_WRITE_ROW_COUNT` (409) and rolls
back. In production, override the connection once in the project
configuration (`configs.<name>.sql.connections.desk` in `_flow/engine.yaml`,
`flow://guide/tags`): it applies to generated and business Flows alike. If
the model changes its database, update your copy.

### Per-user data perimeter

An owner rule on an entity:

```json
"rowPolicy": {"field": "owner_id", "equals": "account.id", "unrestricted": ["admin"]}
```

A role not in `unrestricted` sees and writes only the rows whose `field`
equals its session value: `"user"` (the signed-in user name) or
`"account.<field>"` (that field of its `security.accounts` row). The generated
`list`, `read`, `count`, `options`, `save` and `delete` apply it on the
server: the list replaces any caller `filter` or `search` with the owner
filter, read/update/delete answer 404 for a row of someone else, and create
and update set the owner field. Any other form is refused
(`FLOW_CRUD_ROW_POLICY_UNSUPPORTED`). For a perimeter that is not an owner
rule, write a business Flow whose filter comes from the server:

```javascript
function my_tickets({ input, config, result }) {
  local.session = requestable.call({ requestable: ".desk_session" })
  if (!local.session.permissions.tickets.list) {
    throw({ code: "FORBIDDEN", message: "Role denied", status: 403 })
  }
  local.mine = sql.query({ query: "my_tickets_rows", parameters: { user: local.session.user } })
  result.rows = local.mine.rows
}
```

With `my_tickets_rows` declared as a named read (`readOnly: true`,
`expose: false`, the copied connection).

### Pages next to the generated ones

Write a page under its own route, for example
`src/routes/my-tickets/+page.flow.svelte` with `code-set` and `sourceFile`. The
generated root layout wraps it in the shell. Link it from the shell with
`ui.navigation` in the model (`page` is its `page.id`; `permission`, as
`<entity>.<operation>`, shows the link only when the session grants it), then
apply. Load the session first, as the generated pages do:

```svelte
<script module>
export const _flow = { sourceVersion: 2, page: { id: "my_tickets", title: "My tickets" } };
</script>
<FlowComponent $$id="my_tickets">
<Variables><State $$id="viewReady" type="boolean" value={false} /></Variables>
<Structure>
<PageHeader $$id="header" title="My tickets" description="Tickets assigned to you." />
<If $$id="ready" test="@page.viewReady"><Then>
<DataTable $$id="mine" caption="My tickets" source="@.my_tickets.rows" rowKey="id" columns={[{"key":"title","path":"title","label":"Title"},{"key":"status","path":"status","label":"Status","format":"badge"}]} rowActions={[{"id":"open","label":"Open","page":"tickets_detail","query":{"id":"id"}},{"id":"resolve","label":"Resolve"}]}><Events><OnClick $$id="rowCommand"><Actions><CallSequence $$id="resolveTicket" requestable=".ticket_resolve"><Variables><Variable name="id" value="@event.value.row.id" /></Variables></CallSequence><CallSequence $$id="reloadMine" requestable=".my_tickets"><Variables></Variables></CallSequence></Actions></OnClick></Events></DataTable>
</Then></If>
<Status $$id="statusResolve" actionId="resolveTicket" successText="Ticket resolved." />
</Structure>
<Events><OnMount $$id="mount"><Actions><CallSequence $$id="loadSession" requestable=".desk_session"><Variables></Variables></CallSequence><If $$id="signedIn" test="@.desk_session.authenticated"><Then><CallSequence $$id="loadMine" requestable=".my_tickets"><Variables></Variables></CallSequence><SetValue $$id="markReady" target="page.viewReady" value={true} /></Then><Else><Navigate $$id="needLogin" page="crud_login"></Navigate></Else></If></Actions></OnMount></Events>
</FlowComponent>
```

The generated pages, dashboard included, cannot be changed by hand: add a
page instead of editing one.

### Your own home and sign-in pages

The generated shell has a home (the dashboard `crud_dashboard`, at `/`) and a
sign-in (`crud_login`, the demo account picker, at `/login`). To give them to
your pages, name them by their `page.id` at the root of the model:

```json
"ui": {"homePage": "my_tickets", "loginPage": "sign_in",
       "navigation": [{"page": "my_tickets", "label": "My tickets"}]}
```

- `ui.homePage`: the home of the shell and where the demo sign-in leads; the
  dashboard leaves the navigation, and `/` sends a signed-in user to it (an
  anonymous one to the sign-in).
- `ui.loginPage`: where every generated page sends an anonymous user, and
  where sign-out leads. Your sign-in page loads the session without
  requiring it, signs in (`session.authenticate` in a business Flow), then
  navigates to the home page; the pages above then send to `sign_in`, not
  `crud_login`.
- `crud_dashboard` and `crud_login` stay generated, unlinked. `false`
  generates neither: `"homePage": false` leaves `/` to your page (the first
  `ui.navigation` page is the home of the shell), `"loginPage": false` drops
  `/login` and the demo sign-in Flow.

### CSV export

Export what the user may see by calling the generated list with
`includeResource: true` (a list answers only `page` otherwise), then `data.csv`
with its `resource` and rows (`flow-block-get` gives the `data.csv` contract):

```javascript
local.list = requestable.call({ requestable: ".desk_tickets_list", input: { offset: 0, limit: 200, includeResource: true } })
local.file = data.csv({ resource: local.list.resource, rows: local.list.page.rows, filename: "tickets.csv" })
result.file = local.file
```

A button of a page saves that file in two actions: the `CallSequence` of the
export Flow, then `FileDownload` (the `file.download` block) on its answer. A
`CallSequence` alone only receives the CSV text: nothing is saved.

```svelte
<Button $$id="exportCsv" label="Export CSV"><Events><OnClick><Actions>
  <CallSequence $$id="export" requestable=".desk_tickets_export"><Variables><Variable name="status" value="@page.status" /></Variables></CallSequence>
  <FileDownload $$id="saveCsv" content="@.desk_tickets_export.file.content" filename="@.desk_tickets_export.file.filename" mimeType="@.desk_tickets_export.file.mimeType" />
</Actions></OnClick></Events></Button>
```

In the Studio viewer, Playwright receives no `download` event for that
file (`page.waitForEvent('download')` never fires there): click, then read
the file the viewer saved in `.playwright-mcp/downloads/` of the working
directory.

A list returns at most 200 rows: call it again with the next `offset` until
`page.total`, or export a named read of your own. If `data.csv` answers
`DATA_CSV_SCHEMA_INVALID` on a `timestamp` field, your `lib_flow_crud_data`
predates timestamp export: pass flat rows (`list.map` over `page.rows`) with
typed `columns`. Serve the file from a `.bin` facade with `file.respond`
(`flow://guide/multipage-roles`).

### Scheduled jobs

A job has no session, so the generated entity Flows refuse it
(`UNAUTHENTICATED`). Write a private Flow that works through named SQL with
the copied connection, as a business action does, bounded and idempotent;
schedule it as `flow://guide/multipage-roles` shows.

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
