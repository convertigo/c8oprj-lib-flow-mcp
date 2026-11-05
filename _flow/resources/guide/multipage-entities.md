# Multi-Page Business Application by Entities

Build a role-based booking application with session authentication, per-user entities, ordinary widget events, CSV export, a scheduled check and atomic auditing.

> This delivery validates the backend policy. UI examples below are preserved
> for the following frontend palier; its transport update is still required.

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
5. For a demo, install `DemoLogin`, `CurrentUser` (`me`) and `Logout` below.
   Prepare only neutral demo accounts; leave the demo switch off by default.
   Prefer `lib_UserManager` for real accounts/passwords, not for a demo picker.
6. Edit scaffolded `app.entityAccess` with the policy below: USER sees their
   rows (with `Possédé`), MANAGER/ADMIN sees all. `publicRead` explicitly
   opens selected entities. Writes stay closed until this application decision.
7. Declare the typed entity demo seed below and call the public `demo_reset`
   before sign-in. No ADMIN cookie or separate initialization Flow is needed.
   Its guard belongs to the application; the library imposes none.
8. Add the private BookingRule hook below. It locks the room, checks overlap
   across all owners, and throws on refusal; data and audit roll back together.
   For an imposed 409, use HttpBookingRule from the entities guide instead.
9. Expose only the named Flows your HTTP contract needs: guard the session,
   validate inputs, call entity.list/read/save/delete with checkAccess:true,
    translate known errors,
   return exact keys. For example, convert hidden-row 404 uniformly to 403.
10. When screens are required, wire EntityTable selection to EntityForm and
    saved/deleted events back to refresh, as below. HTTP facades do not require
    these widgets; use them when they reduce screen code.
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
and these technical queries into the same `_flow/engine.yaml` configuration:

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
        sql: 'UPDATE ROOM SET REVISION=REVISION WHERE ID=:room'
        parameters: [{name: room, type: int64}]
    queries:
      overlap:
        connection: app
        readOnly: true
        expose: false
        maxRows: 1
        sql: 'SELECT COUNT(*) AS "total" FROM RESERVATION WHERE ROOM=:room AND STATUS=''OPEN'' AND STARTS<:ends AND ENDS>:starts AND (:id IS NULL OR ID<>:id)'
        parameters: [{name: room, type: int64}, {name: starts, type: date}, {name: ends, type: date}, {name: id, type: int64, nullable: true, default: null}]
        columns: [{name: total, type: int64, nullable: false}]
      startsToday:
        connection: app
        readOnly: true
        expose: false
        maxRows: 1
        sql: 'SELECT COUNT(*) AS "total" FROM RESERVATION WHERE STARTS=:day AND STATUS=''OPEN'''
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
    throw { code: "DEMO_RESET_DISABLED", message: "Demo reset is disabled", status: 403 }
  }
  result.reset = entity.demoReset({})
}
```

Call this public HTTP Flow before sign-in, without any cookie; it initializes
the model tables, empties them in relation/FK order and reapplies the seed.
Replay returns the same demo rows, including the neutral directory. Other
application databases are not involved. It bypasses entity permissions and hooks
intentionally; use `entity.save` for ordinary authorized business writes.

## Demo login

`DemoLogin` from `flow://guide/entities` checks
`String(config.demo.login) === "true"` **before** looking up the chosen active
demo account and calling `session.authenticate`. The symbol
`<project>.demo.login` defaults false in the delivered project. Enable it only
for the demonstration; show the picker only when `CurrentUser.demoLoginEnabled`
is true. Never add a role input. A demo identity is not a real password check.

Keep the MCP bearer (source author) distinct from application cookie sessions.
After `demo_reset`, sign in through the application; never infer this identity
from `code-run` or its author token. Public `entity.*` calls use `checkAccess:true` and the unique application policy.
Trusted private calls require no session or model ACL. Their first use ensures the additive
schema once per JVM/connection/model fingerprint; no initialization screen or
ADMIN cookie is needed. Explicit `entity.initialize({})` is available for
maintenance or a read-only `dryRun` / `verifyOnly`, without a session.

## Me and logout

The public `CurrentUser` is the `me` endpoint: anonymous is a normal result;
an inactive account is refused by the server provider. A revoked role stops
authorizing entity operations as soon as the server table changes.

<!-- example: current-user -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "hidden" }

function CurrentUser({ input, config, result }) {
  local.user = session.authenticatedUser({})
  local.demoLoginEnabled = String(config.demo.login) === "true"
  if (!local.user) {
    return { authenticated: false, user: null, demoLoginEnabled: local.demoLoginEnabled }
  }
  local.actor = app.actor({})
  return {
    authenticated: true,
    demoLoginEnabled: local.demoLoginEnabled,
    user: { id: local.actor.user, firstName: local.actor.user, role: local.actor.roles[0] },
  }
}
```

<!-- example: logout -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "hidden" }

function Logout({ input, config, result }) {
  session.authenticate({ user: "" })
  return { authenticated: false, user: null }
}
```

## Application access, one editable block

Model-set has created `EntityGateway` and the default private
`app.entityAccess` without overwriting existing code. Replace **only the policy**
with this application decision. The actor provider above supplies server roles.
No gateway slot or config key is needed; no model ACL opens additional rights.
`Audit`/`APP_USER` retain optional deny-only ACLs as a second restriction.

<!-- example: booking-access-policy -->
```javascript
const _meta = {sourceVersion:2,version:1,private:true,properties:{request:{type:"object",kind:"expression"}},outputs:{out:{type:"object"}}}

function block({ input, config, result }) {
  // Explicit public catalog reads only; leave empty for authenticated reads.
  local.publicRead = []
  if (!input.request.user) {
    if (!input.request.write && (local.publicRead.includes("*") || local.publicRead.includes(input.request.entity))) {
      return {}
    }
    throw { code: "UNAUTHENTICATED", message: "Sign in first", status: 401 }
  }
  local.roles = input.request.roles || []
  local.manager = local.roles.includes("MANAGER") || local.roles.includes("ADMIN")
  if (!local.manager && !local.roles.includes("USER")) {
    throw { code: "FORBIDDEN", message: "Booking role required", status: 403 }
  }
  if (input.request.entity === "APP_USER" || (input.request.entity === "Audit" && !local.manager)) {
    throw { code: "FORBIDDEN", message: "Directory or audit unavailable", status: 403 }
  }
  if (input.request.write && ((input.request.entity === "Room" && !local.manager) || (input.request.operation ===
    "delete" && !local.manager))) {
    throw { code: "FORBIDDEN", message: "Manager action required", status: 403 }
  }
  if (input.request.entity === "Reservation" && !local.manager) {
    return { scope: { owner: input.request.user } }
  }
  return {}
}
```

`publicRead` is the single explicit opt-in for anonymous reads. Carefully choose
public entities, including their fields and relations. Server scope is also
applied to labels, options and counts. `Possédé` remains a reusable checked
ownership trait; private hooks may read across owners deliberately.
`initialize` and `demoReset` are not gateway operations and are not protected by
this policy. Their public calling Flow supplies its own guard as below.

## 2. Apply the rule in an ordinary hook

A booking occupies `[starts, ends)`: adjoining dates are allowed; an empty or
reversed interval is refused. `beforeSave` receives `input.mutation`
(`creating`, `key`, `patch`, `revision`) and the trusted `input.actor`.
For an update, merge the patch with the permitted existing row. Use the hook
below, not two independent frontend writes. The private named overlap query
checks **all owners** without exposing their rows to the caller. The no-op
room update locks that resource until the same `entity.save` transaction ends,
so competing saves of this room check after the preceding commit. No role is
invented, no new transaction primitive is needed, and rejection rolls back the
mutation and its journal. Keep all reservation writes on this hook; do not
expose the technical SQL statements as HTTP facades.

<!-- example: booking-rule -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "private", authenticatedContextRequired: true }

function BookingRule({ input, config, result }) {
  local.values = input.mutation.patch
  if (!input.mutation.creating) {
    local.previous = entity.read({ entity: "Reservation", key: input.mutation.key })
    local.values = object.merge({ target: local.previous.values, source: input.mutation.patch })
  }
  if (local.values.starts >= local.values.ends) {
    throw { code: "BOOKING_DATES_INVALID", message: "End must follow start", status: 422 }
  }
  local.lock = sql.write({ statement: "lockRoom", parameters: { room: local.values.room } })
  if (local.lock.affectedRows !== 1) {
    throw { code: "ROOM_NOT_FOUND", message: "Choose an existing room", status: 422 }
  }
  if (local.values.status === "OPEN") {
    local.overlap = sql.query({
      query: "overlap",
      parameters: {
        room: local.values.room,
        starts: local.values.starts,
        ends: local.values.ends,
        id: input.mutation.creating ? null : input.mutation.key.id,
      },
      limit: 1,
    })
    if (local.overlap.rows[0].total !== "0") {
      throw { code: "BOOKING_OVERLAP", message: "This room is already booked", status: 422 }
    }
  }
  return { ok: true }
}
```

This is a small SQL locking convention for this rule, not a second CRUD layer.
When editing the example, qualify the DBMS's transaction isolation and retry
its deadlock/serialization errors as whole operations. A successful sequential
rejection test alone does not prove every concurrent schedule.

## 3. Build pages with ordinary events

Use `BookingApp` below as the target project name (adapt it to your project).
Create home/sign-in, `mine`, `manage` and `journal` pages **before** links. The
root Layout refreshes `CurrentUser` after navigation. Show management and journal
links only for MANAGER/ADMIN, and guard their pages before mounting tables.
The server model enforces the perimeter even if a user navigates directly.
Use `Status actionId="loginCall"` for transport/Flow errors. In a login button,
chain `CallSequence requestable=".DemoLogin"` (account only), then `Navigate`;
do not pass a role. For logout, pass `__disableAutologin=true` so the SDK cannot
replay sign-in. Navigate only in the successful login/logout action chain.

<!-- example: session-layout -->
```svelte
<script module>export const _flow = { sourceVersion: 2 };</script>
<FlowComponent $$id="sessionLayout">
  <Variables><State $$id="session" type="object" value={{ authenticated: false, user: null }} /></Variables>
  <Events><OnAfterNavigate $$id="refreshSession"><Actions>
    <CallSequence $$id="loadSession" requestable=".CurrentUser" $$out="layout.session" />
  </Actions></OnAfterNavigate></Events>
  <Structure>
    <AppShell $$id="shell" title="Bookings" userName={layout.session.user?.firstName ?? ""}>
      <Navigation><LinkButton $$id="mine" label="My bookings" page="mine" /></Navigation>
      <Tools><Button $$id="logout" label="Sign out" variant="ghost"><Events><OnClick $$id="signout"><Actions>
        <CallSequence $$id="logoutCall" requestable=".Logout"><Variables><Variable name="__disableAutologin" value={true} /></Variables></CallSequence>
        <Navigate $$id="goHome" page="home" />
      </Actions></OnClick></Events></Button></Tools>
      <Children><PageContent $$id="content" /></Children>
    </AppShell>
  </Structure>
</FlowComponent>
```

For the guarded `mine` page, use this editing chain; create and delete actions
follow the effective model permissions. MANAGER uses the same widgets without
a forced `scope="mine"`; the user perimeter is enforced server-side in both.
Business validation uses 422 so EntityForm shows its message; 409 is reserved
for the stale-revision reload path. A conflict is shown by EntityForm; its Reload command reloads before retry.

<!-- example: booking-editor -->
```svelte
<script module>export const _flow = { sourceVersion: 2, page: { id: "mine" } };</script>
<FlowComponent $$id="bookingEditor">
  <Variables>
    <State $$id="session" type="object" value={{ authenticated: false, user: null }} />
    <State $$id="row" type="object" value={null} />
    <State $$id="editing" type="boolean" value={false} />
    <State $$id="refresh" type="number" value={0} />
  </Variables>
  <Events><OnMount $$id="checkSession"><Actions>
    <CallSequence $$id="me" requestable=".CurrentUser" $$out="page.session" />
  </Actions></OnMount></Events>
  <Structure>
    <PageHeader $$id="heading" title="My bookings" />
    <Status $$id="sessionStatus" actionId="me" />
    <If $$id="authenticated" test={page.session.authenticated}><Then>
      <Button $$id="create" label="New booking"><Events><OnClick $$id="new"><Actions>
        <SetValue $$id="clear" target="page.row" value={null} />
        <SetValue $$id="open" target="page.editing" value={true} />
      </Actions></OnClick></Events></Button>
      <EntityTable $$id="bookings" entity="Reservation" targetProject="BookingApp" scope="mine" refreshKey="@page.refresh">
        <Events><OnSelect $$id="select"><Actions>
          <SetValue $$id="keep" target="page.row" value="@event.value" />
          <SetValue $$id="edit" target="page.editing" value={true} />
        </Actions></OnSelect></Events>
      </EntityTable>
      <If $$id="editor" test={page.editing}><Then>
        <EntityForm $$id="form" entity="Reservation" targetProject="BookingApp" row="@page.row">
          <Events>
            <OnSaved $$id="saved"><Actions>
              <SetValue $$id="closeSaved" target="page.editing" value={false} />
              <SetValue $$id="clearSaved" target="page.row" value={null} />
              <UpdateNumber $$id="refreshSaved" target="page.refresh" operation="increment" step={1} />
            </Actions></OnSaved>
            <OnDeleted $$id="deleted"><Actions>
              <SetValue $$id="closeDeleted" target="page.editing" value={false} />
              <SetValue $$id="clearDeleted" target="page.row" value={null} />
              <UpdateNumber $$id="refreshDeleted" target="page.refresh" operation="increment" step={1} />
            </Actions></OnDeleted>
            <OnCancel $$id="cancel"><Actions>
              <SetValue $$id="closeCancel" target="page.editing" value={false} />
              <SetValue $$id="clearCancel" target="page.row" value={null} />
            </Actions></OnCancel>
          </Events>
        </EntityForm>
      </Then></If>
    </Then><Else><Text $$id="loginRequired" text="Sign in to see your bookings." /></Else></If>
  </Structure>
</FlowComponent>
```

Add `EntityTable entity="Audit"` to the manager-guarded journal page. For a
custom cell, preserve the generic lexical snippet arguments described in
`flow://guide/entities`; do not copy widget internals or add browser scripts.

## Export CSV

The export reuses `entity.list` with `checkAccess:true`, so forged users and roles cannot widen its
perimeter. This minimal export has no client filter and is explicitly complete
up to 200 rows: if more exist, refuse rather than silently export one page.
When adding screen filters, validate and pass the **same** filters here. For
larger exports use a bounded paging loop, not a client-side CSV encoder.

<!-- example: export-bookings -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "hidden", authenticatedContextRequired: true }

function ExportBookings({ input, config, result }) {
  local.page = entity.list({ entity: "Reservation", checkAccess: true, options: { limit: 200, orderBy: "id" } })
  if (local.page.hasMore) {
    throw { code: "EXPORT_LIMIT", message: "Narrow the export below 201 rows", status: 413 }
  }
  local.rows = list.map({
    items: local.page.rows,
    select: {
      id: current.key.id,
      title: current.values.title,
      starts: current.values.starts,
      ends: current.values.ends,
    },
  })
  result.file = data.csv({
    rows: local.rows,
    columns: [
      { field: "id", type: "int64" },
      { field: "title" },
      { field: "starts", type: "date" },
      { field: "ends", type: "date" },
    ],
    filename: "bookings.csv",
    separator: ";",
    bom: true,
    maxRows: 200,
    maxBytes: 1048576,
  })
}
```

Use ordinary `CallSequence` then `FileDownload` with `@page.export.file`; read
the `data.csv` and frontend file-download contracts from the palette. The CSV
has UTF-8 BOM, French dates and formula protection. A `.bin` facade can instead
end with `file.respond`. Neither a download button nor a hidden link grants
permission.

## Scheduled jobs

Start with a **read-only daily check**: a private Flow counts bookings starting
today, with a server date, no browser session and no notification side effect.
It is naturally replayable; do not claim that a message was sent. The job is off
by default through `<project>.jobs.enabled`. No session is forged for the job.
The private named query has only the aggregate necessary for this service.

<!-- example: daily-bookings -->
```javascript
const _flow = { sourceVersion: 2, accessibility: "private" }

function DailyBookings({ input, config, result }) {
  if (String(config.jobs.enabled) !== "true") {
    return { enabled: false, count: "0" }
  }
  local.day = date.today({ timeZone: "Europe/Paris" })
  local.page = sql.query({ query: "startsToday", parameters: { day: local.day }, limit: 1 })
  return { enabled: true, day: local.day, count: local.page.rows[0].total }
}
```

Inspect `scheduler-list`, then use the advertised relayed `scheduler-apply` to
schedule the exact private `<project>.DailyBookings` requestable with a
project-specific job name, Europe/Paris and a daily trigger. Read that tool's
contract; scheduler availability is deployment-specific. Run it once and replay
it before enabling the schedule. For real sending, add an idempotent outbox and
`email.send` with a capture server first; do not send external effects in a JDBC
transaction.

## Audit

`Journalisé` allowlists only the model fields shown above. The library writes
actor, operation, key, server date and those values **in the mutation's SQL
transaction**. Failure of the hook or journal aborts the write; no password,
token or account secret belongs in this model or journal. The read-only Audit
entity shares the table and checks MANAGER/ADMIN read permissions. Review
retention separately; a journal after a committed mutation is not equivalent.

## 4. Prove and deliver

Test anonymous, two USER sessions and a manager in distinct cookie jars; check
own/foreign reads and writes, client role forgery, revoked roles, two overlapping
bookings by different users, adjoining dates, partial updates, stale revision,
CSV perimeter/formulas/dates/limits, job off/on/replay, journal contents and
rollback, and logout with the old cookie. A page guard complements server checks.
Use `frontend-svelte-action` dev.open, then one relayed verifier for the roles;
a successful build or HTTP 200 alone is not interaction proof. Sign-in errors
may have HTTP 200 with a Flow error: show `Status`, not only a result field.

Keep sources in Git and runtime data out. Run `flow-block-mock-list`, build with
`frontend-svelte-action` build, try the published URL, and run
`flow-app-progress` hardening. Keep CORS same-origin, symbols for credentials,
demo login/jobs off by default, private initialization and documented production
identity/database choices. Entity example tests execute every backend/config
fence above; `frontend-guide-examples` compiles the exact layout and editor.
