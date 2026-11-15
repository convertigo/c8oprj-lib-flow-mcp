# Generated CRUD: FLOWS

Read for generated Flow calls, transactions and per-user scope.

### Call the generated Flows

A business Flow reuses the model rights by calling the generated Flows in the
same session: `requestable.call` returns their result.

```javascript
local.session = requestable.call({ requestable: ".desk_session" })
if (!local.session.permissions.tickets.update) {
  throw { code: "FORBIDDEN", message: "Role denied" }
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
    throw { code: "FORBIDDEN", message: "Role denied" }
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
    throw { code: "FORBIDDEN", message: "Role denied" }
  }
  local.mine = sql.query({ query: "my_tickets_rows", parameters: { user: local.session.user } })
  result.rows = local.mine.rows
}
```

With `my_tickets_rows` declared as a named read (`readOnly: true`,
`expose: false`, the copied connection).
