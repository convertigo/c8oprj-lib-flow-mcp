# Flow Generated CRUD: Owned Code And Business Logic

What generated CRUD owns, then hand-written business Flows, transactions, per-user data, pages, sign-in, CSV and jobs on top.

Sub-guide of `flow://guide/crud`: read that guide first.

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
| `desk_<entity>_save` | `id` (empty to create), `revision`, `patch` (object) | the data write result: `{resource, mutation}`, the row in `mutation.row.values` |
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
Flow that calls `data.read` / `data.write` on a generated source finds it in
the project `config` of `_flow/engine.yaml`, where apply registers it once
(Call the generated Flows), not in a copy inside each Flow.

Each entity Flow checks the session and the role on the server, whatever
calls it. Pages: `+layout.flow.svelte` (an `AppShell` with one link per
entity, unless its `ui.navigation` is `false`, and the root `ui.navigation`), the dashboard (`crud_dashboard`, or a redirection
to `ui.homePage`), `login` (`crud_login`; `ui.loginPage` replaces it as the
sign-in the pages lead to) and, per entity, `<entity>` (`<entity>_list`),
`<entity>/detail` and `<entity>/form`. SQL lives in
`_flow/resources/sql/crud` (`schema.json`, `data.json`, the HSQLDB database).

## Add business logic

Hand-written Flows and pages live next to the generated ones under their own
names; apply never touches them.

### Call the generated Flows

A business Flow reuses the model rights by calling the generated Flows in the
same session: `requestable.call` returns their result.

```javascript
local.session = requestable.call({ requestable: ".desk_session" })
if (!local.session.permissions.tickets.update) {
  throw { code: "FORBIDDEN", message: "Role denied", status: 403 }
}
local.ticket = requestable.call({ requestable: ".desk_tickets_read", input: { id: input.id } })
```

Apply registers the connection (`sql.connections.<connection>`), the SQL
initializer (`sql.initializers.desk`: `schemaFile` and `dataFile` of the model),
`data.providers.sql` and every generated source (`tickets_read`,
`tickets_write`) once in the project `config` of `_flow/engine.yaml` (the
preview lists them in `projectConfig.set`): every Flow of the project inherits
them, so a business Flow calls `data.read({ source: "tickets_read" })` with no
configuration of its own. Never paste them into a business Flow. A
`sql.table` source that a business Flow declares on a table of the model
inherits `auto: create|update` of its timestamp columns from that initializer,
so create works without repeating `auto`; the registered initializer runs
nothing by itself: only `desk_initialize` (called by apply) creates and seeds
the tables. The model owns these paths: change the model, not `engine.yaml`
(a value changed by hand blocks the next preview with
`FLOW_CRUD_CONFIG_CONFLICT`), and override the connection per server in a named
configuration (below). The named SQL of the
generated Flows stays in their own `_flow.config`.

### Business actions in a transaction

For an operation over several tables, declare your own named writes in the
business Flow's own `_flow.config`, with names of your own, on the connection
of the model (`desk` here), which the project configuration already carries.
`auto` stamps timestamps on the server here too.

```javascript
const _flow = {
  sourceVersion: 2,
  accessibility: "hidden",
  authenticatedContextRequired: true,
  inputs: { id: { type: "string" } },
  config: {
    sql: {
      writes: {
        ticket_resolve_update: {
          connection: "desk",
          operation: "update",
          minAffectedRows: 1,
          maxAffectedRows: 1,
          sql: "UPDATE \"PUBLIC\".\"tickets\" SET \"status\"='resolved', \"resolved_at\"=:resolved_at, \"updated_at\"=:updated_at WHERE \"id\"=:id AND \"status\"<>'resolved'",
          parameters: [
            { name: "resolved_at", type: "timestamp", auto: "update" },
            { name: "updated_at", type: "timestamp", auto: "update" },
            { name: "id", type: "int64" },
          ],
        },
        ticket_resolve_event: {
          connection: "desk",
          operation: "insert",
          minAffectedRows: 1,
          maxAffectedRows: 1,
          generatedKey: { column: "id", type: "int64" },
          sql: "INSERT INTO \"PUBLIC\".\"events\" (\"ticket_id\", \"kind\", \"actor\", \"logged_at\") VALUES (:ticket_id, 'resolved', :actor, :logged_at)",
          parameters: [
            { name: "ticket_id", type: "int64" },
            { name: "actor", type: "string" },
            { name: "logged_at", type: "timestamp", auto: "create" },
          ],
        },
      },
    },
  },
}

function ticket_resolve({ input, config, result }) {
  local.session = requestable.call({ requestable: ".desk_session" })
  if (local.session.role !== "agent" && local.session.role !== "manager") {
    throw { code: "FORBIDDEN", message: "Role denied", status: 403 }
  }
  local.ticket = requestable.call({ requestable: ".desk_tickets_read", input: { id: input.id } })
  local.done = sql.transaction({
    steps: [
      { id: "ticket", statement: "ticket_resolve_update", parameters: { id: input.id } },
      { id: "event", statement: "ticket_resolve_event", parameters: { ticket_id: input.id, actor: local.session.user } },
    ],
  })
  result.resolved = local.done.committed
}
```

Tables are `"PUBLIC"."<entity>"` on HSQLDB, columns the model column names,
quoted. A second resolve fails with `SQL_WRITE_ROW_COUNT` (409) and rolls
back. In production, override the connection once in the project
configuration (`configs.<name>.sql.connections.desk` in `_flow/engine.yaml`,
`flow://guide/tags`): it applies to generated and business Flows alike.

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
    throw { code: "FORBIDDEN", message: "Role denied", status: 403 }
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
local.list = requestable.call({
  requestable: ".desk_tickets_list",
  input: { offset: 0, limit: 200, includeResource: true },
})
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
(`flow://guide/start`).

### Scheduled jobs

A job has no session, so the generated entity Flows refuse it
(`UNAUTHENTICATED`). Write a private Flow that works through named SQL with
the copied connection, as a business action does, bounded and idempotent;
schedule it as `flow://guide/multipage-entities` shows.
