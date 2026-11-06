# Multi-Page Business Application by Entities

Role-based multi-page application by entities: quick path and declarations; access rules and pages, exports, jobs and proof in sub-guides.

For the simplest compliant start with persisted business data and roles, use **Short path** in `flow://guide/entities`, then follow this recipe.

## Quick path: contract first, details below

1. Bootstrap with `flow-project-bootstrap` and direct references to
   `lib_flow_entity`, `lib_flow_sql`, `lib_flow_crud_data`; set `ui:true` when
   a Svelte application is needed. Do not generate CRUD sources.
2. Read **Your own HTTP contract over entities** in `flow://guide/entities`
   first when Flow names, JSON keys or error codes are imposed. They do not
   require direct SQL: ordinary public Flows wrap `entity.*`.
3. Configure one SQL connection and declare Room/Reservation once with
   `flow-entity-model-check` then `flow-entity-model-set` using its revision.
   Keep IDs/revisions as text and dates as ISO; no duplicate business schema.
4. Install the private `app.actor` from the entities guide. It reads only the
   authenticated server session and the server directory; never client roles.
5. For a demo, install `DemoLogin`, `CurrentUser` (`me`) and `Logout` of `flow://guide/multipage-entities-access`.
   Prepare only neutral demo accounts; leave the demo switch off by default.
   Prefer `lib_UserManager` for real accounts/passwords, not for a demo picker.
6. Edit scaffolded `app.entityAccess` with the policy of `flow://guide/multipage-entities-access`: USER sees their
   rows (with `Possédé`), MANAGER/ADMIN sees all. `publicRead` explicitly
   opens selected entities. Writes stay closed until this application decision.
7. Declare the typed entity demo seed below and call the public `demo_reset`
   before sign-in. No ADMIN cookie or separate initialization Flow is needed.
   Its guard belongs to the application; the library imposes none.
8. Add the private BookingRule hook of `flow://guide/multipage-entities-access`. It locks the room, checks overlap
   across all owners, and throws on refusal; data and audit roll back together.
   For an imposed 409, use HttpBookingRule from the entities guide instead.
9. Expose only the named Flows your HTTP contract needs: guard the session,
   validate inputs, call entity.list/read/save/delete with checkAccess:true,
   translate known errors, then return exact keys. For example, convert hidden-row 404 uniformly to 403.
10. Add EntityTable/EntityForm without targetProject: they use this application
    EntityGateway. Put New in its Toolbar, guarded by context.permissions.create;
    wire select to the form and saved/deleted to refresh, as in `flow://guide/multipage-entities-pages`.
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

`entity.initialize` and `entity.demoReset` have **no session, role or demo-switch
protection**. Convertigo Private is not an internal ACL: a public Flow calling
private code is responsible for exposing it. Protect public entry points in the
application according to its contract. Production relies on the configured DB
account's grants (password from a secret symbol), normally not a root account.
The initializer only creates/adds; the separate reset explicitly deletes data.

Here the application chooses its existing demo-login switch for `demo_reset`.
Remove or adapt this guard when your application's contract requires another
policy. The library neither enforces this switch nor an `allowOnServer` flag.

<!-- example: demo-reset -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "hidden" }

function demo_reset({ input, config, result }) {
  if (String(config.demo.login) !== "true") {
    throw { code: "DEMO_RESET_DISABLED", message: "Demo reset is disabled" }
  }
  result.reset = entity.demoReset({})
}
```

Call this public HTTP Flow before sign-in, without any cookie; it initializes
the model tables, empties them in relation/FK order and reapplies the seed.
Replay returns the same demo rows, including the neutral directory. Other
application databases are not involved. It bypasses entity permissions and hooks
intentionally; use `entity.save` for ordinary authorized business writes.

## Sub-guides

The rest of this guide is in focused sub-guides; read one only when the task needs it, once.

| Sub-guide (size) | Read it |
| --- | --- |
| `flow://guide/multipage-entities-access` (7.0 KB) | demo login, me and logout, application access, access rule hook |
| `flow://guide/multipage-entities-pages` (11.5 KB) | pages, CSV export, scheduled jobs, audit, final proof |
