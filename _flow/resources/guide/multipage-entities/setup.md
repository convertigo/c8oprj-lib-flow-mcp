# Multi-page entity setup

Read for the complete booking model, SQL configuration, seed and private demo reset.

## 1. Prepare and declare once

Bootstrap the target with
`flow-project-bootstrap({project,ui:true,references:["lib_flow_entity","lib_flow_sql","lib_flow_crud_data"]})`.
For an existing project, add missing references with `flow-project-reference`
(dry run first). Declare the SQL/CRUD dependencies directly: the block catalog
reads direct project references. `ui:true` adds the Svelte provider. Read
`flow://guide/entities`, `flow://guide/authoring` and
`flow://guide/frontend-svelte`; agree the backend/frontend contract as in
`flow://guide/fullstack-paperboard`. Read block contracts with `flow-block-get`.
Write blocks and Flows with `code-set` (then `code-promote` for executable
Flows). Read and patch `_flow/engine.yaml` and the SQL JSON resources with
`flow-resource-get` / `flow-resource-patch`, using their `baseHash`. Set demo
server symbols with `flow-project-symbol-set`; keep their source defaults off.
Replace `<project>` in symbol names here and in the actor guide with the exact
target project name, so enabling the bootstrap symbol changes the same setting.

Use `flow-entity-model-get`, `flow-entity-model-check`, then
`flow-entity-model-set` with the returned revision. This model creates no CRUD
source. USER sees and changes only their reservations; MANAGER/ADMIN sees all.
The journal is manager-only. Dates are ISO dates; `id`, `room` and revision
are **exact int64 text**, including values above JavaScript's safe integer.
Never convert them with `Number` or `parseInt`.

<!-- example: booking-model -->
```json
{
  "version": 2,
  "modelVersion": 1,
  "demo": {"dataFile":"_flow/resources/entities/demo.json"},
  "entities": {
    "Room": {
      "traits": ["Révisé"],
      "display": {"title":"name"},
      "fields": {
        "name":{"type":"string","maxLength":100}
      }
    },
    "Reservation": {
      "traits": ["Révisé","Horodaté",{"Possédé":{"owner":"owner","unrestricted":["MANAGER","ADMIN"]}},{"Journalisé":{"fields":["title","room","starts","ends","status","owner"]}}],
      "hooks": {"beforeSave":"BookingRule"},
      "display": {"title":"title"},
      "fields": {
        "title":{"type":"string","maxLength":100},
        "room":{"type":"int64","relation":{"entity":"Room","labelField":"name"}},
        "starts":{"type":"date"},
        "ends":{"type":"date"},
        "status":{"type":"enum","values":["OPEN","CANCELLED"],"default":"OPEN"}
      }
    },
    "Audit": {
      "readOnly": true,
      "permissions": {"read":["MANAGER","ADMIN"]},
      "storage": {"table":"FLOW_ENTITY_AUDIT","columns":{"entityKey":"ENTITY_KEY","valuesJson":"VALUES_JSON"}},
      "display": {"title":"operation"},
      "fields": {
        "entity":{"type":"string"},
        "entityKey":{"type":"string"},
        "operation":{"type":"string"},
        "actor":{"type":"string"},
        "at":{"type":"timestamp"},
        "valuesJson":{"type":"string"}
      }
    },
    "APP_USER": {
      "label": "Demo directory",
      "identity": ["user"],
      "display": {"title":"user"},
      "permissions": {"read":[],"create":[],"update":[],"delete":[]},
      "fields": {
        "user":{"type":"string","column":"USER_ID","maxLength":100},
        "role":{"type":"string","maxLength":20},
        "active":{"type":"boolean"},
        "demo":{"type":"boolean"}
      }
    }
  }
}
```

Add the actor configuration, `app.actor` block and `DemoLogin` Flow from
`flow://guide/entities`. Merge (do not replace) this connection
and these technical queries into the same `_flow/engine.yaml` configuration.
Merge the `sql.queries` entries with the actor queries; do not replace them.
Preserve the quoted physical identifiers for HSQLDB and PostgreSQL:

<!-- example: booking-config -->
```yaml
config:
  jobs:
    enabled: "${<project>.jobs.enabled=false}"
  sql:
    connections:
      app:
        dialect: hsqldb
        url: jdbc:hsqldb:file:.//_flow/resources/sql/database/bookings;shutdown=true
        user: SA
        password: "${<project>.db.password.secret=}"
        nativeRead: true
        nativeWrite: true
    writes:
      lockRoom:
        connection: app
        operation: update
        expose: false
        sql: 'UPDATE "ROOM" SET "REVISION"="REVISION" WHERE "ID"=:room'
        parameters: [{name: room, type: int64}]
    queries:
      overlap:
        connection: app
        readOnly: true
        expose: false
        maxRows: 1
        sql: 'SELECT COUNT(*) AS "total" FROM "RESERVATION" WHERE "ROOM"=:room AND "STATUS"=''OPEN'' AND "STARTS"<:ends AND "ENDS">:starts AND (:id IS NULL OR "ID"<>:id)'
        parameters: [{name: room, type: int64}, {name: starts, type: date}, {name: ends, type: date}, {name: id, type: int64, nullable: true, default: null}]
        columns: [{name: total, type: int64, nullable: false}]
      startsToday:
        connection: app
        readOnly: true
        expose: false
        maxRows: 1
        sql: 'SELECT COUNT(*) AS "total" FROM "RESERVATION" WHERE "STARTS"=:day AND "STATUS"=''OPEN'''
        parameters: [{name: day, type: date}]
        columns: [{name: total, type: int64, nullable: false}]
```

For HSQLDB keep the database under the protected `_flow/resources/sql/` path,
ignore its files in Git and use an external DBMS for production. CAR replacement
can replace a development database. Do not duplicate the business entity schema
in SQL JSON. The technical `APP_USER` directory is declared in the same model,
with no entity CRUD permissions; the private actor reads it directly. There is
no separate account schema, preparation Flow or ADMIN initialization step.
Save this typed **entity field** seed at `_flow/resources/entities/demo.json`:

<!-- example: booking-demo-seed -->
```json
{"entities":{"Reservation":[],"Room":[{"id":"1","name":"Room A"}],"APP_USER":[{"user":"demo-alpha","role":"USER","active":true,"demo":true},{"user":"demo-beta","role":"USER","active":true,"demo":true},{"user":"demo-manager","role":"ADMIN","active":true,"demo":true}]}}
```

`entity.initialize` remains additive and session independent. `entity.demoReset`
deletes data and reapplies the typed seed: its calling Flow must be **private**.
It runs in Studio; on a server it is refused unless the server symbol
`lib_flow_entity.demoReset.enabled` is explicitly `true` (default false).
Neither request input nor project config enables it. The server log records the
actor, instant and actual number of seeded rows. Database grants still apply.

Keep the optional demo-login switch below as an additional application condition.
For an ADMIN button, use a separate hidden Flow that verifies ADMIN before
`requestable.call` to this private Flow; a switch alone is never a role check.

<!-- example: demo-reset -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "private" }

function demo_reset({ input, config, result }) {
  if (String(config.demo.login) !== "true") {
    throw { code: "DEMO_RESET_DISABLED", message: "Demo reset is disabled" }
  }
  result.reset = entity.demoReset({})
}
```

Call this private Flow from Studio tooling before demo sign-in; it initializes
the model tables, empties them in relation/FK order and reapplies the seed.
Replay returns the same demo rows, including the neutral directory. Other
application databases are not involved. It bypasses entity permissions and hooks
intentionally; use `entity.save` for ordinary authorized business writes.
